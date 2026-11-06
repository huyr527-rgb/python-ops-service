# Python Ops Service

一个面向云原生运维实践的 Python 服务示例，覆盖应用容器化、Kubernetes 发布和基础可观测性。项目适合用于演示从镜像构建、滚动发布到指标采集和故障排查的完整流程。

## 项目亮点

- Flask + Gunicorn 提供轻量 HTTP 服务。
- `/healthz`、`/version` 和 `/metrics` 支持健康检查、版本识别和 Prometheus 采集。
- Dockerfile 使用非 root 用户运行，并内置容器健康检查。
- Docker Compose 一键启动应用、Prometheus 和 Grafana。
- Kubernetes 使用 2 副本滚动更新、就绪/存活探针、ConfigMap、Secret 和资源配额。
- Prometheus 采集请求量、状态码和响应耗时，Grafana 自动配置 Prometheus 数据源。
- Metrics Server 支持 `kubectl top nodes` 和 `kubectl top pods`。
- GitHub Actions 自动执行测试、Python 编译检查和 YAML 语法检查。

## 技术栈

`Python 3.11` · `Flask` · `Gunicorn` · `Docker` · `Docker Compose` · `Kubernetes` · `Prometheus` · `Grafana`

## 目录结构

```text
app/                         Python 服务、依赖和 Dockerfile
k8s/                         应用 Kubernetes 清单
monitoring/                  Prometheus、Grafana、Metrics Server 清单
monitoring/compose/          Compose 专用监控配置
tests/                       自动化测试
docs/architecture.md        架构和发布流程
docs/resume-project-entry.md 简历项目描述
docker-compose.yml           本地一键启动配置
.env.example                 本地环境变量示例
```

## 快速开始

需要 Docker Engine 和 Docker Compose v2。

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

服务地址：

| 服务 | 地址 |
| --- | --- |
| 应用 | <http://localhost:8000> |
| 健康检查 | <http://localhost:8000/healthz> |
| 指标 | <http://localhost:8000/metrics> |
| Prometheus | <http://localhost:9090> |
| Grafana | <http://localhost:3000> |

Compose 使用 `.env` 中的 Grafana 账号。示例密码 `change-me` 仅适用于本地演示，公开或生产环境请改成强密码。

制造测试流量：

```bash
curl http://localhost:8000/
curl http://localhost:8000/slow
curl http://localhost:8000/error
```

停止服务：

```bash
docker compose down
```

## Kubernetes 部署

### 1. 构建并推送应用镜像

将 `YOUR_REGISTRY` 替换为自己的镜像仓库地址：

```bash
docker build -t python-ops-service:v1.0.0 ./app
docker tag python-ops-service:v1.0.0 YOUR_REGISTRY/python-ops-service:v1.0.0
docker push YOUR_REGISTRY/python-ops-service:v1.0.0
```

然后修改 `k8s/deployment.yaml` 中的镜像地址。

### 2. 发布应用和监控

```bash
kubectl apply -k k8s/
kubectl apply -k monitoring/
kubectl get pods -n ops-demo
kubectl get svc -n ops-demo
```

资源使用率：

```bash
kubectl top nodes
kubectl top pods -n ops-demo
```

默认 NodePort：应用 `30080`、Prometheus `30090`、Grafana `30300`。Grafana 示例账号为 `admin/change-me`，生产环境应改为 Secret 管理的强密码。

## 监控查询

在 Grafana Explore 或 Prometheus 中可以使用：

```promql
http_requests_total
rate(http_request_duration_seconds_count[1m])
app_info
```

Prometheus 的目标状态可以通过以下命令检查：

```bash
kubectl port-forward -n ops-demo svc/prometheus 9090:9090
```

然后访问 <http://localhost:9090/targets>，确认 `python-ops-service` 为 `UP`。

## 发布与排障

```bash
kubectl rollout status deployment/python-ops-service -n ops-demo
kubectl logs deployment/python-ops-service -n ops-demo
kubectl describe pod -n ops-demo
kubectl get events -n ops-demo --sort-by=.lastTimestamp
kubectl rollout undo deployment/python-ops-service -n ops-demo
```

更多设计说明见 [docs/architecture.md](docs/architecture.md)，简历项目描述见 [docs/resume-project-entry.md](docs/resume-project-entry.md)。

## 测试

```bash
python -m pip install -r requirements-dev.txt
pytest -q
python -m compileall -q app
```

GitHub Actions 会在 Push 和 Pull Request 时自动执行这些检查。

## 项目边界

当前版本聚焦应用发布和基础监控，不包含数据库、Redis、日志平台、告警规则和 CI/CD 镜像发布流程。这些能力可以作为后续扩展方向。

## License

[MIT](LICENSE)
