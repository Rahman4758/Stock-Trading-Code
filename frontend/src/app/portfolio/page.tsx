"use client"

import { useEffect, useState } from "react"
import { getPortfolio, removeFromPortfolio, trackPortfolio, getJournal, getDeepAnalysis } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, Plus, RefreshCw, ArrowUpRight, TrendingUp, Layers, Zap, BrainCircuit, Activity, BarChart2 } from "lucide-react"
import Link from "next/link"
import ReactMarkdown from 'react-markdown'

export default function PortfolioPage() {
    const [activeTab, setActiveTab] = useState<'TRACKER' | 'MANUAL' | 'ANALYTICS'>('TRACKER')
    
    // Data states
    const [items, setItems] = useState<any[]>([])
    const [journal, setJournal] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    
    // Manual form state
    const [manualForm, setManualForm] = useState({ symbol: '', buyPrice: '', qty: '', target: '', stopLoss: '', reason: '' })
    const [submitting, setSubmitting] = useState(false)

    // Deep Analysis state
    const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null)
    const [analysisResult, setAnalysisResult] = useState<any>(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [portfolioData, journalData] = await Promise.all([
                getPortfolio(),
                getJournal()
            ])
            setItems(portfolioData)
            setJournal(journalData)
        } catch (error) {
            console.error("Failed to fetch portfolio", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const handleRemove = async (symbol: string) => {
        try {
            await removeFromPortfolio(symbol)
            setItems(items.filter(i => i.symbol !== symbol))
        } catch (error) {
            console.error("Failed to remove item", error)
        }
    }

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!manualForm.symbol || !manualForm.buyPrice) return
        setSubmitting(true)
        try {
            await trackPortfolio(
                manualForm.symbol.toUpperCase(), 
                parseFloat(manualForm.buyPrice), 
                parseFloat(manualForm.qty) || 1, 
                manualForm.reason,
                parseFloat(manualForm.target) || undefined,
                parseFloat(manualForm.stopLoss) || undefined,
                'MANUAL'
            )
            setManualForm({ symbol: '', buyPrice: '', qty: '', target: '', stopLoss: '', reason: '' })
            alert(`Successfully added ${manualForm.symbol.toUpperCase()} to your portfolio and journal!`)
            fetchData()
            setActiveTab('TRACKER')
        } catch (error: any) {
            console.error("Failed to add item", error)
            alert(error.response?.data?.detail || "Failed to add stock.")
        } finally {
            setSubmitting(false)
        }
    }

    const runDeepAnalysis = async (symbol: string) => {
        setAnalyzingSymbol(symbol)
        setAnalysisResult(null)
        try {
            const result = await getDeepAnalysis(symbol)
            setAnalysisResult(result)
        } catch (err: any) {
            alert("Analysis failed: " + err.message)
            setAnalyzingSymbol(null)
        }
    }

    const getRecBadge = (rec: string) => {
        if (rec?.includes("STRONG BUY")) return { bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" }
        if (rec?.includes("BUY")) return { bg: "bg-teal-500/20 text-teal-300 border-teal-500/30", dot: "bg-teal-400" }
        if (rec?.includes("HOLD")) return { bg: "bg-amber-500/20 text-amber-300 border-amber-500/30", dot: "bg-amber-400" }
        return { bg: "bg-rose-500/20 text-rose-300 border-rose-500/30", dot: "bg-rose-400" }
    }

    const TabButton = ({ id, icon: Icon, label }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 12,
                fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                background: activeTab === id ? "rgba(56,189,248,0.15)" : "transparent",
                color: activeTab === id ? "#38bdf8" : "#94a3b8",
                border: activeTab === id ? "1px solid rgba(56,189,248,0.3)" : "1px solid transparent"
            }}
        >
            <Icon size={16} />
            {label}
        </button>
    )

    return (
        <div
            className="min-h-screen p-6 md:p-10"
            style={{
                background: "radial-gradient(ellipse at 20% 20%, #0f2027 0%, #090d1f 40%, #020408 100%)",
                fontFamily: "'DM Sans', 'Inter', sans-serif",
            }}
        >
            {/* Ambient glow orbs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
            </div>

            <div className="relative max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }} />
                            <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#38bdf8", textTransform: "uppercase", fontWeight: 600 }}>Smart Money Engine</span>
                        </div>
                        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                            Portfolio<br />
                            <span style={{ background: "linear-gradient(90deg, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Command Center</span>
                        </h1>
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={loading}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "10px 18px",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 12, color: "#94a3b8", fontSize: 13,
                            backdropFilter: "blur(12px)",
                            cursor: loading ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                        Refresh
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 10, background: "rgba(255,255,255,0.02)", padding: 6, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)", width: "fit-content" }}>
                    <TabButton id="TRACKER" icon={Activity} label="Active Tracker" />
                    <TabButton id="MANUAL" icon={Plus} label="Log Manual Trade" />
                    <TabButton id="ANALYTICS" icon={BarChart2} label="Analytics & Journal" />
                </div>

                {/* Tab Content: TRACKER */}
                {activeTab === 'TRACKER' && (
                    <div style={{ display: "grid", gridTemplateColumns: analysisResult || analyzingSymbol ? "1fr 400px" : "1fr", gap: 16, alignItems: "start" }}>
                        
                        {/* Table */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, backdropFilter: "blur(24px)", overflow: "hidden" }}>
                            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Tracked Positions</h2>
                                    <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>Live monitoring & LLM analysis</p>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.5fr 1fr 120px", padding: "10px 24px", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                {["Symbol", "Type", "Score", "Action", "Price", ""].map((h) => (
                                    <div key={h} style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.15em", textTransform: "uppercase" }}>{h}</div>
                                ))}
                            </div>

                            {loading ? (
                                <div style={{ padding: "64px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>Loading positions…</div>
                            ) : items.length === 0 ? (
                                <div style={{ padding: "60px 24px", textAlign: "center", color: "#475569", fontSize: 14 }}>No positions tracked.</div>
                            ) : (
                                items.map((item, idx) => {
                                    const rec = item.analysis?.recommendation
                                    const badge = rec ? getRecBadge(rec) : null
                                    const score = item.analysis?.compositeScore
                                    const isManual = item.trade_type === 'MANUAL'

                                    return (
                                        <div key={item.symbol} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.5fr 1fr 120px", padding: "14px 24px", gap: 12, alignItems: "center", borderBottom: idx < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <Link href={`/portfolio/${item.symbol}`} style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{item.symbol}</Link>
                                            </div>
                                            
                                            <div>
                                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: isManual ? "rgba(139,92,246,0.15)" : "rgba(56,189,248,0.15)", color: isManual ? "#c084fc" : "#7dd3fc", border: isManual ? "1px solid rgba(139,92,246,0.3)" : "1px solid rgba(56,189,248,0.3)" }}>
                                                    {isManual ? "MANUAL" : "WATCHLIST"}
                                                </span>
                                            </div>

                                            <div>
                                                {score != null ? <span style={{ color: score >= 60 ? "#34d399" : "#f87171", fontWeight: 700 }}>{score}</span> : "—"}
                                            </div>

                                            <div>
                                                {badge ? (
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600 }} className={badge.bg}>
                                                        <span style={{ width: 4, height: 4, borderRadius: "50%" }} className={badge.dot} />{rec}
                                                    </span>
                                                ) : <span style={{ color: "#64748b", fontSize: 11 }}>AWAITING</span>}
                                            </div>

                                            <div>
                                                <div style={{ fontFamily: "monospace", fontSize: 14, color: "#e2e8f0" }}>₹{item.currentPrice?.toLocaleString() || "—"}</div>
                                            </div>

                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                                <button onClick={() => runDeepAnalysis(item.symbol)} disabled={analyzingSymbol === item.symbol} style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)", border: "none", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                                    <BrainCircuit size={12} />
                                                    {analyzingSymbol === item.symbol ? "..." : "AI"}
                                                </button>
                                                <button onClick={() => handleRemove(item.symbol)} style={{ background: "rgba(248,113,113,0.1)", border: "none", borderRadius: 6, padding: "6px 10px", color: "#f87171", cursor: "pointer" }}><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Analysis Panel */}
                        {(analyzingSymbol || analysisResult) && (
                            <div style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 20, padding: 24, backdropFilter: "blur(40px)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                    <BrainCircuit color="#c084fc" size={20} />
                                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Deep Analysis: {analyzingSymbol || analysisResult?.symbol}</h3>
                                </div>
                                
                                {analyzingSymbol && !analysisResult ? (
                                    <div style={{ color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Consulting LLM and Technical Scores...
                                    </div>
                                ) : analysisResult ? (
                                    <div>
                                        <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Current Price</div>
                                                <div style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 700, fontFamily: "monospace" }}>₹{analysisResult.currentPrice}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Realized PnL</div>
                                                <div style={{ fontSize: 16, color: analysisResult.pnlPct >= 0 ? "#34d399" : "#f87171", fontWeight: 700, fontFamily: "monospace" }}>
                                                    {analysisResult.pnlPct >= 0 ? "+" : ""}{analysisResult.pnlPct.toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="prose prose-invert prose-sm" style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                                            <ReactMarkdown>{analysisResult.analysis}</ReactMarkdown>
                                        </div>
                                        <button onClick={() => {setAnalysisResult(null); setAnalyzingSymbol(null)}} style={{ marginTop: 20, width: "100%", padding: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0", fontSize: 13 }}>Close Analysis</button>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content: MANUAL ENTRY */}
                {activeTab === 'MANUAL' && (
                    <div style={{ maxWidth: 600, margin: "0 auto", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(24px)" }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>Log Real Trade</h2>
                        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>Enter the details of a trade you took in your real account. AI will track its daily holding status.</p>
                        
                        <form onSubmit={handleManualSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>Symbol</label>
                                    <input required value={manualForm.symbol} onChange={e => setManualForm({...manualForm, symbol: e.target.value})} placeholder="RELIANCE" style={{ width: "100%", padding: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontFamily: "monospace" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>Entry Price (₹)</label>
                                    <input required type="number" step="0.05" value={manualForm.buyPrice} onChange={e => setManualForm({...manualForm, buyPrice: e.target.value})} placeholder="2500.50" style={{ width: "100%", padding: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontFamily: "monospace" }} />
                                </div>
                            </div>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>Quantity</label>
                                    <input required type="number" value={manualForm.qty} onChange={e => setManualForm({...manualForm, qty: e.target.value})} placeholder="100" style={{ width: "100%", padding: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontFamily: "monospace" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, color: "#34d399", marginBottom: 6, fontWeight: 600 }}>Target (₹)</label>
                                    <input type="number" step="0.05" value={manualForm.target} onChange={e => setManualForm({...manualForm, target: e.target.value})} placeholder="Optional" style={{ width: "100%", padding: 12, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, color: "#fff", fontFamily: "monospace" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, color: "#f87171", marginBottom: 6, fontWeight: 600 }}>Stop Loss (₹)</label>
                                    <input type="number" step="0.05" value={manualForm.stopLoss} onChange={e => setManualForm({...manualForm, stopLoss: e.target.value})} placeholder="Optional" style={{ width: "100%", padding: 12, background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, color: "#fff", fontFamily: "monospace" }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>Reason for Entry</label>
                                <textarea required value={manualForm.reason} onChange={e => setManualForm({...manualForm, reason: e.target.value})} placeholder="e.g., NR7 breakout with high delivery volume..." style={{ width: "100%", padding: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", minHeight: 100, fontSize: 13 }} />
                            </div>

                            <button type="submit" disabled={submitting} style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", padding: 16, borderRadius: 12, fontWeight: 700, border: "none", cursor: submitting ? "not-allowed" : "pointer", marginTop: 10 }}>
                                {submitting ? "Logging Trade..." : "Log Manual Trade"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Tab Content: ANALYTICS */}
                {activeTab === 'ANALYTICS' && (
                    <div className="space-y-6">
                        {/* Summary Metrics */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                            {[
                                { label: "Win Rate", value: `${journal?.summary?.win_rate_pct || 0}%`, color: "#38bdf8" },
                                { label: "Total Realized PnL", value: `₹${journal?.summary?.total_realized_pnl || 0}`, color: parseFloat(journal?.summary?.total_realized_pnl) >= 0 ? "#34d399" : "#f87171" },
                                { label: "Total Trades Taken", value: journal?.summary?.total_trades || 0, color: "#c084fc" },
                            ].map((s) => (
                                <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(20px)" }}>
                                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{s.label}</div>
                                    <div style={{ fontSize: 32, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Strategy Breakdown */}
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", paddingTop: 16 }}>Strategy Performance</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                            {journal?.strategy_performance && Object.keys(journal.strategy_performance).map(strat => {
                                const st = journal.strategy_performance[strat];
                                return (
                                    <div key={strat} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 20 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>{strat}</div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span style={{ color: "#94a3b8", fontSize: 12 }}>Win Rate</span>
                                            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{st.winRate.toFixed(1)}% ({st.wins}W / {st.losses}L)</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "#94a3b8", fontSize: 12 }}>Net PnL</span>
                                            <span style={{ color: st.pnl >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 600 }}>₹{st.pnl.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
            
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}