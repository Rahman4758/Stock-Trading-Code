"use client"

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from "recharts";

// ── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:4000/api/v1";
const INITIAL_CAPITAL = 500000;

// ── COMPONENTS ─────────────────────────────────────────────────────────────────

const Badge = ({ label, color, bg }: { label: string, color: string, bg: string }) => (
  <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, border: `1px solid ${color}33` }}>
    {label}
  </span>
);

const StatCard = ({ label, value, sub, color = "#00e5a0", small = false }: any) => (
  <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: small ? "10px 14px" : "14px 16px" }}>
    <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 1.5, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
    <div style={{ fontSize: small ? 18 : 24, fontWeight: 900, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: "#3a5570", marginTop: 3 }}>{sub}</div>}
  </div>
);

// Trade Analysis Modal
const AnalysisModal = ({ trade, onClose }: any) => {
  if (!trade) return null;
  const isWin = trade.total_pnl > 0 || trade.unrealized_pnl > 0;
  const isOpen = trade.status === "OPEN";
  const pnlColor = (trade.total_pnl || trade.unrealized_pnl) >= 0 ? "#00e5a0" : "#ff4d4d";

  // Calculate targets relative to entry for simple display if not explicitly stored
  const t1 = trade.t1_price || trade.entry_price * 1.02;
  const t2 = trade.t2_price || trade.entry_price * 1.05;
  const t3 = trade.t3_price || trade.entry_price * 1.08;
  const sl = trade.current_sl || trade.initial_sl || trade.entry_price * 0.98;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#060d18", border: "1px solid #0e2030", borderRadius: 12, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: 24 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'Courier New', monospace" }}>{trade.symbol}</span>
              <Badge label={trade.direction} color={trade.direction === "LONG" ? "#00e5a0" : "#ff4d4d"} bg={trade.direction === "LONG" ? "#00e5a011" : "#ff4d4d11"} />
              <Badge label={trade.trade_type || trade.type} color="#58a6ff" bg="#58a6ff11" />
              {isOpen ? <Badge label="OPEN" color="#ffd700" bg="#ffd70011" /> : <Badge label={trade.exit_type} color={isWin ? "#00e5a0" : "#ff4d4d"} bg={isWin ? "#00e5a011" : "#ff4d4d11"} />}
            </div>
            <div style={{ fontSize: 11, color: "#3a5570", fontFamily: "'Courier New', monospace" }}>Trade ID: {trade.trade_id || trade.id}  |  Signal: {trade.signal_id}  |  Conviction: {trade.conviction_score}/100</div>
          </div>
          <button onClick={onClose} style={{ background: "#0e1e30", border: "1px solid #1a3050", color: "#58a6ff", width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* P&L Banner */}
        <div style={{ background: `linear-gradient(135deg, ${pnlColor}0d, transparent)`, border: `1px solid ${pnlColor}33`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "ENTRY", value: `₹${trade.entry_price}`, color: "#fff" },
            { label: "EXIT/LTP", value: isOpen ? `₹${trade.last_price_update || trade.current_price} (live)` : `₹${trade.exit_price}`, color: isOpen ? "#ffd700" : "#fff" },
            { label: "QTY", value: trade.qty_total || trade.qty, color: "#fff" },
            { label: "P&L", value: `${(trade.total_pnl || trade.unrealized_pnl) > 0 ? "+" : ""}₹${(trade.total_pnl || trade.unrealized_pnl)?.toLocaleString()}`, color: pnlColor },
            { label: "RETURN", value: `${(trade.total_pnl || trade.unrealized_pnl) > 0 ? "+" : ""}${(trade.pnl_pct || (trade.unrealized_pnl / trade.total_invested * 100))?.toFixed(2)}%`, color: pnlColor },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'Courier New', monospace" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Price levels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "STOP LOSS", val: `₹${sl}`, color: "#ff4d4d" },
            { label: "TARGET 1", val: `₹${t1}`, color: "#00e5a0" },
            { label: "TARGET 2", val: `₹${t2}`, color: "#00e5a0" },
            { label: "TARGET 3", val: `₹${t3}`, color: "#00b87a" },
            { label: "INVESTED", val: `₹${((trade.total_invested || trade.investedCapital) / 1000).toFixed(0)}K`, color: "#58a6ff" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#3a5570", letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'Courier New', monospace" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Agent Signals */}
        <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#58a6ff", letterSpacing: 2, marginBottom: 10, fontFamily: "'Courier New', monospace" }}>AGENT CONSENSUS AT ENTRY</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "OI AGENT", val: trade.agent_signals?.oi_agent || trade.agentConsensus?.oi || "—" },
              { label: "DELIVERY", val: trade.agent_signals?.delivery_agent || trade.agentConsensus?.delivery || "—" },
              { label: "TECHNICAL", val: trade.agent_signals?.technical_agent || trade.agentConsensus?.technical || "—" },
              { label: "REGIME", val: trade.agent_signals?.regime || trade.agentConsensus?.regime || "BULLISH_TREND" },
              { label: "DEVIL SCORE", val: trade.devil_score || trade.agentConsensus?.devil || "—", isScore: true },
            ].map(({ label, val, isScore }: any) => {
              const c = isScore ? (val <= 3 ? "#00e5a0" : val <= 5 ? "#ffd700" : "#ff4d4d") : (val?.toLowerCase() === "bullish" ? "#00e5a0" : val?.toLowerCase() === "bearish" ? "#ff4d4d" : "#ffd700");
              return (
                <div key={label} style={{ background: "#060d18", border: `1px solid ${c}22`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 8, color: "#3a5570", letterSpacing: 1 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: c, textTransform: "uppercase" as any, fontFamily: "'Courier New', monospace" }}>{val}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reasoning */}
        <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#00e5a0", letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>📋 ENTRY REASONING</div>
          <p style={{ fontSize: 12, color: "#7a9ab5", lineHeight: 1.7, margin: 0 }}>{trade.entry_reasoning || trade.entryReason || "Institutional accumulation detected in pre-event window."}</p>
        </div>

        <div style={{ background: "#070e1a", border: "1px solid #ff4d4d22", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#ff4d4d", letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>👿 DEVIL'S ADVOCATE CHALLENGE</div>
          <p style={{ fontSize: 12, color: "#7a9ab5", lineHeight: 1.7, margin: 0 }}>{trade.devil_challenge_detail || trade.devilChallenge || "No major macro headwind detected. FII flow remains supportive."}</p>
        </div>

        {isOpen && (
          <div style={{ background: "#070e1a", border: "1px solid #ffd70033", borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>📍 CURRENT STATUS — POSITION OPEN</div>
            <div style={{ display: "flex", gap: 20 }}>
              <div><div style={{ fontSize: 9, color: "#3a5570" }}>LTP</div><div style={{ fontSize: 18, fontWeight: 800, color: "#ffd700", fontFamily: "'Courier New', monospace" }}>₹{trade.last_price_update || trade.currentPrice || "—"}</div></div>
              <div><div style={{ fontSize: 9, color: "#3a5570" }}>UNREALIZED P&L</div><div style={{ fontSize: 18, fontWeight: 800, color: "#00e5a0", fontFamily: "'Courier New', monospace" }}>+₹{trade.unrealized_pnl?.toLocaleString() || "0"}</div></div>
              <div><div style={{ fontSize: 9, color: "#3a5570" }}>HELD SINCE</div><div style={{ fontSize: 12, fontWeight: 800, color: "#fff", fontFamily: "'Courier New', monospace", marginTop: 4 }}>{new Date(trade.entry_date).toLocaleDateString()}</div></div>
            </div>
          </div>
        )}

        {trade.autopsy && (
          <div style={{ background: "#070e1a", border: "1px solid #58a6ff22", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 9, color: "#58a6ff", letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>🔬 TRADE AUTOPSY</div>
            <p style={{ fontSize: 12, color: "#7a9ab5", lineHeight: 1.7, margin: 0 }}>{trade.autopsy}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function PaperTradingEngine() {
  const [tab, setTab] = useState("portfolio");
  const [selectedTrade, setSelectedTrade] = useState<any>(null);
  const [data, setData] = useState<any>({ state: {}, openPositions: [], recentlyClosed: [] });
  const [signals, setSignals] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [charts, setCharts] = useState<any>({ equityCurve: [], monthlyBars: [] });
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [portRes, sigRes, sumRes, chartRes, tradesRes] = await Promise.all([
        axios.get(`${API_BASE}/paper/portfolio`),
        axios.get(`${API_BASE}/paper/signals`),
        axios.get(`${API_BASE}/paper/performance/summary`),
        axios.get(`${API_BASE}/paper/performance/charts`),
        axios.get(`${API_BASE}/paper/trades?limit=100`)
      ]);
      setData(portRes.data);
      setSignals(sigRes.data);
      setSummary(sumRes.data);
      setCharts(chartRes.data);
      // Combine open and closed trades for the full log
      setAllTrades([...portRes.data.openPositions, ...tradesRes.data]);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch paper trading data:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <div style={{ background: "#030810", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#00e5a0", letterSpacing: 4, fontSize: 12, fontFamily: "'Courier New', monospace" }}>INITIALIZING ENGINE...</div>;

  const currentCapital = data.state?.current_portfolio_value || INITIAL_CAPITAL;
  const totalPnL = (data.state?.total_realized_pnl || 0) + (data.state?.total_unrealized_pnl || 0);
  const totalReturn = data.state?.total_return_pct?.toFixed(2) || "0.00";

  const tabs = [
    { id: "portfolio", label: "💼 Portfolio" },
    { id: "signals", label: "📡 Signals" },
    { id: "trades", label: "📋 Trade Log" },
    { id: "performance", label: "📈 Performance" },
  ];

  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: "#030810", minHeight: "100vh", color: "#8baabb", margin: "-32px", borderRadius: 16, overflow: "hidden" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .trade-row:hover { background: #0a1520 !important; cursor: pointer; }
        .sig-row:hover { background: #0a1520 !important; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #1a3050; }
      `}</style>

      {/* TOP BAR */}
      <div style={{ background: "#050c18", borderBottom: "1px solid #0a1a2a", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 11, color: "#00e5a0", letterSpacing: 3, fontWeight: 800 }}>◈ ANTIGRAVITY</div>
        <div style={{ fontSize: 9, color: "#1a3050", letterSpacing: 2 }}>PAPER TRADING ENGINE</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#00e5a0" }}>MOCK CAPITAL: ₹{Number(currentCapital).toLocaleString()}</span>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, padding: "12px 16px", borderBottom: "1px solid #0a1a2a" }}>
        <StatCard label="STARTING CAPITAL" value={`₹5.0L`} sub="Mock funds" color="#58a6ff" small />
        <StatCard label="CURRENT VALUE" value={`₹${(currentCapital / 1000).toFixed(1)}K`} sub={`${totalReturn}% return`} color={totalPnL >= 0 ? "#00e5a0" : "#ff4d4d"} small />
        <StatCard label="TOTAL P&L" value={`${totalPnL >= 0 ? "+" : ""}₹${totalPnL.toLocaleString()}`} sub="Realized + Open" color={totalPnL >= 0 ? "#00e5a0" : "#ff4d4d"} small />
        <StatCard label="WIN RATE" value={`${summary.win_rate_pct?.toFixed(0)}%`} sub={`${summary.total_trades} total trades`} color="#ffd700" small />
        <StatCard label="OPEN POSITIONS" value={data.openPositions.length} sub={`₹${data.openPositions.reduce((s: any, t: any) => s + t.total_invested, 0).toLocaleString()} deployed`} color="#ffd700" small />
        <StatCard label="TOTAL TRADES" value={summary.total_trades} sub="Closed log entries" color="#58a6ff" small />
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 0, padding: "0 16px", background: "#050c18", borderBottom: "1px solid #0a1a2a" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #00e5a0" : "2px solid transparent", color: tab === t.id ? "#00e5a0" : "#3a5570", padding: "10px 16px", cursor: "pointer", fontSize: 10, fontWeight: 800, letterSpacing: 1, transition: "all 0.15s", fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: 16, animation: "fadeUp 0.3s ease" }}>

        {/* ── PORTFOLIO TAB ── */}
        {tab === "portfolio" && (
          <div>
            {/* Open Positions */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 10 }}>📍 OPEN POSITIONS ({data.openPositions.length})</div>
              {data.openPositions.length === 0 && <div style={{ color: "#3a5068", fontSize: 11, padding: 20, textAlign: "center", background: "#070e1a", borderRadius: 8 }}>No active positions. Waiting for signals...</div>}
              {data.openPositions.map((t: any) => (
                <div key={t.trade_id} className="trade-row" onClick={() => setSelectedTrade(t)}
                  style={{ background: "#070e1a", border: "1px solid #ffd70022", borderLeft: "3px solid #ffd700", borderRadius: 8, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", transition: "background 0.15s" }}>
                  <div style={{ minWidth: 60 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{t.symbol}</div>
                    <div style={{ fontSize: 9, color: "#3a5570" }}>{t.trade_type}</div>
                  </div>
                  <Badge label={t.direction} color={t.direction === "LONG" ? "#00e5a0" : "#ff4d4d"} bg={t.direction === "LONG" ? "#00e5a011" : "#ff4d4d11"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#7a9ab5" }}>Entry ₹{t.entry_price} → Now ₹{t.last_price_update || "—"}</div>
                    <div style={{ fontSize: 10, color: "#3a5570" }}>{t.qty_remaining} qty • ₹{(t.total_invested / 1000).toFixed(0)}K deployed</div>
                  </div>
                  <div style={{ textAlign: "right", marginRight: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: t.unrealized_pnl >= 0 ? "#00e5a0" : "#ff4d4d" }}>{t.unrealized_pnl >= 0 ? "+" : ""}₹{t.unrealized_pnl.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: t.unrealized_pnl >= 0 ? "#00e5a0" : "#ff4d4d" }}>{(t.unrealized_pnl / t.total_invested * 100).toFixed(2)}%</div>
                  </div>
                  <div style={{ background: "#0a1a2a", border: "1px solid #1a3050", borderRadius: 4, padding: "4px 10px", fontSize: 9, color: "#58a6ff", cursor: "pointer", letterSpacing: 1 }}>
                    VIEW ANALYSIS →
                  </div>
                </div>
              ))}
            </div>

            {/* Closed Positions */}
            <div>
              <div style={{ fontSize: 9, color: "#58a6ff", letterSpacing: 2, marginBottom: 10 }}>📁 RECENTLY CLOSED ({data.recentlyClosed.length})</div>
              {data.recentlyClosed.map((t: any) => {
                const isWin = t.total_pnl > 0;
                return (
                  <div key={t.trade_id} className="trade-row" onClick={() => setSelectedTrade(t)}
                    style={{ background: "#070e1a", border: "1px solid #0e1e30", borderLeft: `3px solid ${isWin ? "#00e5a0" : "#ff4d4d"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", transition: "background 0.15s" }}>
                    <div style={{ minWidth: 60 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#cdd5dd" }}>{t.symbol}</div>
                      <div style={{ fontSize: 9, color: "#3a5570" }}>{t.trade_type}</div>
                    </div>
                    <Badge label={t.exit_type} color={isWin ? "#00e5a0" : "#ff4d4d"} bg={isWin ? "#00e5a011" : "#ff4d4d11"} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#7a9ab5" }}>₹{t.entry_price} → ₹{t.exit_price}</div>
                      <div style={{ fontSize: 10, color: "#3a5570" }}>{new Date(t.entry_date).toLocaleDateString()} — {new Date(t.exit_date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: "right", marginRight: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}₹{t.total_pnl.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}{t.pnl_pct}%</div>
                    </div>
                    <div style={{ background: "#0a1a2a", border: "1px solid #1a3050", borderRadius: 4, padding: "4px 10px", fontSize: 9, color: "#58a6ff", letterSpacing: 1 }}>
                      ANALYSIS →
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SIGNALS TAB ── */}
        {tab === "signals" && (
          <div>
            <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 2, marginBottom: 12 }}>LATEST SIGNALS FROM SYSTEM — TOP SELECTED FOR PAPER PORTFOLIO</div>
            {signals.map((s, i) => {
              const inPortfolio = s.selection_status === "IN_PORTFOLIO";
              const scoreColor = s.conviction_score >= 80 ? "#00e5a0" : s.conviction_score >= 70 ? "#ffd700" : "#ff9500";
              const daColor = s.devil_score <= 3 ? "#00e5a0" : s.devil_score <= 5 ? "#ffd700" : "#ff4d4d";
              return (
                <div key={s.signal_id} className="sig-row"
                  style={{ background: "#070e1a", border: `1px solid ${inPortfolio ? "#00e5a033" : "#0e1e30"}`, borderLeft: `3px solid ${inPortfolio ? "#00e5a0" : "#1a3050"}`, borderRadius: 8, padding: 14, marginBottom: 8, transition: "background 0.15s", opacity: inPortfolio ? 1 : 0.5 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 70 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: inPortfolio ? "#fff" : "#5a7a8a" }}>{s.symbol}</div>
                      <div style={{ fontSize: 9, color: "#3a5570" }}>{new Date(s.received_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge label={s.direction} color={s.direction === "LONG" ? "#00e5a0" : "#ff4d4d"} bg={s.direction === "LONG" ? "#00e5a011" : "#ff4d4d11"} />
                      <Badge label={s.trade_type} color="#58a6ff" bg="#58a6ff11" />
                      {inPortfolio && <Badge label="✓ IN PORTFOLIO" color="#00e5a0" bg="#00e5a011" />}
                      {!inPortfolio && <Badge label={s.selection_status} color="#555" bg="#11111111" />}
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 1 }}>CONVICTION</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor }}>{s.conviction_score}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 1 }}>DEVIL SCORE</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: daColor }}>{s.devil_score}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {[["ENTRY", `₹${s.entry_price}`], ["SL", `₹${s.sl_price}`], ["T1", `₹${s.t1_price}`], ["T2", `₹${s.t2_price}`]].map(([l, v]) => (
                      <div key={l} style={{ background: "#060c18", borderRadius: 6, padding: "6px 8px" }}>
                        <div style={{ fontSize: 8, color: "#3a5570", letterSpacing: 1 }}>{l}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: l === "SL" ? "#ff4d4d" : l.startsWith("T") ? "#00e5a0" : "#fff" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: "#4a6a7a", lineHeight: 1.6 }}>{s.entry_reasoning?.slice(0, 180)}...</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TRADE LOG TAB ── */}
        {tab === "trades" && (
          <div>
            <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 2, marginBottom: 12 }}>COMPLETE TRADE LOG — CLICK ANY ROW FOR FULL ANALYSIS</div>
            <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 100px 100px 100px 80px 100px 80px", gap: 0, padding: "8px 12px", borderBottom: "1px solid #0e1e30", background: "#060c18" }}>
                {["SYMBOL","TYPE","DIR","ENTRY","EXIT/LTP","P&L","%","RESULT",""].map(h => (
                  <div key={h} style={{ fontSize: 9, color: "#1a3050", letterSpacing: 1 }}>{h}</div>
                ))}
              </div>
              {allTrades.length === 0 && <div style={{ color: "#3a5068", fontSize: 11, padding: 20, textAlign: "center" }}>No entries in trade log.</div>}
              {allTrades.map((t, i) => {
                const isWin = (t.total_pnl || t.unrealized_pnl) > 0;
                const isOpen = t.status === "OPEN";
                return (
                  <div key={t.trade_id} className="trade-row" onClick={() => setSelectedTrade(t)}
                    style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 100px 100px 100px 80px 100px 80px", gap: 0, padding: "10px 12px", borderBottom: i < allTrades.length - 1 ? "1px solid #0a1420" : "none", background: i % 2 === 0 ? "#070e1a" : "transparent", transition: "background 0.1s" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#cdd5dd" }}>{t.symbol}</div>
                    <div style={{ fontSize: 10, color: "#4a6a7a" }}>{(t.trade_type || t.type)?.slice(0, 5)}</div>
                    <div style={{ fontSize: 10, color: t.direction === "LONG" ? "#00e5a0" : "#ff4d4d", fontWeight: 700 }}>{t.direction}</div>
                    <div style={{ fontSize: 11, color: "#7a9ab5" }}>₹{t.entry_price}</div>
                    <div style={{ fontSize: 11, color: isOpen ? "#ffd700" : "#7a9ab5" }}>{isOpen ? `₹${t.last_price_update || "—"}` : `₹${t.exit_price}`}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}₹{(t.total_pnl || t.unrealized_pnl)?.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}{(t.pnl_pct || (t.unrealized_pnl / t.total_invested * 100))?.toFixed(2)}%</div>
                    <div>{isOpen ? <Badge label="OPEN" color="#ffd700" bg="#ffd70011" /> : <Badge label={t.exit_type} color={isWin ? "#00e5a0" : "#ff4d4d"} bg={isWin ? "#00e5a011" : "#ff4d4d11"} />}</div>
                    <div style={{ fontSize: 9, color: "#58a6ff", letterSpacing: 1 }}>DETAIL →</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PERFORMANCE TAB ── */}
        {tab === "performance" && (
          <div>
            {/* Equity curve */}
            <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#00e5a0", letterSpacing: 2, marginBottom: 12 }}>📈 EQUITY CURVE — PAPER PORTFOLIO</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={charts.equityCurve}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#0a1a2a" />
                  <XAxis dataKey="date" stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} />
                  <YAxis stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: "#060c18", border: "1px solid #0e1e30", borderRadius: 6, fontFamily: "Courier New", fontSize: 11 }} formatter={(v: any) => [`₹${(v || 0).toLocaleString()}`, "Portfolio"]} />
                  <ReferenceLine y={500000} stroke="#1a3050" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="equity" stroke="#00e5a0" strokeWidth={2} dot={{ fill: "#00e5a0", r: 3 }} activeDot={{ r: 5, fill: "#00e5a0" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly P&L bars */}
            <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 12 }}>📊 MONTHLY P&L</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={charts.monthlyBars}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#0a1a2a" />
                  <XAxis dataKey="month" stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} />
                  <YAxis stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: "#060c18", border: "1px solid #0e1e30", borderRadius: 6, fontFamily: "Courier New", fontSize: 11 }} formatter={(v: any) => [`₹${(v || 0).toLocaleString()}`, "P&L"]} />
                  <Bar dataKey="pnl" fill="#00e5a0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "TOTAL RETURN", value: `${totalReturn}%`, sub: "Since inception", color: "#00e5a0" },
                { label: "WIN RATE", value: `${summary.win_rate_pct?.toFixed(0)}%`, sub: `${summary.total_trades} total logs`, color: "#ffd700" },
                { label: "AVG WIN", value: `₹${Math.round(summary.avg_win || 0).toLocaleString()}`, sub: "Per winning trade", color: "#00e5a0" },
                { label: "AVG LOSS", value: `₹${Math.round(summary.avg_loss || 0).toLocaleString()}`, sub: "Per losing trade", color: "#ff4d4d" },
                { label: "BEST TRADE", value: `+₹${(summary.best_trade || 0).toLocaleString()}`, sub: "Peak realized P&L", color: "#00e5a0" },
                { label: "MAX LOSS", value: `-₹${Math.abs(summary.worst_trade || 0).toLocaleString()}`, sub: "Worst SL execution", color: "#ff4d4d" },
              ].map(({ label, value, sub, color }) => (
                <StatCard key={label} label={label} value={value} sub={sub} color={color} small />
              ))}
            </div>

            {/* Conviction notice */}
            <div style={{ background: "#070e1a", border: "1px solid #ffd70033", borderRadius: 8, padding: 14, marginTop: 12 }}>
              <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 8 }}>⏳ CONVICTION TIMELINE</div>
              <div style={{ display: "flex", gap: 0 }}>
                {[
                  { label: "Month 1", desc: "System learning. Sample size tracking. Monitor only.", done: true, color: "#ffd700" },
                  { label: "Month 2", desc: "Pattern forming. Win rate check. Strategy refinement.", done: false, color: "#3a5570" },
                  { label: "Month 3", desc: "Full conviction check. If consistent → real money.", done: false, color: "#3a5570" },
                ].map(({ label, desc, done, color }, i) => (
                  <div key={i} style={{ flex: 1, padding: "10px 12px", borderRight: i < 2 ? "1px solid #0e1e30" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: done ? color : "#1a3050" }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: done ? color : "#3a5570" }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#3a5570", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ANALYSIS MODAL */}
      {selectedTrade && <AnalysisModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}
    </div>
  );
}
