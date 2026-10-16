from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(request):
    """Liveness probe: confirms the WSGI process is responsive without
    querying external dependencies or exposing configuration."""
    return JsonResponse({"status": "ok"})


def readiness(request):
    """Readiness probe: confirms PostgreSQL connectivity via a bounded
    SELECT 1 check. Returns 503 without leaking connection details if
    the database is unreachable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ready"})


urlpatterns = [
    path("health/", health),
    path("readyz/", readiness),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/schema/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="api-docs",
    ),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.organizations.urls")),
    path("api/v1/", include("apps.audit.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.employee_requests.urls")),
    path("api/v1/", include("apps.timesheets.urls")),
    path("api/v1/", include("apps.reporting.urls")),
]
