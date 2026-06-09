"use client"

import { useEffect, useState } from "react"
import { getHoldingDetail, getDeepAnalysis } from "@/lib/api"
import { ArrowLeft, RefreshCw, BrainCircuit, Activity, Target, ShieldAlert, Coins, Calendar, Info } from "lucide-react"
import Link from "next/link"
import ReactMarkdown from 'react-markdown'
import { useParams } from "next/navigation"

export default function HoldingAnalysisPage() {
    const params = useParams()
    const symbol = params.symbol as string

    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)

    const fetchDetails = async () => {
        setLoading(true)
        try {
            const detail = await getHoldingDetail(symbol)
            setData(detail)
            
            // Auto-trigger AI analysis on load
            triggerAiAnalysis()
        } catch (error) {
            console.error("Failed to fetch holding details", error)
        } finally {
            setLoading(false)
        }
    }

    const triggerAiAnalysis = async () => {
        setAnalyzing(true)
        try {
            const result = await getDeepAnalysis(symbol)
            setAiAnalysis(result.analysis)
        } catch (error) {
            setAiAnalysis("Failed to fetch AI analysis.")
        } finally {
            setAnalyzing(false)
        }
    }

    useEffect(() => {
        if (symbol) fetchDetails()
    }, [symbol])

    if (loading || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(ellipse at 20% 20%, #0f2027 0%, #090d1f 40%, #020408 100%)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#818cf8" }}>
                    <RefreshCw size={32} className="animate-spin mb-4" />
                    <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.05em" }}>LOADING HOLDING DATA...</span>
                </div>
                <style>{`.animate-spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const pnlIsPositive = data.performance.pnlAbsolute >= 0
    const dayChangeIsPositive = data.market.dayChangePct >= 0

    return (
        <div
            className="min-h-screen p-6 md:p-10"
            style={{
                background: "radial-gradient(ellipse at 20% 20%, #0f2027 0%, #090d1f 40%, #020408 100%)",
                fontFamily: "'DM Sans', 'Inter', sans-serif",
            }}
        >
            <div className="relative max-w-5xl mx-auto space-y-6">
                
                {/* Back Navigation */}
                <Link href="/portfolio" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, textDecoration: "none", fontWeight: 600, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                    <ArrowLeft size={16} /> Back to Portfolio
                </Link>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 24 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                            <span style={{ padding: "4px 10px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 6, color: "#7dd3fc", fontSize: 11, fontWeight: 800 }}>
                                {data.portfolio.trade_type === 'MANUAL' ? 'MANUAL TRADE' : 'WATCHLIST'}
                            </span>
                            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{data.journal?.strategy_name || "Discretionary"}</span>
                        </div>
                        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1 }}>{symbol}</h1>
                    </div>
                    
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 36, fontWeight: 700, color: "#fff", fontFamily: "monospace", lineHeight: 1 }}>
                            ₹{data.market.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: dayChangeIsPositive ? "#34d399" : "#f87171", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                            {dayChangeIsPositive ? "▲" : "▼"} {Math.abs(data.market.dayChangePct).toFixed(2)}% Today
                        </div>
                    </div>
                </div>

                {/* Primary Metrics Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                    {/* PnL Card */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: pnlIsPositive ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(248,113,113,0.3)", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 4, background: pnlIsPositive ? "#34d399" : "#f87171" }} />
                        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Total PnL</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: pnlIsPositive ? "#34d399" : "#f87171", fontFamily: "monospace", letterSpacing: "-0.02em" }}>
                            {pnlIsPositive ? "+" : "-"}₹{Math.abs(data.performance.pnlAbsolute).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: pnlIsPositive ? "#10b981" : "#ef4444", marginTop: 4 }}>
                            {pnlIsPositive ? "+" : ""}{data.performance.pnlPct.toFixed(2)}%
                        </div>
                    </div>

                    {/* Invested Card */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Invested Amount</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
                            ₹{data.performance.invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, fontWeight: 600 }}>
                            {data.portfolio.quantity} shares @ ₹{data.portfolio.buyPrice}
                        </div>
                    </div>

                    {/* Current Value Card */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Current Value</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
                            ₹{data.performance.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
                    
                    {/* Left Column: AI Analysis & Rationale */}
                    <div className="space-y-6">
                        {/* Deep LLM Analysis */}
                        <div style={{ background: "linear-gradient(145deg, rgba(30,27,75,0.6), rgba(15,23,42,0.8))", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 20, padding: 32, backdropFilter: "blur(40px)", boxShadow: "0 10px 40px rgba(139,92,246,0.1)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <BrainCircuit color="#c084fc" size={24} />
                                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Portfolio AI Recommendation</h2>
                                </div>
                                <button onClick={triggerAiAnalysis} disabled={analyzing} style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, padding: "8px 12px", color: "#c084fc", fontSize: 12, fontWeight: 600, cursor: analyzing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                                    <RefreshCw size={12} className={analyzing ? "animate-spin" : ""} />
                                    {analyzing ? "Analyzing..." : "Re-Analyze"}
                                </button>
                            </div>
                            
                            <div className="prose prose-invert prose-indigo" style={{ color: "#cbd5e1", lineHeight: 1.7 }}>
                                {analyzing && !aiAnalysis ? (
                                    <div style={{ color: "#8b5cf6", fontSize: 14, fontWeight: 500, fontStyle: "italic" }}>Consulting market conditions and technical setup...</div>
                                ) : (
                                    <ReactMarkdown>{aiAnalysis || ""}</ReactMarkdown>
                                )}
                            </div>
                        </div>

                        {/* Trade Rationale */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 24 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <Info color="#94a3b8" size={18} />
                                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Trade Rationale (At Entry)</h3>
                            </div>
                            <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, background: "rgba(0,0,0,0.2)", padding: 16, borderRadius: 12 }}>
                                {data.portfolio.entryReason || data.journal?.entry_reason || "No explicit reason logged for this trade."}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Technicals & Targets */}
                    <div className="space-y-6">
                        {/* Target & SL Card */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 24 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 20 }}>Trade Execution Plan</h3>
                            
                            <div className="space-y-4">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#34d399", fontSize: 13, fontWeight: 600 }}>
                                        <Target size={16} /> Target Price
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
                                        {data.portfolio.targetPrice ? `₹${data.portfolio.targetPrice}` : "Not Set"}
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f87171", fontSize: 13, fontWeight: 600 }}>
                                        <ShieldAlert size={16} /> Stop Loss
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
                                        {data.portfolio.stopLoss ? `₹${data.portfolio.stopLoss}` : "Not Set"}
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
                                        <Calendar size={16} /> Entry Date
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>
                                        {data.journal?.entry_date ? new Date(data.journal.entry_date).toLocaleDateString() : "Unknown"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Current Technical Score */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Latest Technical Scan</h3>
                                <Link href={`/stocks/${symbol}/footprint`} style={{ fontSize: 11, color: "#38bdf8", textDecoration: "none", fontWeight: 700 }}>FULL FOOTPRINT ↗</Link>
                            </div>
                            
                            {data.technical ? (
                                <div className="space-y-6">
                                    {/* Inst Score */}
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Institutional Score</span>
                                            <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{data.technical.institutionalScore}/100</span>
                                        </div>
                                        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${data.technical.institutionalScore}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", borderRadius: 3 }} />
                                        </div>
                                    </div>
                                    {/* Tech Score */}
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Technical Score</span>
                                            <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{data.technical.technicalScore}/100</span>
                                        </div>
                                        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${data.technical.technicalScore}%`, background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 3 }} />
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8 }}>
                                        <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Current Grade:</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: ["A+", "A"].includes(data.technical.grade) ? "#34d399" : ["B+", "B"].includes(data.technical.grade) ? "#fbbf24" : "#f87171" }}>
                                            {data.technical.grade}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 20 }}>No scanner data available.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
