"""HTTP service, health endpoints, and Prometheus instrumentation."""

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from uuid import uuid4

from flask import Flask, Response, jsonify, request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

try:
    from .monitoring_client import MonitoringClient, MonitoringClientError
except ImportError:  # pragma: no cover - used when Gunicorn runs app.py directly
    from monitoring_client import MonitoringClient, MonitoringClientError

app = Flask(__name__)
app.logger.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())

APP_NAME = os.getenv("APP_NAME", "python-ops-service")
APP_VERSION = os.getenv("APP_VERSION", "dev")
APP_ENV = os.getenv("APP_ENV", "local")
REQUEST_ID_HEADER = "X-Request-ID"
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")
ALERTMANAGER_URL = os.getenv("ALERTMANAGER_URL", "http://alertmanager:9093")
MONITORING_TIMEOUT = float(os.getenv("MONITORING_TIMEOUT_SECONDS", "2"))

REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)
REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
APP_INFO = Gauge("app_info", "Application build information", ["name", "version", "env"])
APP_INFO.labels(APP_NAME, APP_VERSION, APP_ENV).set(1)


@app.before_request
def start_timer() -> None:
    request.start_time = time.perf_counter()
    request.request_id = request.headers.get(REQUEST_ID_HEADER) or uuid4().hex


@app.after_request
def record_request(response: Response) -> Response:
    duration = time.perf_counter() - getattr(request, "start_time", time.perf_counter())
    REQUESTS_TOTAL.labels(request.method, request.path, str(response.status_code)).inc()
    REQUEST_DURATION.labels(request.method, request.path).observe(duration)
    request_id = getattr(request, "request_id", uuid4().hex)
    response.headers[REQUEST_ID_HEADER] = request_id
    app.logger.info(
        json.dumps(
            {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "level": "INFO",
                "request_id": request_id,
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "latency_ms": round(duration * 1000, 3),
            },
            ensure_ascii=False,
        )
    )
    return response


@app.get("/")
def index():
    return jsonify({"service": APP_NAME, "version": APP_VERSION, "environment": APP_ENV})


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok", "version": APP_VERSION})


@app.get("/livez")
def livez():
    """Process liveness check; it does not inspect external dependencies."""
    return jsonify({"status": "ok", "version": APP_VERSION})


@app.get("/readyz")
def readyz():
    """Traffic readiness check; dependency checks can be added here later."""
    return jsonify({"status": "ready", "version": APP_VERSION})


@app.get("/version")
def version():
    return jsonify({"version": APP_VERSION})


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)


@app.get("/slow")
def slow():
    time.sleep(1)
    return jsonify({"status": "slow-response"})


@app.get("/error")
def error():
    return jsonify({"status": "simulated-error"}), 500


def _checked_at() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _api_response(data: object, stale: bool = False):
    return jsonify(
        {
            "data": data,
            "checked_at": _checked_at(),
            "request_id": getattr(request, "request_id", uuid4().hex),
            "stale": stale,
        }
    )


def _monitoring_error(error: MonitoringClientError):
    app.logger.warning("monitoring API unavailable: %s", error)
    return (
        jsonify(
            {
                "error": {
                    "code": "MONITORING_UNAVAILABLE",
                    "message": "Monitoring data is temporarily unavailable.",
                },
                "checked_at": _checked_at(),
                "request_id": getattr(request, "request_id", uuid4().hex),
                "stale": True,
            }
        ),
        503,
    )


def _monitoring_client() -> MonitoringClient:
    return MonitoringClient(PROMETHEUS_URL, ALERTMANAGER_URL, MONITORING_TIMEOUT)


@app.get("/api/release")
def api_release():
    return _api_response(
        {
            "service": APP_NAME,
            "version": APP_VERSION,
            "environment": APP_ENV,
        }
    )


@app.get("/api/alerts")
def api_alerts():
    try:
        return _api_response(_monitoring_client().alerts())
    except MonitoringClientError as error:
        return _monitoring_error(error)


@app.get("/api/overview")
def api_overview():
    client = _monitoring_client()
    try:
        queries = {
            "error_rate": 'sum(rate(http_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 1)',
            "request_rate": "sum(rate(http_requests_total[5m]))",
            "p95_latency": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "targets_up": 'sum(up{job="python-ops-service"})',
            "targets_total": 'count(up{job="python-ops-service"})',
        }
        with ThreadPoolExecutor(max_workers=len(queries) + 1) as executor:
            futures = {name: executor.submit(client.scalar, expression) for name, expression in queries.items()}
            alerts_future = executor.submit(client.alerts)
            values = {name: future.result() for name, future in futures.items()}
            alerts = alerts_future.result()
        return _api_response(
            {
                "service": APP_NAME,
                "version": APP_VERSION,
                "environment": APP_ENV,
                "availability": max(0.0, 1.0 - values["error_rate"]),
                "error_rate": values["error_rate"],
                "request_rate": values["request_rate"],
                "p95_latency_seconds": values["p95_latency"],
                "targets_up": int(values["targets_up"]),
                "targets_total": int(values["targets_total"]),
                "active_alerts": len(alerts),
            }
        )
    except MonitoringClientError as error:
        return _monitoring_error(error)


@app.get("/api/metrics")
def api_metrics():
    client = _monitoring_client()
    try:
        now = time.time()
        start = now - 30 * 60
        return _api_response(
            {
                "request_rate": client.query_range("sum(rate(http_requests_total[5m]))", start, now, "60s"),
                "error_rate": client.query_range(
                    'sum(rate(http_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 1)',
                    start,
                    now,
                    "60s",
                ),
                "p95_latency_seconds": client.query_range(
                    "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
                    start,
                    now,
                    "60s",
                ),
            }
        )
    except MonitoringClientError as error:
        return _monitoring_error(error)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
