from django.http import Http404

from apps.accounts.models import EmployeeProfile
from apps.accounts.permissions import is_hr, is_manager


def visible_profiles(user):
    """Directory scoping (D-003, no general directory):
    HR -> whole organization; manager -> current direct reports;
    employee -> own profile only. Scoped before any count/page/export."""
    qs = EmployeeProfile.objects.select_related("user", "department", "manager", "manager__user")
    if is_hr(user):
        return qs.filter(organization_id=user.organization_id)
    if is_manager(user):
        return qs.filter(manager__user=user, organization_id=user.organization_id)
    return qs.filter(user=user, organization_id=user.organization_id)


def get_visible_profile(user, profile_id) -> EmployeeProfile:
    """Non-enumerating fetch: out-of-scope ids are 404, not 403."""
    try:
        if is_manager(user) and (profile := getattr(user, "profile", None)):
            if (
                str(profile.pk) == str(profile_id)
                and profile.organization_id == user.organization_id
            ):
                return profile
        return visible_profiles(user).get(pk=profile_id)
    except EmployeeProfile.DoesNotExist:
        raise Http404 from None
