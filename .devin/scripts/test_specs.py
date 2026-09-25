import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import specs


class FeatureToolsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cds specs test ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / ".specify").mkdir()
        self.feature = self.root / "specs/001-example"
        self.feature.mkdir(parents=True)
        self.state = self.root / ".specify/feature.json"
        self.state.write_text(json.dumps({"feature_directory": "specs/001-example", "extra": "preserve"}))
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_select_handles_spaces_and_preserves_metadata(self):
        self.assertEqual(specs.select_feature(self.root, "001"), self.feature)
        self.assertEqual(json.loads(self.state.read_text())["extra"], "preserve")
        self.assertEqual(specs.active_feature(self.root), self.feature)

    def test_select_accepts_full_known_name(self):
        self.assertEqual(specs.select_feature(self.root, "001-example"), self.feature)

    def test_unknown_or_traversal_does_not_change_state(self):
        before = self.state.read_bytes()
        for value in ("999", "../outside", "specs/001-example"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                specs.select_feature(self.root, value)
        self.assertEqual(before, self.state.read_bytes())

    def test_environment_override_blocks_shadowed_selection(self):
        with patch.dict(os.environ, {"SPECIFY_FEATURE_DIRECTORY": "specs/001-example"}):
            self.assertEqual(specs.active_feature(self.root), self.feature)
            with self.assertRaises(ValueError):
                specs.select_feature(self.root, "001")

    def test_outside_active_feature_is_rejected(self):
        with patch.dict(os.environ, {"SPECIFY_FEATURE_DIRECTORY": str(self.root.parent)}):
            with self.assertRaises(ValueError):
                specs.active_feature(self.root)

    def test_malformed_state_is_not_overwritten(self):
        self.state.write_text("[]")
        with self.assertRaises(ValueError):
            specs.select_feature(self.root, "001")
        self.assertEqual(self.state.read_text(), "[]")

    def test_symlinked_state_is_not_overwritten(self):
        target = self.root / "local-state.json"
        self.state.rename(target)
        self.state.symlink_to(target)
        with self.assertRaises(ValueError):
            specs.select_feature(self.root, "001")
        self.assertEqual(json.loads(target.read_text())["extra"], "preserve")

    def test_duplicate_feature_number_is_ambiguous(self):
        (self.root / "specs/001-another").mkdir()
        with self.assertRaises(ValueError):
            specs.select_feature(self.root, "001")

    def test_missing_artifacts_are_reported(self):
        errors, stats = specs.validate_feature(self.feature)
        self.assertTrue(any("missing/empty spec.md" in item for item in errors))
        self.assertEqual(stats, (0, 0, 0))

    def test_missing_links_and_unbalanced_fences_are_reported(self):
        document = self.feature / "spec.md"
        document.write_text("[missing](absent.md)\n```text\n")
        errors = specs.markdown_errors(document, self.root)
        self.assertEqual(len(errors), 2)

    def test_requirement_coverage_and_story_validation(self):
        for name in specs.REQUIRED_FILES:
            file = self.feature / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("# Artifact\n")
        (self.feature / "contracts").mkdir()
        (self.feature / "contracts/api.md").write_text("# Contract\n")
        (self.feature / "spec.md").write_text(
            "## User Scenarios & Testing\n### User Story 1\n## Requirements\n"
            "- **FR-001**: Required behavior.\n## Success Criteria\n"
        )
        tasks = self.feature / "tasks.md"
        tasks.write_text("- [ ] T001 [US1] Implement `backend/example.py` (FR-001).\n")
        self.assertEqual(specs.validate_feature(self.feature)[0], [])
        tasks.write_text("- [ ] T001 [US9] Implement `backend/example.py` (FR-999).\n")
        errors, _ = specs.validate_feature(self.feature)
        self.assertTrue(any("unknown requirement" in item for item in errors))
        self.assertTrue(any("uncovered requirements" in item for item in errors))
        self.assertTrue(any("unknown user story" in item for item in errors))


if __name__ == "__main__":
    unittest.main()
