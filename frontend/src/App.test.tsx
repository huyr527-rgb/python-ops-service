import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("./TrafficChart", () => ({
  default: () => <div aria-label="mock trend chart" />,
}));

const envelope = (data: unknown) => ({ data, checked_at: new Date().toISOString(), request_id: "test-request", stale: false });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/overview")) return Promise.resolve(new Response(JSON.stringify(envelope({ service: "python-ops-service", version: "abc123", environment: "kubernetes", availability: 1, error_rate: 0, request_rate: 2, p95_latency_seconds: 0.12, targets_up: 2, targets_total: 2, active_alerts: 0 }))));
    if (url.endsWith("/alerts")) return Promise.resolve(new Response(JSON.stringify(envelope([]))));
    if (url.endsWith("/release")) return Promise.resolve(new Response(JSON.stringify(envelope({ service: "python-ops-service", version: "abc123", environment: "kubernetes" }))));
    return Promise.resolve(new Response(JSON.stringify(envelope({ request_rate: [{ timestamp: 1, value: 2 }], error_rate: [{ timestamp: 1, value: 0 }], p95_latency_seconds: [{ timestamp: 1, value: 0.12 }] }))));
  }));
});

describe("monitoring console", () => {
  it("renders the healthy service state", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);

    expect(await screen.findByText("服务运行正常")).toBeInTheDocument();
    expect(screen.getByText("当前没有活动告警")).toBeInTheDocument();
    expect(screen.getAllByText("abc123")).toHaveLength(2);
  });
});
