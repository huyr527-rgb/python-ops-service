"""Small HTTP client for the Prometheus and Alertmanager read APIs."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class MonitoringClientError(RuntimeError):
    """Raised when an upstream monitoring service cannot be read."""


class MonitoringClient:
    def __init__(
        self,
        prometheus_url: str,
        alertmanager_url: str,
        timeout: float = 2.0,
    ) -> None:
        self.prometheus_url = prometheus_url.rstrip("/")
        self.alertmanager_url = alertmanager_url.rstrip("/")
        self.timeout = timeout

    def _get_json(self, url: str) -> object:
        request = Request(url, headers={"Accept": "application/json"})
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            raise MonitoringClientError("monitoring upstream unavailable") from exc

    def query(self, expression: str) -> dict:
        query = urlencode({"query": expression})
        payload = self._get_json(f"{self.prometheus_url}/api/v1/query?{query}")
        if not isinstance(payload, dict) or payload.get("status") != "success":
            raise MonitoringClientError("prometheus query failed")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise MonitoringClientError("prometheus returned invalid data")
        return data

    def query_range(self, expression: str, start: float, end: float, step: str) -> list[dict]:
        query = urlencode(
            {
                "query": expression,
                "start": start,
                "end": end,
                "step": step,
            }
        )
        payload = self._get_json(f"{self.prometheus_url}/api/v1/query_range?{query}")
        if not isinstance(payload, dict) or payload.get("status") != "success":
            raise MonitoringClientError("prometheus range query failed")
        data = payload.get("data", {})
        results = data.get("result", []) if isinstance(data, dict) else []
        if not results:
            return []
        values = results[0].get("values", [])
        return [
            {"timestamp": float(timestamp), "value": float(value)}
            for timestamp, value in values
        ]

    def scalar(self, expression: str) -> float:
        data = self.query(expression)
        result_type = data.get("resultType")
        result = data.get("result")
        if result_type == "scalar" and isinstance(result, list):
            return float(result[1])
        if result_type == "vector" and isinstance(result, list) and result:
            return float(result[0]["value"][1])
        return 0.0

    def alerts(self) -> list[dict]:
        payload = self._get_json(
            f"{self.alertmanager_url}/api/v2/alerts?active=true&silenced=false&inhibited=false"
        )
        if not isinstance(payload, list):
            raise MonitoringClientError("alertmanager returned invalid data")
        normalized = []
        for alert in payload:
            labels = alert.get("labels", {})
            annotations = alert.get("annotations", {})
            normalized.append(
                {
                    "name": labels.get("alertname", "Unknown alert"),
                    "severity": labels.get("severity", "warning"),
                    "summary": annotations.get("summary", "Monitoring alert is active"),
                    "description": annotations.get("description", ""),
                    "runbook_url": annotations.get("runbook_url", ""),
                    "starts_at": alert.get("startsAt"),
                    "status": alert.get("status", {}).get("state", "active"),
                }
            )
        return normalized
