import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { Star, RefreshCw, Bell, BellRing, AlertCircle, ExternalLink } from "lucide-react";
import { sb, money, dealLink, FlapPrice, SourceBadge, ChangeChip } from "./shared.jsx";

const Drawer = lazy(() => import("./Drawer.jsx"));

const clock = (d) =>
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

// ---------------------------------------------------------------------------
// Ticker marquee — the whole board scrolling by, departures-style
// ---------------------------------------------------------------------------
function Marquee({ items, onSelect }) {
  const row = (keyPrefix) => (
    <div className="flex items-center" style={{ willChange: "transform" }}>
      {items.map((it) => (
        <button
          key={`${keyPrefix}-${it.id}`}
          onClick={() => onSelect(it)}
          className="flex items-center gap-2 px-5 py-2 shrink-0"
          style={{ borderRight: "1px solid #262B33" }}
        >
          <span className="text-base">{it.category_icon}</span>
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "#EDEDE6", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {it.name}
          </span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: "#E8A33D", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {money(it.current_price, it.currency)}
          </span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: it.change_24h_pct <= 0 ? "#4FB6A6" : "#E2695A" }}
          >
            {it.change_24h_pct <= 0 ? "▾" : "▴"} {Math.abs(it.change_24h_pct).toFixed(1)}%
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="overflow-hidden border-y"
      style={{ backgroundColor: "#181B21", borderColor: "#262B33" }}
    >
      <div className="marquee-track flex">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item card
// ---------------------------------------------------------------------------
function ItemCard({ item, watched, alertCount, onToggleWatch, onOpen }) {
  const priceText = money(item.current_price, item.currency).replace("$", "$");
  const tone = item.change_24h_pct <= 0 ? "teal" : "coral";

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 cursor-pointer transition-colors"
      style={{ backgroundColor: "#1E2229", borderColor: "#2A2F38" }}
      onClick={() => onOpen(item)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color: "#7C838F" }}>
            <span>{item.category_icon}</span>
            <span>{item.category_name}</span>
            {alertCount > 0 && (
              <span className="flex items-center gap-0.5" style={{ color: "#E8A33D" }}>
                <Bell size={11} strokeWidth={2.5} />
                {alertCount}
              </span>
            )}
          </div>
          <div className="font-semibold truncate" style={{ color: "#EDEDE6" }}>
            {item.name}
          </div>
          <div className="text-xs truncate" style={{ color: "#7C838F" }}>
            {item.provider} · {item.subtitle}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatch(item.id);
          }}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          className="shrink-0 p-1 rounded-md"
        >
          <Star
            size={18}
            strokeWidth={2}
            color={watched ? "#E8A33D" : "#4A505B"}
            fill={watched ? "#E8A33D" : "none"}
          />
        </button>
      </div>

      <div className="flex items-end justify-between">
        <FlapPrice text={priceText} tone={tone} size="text-2xl" />
        <div className="flex flex-col items-end gap-1">
          <ChangeChip pct={item.change_24h_pct} />
          <SourceBadge source={item.price_source} />
        </div>
      </div>

      <a
        href={dealLink(item)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold"
        style={{ backgroundColor: "#20242C", color: "#EDEDE6", border: "1px solid #2A2F38" }}
      >
        View deal <ExternalLink size={14} />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app
// ---------------------------------------------------------------------------
export default function TravelTicker() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [alerts, setAlerts] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [openItem, setOpenItem] = useState(null);
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Session id persisted in localStorage so a returning visit keeps the
  // same watchlist rows.
  useEffect(() => {
    let id = null;
    try {
      id = window.localStorage.getItem("tt_session_id");
    } catch (e) {
      /* storage unavailable (e.g. private browsing) — fall through to a fresh in-memory id */
    }
    if (!id) {
      id = crypto.randomUUID();
      try {
        window.localStorage.setItem("tt_session_id", id);
      } catch (e) {
        /* ignore — watchlist still works for this page view */
      }
    }
    setSessionId(id);
  }, []);

  const loadTicker = useCallback(async (isBackground) => {
    if (isBackground) setRefreshing(true);
    try {
      const [cats, rows] = await Promise.all([
        sb("categories?select=*&order=sort_order"),
        sb("v_ticker?select=*&order=category_name.asc,name.asc"),
      ]);
      setCategories(cats);
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTicker(false);
    const t = setInterval(() => loadTicker(true), 45000);
    return () => clearInterval(t);
  }, [loadTicker]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAlerts = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const rows = await sb(`alerts?session_id=eq.${sid}&select=*&order=created_at.desc`);
      setAlerts(rows);
    } catch (e) {
      /* non-fatal — alerts panel just stays at its last known state */
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    sb(`watchlist?session_id=eq.${sessionId}&select=item_id`)
      .then((rows) => setWatchedIds(new Set(rows.map((r) => r.item_id))))
      .catch(() => {});
    loadAlerts(sessionId);
  }, [sessionId, loadAlerts]);

  // Alerts are evaluated server-side (a trigger on price_ticks flips
  // triggered_at the instant a matching price lands), so this just needs to
  // poll to reflect that — no client-side comparison logic required.
  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => loadAlerts(sessionId), 45000);
    return () => clearInterval(t);
  }, [sessionId, loadAlerts]);

  const createAlert = useCallback(
    async (itemId, direction, targetPrice) => {
      if (!sessionId) return;
      await sb("alerts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ session_id: sessionId, item_id: itemId, direction, target_price: targetPrice }),
      });
      await loadAlerts(sessionId);
    },
    [sessionId, loadAlerts]
  );

  const deleteAlert = useCallback(
    async (alertId) => {
      await sb(`alerts?id=eq.${alertId}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    },
    []
  );

  const toggleWatch = useCallback(
    async (itemId) => {
      if (!sessionId) return;
      const nowWatching = watchedIds.has(itemId);
      setWatchedIds((prev) => {
        const next = new Set(prev);
        nowWatching ? next.delete(itemId) : next.add(itemId);
        return next;
      });
      try {
        if (nowWatching) {
          await sb(`watchlist?session_id=eq.${sessionId}&item_id=eq.${itemId}`, { method: "DELETE" });
        } else {
          await sb("watchlist", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ session_id: sessionId, item_id: itemId }),
          });
        }
      } catch (e) {
        // roll back optimistic update on failure
        setWatchedIds((prev) => {
          const next = new Set(prev);
          nowWatching ? next.add(itemId) : next.delete(itemId);
          return next;
        });
      }
    },
    [sessionId, watchedIds]
  );

  const alertsByItem = useMemo(() => {
    const map = new Map();
    for (const a of alerts) {
      const list = map.get(a.item_id) ?? [];
      list.push(a);
      map.set(a.item_id, list);
    }
    return map;
  }, [alerts]);

  const triggeredCount = useMemo(() => alerts.filter((a) => a.triggered_at).length, [alerts]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((it) => {
      if (selectedCategory !== "all" && it.category_slug !== selectedCategory) return false;
      if (watchlistOnly && !watchedIds.has(it.id)) return false;
      return true;
    });
  }, [items, selectedCategory, watchlistOnly, watchedIds]);

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "#14171C", fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@800;900&family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes flapFlip {
          0%   { transform: rotateX(0deg);   opacity: 1; }
          45%  { transform: rotateX(-90deg); opacity: 0.3; }
          55%  { transform: rotateX(-90deg); opacity: 0.3; }
          100% { transform: rotateX(0deg);   opacity: 1; }
        }
        .flap-flip { animation: flapFlip 0.26s ease-in-out; }
        .marquee-track {
          animation: marqueeScroll 55s linear infinite;
        }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes marqueeScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .flap-flip, .marquee-track { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: "#14171C", borderBottom: "1px solid #262B33" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center font-black text-lg"
              style={{ backgroundColor: "#E8A33D", color: "#14171C" }}
            >
              ✈
            </div>
            <div>
              <div
                className="text-lg font-black tracking-tight leading-none"
                style={{ color: "#EDEDE6", fontFamily: "'Archivo', sans-serif" }}
              >
                TRAVELTICKER
              </div>
              <div className="text-xs" style={{ color: "#7C838F" }}>
                Live &amp; simulated fares, updating on their own
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {triggeredCount > 0 && (
              <span
                className="hidden sm:flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: "rgba(232,163,61,0.12)", color: "#E8A33D" }}
              >
                <BellRing size={12} />
                {triggeredCount} triggered
              </span>
            )}
            <span
              className="hidden sm:inline text-sm tabular-nums"
              style={{ color: "#7C838F", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {clock(now)}
            </span>
            <button
              onClick={() => loadTicker(true)}
              className="p-2 rounded-md"
              style={{ backgroundColor: "#1E2229", border: "1px solid #2A2F38" }}
              aria-label="Refresh now"
            >
              <RefreshCw size={16} color="#7C838F" className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* Marquee */}
      {items && items.length > 0 && <Marquee items={items} onSelect={setOpenItem} />}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className="rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{
              backgroundColor: selectedCategory === "all" ? "#E8A33D" : "#1E2229",
              color: selectedCategory === "all" ? "#14171C" : "#EDEDE6",
              border: "1px solid #2A2F38",
            }}
          >
            All fares
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.slug)}
              className="rounded-full px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5"
              style={{
                backgroundColor: selectedCategory === c.slug ? "#E8A33D" : "#1E2229",
                color: selectedCategory === c.slug ? "#14171C" : "#EDEDE6",
                border: "1px solid #2A2F38",
              }}
            >
              <span>{c.icon}</span>
              {c.name}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setWatchlistOnly((v) => !v)}
            className="rounded-full px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5"
            style={{
              backgroundColor: watchlistOnly ? "rgba(232,163,61,0.12)" : "#1E2229",
              color: watchlistOnly ? "#E8A33D" : "#EDEDE6",
              border: `1px solid ${watchlistOnly ? "#E8A33D" : "#2A2F38"}`,
            }}
          >
            <Star size={14} fill={watchlistOnly ? "#E8A33D" : "none"} />
            Watchlist ({watchedIds.size})
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div
            className="flex flex-col items-center gap-3 rounded-xl px-6 py-10 text-center"
            style={{ backgroundColor: "#1E2229", border: "1px solid #2A2F38" }}
          >
            <AlertCircle size={28} color="#E2695A" />
            <div style={{ color: "#EDEDE6" }} className="font-semibold">
              Board's dark. Couldn't reach live prices.
            </div>
            <div className="text-sm" style={{ color: "#7C838F" }}>
              {error}
            </div>
            <button
              onClick={() => loadTicker(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: "#E8A33D", color: "#14171C" }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {!error && loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-xl animate-pulse"
                style={{ backgroundColor: "#1E2229", border: "1px solid #2A2F38" }}
              />
            ))}
          </div>
        )}

        {/* Empty watchlist state */}
        {!error && !loading && watchlistOnly && filtered.length === 0 && (
          <div
            className="flex flex-col items-center gap-2 rounded-xl px-6 py-14 text-center"
            style={{ backgroundColor: "#1E2229", border: "1px solid #2A2F38" }}
          >
            <Star size={26} color="#4A505B" />
            <div style={{ color: "#EDEDE6" }} className="font-semibold">
              Nothing pinned to your board yet
            </div>
            <div className="text-sm max-w-xs" style={{ color: "#7C838F" }}>
              Tap the star on any fare to watch it here.
            </div>
          </div>
        )}

        {/* Cards */}
        {!error && !loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                watched={watchedIds.has(it.id)}
                alertCount={(alertsByItem.get(it.id) ?? []).filter((a) => a.active).length}
                onToggleWatch={toggleWatch}
                onOpen={setOpenItem}
              />
            ))}
          </div>
        )}

        <div className="text-center text-xs pt-2" style={{ color: "#4A505B" }}>
          {items ? `${items.length} fares tracked across ${categories.length} categories` : ""} · prices refresh
          automatically
        </div>
      </main>

      {openItem && (
        <Suspense fallback={null}>
          <Drawer
            key={openItem.id}
            item={items.find((it) => it.id === openItem.id) || openItem}
            watched={watchedIds.has(openItem.id)}
            alerts={alertsByItem.get(openItem.id) ?? []}
            onToggleWatch={toggleWatch}
            onCreateAlert={createAlert}
            onDeleteAlert={deleteAlert}
            onClose={() => setOpenItem(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
