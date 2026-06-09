import { useState, useEffect, useCallback } from "react";

// ─── MOCK DATA ENGINE (replace with real API calls in production) ───────────
const EVENT_UNIVERSE = [
  { symbol: "TCS", name: "Tata Consultancy", sector: "IT", event: "Q4 Results", eventDate: "2025-04-10", exchange: "NSE" },
  { symbol: "INFY", name: "Infosys", sector: "IT", event: "Q4 Results", eventDate: "2025-04-17", exchange: "NSE" },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking", event: "Q4 Results", eventDate: "2025-04-19", exchange: "NSE" },
  { symbol: "WIPRO", name: "Wipro Ltd", sector: "IT", event: "Q4 Results", eventDate: "2025-04-23", exchange: "NSE" },
  { symbol: "RELIANCE", name: "Reliance Ind", sector: "Oil & Gas", event: "Q4 Results", eventDate: "2025-04-25", exchange: "NSE" },
  { symbol: "AXISBANK", name: "Axis Bank", sector: "Banking", event: "Board Meeting", eventDate: "2025-04-22", exchange: "NSE" },
];

const generateDailySnapshot = (symbol, daysAgo) => {
  const seed = symbol.charCodeAt(0) + daysAgo;
  const rand = (min, max, s = 0) => min + ((seed * 7 + s * 13) % (max - min));
  const fiiNet = rand(-800, 1200, daysAgo) * 1.5;
  const diiNet = rand(-400, 900, daysAgo + 1) * 1.2;
  const pcr = 0.8 + (rand(0, 40, daysAgo + 2) / 100);
  const delivPct = 40 + rand(0, 30, daysAgo + 3);
  const oiChg = rand(-5, 15, daysAgo + 4);
  const revenue = rand(28000, 34000, daysAgo + 5);
  const pat = rand(9000, 12000, daysAgo + 6);
  const eps = rand(22, 32, daysAgo + 7);
  return {
    date: new Date(Date.now() - daysAgo * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    fiiNet: Math.round(fiiNet),
    diiNet: Math.round(diiNet),
    pcr: +pcr.toFixed(2),
    delivPct: Math.round(delivPct),
    oiChg: Math.round(oiChg),
    revenue,
    pat,
    eps,
    institutionalBias: fiiNet + diiNet > 500 ? "bullish" : fiiNet + diiNet < -300 ? "bearish" : "neutral",
  };
};

const buildStockProfile = (stock) => {
  const today = new Date();
  const eventDate = new Date(stock.eventDate);
  const daysToEvent = Math.ceil((eventDate - today) / 86400000);
  const history = Array.from({ length: 15 }, (_, i) => generateDailySnapshot(stock.symbol, i)).reverse();
  const seed = stock.symbol.charCodeAt(0);
  const price = 1000 + (seed * 17) % 3000;
  const bullishDays = history.filter(d => d.institutionalBias === "bullish").length;
  const avgFii = history.reduce((s, d) => s + d.fiiNet, 0) / history.length;
  const avgDii = history.reduce((s, d) => s + d.diiNet, 0) / history.length;
  const avgPcr = history.reduce((s, d) => s + d.pcr, 0) / history.length;
  const avgDeliv = history.reduce((s, d) => s + d.delivPct, 0) / history.length;
  const lastRev = history[history.length - 1].revenue;
  const prevRev = history[0].revenue;
  const revenueGrowth = +((lastRev - prevRev) / prevRev * 100).toFixed(1);
  const fiiTrend = avgFii > 400 ? 22 : avgFii > 0 ? 14 : 5;
  const diiTrend = avgDii > 300 ? 18 : avgDii > 0 ? 10 : 3;
  const oiScore = avgPcr > 1.1 ? 18 : avgPcr > 0.9 ? 12 : 5;
  const delivScore = avgDeliv > 55 ? 16 : avgDeliv > 45 ? 10 : 4;
  const fundamentalScore = revenueGrowth > 5 ? 16 : revenueGrowth > 0 ? 10 : 4;
  const totalScore = fiiTrend + diiTrend + oiScore + delivScore + fundamentalScore;
  const convictionTrend = history.map((d, i) => {
    const partial = history.slice(0, i + 1);
    const avg = partial.reduce((s, x) => s + (x.fiiNet + x.diiNet), 0) / partial.length;
    return Math.min(100, Math.max(10, 40 + avg / 50));
  });
  const convictionNow = convictionTrend[convictionTrend.length - 1];
  const convictionWeekAgo = convictionTrend[convictionTrend.length - 8] || convictionTrend[0];
  const signal = totalScore >= 70 ? "BUY" : totalScore >= 50 ? "WATCH" : "AVOID";
  const signalColor = signal === "BUY" ? "#00ff88" : signal === "WATCH" ? "#ffd700" : "#f85149";
  return {
    ...stock, price: Math.round(price), daysToEvent, history, totalScore,
    avgFii: Math.round(avgFii), avgDii: Math.round(avgDii),
    avgPcr: +avgPcr.toFixed(2), avgDeliv: Math.round(avgDeliv),
    revenueGrowth, convictionTrend, convictionNow: Math.round(convictionNow),
    convictionWeekAgo: Math.round(convictionWeekAgo),
    convictionDelta: Math.round(convictionNow - convictionWeekAgo),
    signal, signalColor, bullishDays,
    scores: { fiiTrend, diiTrend, oiScore, delivScore, fundamentalScore },
    latest: history[history.length - 1],
  };
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const MiniSparkline = ({ data, color, height = 32 }) => {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const w = 80, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
      <circle cx={(data.length - 1) / (data.length - 1) * w} cy={h - ((data[data.length - 1] - min) / range) * h} r="2.5" fill={color} />
    </svg>
  );
};

const Pill = ({ v, color }) => (
  <span style={{ background: color + "18", color, border: `1px solid ${color}33`, padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{v}</span>
);

const DayBar = ({ label, fii, dii, pcr, deliv, bias }) => {
  const bcolor = bias === "bullish" ? "#00ff88" : bias === "bearish" ? "#f85149" : "#ffd700";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 44px 44px 10px", gap: 6, alignItems: "center", padding: "5px 0", borderBottom: "1px solid #0a0f18", fontSize: 11 }}>
      <span style={{ color: "#444" }}>{label}</span>
      <span style={{ color: fii > 0 ? "#00ff88" : "#f85149", fontWeight: 700 }}>{fii > 0 ? "+" : ""}{(fii / 100).toFixed(0)}Cr</span>
      <span style={{ color: dii > 0 ? "#58a6ff" : "#f85149", fontWeight: 700 }}>{dii > 0 ? "+" : ""}{(dii / 100).toFixed(0)}Cr</span>
      <span style={{ color: pcr > 1 ? "#00ff88" : "#f85149" }}>{pcr}</span>
      <span style={{ color: deliv > 50 ? "#00ff88" : "#888" }}>{deliv}%</span>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: bcolor }} />
    </div>
  );
};

// ─── AI ANALYSIS ENGINE ───────────────────────────────────────────────────────
const analyzeWithClaude = async (stock) => {
  const prompt = `You are an institutional equity analyst. Analyze this stock data and give a concise assessment.

STOCK: ${stock.symbol} — ${stock.name} (${stock.sector})
EVENT: ${stock.event} in ${stock.daysToEvent} days (${stock.eventDate})
CURRENT PRICE: ₹${stock.price}

15-DAY DATA SUMMARY:
- Average FII Net Flow: ₹${stock.avgFii} Cr/day (${stock.avgFii > 0 ? "NET BUYING" : "NET SELLING"})
- Average DII Net Flow: ₹${stock.avgDii} Cr/day (${stock.avgDii > 0 ? "NET BUYING" : "NET SELLING"})
- Average PCR (Put-Call Ratio): ${stock.avgPcr} (${stock.avgPcr > 1 ? "Bullish — put writing dominant" : "Bearish — call writing dominant"})
- Average Delivery %: ${stock.avgDeliv}% (${stock.avgDeliv > 50 ? "Strong delivery — institutional conviction" : "Low delivery — speculative"})
- Revenue Growth Trend: ${stock.revenueGrowth}% (estimated from flow data)
- Bullish days (FII+DII net positive): ${stock.bullishDays}/15 days
- Conviction Score: ${stock.convictionNow}/100 (was ${stock.convictionWeekAgo}/100 a week ago, delta: ${stock.convictionDelta > 0 ? "+" : ""}${stock.convictionDelta})
- Overall Score: ${stock.totalScore}/90

SCORING BREAKDOWN:
- FII Flow Score: ${stock.scores.fiiTrend}/25
- DII Flow Score: ${stock.scores.diiTrend}/20
- OI/PCR Score: ${stock.scores.oiScore}/20
- Delivery Score: ${stock.scores.delivScore}/15
- Fundamental Score: ${stock.scores.fundamentalScore}/10

Respond ONLY with a JSON object, no markdown, no explanation outside JSON:
{
  "summary": "2-sentence institutional view on what smart money is doing",
  "fundamental_view": "1-2 sentences on fundamental strength/weakness based on delivery % and revenue trend",
  "fii_dii_insight": "1 sentence on FII vs DII behavior and what it signals",
  "oi_insight": "1 sentence on PCR and what options market implies",
  "conviction_trend": "1 sentence on whether conviction is building or fading over the week",
  "pre_event_strategy": "2 sentences — what to do 7-10 days before event and why",
  "risk_factor": "1 sentence on the biggest risk to this thesis",
  "institutional_verdict": "BUY / WATCH / AVOID",
  "target_entry_window": "X-Y days before event",
  "confidence_pct": 0
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw = data.content.map(b => b.text || "").join("");
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function EventMonitor() {
  const [stocks] = useState(() => EVENT_UNIVERSE.map(buildStockProfile).sort((a, b) => a.daysToEvent - b.daysToEvent));
  const [selected, setSelected] = useState(stocks[0]);
  const [activeTab, setActiveTab] = useState("daily");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState({});

  const runAnalysis = useCallback(async (stock) => {
    if (analyzed[stock.symbol]) { setAnalysis(analyzed[stock.symbol]); return; }
    setLoading(true); setAnalysis(null);
    const result = await analyzeWithClaude(stock);
    setAnalysis(result);
    setAnalyzed(prev => ({ ...prev, [stock.symbol]: result }));
    setLoading(false);
  }, [analyzed]);

  const selectStock = (s) => { setSelected(s); setActiveTab("daily"); setAnalysis(null); };

  const daysColor = (d) => d <= 5 ? "#f85149" : d <= 10 ? "#ffd700" : "#58a6ff";

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "#04080f", minHeight: "100vh", color: "#b0bec5", display: "flex", flexDirection: "column" }}>

      {/* TOP NAV */}
      <div style={{ background: "#060d18", borderBottom: "1px solid #0e1e2e", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 11, color: "#58a6ff", letterSpacing: 3, fontWeight: 800 }}>◈ EVENT RADAR</div>
        <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 2 }}>INSTITUTIONAL MONITOR</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#00ff88" }}>LIVE TRACKING {stocks.length} STOCKS</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .stock-row:hover { background: #0a1420 !important; }
        .tab-btn:hover { color: #58a6ff !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #04080f; }
        ::-webkit-scrollbar-thumb { background: #1e2d3d; border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 48px)" }}>

        {/* LEFT — STOCK LIST */}
        <div style={{ width: 220, background: "#060d18", borderRight: "1px solid #0e1e2e", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "10px 12px 6px", fontSize: 9, color: "#1e3a5f", letterSpacing: 2, borderBottom: "1px solid #0a1420" }}>
            EVENTS NEXT 20 DAYS
          </div>
          {stocks.map(s => (
            <div key={s.symbol} className="stock-row"
              onClick={() => selectStock(s)}
              style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #0a1420", background: selected.symbol === s.symbol ? "#0a1a2e" : "transparent", borderLeft: selected.symbol === s.symbol ? `2px solid ${s.signalColor}` : "2px solid transparent", transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: selected.symbol === s.symbol ? "#fff" : "#8899aa" }}>{s.symbol}</span>
                <Pill v={s.signal} color={s.signalColor} />
              </div>
              <div style={{ fontSize: 9, color: "#3a5068", marginBottom: 6 }}>{s.event}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: daysColor(s.daysToEvent), fontWeight: 700 }}>{s.daysToEvent}D LEFT</span>
                <MiniSparkline data={s.convictionTrend} color={s.signalColor} height={20} />
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT — DETAIL */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* STOCK HEADER */}
          <div style={{ background: "#060d18", borderBottom: "1px solid #0e1e2e", padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>{selected.symbol}</span>
                  <Pill v={selected.sector} color="#58a6ff" />
                  <Pill v={selected.signal} color={selected.signalColor} />
                </div>
                <div style={{ fontSize: 11, color: "#3a5068", marginTop: 2 }}>{selected.name} • {selected.event}</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>₹{selected.price.toLocaleString()}</div>
                <div style={{ fontSize: 9, color: "#3a5068" }}>LAST PRICE</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: daysColor(selected.daysToEvent) }}>{selected.daysToEvent}</div>
                <div style={{ fontSize: 9, color: "#3a5068" }}>DAYS TO EVENT</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: selected.convictionDelta >= 0 ? "#00ff88" : "#f85149" }}>
                  {selected.convictionDelta >= 0 ? "▲" : "▼"}{Math.abs(selected.convictionDelta)}
                </div>
                <div style={{ fontSize: 9, color: "#3a5068" }}>CONVICTION ΔWEEK</div>
              </div>
            </div>

            {/* SCORE PILLS ROW */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {[
                { label: "FII FLOW", val: selected.scores.fiiTrend, max: 25, color: "#00ff88" },
                { label: "DII FLOW", val: selected.scores.diiTrend, max: 20, color: "#58a6ff" },
                { label: "OI/PCR", val: selected.scores.oiScore, max: 20, color: "#ffd700" },
                { label: "DELIVERY", val: selected.scores.delivScore, max: 15, color: "#ff9500" },
                { label: "FUNDAMENTAL", val: selected.scores.fundamentalScore, max: 10, color: "#bf5af2" },
              ].map(({ label, val, max, color }) => (
                <div key={label} style={{ background: "#0a1420", border: `1px solid ${color}22`, borderRadius: 6, padding: "5px 10px", minWidth: 80 }}>
                  <div style={{ fontSize: 8, color: "#3a5068", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color }}>{val}</span>
                    <span style={{ fontSize: 9, color: "#3a5068" }}>/{max}</span>
                  </div>
                  <div style={{ height: 2, background: "#0e1e2e", borderRadius: 1, marginTop: 3 }}>
                    <div style={{ width: `${(val / max) * 100}%`, height: "100%", background: color, borderRadius: 1 }} />
                  </div>
                </div>
              ))}
              <div style={{ background: "#0a1a2e", border: `1px solid ${selected.signalColor}44`, borderRadius: 6, padding: "5px 14px", marginLeft: "auto" }}>
                <div style={{ fontSize: 8, color: "#3a5068", letterSpacing: 1, marginBottom: 2 }}>TOTAL SCORE</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: selected.signalColor }}>{selected.totalScore}<span style={{ fontSize: 10, color: "#3a5068" }}>/90</span></div>
              </div>
            </div>
          </div>

          {/* TABS */}
          <div style={{ background: "#060d18", borderBottom: "1px solid #0e1e2e", display: "flex", padding: "0 16px" }}>
            {[
              { id: "daily", label: "📊 Daily Data" },
              { id: "conviction", label: "📈 Conviction" },
              { id: "fundamental", label: "🏦 Fundamental" },
              { id: "ai", label: "🤖 AI Analysis" },
            ].map(t => (
              <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)}
                style={{ background: "none", border: "none", borderBottom: activeTab === t.id ? `2px solid #58a6ff` : "2px solid transparent", color: activeTab === t.id ? "#58a6ff" : "#3a5068", padding: "8px 14px", cursor: "pointer", fontSize: 10, fontWeight: 800, letterSpacing: 1, transition: "color 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB BODY */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, animation: "fadeIn 0.3s ease" }}>

            {/* ── DAILY DATA TAB ── */}
            {activeTab === "daily" && (
              <div>
                <div style={{ background: "#060d18", border: "1px solid #0e1e2e", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 44px 44px 10px", gap: 6, padding: "4px 0 8px", borderBottom: "1px solid #0e1e2e", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1 }}>DATE</span>
                    <span style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1 }}>FII NET</span>
                    <span style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1 }}>DII NET</span>
                    <span style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1 }}>PCR</span>
                    <span style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1 }}>DELIV%</span>
                    <span style={{ fontSize: 9, color: "#1e3a5f" }}>●</span>
                  </div>
                  {selected.history.map((d, i) => (
                    <DayBar key={i} label={d.date} fii={d.fiiNet} dii={d.diiNet} pcr={d.pcr} deliv={d.delivPct} bias={d.institutionalBias} />
                  ))}
                </div>

                {/* 15-day averages */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "15D AVG FII NET", value: `${selected.avgFii > 0 ? "+" : ""}${(selected.avgFii / 100).toFixed(0)} Cr/day`, color: selected.avgFii > 0 ? "#00ff88" : "#f85149", sub: selected.avgFii > 0 ? "Net accumulation" : "Net distribution" },
                    { label: "15D AVG DII NET", value: `${selected.avgDii > 0 ? "+" : ""}${(selected.avgDii / 100).toFixed(0)} Cr/day`, color: selected.avgDii > 0 ? "#58a6ff" : "#f85149", sub: selected.avgDii > 0 ? "DII supporting" : "DII selling" },
                    { label: "AVG PCR (15D)", value: selected.avgPcr, color: selected.avgPcr > 1 ? "#00ff88" : "#f85149", sub: selected.avgPcr > 1.1 ? "Strongly bullish OI" : selected.avgPcr > 0.9 ? "Neutral OI" : "Bearish OI" },
                    { label: "AVG DELIVERY %", value: `${selected.avgDeliv}%`, color: selected.avgDeliv > 55 ? "#00ff88" : selected.avgDeliv > 45 ? "#ffd700" : "#f85149", sub: selected.avgDeliv > 55 ? "Institutional delivery" : selected.avgDeliv > 45 ? "Mixed delivery" : "Speculative" },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} style={{ background: "#060d18", border: "1px solid #0e1e2e", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
                      <div style={{ fontSize: 9, color: "#3a5068", marginTop: 2 }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CONVICTION TAB ── */}
            {activeTab === "conviction" && (
              <div>
                <div style={{ background: "#060d18", border: "1px solid #0e1e2e", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 2, marginBottom: 12 }}>CONVICTION BUILDUP — 15 DAY TREND</div>
                  <div style={{ position: "relative", height: 120 }}>
                    <svg width="100%" height="120" viewBox="0 0 400 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={selected.signalColor} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={selected.signalColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      {[25, 50, 75].map(y => (
                        <line key={y} x1="0" y1={120 - y * 1.2} x2="400" y2={120 - y * 1.2} stroke="#0a1420" strokeWidth="1" />
                      ))}
                      {/* Area fill */}
                      <polygon
                        fill="url(#convGrad)"
                        points={`0,120 ${selected.convictionTrend.map((v, i) => `${(i / (selected.convictionTrend.length - 1)) * 400},${120 - v * 1.2}`).join(" ")} 400,120`}
                      />
                      {/* Line */}
                      <polyline
                        fill="none" stroke={selected.signalColor} strokeWidth="2"
                        points={selected.convictionTrend.map((v, i) => `${(i / (selected.convictionTrend.length - 1)) * 400},${120 - v * 1.2}`).join(" ")}
                      />
                      {/* 7-day marker */}
                      <line x1="240" y1="0" x2="240" y2="120" stroke="#ffd700" strokeWidth="1" strokeDasharray="3,3" />
                      <text x="244" y="12" fill="#ffd700" fontSize="8">7D AGO</text>
                    </svg>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 9, color: "#1e3a5f" }}>15 DAYS AGO</span>
                    <span style={{ fontSize: 9, color: "#1e3a5f" }}>TODAY</span>
                  </div>
                </div>

                {/* Conviction stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "NOW", value: selected.convictionNow, color: selected.signalColor },
                    { label: "1 WEEK AGO", value: selected.convictionWeekAgo, color: "#888" },
                    { label: "WEEKLY CHANGE", value: `${selected.convictionDelta >= 0 ? "+" : ""}${selected.convictionDelta}`, color: selected.convictionDelta >= 0 ? "#00ff88" : "#f85149" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "#060d18", border: "1px solid #0e1e2e", borderRadius: 8, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Signal recommendation */}
                <div style={{ background: `linear-gradient(135deg, ${selected.signalColor}08, transparent)`, border: `1px solid ${selected.signalColor}33`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 9, color: selected.signalColor, letterSpacing: 2, marginBottom: 8 }}>📍 ENTRY WINDOW RECOMMENDATION</div>
                  {selected.daysToEvent <= 7 ? (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                        {selected.signal === "BUY" ? "✅ ACTIVE WINDOW — Enter Now" : selected.signal === "WATCH" ? "👀 Monitoring — Wait for confirmation" : "⛔ Avoid — Insufficient conviction"}
                      </div>
                      <div style={{ fontSize: 11, color: "#5a7a9a" }}>
                        {selected.daysToEvent} days to event — {selected.signal === "BUY" ? "Institutions likely positioned. Price movement should begin. Risk/reward favorable." : "Data mixed. Wait for FII/DII alignment before entry."}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#ffd700", marginBottom: 4 }}>🕐 ACCUMULATION PHASE — {selected.daysToEvent - 7} days until active window</div>
                      <div style={{ fontSize: 11, color: "#5a7a9a" }}>Continue monitoring daily FII/DII data. Entry window opens at T-7. Current conviction: {selected.convictionNow}/100</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── FUNDAMENTAL TAB ── */}
            {activeTab === "fundamental" && (
              <div>
                <div style={{ background: "#060d18", border: "1px solid #0e1e2e", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 2, marginBottom: 12 }}>INSTITUTIONAL DATA FOCUS — WHY FUNDAMENTALS MATTER MORE</div>
                  <div style={{ fontSize: 11, color: "#5a7a9a", lineHeight: 1.8, borderLeft: "2px solid #58a6ff", paddingLeft: 12 }}>
                    Institutions build positions based on fundamental conviction — revenue visibility, margin trajectory, order book growth, management guidance. Technical charts are just their footprint. <span style={{ color: "#fff" }}>We track their footprint (FII/DII/OI) to mirror their fundamental bets.</span>
                  </div>
                </div>

                {/* Key fundamental metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "REVENUE TREND", value: `${selected.revenueGrowth > 0 ? "+" : ""}${selected.revenueGrowth}%`, sub: "15-day proxy (delivery × flow)", color: selected.revenueGrowth > 5 ? "#00ff88" : selected.revenueGrowth > 0 ? "#ffd700" : "#f85149" },
                    { label: "DELIVERY % (15D AVG)", value: `${selected.avgDeliv}%`, sub: "High delivery = fundamental buying", color: selected.avgDeliv > 55 ? "#00ff88" : "#ffd700" },
                    { label: "BULLISH SESSIONS", value: `${selected.bullishDays}/15`, sub: "Days with net inst. buying", color: selected.bullishDays >= 10 ? "#00ff88" : selected.bullishDays >= 7 ? "#ffd700" : "#f85149" },
                    { label: "SMART MONEY FLOW", value: `${((selected.avgFii + selected.avgDii) / 100).toFixed(0)} Cr`, sub: "Combined FII+DII net/day", color: (selected.avgFii + selected.avgDii) > 0 ? "#00ff88" : "#f85149" },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} style={{ background: "#060d18", border: "1px solid #0e1e2e", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
                      <div style={{ fontSize: 9, color: "#3a5068", marginTop: 2 }}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* What to look for pre-event */}
                <div style={{ background: "#060d18", border: "1px solid #ffd70033", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 10 }}>📋 PRE-EVENT FUNDAMENTAL CHECKLIST</div>
                  {[
                    { check: selected.avgDeliv > 50, label: "Delivery % consistently above 50% (institutional accumulation)" },
                    { check: selected.bullishDays >= 8, label: "8+ bullish sessions in last 15 days (sustained smart money interest)" },
                    { check: selected.avgFii > 0, label: "FII net buyer over 15 days (foreign capital conviction)" },
                    { check: selected.avgDii > 0, label: "DII net buyer over 15 days (domestic institution support)" },
                    { check: selected.avgPcr > 0.9, label: "PCR above 0.9 (options market pricing upside / put writing)" },
                    { check: selected.revenueGrowth > 3, label: "Revenue trend positive (fundamental case intact)" },
                    { check: selected.convictionDelta >= 0, label: "Conviction rising week-over-week (momentum building)" },
                    { check: selected.totalScore >= 60, label: "Overall score above 60 (multi-factor confluence)" },
                  ].map(({ check, label }) => (
                    <div key={label} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "1px solid #0a1420", fontSize: 11 }}>
                      <span style={{ color: check ? "#00ff88" : "#f85149", fontWeight: 800, minWidth: 14 }}>{check ? "✓" : "✗"}</span>
                      <span style={{ color: check ? "#8899aa" : "#3a5068" }}>{label}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, fontSize: 11, color: "#5a7a9a" }}>
                    Checklist score: <span style={{ color: "#fff", fontWeight: 700 }}>
                      {[selected.avgDeliv > 50, selected.bullishDays >= 8, selected.avgFii > 0, selected.avgDii > 0, selected.avgPcr > 0.9, selected.revenueGrowth > 3, selected.convictionDelta >= 0, selected.totalScore >= 60].filter(Boolean).length}/8
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── AI ANALYSIS TAB ── */}
            {activeTab === "ai" && (
              <div>
                {!analysis && !loading && (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                    <div style={{ fontSize: 12, color: "#5a7a9a", marginBottom: 20 }}>Run institutional AI analysis on {selected.symbol} using all 15-day data</div>
                    <button onClick={() => runAnalysis(selected)}
                      style={{ background: "#0a1a2e", border: "1px solid #58a6ff", color: "#58a6ff", padding: "10px 28px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>
                      ◈ ANALYZE {selected.symbol}
                    </button>
                  </div>
                )}
                {loading && (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 11, color: "#58a6ff", letterSpacing: 3, animation: "pulse 1.5s infinite" }}>PROCESSING INSTITUTIONAL DATA...</div>
                    <div style={{ fontSize: 10, color: "#1e3a5f", marginTop: 8 }}>Analyzing FII/DII flows, OI patterns, fundamental signals</div>
                  </div>
                )}
                {analysis && (
                  <div style={{ animation: "fadeIn 0.4s ease" }}>
                    {/* Verdict banner */}
                    <div style={{ background: `linear-gradient(135deg, ${selected.signalColor}10, transparent)`, border: `1px solid ${selected.signalColor}44`, borderRadius: 8, padding: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, color: "#3a5068", letterSpacing: 2 }}>AI INSTITUTIONAL VERDICT</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: selected.signalColor, marginTop: 2 }}>{analysis.institutional_verdict}</div>
                        <div style={{ fontSize: 10, color: "#3a5068" }}>Entry window: {analysis.target_entry_window}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: selected.signalColor }}>{analysis.confidence_pct}%</div>
                        <div style={{ fontSize: 9, color: "#3a5068" }}>CONFIDENCE</div>
                      </div>
                    </div>

                    {/* Analysis sections */}
                    {[
                      { icon: "🏛️", label: "INSTITUTIONAL SUMMARY", key: "summary", color: "#58a6ff" },
                      { icon: "🏦", label: "FUNDAMENTAL VIEW", key: "fundamental_view", color: "#00ff88" },
                      { icon: "💰", label: "FII vs DII INSIGHT", key: "fii_dii_insight", color: "#ffd700" },
                      { icon: "📊", label: "OPTIONS MARKET SIGNAL", key: "oi_insight", color: "#ff9500" },
                      { icon: "📈", label: "CONVICTION TREND", key: "conviction_trend", color: "#bf5af2" },
                      { icon: "🎯", label: "PRE-EVENT STRATEGY", key: "pre_event_strategy", color: "#00ff88" },
                      { icon: "⚠️", label: "KEY RISK FACTOR", key: "risk_factor", color: "#f85149" },
                    ].map(({ icon, label, key, color }) => (
                      <div key={key} style={{ background: "#060d18", border: "1px solid #0e1e2e", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: color, letterSpacing: 2, marginBottom: 6 }}>{icon} {label}</div>
                        <div style={{ fontSize: 11, color: "#8899aa", lineHeight: 1.7 }}>{analysis[key]}</div>
                      </div>
                    ))}

                    <button onClick={() => { setAnalysis(null); setAnalyzed(prev => ({ ...prev, [selected.symbol]: null })); }}
                      style={{ background: "transparent", border: "1px solid #1e2d3d", color: "#3a5068", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 10, marginTop: 4 }}>
                      ↺ Re-analyze
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
