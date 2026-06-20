"use client"

import { useEffect, useState } from "react"
import { getAllScannedStocks, getAllStocks, ScanResult } from "@/lib/api"
import { Search, ArrowLeft, ArrowUpRight, Filter, Target } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export default function MarketScreenerPage() {
    const [stocks, setStocks] = useState<ScanResult[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        const fetchStocks = async () => {
            try {
                const [scannedData, allStocks] = await Promise.all([
                    getAllScannedStocks(),
                    getAllStocks()
                ])
                
                const scannedMap = new Map(scannedData.map(s => [s.symbol, s]));
                const merged = allStocks.map(stock => {
                    if (scannedMap.has(stock.symbol)) return scannedMap.get(stock.symbol)!;
                    return {
                        symbol: stock.symbol,
                        grade: "UNRATED",
                        finalScore: 0,
                        compositeScore: 0,
                        technicalScore: 0,
                        setupType: "NOT SCANNED",
                        action: "NONE",
                        scores: { institutionalFlow: 0, bulkDeal: 0, oiSignal: 0, delivery: 0, hiddenAccumulation: 0 },
                        flags: [],
                        indexCategory: stock.indexCategory || "UNKNOWN"
                    } as ScanResult;
                });
                
                merged.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
                setStocks(merged);
            } catch (err) {
                console.error("Failed to load screener data", err)
            } finally {
                setLoading(false)
            }
        }
        fetchStocks()
    }, [])

    const searchLower = searchQuery.toLowerCase();
    const filteredStocks = stocks.filter(stock => 
        (stock.symbol && stock.symbol.toLowerCase().includes(searchLower)) ||
        (stock.setupType && stock.setupType.replace(/_/g, ' ').toLowerCase().includes(searchLower)) ||
        (stock.grade && stock.grade.toLowerCase().includes(searchLower))
    )

    const glass: React.CSSProperties = {
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        backdropFilter: "blur(24px)",
        overflow: "hidden",
    }

    const gradeColor = (grade: string) => {
        if (grade === 'A+' || grade === 'A') return { bg: "rgba(52,211,153,0.15)", color: "#34d399", border: "rgba(52,211,153,0.3)" }
        if (grade === 'B') return { bg: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "rgba(56,189,248,0.3)" }
        if (grade === 'C') return { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" }
        if (grade === 'SKIP' || grade === 'F') return { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.2)" }
        return { bg: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "rgba(255,255,255,0.1)" }
    }

    return (
        <div style={{ minHeight: "100vh", padding: "40px 24px", background: "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)", fontFamily: "'DM Sans','Inter',sans-serif" }}>
            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
                <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.07) 0%,transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.07) 0%,transparent 70%)" }} />
            </div>

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
                
                {/* Header & Search Bar */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                            <Link href="/" style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", textDecoration: "none", transition: "all 0.2s" }}>
                                <ArrowLeft size={20} />
                            </Link>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8", boxShadow: "0 0 8px #818cf8" }} />
                                    <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#818cf8", textTransform: "uppercase", fontWeight: 600 }}>Universe Leaderboard</span>
                                </div>
                                <h2 style={{ fontSize: "clamp(2rem,3vw,2.5rem)", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1, margin: 0 }}>
                                    Market Screener
                                </h2>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, maxWidth: 400 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                            <Search size={16} color="#64748b" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
                            <input 
                                type="text" 
                                placeholder="Search symbol, setup, or grade..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: "100%", padding: "14px 16px 14px 44px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "#f1f5f9", fontSize: 14, fontWeight: 500, outline: "none", transition: "border 0.2s" }}
                            />
                        </div>
                    </div>
                </div>

                {/* Screener Table */}
                <div style={glass}>
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Target size={16} color="#a78bfa" />
                            <span style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>All Active Stocks</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            {filteredStocks.length} Results
                        </span>
                    </div>

                    <div style={{ width: "100%", overflowX: "auto" }}>
                        {loading ? (
                            <div style={{ padding: "60px 0", textAlign: "center", color: "#64748b", fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                Loading Screener Data...
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                                <thead>
                                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                        <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Rank</th>
                                        <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Symbol</th>
                                        <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Grade</th>
                                        <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Final Score</th>
                                        <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Inst. Flow</th>
                                        <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Tech Score</th>
                                        <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Setup / Structure</th>
                                        <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStocks.map((stock, idx) => {
                                        const gradeStyle = gradeColor(stock.grade)
                                        return (
                                            <tr key={stock.symbol} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 800, color: "#475569" }}>
                                                    #{idx + 1}
                                                </td>
                                                <td style={{ padding: "16px 24px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <span style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc" }}>{stock.symbol}</span>
                                                        {stock.indexCategory && stock.indexCategory !== 'UNKNOWN' && (
                                                            <span style={{ 
                                                                fontSize: 9, 
                                                                fontWeight: 800, 
                                                                padding: "2px 6px", 
                                                                borderRadius: 4, 
                                                                background: stock.indexCategory === 'FNO' ? "rgba(167, 139, 250, 0.15)" : "rgba(56, 189, 248, 0.15)", 
                                                                color: stock.indexCategory === 'FNO' ? "#a78bfa" : "#38bdf8",
                                                                border: `1px solid ${stock.indexCategory === 'FNO' ? "rgba(167, 139, 250, 0.3)" : "rgba(56, 189, 248, 0.3)"}`
                                                            }}>
                                                                {stock.indexCategory.replace('NIFTY_', '')}
                                                            </span>
                                                        )}
                                                        {stock.flags && stock.flags.length > 0 && (
                                                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", title: stock.flags.join(', ') }} />
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: "16px 24px" }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 800, background: gradeStyle.bg, color: gradeStyle.color, border: `1px solid ${gradeStyle.border}` }}>
                                                        {stock.grade}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "16px 24px", fontSize: 15, fontWeight: 800, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>
                                                    {Math.round(stock.finalScore || stock.compositeScore || 0)}
                                                </td>
                                                <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                                                    {Math.round(stock.compositeScore || 0)}
                                                </td>
                                                <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                                                    {Math.round(stock.technicalScore || 0)}
                                                </td>
                                                <td style={{ padding: "16px 24px" }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#cbd5e1" }}>
                                                        {stock.setupType?.replace(/_/g, ' ') || "NO CLEAR SETUP"}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "16px 24px", textAlign: "right" }}>
                                                    <Link 
                                                        href={`/stocks/${stock.symbol}`} 
                                                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#38bdf8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textDecoration: "none", transition: "all 0.2s" }}
                                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(56,189,248,0.1)"}
                                                        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                                    >
                                                        Details <ArrowUpRight size={14} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                        
                        {!loading && filteredStocks.length === 0 && (
                            <div style={{ padding: "60px 0", textAlign: "center", color: "#64748b", fontSize: 14, fontWeight: 600 }}>
                                No stocks found matching "{searchQuery}"
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
