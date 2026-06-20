"use client"

import { useState } from "react"
import { useScanResults, useSectorRotation, useDivergences, useInvalidateAll } from "@/hooks/useMarketData"
import { ScanResult, SectorRotationResponse, DivergenceAlert } from "@/lib/api"
import { ArrowUpRight, TrendingUp, AlertTriangle, Activity, RefreshCw, Zap, Target, TrendingDown, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { InfoTooltip } from "@/components/ui/InfoTooltip"

export default function MarketOverview() {
  const { data: opportunities = [], isLoading: isLoadingScan, isFetching: isFetchingScan } = useScanResults()
  const { data: sectors = null, isLoading: isLoadingSectors } = useSectorRotation()
  const { data: alerts = [], isLoading: isLoadingAlerts } = useDivergences()
  const invalidateAll = useInvalidateAll()
  
  const loading = isLoadingScan || isLoadingSectors || isLoadingAlerts
  const refreshing = isFetchingScan

  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)

  // Filters
  const [filterTopGrades, setFilterTopGrades] = useState(false)
  const [hideFlagged, setHideFlagged] = useState(false)
  const [sortFinalDesc, setSortFinalDesc] = useState(true)

  const refreshData = async () => {
    await invalidateAll()
  }

  const getRecommendationColor = (rec: string) => {
    if (rec.includes('STRONG BUY')) return 'text-green-600 bg-green-50'
    if (rec.includes('BUY')) return 'text-green-600 bg-green-50'
    if (rec.includes('SELL')) return 'text-red-600 bg-red-50'
    return 'text-muted-foreground bg-muted'
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getSectorSignalColor = (signal: string) => {
    if (signal === 'ROTATING_IN') return 'border-green-500 text-green-600 bg-green-50'
    if (signal === 'ROTATING_OUT') return 'border-red-500 text-red-600 bg-red-50'
    return 'border-muted-foreground text-muted-foreground bg-muted'
  }

  // ── UI-only style helpers ────────────────────────────────────────────────
  const glass: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    backdropFilter: "blur(24px)",
  }

  const recChip = (rec: string): React.CSSProperties => {
    if (rec.includes("STRONG BUY")) return { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }
    if (rec.includes("BUY"))        return { background: "rgba(45,212,191,0.12)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.25)" }
    if (rec.includes("SELL"))       return { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }
    return { background: "rgba(100,116,139,0.12)", color: "#64748b", border: "1px solid rgba(100,116,139,0.2)" }
  }

  const scoreGlow = (score: number) => {
    if (score >= 80) return { color: "#34d399" }
    if (score >= 60) return { color: "#fbbf24" }
    if (score >= 40) return { color: "#f97316" }
    return { color: "#f87171" }
  }

  const sectorChip = (signal: string): React.CSSProperties => {
    if (signal === "ROTATING_IN")  return { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
    if (signal === "ROTATING_OUT") return { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }
    return { background: "rgba(100,116,139,0.1)", color: "#64748b", border: "1px solid rgba(100,116,139,0.18)" }
  }

  const rsTrendChip = (trend: string): React.CSSProperties => {
    if (trend === "UP")   return { background: "rgba(52,211,153,0.12)", color: "#34d399" }
    if (trend === "DOWN") return { background: "rgba(248,113,113,0.12)", color: "#f87171" }
    return { background: "rgba(100,116,139,0.1)", color: "#64748b" }
  }

  const getGradeStyle = (grade: string): React.CSSProperties => {
    switch (grade) {
      case 'A+': return { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" };
      case 'A': return { background: "rgba(45,212,191,0.15)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.3)" };
      case 'B': return { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" };
      case 'C': return { background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" };
      case 'SKIP': return { background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" };
      default: return { background: "rgba(100,116,139,0.1)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.2)" };
    }
  }

  const severityChip = (sev: string): React.CSSProperties =>
    sev === "HIGH"
      ? { background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }
      : { background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }

  const chip: React.CSSProperties = {
    display: "inline-flex", alignItems: "center",
    padding: "3px 10px", borderRadius: 8,
    fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
  }

  const cardHead: React.CSSProperties = {
    padding: "20px 24px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  }

  const spinnerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: 200, color: "#334155",
  }

  return (
    <div style={{ minHeight: "100vh", padding: "40px 24px", background: "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)", fontFamily: "'DM Sans','Inter',sans-serif" }}>

      {/* ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.07) 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.07) 0%,transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }} />
              <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#38bdf8", textTransform: "uppercase", fontWeight: 600 }}>Smart Money Engine</span>
            </div>
            <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
              Market{" "}
              <span style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Scan</span>
            </h2>
            <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 14, fontWeight: 500 }}>Real-time institutional activity and smart money opportunities.</p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Link
              href="/screener"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 12, color: "#818cf8", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", backdropFilter: "blur(12px)", transition: "all 0.2s", textDecoration: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(129,140,248,0.2)"; e.currentTarget.style.color = "#a5b4fc" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(129,140,248,0.1)"; e.currentTarget.style.color = "#818cf8" }}
            >
              <Target size={14} />
              Screener
            </Link>
            <button
              onClick={refreshData}
              disabled={refreshing}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#94a3b8", fontSize: 13, fontWeight: 500, cursor: refreshing ? "not-allowed" : "pointer", backdropFilter: "blur(12px)", opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s" }}
            >
            <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh Data
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
          {[
            { label: "Top Opportunities", value: opportunities.filter((o: any) => o.compositeScore > 70).length, sub: "High conviction scores", icon: <Zap size={15} color="#34d399" />, glow: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)", numColor: "#34d399" },
            { label: "Active Alerts", value: alerts.filter((a: any) => a.severity === 'HIGH').length, sub: "High severity divergences", icon: <AlertTriangle size={15} color="#fbbf24" />, glow: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", numColor: "#fbbf24" },
            { label: "Sector Leaders", value: sectors?.leaders?.length || 0, sub: "Outperforming sectors", icon: <TrendingUp size={15} color="#38bdf8" />, glow: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.2)", numColor: "#38bdf8" },
            { label: "Total Stocks", value: opportunities.length, sub: "In current scan", icon: <Activity size={15} color="#818cf8" />, glow: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.2)", numColor: "#818cf8" },
          ].map((m) => (
            <div key={m.label} style={{ ...glass, padding: "18px 20px", background: m.glow, borderColor: m.border }}>
              <div style={{ marginBottom: 10 }}>{m.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: m.numColor, letterSpacing: "-0.02em", lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500, marginTop: 4 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Two-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>

          {/* Top Opportunities */}
          <div style={glass}>
            <div style={cardHead}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Target size={15} color="#818cf8" />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Top Accumulation Opportunities</span>
                <InfoTooltip 
                  title="Accumulation Scan" 
                  content="This list filters stocks where Smart Money (FIIs, DIIs) is buying heavily AND the price chart is forming a strong technical breakout or uptrend. Sorted by highest conviction." 
                />
              </div>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, fontWeight: 500 }}>Stocks showing strong institutional buying signals</p>
            </div>
            <div style={{ padding: "12px 24px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <button 
                onClick={() => setFilterTopGrades(!filterTopGrades)}
                style={{ ...chip, background: filterTopGrades ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)", color: filterTopGrades ? "#34d399" : "#94a3b8", border: filterTopGrades ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" }}
              >
                {filterTopGrades ? "Showing A+/A" : "Show A+/A Only"}
              </button>
              <button 
                onClick={() => setHideFlagged(!hideFlagged)}
                style={{ ...chip, background: hideFlagged ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.05)", color: hideFlagged ? "#f87171" : "#94a3b8", border: hideFlagged ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" }}
              >
                {hideFlagged ? "Flags Hidden" : "Hide Flagged"}
              </button>
              <button 
                onClick={() => setSortFinalDesc(!sortFinalDesc)}
                style={{ ...chip, background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" }}
              >
                Sort: {sortFinalDesc ? "Final Desc ↓" : "Final Asc ↑"}
              </button>
            </div>
            <div style={{ padding: "12px 0", maxHeight: "600px", overflowY: "auto" }}>
              {loading ? (
                <div style={spinnerStyle}><RefreshCw size={22} style={{ animation: "spin 1s linear infinite" }} /></div>
              ) : (
                <>
                  {(() => {
                    // Group by symbol to find base institutional records and other setups
                    const instMap = new Map();
                    const otherSetupsMap = new Map();
                    
                    opportunities.forEach((stock: any) => {
                      if (stock.setupType === 'CLASSIC_INSTITUTIONAL') {
                        instMap.set(stock.symbol, stock);
                      } else {
                        if (!otherSetupsMap.has(stock.symbol)) {
                          otherSetupsMap.set(stock.symbol, []);
                        }
                        otherSetupsMap.get(stock.symbol).push(stock.setupType);
                      }
                    });

                    const instOpportunities = Array.from(instMap.values());

                    return instOpportunities
                      .filter(stock => {
                        if (filterTopGrades && stock.grade !== 'A+' && stock.grade !== 'A') return false;
                        if (hideFlagged && stock.flags && stock.flags.length > 0) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        const scoreA = a.compositeScore || a.finalScore;
                        const scoreB = b.compositeScore || b.finalScore;
                        return sortFinalDesc ? scoreB - scoreA : scoreA - scoreB;
                      })
                      .slice(0, 15)
                      .map((stock) => {
                        const final = stock.finalScore || stock.compositeScore;
                        const inst = stock.compositeScore;
                        const tech = stock.technicalScore || 0;
                        const grade = stock.grade || 'N/A';
                        const action = stock.action || stock.recommendation || 'No Action';
                        const flags = stock.flags || [];
                        const isExpanded = expandedSymbol === stock.symbol;
                        const streak = stock.streakDays || 0;
                        
                        const otherSetups = otherSetupsMap.get(stock.symbol) || [];

                        // Strategy advice based on streak
                        const getStreakAdvice = (days: number, g: string) => {
                          if (days === 0) return null;
                          if (days === 1) return `🆕 First day at ${g} — Wait 1 day to confirm stability`;
                          if (days === 2) return `✅ 2-day streak at ${g} — Confirmed! Enter at pivot price`;
                          if (days === 3) return `🔥 3-day streak at ${g} — Strong conviction, full position`;
                          if (days <= 5) return `⚡ ${days}-day streak — Peak accumulation phase, ride the wave`;
                          if (days <= 8) return `⚠️ ${days}-day streak — Entry window narrowing, tighten SL`;
                          return `🔶 ${days}-day streak — Late stage. Wait for pullback or next cycle`;
                        };

                        return (
                        <div key={`${stock.symbol}-${stock.setupType}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div
                          onClick={() => setExpandedSymbol(isExpanded ? null : stock.symbol)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", gap: 12, transition: "background 0.15s", cursor: "pointer", background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent" }}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,rgba(56,189,248,0.15),rgba(129,140,248,0.15))", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#7dd3fc", flexShrink: 0 }}>
                              {stock.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{stock.symbol}</span>
                                {grade !== 'N/A' && (
                                  <span style={{ ...chip, ...getGradeStyle(grade), fontSize: 10, padding: "2px 6px" }}>{grade}</span>
                                )}
                                {/* Streak Badge */}
                                {streak >= 1 && (
                                  <span 
                                    title={getStreakAdvice(streak, grade) || ''}
                                    style={{ 
                                      ...chip, 
                                      fontSize: 10, 
                                      padding: "2px 8px", 
                                      cursor: "help",
                                      background: streak >= 3 ? "rgba(251,146,60,0.15)" : "rgba(129,140,248,0.12)", 
                                      color: streak >= 3 ? "#fb923c" : "#a5b4fc", 
                                      border: streak >= 3 ? "1px solid rgba(251,146,60,0.3)" : "1px solid rgba(129,140,248,0.25)",
                                      boxShadow: streak >= 3 ? "0 0 8px rgba(251,146,60,0.2)" : "none",
                                    }}
                                  >
                                    {streak >= 3 ? "🔥" : "📊"} {streak}d streak
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, ...scoreGlow(final) }}>Final: {final}</span>
                                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>· Inst: {inst}</span>
                                {tech > 0 && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>· Tech: {tech}</span>}
                                
                                {otherSetups.map((setup: string) => (
                                  <span key={setup} style={{ ...chip, background: "rgba(167,139,250,0.1)", color: "#c084fc", border: "1px solid rgba(167,139,250,0.25)", fontSize: 9, padding: "1px 6px" }}>
                                    Also triggered: {setup.replace(/_/g, ' ')}
                                  </span>
                                ))}
                                
                                {flags.length > 0 && flags.map((f: string) => (
                                  <span key={f} style={{ ...chip, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", fontSize: 9, padding: "1px 4px" }}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                              {/* Streak strategy hint when >= 2 days */}
                              {streak >= 2 && (
                                <div style={{ fontSize: 11, marginTop: 5, color: streak >= 3 ? "#fb923c" : "#a5b4fc", fontWeight: 500 }}>
                                  {getStreakAdvice(streak, grade)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, maxWidth: 200, justifyContent: "flex-end" }}>
                            <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={action}>
                              {action}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", color: "#64748b", marginLeft: 4 }}>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Panel */}
                        {isExpanded && (
                          <div style={{ padding: "20px 24px", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.02)" }}>
                            
                            {/* Actions Header */}
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                              <Link href={`/stocks/${stock.symbol}/footprint`} style={{ ...chip, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", textDecoration: "none", gap: 6 }}>
                                Full Analysis <ArrowUpRight size={13} />
                              </Link>
                            </div>

                            {/* Trade Card (A or A+) */}
                            {(grade === 'A+' || grade === 'A') && stock.levels && (
                              <div style={{ marginBottom: 20, padding: 16, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 12 }}>
                                <h4 style={{ margin: "0 0 14px", color: "#34d399", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                                  <Zap size={14} color="#34d399" /> High Conviction Trade Setup
                                </h4>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 16 }}>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>ENTRY POINT</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>₹{stock.levels.pivotPrice}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>STOP LOSS</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>₹{stock.levels.stopLoss}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>TARGET 1</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>₹{stock.levels.target1}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>TARGET 2</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>₹{stock.levels.target2}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>RISK/REWARD</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#38bdf8" }}>{stock.levels.rrRatio}:1</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Checklist Panel */}
                            {stock.preTradeChecklist ? (
                              <div>
                                <h4 style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                  Pre-Trade Checklist <span style={{ color: "#e2e8f0", marginLeft: 4 }}>({stock.checklistScore})</span>
                                </h4>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px 16px" }}>
                                  {Object.entries(stock.preTradeChecklist).map(([key, passed]) => (
                                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: passed ? "#e2e8f0" : "#64748b" }}>
                                      {passed ? <CheckCircle2 size={15} color="#34d399" /> : <XCircle size={15} color="#64748b" />}
                                      <span style={{ opacity: passed ? 1 : 0.6 }}>
                                        {key.replace(/([A-Z])/g, ' $1').replace(/_gte70|_/g, ' ').toLowerCase().replace(/^./, str => str.toUpperCase())}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
                                Detailed checklist data is only available for fully processed entries.
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
                  {opportunities.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 24px", color: "#334155", fontSize: 13 }}>
                      Run the data pipeline to generate opportunities
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sector Rotation */}
          <div style={glass}>
            <div style={cardHead}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <TrendingUp size={15} color="#38bdf8" />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Sector Rotation Analysis</span>
                <InfoTooltip 
                  title="Sector Rotation" 
                  content="Tracks where institutional money is moving. 'Outperforming' sectors are gaining strength, while 'Lagging' sectors are facing distribution (selling)." 
                />
              </div>
              <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Institutional money flow across sectors</p>
            </div>
            <div style={{ padding: "12px 0" }}>
              {loading ? (
                <div style={spinnerStyle}><RefreshCw size={22} style={{ animation: "spin 1s linear infinite" }} /></div>
              ) : (
                sectors?.all.slice(0, 8).map((sector) => (
                  <div
                    key={sector.indexName}
                    style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                        {sector.indexName.replace('NIFTY_', '').replace('_', ' ')}
                      </span>
                      <span style={{ ...chip, ...sectorChip(sector.rotationSignal) }}>
                        {sector.rotationSignal.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>RS:</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{sector.rsCurrent}</span>
                        <span style={{ ...chip, fontSize: 10, padding: "2px 8px", borderRadius: 6, ...rsTrendChip(sector.rsTrend) }}>{sector.rsTrend}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
                        ₹{sector.close.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Divergence Alerts */}
        {alerts.length > 0 && (
          <div style={{ ...glass, background: "rgba(251,191,36,0.03)", borderColor: "rgba(251,191,36,0.15)" }}>
            <div style={{ ...cardHead, borderBottomColor: "rgba(251,191,36,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={15} color="#fbbf24" />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#fbbf24" }}>Active Divergence Alerts</span>
              </div>
              <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Price action diverging from institutional footprint</p>
            </div>
            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {alerts.slice(0, 5).map(alert => (
                <div
                  key={`${alert.symbol}-${alert.alertType}-${alert.date}`}
                  style={{ padding: "16px 18px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 14 }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{alert.symbol}</span>
                      <span style={{ ...chip, background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                        {alert.alertType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span style={{ ...chip, ...severityChip(alert.severity) }}>{alert.severity}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>{alert.message}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8" }}>{alert.actionRecommendation}</span>
                    <span style={{ fontSize: 11, color: "#475569" }}>
                      Expected: {alert.expectedMove} · Confidence: {alert.confidence}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}