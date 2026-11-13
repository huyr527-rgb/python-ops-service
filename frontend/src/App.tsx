import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  Gauge,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { fetchAlerts, fetchMetrics, fetchOverview, fetchRelease, type Alert } from "./api";

const POLL_INTERVAL = 30_000;
const TrafficChart = lazy(() => import("./TrafficChart"));

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
}

function formatNumber(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

function formatTime(value: string | number | null) {
  if (!value) return "—";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function Metric({ label, value, detail, tone = "cyan" }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <article className={`metric metric-${tone}`}>
      <p className="metric-label">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const isCritical = alert.severity === "critical";
  return (
    <li className={`alert-row ${isCritical ? "alert-critical" : "alert-warning"}`}>
      <div className="alert-marker" aria-hidden="true">
        {isCritical ? <CircleAlert size={17} /> : <AlertTriangle size={17} />}
      </div>
      <div className="alert-copy">
        <div className="alert-heading">
          <strong>{alert.name}</strong>
          <span>{alert.severity}</span>
        </div>
        <p>{alert.summary}</p>
        <small>触发于 {formatTime(alert.starts_at)}</small>
      </div>
      {/^https?:\/\//i.test(alert.runbook_url) && (
        <a href={alert.runbook_url} target="_blank" rel="noreferrer" aria-label={`${alert.name} Runbook`}>
          <ArrowUpRight size={16} />
        </a>
      )}
      {alert.description && <details className="alert-detail"><summary>告警详情</summary><p>{alert.description}</p></details>}
    </li>
  );
}

function App() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: fetchOverview, refetchInterval: POLL_INTERVAL, placeholderData: (previous) => previous });
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, refetchInterval: POLL_INTERVAL, placeholderData: (previous) => previous });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts, refetchInterval: POLL_INTERVAL, placeholderData: (previous) => previous });
  const release = useQuery({ queryKey: ["release"], queryFn: fetchRelease, refetchInterval: POLL_INTERVAL, placeholderData: (previous) => previous });

  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);
  const queries = [overview, metrics, alerts, release];
  const dataStale = queries.some((query) => query.data && (
    query.isError || query.data.stale || now - Date.parse(query.data.checked_at) > 90_000
  ));
  const failedSources = queries.flatMap((query, index) => query.isError ? [
    `${["运行概览", "趋势指标", "活动告警", "版本信息"][index]}：${query.error.message}`,
  ] : []);
  const unavailable = failedSources.length > 0;
  const critical = (overview.data?.data.targets_total ?? 0) > 0 && overview.data?.data.targets_up === 0 || alerts.data?.data.some((alert) => alert.severity === "critical");
  const isHealthy = Boolean(
    overview.data && !dataStale && !unavailable && alerts.data &&
      overview.data.data.targets_total > 0 &&
      overview.data.data.targets_up === overview.data.data.targets_total &&
      overview.data.data.active_alerts === 0,
  );
  const lastChecked = overview.data?.checked_at ?? metrics.data?.checked_at;
  const activeAlerts = alerts.data?.data ?? [];

  const refreshAll = () => {
    void Promise.all([overview.refetch(), metrics.refetch(), alerts.refetch(), release.refetch()]);
  };

  return (
    <main className="console-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Activity size={18} /></div>
          <div>
            <p className="eyebrow">Operations control room</p>
            <h1>Python Ops Service</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="environment-tag"><span className="pulse-dot" />{release.data?.data.environment ?? "connecting"}</span>
          <button className="icon-button" onClick={refreshAll} aria-label="刷新监控数据" title="刷新监控数据">
            <RefreshCw size={17} className={overview.isFetching ? "spin" : ""} />
          </button>
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Live service posture</p>
          <h2>服务状态，实时可见。</h2>
          <p className="hero-description">从应用探针到 Prometheus 目标，再到告警状态，所有运行信号集中在一个只读视图中。</p>
          <div role="status" className={`status-banner ${isHealthy ? "status-healthy" : critical ? "status-critical" : "status-degraded"}`}>
            {isHealthy ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            <div>
              <strong>{overview.isLoading ? "正在同步指标" : dataStale ? "数据已过期" : unavailable ? "监控数据暂时不可用" : critical ? "服务存在故障告警" : isHealthy ? "服务运行正常" : overview.data?.data.targets_total === 0 ? "暂无采集目标" : "需要关注运行状态"}</strong>
              <span>{dataStale ? "显示最近一次可用数据" : `最近检查 ${formatTime(lastChecked ?? null)}`}</span>
            </div>
          </div>
        </div>
        <div className="release-panel">
          <div className="panel-heading"><span>Current release</span><Server size={17} /></div>
          <div className="release-version">{release.data?.data.version ?? "—"}</div>
          <div className="release-meta"><span>Environment</span><strong>{release.data?.data.environment ?? "—"}</strong></div>
          <div className="release-meta"><span>Request ID</span><strong className="mono">{overview.data?.request_id ?? "—"}</strong></div>
        </div>
      </section>

      {(dataStale || unavailable) && <div className="stale-banner" role="status"><Clock3 size={16} /><div>{dataStale && <p>数据已过期，当前保留最近一次结果。</p>}{failedSources.map((reason) => <p key={reason}>{reason}</p>)}</div></div>}

      <section className={`metric-grid ${overview.isLoading ? "is-loading" : ""}`} aria-label="核心指标" aria-busy={overview.isLoading}>
        <Metric label="可用率" value={overview.data ? formatPercent(overview.data.data.availability) : "—"} detail="过去 5 分钟" tone="cyan" />
        <Metric label="P95 延迟" value={overview.data?.data.p95_latency_seconds != null ? `${Math.round(overview.data.data.p95_latency_seconds * 1000)} ms` : "—"} detail="HTTP 请求" tone="violet" />
        <Metric label="错误率" value={overview.data ? formatPercent(overview.data.data.error_rate) : "—"} detail="5xx / 总请求" tone="amber" />
        <Metric label="请求速率" value={overview.data ? `${formatNumber(overview.data.data.request_rate)} rps` : "—"} detail="过去 5 分钟" tone="blue" />
      </section>

      <section className="content-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div><span>Traffic signals</span><h3>请求与延迟趋势</h3></div>
            <span className="range-tag">最近 30 分钟</span>
          </div>
          <div className="chart-wrap">
            <Suspense fallback={<div className="empty-state">正在加载趋势图</div>}>
              {metrics.data ? <TrafficChart data={metrics.data.data} /> : <div className="empty-state">{metrics.isError ? "趋势数据暂时不可用，请尝试刷新。" : "正在等待 Prometheus 时间序列。"}</div>}
            </Suspense>
          </div>
        </article>

        <article className="panel alerts-panel">
          <div className="panel-heading"><div><span>Signal queue</span><h3>活动告警</h3></div><span className="alert-count">{activeAlerts.length}</span></div>
          {alerts.isError && <div className="inline-error">Alertmanager 暂时无法访问。</div>}
          {alerts.isLoading && <div className="empty-alerts">正在同步告警</div>}
          {alerts.data && !alerts.isError && activeAlerts.length === 0 && <div className="empty-alerts"><Check size={22} /><strong>当前没有活动告警</strong><span>系统会每 30 秒重新检查。</span></div>}
          {activeAlerts.length > 0 && <ul className="alert-list">{activeAlerts.map((alert) => <AlertRow key={`${alert.name}-${alert.starts_at}`} alert={alert} />)}</ul>}
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel compact-panel">
          <div className="panel-heading"><div><span>Target health</span><h3>采集目标</h3></div><Wifi size={17} /></div>
          <div className="target-score"><strong>{overview.data ? `${overview.data.data.targets_up}/${overview.data.data.targets_total}` : "—"}</strong><span>targets up</span></div>
          <div className="health-bar"><span style={{ width: `${overview.data?.data.targets_total ? (overview.data.data.targets_up / overview.data.data.targets_total) * 100 : 0}%` }} /></div>
          <p className="panel-note">Prometheus Kubernetes service discovery</p>
        </article>
        <article className="panel compact-panel">
          <div className="panel-heading"><div><span>Release signal</span><h3>发布验证</h3></div><Gauge size={17} /></div>
          <ul className="check-list">
            <li><Activity size={15} /><span>版本接口</span><strong>{release.isError ? "不可用" : release.data ? "已响应" : "同步中"}</strong></li>
            <li><Server size={15} /><span>应用副本（采集可达）</span><strong>{overview.data ? `${overview.data.data.targets_up}/${overview.data.data.targets_total}` : "未知"}</strong></li>
            <li><Wifi size={15} /><span>Alertmanager</span><strong>{alerts.isError ? "不可用" : alerts.data ? "已响应" : "同步中"}</strong></li>
          </ul>
          <details className="release-details"><summary>版本详情</summary><p className="mono">{release.data?.data.version ?? "尚未获取版本"}</p><p>探针、期望副本数及发布历史请通过运行手册检查。</p></details>
        </article>
        <article className="panel compact-panel">
          <div className="panel-heading"><div><span>Runbook</span><h3>下一步入口</h3></div><ArrowUpRight size={17} /></div>
          <p className="runbook-copy">需要定位告警或回滚时，按运行手册执行可复现的检查步骤。</p>
          <a className="text-link" href="https://github.com/huyr527-rgb/python-ops-service/blob/main/docs/runbook.md" target="_blank" rel="noreferrer">打开运行手册 <ArrowUpRight size={15} /></a>
        </article>
      </section>

      <footer className="footer"><span>Read-only observability surface</span><span className="mono">refresh / 30s</span></footer>
    </main>
  );
}

export default App;
