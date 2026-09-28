from rest_framework.permissions import BasePermission

ROLE_EMPLOYEE = "Employee"
ROLE_MANAGER = "Manager"
ROLE_HR = "HR"


def user_roles(user) -> set[str]:
    if not getattr(user, "is_authenticated", False):
        return set()
    return set(user.groups.values_list("name", flat=True))


def is_hr(user) -> bool:
    return ROLE_HR in user_roles(user)


def is_manager(user) -> bool:
    return ROLE_MANAGER in user_roles(user)


class IsActiveAuthenticated(BasePermission):
    """Every authenticated, active user has Employee capability (D-003)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)


class IsHR(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and is_hr(user))


class IsManagerOrHR(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and (is_manager(user) or is_hr(user))
        )
