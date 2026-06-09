"use client"

import { useEffect, useState, useCallback } from "react"
import api, { ScanResult } from "@/lib/api"
import { Shield, Zap, Target, Layers, ArrowRight, TrendingUp, Info, SlidersHorizontal, CheckCircle2, Circle, Star } from "lucide-react"
import Link from "next/link"
import { addToWatchlist } from "@/lib/api"
import { toast } from "sonner"

const STRATEGIES = [
  { 
    id: "CLASSIC_INSTITUTIONAL", 
    name: "Classic Institutional", 
    desc: "Tracking massive accumulation in F&O and Delivery data.",
    infoText: "Focuses on identifying Smart Money footprints in the Cash and F&O markets. It looks for strong accumulation patterns using Delivery Percentage, FII/DII Net Flow, Options Open Interest (OI) build-up, and Price/Volume Action over multiple sessions. Perfect for finding fundamentally backed swing trades.",
    icon: Shield,
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.1)"
  },
  { 
    id: "DYNAMIC_MOMENTUM", 
    name: "Dynamic Momentum", 
    desc: "Customizable strictness criteria. Build your own momentum setup.",
    infoText: "A highly customizable momentum engine that filters stocks based on user-defined technical parameters (like RSI > 60, 50/200 DMA crossovers, 52-Week High proximity, Sector Strength, and OBV). It aggregates a dynamic score out of 10 based on the selected checklist.",
    icon: SlidersHorizontal,
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.1)"
  },
  { 
    id: "NR7_COMPRESSION", 
    name: "NR7 Compression", 
    desc: "Volatility contraction in price and range. Ready for explosion.",
    infoText: "A pure volatility contraction technical setup. It identifies the narrowest daily range in the last 7 sessions (NR7) occurring alongside moving average trend alignment and volume exhaustion. This 'coiled spring' pattern typically precedes explosive directional breakouts.",
    icon: Zap,
    color: "#c084fc",
    bg: "rgba(192,132,252,0.1)"
  },
  { 
    id: "COMPRESSION_RELEASE", 
    name: "Compression Release", 
    desc: "Institutional accumulation during range expansion phases.",
    infoText: "A strict Wyckoff-inspired setup looking for a 'Spring' (false breakdown). Requires a 15-day tight consolidation base (<15% width), a recent shakeout print piercing the lows, followed exactly today by a massive ignition candle (>2x avg body, >1.5x avg volume) that recaptures the 20 & 50 EMAs.",
    icon: Target,
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)"
  }
];

export default function StrategyVault() {
  const [activeTab, setActiveTab] = useState(STRATEGIES[0].id)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [infoModalOpen, setInfoModalOpen] = useState<string | null>(null)

  // Dynamic Momentum Filters
  const [filters, setFilters] = useState<Record<string, boolean | number>>({
    requireDailyRsi: false,
    requireWeeklyRsi: false,
    requireConsolidation: false,
    requireHigherHigh: false,
    requirePriceAbove50DMA: false,
    requirePriceAbove200DMA: false,
    requireNear52WHigh: false,
    requireRsStrong: false,
    requireObvRising: false,
    requireCmfPositive: false,
    requireDeliveryIncreasing: false,
    requireVolumeDrying: false,
    requireBreakoutVolume: false,
    requireSectorStrong: false,
    minScore: 6
  })

  const FILTER_OPTIONS = [
    { key: 'requireDailyRsi', label: 'Daily RSI > 60' },
    { key: 'requireWeeklyRsi', label: 'Weekly RSI > 60' },
    { key: 'requireConsolidation', label: 'In Consolidation' },
    { key: 'requireHigherHigh', label: 'Higher Highs' },
    { key: 'requirePriceAbove50DMA', label: 'Price > 50 DMA' },
    { key: 'requirePriceAbove200DMA', label: 'Price > 200 DMA' },
    { key: 'requireNear52WHigh', label: 'Near 52W High' },
    { key: 'requireRsStrong', label: 'RS Strong' },
    { key: 'requireObvRising', label: 'OBV Rising' },
    { key: 'requireCmfPositive', label: 'CMF Positive' },
    { key: 'requireDeliveryIncreasing', label: 'Delivery Increasing' },
    { key: 'requireVolumeDrying', label: 'Volume Drying' },
    { key: 'requireBreakoutVolume', label: 'Breakout Volume' },
    { key: 'requireSectorStrong', label: 'Sector Strong' }
  ];

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (activeTab === 'DYNAMIC_MOMENTUM') {
        const response = await api.post('/vault/momentum-scan', filters);
        setResults(response.data.data);
      } else {
        const response = await api.get<ScanResult[]>(`/scan/latest?strategy=${activeTab}`)
        setResults(response.data)
      }
    } catch (error) {
      console.error("Failed to fetch strategy results", error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const glass = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 24,
    backdropFilter: "blur(20px)",
  }

  const activeStrategy = STRATEGIES.find(s => s.id === activeTab)!;

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Layers className="text-sky-400" size={24} />
            <h1 className="text-4xl font-extrabold tracking-tight text-white">Strategy Vault</h1>
          </div>
          <p className="text-slate-400 max-w-2xl text-lg font-medium">
            Multi-agent systematic scanning. Choose your weapon and track institutional footprint across different mathematical setups.
          </p>
        </div>

        {/* Strategy Selection Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STRATEGIES.map((strat) => {
            const Icon = strat.icon;
            const isActive = activeTab === strat.id;
            return (
              <div
                key={strat.id}
                onClick={() => setActiveTab(strat.id)}
                role="button"
                tabIndex={0}
                style={{
                  ...glass,
                  padding: 24,
                  textAlign: "left",
                  borderColor: isActive ? strat.color : "rgba(255,255,255,0.06)",
                  background: isActive ? strat.bg : "rgba(255,255,255,0.02)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer"
                }}
              >
                {isActive && (
                  <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right, ${strat.color}33, transparent 70%)` }} />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setInfoModalOpen(strat.id); }}
                  style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10, transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                  title="Strategy Details"
                >
                  <Info size={14} color={isActive ? strat.color : "#94a3b8"} />
                </button>
                <Icon size={32} color={strat.color} style={{ marginBottom: 16 }} />
                <h3 className="text-xl font-bold text-white mb-2">{strat.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{strat.desc}</p>
                {isActive && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: strat.color }}>
                    Active Scan <ArrowRight size={12} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Dynamic Filters Panel (Only visible for DYNAMIC_MOMENTUM) */}
        {activeTab === 'DYNAMIC_MOMENTUM' && (
          <div style={glass} className="p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <SlidersHorizontal size={20} className="text-rose-400" />
              <h2 className="text-xl font-bold text-white">Dynamic Checklist Parameters</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {FILTER_OPTIONS.map(opt => (
                <button 
                  key={opt.key}
                  onClick={() => toggleFilter(opt.key)} 
                  className={`flex items-center gap-2 p-3 rounded-xl border ${filters[opt.key] ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'}`}
                >
                  {filters[opt.key] ? <CheckCircle2 size={16} className="text-rose-400 shrink-0" /> : <Circle size={16} className="text-slate-500 shrink-0" />}
                  <div className="text-xs font-bold text-left leading-tight">{opt.label}</div>
                </button>
              ))}
              
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-center col-span-2 md:col-span-1 lg:col-span-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Min Score: {filters.minScore}/10</span>
                  <span className="text-[10px] font-bold text-rose-400">{Number(filters.minScore) >= 8 ? 'A+ Grade' : Number(filters.minScore) >= 6 ? 'Tradable' : 'Ignore'}</span>
                </div>
                <input 
                  type="range" min="0" max="10" 
                  value={Number(filters.minScore)} 
                  onChange={(e) => setFilters(prev => ({...prev, minScore: parseInt(e.target.value)}))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div style={glass} className="overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 rounded-full" style={{ background: activeStrategy.color }} />
              <div>
                <h2 className="text-xl font-bold text-white">{activeStrategy.name} Results</h2>
                <span className="text-xs text-slate-500 font-bold tracking-widest uppercase">Latest EOD Scan</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <TrendingUp size={16} className="text-emerald-400" />
              <span className="text-sm font-bold text-slate-300">{results.length} OPPORTUNITIES</span>
            </div>
          </div>

          <div className="p-0">
            {loading ? (
              <div className="py-32 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
                <p className="text-slate-500 font-bold text-xs tracking-widest uppercase">Running Analysis...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-white/5">
                {results.map((stock, idx) => (
                  <div 
                    key={stock.symbol}
                    className="p-8 border-r border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-3xl font-black text-white group-hover:text-sky-400 transition-colors">{stock.symbol}</div>
                            <div className="text-xs font-bold text-slate-500 tracking-wider mt-1 uppercase">{activeStrategy.name}</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addToWatchlist({ symbol: stock.symbol, addedFrom: activeTab, category: activeStrategy.name })
                                .then(() => toast.success(`${stock.symbol} added to AI Watchlist Monitor`))
                                .catch(err => toast.error(`Failed to add ${stock.symbol} to watchlist: ${err.message}`));
                            }}
                            className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-yellow-500/20 hover:border-yellow-500/50 hover:text-yellow-400 transition-all text-slate-400"
                            title="Add to AI Watchlist Monitor"
                          >
                            <Star size={18} />
                          </button>
                        </div>
                        <div className="flex flex-col items-end">
                        <div className="text-2xl font-black" style={{ color: activeStrategy.color }}>
                          {activeTab === 'DYNAMIC_MOMENTUM' ? `${stock.score}/10` : Math.round(stock.finalScore || 0)}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                          {activeTab === 'DYNAMIC_MOMENTUM' ? 'Score' : 'Conviction'}
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Checklist or Meta Stats */}
                    {activeTab === 'DYNAMIC_MOMENTUM' && stock.checklist ? (
                      <div className="mb-6 grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] font-bold uppercase tracking-widest">
                        {Object.entries(stock.checklist).map(([key, passed]) => (
                          <div key={key} className={`flex items-center gap-2 ${passed ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {passed ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Target</div>
                          <div className="text-sm font-extrabold text-emerald-400">₹{stock.levels?.target1 || "N/A"}</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Stop Loss</div>
                          <div className="text-sm font-extrabold text-rose-400">₹{stock.levels?.stop_loss || stock.levels?.stopLoss || "N/A"}</div>
                        </div>
                      </div>
                    )}

                    <Link 
                      href={`/stocks/${stock.symbol}/footprint`}
                      className="flex items-center justify-between w-full p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-bold tracking-widest uppercase text-slate-300 mt-auto"
                    >
                      Institutional Blueprint <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-32 flex flex-col items-center text-center px-6">
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                  <Info className="text-slate-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No active signals</h3>
                <p className="text-slate-500 max-w-sm font-medium">The {activeStrategy.name} strategy hasn't detected any institutional accumulation in the current cycle.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Info Modal */}
      {infoModalOpen && (() => {
        const modalStrat = STRATEGIES.find(s => s.id === infoModalOpen);
        if (!modalStrat) return null;
        return (
          <div onClick={() => setInfoModalOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "rgba(15,23,42,0.95)", border: `1px solid ${modalStrat.color}40`, borderRadius: 24, padding: 32, maxWidth: 500, width: "100%", position: "relative", boxShadow: `0 20px 40px -10px ${modalStrat.color}20` }}>
              <button onClick={() => setInfoModalOpen(null)} style={{ position: "absolute", top: 24, right: 24, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 24, lineHeight: 1 }}>&times;</button>
              
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: modalStrat.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <modalStrat.icon size={24} color={modalStrat.color} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: modalStrat.color }}>Core Algorithm</div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>{modalStrat.name}</h2>
                </div>
              </div>
              
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
                  {modalStrat.infoText}
                </p>
              </div>
              
              <button onClick={() => setInfoModalOpen(null)} style={{ width: "100%", padding: 16, marginTop: 24, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, color: "#fff", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                Got it, Thanks
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  )
}
