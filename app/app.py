import os
import time

from flask import Flask, Response, jsonify, request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest


app = Flask(__name__)

APP_NAME = os.getenv("APP_NAME", "python-ops-service")
APP_VERSION = os.getenv("APP_VERSION", "dev")
APP_ENV = os.getenv("APP_ENV", "local")

REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)
REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
)
APP_INFO = Gauge("app_info", "Application build information", ["name", "version", "env"])
APP_INFO.labels(APP_NAME, APP_VERSION, APP_ENV).set(1)


@app.before_request
def start_timer() -> None:
    request.start_time = time.perf_counter()


@app.after_request
def record_request(response):
    duration = time.perf_counter() - getattr(request, "start_time", time.perf_counter())
    REQUESTS_TOTAL.labels(request.method, request.path, str(response.status_code)).inc()
    REQUEST_DURATION.labels(request.method, request.path).observe(duration)
    return response


@app.get("/")
def index():
    return jsonify({"service": APP_NAME, "version": APP_VERSION, "environment": APP_ENV})


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok", "version": APP_VERSION})


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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
