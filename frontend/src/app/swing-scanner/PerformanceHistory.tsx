import { useState, useEffect } from 'react'
import { Activity, Target, Shield, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface StrategySignal {
    _id: string
    symbol: string
    entryDate: string
    entryPrice: number
    stopLoss: number
    target1: number
    target2: number
    target3?: number
    status: string
    maxReturnPct: number
    algoScore: number
    confidence: string
    exitDate?: string
    exitPrice?: number
    finalPnL?: number
}

interface HistoryMetrics {
    totalSignals: number
    wins: number
    losses: number
    winRate: string
    avgMaxReturn: string
    active: number
}

const statusColors: Record<string, { bg: string; color: string; border: string; icon: any }> = {
    ACTIVE: { bg: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: 'rgba(56,189,248,0.3)', icon: Clock },
    T1_HIT: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.4)', icon: CheckCircle2 },
    T2_HIT: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.4)', icon: CheckCircle2 },
    T3_HIT: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.4)', icon: CheckCircle2 },
    SL_HIT: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.4)', icon: XCircle },
}

export default function PerformanceHistory({ strategy = 'FEDERAL_BANK_SWING' }: { strategy?: string }) {
    const [signals, setSignals] = useState<StrategySignal[]>([])
    const [metrics, setMetrics] = useState<HistoryMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [exitModal, setExitModal] = useState<{ id: string, symbol: string } | null>(null)
    const [exitPrice, setExitPrice] = useState('')
    const [exitReason, setExitReason] = useState('')

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${API}/swing-scan/signals-history?strategy=${strategy}`)
                const data = await res.json()
                if (data.success) {
                    setSignals(data.data)
                    setMetrics(data.metrics)
                }
            } catch (err) {
                toast.error('Failed to load strategy history')
            } finally {
                setLoading(false)
            }
        }
        fetchHistory()
    }, [strategy])

    const handleManualExit = async () => {
        if (!exitModal || !exitPrice) return;
        try {
            const res = await fetch(`${API}/swing-scan/signals-history/${exitModal.id}/exit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exitPrice: Number(exitPrice), reason: exitReason })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Manually exited ${exitModal.symbol}`);
                setSignals(signals.map(s => s._id === exitModal.id ? data.data : s));
                setExitModal(null);
                setExitPrice('');
                setExitReason('');
            } else {
                toast.error(data.error || 'Failed to exit');
            }
        } catch (err) {
            toast.error('Network error');
        }
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>
                <Activity size={32} style={{ margin: '0 auto 16px' }} className="animate-pulse" />
                <p>Loading performance history...</p>
            </div>
        )
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Dashboard Metrics */}
            {metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Total Signals', value: metrics.totalSignals, color: '#818cf8' },
                        { label: 'Win Rate', value: `${metrics.winRate}%`, color: Number(metrics.winRate) > 50 ? '#10b981' : '#f59e0b' },
                        { label: 'Avg Max Return', value: `+${metrics.avgMaxReturn}%`, color: '#38bdf8' },
                        { label: 'Active Trades', value: metrics.active, color: '#e2e8f0' }
                    ].map(m => (
                        <div key={m.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px' }}>
                            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>{m.label}</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: m.color }}>{m.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* History Table */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#64748b' }}>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Date</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Symbol</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Entry Price</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>T1 / T2 / T3</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Stop Loss</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Max Return</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signals.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No signals tracked yet</td>
                                </tr>
                            ) : (
                                signals.map(sig => {
                                    const ac = statusColors[sig.status] || statusColors.ACTIVE
                                    const Icon = ac.icon
                                    return (
                                        <tr key={sig._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                                                {new Date(sig.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '16px 20px', fontWeight: 800, color: '#e2e8f0' }}>{sig.symbol}</td>
                                            <td style={{ padding: '16px 20px', color: '#cbd5e1' }}>₹{sig.entryPrice}</td>
                                            <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 600, fontSize: 12 }}>
                                                ₹{sig.target1} / ₹{sig.target2} / {sig.target3 ? `₹${sig.target3}` : '-'}
                                            </td>
                                            <td style={{ padding: '16px 20px', color: '#ef4444', fontWeight: 600 }}>₹{sig.stopLoss}</td>
                                            <td style={{ padding: '16px 20px', color: sig.maxReturnPct > 0 ? '#10b981' : '#94a3b8', fontWeight: 700 }}>
                                                {sig.maxReturnPct > 0 ? '+' : ''}{sig.maxReturnPct?.toFixed(2)}%
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ac.bg, border: `1px solid ${ac.border}`, color: ac.color, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                                                    <Icon size={12} />
                                                    {sig.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                {['ACTIVE', 'T1_HIT', 'T2_HIT'].includes(sig.status) && (
                                                    <button 
                                                        onClick={() => setExitModal({ id: sig._id, symbol: sig.symbol })}
                                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                                                    >
                                                        Exit
                                                    </button>
                                                )}
                                                {sig.status === 'CLOSED_MANUAL' && sig.finalPnL !== undefined && (
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: sig.finalPnL >= 0 ? '#10b981' : '#ef4444' }}>
                                                        {sig.finalPnL >= 0 ? '+' : ''}{sig.finalPnL.toFixed(2)}%
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Exit Modal */}
            {exitModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease' }}>
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 30, width: 400, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: 20 }}>Manual Exit: {exitModal.symbol}</h3>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Exit Price</label>
                            <input 
                                type="number" 
                                value={exitPrice} 
                                onChange={e => setExitPrice(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
                                placeholder="Enter exit price (e.g. 1540.50)"
                            />
                        </div>
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Reason (Optional)</label>
                            <input 
                                type="text" 
                                value={exitReason} 
                                onChange={e => setExitReason(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
                                placeholder="e.g. Trend changed, gap down, trailing SL hit"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => setExitModal(null)}
                                style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleManualExit}
                                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Confirm Exit
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
