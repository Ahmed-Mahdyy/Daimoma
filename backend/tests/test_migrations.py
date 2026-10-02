import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_no_migration_drift():
    """Models and migrations must stay in sync (schema drift check)."""
    call_command("makemigrations", check=True, dry_run=True, verbosity=0)


@pytest.mark.django_db(transaction=True)
class TestPopulatedUpgrade:
    """T005 — upgrading a populated schema must not lose records or break
    invariants (FR-002). Rolls `timesheets` back to 0001 with live rows,
    then forward-migrates and asserts everything survived with the new
    columns carrying their documented defaults.

    Uses the real migration runner — a single rolled-back transaction can
    never prove this."""

    def test_populated_timesheet_survives_additive_migrations(self, org, employee):
        from django.db import connection

        call_command("migrate", "timesheets", "0001", verbosity=0, interactive=False)
        try:
            # Populate under the 0001 schema — current_reviewer and
            # route_snapshot don't exist yet, matching a real upgrade.
            with connection.cursor() as cur:
                cur.execute(
                    """INSERT INTO timesheets_timesheet
                       (id, organization_id, employee_id, period_start, period_end,
                        timezone, status, cycle, version, submitted_at, created_at, updated_at)
                       VALUES (gen_random_uuid(), %s, %s, '2026-09-21', '2026-09-27',
                               'UTC', 'collecting', 0, 1, NULL, now(), now())
                       RETURNING id""",
                    [org.pk, employee.profile.pk],
                )
                sheet_id = cur.fetchone()[0]
            # Forward to head — the populated row must survive 0002 + 0003.
            call_command("migrate", "timesheets", verbosity=0, interactive=False)

            from apps.timesheets.models import Timesheet

            sheet = Timesheet.objects.get(pk=sheet_id)
            assert sheet.status == "collecting"
            assert sheet.current_reviewer is None  # 0002 nullable add
            assert sheet.route_snapshot == {}  # 0003 JSONField default=dict
        finally:
            # Always restore head even if assertions fail mid-test.
            call_command("migrate", "timesheets", verbosity=0, interactive=False)

    def test_fresh_migrate_zero_to_head(self):
        """Clean-slate upgrade path: all migrations apply on an empty schema."""
        call_command("migrate", "timesheets", "zero", verbosity=0, interactive=False)
        try:
            call_command("migrate", "timesheets", verbosity=0, interactive=False)
            from django.db import connection

            assert "timesheets_timesheet" in connection.introspection.table_names()
        finally:
            call_command("migrate", "timesheets", verbosity=0, interactive=False)
