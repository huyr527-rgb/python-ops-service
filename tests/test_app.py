import re

from app.app import app


def test_health_and_version_endpoints():
    client = app.test_client()

    health = client.get("/healthz")
    version = client.get("/version")

    assert health.status_code == 200
    assert health.get_json()["status"] == "ok"
    assert version.status_code == 200
    assert "version" in version.get_json()


def test_liveness_readiness_and_request_id():
    client = app.test_client()

    live = client.get("/livez", headers={"X-Request-ID": "test-request"})
    ready = client.get("/readyz")

    assert live.status_code == 200
    assert live.get_json()["status"] == "ok"
    assert live.headers["X-Request-ID"] == "test-request"
    assert ready.status_code == 200
    assert ready.get_json()["status"] == "ready"


def test_metrics_endpoint_exposes_application_metrics():
    response = app.test_client().get("/metrics")

    assert response.status_code == 200
    assert re.search(r"^app_info\{", response.get_data(as_text=True), re.MULTILINE)


def test_simulated_error_endpoint():
    response = app.test_client().get("/error")

    assert response.status_code == 500
    assert response.get_json() == {"status": "simulated-error"}
