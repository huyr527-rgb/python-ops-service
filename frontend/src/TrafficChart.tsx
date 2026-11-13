import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Metrics } from "./api";

const series = {
  request_rate: { label: "请求速率", unit: "rps", scale: 1, color: "#67e8f9" },
  error_rate: { label: "错误率", unit: "%", scale: 100, color: "#f6bd60" },
  p95_latency_seconds: { label: "P95 延迟", unit: "ms", scale: 1000, color: "#b6a2ff" },
};

export default function TrafficChart({ data }: { data: Metrics }) {
  const [selected, setSelected] = useState<keyof Metrics>("request_rate");
  const config = series[selected];
  const points = data[selected].map((point) => ({
    time: new Date(point.timestamp * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    value: point.value === null ? null : point.value * config.scale,
  }));
  return <>
    <div className="chart-switcher" role="group" aria-label="选择趋势指标">
      {Object.entries(series).map(([key, item]) => <button key={key} type="button" aria-pressed={selected === key} onClick={() => setSelected(key as keyof Metrics)}>{item.label} <small>{item.unit}</small></button>)}
    </div>
    {points.some((point) => point.value !== null) ? <div className="chart-canvas" role="img" aria-label={`${config.label}，最近 30 分钟，单位 ${config.unit}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke="#21323a" strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "#91acb3", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={35} />
          <YAxis tick={{ fill: "#91acb3", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip formatter={(value: number) => [`${Number(value).toFixed(2)} ${config.unit}`, config.label]} contentStyle={{ background: "#0e1b20", border: "1px solid #2a4149", borderRadius: 8, color: "#e9f2f3" }} />
          <Line type="monotone" dataKey="value" stroke={config.color} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div> : <div className="empty-state">暂无{config.label}数据，等待下一次采集。</div>}
  </>;
}
