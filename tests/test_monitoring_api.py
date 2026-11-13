from app.app import app


class FakeMonitoringClient:
    def scalar(self, expression):
        if "5.." in expression:
            return 0.02
        if "request_duration" in expression:
            return 0.18
        if 'sum(up' in expression:
            return 2
        if "count(up" in expression:
            return 2
        return 12.5

    def alerts(self):
        return []

    def query_range(self, expression, start, end, step):
        return [{"timestamp": start, "value": 1.0}]


def test_monitoring_overview_returns_normalized_data(monkeypatch):
    monkeypatch.setattr("app.app._monitoring_client", lambda: FakeMonitoringClient())
    response = app.test_client().get("/api/overview")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["data"]["targets_up"] == 2
    assert payload["data"]["active_alerts"] == 0
    assert payload["request_id"]


def test_monitoring_failure_returns_safe_error(monkeypatch):
    class BrokenClient:
        def alerts(self):
            from app.monitoring_client import MonitoringClientError

            raise MonitoringClientError("connection refused")

    monkeypatch.setattr("app.app._monitoring_client", lambda: BrokenClient())
    response = app.test_client().get("/api/alerts")

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "MONITORING_UNAVAILABLE"
