import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from "recharts";

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
const INITIAL_CAPITAL = 500000;

const MOCK_SIGNALS = [
  { id: "SIG001", symbol: "TCS", type: "SWING", direction: "LONG", signalDate: "2025-04-01", entryPrice: 2436, sl: 2380, t1: 2520, t2: 2580, t3: 2650, convictionScore: 83, agentConsensus: { oi: "bullish", delivery: "bullish", technical: "bullish", devil: 3, regime: "BULLISH_TREND" }, reason: "Q4 results in 9 days. FII net buying ₹840Cr avg. Delivery 58%. PCR 1.18. Devil's Advocate score 3 — no major challenge found. SAA risk score 3/10. Pre-market confirmed gap within range." },
  { id: "SIG002", symbol: "HDFCBANK", type: "INTRADAY", direction: "LONG", signalDate: "2025-04-03", entryPrice: 1642, sl: 1628, t1: 1658, t2: 1670, t3: 1685, convictionScore: 74, agentConsensus: { oi: "bullish", delivery: "neutral", technical: "bullish", devil: 5, regime: "BULLISH_TREND" }, reason: "Breakout above 1640 resistance with volume 2.1x avg. OI long buildup. Technical agent RSI 58 — room to run. Devil's Advocate score 5 — delivery not confirming, size reduced to 50%." },
  { id: "SIG003", symbol: "INFY", type: "SWING", direction: "LONG", signalDate: "2025-04-05", entryPrice: 1478, sl: 1445, t1: 1530, t2: 1575, t3: 1620, convictionScore: 78, agentConsensus: { oi: "bullish", delivery: "bullish", technical: "neutral", devil: 4, regime: "BULLISH_TREND" }, reason: "Q4 results in 12 days. FII consistent buying 8/10 sessions. PCR 1.12. Delivery 54%. Technical agent neutral — price below 50 DMA but OI+Delivery confluence strong. Devil score 4." },
  { id: "SIG004", symbol: "RELIANCE", type: "INTRADAY", direction: "SHORT", signalDate: "2025-04-07", entryPrice: 1290, sl: 1302, t1: 1275, t2: 1262, t3: 1248, convictionScore: 71, agentConsensus: { oi: "bearish", delivery: "bearish", technical: "bearish", devil: 4, regime: "RANGE" }, reason: "Market regime RANGE. Crude at $91 — bearish India macro. FII net selling ₹620Cr. OI short buildup. Delivery falling 3 sessions. Triple agent bearish alignment." },
  { id: "SIG005", symbol: "WIPRO", type: "SWING", direction: "LONG", signalDate: "2025-04-08", entryPrice: 462, sl: 450, t1: 478, t2: 490, t3: 505, convictionScore: 69, agentConsensus: { oi: "neutral", delivery: "bullish", technical: "bullish", devil: 6, regime: "BULLISH_TREND" }, reason: "Q4 results in 15 days. Delivery rising to 56%. Technical breakout. Devil score 6 — OI not confirming, stock at 52-week high zone (distribution risk). Size reduced to 40%." },
];

const MOCK_TRADES = [
  { id: "PT001", signalId: "SIG001", symbol: "TCS", type: "SWING", direction: "LONG", entryDate: "2025-04-01", entryPrice: 2436, entryReason: "Q4 results in 9 days. FII net buying ₹840Cr avg. Delivery 58%. PCR 1.18. Devil's Advocate score 3 — clean signal. SAA risk 3/10. All 3 analytical agents bullish.", exitDate: "2025-04-08", exitPrice: 2548, exitReason: "T2 hit at ₹2548. Institutions exiting into Q4 result announcement. FII net selling started. Partial book T1 (40%) at ₹2520 on April 5, remaining 60% at T2.", status: "CLOSED", exitType: "TARGET", qty: 82, investedCapital: 199752, pnl: 9184, pnlPct: 4.60, agentConsensus: { oi: "bullish", delivery: "bullish", technical: "bullish", devil: 3, regime: "BULLISH_TREND" }, convictionScore: 83, devilChallenge: "Entry timing valid (not first 15 min). No OI trap. SAA clear. Historical: TCS Q4 bullish 4/5 last years. RR 1:2.8. Volume adequate.", autopsy: "OI Agent correct — long buildup held through entry. Delivery Agent correct — institutional accumulation confirmed by actual delivery data. Technical Agent correct — breakout held. Devil score 3 was right to allow trade. Lesson: Pre-event accumulation + low Devil score = high win probability." },
  { id: "PT002", signalId: "SIG002", symbol: "HDFCBANK", type: "INTRADAY", direction: "LONG", entryDate: "2025-04-03", entryPrice: 1642, entryReason: "Breakout above 1640 resistance. Volume 2.1x avg. OI long buildup. Devil score 5 — delivery not confirming. Position sized at 50% of normal.", exitDate: "2025-04-03", exitPrice: 1628, exitReason: "SL hit at ₹1628. Nifty reversed after 10:30 AM. Delivery concern flagged by Devil's Advocate proved correct — no institutional support for the breakout.", status: "CLOSED", exitType: "SL", qty: 122, investedCapital: 200324, pnl: -1708, pnlPct: -0.85, agentConsensus: { oi: "bullish", delivery: "neutral", technical: "bullish" }, convictionScore: 74, devilChallenge: "Entry timing: stock moved 0.9% already — acceptable. OI trap risk: possibly — delivery not confirming suggests retail-driven OI. Macro: FII marginally selling. Historical: HDFCBANK morning breakouts fail 40% when delivery neutral. RR 1:1.7 — below ideal.", autopsy: "Devil's Advocate score 5 was WARNING sign that materialized. Delivery Agent neutral proved correct — OI was retail-driven. Lesson: When Delivery Agent is neutral and Devil score is 5+, skip INTRADAY breakouts. Weight recommendation: Delivery Agent weight should increase for intraday breakout signals specifically." },
  { id: "PT003", signalId: "SIG003", symbol: "INFY", type: "SWING", direction: "LONG", entryDate: "2025-04-05", entryPrice: 1478, entryReason: "Q4 results in 12 days. FII consistent buying 8/10 sessions. PCR 1.12. Delivery 54%. Technical neutral but FII+OI conviction strong. Devil score 4.", exitDate: null, exitPrice: null, exitReason: null, status: "OPEN", exitType: null, qty: 68, investedCapital: 100504, pnl: 3536, pnlPct: 3.52, currentPrice: 1530, agentConsensus: { oi: "bullish", delivery: "bullish", technical: "neutral" }, convictionScore: 78, devilChallenge: "Entry timing: stock below 50 DMA — risk of pullback to DMA from above. OI valid. Macro: SAA 3/10 — clean. Historical: INFY pre-result accumulation works 60% of last 8 quarters. RR 1:2.5.", autopsy: null },
  { id: "PT004", signalId: "SIG004", symbol: "RELIANCE", type: "INTRADAY", direction: "SHORT", entryDate: "2025-04-07", entryPrice: 1290, entryReason: "Crude $91 — bearish India macro. FII selling. Triple bearish alignment. Devil score 4 — acceptable.", exitDate: "2025-04-07", exitPrice: 1271, exitReason: "T1 hit at ₹1275. Partial book 40%. Market continued weak. Exited remaining at T2 ₹1262 near close.", status: "CLOSED", exitType: "TARGET", qty: 155, investedCapital: 199950, pnl: 4030, pnlPct: 2.02, agentConsensus: { oi: "bearish", delivery: "bearish", technical: "bearish" }, convictionScore: 71, devilChallenge: "Short in RANGE regime — risk of sudden bounce. Crude bearish but could reverse. RBI meeting next week. Entry valid. Historical: Reliance shorts work 65% in crude>90 environment.", autopsy: "All 3 analytical agents correct on SHORT. Macro context (crude) was the key driver — SAA would have flagged this. Devil score 4 correct to allow. Lesson: Sector-specific macro + triple agent alignment = high SHORT confidence." },
];

// Monthly performance data
const MONTHLY_DATA = [
  { month: "Feb", pnl: 0, cumulative: 0, trades: 0, winRate: 0, capital: 500000 },
  { month: "Mar", pnl: 8200, cumulative: 8200, trades: 6, winRate: 67, capital: 508200 },
  { month: "Apr", pnl: 15042, cumulative: 23242, trades: 4, winRate: 75, capital: 523242 },
];

// ── COMPONENTS ─────────────────────────────────────────────────────────────────

const Badge = ({ label, color, bg }) => (
  <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, border: `1px solid ${color}33` }}>
    {label}
  </span>
);

const StatCard = ({ label, value, sub, color = "#00e5a0", small = false }) => (
  <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: small ? "10px 14px" : "14px 16px" }}>
    <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 1.5, marginBottom: 4, fontFamily: "'Courier New', monospace" }}>{label}</div>
    <div style={{ fontSize: small ? 18 : 24, fontWeight: 900, color, fontFamily: "'Courier New', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: "#3a5570", marginTop: 3 }}>{sub}</div>}
  </div>
);

// Trade Analysis Modal
const AnalysisModal = ({ trade, onClose }) => {
  if (!trade) return null;
  const isWin = trade.exitType === "TARGET";
  const isOpen = trade.status === "OPEN";
  const pnlColor = trade.pnl > 0 ? "#00e5a0" : "#ff4d4d";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#060d18", border: "1px solid #0e2030", borderRadius: 12, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: 24 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'Courier New', monospace" }}>{trade.symbol}</span>
              <Badge label={trade.direction} color={trade.direction === "LONG" ? "#00e5a0" : "#ff4d4d"} bg={trade.direction === "LONG" ? "#00e5a011" : "#ff4d4d11"} />
              <Badge label={trade.type} color="#58a6ff" bg="#58a6ff11" />
              {isOpen ? <Badge label="OPEN" color="#ffd700" bg="#ffd70011" /> : <Badge label={trade.exitType} color={isWin ? "#00e5a0" : "#ff4d4d"} bg={isWin ? "#00e5a011" : "#ff4d4d11"} />}
            </div>
            <div style={{ fontSize: 11, color: "#3a5570", fontFamily: "'Courier New', monospace" }}>Trade ID: {trade.id}  |  Signal: {trade.signalId}  |  Conviction: {trade.convictionScore}/100</div>
          </div>
          <button onClick={onClose} style={{ background: "#0e1e30", border: "1px solid #1a3050", color: "#58a6ff", width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* P&L Banner */}
        <div style={{ background: `linear-gradient(135deg, ${pnlColor}0d, transparent)`, border: `1px solid ${pnlColor}33`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "ENTRY", value: `₹${trade.entryPrice}`, color: "#fff" },
            { label: "EXIT", value: isOpen ? `₹${trade.currentPrice} (live)` : `₹${trade.exitPrice}`, color: isOpen ? "#ffd700" : "#fff" },
            { label: "QTY", value: trade.qty, color: "#fff" },
            { label: "P&L", value: `${trade.pnl > 0 ? "+" : ""}₹${trade.pnl?.toLocaleString()}`, color: pnlColor },
            { label: "RETURN", value: `${trade.pnl > 0 ? "+" : ""}${trade.pnlPct?.toFixed(2)}%`, color: pnlColor },
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
            { label: "STOP LOSS", val: `₹${trade.entryPrice - (trade.entryPrice - trade.agentConsensus?.sl || 0)}`, color: "#ff4d4d" },
            { label: "TARGET 1", val: `₹${trade.entryPrice + 40}`, color: "#00e5a0" },
            { label: "TARGET 2", val: `₹${trade.entryPrice + 90}`, color: "#00e5a0" },
            { label: "TARGET 3", val: `₹${trade.entryPrice + 160}`, color: "#00b87a" },
            { label: "INVESTED", val: `₹${(trade.investedCapital / 1000).toFixed(0)}K`, color: "#58a6ff" },
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
              { label: "OI AGENT", val: trade.agentConsensus?.oi || "—" },
              { label: "DELIVERY", val: trade.agentConsensus?.delivery || "—" },
              { label: "TECHNICAL", val: trade.agentConsensus?.technical || "—" },
              { label: "REGIME", val: trade.agentConsensus?.regime || "BULLISH_TREND" },
              { label: "DEVIL SCORE", val: trade.agentConsensus?.devil || "—", isScore: true },
            ].map(({ label, val, isScore }) => {
              const c = isScore ? (val <= 3 ? "#00e5a0" : val <= 5 ? "#ffd700" : "#ff4d4d") : (val === "bullish" ? "#00e5a0" : val === "bearish" ? "#ff4d4d" : "#ffd700");
              return (
                <div key={label} style={{ background: "#060d18", border: `1px solid ${c}22`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 8, color: "#3a5570", letterSpacing: 1 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: c, textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>{val}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Entry Reason */}
        <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#00e5a0", letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>📋 ENTRY REASONING</div>
          <p style={{ fontSize: 12, color: "#7a9ab5", lineHeight: 1.7, margin: 0 }}>{trade.entryReason}</p>
        </div>

        {/* Devil's Advocate Challenge */}
        <div style={{ background: "#070e1a", border: "1px solid #ff4d4d22", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#ff4d4d", letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>👿 DEVIL'S ADVOCATE CHALLENGE</div>
          <p style={{ fontSize: 12, color: "#7a9ab5", lineHeight: 1.7, margin: 0 }}>{trade.devilChallenge}</p>
        </div>

        {/* Exit / Current Status */}
        {!isOpen && (
          <div style={{ background: "#070e1a", border: `1px solid ${pnlColor}22`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: pnlColor, letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>🚪 EXIT REASONING</div>
            <p style={{ fontSize: 12, color: "#7a9ab5", lineHeight: 1.7, margin: 0 }}>{trade.exitReason}</p>
          </div>
        )}
        {isOpen && (
          <div style={{ background: "#070e1a", border: "1px solid #ffd70033", borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>📍 CURRENT STATUS — POSITION OPEN</div>
            <div style={{ display: "flex", gap: 20 }}>
              <div><div style={{ fontSize: 9, color: "#3a5570" }}>CURRENT PRICE</div><div style={{ fontSize: 18, fontWeight: 800, color: "#ffd700", fontFamily: "'Courier New', monospace" }}>₹{trade.currentPrice}</div></div>
              <div><div style={{ fontSize: 9, color: "#3a5570" }}>UNREALIZED P&L</div><div style={{ fontSize: 18, fontWeight: 800, color: "#00e5a0", fontFamily: "'Courier New', monospace" }}>+₹{trade.pnl?.toLocaleString()}</div></div>
              <div><div style={{ fontSize: 9, color: "#3a5570" }}>DAYS HELD</div><div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Courier New', monospace" }}>5</div></div>
            </div>
          </div>
        )}

        {/* Autopsy */}
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
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [trades] = useState(MOCK_TRADES);
  const [signals] = useState(MOCK_SIGNALS);

  const closedTrades = trades.filter(t => t.status === "CLOSED");
  const openTrades = trades.filter(t => t.status === "OPEN");
  const totalPnL = closedTrades.reduce((s, t) => s + t.pnl, 0) + openTrades.reduce((s, t) => s + t.pnl, 0);
  const winRate = closedTrades.length > 0 ? Math.round((closedTrades.filter(t => t.pnl > 0).length / closedTrades.length) * 100) : 0;
  const currentCapital = INITIAL_CAPITAL + totalPnL;
  const totalReturn = ((currentCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100).toFixed(2);

  // Equity curve data
  const equityCurve = [
    { date: "Apr 1", equity: 500000 },
    { date: "Apr 3", equity: 500000 - 1708 },
    { date: "Apr 5", equity: 500000 - 1708 + 3684 },
    { date: "Apr 7", equity: 500000 - 1708 + 3684 + 4030 },
    { date: "Apr 8", equity: 500000 - 1708 + 3684 + 4030 + 9184 + 3536 },
  ];

  // Monthly PnL bars
  const monthlyBars = [
    { month: "Feb", pnl: 0 }, { month: "Mar", pnl: 8200 }, { month: "Apr", pnl: 15042 },
  ];

  const tabs = [
    { id: "portfolio", label: "💼 Portfolio" },
    { id: "signals", label: "📡 Signals" },
    { id: "trades", label: "📋 Trade Log" },
    { id: "performance", label: "📈 Performance" },
  ];

  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: "#030810", minHeight: "100vh", color: "#8baabb" }}>
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
          <span style={{ fontSize: 9, color: "#00e5a0" }}>MOCK CAPITAL: ₹{currentCapital.toLocaleString()}</span>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, padding: "12px 16px", borderBottom: "1px solid #0a1a2a" }}>
        <StatCard label="STARTING CAPITAL" value={`₹${(INITIAL_CAPITAL / 100000).toFixed(1)}L`} sub="Mock funds" color="#58a6ff" small />
        <StatCard label="CURRENT VALUE" value={`₹${(currentCapital / 1000).toFixed(1)}K`} sub={`${totalReturn}% return`} color={totalPnL >= 0 ? "#00e5a0" : "#ff4d4d"} small />
        <StatCard label="TOTAL P&L" value={`${totalPnL >= 0 ? "+" : ""}₹${totalPnL.toLocaleString()}`} sub="Realized + Open" color={totalPnL >= 0 ? "#00e5a0" : "#ff4d4d"} small />
        <StatCard label="WIN RATE" value={`${winRate}%`} sub={`${closedTrades.filter(t => t.pnl > 0).length}W / ${closedTrades.filter(t => t.pnl < 0).length}L`} color="#ffd700" small />
        <StatCard label="OPEN POSITIONS" value={openTrades.length} sub={`₹${openTrades.reduce((s, t) => s + t.investedCapital, 0).toLocaleString()} deployed`} color="#ffd700" small />
        <StatCard label="TOTAL TRADES" value={trades.length} sub={`${closedTrades.length} closed`} color="#58a6ff" small />
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 0, padding: "0 16px", background: "#050c18", borderBottom: "1px solid #0a1a2a" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #00e5a0" : "2px solid transparent", color: tab === t.id ? "#00e5a0" : "#3a5570", padding: "10px 16px", cursor: "pointer", fontSize: 10, fontWeight: 800, letterSpacing: 1, transition: "all 0.15s" }}>
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
              <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 10 }}>📍 OPEN POSITIONS ({openTrades.length})</div>
              {openTrades.map(t => (
                <div key={t.id} className="trade-row" onClick={() => setSelectedTrade(t)}
                  style={{ background: "#070e1a", border: "1px solid #ffd70022", borderLeft: "3px solid #ffd700", borderRadius: 8, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", transition: "background 0.15s" }}>
                  <div style={{ minWidth: 60 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{t.symbol}</div>
                    <div style={{ fontSize: 9, color: "#3a5570" }}>{t.type}</div>
                  </div>
                  <Badge label={t.direction} color="#00e5a0" bg="#00e5a011" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#7a9ab5" }}>Entry ₹{t.entryPrice} → Now ₹{t.currentPrice}</div>
                    <div style={{ fontSize: 10, color: "#3a5570" }}>{t.qty} qty • ₹{(t.investedCapital / 1000).toFixed(0)}K deployed</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#00e5a0" }}>+₹{t.pnl.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "#00e5a0" }}>+{t.pnlPct}%</div>
                  </div>
                  <div style={{ background: "#0a1a2a", border: "1px solid #1a3050", borderRadius: 4, padding: "4px 10px", fontSize: 9, color: "#58a6ff", cursor: "pointer", letterSpacing: 1 }}>
                    VIEW ANALYSIS →
                  </div>
                </div>
              ))}
            </div>

            {/* Closed Positions */}
            <div>
              <div style={{ fontSize: 9, color: "#58a6ff", letterSpacing: 2, marginBottom: 10 }}>📁 RECENTLY CLOSED ({closedTrades.length})</div>
              {closedTrades.map(t => {
                const isWin = t.pnl > 0;
                return (
                  <div key={t.id} className="trade-row" onClick={() => setSelectedTrade(t)}
                    style={{ background: "#070e1a", border: "1px solid #0e1e30", borderLeft: `3px solid ${isWin ? "#00e5a0" : "#ff4d4d"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", transition: "background 0.15s" }}>
                    <div style={{ minWidth: 60 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#cdd5dd" }}>{t.symbol}</div>
                      <div style={{ fontSize: 9, color: "#3a5570" }}>{t.type}</div>
                    </div>
                    <Badge label={t.exitType} color={isWin ? "#00e5a0" : "#ff4d4d"} bg={isWin ? "#00e5a011" : "#ff4d4d11"} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#7a9ab5" }}>₹{t.entryPrice} → ₹{t.exitPrice}</div>
                      <div style={{ fontSize: 10, color: "#3a5570" }}>{t.entryDate} — {t.exitDate}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}₹{t.pnl.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}{t.pnlPct}%</div>
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
            <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 2, marginBottom: 12 }}>LATEST SIGNALS FROM SYSTEM — TOP 2-3 SELECTED FOR PAPER PORTFOLIO</div>
            {signals.map((s, i) => {
              const selected = i < 3;
              const scoreColor = s.convictionScore >= 80 ? "#00e5a0" : s.convictionScore >= 70 ? "#ffd700" : "#ff9500";
              const daColor = s.agentConsensus.devil <= 3 ? "#00e5a0" : s.agentConsensus.devil <= 5 ? "#ffd700" : "#ff4d4d";
              return (
                <div key={s.id} className="sig-row"
                  style={{ background: "#070e1a", border: `1px solid ${selected ? "#00e5a033" : "#0e1e30"}`, borderLeft: `3px solid ${selected ? "#00e5a0" : "#1a3050"}`, borderRadius: 8, padding: 14, marginBottom: 8, transition: "background 0.15s", opacity: selected ? 1 : 0.5 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 70 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: selected ? "#fff" : "#5a7a8a" }}>{s.symbol}</div>
                      <div style={{ fontSize: 9, color: "#3a5570" }}>{s.signalDate}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge label={s.direction} color={s.direction === "LONG" ? "#00e5a0" : "#ff4d4d"} bg={s.direction === "LONG" ? "#00e5a011" : "#ff4d4d11"} />
                      <Badge label={s.type} color="#58a6ff" bg="#58a6ff11" />
                      {selected && <Badge label="✓ IN PORTFOLIO" color="#00e5a0" bg="#00e5a011" />}
                      {!selected && <Badge label="FILTERED OUT" color="#555" bg="#11111111" />}
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 1 }}>CONVICTION</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor }}>{s.convictionScore}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#3a5570", letterSpacing: 1 }}>DEVIL SCORE</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: daColor }}>{s.agentConsensus.devil}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {[["ENTRY", `₹${s.entryPrice}`], ["SL", `₹${s.sl}`], ["T1", `₹${s.t1}`], ["T2", `₹${s.t2}`]].map(([l, v]) => (
                      <div key={l} style={{ background: "#060c18", borderRadius: 6, padding: "6px 8px" }}>
                        <div style={{ fontSize: 8, color: "#3a5570", letterSpacing: 1 }}>{l}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: l === "SL" ? "#ff4d4d" : l.startsWith("T") ? "#00e5a0" : "#fff" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: "#4a6a7a", lineHeight: 1.6 }}>{s.reason.slice(0, 180)}...</div>
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
              <div style={{ display: "grid", gridTemplateColumns: "80px 60px 70px 90px 90px 90px 90px 90px 80px", gap: 0, padding: "8px 12px", borderBottom: "1px solid #0e1e30", background: "#060c18" }}>
                {["SYMBOL","TYPE","DIR","ENTRY","EXIT","P&L","%","RESULT",""].map(h => (
                  <div key={h} style={{ fontSize: 9, color: "#1a3050", letterSpacing: 1 }}>{h}</div>
                ))}
              </div>
              {trades.map((t, i) => {
                const isWin = t.pnl > 0;
                const isOpen = t.status === "OPEN";
                return (
                  <div key={t.id} className="trade-row" onClick={() => setSelectedTrade(t)}
                    style={{ display: "grid", gridTemplateColumns: "80px 60px 70px 90px 90px 90px 90px 90px 80px", gap: 0, padding: "10px 12px", borderBottom: i < trades.length - 1 ? "1px solid #0a1420" : "none", background: i % 2 === 0 ? "#070e1a" : "transparent", transition: "background 0.1s" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#cdd5dd" }}>{t.symbol}</div>
                    <div style={{ fontSize: 10, color: "#4a6a7a" }}>{t.type.slice(0, 5)}</div>
                    <div style={{ fontSize: 10, color: t.direction === "LONG" ? "#00e5a0" : "#ff4d4d", fontWeight: 700 }}>{t.direction}</div>
                    <div style={{ fontSize: 11, color: "#7a9ab5" }}>₹{t.entryPrice}</div>
                    <div style={{ fontSize: 11, color: isOpen ? "#ffd700" : "#7a9ab5" }}>{isOpen ? `₹${t.currentPrice}*` : `₹${t.exitPrice}`}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}₹{t.pnl?.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: isWin ? "#00e5a0" : "#ff4d4d" }}>{isWin ? "+" : ""}{t.pnlPct?.toFixed(2)}%</div>
                    <div>{isOpen ? <Badge label="OPEN" color="#ffd700" bg="#ffd70011" /> : <Badge label={t.exitType} color={isWin ? "#00e5a0" : "#ff4d4d"} bg={isWin ? "#00e5a011" : "#ff4d4d11"} />}</div>
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
                <LineChart data={equityCurve}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#0a1a2a" />
                  <XAxis dataKey="date" stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} />
                  <YAxis stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: "#060c18", border: "1px solid #0e1e30", borderRadius: 6, fontFamily: "Courier New", fontSize: 11 }} formatter={v => [`₹${v.toLocaleString()}`, "Portfolio"]} />
                  <ReferenceLine y={500000} stroke="#1a3050" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="equity" stroke="#00e5a0" strokeWidth={2} dot={{ fill: "#00e5a0", r: 3 }} activeDot={{ r: 5, fill: "#00e5a0" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly P&L bars */}
            <div style={{ background: "#070e1a", border: "1px solid #0e1e30", borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 12 }}>📊 MONTHLY P&L</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyBars}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#0a1a2a" />
                  <XAxis dataKey="month" stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} />
                  <YAxis stroke="#1a3050" tick={{ fontSize: 10, fill: "#3a5570", fontFamily: "Courier New" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: "#060c18", border: "1px solid #0e1e30", borderRadius: 6, fontFamily: "Courier New", fontSize: 11 }} formatter={v => [`₹${v.toLocaleString()}`, "P&L"]} />
                  <Bar dataKey="pnl" fill="#00e5a0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "TOTAL RETURN", value: `+${totalReturn}%`, sub: "Since inception", color: "#00e5a0" },
                { label: "WIN RATE", value: `${winRate}%`, sub: `${closedTrades.filter(t=>t.pnl>0).length} wins / ${closedTrades.filter(t=>t.pnl<0).length} losses`, color: "#ffd700" },
                { label: "AVG WIN", value: `₹${Math.round(closedTrades.filter(t=>t.pnl>0).reduce((s,t)=>s+t.pnl,0) / Math.max(closedTrades.filter(t=>t.pnl>0).length,1)).toLocaleString()}`, sub: "Per winning trade", color: "#00e5a0" },
                { label: "AVG LOSS", value: `₹${Math.round(closedTrades.filter(t=>t.pnl<0).reduce((s,t)=>s+Math.abs(t.pnl),0) / Math.max(closedTrades.filter(t=>t.pnl<0).length,1)).toLocaleString()}`, sub: "Per losing trade", color: "#ff4d4d" },
                { label: "BEST TRADE", value: `+₹${Math.max(...trades.map(t=>t.pnl)).toLocaleString()}`, sub: "TCS SWING — T2 hit", color: "#00e5a0" },
                { label: "MAX LOSS", value: `-₹${Math.abs(Math.min(...trades.map(t=>t.pnl))).toLocaleString()}`, sub: "HDFCBANK INTRADAY", color: "#ff4d4d" },
              ].map(({ label, value, sub, color }) => (
                <StatCard key={label} label={label} value={value} sub={sub} color={color} small />
              ))}
            </div>

            {/* Conviction notice */}
            <div style={{ background: "#070e1a", border: "1px solid #ffd70033", borderRadius: 8, padding: 14, marginTop: 12 }}>
              <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 2, marginBottom: 8 }}>⏳ CONVICTION TIMELINE</div>
              <div style={{ display: "flex", gap: 0 }}>
                {[
                  { label: "Month 1", desc: "System learning. Sample size too small. Monitor only.", done: true, color: "#ffd700" },
                  { label: "Month 2", desc: "Pattern forming. Win rate above 60%? Consider pilot.", done: false, color: "#3a5570" },
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
