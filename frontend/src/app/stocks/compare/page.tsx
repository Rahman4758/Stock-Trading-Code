"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getFootprint, getLatestScan, getStockDetail, Stock, ScanResult, FootprintChartResponse } from "@/lib/api"
import { ArrowLeft, ArrowLeftRight, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { motion } from "framer-motion"

// ── Checklist label map ───────────────────────────────────────────────────────
const CL_LABELS: Record<string, string> = {
    institutionalScore_gte70: "Inst. Score ≥70",
    stage2Confirmed: "Stage 2 Uptrend",
    validBreakoutPattern: "Valid Breakout",
    rsi_in_ideal_zone: "RSI 50–70",
    macd_bullish: "MACD Bullish",
    adx_trending: "ADX >25 (Trending)",
    rs_vs_nifty_positive: "RS vs Nifty +ve",
    breakout_volume_confirmed: "Volume Confirmed",
    stoploss_defined: "Stoploss Defined",
    rr_ratio_gte3: "Risk:Reward ≥ 3",
    nifty_in_uptrend: "Nifty Uptrend",
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const BG = "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)"
const glass = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, backdropFilter: "blur(20px)" }

const gradeColor = (g?: string) => ({ A: "#34d399", B: "#a3e635", C: "#fbbf24", D: "#f87171" }[g || ""] || "#94a3b8")
const scoreGrad = (s: number) => s >= 80 ? "linear-gradient(135deg,#34d399,#2dd4bf)" : s >= 60 ? "linear-gradient(135deg,#a3e635,#34d399)" : s >= 40 ? "linear-gradient(135deg,#fbbf24,#f97316)" : "linear-gradient(135deg,#f87171,#ec4899)"

// ── DualBar component ─────────────────────────────────────────────────────────
function DualBar({ label, a, b, max = 100 }: { label: string; a: number; b: number; max?: number }) {
    const aW = `${Math.min((a / max) * 100, 100)}%`
    const bW = `${Math.min((b / max) * 100, 100)}%`
    const aWins = a >= b
    const win = "linear-gradient(90deg,#34d399,#2dd4bf)"
    const lose = "rgba(148,163,184,0.35)"
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: aWins ? "#34d399" : "#94a3b8" }}>{a.toFixed(1)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: !aWins ? "#34d399" : "#94a3b8" }}>{b.toFixed(1)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden", display: "flex", justifyContent: "flex-end" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: aW }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ height: "100%", background: aWins ? win : lose, borderRadius: 99 }} />
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: bW }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ height: "100%", background: !aWins ? win : lose, borderRadius: 99 }} />
                </div>
            </div>
        </div>
    )
}

// ── CheckRow component ────────────────────────────────────────────────────────
function CheckRow({ label, a, b }: { label: string; a: boolean; b: boolean }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 28px", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
            {a ? <CheckCircle2 size={14} color="#34d399" /> : <XCircle size={14} color="#f87171" />}
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textAlign: "center" }}>{label}</span>
            {b ? <CheckCircle2 size={14} color="#34d399" style={{ marginLeft: "auto" }} /> : <XCircle size={14} color="#f87171" style={{ marginLeft: "auto" }} />}
        </div>
    )
}

// ── StatRow (price levels / simple values) ────────────────────────────────────
function StatRow({ label, a, b, prefix = "₹", higherWins = true }: { label: string; a?: number | null; b?: number | null; prefix?: string; higherWins?: boolean }) {
    const av = a ?? 0, bv = b ?? 0
    const aWins = higherWins ? av >= bv : av <= bv
    const fmt = (v: number) => v === 0 ? "---" : `${prefix}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: aWins ? 800 : 500, color: aWins ? "#f1f5f9" : "#64748b", textAlign: "right" }}>{fmt(av)}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: !aWins ? 800 : 500, color: !aWins ? "#f1f5f9" : "#64748b", textAlign: "left" }}>{fmt(bv)}</span>
        </div>
    )
}

// ── Normalize chart to % change from day 0 ───────────────────────────────────
function normalizeChart(data: { date: string; close: number }[]) {
    if (!data.length) return []
    const base = data[0].close
    return data.map(d => ({ date: d.date.slice(5), pct: base > 0 ? +((d.close - base) / base * 100).toFixed(2) : 0 }))
}

function mergeCharts(aN: { date: string; pct: number }[], bN: { date: string; pct: number }[]) {
    const bMap = new Map(bN.map(d => [d.date, d.pct]))
    return aN.map(d => ({ date: d.date, a: d.pct, b: bMap.get(d.date) ?? null }))
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ ...glass, padding: "24px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>{title}</div>
            {children}
        </div>
    )
}

// ── Main compare content ──────────────────────────────────────────────────────
function CompareContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const rawA = (searchParams.get("a") || "").toUpperCase()
    const rawB = (searchParams.get("b") || "").toUpperCase()
    const [symA, setSymA] = useState(rawA)
    const [symB, setSymB] = useState(rawB)

    const [stockA, setStockA] = useState<Stock | null>(null)
    const [stockB, setStockB] = useState<Stock | null>(null)
    const [scanA, setScanA] = useState<ScanResult | null>(null)
    const [scanB, setScanB] = useState<ScanResult | null>(null)
    const [chartA, setChartA] = useState<FootprintChartResponse | null>(null)
    const [chartB, setChartB] = useState<FootprintChartResponse | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchAll = useCallback(async (a: string, b: string) => {
        if (!a || !b) return
        setLoading(true)
        try {
            const [sA, sB, fA, fB, scan] = await Promise.all([
                getStockDetail(a),
                getStockDetail(b),
                getFootprint(a, 30),
                getFootprint(b, 30),
                getLatestScan(),
            ])
            setStockA(sA); setStockB(sB)
            setChartA(fA); setChartB(fB)
            setScanA(scan.find(s => s.symbol === a) || null)
            setScanB(scan.find(s => s.symbol === b) || null)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchAll(symA, symB) }, [symA, symB, fetchAll])

    const swap = () => {
        router.push(`/stocks/compare?a=${symB}&b=${symA}`)
        setSymA(symB); setSymB(symA)
    }

    const latA = chartA?.chartData[chartA.chartData.length - 1]
    const latB = chartB?.chartData[chartB.chartData.length - 1]

    const chartData = chartA && chartB
        ? mergeCharts(normalizeChart(chartA.chartData.map(d => ({ date: d.date, close: d.close }))), normalizeChart(chartB.chartData.map(d => ({ date: d.date, close: d.close }))))
        : []

    if (loading) return (
        <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: BG, flexDirection: "column", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(56,189,248,0.2)", borderTopColor: "#38bdf8", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#334155" }}>Comparing…</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    return (
        <div style={{ minHeight: "100vh", padding: "32px 20px", background: BG, fontFamily: "'DM Sans','Inter',sans-serif" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* ── Header ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <Link href={`/stocks/${symA}/footprint`} style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", textDecoration: "none" }}>
                        <ArrowLeft size={15} />
                    </Link>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#38bdf8", letterSpacing: "-0.04em" }}>{symA}</div>
                            <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{stockA?.name} · {stockA?.sector}</div>
                        </div>
                        <button onClick={swap} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 99, color: "#818cf8", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em" }}>
                            <ArrowLeftRight size={13} /> SWAP
                        </button>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#8b5cf6", letterSpacing: "-0.04em" }}>{symB}</div>
                            <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{stockB?.name} · {stockB?.sector}</div>
                        </div>
                    </div>
                </div>

                {/* ── Score Hero ── */}
                <Section title="Score Overview">
                    <DualBar label="Final Score" a={scanA?.finalScore || 0} b={scanB?.finalScore || 0} />
                    <DualBar label="Institutional Score" a={scanA?.compositeScore || 0} b={scanB?.compositeScore || 0} />
                    <DualBar label="Technical Score" a={scanA?.technicalScore || 0} b={scanB?.technicalScore || 0} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, marginTop: 8, alignItems: "center" }}>
                        <span style={{ textAlign: "right", fontSize: 22, fontWeight: 900, color: gradeColor(scanA?.grade) }}>{scanA?.grade || "—"}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em" }}>Grade</span>
                        <span style={{ fontSize: 22, fontWeight: 900, color: gradeColor(scanB?.grade) }}>{scanB?.grade || "—"}</span>
                    </div>
                </Section>

                {/* ── Smart Money Components ── */}
                <Section title="Smart Money Components">
                    {(["institutionalFlow", "bulkDeal", "oiSignal", "delivery", "hiddenAccumulation"] as const).map(k => (
                        <DualBar key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} a={scanA?.scores?.[k] || 0} b={scanB?.scores?.[k] || 0} />
                    ))}
                </Section>

                {/* ── Technical Sub-Scores ── */}
                {(scanA?.subScores || scanB?.subScores) && (
                    <Section title="Technical Sub-Scores">
                        {(["trend", "breakout", "momentum", "relativeStrength", "volumePattern", "riskReward"] as const).map(k => {
                            const maxMap: Record<string, number> = { trend: 25, breakout: 20, momentum: 20, relativeStrength: 15, volumePattern: 10, riskReward: 10 }
                            return <DualBar key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} a={scanA?.subScores?.[k] || 0} b={scanB?.subScores?.[k] || 0} max={maxMap[k]} />
                        })}
                    </Section>
                )}

                {/* ── Pre-Trade Checklist ── */}
                {(scanA?.preTradeChecklist || scanB?.preTradeChecklist) && (
                    <Section title={`Pre-Trade Checklist  ·  ${symA}: ${scanA?.checklistScore || "—"}  vs  ${symB}: ${scanB?.checklistScore || "—"}`}>
                        {Object.entries(CL_LABELS).map(([k, label]) => (
                            <CheckRow key={k} label={label}
                                a={!!(scanA?.preTradeChecklist as any)?.[k]}
                                b={!!(scanB?.preTradeChecklist as any)?.[k]} />
                        ))}
                    </Section>
                )}

                {/* ── OI & FII/DII ── */}
                <Section title="OI Signal & Market Flow">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, marginBottom: 16, alignItems: "center" }}>
                        <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{latA?.oiSignal?.replace(/_/g, " ") || "NEUTRAL"}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>OI Signal</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{latB?.oiSignal?.replace(/_/g, " ") || "NEUTRAL"}</span>
                    </div>
                    <DualBar label="OI Change %" a={Math.abs(latA?.oiChangePct || 0)} b={Math.abs(latB?.oiChangePct || 0)} max={10} />
                    <DualBar label="FII Buy (Cr)" a={(latA?.fiiBuy || 0) / 10000000} b={(latB?.fiiBuy || 0) / 10000000} max={30000} />
                    <DualBar label="FII Sell (Cr)" a={(latA?.fiiSell || 0) / 10000000} b={(latB?.fiiSell || 0) / 10000000} max={30000} />
                    <DualBar label="DII Buy (Cr)" a={(latA?.diiBuy || 0) / 10000000} b={(latB?.diiBuy || 0) / 10000000} max={20000} />
                    <DualBar label="DII Sell (Cr)" a={(latA?.diiSell || 0) / 10000000} b={(latB?.diiSell || 0) / 10000000} max={20000} />
                    <DualBar label="Delivery %" a={latA?.deliveryPct || 0} b={latB?.deliveryPct || 0} />
                </Section>

                {/* ── Price Levels ── */}
                {(scanA?.levels || scanB?.levels) && (
                    <Section title="Price Levels">
                        <StatRow label="Pivot Price" a={scanA?.levels?.pivotPrice} b={scanB?.levels?.pivotPrice} higherWins={false} />
                        <StatRow label="Chase Limit" a={scanA?.levels?.chaseLimit} b={scanB?.levels?.chaseLimit} higherWins={false} />
                        <StatRow label="Stop Loss" a={scanA?.levels?.stopLoss} b={scanB?.levels?.stopLoss} higherWins={false} />
                        <StatRow label="Target 1" a={scanA?.levels?.target1} b={scanB?.levels?.target1} />
                        <StatRow label="Target 2" a={scanA?.levels?.target2} b={scanB?.levels?.target2} />
                        <StatRow label="R:R Ratio" a={scanA?.levels?.rrRatio} b={scanB?.levels?.rrRatio} prefix="" />
                    </Section>
                )}

                {/* ── Normalized 30-Day Chart ── */}
                {chartData.length > 0 && (
                    <Section title="30-Day Price Performance (Indexed to 0%)">
                        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>— {symA}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>— {symB}</span>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <XAxis dataKey="date" tick={{ fill: "#334155", fontSize: 10 }} axisLine={false} tickLine={false} interval={6} />
                                <YAxis tick={{ fill: "#334155", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v > 0 ? "+" : ""}${v}%`} width={48} />
                                <Tooltip formatter={(v: any, n: string) => [`${v > 0 ? "+" : ""}${v}%`, n === "a" ? symA : symB]} contentStyle={{ background: "rgba(9,13,31,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#64748b" }} />
                                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                                <Line type="monotone" dataKey="a" stroke="#38bdf8" dot={false} strokeWidth={2} connectNulls />
                                <Line type="monotone" dataKey="b" stroke="#a78bfa" dot={false} strokeWidth={2} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    </Section>
                )}

                {/* ── Flags & Action ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[{ sym: symA, scan: scanA }, { sym: symB, scan: scanB }].map(({ sym, scan }) => (
                        <div key={sym} style={{ ...glass, padding: "20px 22px" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>{sym} — Verdict</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                                {(scan?.flags || []).map(f => (
                                    <span key={f} style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", fontSize: 10, fontWeight: 700 }}>{f.replace(/_/g, " ")}</span>
                                ))}
                                {!(scan?.flags?.length) && <span style={{ color: "#334155", fontSize: 11 }}>No flags</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, lineHeight: 1.5 }}>{scan?.action || "—"}</div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    )
}

export default function ComparePage() {
    return (
        <Suspense fallback={
            <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(56,189,248,0.2)", borderTopColor: "#38bdf8", animation: "spin 1s linear infinite" }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        }>
            <CompareContent />
        </Suspense>
    )
}
