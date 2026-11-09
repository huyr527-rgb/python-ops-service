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
namespace, rolling deployment, service discovery, startup/readiness/liveness
probes, resource limits, HPA, PDB, security context, and configuration
separation.

Prometheus discovers every running application Pod through the Kubernetes API,
so dashboards and alerts include all replicas instead of only one Service
backend. Prometheus evaluates native alert rules and forwards them to
Alertmanager. Metrics Server is included for Kubernetes resource inspection with
`kubectl top`; it is separate from Prometheus and serves the Kubernetes resource
metrics API.
Metrics Server is included for Kubernetes resource inspection with
`kubectl top`; it is separate from Prometheus and serves the Kubernetes
resource metrics API.

## Request and release flow

1. Push code to `main` and let GitHub Actions run Ruff, tests, YAML/Kustomize validation, and the container build.
2. Scan the immutable GHCR image tag with Trivy.
3. Promote the commit SHA to `deploy/overlays/cloud`.
4. Let Argo CD synchronize the desired state and self-heal drift.
5. Use rollout status, `/readyz`, Prometheus targets, Alertmanager, and `kubectl top` to verify a release.
6. Use the rollback script and commit a Git revert when a release causes an alert.
