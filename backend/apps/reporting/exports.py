"""Bounded, sanitized CSV exports (D-009 2026-10-02):
CSV only, <= EXPORT_ROW_LIMIT rows (fail loudly, never silent truncation),
spreadsheet-formula neutralization on every text cell."""

import csv
import io

from django.http import HttpResponse
from rest_framework.exceptions import ValidationError

from apps.reporting import selectors

# Leading characters that spreadsheet apps execute as formulas —
# including whitespace/control-prefixed variants.
_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _safe_cell(value):
    if value is None:
        return ""
    text = str(value)
    stripped = text.lstrip()
    if stripped[:1] in _DANGEROUS_PREFIXES or text[:1].isspace():
        return "'" + text
    return text


def _bounded_csv(filename, header, count, rows):
    if count > selectors.EXPORT_ROW_LIMIT:
        raise ValidationError(
            {
                "detail": [
                    f"Export exceeds the {selectors.EXPORT_ROW_LIMIT}-row limit "
                    "— narrow the filters."
                ]
            }
        )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow([_safe_cell(c) for c in row])
    resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


def export_working_hours(user, params):
    rows, meta = selectors.working_hours_rows(user, params)
    return _bounded_csv(
        f"working-hours_{meta['period']['from']}_{meta['period']['to']}.csv",
        ["work_date", "employee_code", "employee_name", "department", "minutes"],
        rows.count(),
        (
            (
                r["work_date"].isoformat(),
                r["employee__employee_code"],
                r["employee__display_name"],
                r["employee__department__name"],
                r["minutes"],
            )
            for r in rows
        ),
    )


def export_requests(user, params):
    qs, meta = selectors.request_rows(user, params)
    return _bounded_csv(
        f"requests_{meta['period']['from']}_{meta['period']['to']}.csv",
        [
            "id",
            "title",
            "type",
            "category",
            "status",
            "submitted_at",
            "employee_code",
            "employee_name",
            "department",
        ],
        qs.count(),
        (
            (
                str(r.pk),
                r.title,
                r.type.name,
                r.type.category,
                r.status,
                r.submitted_at.isoformat() if r.submitted_at else "",
                r.employee.employee_code,
                r.employee.display_name,
                r.employee.department.name if r.employee.department else "",
            )
            for r in qs
        ),
    )
