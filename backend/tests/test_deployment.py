"""Deployment & operations readiness tests (007:T004)."""

import importlib
import sys
from unittest.mock import patch

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.db import OperationalError


@pytest.mark.django_db
def test_liveness_health_endpoint(client):
    res = client.get("/health/")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.django_db
def test_readiness_endpoint_ok_when_db_reachable(client):
    res = client.get("/readyz/")
    assert res.status_code == 200
    assert res.json() == {"status": "ready"}


@pytest.mark.django_db
def test_readiness_endpoint_returns_503_without_leaking_error_details(client):
    with patch(
        "config.urls.connection.cursor", side_effect=OperationalError("secret host details")
    ):
        res = client.get("/readyz/")
    assert res.status_code == 503
    body = res.json()
    assert body == {"status": "unavailable"}
    assert "secret" not in str(body)


def _load_production():
    # Drop any cached (or partially imported) module so module-level
    # validation re-executes against the monkeypatched base settings.
    sys.modules.pop("config.settings.production", None)
    return importlib.import_module("config.settings.production")


def test_production_settings_fail_closed_on_default_secret(monkeypatch):
    import config.settings.base as base_settings

    monkeypatch.setattr(base_settings, "SECRET_KEY", "dev-only-insecure-change-me")
    monkeypatch.setattr(base_settings, "ALLOWED_HOSTS", ["daimoma.example.com"])
    with pytest.raises(ImproperlyConfigured, match="DJANGO_SECRET_KEY"):
        _load_production()


def test_production_settings_fail_closed_on_empty_allowed_hosts(monkeypatch):
    import config.settings.base as base_settings

    monkeypatch.setattr(
        base_settings,
        "SECRET_KEY",
        "prod-only-random-secret-key-with-more-than-50-characters",
    )
    monkeypatch.setattr(base_settings, "ALLOWED_HOSTS", [])
    with pytest.raises(ImproperlyConfigured, match="DJANGO_ALLOWED_HOSTS"):
        _load_production()


def test_production_settings_load_with_valid_env(monkeypatch):
    import config.settings.base as base_settings

    monkeypatch.setattr(
        base_settings,
        "SECRET_KEY",
        "prod-only-random-secret-key-with-more-than-50-characters",
    )
    monkeypatch.setattr(base_settings, "ALLOWED_HOSTS", ["daimoma.example.com"])
    prod = _load_production()
    assert prod.DEBUG is False
