import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Star, X, AlertCircle, Bell, BellRing, Trash2, ExternalLink } from "lucide-react";
import { sb, money, dealLink, FlapPrice, SourceBadge, ChangeChip } from "./shared.jsx";

const shortTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

function downsample(points, target = 160) {
  if (points.length <= target) return points;
  const step = Math.ceil(points.length / target);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function CustomTooltip({ active, payload, currency }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-md px-3 py-2 text-xs"
      style={{ backgroundColor: "#14171C", border: "1px solid #E8A33D", color: "#EDEDE6" }}
    >
      <div style={{ color: "#7C838F" }}>{shortTime(p.ts)}</div>
      <div className="font-bold tabular-nums">{money(p.price, currency)}</div>
    </div>
  );
}

export default function Drawer({ item, watched, alerts, onToggleWatch, onCreateAlert, onDeleteAlert, onClose }) {
  const [ticks, setTicks] = useState(null);
  const [error, setError] = useState(null);
  const [direction, setDirection] = useState("below");
  const [targetPrice, setTargetPrice] = useState(item.current_price.toFixed(2));
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const rows = await sb(
        `price_ticks?item_id=eq.${item.id}&select=price,ts,source&ts=gte.${encodeURIComponent(
          cutoff
        )}&order=ts.asc&limit=3000`
      );
      setTicks(rows);
    } catch (e) {
      setError(e.message);
    }
  }, [item.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);

  const chartData = useMemo(() => (ticks ? downsample(ticks) : []), [ticks]);
  const stats = useMemo(() => {
    if (!ticks || ticks.length === 0) return null;
    const prices = ticks.map((t) => t.price);
    return { low: Math.min(...prices), high: Math.max(...prices) };
  }, [ticks]);

  async function handleCreateAlert(e) {
    e.preventDefault();
    const value = parseFloat(targetPrice);
    if (!Number.isFinite(value) || value <= 0) return;
    setSubmitting(true);
    try {
      await onCreateAlert(item.id, direction, value);
    } finally {
      setSubmitting(false);
    }
  }

  const tone = item.change_24h_pct <= 0 ? "teal" : "coral";
  const lineColor = tone === "teal" ? "#4FB6A6" : "#E2695A";
  const priceText = money(item.current_price, item.currency);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(10,11,13,0.6)" }} onClick={onClose} />
      <div
        className="relative h-full w-full max-w-md overflow-y-auto p-6 flex flex-col gap-5"
        style={{ backgroundColor: "#181B21", borderLeft: "1px solid #2A2F38" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color: "#7C838F" }}>
              <span>{item.category_icon}</span>
              <span>{item.category_name}</span>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "#EDEDE6" }}>
              {item.name}
            </h2>
            <div className="text-sm" style={{ color: "#7C838F" }}>
              {item.provider} · {item.subtitle}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md shrink-0" aria-label="Close">
            <X size={20} color="#7C838F" />
          </button>
        </div>

        <div className="flex items-end justify-between">
          <FlapPrice text={priceText} tone={tone} size="text-4xl" />
          <div className="flex flex-col items-end gap-1.5">
            <ChangeChip pct={item.change_24h_pct} />
            <SourceBadge source={item.price_source} />
          </div>
        </div>

        <button
          onClick={() => onToggleWatch(item.id)}
          className="flex items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-sm"
          style={{
            backgroundColor: watched ? "rgba(232,163,61,0.12)" : "#20242C",
            color: watched ? "#E8A33D" : "#EDEDE6",
            border: `1px solid ${watched ? "#E8A33D" : "#2A2F38"}`,
          }}
        >
          <Star size={16} fill={watched ? "#E8A33D" : "none"} color={watched ? "#E8A33D" : "#EDEDE6"} />
          {watched ? "Watching this fare" : "Watch this fare"}
        </button>

        <a
          href={dealLink(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-sm"
          style={{ backgroundColor: "#E8A33D", color: "#14171C" }}
        >
          View this deal <ExternalLink size={16} />
        </a>
        {!item.deep_link && (
          <div className="text-xs -mt-3" style={{ color: "#4A505B" }}>
            No direct booking link for this category yet — opens a search for this exact fare instead.
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7C838F" }}>
              Last 48 hours
            </span>
            {stats && (
              <span className="text-xs tabular-nums" style={{ color: "#7C838F" }}>
                Low {money(stats.low, item.currency)} · High {money(stats.high, item.currency)}
              </span>
            )}
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-4 text-sm"
              style={{ color: "#E2695A", backgroundColor: "rgba(226,105,90,0.08)" }}
            >
              <AlertCircle size={16} /> Couldn't load price history — {error}
            </div>
          )}

          {!error && ticks === null && (
            <div className="h-56 rounded-lg animate-pulse" style={{ backgroundColor: "#20242C" }} />
          )}

          {!error && ticks !== null && chartData.length > 1 && (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262B33" vertical={false} />
                <XAxis
                  dataKey="ts"
                  tickFormatter={shortTime}
                  stroke="#4A505B"
                  tick={{ fill: "#7C838F", fontSize: 11 }}
                  minTickGap={40}
                />
                <YAxis
                  stroke="#4A505B"
                  tick={{ fill: "#7C838F", fontSize: 11 }}
                  domain={["dataMin - 20", "dataMax + 20"]}
                  tickFormatter={(v) => `$${Math.round(v)}`}
                  width={54}
                />
                <Tooltip content={<CustomTooltip currency={item.currency} />} />
                <Area type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} fill="url(#fillPrice)" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {!error && ticks !== null && chartData.length <= 1 && (
            <div
              className="h-56 rounded-lg flex items-center justify-center text-sm"
              style={{ backgroundColor: "#20242C", color: "#7C838F" }}
            >
              Not enough history yet for this fare
            </div>
          )}
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7C838F" }}>
            Set a price alert
          </span>
          <form onSubmit={handleCreateAlert} className="flex gap-2 mt-2">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="rounded-md px-2 py-2 text-sm"
              style={{ backgroundColor: "#20242C", border: "1px solid #2A2F38", color: "#EDEDE6" }}
            >
              <option value="below">Drops below</option>
              <option value="above">Rises above</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="flex-1 rounded-md px-2 py-2 text-sm tabular-nums"
              style={{
                backgroundColor: "#20242C",
                border: "1px solid #2A2F38",
                color: "#EDEDE6",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md px-3 py-2 text-sm font-semibold shrink-0"
              style={{ backgroundColor: "#E8A33D", color: "#14171C", opacity: submitting ? 0.6 : 1 }}
            >
              Set alert
            </button>
          </form>
          <div className="text-xs mt-1.5" style={{ color: "#4A505B" }}>
            Checked automatically every time a new price comes in — no need to keep this open.
          </div>

          {alerts.length > 0 && (
            <ul className="flex flex-col gap-2 mt-4">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{
                    backgroundColor: a.triggered_at ? "rgba(232,163,61,0.1)" : "#20242C",
                    border: `1px solid ${a.triggered_at ? "#E8A33D" : "#2A2F38"}`,
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0" style={{ color: "#EDEDE6" }}>
                    {a.triggered_at ? (
                      <BellRing size={14} color="#E8A33D" className="shrink-0" />
                    ) : (
                      <Bell size={14} color="#7C838F" className="shrink-0" />
                    )}
                    <span className="truncate">
                      {a.triggered_at ? "Triggered — " : "Watching — "}
                      {a.direction === "above" ? "rises above" : "drops below"} {money(a.target_price, item.currency)}
                    </span>
                  </span>
                  <button
                    onClick={() => onDeleteAlert(a.id)}
                    aria-label="Remove alert"
                    className="shrink-0 p-1 rounded-md"
                  >
                    <Trash2 size={14} color="#7C838F" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
