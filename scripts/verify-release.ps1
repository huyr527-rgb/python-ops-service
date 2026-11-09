param(
    [string]$Namespace = "ops-demo",
    [string]$Deployment = "python-ops-service"
)

$ErrorActionPreference = "Stop"

kubectl rollout status "deployment/$Deployment" -n $Namespace --timeout=180s
kubectl get pods -n $Namespace -l "app=$Deployment" -o wide
kubectl get hpa,pdb -n $Namespace
kubectl get events -n $Namespace --sort-by=.lastTimestamp

$pod = kubectl get pod -n $Namespace -l "app=$Deployment" -o jsonpath='{.items[0].metadata.name}'
kubectl exec -n $Namespace $pod -- python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/readyz').read().decode())"

Write-Host "Release verification completed."
