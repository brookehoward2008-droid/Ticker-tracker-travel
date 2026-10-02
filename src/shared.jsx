import { useState, useEffect, useRef } from "react";
import { Radio, TrendingDown, TrendingUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Backend wiring — this talks directly to the real, live travel-price-tracker
// Supabase project. The publishable key is designed to be shipped in a client
// bundle (Row Level Security governs what it can actually touch), same as the
// original app's VITE_SUPABASE_ANON_KEY.
// ---------------------------------------------------------------------------
export const SUPABASE_URL = "https://hcraoctteurtaoyvsghu.supabase.co";
export const SUPABASE_KEY = "sb_publishable_SnWxdgd3OAZ7WquTLC34Yg_n16q1toe";

export async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.status === 204 ? null : res.json();
}

// A "live" price is one sourced from a real provider feed. Everything else —
// including the retired 'amadeus' source, if any historical rows still carry
// it — reads as simulated. (Fixes the stale === 'amadeus' check noted in the
// handoff: real sources today are 'kayak' and 'scraper'.)
export const LIVE_SOURCES = new Set(["kayak", "scraper"]);
export const isLive = (source) => LIVE_SOURCES.has(source);

export const money = (value, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

// A real, provider-issued deep link (currently only flights carry one,
// built server-side from clean IATA codes). Everything else gets an honest
// fallback: a Google search for the exact provider/name/subtitle, built
// client-side so it never guesses a slug that could 404.
export function dealLink(item) {
  if (item.deep_link) return item.deep_link;
  const query = [item.provider, item.name, item.subtitle].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// ---------------------------------------------------------------------------
// Split-flap character tile — the board's signature move. Each character of
// a price flips to its new value on update, staggered slightly by position.
// ---------------------------------------------------------------------------
export function FlapChar({ char, delay = 0, tone = "amber" }) {
  const [shown, setShown] = useState(char);
  const [flipping, setFlipping] = useState(false);
  const prev = useRef(char);

  useEffect(() => {
    if (char === prev.current) return;
    const start = setTimeout(() => {
      setFlipping(true);
      setShown(char);
    }, delay);
    const end = setTimeout(() => {
      setFlipping(false);
      prev.current = char;
    }, delay + 260);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [char, delay]);

  const toneColor = tone === "teal" ? "#4FB6A6" : tone === "coral" ? "#E2695A" : "#E8A33D";

  return (
    <span
      style={{
        display: "inline-block",
        width: char === "." || char === "," ? "0.5ch" : "1ch",
        textAlign: "center",
        perspective: "60px",
      }}
    >
      <span
        className={flipping ? "flap-flip" : ""}
        style={{
          display: "inline-block",
          transformOrigin: "top",
          color: toneColor,
        }}
      >
        {shown}
      </span>
    </span>
  );
}

export function FlapPrice({ text, tone, size = "text-3xl" }) {
  return (
    <span className={`${size} font-bold tabular-nums`} style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {text.split("").map((c, i) => (
        <FlapChar key={i} char={c} delay={i * 18} tone={tone} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
export function SourceBadge({ source }) {
  const live = isLive(source);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{
        color: live ? "#4FB6A6" : "#7C838F",
        backgroundColor: live ? "rgba(79,182,166,0.12)" : "rgba(124,131,143,0.12)",
      }}
    >
      <Radio size={10} strokeWidth={3} />
      {live ? "Live" : "Sim"}
    </span>
  );
}

export function ChangeChip({ pct }) {
  const down = pct <= 0;
  const color = down ? "#4FB6A6" : "#E2695A";
  const Icon = down ? TrendingDown : TrendingUp;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{ color, backgroundColor: down ? "rgba(79,182,166,0.12)" : "rgba(226,105,90,0.12)" }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {down ? "" : "+"}
      {pct.toFixed(1)}%
    </span>
  );
}
