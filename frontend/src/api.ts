export type Envelope<T> = {
  data: T;
  checked_at: string;
  request_id: string;
  stale: boolean;
};

export type Overview = {
  service: string;
  version: string;
  environment: string;
  availability: number | null;
  error_rate: number | null;
  request_rate: number | null;
  p95_latency_seconds: number | null;
  targets_up: number;
  targets_total: number;
  active_alerts: number;
};

export type Alert = {
  name: string;
  severity: string;
  summary: string;
  description: string;
  runbook_url: string;
  starts_at: string | null;
  status: string;
};

export type Metrics = {
  request_rate: Point[];
  error_rate: Point[];
  p95_latency_seconds: Point[];
};

export type Point = { timestamp: number; value: number | null };

export type Release = {
  service: string;
  version: string;
  environment: string;
};

const apiBase = import.meta.env.VITE_API_BASE ?? "/api";

async function get<T>(path: string): Promise<Envelope<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  });
  const payload = (await response.json()) as Envelope<T> & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(`${payload.error?.message ?? "监控数据暂时不可用"}（请求 ID：${payload.request_id ?? "未知"}）`);
  }
  return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const fetchOverview = () => get<Overview>("/overview");
export const fetchAlerts = () => get<Alert[]>("/alerts");
export const fetchMetrics = () => get<Metrics>("/metrics?range=30m&step=60s");
export const fetchRelease = () => get<Release>("/release");
