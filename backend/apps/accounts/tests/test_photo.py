# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""Profile photo upload/serve tests: self-only access, type/size/content
validation, cache-busted URL, and safe removal."""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from .conftest import TEST_PASSWORD

PHOTO_URL = "/api/v1/me/photo/"


def png_bytes(size=(4, 4), color=(10, 120, 200)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    buf.seek(0)
    return buf.getvalue()


def png_file():
    return SimpleUploadedFile("p.png", png_bytes(), content_type="image/png")


@pytest.fixture
def logged_in(api_client, employee):
    api_client.post(
        "/api/v1/auth/login/",
        {"email": "employee@acme.test", "password": TEST_PASSWORD},
    )
    return api_client


@pytest.mark.django_db
class TestPhotoUpload:
    def test_upload_sets_photo_url(self, logged_in, employee):
        resp = logged_in.post(
            PHOTO_URL, {"photo": png_file()},
            format="multipart",
        )
        assert resp.status_code == 200, resp.json()
        url = resp.json()["photo_url"]
        assert url.startswith("/api/v1/me/photo/?v=")
        employee.profile.refresh_from_db()
        assert employee.profile.photo
        assert employee.profile.photo_content_type == "image/png"

    def test_get_streams_own_photo(self, logged_in, employee):
        logged_in.post(
            PHOTO_URL, {"photo": png_file()},
            format="multipart",
        )
        resp = logged_in.get(PHOTO_URL)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "image/png"

    def test_get_missing_photo_404(self, logged_in):
        assert logged_in.get(PHOTO_URL).status_code == 404

    def test_unauthenticated_get_rejected(self, api_client):
        assert api_client.get(PHOTO_URL).status_code in (401, 403)

    def test_rejects_non_image_content_type(self, logged_in):
        resp = logged_in.post(
            PHOTO_URL,
            {"photo": SimpleUploadedFile("x.txt", b"hello", content_type="text/plain")},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_rejects_spoofed_content(self, logged_in):
        resp = logged_in.post(
            PHOTO_URL,
            {"photo": SimpleUploadedFile("fake.png", b"not-an-image", content_type="image/png")},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_rejects_oversized_file(self, logged_in, monkeypatch):
        from apps.accounts import views
        monkeypatch.setattr(views, "PHOTO_MAX_BYTES", 10)
        resp = logged_in.post(
            PHOTO_URL, {"photo": png_file()},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_delete_removes_photo(self, logged_in, employee):
        logged_in.post(
            PHOTO_URL, {"photo": png_file()},
            format="multipart",
        )
        resp = logged_in.delete(PHOTO_URL)
        assert resp.status_code == 200
        assert resp.json()["photo_url"] == ""
        employee.profile.refresh_from_db()
        assert not employee.profile.photo

    def test_photo_field_not_writable_via_me_patch(self, logged_in):
        """Mass-assignment guard: photo is only set through the photo
        endpoint, never via the allowlisted PATCH."""
        resp = logged_in.patch("/api/v1/me/", {"photo_url": "x"})
        assert resp.status_code == 400
