param(
    [string]$Namespace = "ops-demo",
    [string]$Deployment = "python-ops-service"
)

$ErrorActionPreference = "Stop"

kubectl rollout undo "deployment/$Deployment" -n $Namespace
kubectl rollout status "deployment/$Deployment" -n $Namespace --timeout=180s
kubectl get pods -n $Namespace -l "app=$Deployment"
