"""Transactional timesheet services (D-005). Views adapt HTTP; all state
transitions, invariants, and event/notification writes live here so races and
partial writes cannot occur. Lock order: employee profile -> sheet -> days."""

from datetime import date as date_type
from zoneinfo import ZoneInfo

from config.exceptions import ConflictError
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import EmployeeProfile
from apps.accounts.permissions import ROLE_HR, is_hr
from apps.audit.services import record_audit
from apps.notifications.services import notify
from apps.timesheets.models import (
    TimeEntry,
    Timesheet,
    TimesheetEvent,
    WorkDay,
)
from apps.timesheets.timecalc import (
    elapsed_minutes,
    local_date,
    period_bounds,
    split_at_midnight,
    window_flags,
)

EDITABLE_SHEETS = {Timesheet.Status.COLLECTING, Timesheet.Status.RETURNED}
EDITABLE_DAYS = {WorkDay.Status.DRAFT, WorkDay.Status.RETURNED}


def _profile(user) -> EmployeeProfile:
    try:
        return user.profile
    except EmployeeProfile.DoesNotExist:
        raise ValidationError({"detail": ["No employee profile."]}) from None


def _eligible_hr(user, exclude=()):
    """Active HR users in `user`'s org who are neither `user` nor in
    `exclude` — prefers the org's configured fallback reviewer (D-004)."""
    hr_ids = set(
        Group.objects.get(name=ROLE_HR)
        .user_set.filter(is_active=True, organization_id=user.organization_id)
        .exclude(pk=user.pk)
        .exclude(pk__in=[u.pk for u in exclude])
        .values_list("pk", flat=True)
    )
    org = user.organization
    if org.fallback_reviewer_id in hr_ids:
        return org.fallback_reviewer
    if hr_ids:
        from apps.accounts.models import User

        return User.objects.filter(pk__in=hr_ids).order_by("email").first()
    return None


def _check_version(obj, expected_version, what):
    if expected_version is not None and obj.version != expected_version:
        raise ConflictError(f"This {what} changed since you loaded it. Refresh and retry.")


def _event(sheet, user, event_type, *, prev, new, reason="", snapshot=None):
    TimesheetEvent.objects.create(
        sheet=sheet,
        actor=user,
        event_type=event_type,
        previous_state=prev,
        new_state=new,
        cycle=sheet.cycle,
        version=sheet.version,
        reason=reason,
        snapshot=snapshot or {},
    )


def _sheet_snapshot(sheet):
    totals = {
        str(d["work_date"]): d["total"]
        for d in sheet.days.all()
        .filter(entries__voided_at__isnull=True)
        .values("work_date")
        .annotate(total=Sum("entries__duration_minutes"))
    }
    return {
        "period_start": str(sheet.period_start),
        "period_end": str(sheet.period_end),
        "timezone": sheet.timezone,
        "day_totals": totals,
        "total_minutes": sum(totals.values()),
        "route": sheet.route_snapshot,
    }


def get_or_create_sheet(user, anchor: date_type) -> Timesheet:
    """Fetch-or-create the caller's weekly sheet containing `anchor`.
    Bounds + timezone are snapshotted from org settings at creation."""
    profile = _profile(user)
    org = user.organization
    pstart, pend = period_bounds(anchor, org.week_start)
    sheet, _ = Timesheet.objects.get_or_create(
        employee=profile,
        period_start=pstart,
        defaults={
            "organization": org,
            "period_end": pend,
            "timezone": org.timezone,
        },
    )
    if sheet.organization_id != org.id or sheet.employee_id != profile.id:
        raise ConflictError("Sheet belongs to a different context.")
    return sheet


def _locked_sheet(sheet_id):
    return (
        Timesheet.objects.select_for_update(of=("self",))
        .select_related(
            "employee",
            "employee__user",
            "employee__manager",
            "employee__manager__user",
            "organization",
            "current_reviewer",
        )
        .get(pk=sheet_id)
    )


def _overlaps(employee, start_at, end_at, exclude_id=None):
    qs = TimeEntry.objects.filter(
        employee=employee,
        voided_at__isnull=True,
        start_at__lt=end_at,
        end_at__gt=start_at,
    )
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs.exists()


def _day_of(sheet, profile, work_date: date_type, *, create=True) -> WorkDay:
    if not (sheet.period_start <= work_date <= sheet.period_end):
        raise ValidationError({"work_date": ["Date is outside this sheet's week."]})
    day = WorkDay.objects.filter(timesheet=sheet, work_date=work_date).first()
    if day is None:
        if not create:
            raise ValidationError({"work_date": ["No entries for this date."]})
        day = WorkDay.objects.create(
            organization=sheet.organization,
            employee=profile,
            timesheet=sheet,
            work_date=work_date,
        )
    if day.status not in EDITABLE_DAYS:
        raise ConflictError("This day is locked — submitted for review.")
    return day


def _window_check(org, tz, day, seg_start, seg_end, seg_minutes, reason, exclude_id=None):
    """Flag out-of-window segments (D-005): flag needs a reason.
    `exclude_id` removes the entry being edited from the daily total."""
    qs = TimeEntry.objects.filter(workday=day, voided_at__isnull=True)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    existing = qs.aggregate(t=Sum("duration_minutes"))["t"] or 0
    flags = window_flags(
        org.work_earliest_start,
        org.work_latest_end,
        org.work_max_daily_minutes,
        day_start=seg_start.astimezone(tz).time(),
        day_end=seg_end.astimezone(tz).time(),
        daily_total=existing + seg_minutes,
    )
    if flags and not (reason or "").strip():
        raise ValidationError(
            {"window_reason": ["This entry is outside the working window — a reason is required."]}
        )
    return bool(flags)


def create_entries(sheet_id, user, data) -> list[TimeEntry]:
    """Create one entry row per local-day segment (overnight split, D-005).
    `data`: work_date, start_at, end_at, break_minutes OR segment_breaks,
    description, window_reason, expected_version."""
    profile = _profile(user)
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
        sheet = _locked_sheet(sheet_id)
        if sheet.employee_id != profile.id:
            raise PermissionDenied("Not your sheet.")
        if sheet.status not in EDITABLE_SHEETS:
            raise ConflictError("This sheet is locked.")
        _check_version(sheet, data.get("expected_version"), "sheet")

        tz = ZoneInfo(sheet.timezone)
        start_at, end_at = data["start_at"], data["end_at"]
        try:
            segments = split_at_midnight(start_at, end_at, tz)
        except DjangoValidationError as exc:
            raise ValidationError({"end_at": exc.messages}) from exc
        n = len(segments)

        breaks = data.get("segment_breaks")
        total_break = data.get("break_minutes") or 0
        if n > 1:
            if breaks is None:
                if total_break:
                    raise ValidationError(
                        {
                            "segment_breaks": [
                                "This interval crosses midnight — give a break "
                                "value per day segment, or none."
                            ]
                        }
                    )
                breaks = [0] * n
            elif len(breaks) != n:
                raise ValidationError({"segment_breaks": [f"Expected {n} break values."]})
        else:
            breaks = [total_break]

        if local_date(start_at, tz) != data["work_date"]:
            raise ValidationError(
                {"work_date": ["work_date must be the local start date in the sheet timezone."]}
            )
        now = timezone.now()
        if end_at > now:
            raise ValidationError({"end_at": ["Cannot log future work."]})

        created = []
        for (d, seg_s, seg_e), seg_break in zip(segments, breaks, strict=False):
            try:
                minutes = elapsed_minutes(seg_s, seg_e, seg_break)
            except DjangoValidationError as exc:
                raise ValidationError({"break_minutes": exc.messages}) from exc
            day = _day_of(sheet, profile, d)
            if _overlaps(profile, seg_s, seg_e):
                raise ValidationError({"start_at": ["This interval overlaps existing work."]})
            flagged = _window_check(
                sheet.organization,
                tz,
                day,
                seg_s,
                seg_e,
                minutes,
                data.get("window_reason", ""),
            )
            created.append(
                TimeEntry.objects.create(
                    organization=sheet.organization,
                    employee=profile,
                    workday=day,
                    work_date=d,
                    start_at=seg_s,
                    end_at=seg_e,
                    break_minutes=seg_break,
                    duration_minutes=minutes,
                    description=data.get("description", ""),
                    window_flag=flagged,
                    window_reason=(data.get("window_reason") or "") if flagged else "",
                )
            )
        sheet.version += 1
        sheet.save(update_fields=["version", "updated_at"])
    return created


def update_entry(entry_id, user, data) -> TimeEntry:
    profile = _profile(user)
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
        entry = (
            TimeEntry.objects.select_for_update(of=("self",))
            .select_related("workday", "workday__timesheet")
            .get(pk=entry_id)
        )
        sheet = entry.workday.timesheet
        if entry.employee_id != profile.id:
            raise PermissionDenied("Not your entry.")
        if sheet.status not in EDITABLE_SHEETS or entry.workday.status not in EDITABLE_DAYS:
            raise ConflictError("This entry is locked.")
        _check_version(sheet, data.get("expected_version"), "sheet")
        if entry.voided_at is not None:
            raise ConflictError("This entry was voided.")

        tz = ZoneInfo(sheet.timezone)
        start_at = data.get("start_at", entry.start_at)
        end_at = data.get("end_at", entry.end_at)
        if end_at > timezone.now():
            raise ValidationError({"end_at": ["Cannot log future work."]})
        # Edits must stay inside the same local day — reparenting across
        # midnight is a void + recreate.
        if local_date(start_at, tz) != entry.work_date or local_date(end_at, tz) != entry.work_date:
            if local_date(start_at, tz) == local_date(end_at, tz):
                raise ValidationError(
                    {
                        "start_at": [
                            "Entry must stay within its day — void and recreate to move days."
                        ]
                    }
                )
            raise ValidationError(
                {"start_at": ["Entry cannot span midnight on edit — void and recreate."]}
            )
        try:
            minutes = elapsed_minutes(
                start_at, end_at, data.get("break_minutes", entry.break_minutes)
            )
        except DjangoValidationError as exc:
            raise ValidationError({"break_minutes": exc.messages}) from exc
        if _overlaps(profile, start_at, end_at, exclude_id=entry.pk):
            raise ValidationError({"start_at": ["This interval overlaps existing work."]})
        flagged = _window_check(
            sheet.organization,
            tz,
            entry.workday,
            start_at,
            end_at,
            minutes,
            data.get("window_reason", entry.window_reason),
            exclude_id=entry.pk,
        )
        entry.start_at = start_at
        entry.end_at = end_at
        entry.break_minutes = data.get("break_minutes", entry.break_minutes)
        entry.duration_minutes = minutes
        if "description" in data:
            entry.description = data["description"]
        entry.window_flag = flagged
        entry.window_reason = (
            (data.get("window_reason", entry.window_reason) or "") if flagged else ""
        )
        entry.save()
        sheet.version += 1
        sheet.save(update_fields=["version", "updated_at"])
    return entry


def void_entry(entry_id, user, expected_version=None) -> None:
    profile = _profile(user)
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
        entry = (
            TimeEntry.objects.select_for_update(of=("self",))
            .select_related("workday", "workday__timesheet")
            .get(pk=entry_id)
        )
        sheet = entry.workday.timesheet
        if entry.employee_id != profile.id:
            raise PermissionDenied("Not your entry.")
        if sheet.status not in EDITABLE_SHEETS or entry.workday.status not in EDITABLE_DAYS:
            raise ConflictError("This entry is locked.")
        _check_version(sheet, expected_version, "sheet")
        entry.voided_at = timezone.now()
        entry.save(update_fields=["voided_at", "updated_at"])
        sheet.version += 1
        sheet.save(update_fields=["version", "updated_at"])


def submit_day(sheet_id, work_date, user) -> WorkDay:
    """Daily submission (D-005): locks the day's entries. Requires at least
    one active entry."""
    profile = _profile(user)
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
        sheet = _locked_sheet(sheet_id)
        if sheet.employee_id != profile.id:
            raise PermissionDenied("Not your sheet.")
        if sheet.status not in EDITABLE_SHEETS:
            raise ConflictError("This sheet is locked.")
        day = _day_of(sheet, profile, work_date, create=False)
        if day.status not in (WorkDay.Status.DRAFT, WorkDay.Status.RETURNED):
            raise ConflictError("This day was already submitted.")
        if not day.entries.filter(voided_at__isnull=True).exists():
            raise ValidationError({"detail": ["Cannot submit a day with no entries."]})
        day.status = WorkDay.Status.SUBMITTED
        day.submitted_at = timezone.now()
        day.version += 1
        day.save()
    return day


def _resolve_sheet_route(sheet):
    """D-004 + D-005 route: manager first; missing/ineligible/self manager →
    eligible non-self HR fallback, whose decision then completes the review
    (no forced second HR stage). Always-two-stage requires a resolved HR for
    stage 2 when a manager took stage 1."""
    owner = sheet.employee.user
    manager_user = None
    mgr_profile = sheet.employee.manager
    if mgr_profile and mgr_profile.user_id != owner.pk and mgr_profile.user.is_active:
        manager_user = mgr_profile.user
    hr = _eligible_hr(owner)
    if manager_user is None and hr is None:
        return None
    if manager_user is not None and hr is None:
        return None  # two-stage always needs a second reviewer
    return {
        "manager_id": str(manager_user.pk) if manager_user else None,
        "hr_id": str(hr.pk) if hr else None,
    }


def submit_sheet(sheet_id, user, expected_version=None) -> Timesheet:
    """Weekly submission (D-005): >=1 submitted day, no draft days holding
    entries, eligible reviewer resolved, snapshot + event + notification in
    one transaction."""
    profile = _profile(user)
    with transaction.atomic():
        EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
        sheet = _locked_sheet(sheet_id)
        if sheet.employee_id != profile.id:
            raise PermissionDenied("Not your sheet.")
        if sheet.status not in EDITABLE_SHEETS:
            raise ConflictError("This sheet is not in a submittable state.")
        _check_version(sheet, expected_version, "sheet")

        days = list(sheet.days.all())
        submitted = [
            d for d in days if d.status in (WorkDay.Status.SUBMITTED, WorkDay.Status.RETURNED)
        ]
        if not submitted:
            raise ValidationError(
                {"detail": ["Submit at least one day before submitting the week."]}
            )
        draft_with_entries = [
            str(d.work_date)
            for d in days
            if d.status == WorkDay.Status.DRAFT
            and d.entries.filter(voided_at__isnull=True).exists()
        ]
        if draft_with_entries:
            raise ValidationError(
                {
                    "detail": [
                        "These days still have unsubmitted entries — submit or "
                        f"void them first: {', '.join(draft_with_entries)}"
                    ]
                }
            )
        route = _resolve_sheet_route(sheet)
        if route is None:
            raise ValidationError(
                {
                    "detail": [
                        "No eligible reviewers are available; ask HR to assign a "
                        "manager and an HR fallback."
                    ]
                }
            )

        prev = sheet.status
        sheet.cycle += 1
        sheet.version += 1
        sheet.route_snapshot = route
        sheet.submitted_at = timezone.now()

        if route["manager_id"]:
            sheet.status = Timesheet.Status.PENDING_MANAGER
            sheet.current_reviewer_id = route["manager_id"]
        else:
            # HR fallback completes the whole review (D-004).
            sheet.status = Timesheet.Status.PENDING_HR
            sheet.current_reviewer_id = route["hr_id"]
        sheet.save()
        for day in days:
            if day.status == WorkDay.Status.RETURNED:
                day.status = WorkDay.Status.SUBMITTED
                day.submitted_at = timezone.now()
                day.version += 1
                day.save()
        _event(
            sheet,
            user,
            "submitted",
            prev=str(prev),
            new=sheet.status,
            snapshot=_sheet_snapshot(sheet),
        )
        notify(
            sheet.organization,
            sheet.current_reviewer,
            event_key=f"timesheet:{sheet.pk}:cycle{sheet.cycle}:pending",
            kind="timesheet_review",
            summary=f"Timesheet {sheet.period_start}–{sheet.period_end} awaits your review.",
            target=sheet,
        )
    return sheet


def review_sheet(sheet_id, user, action, *, reason="", expected_version=None) -> Timesheet:
    """Two-stage review (D-005): manager → HR. Approve at pending_manager
    advances to PENDING_HR; approve at pending_hr finalizes. Return/reject
    need a reason; return unlocks the whole week's days."""
    with transaction.atomic():
        sheet = _locked_sheet(sheet_id)
        if sheet.status not in (
            Timesheet.Status.PENDING_MANAGER,
            Timesheet.Status.PENDING_HR,
        ):
            raise ConflictError("This sheet is not pending review.")
        if sheet.current_reviewer_id != user.pk:
            raise PermissionDenied("You are not the current reviewer.")
        _check_version(sheet, expected_version, "sheet")
        if action in ("return", "reject") and not (reason or "").strip():
            raise ValidationError({"reason": ["A reason is required."]})

        prev = sheet.status
        sheet.version += 1
        if action == "approve":
            if sheet.status == Timesheet.Status.PENDING_MANAGER:
                # Stage-2 reviewer: an active HR who is not the approver
                # (D-004: a fallback HR decision at stage 1 is final — there
                # is no second HR stage to hand to yourself).
                hr_id = sheet.route_snapshot.get("hr_id")
                next_reviewer = None
                if hr_id:
                    from apps.accounts.models import User

                    cand = User.objects.filter(pk=hr_id, is_active=True).first()
                    if cand and cand.pk != user.pk and is_hr(cand):
                        next_reviewer = cand
                if next_reviewer is None:
                    # snapshot HR gone/self — any other eligible non-self,
                    # non-approver HR (D-004: no stage handed to the approver)
                    next_reviewer = _eligible_hr(sheet.employee.user, exclude=[user])
                if next_reviewer is not None:
                    sheet.status = Timesheet.Status.PENDING_HR
                    sheet.current_reviewer = next_reviewer
                    sheet.save()
                    _event(
                        sheet,
                        user,
                        "approved_manager",
                        prev=str(prev),
                        new=sheet.status,
                        snapshot=_sheet_snapshot(sheet),
                    )
                    notify(
                        sheet.organization,
                        next_reviewer,
                        event_key=f"timesheet:{sheet.pk}:cycle{sheet.cycle}:hr",
                        kind="timesheet_review",
                        summary="A timesheet passed manager review and needs HR approval.",
                        target=sheet,
                    )
                else:
                    sheet.status = Timesheet.Status.APPROVED
                    sheet.current_reviewer = None
                    sheet.save()
                    sheet.days.filter(status=WorkDay.Status.SUBMITTED).update(
                        status=WorkDay.Status.APPROVED
                    )
                    _event(
                        sheet,
                        user,
                        "approved",
                        prev=str(prev),
                        new=sheet.status,
                        snapshot=_sheet_snapshot(sheet),
                    )
                    notify(
                        sheet.organization,
                        sheet.employee.user,
                        event_key=f"timesheet:{sheet.pk}:cycle{sheet.cycle}:approved",
                        kind="timesheet_decision",
                        summary=f"Your timesheet for {sheet.period_start} was approved.",
                        target=sheet,
                    )
            else:
                sheet.status = Timesheet.Status.APPROVED
                sheet.current_reviewer = None
                sheet.save()
                sheet.days.filter(status=WorkDay.Status.SUBMITTED).update(
                    status=WorkDay.Status.APPROVED
                )
                _event(
                    sheet,
                    user,
                    "approved",
                    prev=str(prev),
                    new=sheet.status,
                    snapshot=_sheet_snapshot(sheet),
                )
                notify(
                    sheet.organization,
                    sheet.employee.user,
                    event_key=f"timesheet:{sheet.pk}:cycle{sheet.cycle}:approved",
                    kind="timesheet_decision",
                    summary=f"Your timesheet for {sheet.period_start} was approved.",
                    target=sheet,
                )
        elif action == "return":
            sheet.status = Timesheet.Status.RETURNED
            sheet.current_reviewer = None
            sheet.save()
            sheet.days.filter(status=WorkDay.Status.SUBMITTED).update(
                status=WorkDay.Status.RETURNED
            )
            _event(
                sheet,
                user,
                "returned",
                prev=str(prev),
                new=sheet.status,
                reason=reason,
                snapshot=_sheet_snapshot(sheet),
            )
            notify(
                sheet.organization,
                sheet.employee.user,
                event_key=f"timesheet:{sheet.pk}:cycle{sheet.cycle}:returned",
                kind="timesheet_decision",
                summary="Your timesheet was returned for correction.",
                target=sheet,
            )
        elif action == "reject":
            sheet.status = Timesheet.Status.REJECTED
            sheet.current_reviewer = None
            sheet.save()
            _event(
                sheet,
                user,
                "rejected",
                prev=str(prev),
                new=sheet.status,
                reason=reason,
                snapshot=_sheet_snapshot(sheet),
            )
            notify(
                sheet.organization,
                sheet.employee.user,
                event_key=f"timesheet:{sheet.pk}:cycle{sheet.cycle}:rejected",
                kind="timesheet_decision",
                summary=f"Your timesheet for {sheet.period_start} was rejected.",
                target=sheet,
            )
        else:
            raise ValidationError({"action": ["Unknown action."]})
    return sheet


def reopen_sheet(sheet_id, user, *, reason="", expected_version=None) -> Timesheet:
    """HR-only reopening (D-005): APPROVED/REJECTED → RETURNED with a recorded
    reason; approved days become editable again; history is preserved."""
    if not is_hr(user):
        raise PermissionDenied("Only HR can reopen a decided sheet.")
    with transaction.atomic():
        sheet = _locked_sheet(sheet_id)
        if sheet.status not in (
            Timesheet.Status.APPROVED,
            Timesheet.Status.REJECTED,
        ):
            raise ConflictError("Only a decided sheet can be reopened.")
        if not (reason or "").strip():
            raise ValidationError({"reason": ["A reason is required."]})
        _check_version(sheet, expected_version, "sheet")
        prev = sheet.status
        sheet.status = Timesheet.Status.RETURNED
        sheet.current_reviewer = None
        sheet.version += 1
        sheet.save()
        sheet.days.filter(status__in=(WorkDay.Status.SUBMITTED, WorkDay.Status.APPROVED)).update(
            status=WorkDay.Status.RETURNED
        )
        _event(
            sheet,
            user,
            "reopened",
            prev=str(prev),
            new=sheet.status,
            reason=reason,
            snapshot=_sheet_snapshot(sheet),
        )
        notify(
            sheet.organization,
            sheet.employee.user,
            event_key=f"timesheet:{sheet.pk}:cycle{sheet.cycle}:reopened:{sheet.version}",
            kind="timesheet_decision",
            summary="Your timesheet was reopened for correction by HR.",
            target=sheet,
        )
    return sheet


def reassign_pending_sheets(profile, new_manager):
    """D-004 for timesheets: called inside the reporting-line update
    transaction. Pending MANAGER-stage sheets owned by `profile` move to the
    new manager (or an eligible non-self HR fallback). Blocks the change if
    no eligible reviewer can take over."""
    pending = list(
        Timesheet.objects.select_for_update(of=("self",))
        .filter(
            employee=profile,
            status=Timesheet.Status.PENDING_MANAGER,
        )
        .select_related("employee", "employee__user")
    )
    if not pending:
        return
    new_user = new_manager.user if new_manager else None
    for sheet in pending:
        owner = sheet.employee.user
        candidate = None
        if new_user and new_user.is_active and new_user.pk != owner.pk:
            candidate = new_user
        if candidate is None:
            candidate = _eligible_hr(owner)
        if candidate is None:
            raise ConflictError(
                f"Cannot reassign manager: sheet {sheet.pk} has no eligible reviewer to take over."
            )
        old = sheet.current_reviewer
        sheet.current_reviewer = candidate
        sheet.route_snapshot = {**sheet.route_snapshot, "manager_id": str(candidate.pk)}
        sheet.version += 1
        sheet.save()
        TimesheetEvent.objects.create(
            sheet=sheet,
            actor=None,
            event_type="reviewer_reassigned",
            previous_state=sheet.status,
            new_state=sheet.status,
            cycle=sheet.cycle,
            version=sheet.version,
            snapshot={
                "old_reviewer_id": str(old.pk) if old else None,
                "new_reviewer_id": str(candidate.pk),
            },
        )
        if old and old != candidate:
            notify(
                sheet.organization,
                candidate,
                event_key=f"timesheet:{sheet.pk}:reassign:{sheet.version}",
                kind="timesheet_review",
                summary="A pending timesheet was reassigned to you.",
                target=sheet,
            )
        record_audit(
            sheet.organization,
            None,
            "timesheet.reassign_reviewer",
            sheet,
            metadata={
                "old_reviewer": str(old.pk) if old else None,
                "new_reviewer": str(candidate.pk),
            },
        )
