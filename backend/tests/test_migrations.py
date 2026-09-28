import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_no_migration_drift():
    """Models and migrations must stay in sync (schema drift check)."""
    call_command("makemigrations", check=True, dry_run=True, verbosity=0)
