# Python Ops Service Runbook

This runbook is the operational part of the release loop. The deployment is
managed from Git, Prometheus evaluates alerts, and the rollback command restores
the previous ReplicaSet when a release fails.

## Release verification

```bash
kubectl apply -f deploy/argocd/application.yaml
kubectl get application -n argocd python-ops-service
kubectl rollout status deployment/python-ops-service -n ops-demo
```

For a manual verification without Argo CD:

```bash
kubectl apply -k deploy/overlays/cloud
pwsh ./scripts/verify-release.ps1
```

The release is healthy when all application Pods are ready, the HPA has a
working metrics target, and Prometheus reports every application target as
`up=1`.

## Alert workflow

Prometheus sends `ApplicationDown`, `PrometheusTargetDown`, `HighErrorRate`, and
`HighLatency` to Alertmanager. Inspect active alerts with:

```bash
kubectl port-forward -n ops-demo svc/alertmanager 9093:9093
```

Then open <http://127.0.0.1:9093/alerts>.

### ApplicationDown

1. Check Pod and Deployment state.
2. Inspect the previous container logs.
3. Verify `/livez` and `/readyz` inside a ready Pod.
4. Roll back if the alert started after a release.

```bash
kubectl get pods -n ops-demo -l app=python-ops-service
kubectl describe pod -n ops-demo -l app=python-ops-service
kubectl logs deployment/python-ops-service -n ops-demo --previous
```

### PrometheusTargetDown

Check the target list and the Pod IPs discovered by Kubernetes service
discovery. A single down target can mean a Pod is starting, terminating, or
failing its `/metrics` endpoint.

```bash
kubectl port-forward -n ops-demo svc/prometheus 9090:9090
```

Inspect `up{job="python-ops-service"}` in Prometheus.

### HighErrorRate

Reproduce the signal with the intentional error endpoint, then inspect request
IDs and application logs:

```bash
for i in $(seq 1 20); do curl -s -o /dev/null http://SERVICE/error; done
kubectl logs deployment/python-ops-service -n ops-demo | tail -50
```

### HighLatency

Compare the application histogram with the end-to-end latency. The `/slow`
endpoint intentionally blocks a synchronous worker and is useful for validating
the alert path. Move real long-running work to a queue or background worker.

## Rollback

Use the previous ReplicaSet for an immediate recovery:

```bash
pwsh ./scripts/rollback.ps1
```

After the service is healthy, revert the bad image tag in Git so Argo CD does
not reapply the failed release.

## Current limitation

The default demo exposes application, Prometheus, and Grafana through NodePort
for easy access on the single-node lab server. In a multi-node production
cluster, put the application behind an Ingress with TLS and keep Prometheus,
Grafana, and Alertmanager as internal Services.
