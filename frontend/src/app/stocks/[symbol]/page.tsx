"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getStockDetail, getStockAnalysis, Stock, StockRecommendation } from "@/lib/api"
import { ArrowLeft, RefreshCw, AlertTriangle, Info, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500 stroke-emerald-500 fill-emerald-500 bg-emerald-500";
    if (score >= 60) return "text-green-500 stroke-green-500 fill-green-500 bg-green-500";
    if (score >= 40) return "text-slate-400 stroke-slate-400 fill-slate-400 bg-slate-400";
    return "text-rose-500 stroke-rose-500 fill-rose-500 bg-rose-500";
}

const DetailScoreBar = ({ label, score, barColor }: { label: string, score: number, barColor: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#94a3b8" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>{Math.round(score)}</span>
        </div>
        <div style={{ height: 4, width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ height: "100%", borderRadius: 99, background: barColor }}
            />
        </div>
    </div>
)

export default function StockDetailPage() {
    const { symbol } = useParams()
    const [stock, setStock] = useState<Stock | null>(null)
    const [analysis, setAnalysis] = useState<StockRecommendation | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!symbol) return

        const fetchData = async () => {
            setLoading(true)
            try {
                const symbolStr = Array.isArray(symbol) ? symbol[0] : symbol
                const [stockData, analysisData] = await Promise.all([
                    getStockDetail(symbolStr),
                    getStockAnalysis(symbolStr)
                ])
                setStock(stockData)
                setAnalysis(analysisData)
            } catch (err) {
                console.error("Failed to fetch stock data", err)
                setError("Failed to load stock data. Please check if the symbol exists.")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [symbol])

    // ── UI-only helpers ──────────────────────────────────────────────────────
    const scoreGradient = (score: number) => {
        if (score >= 80) return "linear-gradient(135deg,#34d399,#2dd4bf)"
        if (score >= 60) return "linear-gradient(135deg,#a3e635,#34d399)"
        if (score >= 40) return "linear-gradient(135deg,#fbbf24,#f97316)"
        return "linear-gradient(135deg,#f87171,#ec4899)"
    }

    const scoreStroke = (score: number) => {
        if (score >= 80) return "#34d399"
        if (score >= 60) return "#a3e635"
        if (score >= 40) return "#fbbf24"
        return "#f87171"
    }

    const scoreGlow = (score: number) => {
        if (score >= 80) return "rgba(52,211,153,0.4)"
        if (score >= 60) return "rgba(163,230,53,0.35)"
        if (score >= 40) return "rgba(251,191,36,0.35)"
        return "rgba(248,113,113,0.35)"
    }

    const glass: React.CSSProperties = {
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        backdropFilter: "blur(24px)",
        overflow: "hidden",
    }

    const scoreColorClass = getScoreColor(analysis?.compositeScore || 0)

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ display: "flex", height: "60vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(56,189,248,0.2)", borderTopColor: "#38bdf8", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8" }}>Running Deep Analysis…</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    // ── Error ────────────────────────────────────────────────────────────────
    if (error) return (
        <div style={{ display: "flex", flexDirection: "column", height: "60vh", alignItems: "center", justifyContent: "center", gap: 16, background: "rgba(248,113,113,0.04)", borderRadius: 20, border: "1px dashed rgba(248,113,113,0.2)" }}>
            <AlertTriangle size={44} color="#f87171" />
            <p style={{ fontWeight: 700, color: "#f87171", fontSize: 14 }}>{error}</p>
            <Link href="/" style={{ padding: "10px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
                Return to Market
            </Link>
        </div>
    )

    return (
        <div
            style={{
                minHeight: "100vh",
                padding: "24px 40px",
                background: "radial-gradient(ellipse at 20% 20%, #0f2027 0%, #090d1f 40%, #020408 100%)",
                fontFamily: "'DM Sans','Inter',sans-serif",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Ambient glow orbs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
            </div>

            <div className="relative max-w-7xl mx-auto space-y-8">
                {/* ── Header ──────────────────────────────────────────────────────── */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
                        <Link href="/" style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", textDecoration: "none", flexShrink: 0, marginTop: 4, transition: "all 0.2s" }} onMouseEnter={e => {e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";}} onMouseLeave={e => {e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";}}>
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }} />
                                <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700 }}>Smart Money Engine</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                                <h1 style={{ fontSize: "clamp(2.5rem,6vw,4rem)", fontWeight: 900, letterSpacing: "-0.04em", color: "#f8fafc", lineHeight: 1, margin: 0 }}>{stock?.symbol}</h1>
                                <span style={{ padding: "6px 14px", borderRadius: 10, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", textTransform: "uppercase" }}>
                                    {stock?.sector?.replace("NIFTY_", "")}
                                </span>
                            </div>
                            <p style={{ fontSize: 18, fontWeight: 600, color: "#94a3b8", marginTop: 10 }}>{stock?.name}</p>
                        </div>
                    </div>

                    <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, color: "#cbd5e1", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", backdropFilter: "blur(12px)", transition: "all 0.2s" }} onMouseEnter={e => {e.currentTarget.style.background = "rgba(255,255,255,0.06)";}} onMouseLeave={e => {e.currentTarget.style.background = "rgba(255,255,255,0.03)";}}>
                        <RefreshCw size={14} /> Re-Scan Asset
                    </button>
                </div>

                {/* ── Main grid ───────────────────────────────────────────────────── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

                    {/* Left: Institutional Strength */}
                    <div style={{ ...glass, position: "relative" }}>
                        {/* Badge */}
                        <div style={{ position: "absolute", top: 24, right: 28, padding: "5px 12px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#94a3b8" }}>
                            Institutional Grade
                        </div>

                        <div style={{ padding: "28px 32px 16px" }}>
                            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#f8fafc" }}>Institutional Strength</div>
                            <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 6, fontWeight: 500 }}>Composite score based on real-time order flow and accumulation patterns.</p>
                        </div>

                        <div style={{ padding: "12px 32px 32px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 40 }}>

                            {/* Gauge */}
                            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="210" height="210" style={{ transform: "rotate(-90deg) scaleX(-1)" }}>
                                    <circle cx="105" cy="105" r="95" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="transparent" />
                                    <motion.circle
                                        initial={{ strokeDashoffset: 596.9 }}
                                        animate={{ strokeDashoffset: 596.9 - (596.9 * (analysis?.compositeScore || 0)) / 100 }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        cx="105" cy="105" r="95"
                                        stroke={scoreStroke(analysis?.compositeScore || 0)}
                                        strokeWidth="12"
                                        strokeDasharray="596.9"
                                        fill="transparent"
                                        strokeLinecap="round"
                                        style={{ filter: `drop-shadow(0 0 12px ${scoreGlow(analysis?.compositeScore || 0)})` }}
                                    />
                                </svg>
                                <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.5 }}
                                        style={{ fontSize: 64, fontWeight: 950, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", backgroundImage: scoreGradient(analysis?.compositeScore || 0), WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}
                                    >
                                        {Math.round(analysis?.compositeScore || 0)}
                                    </motion.span>
                                    <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.25em", color: "#94a3b8", marginTop: 2 }}>STRENGTH</span>
                                </div>
                            </div>

                            {/* Score bars */}
                            <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 24, padding: "24px 28px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20 }}>
                                <DetailScoreBar label="Institutional Flow" score={analysis?.scores.institutionalFlow || 0} barColor="#3b82f6" />
                                <DetailScoreBar label="Bulk Deal Confidence" score={analysis?.scores.bulkDeal || 0} barColor="#a78bfa" />
                                <DetailScoreBar label="OI Price Action" score={analysis?.scores.oiSignal || 0} barColor="#f97316" />
                                <DetailScoreBar label="Delivery Conviction" score={analysis?.scores.delivery || 0} barColor="#2dd4bf" />
                            </div>
                        </div>

                        {/* Interpretation */}
                        <div style={{ margin: "0 32px 32px", padding: "24px", background: "rgba(129,140,248,0.03)", borderLeft: "4px solid rgba(129,140,248,0.3)", borderRadius: "0 16px 16px 0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#818cf8" }}>
                                <Info size={14} />
                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em" }}>Market Interpretation</span>
                            </div>
                            <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.7, color: "#cbd5e1", fontStyle: "italic", margin: 0 }}>
                                "{analysis?.interpretation}"
                            </p>
                        </div>
                    </div>

                    {/* Right sidebar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                        {/* Financial Identity */}
                        <div style={glass}>
                            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1" }} />
                                <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Financial Identity</span>
                            </div>
                            <div style={{ padding: "8px 0" }}>
                                {[
                                    { label: "Sector Index", value: stock?.sector?.replace("NIFTY_", ""), badge: false },
                                    { label: "Industry Group", value: stock?.industry || "Blue Chip", badge: false },
                                    { label: "Market Capitalization", value: stock?.marketCap ? `₹${(stock.marketCap / 10000000).toFixed(0)} Cr` : "N/A", badge: false },
                                    { label: "F&O Listing", value: stock?.isFno ? "Enabled (Tier 1)" : "Cash Market", badge: true, color: stock?.isFno ? "#34d399" : "#94a3b8", bg: stock?.isFno ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.08)", border: stock?.isFno ? "rgba(52,211,153,0.25)" : "rgba(148,163,184,0.15)" },
                                    { label: "Smart Money Status", value: analysis?.compositeScore && analysis.compositeScore >= 60 ? "Active Accumulation" : "Monitoring", badge: true, color: analysis?.compositeScore && analysis.compositeScore >= 60 ? "#34d399" : "#94a3b8", bg: analysis?.compositeScore && analysis.compositeScore >= 60 ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.08)", border: analysis?.compositeScore && analysis.compositeScore >= 60 ? "rgba(52,211,153,0.25)" : "rgba(148,163,184,0.15)" },
                                ].map((item, idx) => (
                                    <div key={idx} style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", gap: 6 }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>{item.label}</span>
                                        {item.badge ? (
                                            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 800, width: "fit-content", background: item.bg, color: item.color, border: `1px solid ${item.border}`, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                                                {item.value}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{item.value}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Raw Market Data */}
                        <div style={glass}>
                            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                                <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Raw Market Data</span>
                            </div>
                            <div style={{ padding: "8px 0" }}>
                                {[
                                    { label: "Closing Price", value: analysis?.rawData?.close ? `₹${analysis.rawData.close}` : "N/A" },
                                    { label: "Volume", value: analysis?.rawData?.volume ? analysis.rawData.volume.toLocaleString() : "N/A" },
                                    { label: "Delivery %", value: analysis?.rawData?.deliveryPct ? `${analysis.rawData.deliveryPct.toFixed(2)}%` : "N/A" },
                                    { label: "OI Change %", value: analysis?.rawData?.oiChangePct ? `${analysis.rawData.oiChangePct > 0 ? '+' : ''}${analysis.rawData.oiChangePct.toFixed(2)}%` : "N/A", color: (analysis?.rawData?.oiChangePct || 0) > 0 ? "#34d399" : "#f87171" },
                                    { label: "OI Signal", value: analysis?.rawData?.oiSignal || "N/A" },
                                ].map((item, idx) => (
                                    <div key={idx} style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>{item.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: item.color || "#f8fafc", letterSpacing: "0.02em" }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Trade Signal */}
                        <div style={{ ...glass, background: "rgba(52,211,153,0.02)", borderColor: "rgba(52,211,153,0.15)" }}>
                            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(52,211,153,0.1)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399", animation: "pulse 2s infinite" }} />
                                    <span style={{ fontSize: 16, fontWeight: 800, color: "#34d399", letterSpacing: "-0.01em" }}>Trade Signal</span>
                                </div>
                            </div>
                            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ padding: "20px", background: "linear-gradient(135deg,#10b981,#059669)", borderRadius: 18, textAlign: "center", boxShadow: "0 12px 32px rgba(16,185,129,0.25)" }}>
                                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>Recommended Posture</p>
                                    <p style={{ fontSize: 24, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.02em", color: "#fff", margin: 0 }}>
                                        {analysis?.compositeScore && analysis.compositeScore >= 60 ? "Accumulate" : "Wait / Neutral"}
                                    </p>
                                </div>
                                <Link href={`/stocks/${stock?.symbol}/footprint`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#cbd5e1", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em", textDecoration: "none", transition: "all 0.2s" }} onMouseEnter={e => {e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff";}} onMouseLeave={e => {e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#cbd5e1";}}>
                                    View Full Footprint
                                    <ArrowUpRight size={16} />
                                </Link>
                            </div>
                        </div>

                    </div>
                </div>

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes pulse { 0%,100% { opacity:1; box-shadow: 0 0 10px #34d399; } 50% { opacity:0.6; box-shadow: 0 0 4px #34d399; } }
                `}</style>
            </div>
        </div>
    )
}