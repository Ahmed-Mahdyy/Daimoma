from django.db import migrations, models

# Old category -> new unit, applied only to types that actually drew from an
# allocation. Non-allocated measurable types become "none" so their behaviour
# does not silently gain a balance requirement.
_TYPE_MAP = {
    "leave": "unit",
    "work_from_home": "unit",
    "equipment": "unit",
    "early_leave": "hour",
    "hr_service": "none",
    "general": "none",
}
_AMOUNT_UNIT_MAP = {"working_day": "unit", "item": "unit", "minute": "hour"}


def forwards(apps, schema_editor):
    RequestType = apps.get_model("employee_requests", "RequestType")
    Grant = apps.get_model("employee_requests", "EmployeeAllocationGrant")
    Commitment = apps.get_model("employee_requests", "RequestAllocationCommitment")
    for rt in RequestType.objects.all():
        rt.unit = _TYPE_MAP.get(rt.unit, "none") if rt.requires_allocation else "none"
        rt.save(update_fields=["unit"])
    for model in (Grant, Commitment):
        for old, new in _AMOUNT_UNIT_MAP.items():
            model.objects.filter(unit=old).update(unit=new)


def backwards(apps, schema_editor):
    RequestType = apps.get_model("employee_requests", "RequestType")
    Grant = apps.get_model("employee_requests", "EmployeeAllocationGrant")
    Commitment = apps.get_model("employee_requests", "RequestAllocationCommitment")
    for rt in RequestType.objects.all():
        rt.unit = "general"
        rt.save(update_fields=["unit"])
    for model in (Grant, Commitment):
        for old, new in _AMOUNT_UNIT_MAP.items():
            model.objects.filter(unit=new).update(unit=old)


class Migration(migrations.Migration):

    dependencies = [
        ("employee_requests", "0004_requesttype_requires_allocation_and_more"),
    ]

    operations = [
        # Rename keeps the column and all rows (no drop/recreate).
        migrations.RenameField(
            model_name="requesttype", old_name="category", new_name="unit"
        ),
        migrations.AlterField(
            model_name="requesttype",
            name="unit",
            field=models.CharField(max_length=20, default="none"),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="requesttype",
            name="unit",
            field=models.CharField(
                choices=[
                    ("none", "Not measurable"),
                    ("unit", "Units"),
                    ("hour", "Hours"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="employeeallocationgrant",
            name="unit",
            field=models.CharField(
                choices=[("unit", "Units"), ("hour", "Hours")], max_length=16
            ),
        ),
        migrations.AlterField(
            model_name="requestallocationcommitment",
            name="unit",
            field=models.CharField(
                choices=[("unit", "Units"), ("hour", "Hours")], max_length=16
            ),
        ),
        migrations.AddField(
            model_name="employeerequest",
            name="hours",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True
            ),
        ),
    ]
