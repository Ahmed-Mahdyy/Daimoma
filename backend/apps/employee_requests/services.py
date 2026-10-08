"""Transactional request workflow services. Views adapt HTTP; all state
transitions, invariants, and event/notification writes live here so races and
partial writes cannot occur. Lock order: employee profile -> request -> grant -> steps.
"""

from config.exceptions import ConflictError
from django.contrib.auth.models import Group
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import EmployeeProfile
from apps.accounts.permissions import ROLE_HR
from apps.employee_requests.allocations import reserve, settle
from apps.employee_requests.models import (
    EmployeeRequest,
    RequestApprovalStep,
    RequestEvent,
    RequestType,
)
from apps.employee_requests.serializers import validate_fields_for_type
from apps.notifications.services import notify


def _type_for(user, type_id):
    """Resolve a request type the caller may use — own org + active."""
    try:
        return RequestType.objects.get(
            pk=type_id, organization_id=user.organization_id, is_active=True
        )
    except (RequestType.DoesNotExist, ValueError):
        raise ValidationError({"type": ["Unknown or inactive request type."]}) from None


def create_draft(user, data):
    """Create a draft request owned by the caller. Ownership/organization/
    status are server-assigned; typed fields validated against the type's
    allocation unit."""
    req_type = _type_for(user, data["type"])
    errors: dict = {}
    validate_fields_for_type(req_type.unit, data, errors)
    if errors:
        raise ValidationError(errors)
    try:
        profile = user.profile
    except Exception:
        raise ValidationError({"detail": ["Your account has no employee profile."]}) from None
    return EmployeeRequest.objects.create(
        organization_id=user.organization_id,
        employee=profile,
        type=req_type,
        title=data["title"],
        description=data.get("description", ""),
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        start_time=data.get("start_time"),
        end_time=data.get("end_time"),
        equipment_item=data.get("equipment_item", ""),
        quantity=data.get("quantity"),
        hours=data.get("hours"),
    )


def update_draft(request_obj, user, data):
    """Edit a draft/returned request. Only the owner may edit; the caller's
    expected `version` must match (409 on staleness). Unit fields are
    re-validated if the type changes."""
    if not request_obj.editable:
        raise ValidationError({"detail": ["Only draft or returned requests can be edited."]})
    expected = data.get("version")
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=request_obj.employee_id)
        req = EmployeeRequest.objects.select_for_update().get(pk=request_obj.pk)
        if expected is not None and req.version != expected:
            raise ConflictError("This request changed since you loaded it. Refresh and retry.")
        new_type = req.type
        if "type" in data and data["type"] != req.type_id:
            new_type = _type_for(user, data["type"])
        merged = {
            "title": data.get("title", req.title),
            "description": data.get("description", req.description),
            "start_date": data.get("start_date", req.start_date),
            "end_date": data.get("end_date", req.end_date),
            "start_time": data.get("start_time", req.start_time),
            "end_time": data.get("end_time", req.end_time),
            "equipment_item": data.get("equipment_item", req.equipment_item),
            "quantity": data.get("quantity", req.quantity),
            "hours": data.get("hours", req.hours),
        }
        # PATCH semantics: fields explicitly sent as null/empty stay cleared.
        errors: dict = {}
        validate_fields_for_type(new_type.unit, merged, errors)
        if errors:
            raise ValidationError(errors)
        for f, v in merged.items():
            setattr(req, f, v)
        req.type = new_type
        req.version += 1
        req.save()
        return req


def delete_draft(request_obj, user):
    """Delete a draft request. Owner-only — drafts never leave the owner's
    scope — and draft-status only; anything submitted has a review trail and
    must be decided, not deleted."""
    if request_obj.employee.user_id != user.pk:
        raise PermissionDenied("Only the owner can delete a request.")
    if request_obj.status != EmployeeRequest.Status.DRAFT:
        raise ValidationError({"detail": ["Only draft requests can be deleted."]})
    request_obj.delete()


@transaction.atomic
def bulk_delete_drafts(user, ids):
    """Bulk-delete the caller's own drafts. Ids that fall outside scope —
    another user's, non-draft, or another org's — are reported as skipped
    rather than erroring, keeping the response non-enumerating."""
    qs = EmployeeRequest.objects.filter(
        organization_id=user.organization_id,
        employee__user_id=user.pk,
        status=EmployeeRequest.Status.DRAFT,
        id__in=ids,
    )
    deleted_ids = {str(pk) for pk in qs.values_list("id", flat=True)}
    qs.delete()
    return {
        "deleted": len(deleted_ids),
        "skipped": [str(i) for i in ids if str(i) not in deleted_ids],
    }


def _eligible_hr(user):
    """Active HR users in the caller's org who are not the request owner —
    prefers the org's configured fallback reviewer (D-004)."""
    hr_ids = set(
        Group.objects.get(name=ROLE_HR)
        .user_set.filter(is_active=True, organization_id=user.organization_id)
        .exclude(pk=user.pk)
        .values_list("pk", flat=True)
    )
    org = user.organization
    if org.fallback_reviewer_id in hr_ids:
        return org.fallback_reviewer
    if hr_ids:
        from apps.accounts.models import User

        return User.objects.filter(pk__in=hr_ids).order_by("email").first()
    return None


def _resolve_route(req):
    """D-004 reviewer resolution, evaluated under the request lock:
    - requires_manager=True -> requester's active manager reviews first
      (never the requester); missing/ineligible/self manager -> eligible
      non-self HR completes the cycle in one step
    - requires_hr=True adds a second HR step after a manager review; an HR
      fallback completes even an HR-required request in one step
    - requires_manager=False + requires_hr=True -> straight to HR (no
      manager stage at all)
    - no eligible reviewer for the configured route -> block submission
      (no unowned queue)"""
    owner = req.employee.user
    manager_user = None
    mgr_profile = req.employee.manager
    if mgr_profile and mgr_profile.user_id != owner.pk:
        candidate = mgr_profile.user
        if candidate.is_active:
            manager_user = candidate
    hr_reviewer = _eligible_hr(owner)
    if manager_user is None and hr_reviewer is None:
        return None
    if req.type.requires_manager and manager_user is not None:
        steps = [(1, "manager", manager_user, "pending")]
        if req.type.requires_hr:
            if hr_reviewer is None:
                return None
            steps.append((2, "hr", hr_reviewer, "waiting"))
        return steps
    # HR-only type, or a manager-first type with no eligible manager: an
    # eligible non-self HR reviewer completes the cycle in one step (D-004).
    if hr_reviewer is None:
        return None
    return [(1, "hr", hr_reviewer, "pending")]


def submit_request(request_obj, user, expected_version=None):
    """Atomic submission: lock the request, recheck editability + version,
    resolve the route, create cycle/steps/event/notification in one
    transaction. Freeze route+content snapshots so later config or
    reporting-line changes cannot reinterpret this cycle."""
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=request_obj.employee_id)
        # of=("self",) locks only the request row — select_for_update cannot
        # traverse nullable FK joins in Postgres.
        req = (
            EmployeeRequest.objects.select_for_update(of=("self",))
            .select_related(
                "type", "organization", "employee", "employee__manager",
                "employee__manager__user",
            )
            .get(pk=request_obj.pk)
        )
        if not req.editable:
            raise ConflictError("This request is not in a submittable state.")
        if expected_version is not None and req.version != expected_version:
            raise ConflictError("This request changed since you loaded it. Refresh and retry.")
        route = _resolve_route(req)
        if route is None:
            raise ValidationError(
                {
                    "detail": [
                        "No eligible reviewer is available; ask HR to assign a "
                        "manager or fallback reviewer."
                    ]
                }
            )
        submitted_at = timezone.now()
        reserve(req, submitted_at)
        req.cycle += 1
        req.version += 1
        req.status = (
            EmployeeRequest.Status.PENDING_MANAGER
            if route[0][1] == "manager"
            else EmployeeRequest.Status.PENDING_HR
        )
        req.submitted_at = submitted_at
        created_steps = [
            RequestApprovalStep.objects.create(
                request=req,
                cycle=req.cycle,
                sequence=seq,
                required_role=role,
                reviewer=reviewer,
                status=status_,
            )
            for seq, role, reviewer, status_ in route
        ]
        req.route_snapshot = {
            "requires_manager": req.type.requires_manager,
            "requires_hr": req.type.requires_hr,
            "reviewer_id": str(route[0][2].pk),
            "steps": [
                {
                    "sequence": seq,
                    "required_role": role,
                    "reviewer_id": str(reviewer.pk),
                }
                for seq, role, reviewer, _ in route
            ],
        }
        req.save()
        RequestEvent.objects.create(
            request=req,
            actor=user,
            event_type="submitted",
            previous_status=EmployeeRequest.Status.DRAFT
            if req.cycle == 1
            else EmployeeRequest.Status.RETURNED,
            new_status=req.status,
            cycle=req.cycle,
            version=req.version,
            snapshot={
                "title": req.title,
                "description": req.description,
                "type_code": req.type.code,
                "route": req.route_snapshot,
            },
        )
        first = created_steps[0]
        notify(
            req.organization,
            first.reviewer,
            event_key=f"request:{req.pk}:cycle{req.cycle}:pending",
            kind="request_review",
            summary=f"{req.title} awaits your review.",
            target=req,
        )
        return req


def reassign_pending_manager_steps(profile, new_manager):
    """D-004: a reporting-line change atomically moves the employee's pending
    manager-steps to the new manager — or an eligible non-self HR fallback if
    the new manager is missing/inactive — and records an event per request.
    Completed steps are untouched (history). Caller must hold the transaction;
    raising here rolls back the administrative change, so no step is ever
    left owned by a revoked reviewer."""
    pending = list(
        RequestApprovalStep.objects.select_for_update()
        .filter(
            request__employee=profile,
            required_role=RequestApprovalStep.RequiredRole.MANAGER,
            status=RequestApprovalStep.StepStatus.PENDING,
        )
        .select_related("request")
    )
    if not pending:
        return
    owner = profile.user
    reviewer = None
    if new_manager is not None and new_manager.user_id != owner.pk and new_manager.user.is_active:
        reviewer = new_manager.user
    if reviewer is None:
        reviewer = _eligible_hr(owner)
    if reviewer is None:
        raise ValidationError(
            {"manager": ["No eligible reviewer can take over this employee's pending reviews."]}
        )
    changed_requests = set()
    for step in pending:
        step.reviewer = reviewer
        step.save(update_fields=["reviewer"])
        changed_requests.add(step.request_id)
    for request_id in changed_requests:
        req = next(s.request for s in pending if s.request_id == request_id)
        req.version += 1
        req.save(update_fields=["version", "updated_at"])
        RequestEvent.objects.create(
            request=req,
            actor=None,
            event_type="reviewer_reassigned",
            cycle=req.cycle,
            version=req.version,
            snapshot={"new_reviewer_id": str(reviewer.pk)},
        )
        notify(
            req.organization,
            reviewer,
            event_key=f"request:{req.pk}:cycle{req.cycle}:reassigned",
            kind="request_review",
            summary=f"{req.title} awaits your review.",
            target=req,
        )


DECISION_VERBS = {"approve", "reject", "return"}


def review_request(request_obj, user, action, *, reason="", expected_version=None):
    """One permitted decision on the current pending step (D-004). The locked
    request's current step must belong to the caller; version guards stale
    clients; reject/return require a reason. Events + notifications commit in
    the same transaction as the transition."""
    if action not in DECISION_VERBS:
        raise ValidationError({"action": ["Unsupported decision."]})
    if action in {"reject", "return"} and not reason.strip():
        raise ValidationError({"reason": ["A reason is required."]})
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=request_obj.employee_id)
        req = EmployeeRequest.objects.select_for_update(of=("self",)).get(pk=request_obj.pk)
        if expected_version is not None and req.version != expected_version:
            raise ConflictError("This request changed since you loaded it. Refresh and retry.")
        step = (
            RequestApprovalStep.objects.select_for_update()
            .filter(request=req, cycle=req.cycle, status="pending")
            .order_by("sequence")
            .first()
        )
        from rest_framework.exceptions import PermissionDenied

        if step is None:
            raise ConflictError("There is no pending review step.")
        if step.reviewer_id != user.pk:
            raise PermissionDenied

        previous = req.status
        step.status = {
            "approve": "approved",
            "reject": "rejected",
            "return": "returned",
        }[action]
        step.reason = reason
        step.decided_at = timezone.now()
        step.save()

        new_status = None
        next_step = None
        if action == "approve":
            next_step = (
                req.steps.filter(cycle=req.cycle, status="waiting").order_by("sequence").first()
            )
            if next_step is not None:
                next_step.status = "pending"
                next_step.save()
                new_status = EmployeeRequest.Status.PENDING_HR
            else:
                new_status = EmployeeRequest.Status.APPROVED
        elif action == "reject":
            new_status = EmployeeRequest.Status.REJECTED
        else:
            new_status = EmployeeRequest.Status.RETURNED
        if new_status == EmployeeRequest.Status.APPROVED:
            settle(req, "used")
        elif new_status in (EmployeeRequest.Status.RETURNED, EmployeeRequest.Status.REJECTED):
            settle(req, "released")
        req.status = new_status
        req.version += 1
        req.save()

        RequestEvent.objects.create(
            request=req,
            actor=user,
            event_type={
                "approve": "approved",
                "reject": "rejected",
                "return": "returned",
            }[action],
            previous_status=previous,
            new_status=new_status,
            cycle=req.cycle,
            version=req.version,
            reason=reason,
        )
        if next_step is not None:
            notify(
                req.organization,
                next_step.reviewer,
                event_key=f"request:{req.pk}:cycle{req.cycle}:seq{next_step.sequence}:pending",
                kind="request_review",
                summary=f"{req.title} awaits your review.",
                target=req,
            )
        else:
            past = {
                EmployeeRequest.Status.APPROVED: "was approved",
                EmployeeRequest.Status.REJECTED: "was rejected",
                EmployeeRequest.Status.RETURNED: "was returned for correction",
            }[new_status]
            notify(
                req.organization,
                req.employee.user,
                event_key=f"request:{req.pk}:cycle{req.cycle}:{new_status}",
                kind="request_decision",
                summary=f"{req.title} {past}.",
                target=req,
            )
        return req
