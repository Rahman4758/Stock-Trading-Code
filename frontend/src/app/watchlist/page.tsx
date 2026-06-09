"use client"

import { useState, useEffect, useRef } from 'react'
import { Eye, Shield, TrendingUp, Activity, BarChart3, Target, ChevronDown, ChevronUp, Trash2, RefreshCw, Search, Plus, Briefcase, Clock, AlertTriangle, MessageSquare, User, Bot, Send } from 'lucide-react'
import { getWatchlist, analyzeAllWatchlist, removeFromWatchlist, searchWatchlistStocks, addToWatchlist, analyzeWatchlistStock, sendWatchlistChat } from '@/lib/api'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [analyzing, setAnalyzing] = useState(false)
    const [analyzingStock, setAnalyzingStock] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(null)
    
    // Search & Add State
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [selectedStock, setSelectedStock] = useState<any>(null)
    
    // Add Modal Form State
    const [isOwned, setIsOwned] = useState(false)
    const [buyPrice, setBuyPrice] = useState('')
    const [sellPrice, setSellPrice] = useState('')
    const [stopLoss, setStopLoss] = useState('')
    const [quantity, setQuantity] = useState('')
    const [buyDate, setBuyDate] = useState('')

    // Chat State
    const [chatInput, setChatInput] = useState<{ [symbol: string]: string }>({})
    const [chatHistory, setChatHistory] = useState<{ [symbol: string]: { role: 'user' | 'agent', content: string }[] }>({})
    const [isChatting, setIsChatting] = useState<{ [symbol: string]: boolean }>({})

    const searchRef = useRef<HTMLDivElement>(null)

    const fetchWatchlist = async () => {
        setLoading(true)
        try {
            const res = await getWatchlist()
            setWatchlist(res.data.data || [])
        } catch (error) {
            toast.error("Failed to fetch watchlist")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchWatchlist()
        
        // Click outside to close search results
        const handleClickOutside = (event: any) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setSearchResults([])
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true)
                try {
                    const res = await searchWatchlistStocks(searchQuery)
                    setSearchResults(res.data.data || [])
                } catch (e) {
                    console.error(e)
                } finally {
                    setIsSearching(false)
                }
            } else {
                setSearchResults([])
            }
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [searchQuery])

    const handleAnalyzeAll = async () => {
        setAnalyzing(true)
        try {
            await analyzeAllWatchlist()
            toast.success("Analysis triggered successfully")
            await fetchWatchlist()
        } catch (error) {
            toast.error("Failed to analyze")
        } finally {
            setAnalyzing(false)
        }
    }

    const handleAnalyzeSingle = async (symbol: string) => {
        setAnalyzingStock(symbol)
        try {
            await analyzeWatchlistStock(symbol)
            toast.success(`${symbol} analyzed successfully`)
            await fetchWatchlist()
        } catch (error) {
            toast.error(`Failed to analyze ${symbol}`)
        } finally {
            setAnalyzingStock(null)
        }
    }

    const handleRemove = async (symbol: string) => {
        try {
            await removeFromWatchlist(symbol)
            toast.success(`${symbol} removed`)
            setWatchlist(prev => prev.filter(item => item.symbol !== symbol))
        } catch (error) {
            toast.error("Failed to remove")
        }
    }

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedStock) return
        
        try {
            const payload: any = {
                symbol: selectedStock.symbol,
                addedFrom: 'MANUAL',
            }
            if (buyPrice) payload.buyPrice = parseFloat(buyPrice)
            if (sellPrice) payload.sellPrice = parseFloat(sellPrice)
            if (stopLoss) payload.stopLoss = parseFloat(stopLoss)
            if (quantity) payload.quantity = parseInt(quantity)
            if (buyDate) payload.buyDate = buyDate

            if (isOwned || (buyPrice && quantity)) {
                payload.isOwned = true
            }
            await addToWatchlist(payload)
            toast.success(`${selectedStock.symbol} added to watchlist! Analysis running.`)
            setShowAddModal(false)
            setSearchQuery('')
            setSearchResults([])
            setSelectedStock(null)
            
            // Reset form
            setIsOwned(false)
            setBuyPrice('')
            setSellPrice('')
            setStopLoss('')
            setQuantity('')
            setBuyDate('')
            
            // Refresh list after brief delay to allow analysis to start
            setTimeout(fetchWatchlist, 2000)
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to add stock")
        }
    }

    const getScoreColor = (score: number) => {
        if (score >= 7) return '#10b981'
        if (score >= 4) return '#f59e0b'
        return '#ef4444'
    }

    const getActionColor = (action: string) => {
        switch (action) {
            case 'Strong Buy': return 'rgba(16, 185, 129, 0.2)'
            case 'Buy': return 'rgba(34, 197, 94, 0.2)'
            case 'Accumulate': return 'rgba(14, 165, 233, 0.2)'
            case 'Hold': return 'rgba(245, 158, 11, 0.2)'
            case 'Reduce': return 'rgba(249, 115, 22, 0.2)'
            case 'Exit': return 'rgba(239, 68, 68, 0.2)'
            default: return 'rgba(255, 255, 255, 0.1)'
        }
    }

    const getActionTextColor = (action: string) => {
        switch (action) {
            case 'Strong Buy': return '#10b981'
            case 'Buy': return '#22c55e'
            case 'Accumulate': return '#0ea5e9'
            case 'Hold': return '#f59e0b'
            case 'Reduce': return '#f97316'
            case 'Exit': return '#ef4444'
            default: return '#e2e8f0'
        }
    }

    const handleChatSubmit = async (symbol: string) => {
        const text = chatInput[symbol]
        if (!text || !text.trim()) return

        // Optimistically add user message
        const newHistory = [...(chatHistory[symbol] || []), { role: 'user' as const, content: text }]
        setChatHistory(prev => ({ ...prev, [symbol]: newHistory }))
        setChatInput(prev => ({ ...prev, [symbol]: '' }))
        setIsChatting(prev => ({ ...prev, [symbol]: true }))

        try {
            const res = await sendWatchlistChat(symbol, text)
            if (res.data.success) {
                setChatHistory(prev => ({ 
                    ...prev, 
                    [symbol]: [...newHistory, { role: 'agent' as const, content: res.data.text }] 
                }))
            } else {
                toast.error("Agent failed to respond")
            }
        } catch (e) {
            console.error(e)
            toast.error("Network error during chat")
        } finally {
            setIsChatting(prev => ({ ...prev, [symbol]: false }))
        }
    }

    const getBadgeColor = (val: string) => {
        if (val === 'Bullish' || val === 'Accumulation' || val === 'Strong') return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' }
        if (val === 'Bearish' || val === 'Distribution' || val === 'Weak') return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }
        return { bg: 'rgba(255, 255, 255, 0.1)', text: '#cbd5e1' }
    }
    
    const formatChange = (val: string) => {
        if (!val || val === 'N/A') return <span style={{ color: '#94a3b8' }}>-</span>
        const isPositive = val.startsWith('-') ? false : true
        const color = isPositive ? '#10b981' : '#ef4444'
        return <span style={{ color, fontWeight: 600 }}>{isPositive && '+'}{val}</span>
    }

    if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400">Loading Watchlist...</div>

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200" style={{ padding: 40, fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' }}>
                        <Eye size={24} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>AI Watchlist Monitor</h1>
                        <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 15 }}>{watchlist.length} stocks currently under agent surveillance</p>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative' }} ref={searchRef}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 12 }} />
                            <input
                                type="text"
                                placeholder="Search to add stock..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12,
                                    padding: '10px 12px 10px 40px',
                                    color: '#fff',
                                    width: 250,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                            {isSearching && <div className="animate-spin" style={{ position: 'absolute', right: 12, width: 14, height: 14, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%' }} />}
                        </div>
                        
                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: 8,
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12,
                                overflow: 'hidden',
                                zIndex: 50,
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                            }}>
                                {searchResults.map(s => (
                                    <div
                                        key={s.symbol}
                                        onClick={() => {
                                            setSelectedStock(s)
                                            setShowAddModal(true)
                                            setSearchResults([])
                                        }}
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                        className="hover:bg-slate-800"
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#fff' }}>{s.symbol}</div>
                                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{s.name}</div>
                                        </div>
                                        <Plus size={16} color="#6366f1" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleAnalyzeAll}
                        disabled={analyzing || watchlist.length === 0}
                        style={{
                            padding: '10px 20px',
                            background: analyzing ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: 12,
                            color: analyzing ? '#94a3b8' : '#818cf8',
                            fontWeight: 600,
                            cursor: analyzing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.2s'
                        }}
                    >
                        <RefreshCw size={18} className={analyzing ? "animate-spin" : ""} />
                        {analyzing ? 'Scanning Global Data...' : 'Analyze All'}
                    </button>
                </div>
            </div>

            {/* Add Stock Modal */}
            {showAddModal && selectedStock && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 500 }}>
                        <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: 24 }}>Add {selectedStock.symbol}</h2>
                        <p style={{ margin: '0 0 24px', color: '#94a3b8' }}>{selectedStock.name}</p>
                        
                        <form onSubmit={handleAddSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16 }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isOwned} 
                                            onChange={(e) => setIsOwned(e.target.checked)}
                                            style={{ width: 18, height: 18, accentColor: '#6366f1' }}
                                        />
                                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>I already own this stock</span>
                                    </label>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Entry / Buy Price (₹)</label>
                                    <input 
                                        type="number" step="0.05"
                                        value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)}
                                        placeholder="Optional"
                                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Quantity</label>
                                    <input 
                                        type="number"
                                        value={quantity} onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="Optional"
                                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Target / Sell Price (₹)</label>
                                    <input 
                                        type="number" step="0.05"
                                        value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
                                        placeholder="Optional"
                                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Stop Loss (₹)</label>
                                    <input 
                                        type="number" step="0.05"
                                        value={stopLoss} onChange={(e) => setStopLoss(e.target.value)}
                                        placeholder="Optional"
                                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Buy Date</label>
                                    <input 
                                        type="date"
                                        value={buyDate} onChange={(e) => setBuyDate(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                                <button type="submit" style={{ padding: '10px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Plus size={18} /> Add & Analyze
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {watchlist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, backdropFilter: 'blur(20px)' }}>
                    <Eye size={48} color="#475569" style={{ margin: '0 auto 20px' }} />
                    <h3 style={{ color: '#fff', fontSize: 20, margin: '0 0 10px' }}>No stocks in watchlist</h3>
                    <p style={{ color: '#94a3b8' }}>Search above to add stocks, or add them from the Strategy Vault.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: 24 }}>
                    {watchlist.map(item => {
                        const analysis = item.analysis;
                        const isExpanded = expanded === item.symbol;
                        
                        // Calculate PnL if owned
                        let currentVal = 0;
                        let invested = 0;
                        let pnl = 0;
                        let pnlPct = 0;
                        
                        if (item.isOwned && item.buyPrice && item.quantity && analysis?.currentPrice) {
                            invested = item.buyPrice * item.quantity;
                            currentVal = analysis.currentPrice * item.quantity;
                            pnl = currentVal - invested;
                            pnlPct = (pnl / invested) * 100;
                        }
                        
                        return (
                            <div key={item.symbol} style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 24,
                                backdropFilter: 'blur(20px)',
                                padding: 24,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 20,
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Agent Status Bar */}
                                {analysis && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: analysis.aiError ? 'linear-gradient(90deg, #ef4444, #f87171)' : analysis.aiDetailedAnalysis ? 'linear-gradient(90deg, #10b981, #38bdf8)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
                                )}

                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff' }}>{item.symbol}</h2>
                                            {analysis && (
                                                <div style={{
                                                    padding: '4px 12px',
                                                    borderRadius: 8,
                                                    background: getActionColor(analysis.suggestedAction),
                                                    color: getActionTextColor(analysis.suggestedAction),
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    letterSpacing: '0.05em',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {analysis.suggestedAction}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#94a3b8', alignItems: 'center' }}>
                                            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{item.companyName || '---'}</span>
                                            <span>•</span>
                                            <span>₹{analysis?.currentPrice?.toFixed(2) || '---'}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {item.isOwned && (
                                            <div style={{ padding: '6px 10px', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Briefcase size={14} /> PORTFOLIO
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => handleAnalyzeSingle(item.symbol)}
                                            disabled={analyzingStock === item.symbol}
                                            style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', cursor: analyzingStock === item.symbol ? 'not-allowed' : 'pointer', padding: '6px 12px', borderRadius: 8, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                                            className="hover:bg-indigo-500/20"
                                        >
                                            <RefreshCw size={14} className={analyzingStock === item.symbol ? "animate-spin" : ""} />
                                            {analyzingStock === item.symbol ? 'Global Web Search...' : 'Analyze'}
                                        </button>
                                        <button 
                                            onClick={() => handleRemove(item.symbol)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 8, borderRadius: 8, transition: 'all 0.2s' }}
                                            className="hover:bg-red-500/20 hover:text-red-400"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Target Levels & Portfolio Block */}
                                {(item.buyPrice || item.sellPrice || item.stopLoss) && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.03)' }}>
                                        {item.buyPrice && (
                                            <div>
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Entry / Buy Price</div>
                                                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>₹{item.buyPrice.toLocaleString('en-IN')}</div>
                                            </div>
                                        )}
                                        {item.sellPrice && (
                                            <div>
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Target Price</div>
                                                <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>₹{item.sellPrice.toLocaleString('en-IN')}</div>
                                            </div>
                                        )}
                                        {item.stopLoss && (
                                            <div>
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Stop Loss</div>
                                                <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>₹{item.stopLoss.toLocaleString('en-IN')}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                    
                                {/* Detailed Position Tracker */}
                                {(item.isOwned || (item.buyPrice && item.quantity)) && item.buyPrice && item.quantity && analysis?.currentPrice ? (
                                        <div style={{ padding: 16, background: pnl >= 0 ? 'linear-gradient(to right, rgba(16,185,129,0.05), transparent)' : 'linear-gradient(to right, rgba(239,68,68,0.05), transparent)', borderRadius: 16, border: `1px dashed ${pnl >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: pnl >= 0 ? '#10b981' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Position Tracker
                                                </div>
                                                <div style={{ padding: '2px 8px', borderRadius: 6, background: pnl >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: pnl >= 0 ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: 800 }}>
                                                    {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Invested</div>
                                                    <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>₹{invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{item.quantity} Qty @ ₹{item.buyPrice}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Current Value</div>
                                                    <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>@ ₹{analysis.currentPrice}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Net P&L</div>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
                                                        {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                {analysis ? (
                                    <>
                                        {/* Daily Changes Block - "Kya Badha Kya Ghata" */}
                                        {analysis.dailyChanges && (
                                            <div style={{ padding: 16, background: 'linear-gradient(to right, rgba(99,102,241,0.05), rgba(168,85,247,0.05))', borderRadius: 16, border: '1px dashed rgba(99,102,241,0.2)' }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Activity size={14} /> 24H Delta
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#94a3b8' }}>Volume:</span>
                                                        {formatChange(analysis.dailyChanges.volumeChange)}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#94a3b8' }}>Delivery %:</span>
                                                        {formatChange(analysis.dailyChanges.deliveryChange)}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#94a3b8' }}>OI:</span>
                                                        {formatChange(analysis.dailyChanges.oiChange)}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#94a3b8' }}>Price:</span>
                                                        {formatChange(analysis.dailyChanges.priceChange)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Scores & Badges */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Target size={14} color="#6366f1" /> Conviction: {analysis.convictionScore}/10
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Shield size={14} color="#f59e0b" /> Risk: {analysis.riskScore}/10
                                            </div>
                                            {[
                                                { label: 'Trend', val: analysis.trend, icon: TrendingUp },
                                                { label: 'Inst', val: analysis.institutionalActivity, icon: Activity }
                                            ].map((b, i) => {
                                                const colors = getBadgeColor(b.val);
                                                return (
                                                    <div key={i} style={{
                                                        background: colors.bg,
                                                        color: colors.text,
                                                        padding: '6px 12px',
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6
                                                    }}>
                                                        <b.icon size={12} /> {b.label}: {b.val}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Agent Status */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Clock size={14} /> 
                                                Last Analyzed: {new Date(analysis.analyzedAt).toLocaleTimeString()}
                                            </div>
                                            {analysis.aiError ? (
                                                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                                                    <AlertTriangle size={14} /> AI Engine Offline
                                                </span>
                                            ) : analysis.aiDetailedAnalysis ? (
                                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> LLM Active
                                                </span>
                                            ) : (
                                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <AlertTriangle size={14} /> Algorithmic Mode
                                                </span>
                                            )}
                                        </div>

                                        {/* Expand Toggle */}
                                        <button 
                                            onClick={() => setExpanded(isExpanded ? null : item.symbol)}
                                            style={{
                                                background: isExpanded ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                border: isExpanded ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: 12,
                                                padding: '12px',
                                                color: isExpanded ? '#818cf8' : '#e2e8f0',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: 8,
                                                fontSize: 14,
                                                fontWeight: 600,
                                                marginTop: 'auto',
                                                transition: 'all 0.2s'
                                            }}
                                            className="hover:bg-slate-800"
                                        >
                                            {isExpanded ? 'Hide AI Analysis' : 'Read AI Analysis'}
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div style={{ marginTop: 16 }}>
                                                <div style={{ 
                                                    padding: 24, 
                                                    background: '#0f172a', 
                                                    borderRadius: 16,
                                                    border: analysis.aiError ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                                    fontSize: 14,
                                                    lineHeight: 1.7,
                                                    color: '#cbd5e1',
                                                    maxHeight: 500,
                                                    overflowY: 'auto',
                                                    boxShadow: analysis.aiError ? 'inset 0 2px 20px rgba(239,68,68,0.1)' : 'inset 0 2px 10px rgba(0,0,0,0.3)'
                                                }} className="markdown-body">
                                                    {analysis.aiError ? (
                                                        <div>
                                                            <div style={{ color: '#ef4444', fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <AlertTriangle size={20} /> AI Engine Connection Failed
                                                            </div>
                                                            <p style={{ margin: '0 0 16px', color: '#f87171' }}>
                                                                The Institutional AI Agent encountered an error while communicating with the LLM API.
                                                            </p>
                                                            <div style={{ background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8, fontFamily: 'monospace', color: '#fca5a5', marginBottom: 20 }}>
                                                                {analysis.aiError}
                                                            </div>
                                                            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                                                                Fallback algorithmic reasoning is disabled to prevent stale/static analysis. Please resolve the API issue to restore full dashboard functionality.
                                                            </p>
                                                        </div>
                                                    ) : analysis.aiDetailedAnalysis ? (
                                                        <ReactMarkdown>{analysis.aiDetailedAnalysis}</ReactMarkdown>
                                                    ) : (
                                                        <ReactMarkdown>{analysis.detailedReasoning}</ReactMarkdown>
                                                    )}
                                                </div>

                                                {/* Chat UI for this stock */}
                                                {!analysis.aiError && (
                                                    <div style={{ marginTop: 16, background: '#1e293b', padding: 20, borderRadius: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
                                                        <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <MessageSquare size={16} color="#818cf8" />
                                                            Ask Follow-up Questions
                                                        </div>
                                                        
                                                        {/* Chat History */}
                                                        {chatHistory[item.symbol] && chatHistory[item.symbol].length > 0 && (
                                                            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                                {chatHistory[item.symbol].map((msg, idx) => (
                                                                    <div key={idx} style={{ display: 'flex', gap: 12 }}>
                                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.role === 'user' ? '#475569' : '#6366f1', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {msg.role === 'user' ? <User size={14} color="#fff" /> : <Bot size={14} color="#fff" />}
                                                                        </div>
                                                                        <div style={{ flex: 1, background: msg.role === 'user' ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.1)', padding: '12px 16px', borderRadius: 12, color: '#e2e8f0', fontSize: 14, lineHeight: 1.6 }} className={msg.role === 'agent' ? "markdown-body" : ""}>
                                                                            {msg.role === 'agent' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Chat Input */}
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <input 
                                                                type="text" 
                                                                value={chatInput[item.symbol] || ''}
                                                                onChange={(e) => setChatInput(prev => ({ ...prev, [item.symbol]: e.target.value }))}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') handleChatSubmit(item.symbol) }}
                                                                placeholder={`Ask agent about ${item.symbol} analysis...`}
                                                                style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px', color: '#fff', outline: 'none', fontSize: 14 }}
                                                            />
                                                            <button 
                                                                onClick={() => handleChatSubmit(item.symbol)}
                                                                disabled={isChatting[item.symbol] || !chatInput[item.symbol]?.trim()}
                                                                style={{ background: '#6366f1', border: 'none', borderRadius: 8, padding: '0 20px', color: '#fff', cursor: (isChatting[item.symbol] || !chatInput[item.symbol]?.trim()) ? 'not-allowed' : 'pointer', opacity: (isChatting[item.symbol] || !chatInput[item.symbol]?.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                {isChatting[item.symbol] ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ padding: 40, textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                        <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid #64748b', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                        Agent is running analysis...
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
