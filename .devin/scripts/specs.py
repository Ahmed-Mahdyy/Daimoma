import argparse
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
BASE_FEATURES = (
    "001-brand-product-foundation",
    "002-authentication-rbac",
    "003-employee-requests",
    "004-timesheets",
    "005-dashboard-reporting",
    "006-release-hardening",
    "007-deployment-handover",
)
REQUIRED_FILES = (
    "spec.md", "plan.md", "tasks.md", "research.md", "data-model.md",
    "quickstart.md", "checklists/requirements.md", "checklists/review.md",
)
REQ_PATTERN = re.compile(r"^- \*\*(FR-\d{3})\*\*:", re.MULTILINE)
TASK_PATTERN = re.compile(r"^- \[([ xX])\] (T\d{3}) (.+)$", re.MULTILINE)


def features(root):
    return sorted(
        path for path in (root / "specs").iterdir()
        if path.is_dir() and re.fullmatch(r"\d{3}-[a-z0-9-]+", path.name)
        and path.resolve().parent == (root / "specs").resolve()
        and path.resolve().is_relative_to(root.resolve())
    )


def state_object(root):
    state = root / ".specify/feature.json"
    value = json.loads(state.read_text(encoding="utf-8")) if state.exists() else {}
    if not isinstance(value, dict):
        raise ValueError("Feature state must be a JSON object.")
    return value


def active_feature(root):
    raw = os.environ.get("SPECIFY_FEATURE_DIRECTORY") or state_object(root).get("feature_directory")
    if not isinstance(raw, str) or not raw:
        raise ValueError("No active feature. Run: python3 .devin/scripts/specs.py select 001")
    candidate = (root / raw).resolve()
    if candidate not in [item.resolve() for item in features(root)]:
        raise ValueError("Active feature must be a known directory inside this project's specs/.")
    return candidate


def select_feature(root, name):
    if os.environ.get("SPECIFY_FEATURE_DIRECTORY"):
        raise ValueError("Unset SPECIFY_FEATURE_DIRECTORY before changing the stored active feature.")
    candidates = [path for path in features(root) if name in (path.name, path.name[:3])]
    if len(candidates) != 1:
        raise ValueError("Choose an unambiguous known feature ID or full name; paths are not accepted.")
    state = root / ".specify/feature.json"
    if state.is_symlink() or state.parent.resolve() != root.resolve() / ".specify":
        raise ValueError("Refusing to write feature state through a symbolic link.")
    value = state_object(root)
    value["feature_directory"] = candidates[0].relative_to(root).as_posix()
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=state.parent, delete=False) as temp:
        temporary = Path(temp.name)
        try:
            temp.write(json.dumps(value, indent=2) + "\n")
            temp.flush()
            os.fsync(temp.fileno())
        except OSError:
            temporary.unlink(missing_ok=True)
            raise
    try:
        os.replace(temporary, state)
    finally:
        temporary.unlink(missing_ok=True)
    return candidates[0]


def markdown_errors(path, root):
    text = re.sub(r"<!--.*?-->", "", path.read_text(encoding="utf-8"), flags=re.DOTALL)
    errors = []
    if len(re.findall(r"^\s*```", text, re.MULTILINE)) % 2:
        errors.append(f"{path.relative_to(root)}: unbalanced code fences")
    for target in re.findall(r"\[[^\]\n]+\]\(([^)\n]+)\)", text):
        parsed = urlsplit(target.strip("<>"))
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        destination = (path.parent / unquote(parsed.path)).resolve()
        if not destination.is_relative_to(root.resolve()) or not destination.exists():
            errors.append(f"{path.relative_to(root)}: missing/outside local link {target}")
    return errors


def validate_feature(path):
    errors = []
    for name in REQUIRED_FILES:
        file = path / name
        if not file.is_file() or not file.read_text(encoding="utf-8").strip():
            errors.append(f"{path.name}: missing/empty {name}")
    contracts = list((path / "contracts").glob("*.md"))
    if not contracts or any(not file.read_text(encoding="utf-8").strip() for file in contracts):
        errors.append(f"{path.name}: missing/empty contracts")
    if errors:
        return errors, (0, 0, 0)
    spec = (path / "spec.md").read_text(encoding="utf-8")
    task_text = (path / "tasks.md").read_text(encoding="utf-8")
    requirements = REQ_PATTERN.findall(spec)
    tasks = TASK_PATTERN.findall(task_text)
    stories = {f"US{number}" for number in re.findall(r"^### User Story (\d+)", spec, re.MULTILINE)}
    for heading in ("## User Scenarios & Testing", "## Requirements", "## Success Criteria"):
        if heading not in spec:
            errors.append(f"{path.name}: missing {heading}")
    if not requirements or len(requirements) != len(set(requirements)):
        errors.append(f"{path.name}: missing/duplicate requirement IDs")
    expected = [f"T{number:03d}" for number in range(1, len(tasks) + 1)]
    if not tasks or [task[1] for task in tasks] != expected:
        errors.append(f"{path.name}: task IDs must be unique, ordered, and consecutive")
    checkbox_lines = re.findall(r"^- \[[ xX]\] .+$", task_text, re.MULTILINE)
    if len(checkbox_lines) != len(tasks):
        errors.append(f"{path.name}: malformed task checkbox")
    mapped = set()
    mapped_stories = set()
    for _, task_id, description in tasks:
        references = set(re.findall(r"\bFR-\d{3}\b", description))
        labels = set(re.findall(r"\[(US\d+)\]", description))
        mapped.update(references)
        mapped_stories.update(labels)
        if not references or references - set(requirements):
            errors.append(f"{path.name}:{task_id}: missing/unknown requirement reference")
        if labels - stories:
            errors.append(f"{path.name}:{task_id}: unknown user story")
        if not re.search(r"`[^`]+(?:/|\.[a-z]+)[^`]*`", description):
            errors.append(f"{path.name}:{task_id}: missing concrete file/directory path")
    if set(requirements) - mapped:
        errors.append(f"{path.name}: uncovered requirements {sorted(set(requirements) - mapped)}")
    if not stories or stories - mapped_stories:
        errors.append(f"{path.name}: missing story task coverage")
    pending = sum(
        len(re.findall(r"^- \[ \]", file.read_text(encoding="utf-8"), re.MULTILINE))
        for file in (path / "checklists").glob("*.md")
    )
    return errors, (len(requirements), len(tasks), pending)


def check_project(root, require_ready=False):
    errors = []
    paths = features(root)
    names = [path.name for path in paths]
    missing = set(BASE_FEATURES) - set(names)
    if missing:
        errors.append(f"Missing baseline features: {sorted(missing)}")
    prefixes = [name[:3] for name in names]
    if len(prefixes) != len(set(prefixes)):
        errors.append("Duplicate feature number prefixes")
    master = (root / "AGENTS.md").read_text(encoding="utf-8")
    decisions = set(re.findall(r"^\| (D-\d{3}) \|", master, re.MULTILINE))
    totals = [0, 0, 0]
    documents = [root / "AGENTS.md", root / ".specify/memory/constitution.md", root / "specs/constitution.md"]
    for path in paths:
        findings, stats = validate_feature(path)
        errors.extend(findings)
        totals = [left + right for left, right in zip(totals, stats)]
        print(f"{path.name}: {stats[0]} requirements, {stats[1]} tasks, {stats[2]} open checklist items")
        documents.extend(path.rglob("*.md"))
    for document in documents:
        errors.extend(markdown_errors(document, root))
        references = set(re.findall(r"\bD-\d{3}\b", document.read_text(encoding="utf-8")))
        if references - decisions:
            errors.append(f"{document.relative_to(root)}: unknown decision references")
    active = active_feature(root)
    print(f"Active feature: {active.name}")
    if require_ready and totals[2]:
        errors.append("Open checklist gates remain; structural validity does not authorize implementation.")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"Total: {len(paths)} features, {totals[0]} requirements, {totals[1]} tasks")
    print("Checks cover structure, references, task coverage, and feature selection only; not runtime behavior or human approval.")
    return 1 if errors else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Inspect/select features and validate project specification artifacts.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list")
    select = commands.add_parser("select")
    select.add_argument("feature")
    check = commands.add_parser("check")
    check.add_argument("--require-ready", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "select":
            print(f"Selected {select_feature(ROOT, args.feature).relative_to(ROOT)}")
        elif args.command == "list":
            for path in features(ROOT):
                print(path.name)
            print(f"Active: {active_feature(ROOT).name}")
        else:
            return check_project(ROOT, args.require_ready)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
