"""T015 — scoped employee directory: list shape/pagination, bounded filters,
allowlisted ordering with UUID tie-breaker, scoped related-field choices, and
query-count guards (FR-002, FR-009)."""

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.conftest import TEST_PASSWORD, make_profile, make_user
from apps.organizations.models import Department

EMPLOYEES = "/api/v1/employees/"
CHOICES_MANAGERS = "/api/v1/choices/managers/"
DEPARTMENTS = "/api/v1/departments/"


def hr_client(hr_user):
    c = APIClient()
    c.post("/api/v1/auth/login/", {"email": hr_user.email, "password": TEST_PASSWORD})
    return c


def authed_client(user):
    c = APIClient()
    c.post("/api/v1/auth/login/", {"email": user.email, "password": TEST_PASSWORD})
    return c


@pytest.mark.django_db
class TestListShapeAndPagination:
    def test_paged_shape(self, hr_user, employee):
        response = hr_client(hr_user).get(EMPLOYEES)
        body = response.json()
        assert response.status_code == 200
        assert {"count", "next", "previous", "results"} <= set(body)

    def test_default_page_size_25(self, org, hr_user):
        for i in range(30):
            make_profile(org, make_user(org, f"b{i}@x.test"), f"B{i}")
        body = hr_client(hr_user).get(EMPLOYEES).json()
        assert len(body["results"]) == 25
        assert body["count"] == 31  # 30 created + hr_user's own profile
        assert body["next"] is not None

    def test_page_size_param_and_cap_100(self, org, hr_user):
        for i in range(120):
            make_profile(org, make_user(org, f"c{i}@x.test"), f"C{i}")
        assert len(hr_client(hr_user).get(f"{EMPLOYEES}?page_size=50").json()["results"]) == 50
        assert len(hr_client(hr_user).get(f"{EMPLOYEES}?page_size=500").json()["results"]) == 100


@pytest.mark.django_db
class TestFiltersAndOrdering:
    def test_filter_is_active(self, hr_user, employee):
        employee.is_active = False
        employee.save(update_fields=["is_active"])
        active = hr_client(hr_user).get(f"{EMPLOYEES}?is_active=true").json()["results"]
        inactive = hr_client(hr_user).get(f"{EMPLOYEES}?is_active=false").json()["results"]
        assert all(r["is_active"] for r in active)
        assert any(r["id"] == str(employee.profile.id) for r in inactive)

    def test_filter_department(self, org, hr_user, employee):
        dept = Department.objects.create(organization=org, name="Eng")
        employee.profile.department = dept
        employee.profile.save(update_fields=["department"])
        body = hr_client(hr_user).get(f"{EMPLOYEES}?department={dept.id}").json()
        assert [r["id"] for r in body["results"]] == [str(employee.profile.id)]

    def test_filter_role(self, hr_user, employee):
        employee.groups.add(Group.objects.get(name="Manager"))
        body = hr_client(hr_user).get(f"{EMPLOYEES}?role=Manager").json()
        ids = {r["id"] for r in body["results"]}
        assert str(employee.profile.id) in ids
        assert str(hr_user.profile.id) not in ids

    def test_search_matches_name_code_email(self, hr_user, employee):
        for term in [employee.profile.employee_code, "employee", "acme.test"]:
            body = hr_client(hr_user).get(f"{EMPLOYEES}?search={term}").json()
            assert any(r["id"] == str(employee.profile.id) for r in body["results"]), term

    def test_allowlisted_ordering(self, hr_user, employee):
        c = hr_client(hr_user)
        for order in [
            "display_name", "-display_name", "employee_code", "email",
            "department", "-department", "is_active", "-is_active",
            "job_title",
        ]:
            assert c.get(f"{EMPLOYEES}?ordering={order}").status_code == 200

    def test_department_and_status_ordering_sort(self, org, hr_user, employee):
        dept_b = Department.objects.create(organization=org, name="Beta")
        dept_a = Department.objects.create(organization=org, name="Alpha")
        a = make_profile(org, make_user(org, "da@x.test"), "DA")
        a.department = dept_a
        a.save(update_fields=["department"])
        employee.profile.department = dept_b
        employee.profile.save(update_fields=["department"])
        c = hr_client(hr_user)
        body = c.get(f"{EMPLOYEES}?ordering=department").json()
        names = [r["department_name"] for r in body["results"]]
        assert names.index("Alpha") < names.index("Beta")
        body = c.get(f"{EMPLOYEES}?ordering=-is_active").json()
        actives = [r["is_active"] for r in body["results"]]
        assert actives == sorted(actives, reverse=True)

    def test_unknown_ordering_rejected(self, hr_user):
        response = hr_client(hr_user).get(f"{EMPLOYEES}?ordering=password")
        assert response.status_code == 400

    def test_stable_ordering_tiebreaker(self, org, hr_user):
        for i in range(30):
            p = make_profile(org, make_user(org, f"d{i}@x.test"), f"D{i}")
            p.display_name = "Same"
            p.save(update_fields=["display_name"])
        c = hr_client(hr_user)
        seen = []
        url = f"{EMPLOYEES}?ordering=display_name"
        while url:
            body = c.get(url).json()
            seen += [r["id"] for r in body["results"]]
            url = body["next"]
        assert len(seen) == len(set(seen))  # deterministic, no dupes across pages

    def test_scope_employee_sees_only_self(self, employee, manager):
        body = authed_client(employee).get(EMPLOYEES).json()
        assert [r["id"] for r in body["results"]] == [str(employee.profile.id)]

    def test_detail_limits_personal_fields_to_visible_profiles(
        self, org, hr_user, manager, employee, other_org
    ):
        mine = make_profile(org, make_user(org, "report@x.test"), "R1", manager=manager.profile)
        outsider = make_profile(org, make_user(org, "stranger@x.test"), "S1")
        foreign = make_profile(other_org, make_user(other_org, "foreign@x.test"), "F1")
        for profile in (mine, outsider, foreign, employee.profile):
            profile.address = "Private address"
            profile.highest_qualification = "Bachelor's"
            profile.save()
        manager_api = authed_client(manager)
        assert manager_api.get(f"{EMPLOYEES}{mine.pk}/").json()["address"] == "Private address"
        assert manager_api.get(f"{EMPLOYEES}{manager.profile.pk}/").status_code == 200
        for profile in (outsider, foreign, employee.profile):
            assert manager_api.get(f"{EMPLOYEES}{profile.pk}/").status_code == 404
        own = authed_client(employee).get(f"{EMPLOYEES}{employee.profile.pk}/").json()
        assert own["address"] == "Private address"
        assert authed_client(employee).get(f"{EMPLOYEES}{mine.pk}/").status_code == 404
        hr_detail = hr_client(hr_user).get(f"{EMPLOYEES}{mine.pk}/").json()
        assert hr_detail["highest_qualification"] == "Bachelor's"
        assert "address" not in hr_client(hr_user).get(EMPLOYEES).json()["results"][0]

    def test_detail_hides_work_information_from_non_hr(
        self, org, hr_user, manager, employee
    ):
        report = make_profile(
            org, make_user(org, "rep@x.test"), "RP", manager=manager.profile
        )
        report.employment_start_date = "2024-01-01"
        report.employment_type = "full_time"
        report.work_location = "HQ"
        report.contract_start_date = "2024-01-01"
        report.contract_end_date = "2026-01-01"
        report.save()
        work_keys = {
            "employment_start_date",
            "employment_type",
            "work_location",
            "contract_start_date",
            "contract_end_date",
        }
        # Keys are omitted entirely — masked values would still leak presence.
        manager_body = authed_client(manager).get(f"{EMPLOYEES}{report.pk}/").json()
        assert work_keys.isdisjoint(manager_body)
        assert manager_body["employee_code"] == "RP"
        own_body = authed_client(employee).get(f"{EMPLOYEES}{employee.profile.pk}/").json()
        assert work_keys.isdisjoint(own_body)
        hr_body = hr_client(hr_user).get(f"{EMPLOYEES}{report.pk}/").json()
        assert hr_body["work_location"] == "HQ"
        assert hr_body["contract_end_date"] == "2026-01-01"

    def test_scope_manager_sees_direct_reports(self, org, manager):
        mine = make_profile(org, make_user(org, "t1@x.test"), "T1", manager=manager.profile)
        make_profile(org, make_user(org, "t2@x.test"), "T2")  # not a direct report
        body = authed_client(manager).get(EMPLOYEES).json()
        ids = {r["id"] for r in body["results"]}
        assert ids == {str(mine.id)}


@pytest.mark.django_db
class TestRelatedChoices:
    def test_manager_choices_hr_only(self, hr_user, employee, manager):
        assert hr_client(hr_user).get(CHOICES_MANAGERS).status_code == 200
        for user in (employee, manager):
            assert authed_client(user).get(CHOICES_MANAGERS).status_code == 403

    def test_manager_choices_org_scoped_active_only(self, org, hr_user, employee, other_org):
        foreign = make_profile(other_org, make_user(other_org, "fm@x.test"), "FM")
        inactive = make_user(org, "gone@x.test", is_active=False)
        make_profile(org, inactive, "G1")
        body = hr_client(hr_user).get(CHOICES_MANAGERS).json()
        ids = {r["id"] for r in body["results"]}
        assert str(employee.profile.id) in ids
        assert str(foreign.id) not in ids
        assert str(inactive.profile.id) not in ids

    def test_manager_choices_shape(self, hr_user, employee):
        body = hr_client(hr_user).get(CHOICES_MANAGERS).json()
        assert {"id", "display_name", "employee_code"} <= set(body["results"][0])

    def test_departments_list_org_scoped(self, org, hr_user, other_org):
        Department.objects.create(organization=org, name="Mine")
        Department.objects.create(organization=other_org, name="Foreign")
        body = hr_client(hr_user).get(DEPARTMENTS).json()
        names = {r["name"] for r in body["results"]}
        assert "Mine" in names and "Foreign" not in names


@pytest.mark.django_db
class TestQueryCounts:
    def test_employee_list_bounded_queries(self, org, hr_user, django_assert_max_num_queries):
        for i in range(30):
            make_profile(org, make_user(org, f"q{i}@x.test"), f"Q{i}")
        c = hr_client(hr_user)  # login outside the measured block
        with django_assert_max_num_queries(10):
            c.get(EMPLOYEES)

    def test_manager_choices_bounded_queries(self, org, hr_user, django_assert_max_num_queries):
        for i in range(30):
            make_profile(org, make_user(org, f"m{i}@x.test"), f"M{i}")
        c = hr_client(hr_user)
        with django_assert_max_num_queries(10):
            c.get(CHOICES_MANAGERS)


def _png() -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (10, 120, 200)).save(buf, "PNG")
    return buf.getvalue()


@pytest.mark.django_db
class TestEmployeePhoto:
    """Scoped photo endpoint: serves bytes to viewers who can see the record,
    404 for out-of-scope ids and missing photos (non-enumerating)."""

    URL = "/api/v1/employees/{pk}/photo/"

    def _photo(self, profile):
        from django.core.files.base import ContentFile

        profile.photo.save("p.png", ContentFile(_png()), save=False)
        profile.photo_content_type = "image/png"
        profile.save(update_fields=["photo", "photo_content_type"])
        return profile

    def test_detail_serializes_scoped_photo_url(self, hr_user, employee):
        self._photo(employee.profile)
        body = hr_client(hr_user).get(f"{EMPLOYEES}{employee.profile.id}/").json()
        assert body["photo_url"].startswith(
            f"/api/v1/employees/{employee.profile.id}/photo/?v="
        )

    def test_detail_photo_url_blank_without_photo(self, hr_user, employee):
        body = hr_client(hr_user).get(f"{EMPLOYEES}{employee.profile.id}/").json()
        assert body["photo_url"] == ""

    def test_hr_streams_visible_photo(self, hr_user, employee):
        profile = self._photo(employee.profile)
        resp = hr_client(hr_user).get(self.URL.format(pk=profile.pk))
        assert resp.status_code == 200
        assert resp["Content-Type"] == "image/png"

    def test_employee_streams_own_photo(self, employee):
        profile = self._photo(employee.profile)
        resp = authed_client(employee).get(self.URL.format(pk=profile.pk))
        assert resp.status_code == 200

    def test_out_of_scope_returns_404(self, org, manager):
        stranger = self._photo(
            make_profile(org, make_user(org, "s@x.test"), "S1")
        )
        resp = authed_client(manager).get(self.URL.format(pk=stranger.pk))
        assert resp.status_code == 404

    def test_missing_photo_returns_404(self, hr_user, employee):
        resp = hr_client(hr_user).get(
            self.URL.format(pk=employee.profile.pk)
        )
        assert resp.status_code == 404

    def test_anonymous_rejected(self, employee):
        resp = APIClient().get(self.URL.format(pk=employee.profile.pk))
        assert resp.status_code in (401, 403)
