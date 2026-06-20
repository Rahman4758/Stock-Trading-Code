"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { getStockDetail, getStockAnalysis, getFootprint, getAllStocks, Stock, StockRecommendation, FootprintChartResponse, FootprintDataPoint, trackPortfolio } from "@/lib/api"
import { ArrowLeft, Plus, Activity, AlertTriangle, TrendingUp, BarChart3, PieChart, Calendar, GitCompareArrows } from "lucide-react"
import Link from "next/link"
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area } from "recharts"
import { motion } from "framer-motion"
import { InfoTooltip } from "@/components/ui/InfoTooltip"
import AIAgentChat from "@/components/ui/AIAgentChat"

const RANGE_PRESETS = [
    { label: "1M",  days: 30  },
    { label: "3M",  days: 90  },
    { label: "6M",  days: 180 },
    { label: "1Y",  days: 365 },
]

const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500 bg-emerald-500";
    if (score >= 60) return "text-green-500 bg-green-500";
    if (score >= 40) return "text-slate-400 bg-slate-400";
    return "text-rose-500 bg-rose-500";
}

export default function FootprintPage() {
    const params = useParams()
    const symbol = params.symbol as string

    const [stock, setStock] = useState<Stock | null>(null)
    const [analysis, setAnalysis] = useState<StockRecommendation | null>(null)
    const [chartData, setChartData] = useState<FootprintChartResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [days, setDays] = useState(90)
    const [chartLoading, setChartLoading] = useState(false)
    // Compare modal state
    const router = useRouter()
    const [compareOpen, setCompareOpen] = useState(false)
    const [allStocks, setAllStocks] = useState<Stock[]>([])
    const [stockSearch, setStockSearch] = useState("")
    const [stocksLoading, setStocksLoading] = useState(false)

    const openCompareModal = async () => {
        setCompareOpen(true)
        if (allStocks.length === 0) {
            setStocksLoading(true)
            const list = await getAllStocks().catch(() => [])
            setAllStocks(list.filter(s => s.symbol !== symbol.toUpperCase()))
            setStocksLoading(false)
        }
    }

    // Initial full load (stock + analysis + chart)
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [sData, aData, cData] = await Promise.all([
                    getStockDetail(symbol),
                    getStockAnalysis(symbol).catch(() => null),
                    getFootprint(symbol, days)
                ])
                setStock(sData)
                setAnalysis(aData)
                setChartData(cData)
            } catch (error) {
                console.error("Failed to fetch stock details", error)
            } finally {
                setLoading(false)
            }
        }
        if (symbol) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol])

    // Refetch only chart data when days changes (skip on first mount)
    const fetchChart = useCallback(async (d: number) => {
        if (!symbol) return
        setChartLoading(true)
        try {
            const cData = await getFootprint(symbol, d)
            setChartData(cData)
        } catch (e) {
            console.error("Chart refetch failed", e)
        } finally {
            setChartLoading(false)
        }
    }, [symbol])

    const handleRangeChange = (d: number) => {
        setDays(d)
        fetchChart(d)
    }

    const handleTrack = async () => {
        try {
            await trackPortfolio(symbol, chartData?.chartData?.[chartData.chartData.length - 1]?.close || 0, 100)
            alert("Added to portfolio tracker")
        } catch (e: any) {
            const errorMsg = e.response?.data?.detail || e.response?.data?.error || e.message;
            alert("Failed to track: " + errorMsg);
        }
    }

    // ── UI-only helpers ──────────────────────────────────────────────────────
    const scoreGradient = (score: number) => {
        if (score >= 80) return "linear-gradient(135deg,#34d399,#2dd4bf)"
        if (score >= 60) return "linear-gradient(135deg,#a3e635,#34d399)"
        if (score >= 40) return "linear-gradient(135deg,#fbbf24,#f97316)"
        return "linear-gradient(135deg,#f87171,#ec4899)"
    }

    const scoreGlow = (score: number) => {
        if (score >= 80) return "rgba(52,211,153,0.4)"
        if (score >= 60) return "rgba(163,230,53,0.35)"
        if (score >= 40) return "rgba(251,191,36,0.35)"
        return "rgba(248,113,113,0.35)"
    }

    const fiiColor = (val: number) => val > 0 ? "#34d399" : "#f87171"

    const glass: React.CSSProperties = {
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        backdropFilter: "blur(24px)",
        overflow: "hidden",
    }

    const chartCard = (tint: string): React.CSSProperties => ({
        ...glass,
        background: `rgba(${tint},0.03)`,
        borderColor: `rgba(${tint},0.12)`,
    })

    const metricCard: React.CSSProperties = {
        ...glass,
        padding: "20px 22px",
    }

    const metricLabel: React.CSSProperties = {
        fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
        textTransform: "uppercase", color: "#334155",
        display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
    }

    const tooltipStyle = {
        contentStyle: {
            background: "rgba(9,13,31,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            fontSize: 12,
            fontWeight: 600,
            color: "#e2e8f0",
        },
        labelStyle: {
            color: "#f1f5f9",
            fontWeight: 700,
            marginBottom: 4,
        },
        itemStyle: {
            color: "#94a3b8",
        },
        formatter: (value: any, name: string) => {
            if (typeof value === 'number') return [Number(value.toFixed(2)), name];
            return [value, name];
        },
    }

    // ── Loading / error states ───────────────────────────────────────────────
    if (loading) return (
        <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)", flexDirection: "column", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(56,189,248,0.2)", borderTopColor: "#38bdf8", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#334155" }}>Scanning Order Flow…</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    if (!stock) return (
        <div style={{ padding: 40, textAlign: "center", color: "#f87171", fontSize: 14 }}>Stock not found</div>
    )

    // Filter out weekend/holiday fake candles by ensuring volume > 0
    const validCandles = chartData?.chartData?.filter(d => d.volume > 0) || []
    const latest = validCandles.length > 0 ? validCandles[validCandles.length - 1] : (chartData?.chartData[chartData?.chartData.length - 1] || null)
    
    // We keep latestFii separate just in case FII data is published with a delay
    const latestFii = chartData?.chartData ? [...chartData.chartData].reverse().find(d => d.fiiBuy != null) : null
    const latestDelivery = validCandles.length > 0 ? [...validCandles].reverse().find(d => d.deliveryPct > 0) : null
    const scoreColorClass = getScoreColor(analysis?.compositeScore || 0)

    const latestCmf = latest?.cmf ?? null
    let cmfConviction = "Neutral"
    let cmfColor = "#64748b" // Slate

    if (latestCmf !== null) {
        if (latestCmf >= 0.25) {
            cmfConviction = "Strong Accumulation (Bullish)"
            cmfColor = "#10b981" // Emerald
        } else if (latestCmf >= 0.10) {
            cmfConviction = "Mild Accumulation (Bullish Bias)"
            cmfColor = "#34d399" // Mint
        } else if (latestCmf <= -0.25) {
            cmfConviction = "Strong Distribution (Bearish)"
            cmfColor = "#f43f5e" // Rose
        } else if (latestCmf <= -0.10) {
            cmfConviction = "Mild Distribution (Bearish Bias)"
            cmfColor = "#fb7185" // Light Rose
        } else {
            cmfConviction = "Neutral / No Conviction"
            cmfColor = "#94a3b8" // Slate
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ minHeight: "100vh", padding: "40px 24px", background: "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)", fontFamily: "'DM Sans','Inter',sans-serif", display: "flex", flexDirection: "column", gap: 28 }}
        >
            {/* ambient orbs */}
            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
                <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.07) 0%,transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.07) 0%,transparent 70%)" }} />
            </div>

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 28 }}>

                {/* ── Header ──────────────────────────────────────────────────── */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                    <button onClick={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", cursor: "pointer", flexShrink: 0 }}>
                        <ArrowLeft size={16} />
                    </button>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <h2 style={{ fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.04em", lineHeight: 1, margin: 0, textTransform: "uppercase" }}>{stock.symbol}</h2>
                            {analysis?.compositeScore && (
                                <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", backgroundImage: scoreGradient(analysis.compositeScore), color: "#fff", boxShadow: `0 0 16px ${scoreGlow(analysis.compositeScore)}` }}>
                                    {analysis.compositeScore >= 60 ? "Active Signals" : "Neutral"}
                                </span>
                            )}
                        </div>
                        <p style={{ color: "#475569", fontSize: 14, margin: "6px 0 0", fontWeight: 500 }}>
                            {stock.name} ·{" "}
                            <span style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 700 }}>{stock.sector} Flow</span>
                        </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, backdropFilter: "blur(20px)", flexWrap: "wrap" }}>
                        <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: 20 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#334155", marginBottom: 4 }}>Live Quote</div>
                            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", letterSpacing: "-0.03em", color: "#f1f5f9" }}>₹{latest?.close?.toLocaleString() || "---"}</div>
                        </div>
                        <button onClick={handleTrack} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 22px", background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                            <Plus size={15} /> Add to Watchlist
                        </button>
                        <button onClick={openCompareModal} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 22px", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.35)", borderRadius: 12, color: "#a78bfa", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                            <GitCompareArrows size={15} /> Compare
                        </button>
                    </div>
                </div>

                {/* ── Date range selector ──────────────────────────────────────── */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#334155" }}>
                        <Calendar size={11} /> Data Range
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        {RANGE_PRESETS.map(p => (
                            <button
                                key={p.label}
                                onClick={() => handleRangeChange(p.days)}
                                style={{
                                    padding: "6px 16px",
                                    borderRadius: 99,
                                    border: days === p.days ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.08)",
                                    background: days === p.days ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.03)",
                                    color: days === p.days ? "#38bdf8" : "#475569",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.1em",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {chartLoading && (
                        <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.2)", borderTopColor: "#38bdf8", animation: "spin 0.8s linear infinite" }} />
                    )}
                </div>

                {/* ── Metric cards ─────────────────────────────────────────────── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>

                    {/* Inst. Strength */}
                    <div style={metricCard}>
                        <div style={metricLabel}><Activity size={11} /> Inst. Strength</div>
                        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", backgroundImage: scoreGradient(analysis?.compositeScore || 0), WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
                            {Math.round(analysis?.compositeScore || 0)}
                        </div>
                        <div style={{ marginTop: 10, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${analysis?.compositeScore || 0}%` }}
                                style={{ height: "100%", borderRadius: 99, backgroundImage: scoreGradient(analysis?.compositeScore || 0) }}
                            />
                        </div>
                    </div>

                    {/* FII Flow */}
                    <div style={metricCard}>
                        <div style={metricLabel}><TrendingUp size={11} /> FII Flow</div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", marginBottom: 8 }}>Market-Wide · NSE Total</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#34d399" }}>BUY</span>
                                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", color: "#34d399", fontFamily: "monospace" }}>
                                    {latestFii?.fiiBuy != null ? `₹${(latestFii.fiiBuy / 10000000).toFixed(2)} Cr` : "---"}
                                </span>
                            </div>
                            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", borderRadius: 99 }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f87171" }}>SELL</span>
                                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", color: "#f87171", fontFamily: "monospace" }}>
                                    {latestFii?.fiiSell != null ? `₹${(latestFii.fiiSell / 10000000).toFixed(2)} Cr` : "---"}
                                </span>
                            </div>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#334155", marginTop: 8 }}>
                            Net: <span style={{ color: fiiColor(latestFii?.fiiNet || 0) }}>{latestFii?.fiiNet != null ? `₹${(latestFii.fiiNet / 10000000).toFixed(2)} Cr` : "---"}</span>
                        </div>
                    </div>

                    {/* DII Flow */}
                    <div style={metricCard}>
                        <div style={metricLabel}><TrendingUp size={11} /> DII Flow</div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", marginBottom: 8 }}>Market-Wide (NSE)</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#34d399" }}>BUY</span>
                                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", color: "#34d399", fontFamily: "monospace" }}>
                                    {latestFii?.diiBuy != null ? `₹${(latestFii.diiBuy / 10000000).toFixed(2)} Cr` : "---"}
                                </span>
                            </div>
                            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", borderRadius: 99 }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f87171" }}>SELL</span>
                                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", color: "#f87171", fontFamily: "monospace" }}>
                                    {latestFii?.diiSell != null ? `₹${(latestFii.diiSell / 10000000).toFixed(2)} Cr` : "---"}
                                </span>
                            </div>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#334155", marginTop: 8 }}>
                            Net: <span style={{ color: fiiColor(latestFii?.diiNet || 0) }}>{latestFii?.diiNet != null ? `₹${(latestFii.diiNet / 10000000).toFixed(2)} Cr` : "---"}</span>
                        </div>
                    </div>

                    {/* OI Structure */}
                    <div style={metricCard}>
                        <div style={metricLabel}>
                            <BarChart3 size={11} /> OI Structure
                            <InfoTooltip 
                                content="Futures Open Interest signal. LONG BUILDUP = price rising + OI rising (Bullish). SHORT COVERING = price rising + OI falling (Bullish). SHORT BUILDUP = price falling + OI rising (Bearish). LONG UNWINDING = price falling + OI falling (Bearish)." 
                                size={12}
                            />
                        </div>
                        {(() => {
                            const signal = latest?.oiSignal || "NEUTRAL";
                            let label = "Neutral";
                            let color = "#64748b";
                            let bgRgb = "100,116,139";
                            
                            if (signal === "LONG_BUILDUP") { label = "Strong Bullish"; color = "#10b981"; bgRgb = "16,185,129"; }
                            else if (signal === "SHORT_COVERING") { label = "Bullish"; color = "#34d399"; bgRgb = "52,211,153"; }
                            else if (signal === "SHORT_BUILDUP") { label = "Strong Bearish"; color = "#f43f5e"; bgRgb = "244,63,94"; }
                            else if (signal === "LONG_UNWINDING") { label = "Bearish"; color = "#fb7185"; bgRgb = "251,113,133"; }

                            return (
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: "#e2e8f0" }}>
                                            {signal.replace("_", " ")}
                                        </div>
                                        <div style={{ padding: "2px 8px", borderRadius: 4, background: `rgba(${bgRgb},0.12)`, border: `1px solid rgba(${bgRgb},0.4)`, fontSize: 9, fontWeight: 800, color: color, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                            {label}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#334155", marginTop: 8 }}>
                                        {Number(latest?.oiChangePct ?? 0) > 0 ? "+" : ""}{Number(latest?.oiChangePct ?? 0).toFixed(2)}% Interest Change
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginTop: 4 }}>
                                        OI As Of: {latest?.oiDate || latest?.date || "---"}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Delivery */}
                    <div style={metricCard}>
                        <div style={metricLabel}>
                            <PieChart size={11} /> Delivery Base
                            <InfoTooltip 
                                content="Percentage of traded volume that was actually taken for delivery (held overnight). > 50% indicates strong conviction from large players." 
                                size={12}
                            />
                        </div>
                        {(() => {
                            const pct = Number(latestDelivery?.deliveryPct ?? 0);
                            let label = "Neutral";
                            let color = "#64748b";
                            let bgRgb = "100,116,139";
                            
                            if (pct >= 60) { label = "Strong Bullish"; color = "#10b981"; bgRgb = "16,185,129"; }
                            else if (pct >= 40) { label = "Bullish"; color = "#34d399"; bgRgb = "52,211,153"; }
                            else if (pct < 20) { label = "Strong Bearish"; color = "#f43f5e"; bgRgb = "244,63,94"; }
                            else if (pct < 30) { label = "Bearish"; color = "#fb7185"; bgRgb = "251,113,133"; }

                            return (
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                                        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "#f1f5f9", lineHeight: 1 }}>
                                            {pct.toFixed(2)}<span style={{ fontSize: 18 }}>%</span>
                                        </div>
                                        <div style={{ padding: "2px 8px", borderRadius: 4, background: `rgba(${bgRgb},0.12)`, border: `1px solid rgba(${bgRgb},0.4)`, fontSize: 9, fontWeight: 800, color: color, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                            {label}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#334155", marginTop: 8 }}>Strong Hands Absorption</div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* ── Options Intelligence ─────────────────────────────────────── */}
                {chartData?.optionsIntelligence && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>

                        {/* PCR Relative Shift */}
                        {(() => {
                            const oi = chartData.optionsIntelligence!;
                            const isRising  = oi.pcrSentiment === 'RISING';
                            const isFalling = oi.pcrSentiment === 'FALLING';
                            const accentColor = isRising ? "#10b981" : isFalling ? "#f43f5e" : "#64748b";
                            const accentRgb   = isRising ? "16,185,129" : isFalling ? "244,63,94" : "100,116,139";
                            return (
                                <div style={{ ...glass, background: `rgba(${accentRgb},0.03)`, borderColor: `rgba(${accentRgb},0.15)`, padding: "18px 20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: accentColor, marginBottom: 6 }}>PCR Shift</div>
                                            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: "#f1f5f9", fontFamily: "monospace" }}>
                                                {oi.pcrToday != null ? oi.pcrToday.toFixed(2) : "---"}
                                            </div>
                                            <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", marginTop: 4 }}>
                                                Prev: <span style={{ color: "#94a3b8" }}>{oi.pcrYesterday != null ? oi.pcrYesterday.toFixed(2) : "---"}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 20, fontWeight: 900, color: accentColor, fontFamily: "monospace" }}>
                                                {oi.pcrShift != null ? `${oi.pcrShift > 0 ? "+" : ""}${oi.pcrShift.toFixed(4)}` : "---"}
                                            </div>
                                            <div style={{ marginTop: 6, padding: "4px 10px", borderRadius: 99, background: `rgba(${accentRgb},0.12)`, border: `1px solid rgba(${accentRgb},0.3)`, fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: accentColor }}>
                                                {isRising ? "↑ Bullish Bias" : isFalling ? "↓ Bearish Bias" : "Neutral"}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 12, fontSize: 9, fontWeight: 600, color: "#334155", lineHeight: 1.6 }}>
                                        {isRising  && "Put writers more active → market expects support to hold"}
                                        {isFalling && "Call writers more active → market expects resistance to hold"}
                                        {!isRising && !isFalling && "No directional shift in put/call activity"}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Multi-Strike Put Confirmation */}
                        {(() => {
                            const oi = chartData.optionsIntelligence!;
                            const sig = oi.putStrikeSignal;
                            const isStrong = sig === 'STRONG_PUT_BUILDUP';
                            const isWeak   = sig === 'WEAK_PUT_BUILDUP';
                            const accentColor = isStrong ? "#10b981" : isWeak ? "#f59e0b" : "#64748b";
                            const accentRgb   = isStrong ? "16,185,129" : isWeak ? "245,158,11" : "100,116,139";
                            return (
                                <div style={{ ...glass, background: `rgba(${accentRgb},0.03)`, borderColor: `rgba(${accentRgb},0.15)`, padding: "18px 20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: accentColor }}>Put Support Confirmation</div>
                                        <div style={{ padding: "3px 10px", borderRadius: 99, background: `rgba(${accentRgb},0.12)`, border: `1px solid rgba(${accentRgb},0.3)`, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor }}>
                                            {isStrong ? "STRONG 2/3" : isWeak ? "WEAK 1/3" : "NEUTRAL"}
                                        </div>
                                    </div>
                                    {oi.topPutStrikes.length > 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {oi.topPutStrikes.map((s, i) => {
                                                const pct = s.oiChangePct || 0;
                                                const isBuilding = pct > 5;
                                                return (
                                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: isBuilding ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${isBuilding ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                                                        <span style={{ fontSize: 12, fontWeight: 800, color: "#f1f5f9", fontFamily: "monospace" }}>₹{s.strike}</span>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>{(s.oi / 1000).toFixed(0)}K OI</span>
                                                            <span style={{ fontSize: 11, fontWeight: 800, color: isBuilding ? "#10b981" : pct < 0 ? "#f43f5e" : "#64748b", fontFamily: "monospace" }}>
                                                                {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 10, color: "#334155", fontWeight: 600 }}>No F&O data available for this stock</div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Multi-Strike Call Confirmation */}
                        {(() => {
                            const oi = chartData.optionsIntelligence!;
                            const sig = oi.callStrikeSignal;
                            const isStrong = sig === 'STRONG_CALL_BUILDUP';
                            const isWeak   = sig === 'WEAK_CALL_BUILDUP';
                            const accentColor = isStrong ? "#f43f5e" : isWeak ? "#f59e0b" : "#64748b";
                            const accentRgb   = isStrong ? "244,63,94" : isWeak ? "245,158,11" : "100,116,139";
                            return (
                                <div style={{ ...glass, background: `rgba(${accentRgb},0.03)`, borderColor: `rgba(${accentRgb},0.15)`, padding: "18px 20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: accentColor }}>Call Resistance Confirmation</div>
                                        <div style={{ padding: "3px 10px", borderRadius: 99, background: `rgba(${accentRgb},0.12)`, border: `1px solid rgba(${accentRgb},0.3)`, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor }}>
                                            {isStrong ? "STRONG 2/3" : isWeak ? "WEAK 1/3" : "NEUTRAL"}
                                        </div>
                                    </div>
                                    {oi.topCallStrikes.length > 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {oi.topCallStrikes.map((s, i) => {
                                                const pct = s.oiChangePct || 0;
                                                const isBuilding = pct > 5;
                                                return (
                                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: isBuilding ? "rgba(244,63,94,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${isBuilding ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                                                        <span style={{ fontSize: 12, fontWeight: 800, color: "#f1f5f9", fontFamily: "monospace" }}>₹{s.strike}</span>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>{(s.oi / 1000).toFixed(0)}K OI</span>
                                                            <span style={{ fontSize: 11, fontWeight: 800, color: isBuilding ? "#f43f5e" : pct < 0 ? "#10b981" : "#64748b", fontFamily: "monospace" }}>
                                                                {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 10, color: "#334155", fontWeight: 600 }}>No F&O data available for this stock</div>
                                    )}
                                </div>
                            );
                        })()}

                    </div>
                )}

                {/* ── Price Convergence Chart ──────────────────────────────────── */}
                <div style={glass}>
                    <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em" }}>Price Convergence</div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#334155", marginTop: 3 }}>Historical Trend vs Support Levels</div>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                            {[["#818cf8", "Price"], ["#f59e0b", "20 SMA"], ["#f43f5e", "50 SMA"]].map(([color, label]) => (
                                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ height: 400, padding: "20px 0 8px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData?.chartData || []} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.12} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#334155" }} minTickGap={50} />
                                <YAxis domain={["auto", "auto"]} orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#334155" }} tickFormatter={(v) => Number(v).toFixed(2)} />
                                <Tooltip {...tooltipStyle} />
                                <Area type="monotone" dataKey="close" stroke="none" fillOpacity={1} fill="url(#colorPrice)" />
                                <Line type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={2.5} dot={false} name="Close" />
                                <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="20 SMA" />
                                <Line type="monotone" dataKey="sma50" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="50 SMA" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── OI Strike Profile ────────────────────────────────────────── */}
                {chartData?.optionsIntelligence && (() => {
                    const oi = chartData.optionsIntelligence!;
                    const currentPrice = latest?.close ?? 0;

                    // Build unified strike map (put + call combined)
                    const strikeMap = new Map<number, { putOi: number; callOi: number }>();
                    (oi.topPutStrikes || []).forEach(s => {
                        const e = strikeMap.get(s.strike) || { putOi: 0, callOi: 0 };
                        e.putOi = s.oi;
                        strikeMap.set(s.strike, e);
                    });
                    (oi.topCallStrikes || []).forEach(s => {
                        const e = strikeMap.get(s.strike) || { putOi: 0, callOi: 0 };
                        e.callOi = s.oi;
                        strikeMap.set(s.strike, e);
                    });

                    const rows = Array.from(strikeMap.entries())
                        .map(([strike, v]) => ({ strike, ...v }))
                        .sort((a, b) => b.strike - a.strike); // highest price at top

                    if (rows.length === 0) return null;
                    const maxOi = Math.max(...rows.map(r => Math.max(r.putOi, r.callOi)));

                    return (
                        <div style={glass}>
                            {/* Header */}
                            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em" }}>OI Strike Profile</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#334155", marginTop: 3 }}>Options Open Interest · Support & Resistance Map</div>
                                </div>
                                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(16,185,129,0.7)" }} />
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Put OI (Support)</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(244,63,94,0.7)" }} />
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Call OI (Resistance)</span>
                                    </div>
                                    {oi.maxPain != null && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <div style={{ width: 12, height: 2, background: "#f59e0b" }} />
                                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#f59e0b" }}>Max Pain ₹{oi.maxPain}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Column headers */}
                            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 80px 1fr", gap: 8, padding: "10px 24px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <div />
                                <div style={{ textAlign: "right", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#10b981", paddingRight: 8 }}>← Put OI</div>
                                <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569" }}>Strike</div>
                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#f43f5e" }}>Call OI →</div>
                            </div>

                            {/* Rows */}
                            <div style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
                                {rows.map((row, i) => {
                                    const putPct  = maxOi > 0 ? (row.putOi  / maxOi) * 100 : 0;
                                    const callPct = maxOi > 0 ? (row.callOi / maxOi) * 100 : 0;
                                    const isAboveCurrent = currentPrice > 0 && row.strike > currentPrice;
                                    const isBelowCurrent = currentPrice > 0 && row.strike < currentPrice;
                                    const isMaxPain = oi.maxPain != null && row.strike === oi.maxPain;
                                    // Insert CMP marker between rows where price crosses
                                    const showCmpMarker = i > 0 && currentPrice > 0 && rows[i - 1].strike > currentPrice && row.strike <= currentPrice;

                                    return (
                                        <div key={row.strike}>
                                            {/* Current Market Price divider */}
                                            {showCmpMarker && (
                                                <div style={{ position: "relative", margin: "4px -24px", zIndex: 2 }}>
                                                    <div style={{ height: 1, background: "linear-gradient(90deg, transparent 2%, rgba(129,140,248,0.6) 20%, rgba(129,140,248,0.6) 80%, transparent 98%)" }} />
                                                    <div style={{ position: "absolute", right: 24, top: -9, background: "rgba(9,13,31,0.95)", border: "1px solid rgba(129,140,248,0.5)", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#818cf8", fontFamily: "monospace" }}>
                                                        ₹{currentPrice.toFixed(1)} CMP
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 80px 1fr", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" }}>

                                                {/* OI labels left side */}
                                                <div style={{ textAlign: "right", paddingRight: 8, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center" }}>
                                                    {row.putOi > 0 && (
                                                        <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", fontFamily: "monospace" }}>
                                                            {(row.putOi / 100000).toFixed(1)}L
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Put bar — grows from center LEFT */}
                                                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", height: 24 }}>
                                                    <div style={{
                                                        width: `${Math.max(putPct, 0.5)}%`,
                                                        height: 20,
                                                        background: row.putOi > 0
                                                            ? `linear-gradient(to left, rgba(16,185,129,0.8), rgba(16,185,129,0.2))`
                                                            : "transparent",
                                                        borderRadius: "3px 0 0 3px",
                                                        minWidth: row.putOi > 0 ? 3 : 0,
                                                        boxShadow: row.putOi > 0 && putPct > 60 ? "0 0 8px rgba(16,185,129,0.3)" : "none",
                                                    }} />
                                                </div>

                                                {/* Strike price center */}
                                                <div style={{ textAlign: "center" }}>
                                                    <span style={{
                                                        display: "inline-block",
                                                        padding: "2px 8px",
                                                        borderRadius: 4,
                                                        fontSize: 11, fontWeight: 800, fontFamily: "monospace",
                                                        color: isMaxPain ? "#f59e0b" : isAboveCurrent ? "#fca5a5" : isBelowCurrent ? "#86efac" : "#f1f5f9",
                                                        background: isMaxPain ? "rgba(245,158,11,0.12)" : isAboveCurrent ? "rgba(244,63,94,0.06)" : isBelowCurrent ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.04)",
                                                        border: isMaxPain ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.06)",
                                                    }}>
                                                        {row.strike}
                                                    </span>
                                                    {isMaxPain && <div style={{ fontSize: 7, color: "#f59e0b", fontWeight: 800, letterSpacing: "0.1em", marginTop: 1 }}>MAX PAIN</div>}
                                                </div>

                                                {/* Call bar — grows from center RIGHT */}
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, height: 24 }}>
                                                    <div style={{
                                                        width: `${Math.max(callPct, 0.5)}%`,
                                                        height: 20,
                                                        background: row.callOi > 0
                                                            ? `linear-gradient(to right, rgba(244,63,94,0.8), rgba(244,63,94,0.2))`
                                                            : "transparent",
                                                        borderRadius: "0 3px 3px 0",
                                                        minWidth: row.callOi > 0 ? 3 : 0,
                                                        boxShadow: row.callOi > 0 && callPct > 60 ? "0 0 8px rgba(244,63,94,0.3)" : "none",
                                                    }} />
                                                    {row.callOi > 0 && (
                                                        <span style={{ fontSize: 9, fontWeight: 700, color: "#f43f5e", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                                                            {(row.callOi / 100000).toFixed(1)}L
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* ── Flow + OI row ────────────────────────────────────────────── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>

                    {/* Delivery Absorption Flow — True stock-level accumulation */}
                    <div style={chartCard("52,211,153")}>
                        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(52,211,153,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#34d399" }}>Delivery Absorption Flow</div>
                                <div style={{ fontSize: 10, color: "#475569", marginTop: 3, fontWeight: 600 }}>Volume × Delivery% · Shares absorbed by strong hands</div>
                            </div>
                            {latest?.deliveryFlow != null && (
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Latest Flow: <span style={{ fontFamily: "monospace", fontSize: 11, color: "#10b981" }}>{(latest.deliveryFlow / 1000).toFixed(1)}k shares</span></div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: "#34d399", marginTop: 2 }}>Accumulation Base</div>
                                </div>
                            )}
                        </div>
                        <div style={{ height: 260, padding: "12px 10px 8px 10px" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData?.chartData || []} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                    <defs>
                                        <linearGradient id="deliveryGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.2} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} minTickGap={30} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} width={40} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                                    <Tooltip {...tooltipStyle} formatter={(v: number) => typeof v === 'number' ? v.toLocaleString(undefined, {maximumFractionDigits: 0}) : v} />
                                    <Bar
                                        dataKey="deliveryFlow"
                                        name="Absorbed Shares"
                                        radius={[3, 3, 0, 0]}
                                        fill="url(#deliveryGrad)"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={chartCard("56,189,248")}>
                        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(56,189,248,0.1)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#38bdf8" }}>Derivative Long/Short Density</div>
                            <div style={{ fontSize: 10, color: "#475569", marginTop: 3, fontWeight: 600 }}>
                                <span style={{ color: "#10b981" }}>Green (+): Bullish Bias</span> · <span style={{ color: "#f43f5e" }}>Red (-): Bearish Bias</span>
                            </div>
                        </div>
                        <div style={{ height: 250, padding: "12px 0 8px" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData?.chartData || []} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} minTickGap={30} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} domain={["auto", "auto"]} width={40} />
                                    <Tooltip {...tooltipStyle} />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
                                    <Bar dataKey="oiChangePct" name="OI Intensity" radius={[4, 4, 0, 0]}>
                                        {(chartData?.chartData || []).map((entry, index) => {
                                            const sig = entry.oiSignal;
                                            const isBullish = sig === 'LONG_BUILDUP' || sig === 'SHORT_COVERING' || sig === 'BULLISH';
                                            const isBearish = sig === 'SHORT_BUILDUP' || sig === 'LONG_UNWINDING' || sig === 'BEARISH';
                                            let color = "#64748b"; // default slate
                                            if (isBullish) color = "#10b981";
                                            else if (isBearish) color = "#f43f5e";
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Bar>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* ── Volume + Bulk row ────────────────────────────────────────── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>

                    {/* Delivery Absorption Flow — Volume × Delivery% */}
                    <div style={chartCard("100,116,139")}>
                        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(100,116,139,0.15)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Delivery Absorption Flow</div>
                            <div style={{ fontSize: 10, color: "#475569", marginTop: 3, fontWeight: 600 }}>Volume × Delivery% · bars = shares delivered (strong-hands)</div>
                        </div>
                        <div style={{ height: 250, padding: "12px 0 8px" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData?.chartData || []} margin={{ top: 10, right: 10, left: 10, bottom: 10 }} barGap="-100%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} minTickGap={30} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} width={45} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} width={35} />
                                    <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A', name]} />
                                    <Bar yAxisId="left" dataKey="volume" name="Total Volume" fill="#334155" opacity={0.35} radius={[2, 2, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="deliveryFlow" name="shares delivered (strong-hands)" fill="#8b5cf6" opacity={0.85} radius={[3, 3, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="deliveryPct" name="Delivery %" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>


                    <div style={chartCard("129,140,248")}>
                        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(129,140,248,0.15)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#818cf8" }}>High-Conviction Block Trades</div>
                        </div>
                        <div style={{ height: 250, padding: "12px 0 8px" }}>
                            {chartData?.chartData?.some(d => d.bulkBuys || d.bulkSells) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData.chartData || []} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} minTickGap={30} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} width={40} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                                        <Tooltip {...tooltipStyle} />
                                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
                                        <Bar dataKey="bulkBuys" name="Entry" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="bulkSells" name="Exit" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid rgba(129,140,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Activity size={18} color="rgba(129,140,248,0.3)" />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#334155" }}>Silence: No Institutional Block Trades</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── AI Analysis Agent Row ──────────────────────────────────────── */}
                <div style={{ marginTop: 20 }}>
                    <AIAgentChat symbol={stock.symbol} contextData={{ stock, analysis, chartData: chartData?.chartData }} />
                </div>
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

            {/* ── Compare Modal ────────────────────────────────────────────── */}
            {compareOpen && (
                <div onClick={() => setCompareOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 9000, display: "flex", alignItems: "flex-end" }}>
                    <motion.div onClick={e => e.stopPropagation()} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ width: "100%", maxHeight: "72vh", background: "rgba(9,13,31,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderTopLeftRadius: 24, borderTopRightRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {/* modal header */}
                        <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", flex: 1 }}>Compare <span style={{ color: "#a78bfa" }}>{symbol?.toUpperCase()}</span> with…</span>
                            <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Search symbol or name…" autoFocus style={{ padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 12, outline: "none", width: 220 }} />
                            <button onClick={() => setCompareOpen(false)} style={{ color: "#334155", background: "none", border: "none", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
                        </div>
                        {/* stock grid */}
                        <div style={{ overflowY: "auto", padding: "16px 24px", flex: 1 }}>
                            {stocksLoading ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.2)", borderTopColor: "#38bdf8", animation: "spin 0.8s linear infinite" }} />
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
                                    {allStocks.filter(s => !stockSearch || s.symbol.includes(stockSearch.toUpperCase()) || s.name.toLowerCase().includes(stockSearch.toLowerCase())).map(s => (
                                        <button key={s.symbol} onClick={() => { setCompareOpen(false); router.push(`/stocks/compare?a=${symbol?.toUpperCase()}&b=${s.symbol}`) }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }} onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(167,139,250,0.4)")} onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{s.symbol}</div>
                                            <div style={{ fontSize: 10, color: "#475569", marginTop: 3, fontWeight: 500 }}>{s.sector}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    )
}