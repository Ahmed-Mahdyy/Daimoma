from datetime import timedelta
from zoneinfo import ZoneInfo

from config.exceptions import ConflictError
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import EmployeeProfile
from apps.accounts.permissions import is_hr
from apps.employee_requests.models import (
    AllocationAdjustment,
    AllocationGrantChange,
    EmployeeAllocationGrant,
    EmployeeRequest,
    RequestAllocationCommitment,
)


def working_days_in_range(org, start, end):
    """Working days in the inclusive [start, end] range, counted against the
    org's configured weekdays (0=Mon … 6=Sun). Every calendar day counts when
    the org has no weekday configuration. Returns None without a full range."""
    if not start or not end or end < start:
        return None
    span = (end - start).days + 1
    weekdays = set(org.working_weekdays or [])
    if not weekdays:
        return span
    return sum(
        1
        for i in range(span)
        if (start + timedelta(days=i)).weekday() in weekdays
    )


def charged_minutes(start_time, end_time):
    """Billable minutes between two same-day HH:MM times — rounds up to the
    next 15-minute block with a 30-minute minimum (D-011 billing rule).
    Returns None when the pair is missing, unordered, or carries seconds."""
    if (
        not start_time
        or not end_time
        or end_time <= start_time
        or start_time.second
        or end_time.second
    ):
        return None
    minutes = (end_time.hour * 60 + end_time.minute) - (
        start_time.hour * 60 + start_time.minute
    )
    return max(30, -(-minutes // 15) * 15)


def amount_for_request(req):
    """Charged amount in the type's unit: for dated "unit" requests the
    working-day count is derived from the date range server-side (the
    submitted quantity is never authoritative); undated unit requests charge
    the entered quantity; hour-unit types charge the billed minutes derived
    from the from/to times (the submitted hours are never authoritative —
    stored `hours` is only a fallback for rows saved before derivation)."""
    unit = req.type.unit
    if unit == "unit":
        derived = (
            working_days_in_range(req.organization, req.start_date, req.end_date)
            if req.organization_id and not req.type.requires_item
            else None
        )
        if derived is not None:
            if derived < 1:
                raise ValidationError(
                    {"end_date": ["The selected dates contain no working days."]}
                )
            return derived
        if not req.quantity or req.quantity < 1:
            raise ValidationError({"quantity": ["A quantity of at least 1 is required."]})
        return req.quantity
    if unit == "hour":
        minutes = charged_minutes(req.start_time, req.end_time)
        if minutes is not None:
            return minutes
        if req.hours is None or req.hours <= 0:
            raise ValidationError({"hours": ["A positive number of hours is required."]})
        return int(req.hours * 60)
    raise ValidationError({"type": ["This request type cannot use allocation."]})


def grant_totals(grant):
    cache = getattr(grant, "_prefetched_objects_cache", {})
    if "adjustments" in cache and "commitments" in cache:
        adjustment = sum(row.delta for row in cache["adjustments"])
        reserved = sum(row.amount for row in cache["commitments"] if row.disposition == "reserved")
        used = sum(row.amount for row in cache["commitments"] if row.disposition == "used")
    else:
        adjustment = grant.adjustments.aggregate(total=Sum("delta"))["total"] or 0
        amounts = dict(
            grant.commitments.values("disposition")
            .annotate(total=Sum("amount"))
            .values_list("disposition", "total")
        )
        reserved = amounts.get("reserved", 0)
        used = amounts.get("used", 0)
    granted = grant.initial_amount + adjustment
    return {
        "granted": granted,
        "reserved": reserved,
        "used": used,
        "remaining": granted - reserved - used,
    }


def allocation_period(req, submitted_at):
    """The grant must cover the request's stated period, or the org-local
    submission date when no dates were given."""
    local_date = timezone.localtime(submitted_at, ZoneInfo(req.organization.timezone)).date()
    start = req.start_date or local_date
    end = req.end_date or start
    return start, end, local_date


def preview(user, request_type, data):
    from apps.employee_requests.serializers import validate_fields_for_type

    errors = {}
    validate_fields_for_type(
        request_type.unit,
        data,
        errors,
        requires_item=request_type.requires_item,
        requires_dates=request_type.requires_dates,
    )
    if errors:
        raise ValidationError(errors)
    req = EmployeeRequest(
        organization=user.organization, employee=user.profile, type=request_type,
        start_date=data.get("start_date"), end_date=data.get("end_date"),
        start_time=data.get("start_time"), end_time=data.get("end_time"),
        quantity=data.get("quantity"), hours=data.get("hours"),
        equipment_item=data.get("equipment_item", ""),
    )
    if not request_type.requires_allocation:
        return {"required": False, "amount": 0, "status": "not_required"}
    amount = amount_for_request(req)
    start, end, local_date = allocation_period(req, timezone.now())
    candidates = list(
        EmployeeAllocationGrant.objects.filter(
            organization_id=user.organization_id, employee=user.profile,
            request_type=request_type, status="active",
            start_date__lte=start, end_date__gte=max(end, local_date),
        )[:2]
    )
    if len(candidates) != 1:
        return {
            "required": True, "amount": amount, "unit": request_type.unit,
            "status": "no_grant", "remaining": None, "grant": None,
        }
    grant = candidates[0]
    remaining = grant_totals(grant)["remaining"]
    return {
        "required": True, "amount": amount, "unit": grant.unit,
        "status": "available" if remaining >= amount else "insufficient",
        "remaining": remaining, "grant": str(grant.pk),
    }


def assert_covered(user, request_type, data):
    """Draft-time gate (2026-10-11): an allocation-required request cannot be
    created while no active grant covers its period or the remaining balance
    is too small. reserve() re-checks under row locks at submission — this
    gate only stops drafts that could never be submitted."""
    if not request_type.requires_allocation:
        return
    result = preview(user, request_type, data)
    if result["status"] == "no_grant":
        raise ValidationError(
            {
                "non_field_errors": [
                    "No allocation covers this request — ask HR to assign one first."
                ]
            }
        )
    if result["status"] == "insufficient":
        unit = result["unit"]
        if unit == "hour":
            need = f"{result['amount'] / 60:g} hours"
            left = f"{result['remaining'] / 60:g} hours"
        else:
            need = f"{result['amount']} units"
            left = f"{result['remaining']} units"
        raise ValidationError(
            {
                "non_field_errors": [
                    f"This request needs {need} but only {left} remain in your allocation."
                ]
            }
        )


def reserve(req, submitted_at):
    if not req.type.requires_allocation:
        return None
    amount = amount_for_request(req)
    start, end, local_date = allocation_period(req, submitted_at)
    grants = list(
        EmployeeAllocationGrant.objects.select_for_update()
        .filter(
            organization_id=req.organization_id,
            employee_id=req.employee_id,
            request_type_id=req.type_id,
            status=EmployeeAllocationGrant.Status.ACTIVE,
            start_date__lte=start,
            end_date__gte=max(end, local_date),
        )
        .order_by("pk")[:2]
    )
    if not grants:
        raise ValidationError({"detail": ["No allocation covers this request period."]})
    if len(grants) != 1:
        raise ValidationError({"detail": ["Overlapping allocations require HR correction."]})
    grant = grants[0]
    if grant.unit != req.type.unit:
        raise ValidationError({"detail": ["Allocation unit does not match this request type."]})
    if grant_totals(grant)["remaining"] < amount:
        raise ValidationError({"detail": ["Insufficient remaining allocation."]})
    return RequestAllocationCommitment.objects.create(
        request=req,
        grant=grant,
        cycle=req.cycle + 1,
        amount=amount,
        unit=grant.unit,
        snapshot={
            "unit": req.type.unit,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "start_time": req.start_time.isoformat() if req.start_time else None,
            "end_time": req.end_time.isoformat() if req.end_time else None,
            "quantity": req.quantity,
            "hours": str(req.hours) if req.hours is not None else None,
            "submission_date": local_date.isoformat(),
        },
    )


def settle(req, status):
    commitment = (
        RequestAllocationCommitment.objects.select_for_update()
        .filter(request=req, cycle=req.cycle)
        .first()
    )
    if commitment is None:
        return
    if commitment.disposition != RequestAllocationCommitment.Disposition.RESERVED:
        raise ConflictError("This allocation commitment has already been decided.")
    commitment.disposition = status
    commitment.decided_at = timezone.now()
    commitment.save(update_fields=["disposition", "decided_at"])


def _hr_scope(actor, employee):
    if not is_hr(actor):
        raise PermissionDenied
    if employee.organization_id != actor.organization_id:
        raise ValidationError({"employee": ["Employee not found in this organization."]})


def _locked_grant(actor, grant_id, version):
    try:
        identity = EmployeeAllocationGrant.objects.get(
            pk=grant_id, organization_id=actor.organization_id
        )
    except (EmployeeAllocationGrant.DoesNotExist, ValueError):
        from django.http import Http404
        raise Http404 from None
    EmployeeProfile.objects.select_for_update().get(pk=identity.employee_id)
    grant = EmployeeAllocationGrant.objects.select_for_update().get(pk=identity.pk)
    if grant.version != version:
        raise ConflictError("Allocation changed; refresh and retry.")
    if grant.status != EmployeeAllocationGrant.Status.ACTIVE:
        raise ConflictError("This allocation is no longer active.")
    return grant


@transaction.atomic
def create_grant(actor, employee, request_type, start_date, end_date, initial_amount):
    _hr_scope(actor, employee)
    if request_type.organization_id != actor.organization_id or not request_type.is_active:
        raise ValidationError(
            {"request_type": ["Request type is not available in this organization."]}
        )
    if not request_type.requires_allocation:
        raise ValidationError({"request_type": ["Type does not require an allocation."]})
    EmployeeProfile.objects.select_for_update().get(pk=employee.pk)
    if EmployeeAllocationGrant.objects.filter(
        employee=employee, request_type=request_type, status="active",
        start_date__lte=end_date, end_date__gte=start_date,
    ).exists():
        raise ValidationError({"start_date": ["An active allocation overlaps this period."]})
    grant = EmployeeAllocationGrant(
        organization=actor.organization, employee=employee, request_type=request_type,
        unit=request_type.unit, start_date=start_date, end_date=end_date,
        initial_amount=initial_amount, granted_by=actor,
    )
    try:
        grant.full_clean()
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict) from exc
    grant.save()
    return grant


@transaction.atomic
def adjust_grant(actor, grant_id, delta, reason, version):
    if not is_hr(actor):
        raise PermissionDenied
    grant = _locked_grant(actor, grant_id, version)
    if not reason.strip() or not delta:
        raise ValidationError({"reason": ["A reason and nonzero adjustment are required."]})
    totals = grant_totals(grant)
    if totals["granted"] + delta < totals["used"] + totals["reserved"]:
        raise ValidationError({"delta": ["Cannot reduce below reserved plus used."]})
    AllocationAdjustment.objects.create(grant=grant, delta=delta, actor=actor, reason=reason)
    grant.version += 1
    grant.save(update_fields=["version", "updated_at"])
    return grant


@transaction.atomic
def edit_grant_dates(actor, grant_id, start_date, end_date, reason, version):
    if not is_hr(actor):
        raise PermissionDenied
    grant = _locked_grant(actor, grant_id, version)
    if not reason.strip() or end_date < start_date:
        raise ValidationError({"end_date": ["Valid dates and a reason are required."]})
    if EmployeeAllocationGrant.objects.filter(
        employee=grant.employee, request_type=grant.request_type, status="active",
        start_date__lte=end_date, end_date__gte=start_date,
    ).exclude(pk=grant.pk).exists():
        raise ValidationError({"start_date": ["An active allocation overlaps this period."]})
    for commitment in grant.commitments.exclude(disposition="released"):
        snapshot = commitment.snapshot
        if (
            snapshot["start_date"] < start_date.isoformat()
            or snapshot["end_date"] > end_date.isoformat()
        ):
            raise ValidationError(
                {"end_date": ["Existing reserved or used requests must remain covered."]}
            )
    before = {"start_date": grant.start_date.isoformat(), "end_date": grant.end_date.isoformat()}
    grant.start_date, grant.end_date = start_date, end_date
    grant.version += 1
    grant.save(update_fields=["start_date", "end_date", "version", "updated_at"])
    AllocationGrantChange.objects.create(
        grant=grant, action="dates_changed", previous=before,
        current={"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        actor=actor, reason=reason,
    )
    return grant


@transaction.atomic
def void_grant(actor, grant_id, reason, version):
    if not is_hr(actor):
        raise PermissionDenied
    grant = _locked_grant(actor, grant_id, version)
    if not reason.strip():
        raise ValidationError({"reason": ["A reason is required."]})
    totals = grant_totals(grant)
    if totals["reserved"] or totals["used"]:
        raise ValidationError({"detail": ["Resolve reserved and used requests before removal."]})
    grant.status = EmployeeAllocationGrant.Status.VOID
    grant.voided_by = actor
    grant.void_reason = reason
    grant.voided_at = timezone.now()
    grant.version += 1
    grant.save(
        update_fields=["status", "voided_by", "void_reason", "voided_at", "version", "updated_at"]
    )
    AllocationGrantChange.objects.create(
        grant=grant, action="voided", previous={"status": "active"},
        current={"status": "void"}, actor=actor, reason=reason,
    )
    return grant
