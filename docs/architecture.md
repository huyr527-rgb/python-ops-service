# Architecture

```text
                         +----------------------+
                         |  Browser / curl       |
                         +----------+-----------+
                                    |
                              HTTP :8000
                                    |
                    +---------------v----------------+
                    | Flask + Gunicorn application    |
                    | /healthz /metrics /version      |
                    +---------------+----------------+
                                    |
                              scrape :8000/metrics
                                    |
                    +---------------v----------------+
                    | Prometheus :9090                |
                    +---------------+----------------+
                                    |
                              datasource API
                                    |
                    +---------------v----------------+
                    | Grafana :3000                   |
                    +--------------------------------+
```

The application is packaged as a non-root Python 3.11 container. Docker
Compose is intended for local development. Kubernetes manifests provide a
namespace, rolling deployment, service discovery, probes, resource limits,
and configuration separation.

Prometheus scrapes the application through the Kubernetes Service DNS name.
Metrics Server is included for Kubernetes resource inspection with
`kubectl top`; it is separate from Prometheus and serves the Kubernetes
resource metrics API.

## Request and release flow

1. Build the application image from `app/Dockerfile`.
2. Run the stack locally with Docker Compose, or push the image to a registry.
3. Apply `k8s/` with Kustomize to create the application resources.
4. Apply `monitoring/` to create Prometheus, Grafana, and Metrics Server.
5. Use readiness probes, Prometheus targets, and rollout status to verify a release.
