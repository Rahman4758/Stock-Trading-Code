"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { getStockDetail, getStockAnalysis, getFootprint, getAllStocks, Stock, StockRecommendation, FootprintChartResponse, FootprintDataPoint, trackPortfolio } from "@/lib/api"
import { ArrowLeft, Plus, Activity, AlertTriangle, TrendingUp, BarChart3, PieChart, Calendar, GitCompareArrows } from "lucide-react"
import Link from "next/link"
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area } from "recharts"
import { motion } from "framer-motion"

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
            await trackPortfolio(symbol, chartData?.chartData[chartData.chartData.length - 1]?.close || 0, 100)
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
        }
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
                    <Link href={`/stocks/${symbol}`} style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", textDecoration: "none", flexShrink: 0 }}>
                        <ArrowLeft size={16} />
                    </Link>

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
                        <div style={metricLabel}><BarChart3 size={11} /> OI Structure</div>
                        <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: "#e2e8f0" }}>
                            {latest?.oiSignal?.replace("_", " ") || "NEUTRAL"}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#334155", marginTop: 6 }}>
                            {Number(latest?.oiChangePct ?? 0) > 0 ? "+" : ""}{Number(latest?.oiChangePct ?? 0).toFixed(2)}% Interest Change
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginTop: 4 }}>
                            OI As Of: {latest?.oiDate || latest?.date || "---"}
                        </div>
                    </div>

                    {/* Delivery */}
                    <div style={metricCard}>
                        <div style={metricLabel}><PieChart size={11} /> Delivery Base</div>
                        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "#f1f5f9" }}>
                            {Number(latestDelivery?.deliveryPct ?? 0).toFixed(2)}<span style={{ fontSize: 18 }}>%</span>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#334155", marginTop: 6 }}>Strong Hands Absorption</div>
                    </div>
                </div>

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
                                <YAxis domain={["auto", "auto"]} orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#334155" }} />
                                <Tooltip {...tooltipStyle} />
                                <Area type="monotone" dataKey="close" stroke="none" fillOpacity={1} fill="url(#colorPrice)" />
                                <Line type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={2.5} dot={false} name="Close" />
                                <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="20 SMA" />
                                <Line type="monotone" dataKey="sma50" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="50 SMA" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

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
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date" hide />
                                    <YAxis hide />
                                    <Tooltip {...tooltipStyle} formatter={(v: number) => typeof v === 'number' ? v.toLocaleString(undefined, {maximumFractionDigits: 0}) : v} />
                                    <Bar
                                        dataKey="deliveryFlow"
                                        name="Absorbed Shares"
                                        radius={[3, 3, 0, 0]}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={chartCard("56,189,248")}>
                        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(56,189,248,0.1)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#38bdf8" }}>Derivative Long/Short Density</div>
                        </div>
                        <div style={{ height: 250, padding: "12px 0 8px" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData?.chartData || []} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date" hide />
                                    <YAxis hide domain={["auto", "auto"]} />
                                    <Tooltip {...tooltipStyle} />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
                                    <Bar dataKey="oiChangePct" name="OI Intensity" radius={[4, 4, 0, 0]} fill="#3b82f6" />
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
                                    <XAxis dataKey="date" hide />
                                    <YAxis yAxisId="left" hide />
                                    <YAxis yAxisId="right" orientation="right" hide />
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
                            {chartData?.chartData.some(d => d.bulkBuys || d.bulkSells) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
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