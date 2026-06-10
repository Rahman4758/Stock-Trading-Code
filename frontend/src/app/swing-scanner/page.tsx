'use client'
import { useState, useEffect, useCallback } from 'react'
import { 
    Zap, RefreshCw, TrendingUp, Shield, Target, AlertTriangle, 
    ChevronDown, ChevronUp, BarChart2, Activity, Briefcase, Star
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ScoreBreakdown {
    priceStructure: number
    oiStructure: number
    delivery: number
    volume: number
    relativeStrength: number
    riskReward: number
}

interface PortfolioMeta {
    buyPrice?: number
    quantity?: number
    currentPnl?: number
    currentPnlPct?: number
}

interface TrackingEntry {
    date: string
    swingScore: number
    stage: string
    deliveryPct: number
    oiSignal: string
    keyDevelopment: string
    action: string
}

interface ScanResult {
    _id: string
    symbol: string
    date: string
    swingScore: number
    scoreBreakdown: ScoreBreakdown
    stage: string
    federalBankSimilarity: number
    action: 'BUY' | 'WATCHLIST' | 'AVOID'
    entryType: string
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
    entryZone?: { low: number; high: number }
    stopLoss?: number
    target1?: number
    target2?: number
    target3?: number
    rrRatio?: number
    holdingPeriodDays?: string
    smartMoneySignal: string
    institutionalActivity: string
    optionTrapAlert: boolean
    rsVsNifty: string
    rsVsSector: string
    currentPrice?: number
    deliveryPct?: number
    deliveryTrend5d?: string
    deliveryTrend10d?: string
    oiSignal?: string
    pcr?: number
    pcrTrend?: string
    support?: number
    resistance?: number
    high52w?: number
    mostImportantReason?: string
    redFlags?: string
    llmReport?: string
    isPortfolioStock: boolean
    portfolioMeta?: PortfolioMeta
    trackingHistory?: TrackingEntry[]
    trend?: string
    layer2Score?: number
}

const actionColors: Record<string, { bg: string; text: string; border: string }> = {
    BUY:       { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: 'rgba(16,185,129,0.4)' },
    WATCHLIST: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
    AVOID:     { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', border: 'rgba(239,68,68,0.4)' },
}
const confidenceColor = { HIGH: '#10b981', MEDIUM: '#f59e0b', LOW: '#94a3b8' }
const stageColor: Record<string, string> = {
    '1-Early': '#6366f1', '1-Mid': '#818cf8', '1-Late': '#38bdf8',
    '2-Fresh': '#10b981', '2-Ongoing': '#22c55e', '2-Extended': '#f59e0b',
    '3-Topping': '#f97316', '4-Downtrend': '#ef4444'
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / max) * 100)
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: '#94a3b8' }}>{label}</span>
                <span style={{ color, fontWeight: 700 }}>{value}/{max}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
        </div>
    )
}

function SwingScoreRing({ score }: { score: number }) {
    const color = score >= 75 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
    const circumference = 2 * Math.PI * 36
    const offset = circumference - (score / 100) * circumference
    return (
        <div style={{ position: 'relative', width: 88, height: 88 }}>
            <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle cx="44" cy="44" r="36" fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" transform="rotate(-90 44 44)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color }}>{score}</span>
                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>/ 100</span>
            </div>
        </div>
    )
}

function StockCard({ result, expanded, onToggle }: { result: ScanResult; expanded: boolean; onToggle: () => void }) {
    const ac = actionColors[result.action] || actionColors.AVOID
    const pnl = result.portfolioMeta?.currentPnl
    const pnlPct = result.portfolioMeta?.currentPnlPct

    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${result.action === 'BUY' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 20,
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
        }}>
            {/* Score accent bar */}
            <div style={{ height: 3, background: result.swingScore >= 75 ? 'linear-gradient(90deg,#10b981,#38bdf8)' : result.swingScore >= 60 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'rgba(100,116,139,0.3)' }} />

            <div style={{ padding: 20 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <SwingScoreRing score={result.swingScore} />
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>{result.symbol}</h2>
                                {result.isPortfolioStock && (
                                    <span style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        <Briefcase size={10} style={{ display: 'inline', marginRight: 3 }} />PORTFOLIO
                                    </span>
                                )}
                                {result.optionTrapAlert && (
                                    <span style={{ padding: '2px 8px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        ⚠ OPTION TRAP
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ padding: '3px 10px', background: ac.bg, color: ac.text, border: `1px solid ${ac.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                                    {result.action === 'BUY' ? '🟢' : result.action === 'WATCHLIST' ? '🟡' : '🔴'} {result.action}
                                </span>
                                <span style={{ padding: '3px 10px', background: `${stageColor[result.stage] || '#6366f1'}20`, color: stageColor[result.stage] || '#6366f1', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                                    Stage {result.stage}
                                </span>
                                <span style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderRadius: 6, fontSize: 11 }}>
                                    ⭐ {result.federalBankSimilarity}/10
                                </span>
                                <span style={{ color: confidenceColor[result.confidence], fontSize: 11, fontWeight: 600 }}>
                                    {result.confidence} confidence
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {result.currentPrice && (
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>₹{result.currentPrice}</div>
                        )}
                        {result.entryType && result.entryType !== 'NONE' && (
                            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginTop: 2 }}>{result.entryType}</div>
                        )}
                    </div>
                </div>

                {/* P&L for portfolio stocks */}
                {result.isPortfolioStock && pnl !== null && pnl !== undefined && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: pnl >= 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', borderRadius: 10, border: `1px dashed ${pnl >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Position P&L</span>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
                                {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div style={{ fontSize: 11, color: pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                {(pnlPct || 0) >= 0 ? '+' : ''}{(pnlPct || 0).toFixed(2)}%
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                    {[
                        { label: 'Delivery', value: result.deliveryPct ? `${result.deliveryPct}%` : '-', color: (result.deliveryPct || 0) >= 45 ? '#10b981' : '#f59e0b' },
                        { label: 'PCR', value: result.pcr ? result.pcr.toFixed(2) : '-', color: (result.pcr || 0) >= 1 ? '#10b981' : '#f59e0b' },
                        { label: 'OI Signal', value: result.oiSignal || '-', color: result.oiSignal === 'LONG_BUILDUP' ? '#10b981' : result.oiSignal === 'SHORT_COVERING' ? '#38bdf8' : '#94a3b8' },
                        { label: 'Smart Money', value: result.smartMoneySignal || '-', color: result.smartMoneySignal === 'ACCUMULATION' ? '#10b981' : result.smartMoneySignal === 'DISTRIBUTION' ? '#ef4444' : '#94a3b8' },
                    ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Most Important Reason */}
                {result.mostImportantReason && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: 8, borderLeft: '3px solid #6366f1', fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>
                        {result.mostImportantReason}
                    </div>
                )}

                {result.redFlags && (
                    <div style={{ marginTop: 6, padding: '6px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: 8, borderLeft: '3px solid #ef4444', fontSize: 11, color: '#ef4444' }}>
                        🚩 {result.redFlags}
                    </div>
                )}

                {/* Toggle button */}
                <button
                    onClick={onToggle}
                    style={{ marginTop: 12, width: '100%', padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, transition: 'all 0.2s' }}
                >
                    {expanded ? <><ChevronUp size={14} /> Hide Details</> : <><ChevronDown size={14} /> Show Full Analysis</>}
                </button>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '0 20px 20px' }}>
                    {/* Score Breakdown */}
                    <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Score Breakdown</div>
                        {result.scoreBreakdown && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                <ScoreBar label="Price Structure" value={result.scoreBreakdown.priceStructure || 0} max={20} color="#6366f1" />
                                <ScoreBar label="OI Structure" value={result.scoreBreakdown.oiStructure || 0} max={25} color="#38bdf8" />
                                <ScoreBar label="Delivery" value={result.scoreBreakdown.delivery || 0} max={20} color="#10b981" />
                                <ScoreBar label="Volume" value={result.scoreBreakdown.volume || 0} max={15} color="#f59e0b" />
                                <ScoreBar label="Relative Strength" value={result.scoreBreakdown.relativeStrength || 0} max={10} color="#a855f7" />
                                <ScoreBar label="Risk Reward" value={result.scoreBreakdown.riskReward || 0} max={10} color="#f97316" />
                            </div>
                        )}
                    </div>

                    {/* Trade Levels */}
                    {(result.entryZone || result.stopLoss || result.target1) && (
                        <div style={{ marginTop: 16, padding: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Trade Levels</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                {result.entryZone && <div><div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Entry Zone</div><div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>₹{result.entryZone.low} – ₹{result.entryZone.high}</div></div>}
                                {result.stopLoss && <div><div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Stop Loss</div><div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>₹{result.stopLoss}</div></div>}
                                {result.rrRatio && <div><div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Risk:Reward</div><div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>1:{result.rrRatio}</div></div>}
                                {result.target1 && <div><div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Target 1 (30%)</div><div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>₹{result.target1}</div></div>}
                                {result.target2 && <div><div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Target 2 (40%)</div><div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>₹{result.target2}</div></div>}
                                {result.target3 && <div><div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Target 3 (Trail)</div><div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>₹{result.target3}</div></div>}
                            </div>
                            {result.support && result.resistance && (
                                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12 }}>
                                    <span style={{ color: '#64748b' }}>Support: <span style={{ color: '#10b981', fontWeight: 600 }}>₹{result.support}</span></span>
                                    <span style={{ color: '#64748b' }}>Resistance: <span style={{ color: '#ef4444', fontWeight: 600 }}>₹{result.resistance}</span></span>
                                    {result.high52w && <span style={{ color: '#64748b' }}>52W High: <span style={{ color: '#f59e0b', fontWeight: 600 }}>₹{result.high52w}</span></span>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Delivery & OI Signals */}
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>DELIVERY TREND</div>
                            <div style={{ fontSize: 12, color: '#e2e8f0' }}>5D: <span style={{ color: result.deliveryTrend5d === 'RISING' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{result.deliveryTrend5d || '-'}</span></div>
                            <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>10D: <span style={{ color: result.deliveryTrend10d === 'RISING' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{result.deliveryTrend10d || '-'}</span></div>
                            <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>RS vs Nifty: <span style={{ color: result.rsVsNifty === 'OUTPERFORMING' ? '#10b981' : '#ef4444', fontWeight: 700 }}>{result.rsVsNifty || '-'}</span></div>
                        </div>
                        <div style={{ padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>OI / DERIVATIVES</div>
                            <div style={{ fontSize: 12, color: '#e2e8f0' }}>PCR: <span style={{ color: (result.pcr || 0) >= 1 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{result.pcr?.toFixed(2) || '-'}</span></div>
                            <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>PCR Trend: <span style={{ color: result.pcrTrend === 'IMPROVING' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{result.pcrTrend || '-'}</span></div>
                            <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>Signal: <span style={{ color: result.oiSignal === 'LONG_BUILDUP' ? '#10b981' : '#94a3b8', fontWeight: 700 }}>{result.oiSignal || '-'}</span></div>
                        </div>
                    </div>

                    {/* Portfolio Tracking History */}
                    {result.isPortfolioStock && result.trackingHistory && result.trackingHistory.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>📊 Daily Tracking History</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {result.trackingHistory.slice(0, 5).map((t, i) => (
                                    <div key={i} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                        <span style={{ color: '#64748b' }}>{new Date(t.date).toLocaleDateString('en-IN')}</span>
                                        <span style={{ color: '#e2e8f0', flex: 1, margin: '0 12px' }}>{t.keyDevelopment}</span>
                                        <span style={{ color: t.action?.includes('AVOID') ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: 10 }}>{t.action}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Full LLM Report */}
                    {result.llmReport && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Full Analysis Report</div>
                            <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, fontSize: 12, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>
                                {result.llmReport}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function SwingScanner() {
    const [results, setResults] = useState<ScanResult[]>([])
    const [loading, setLoading] = useState(true)
    const [scanning, setScanning] = useState(false)
    const [trackingPortfolio, setTrackingPortfolio] = useState(false)
    const [filter, setFilter] = useState<'ALL' | 'BUY' | 'WATCHLIST' | 'PORTFOLIO'>('ALL')
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
    const [lastScanInfo, setLastScanInfo] = useState<{ totalScanned?: number; layer2Qualified?: number; finalResults?: number; elapsedSeconds?: number } | null>(null)

    const fetchResults = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API}/api/v1/swing-scan/results?limit=100`)
            const data = await res.json()
            if (data.success) setResults(data.data || [])
        } catch {
            toast.error('Failed to load scan results')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchResults() }, [fetchResults])

    const handleRunScan = async () => {
        setScanning(true)
        const toastId = toast.loading('🔍 Running Federal Bank Swing Scan... (this takes ~5 mins)', { duration: 400000 })
        try {
            const res = await fetch(`${API}/api/v1/swing-scan/run`, { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                setLastScanInfo(data)
                toast.success(`✅ Scan complete! ${data.finalResults} stocks analyzed in ${data.elapsedSeconds}s`, { id: toastId })
                await fetchResults()
            } else {
                toast.error(data.error || 'Scan failed', { id: toastId })
            }
        } catch {
            toast.error('Scan request failed', { id: toastId })
        } finally {
            setScanning(false)
        }
    }

    const handleTrackPortfolio = async () => {
        setTrackingPortfolio(true)
        try {
            const res = await fetch(`${API}/api/v1/swing-scan/track-portfolio`, { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                toast.success(`Portfolio tracking updated for ${data.updated} stocks`)
                await fetchResults()
            }
        } catch {
            toast.error('Portfolio tracking failed')
        } finally {
            setTrackingPortfolio(false)
        }
    }

    const toggleCard = (id: string) => {
        setExpandedCards(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const filtered = results.filter(r => {
        if (filter === 'BUY') return r.action === 'BUY'
        if (filter === 'WATCHLIST') return r.action === 'WATCHLIST'
        if (filter === 'PORTFOLIO') return r.isPortfolioStock
        return true
    })

    const buyCount       = results.filter(r => r.action === 'BUY').length
    const watchlistCount = results.filter(r => r.action === 'WATCHLIST').length
    const portfolioCount = results.filter(r => r.isPortfolioStock).length

    return (
        <div className="min-h-screen bg-[#020617]" style={{ padding: 40, fontFamily: "'Inter', sans-serif" }}>
            <Toaster position="top-right" />

            {/* Header */}
            <div style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#10b981 0%,#06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(16,185,129,0.3)' }}>
                        <Zap size={26} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>Federal Bank Swing Scanner</h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Hunting the next Federal Bank-type move — silent accumulation before breakout</p>
                    </div>
                </div>

                {/* Stats row */}
                {lastScanInfo && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                        {[
                            { label: 'F&O Universe Scanned', value: lastScanInfo.totalScanned || 0, color: '#6366f1' },
                            { label: 'Layer 2 Qualified', value: lastScanInfo.layer2Qualified || 0, color: '#f59e0b' },
                            { label: 'Final Analyzed by AI', value: lastScanInfo.finalResults || 0, color: '#10b981' },
                            { label: 'Time Taken', value: `${lastScanInfo.elapsedSeconds}s`, color: '#38bdf8' },
                        ].map(s => (
                            <div key={s.label} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
                                <span style={{ fontSize: 11, color: '#64748b' }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        onClick={handleRunScan}
                        disabled={scanning}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: scanning ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#10b981,#06b6d4)', color: '#fff', border: 'none', borderRadius: 12, cursor: scanning ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}
                    >
                        <Zap size={16} className={scanning ? 'animate-pulse' : ''} />
                        {scanning ? 'Scanning... (2-5 mins)' : 'Run Swing Scan'}
                    </button>
                    <button
                        onClick={handleTrackPortfolio}
                        disabled={trackingPortfolio}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 12, cursor: trackingPortfolio ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}
                    >
                        <RefreshCw size={16} className={trackingPortfolio ? 'animate-spin' : ''} />
                        Update Portfolio Tracking
                    </button>

                    {/* Filter tabs */}
                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        {([['ALL', results.length], ['BUY', buyCount], ['WATCHLIST', watchlistCount], ['PORTFOLIO', portfolioCount]] as const).map(([label, count]) => (
                            <button
                                key={label}
                                onClick={() => setFilter(label)}
                                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${filter === label ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, background: filter === label ? 'rgba(99,102,241,0.15)' : 'transparent', color: filter === label ? '#818cf8' : '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                            >
                                {label} <span style={{ opacity: 0.7 }}>({count})</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>
                    <Activity size={32} style={{ margin: '0 auto 16px' }} className="animate-pulse" />
                    <p>Loading scan results...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 80, background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <Zap size={48} color="#1e293b" style={{ margin: '0 auto 20px' }} />
                    <h3 style={{ color: '#e2e8f0', fontSize: 20, margin: '0 0 10px' }}>No scan results yet</h3>
                    <p style={{ color: '#64748b' }}>Click <strong style={{ color: '#10b981' }}>Run Swing Scan</strong> to start the 3-layer Federal Bank scanner.</p>
                    <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>Layer 1 → Layer 2 → AI Agent (total ~5 mins for full F&O universe)</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: 20 }}>
                    {filtered.map(r => (
                        <StockCard
                            key={r._id}
                            result={r}
                            expanded={expandedCards.has(r._id)}
                            onToggle={() => toggleCard(r._id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
