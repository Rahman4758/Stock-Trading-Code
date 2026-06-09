"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { format } from "date-fns";
import { Activity, History, Target, TrendingDown, Clock, RefreshCw, Zap, ShieldAlert, ArrowUpRight } from "lucide-react";

export default function RadarPage() {
    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [activeData, setActiveData] = useState<any[]>([]);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [activeRes, historyRes] = await Promise.all([
                axios.get('http://localhost:4000/api/v1/radar/active'),
                axios.get('http://localhost:4000/api/v1/radar/history')
            ]);
            setActiveData(activeRes.data);
            setHistoryData(historyRes.data);
        } catch (error) {
            console.error("Failed to fetch radar data", error);
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ── Style Helpers (Aligned with Enterprise Theme) ──
    const glass: React.CSSProperties = {
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        backdropFilter: "blur(24px)",
    };

    const cardHead: React.CSSProperties = {
        padding: "20px 24px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
    };

    const chip: React.CSSProperties = {
        display: "inline-flex", alignItems: "center",
        padding: "3px 10px", borderRadius: 8,
        fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
    };

    const getStatusChip = (status: string, exitReason: string): React.ReactNode => {
        if (status === 'TRACKING') {
            return <span style={{ ...chip, background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)" }}>TRACKING</span>;
        }
        if (status === 'EXITED_STOP_LOSS') {
            return <span style={{ ...chip, background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }} title={exitReason}>BROKEN SUPPORT</span>;
        }
        if (status === 'EXITED_SCORE_DECAY') {
            return <span style={{ ...chip, background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }} title={exitReason}>DISTRIBUTION / DECAY</span>;
        }
        if (status === 'REPLACED') {
            return <span style={{ ...chip, background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }} title={exitReason}>REPLACED (STRONGER SETUP)</span>;
        }
        return <span style={{ ...chip, background: "rgba(100,116,139,0.12)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.2)" }}>{status}</span>;
    };

    const renderScoreBar = (score: number) => {
        const percentage = Math.min(100, Math.max(0, score));
        let gradient = "linear-gradient(90deg, #34d399, #10b981)";
        let glow = "rgba(52,211,153,0.3)";
        if (score < 60) { gradient = "linear-gradient(90deg, #f87171, #ef4444)"; glow = "rgba(248,113,113,0.3)"; }
        else if (score < 75) { gradient = "linear-gradient(90deg, #fbbf24, #f59e0b)"; glow = "rgba(251,191,36,0.3)"; }

        return (
            <div style={{ width: "100%", background: "rgba(0,0,0,0.3)", borderRadius: 10, height: 6, marginTop: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ height: "100%", width: `${percentage}%`, background: gradient, boxShadow: `0 0 10px ${glow}`, transition: "width 1s ease-out" }} />
            </div>
        );
    };

    return (
        <div style={{ minHeight: "100vh", padding: "40px 24px", background: "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)", fontFamily: "'DM Sans','Inter',sans-serif" }}>
            
            {/* Ambient Orbs */}
            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
                <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.06) 0%,transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(129,140,248,0.06) 0%,transparent 70%)" }} />
            </div>

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
                
                {/* Header Section */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8", boxShadow: "0 0 8px #818cf8" }} />
                            <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#818cf8", textTransform: "uppercase", fontWeight: 600 }}>Lifecycle Engine</span>
                        </div>
                        <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
                            Active <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Radar</span>
                        </h2>
                        <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 14, fontWeight: 500 }}>
                            Algorithmic tracking of the 15-20 day smart money accumulation cycle.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                        {/* Tab Switcher */}
                        <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", padding: 4 }}>
                            <button
                                onClick={() => setActiveTab('ACTIVE')}
                                style={{
                                    display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8,
                                    fontSize: 13, fontWeight: 700, transition: "all 0.2s", cursor: "pointer", border: "none",
                                    ...(activeTab === 'ACTIVE' 
                                        ? { background: "rgba(255,255,255,0.1)", color: "#e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.2)" } 
                                        : { background: "transparent", color: "#64748b" })
                                }}
                            >
                                <Activity size={14} /> Active Filter
                            </button>
                            <button
                                onClick={() => setActiveTab('HISTORY')}
                                style={{
                                    display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8,
                                    fontSize: 13, fontWeight: 700, transition: "all 0.2s", cursor: "pointer", border: "none",
                                    ...(activeTab === 'HISTORY' 
                                        ? { background: "rgba(255,255,255,0.1)", color: "#e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.2)" } 
                                        : { background: "transparent", color: "#64748b" })
                                }}
                            >
                                <History size={14} /> Historical Log
                            </button>
                        </div>
                        
                        <button
                            onClick={refreshData}
                            disabled={refreshing || loading}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#94a3b8", cursor: (refreshing||loading) ? "not-allowed" : "pointer", opacity: (refreshing||loading) ? 0.6 : 1, transition: "opacity 0.2s" }}
                        >
                            <RefreshCw size={14} style={{ animation: (refreshing||loading) ? "spin 1s linear infinite" : "none" }} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#334155" }}>
                        <RefreshCw size={32} style={{ animation: "spin 1s linear infinite" }} />
                    </div>
                ) : activeTab === 'ACTIVE' ? (
                    // ACTIVE TRACKING VIEW
                    activeData.length === 0 ? (
                        <div style={{ ...glass, padding: "60px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, border: "1px dashed rgba(255,255,255,0.1)" }}>
                                <Target size={24} color="#64748b" />
                            </div>
                            <h3 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 700, margin: "0 0 8px" }}>Radar is Quiet</h3>
                            <p style={{ color: "#64748b", margin: 0, fontSize: 14, maxWidth: 400, lineHeight: 1.5 }}>
                                No stocks are currently meeting the strict 75+ Institutional Score requirement. We wait patiently for A-grade setups.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                            {activeData.map((stock) => (
                                <div key={stock._id} style={{ ...glass, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                                    
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,rgba(129,140,248,0.15),rgba(192,132,252,0.15))", border: "1px solid rgba(129,140,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#a5b4fc", flexShrink: 0 }}>
                                                {stock.symbol.slice(0, 2)}
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: 16, fontWeight: 700 }}>{stock.symbol}</h3>
                                                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginTop: 2 }}>Entry: ₹{stock.entryPrice}</div>
                                            </div>
                                        </div>
                                        <div style={{ ...chip, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                                            <Clock size={10} style={{ marginRight: 4 }}/> {stock.daysOnRadar}d
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 4 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Peak Conviction</span>
                                            <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 800 }}>{stock.highestScore.toFixed(1)}</span>
                                        </div>
                                        {renderScoreBar(stock.highestScore)}
                                    </div>

                                    {stock.stopLoss && (
                                        <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 12, fontWeight: 600 }}>
                                                <ShieldAlert size={14} /> Stop Loss
                                            </div>
                                            <div style={{ color: "#f87171", fontSize: 14, fontWeight: 700 }}>₹{stock.stopLoss.toFixed(2)}</div>
                                        </div>
                                    )}

                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    // HISTORY LOG VIEW
                    <div style={glass}>
                        <div style={cardHead}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <History size={15} color="#818cf8" />
                                <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Historical Tracking Log</span>
                            </div>
                            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, fontWeight: 500 }}>Review past setups to audit algorithm exits</p>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ w: "100%", textAlign: "left", borderCollapse: "collapse", minWidth: 800, width: "100%" }}>
                                <thead>
                                    <tr>
                                        {["Symbol", "Lifecycle Duration", "Entry → Exit Price", "Peak Inst. Score", "Exit Reason"].map(h => (
                                            <th key={h} style={{ padding: "16px 24px", color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyData.map((log) => (
                                        <tr key={log._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <td style={{ padding: "16px 24px" }}>
                                                <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{log.symbol}</span>
                                            </td>
                                            <td style={{ padding: "16px 24px" }}>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <span style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600 }}>{log.daysOnRadar} Days</span>
                                                    <span style={{ fontSize: 11, color: "#64748b" }}>{format(new Date(log.entryDate), 'MMM dd')} - {format(new Date(log.exitDate), 'MMM dd')}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "16px 24px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                                    <span style={{ color: "#94a3b8", fontWeight: 600 }}>₹{log.entryPrice}</span>
                                                    <ArrowUpRight size={12} color="#64748b" />
                                                    <span style={{ color: log.exitPrice > log.entryPrice ? "#34d399" : "#f87171", fontWeight: 700 }}>₹{log.exitPrice}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "16px 24px" }}>
                                                <span style={{ fontSize: 14, fontWeight: 800, color: "#c084fc" }}>{log.highestScore}</span>
                                            </td>
                                            <td style={{ padding: "16px 24px" }}>
                                                {getStatusChip(log.status, log.exitReason)}
                                            </td>
                                        </tr>
                                    ))}
                                    {historyData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: "40px 24px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
                                                No historical exit logs available yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
