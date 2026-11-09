# 简历项目经历

## Python 服务云原生部署与可观测性实践｜项目负责人

### 项目概述

构建并交付一个可复现的 Python 云原生服务示例，打通镜像构建、容器运行、Kubernetes 发布、指标采集和故障排查流程。

### 技术实施

- 基于 Flask + Gunicorn 开发 HTTP 服务，提供健康检查、版本查询、Prometheus 指标、慢请求和模拟错误接口。
- 编写 Dockerfile 和 Docker Compose 配置，实现应用、Prometheus、Grafana 本地一键启动；采用非 root 用户运行容器并加入健康检查。
- 编写 Kubernetes Namespace、Deployment、Service、ConfigMap 和 Secret 清单，配置启动/就绪/存活探针、HPA、PDB、NetworkPolicy、非 root 安全上下文和资源配额。
- 搭建 Prometheus + Alertmanager + Grafana + Metrics Server 监控链路，采集请求量、状态码、响应耗时及节点/Pod 资源使用率，并配置高错误率、目标下线和高延迟告警。
- 使用 GitHub Actions 完成 Ruff、测试、Kustomize 渲染、GHCR SHA 镜像构建和 Trivy 扫描，自动更新 Argo CD GitOps overlay。
- 编写发布验证、故障排查和回滚 Runbook，形成“提交—构建—扫描—同步—监控—告警—回滚”的可复现闭环。

### 项目成果

- 形成“代码提交—镜像构建—安全扫描—集群同步—指标采集—告警—故障定位—版本回滚”的标准化交付流程。
- 支持通过 Prometheus Targets、Grafana 数据源、Kubernetes 探针和 `kubectl top` 进行多层次运行验证。
- 将部署配置、监控组件和排障命令整理为可公开复现的 GitHub 项目，便于团队协作和后续扩展。

**技术栈：** Python、Flask、Gunicorn、Docker、Docker Compose、Kubernetes、Kustomize、Argo CD、GHCR、Trivy、Prometheus、Alertmanager、Grafana、GitHub Actions
