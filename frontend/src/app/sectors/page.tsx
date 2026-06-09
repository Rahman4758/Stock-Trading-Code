"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, Activity, Target, Zap, ChevronDown, ChevronUp, CheckCircle2, XCircle, ArrowUpRight, BarChart3, PieChart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1W", "1M", "3M", "6M"];

const SECTORS = [
  { id: "IT",     name: "Nifty IT",      color: "#38bdf8" },
  { id: "BANK",   name: "Bank Nifty",    color: "#f59e0b" },
  { id: "AUTO",   name: "Nifty Auto",    color: "#fb7185" },
  { id: "PHARMA", name: "Nifty Pharma",  color: "#34d399" },
  { id: "FMCG",   name: "Nifty FMCG",   color: "#a78bfa" },
  { id: "METAL",  name: "Nifty Metal",   color: "#f43f5e" },
  { id: "REALTY", name: "Nifty Realty",  color: "#fb923c" },
  { id: "ENERGY", name: "Nifty Energy",  color: "#818cf8" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(9,13,31,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Sector Performance</div>
      {[...payload].sort((a, b) => b.value - a.value).slice(0, 5).map(p => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
            <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 12 }}>{p.dataKey}</span>
          </div>
          <span style={{ color: p.value >= 100 ? "#34d399" : "#f87171", fontWeight: 800, fontSize: 12 }}>
            {p.value >= 100 ? "+" : ""}{(p.value - 100).toFixed(2)}%
          </span>
        </div>
      ))}
      {payload.length > 5 && <div style={{ fontSize: 10, color: "#475569", marginTop: 4, textAlign: "center" }}>+ {payload.length - 5} more</div>}
    </div>
  );
};

export default function SectorRadar() {
  const [tf, setTf]       = useState("1M");
  const [focus, setFocus] = useState<any>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [vis, setVis]     = useState(new Set(SECTORS.map(s => s.id)));
  const [perfData, setPerfData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerf() {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:4000/api/v1/sectors/performance?tf=${tf}`);
        const data = await res.json();
        setPerfData(data);
      } catch (err) {
        console.error("Failed to fetch sector performance:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPerf();
  }, [tf]);

  useEffect(() => {
    if (!focus) {
      setStockData(null);
      return;
    }
    async function fetchStocks() {
      try {
        const res = await fetch(`http://localhost:4000/api/v1/sectors/${focus.id}/stocks?tf=${tf}`);
        const data = await res.json();
        setStockData(data);
      } catch (err) {
        console.error("Failed to fetch sector stocks:", err);
      }
    }
    fetchStocks();
  }, [focus, tf]);

  const buildChart = () => {
    if (!perfData || !perfData.sectors) return [];
    const firstSectorId = Object.keys(perfData.sectors)[0];
    if (!firstSectorId || !perfData.sectors[firstSectorId]?.data) return [];
    
    // The data is now an array of {date, value}
    const dataLen = perfData.sectors[firstSectorId].data.length;
    return Array.from({ length: dataLen }, (_, i) => {
      const point = perfData.sectors[firstSectorId].data[i];
      const o: any = { date: point.date };
      SECTORS.forEach(s => { 
        if (perfData.sectors[s.id] && perfData.sectors[s.id].data[i]) {
          o[s.id] = perfData.sectors[s.id].data[i].value; 
        }
      });
      return o;
    });
  };

  const chartData = buildChart();
  const perf = perfData?.sectors || {};
  const ranked = [...SECTORS].sort((a, b) => (perf[b.id]?.change || 0) - (perf[a.id]?.change || 0));
  const top = ranked[0];

  const toggle = (id: string) => setVis(prev => {
    const n = new Set(prev);
    if (n.has(id) && n.size > 1) n.delete(id); else n.add(id);
    return n;
  });

  const pickSector = (s: any) => {
    setFocus((prev: any) => prev?.id === s.id ? null : s);
    if (!vis.has(s.id)) toggle(s.id);
  };

  const glass: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    backdropFilter: "blur(24px)",
  };

  const chip = (bg: string, color: string, border: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center",
    padding: "3px 10px", borderRadius: 8,
    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
    background: bg, color, border: `1px solid ${border}`,
  });

  const sigC = (sig: string) => {
    if (sig === "BUY") return { bg: "rgba(52,211,153,0.15)", color: "#34d399", border: "rgba(52,211,153,0.3)" };
    if (sig === "AVOID") return { bg: "rgba(248,113,113,0.15)", color: "#f87171", border: "rgba(248,113,113,0.3)" };
    return { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" };
  };

  return (
    <div style={{ minHeight: "100vh", padding: "24px 40px", background: "radial-gradient(ellipse at 20% 20%, #0f2027 0%, #090d1f 40%, #020408 100%)", fontFamily: "'DM Sans','Inter',sans-serif", position: "relative", overflow: "hidden" }}>
      
      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }} />
              <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700 }}>Market Macro Radar</span>
            </div>
            <h1 style={{ fontSize: "clamp(2.2rem,4vw,3.2rem)", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
              Sector <span style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Radar</span>
            </h1>
          </div>

          <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
            {TIMEFRAMES.map(t => (
              <button key={t} onClick={() => { setTf(t); setFocus(null); }}
                style={{ 
                  background: tf === t ? "rgba(56,189,248,0.15)" : "transparent", 
                  color: tf === t ? "#38bdf8" : "#94a3b8", 
                  border: "none", 
                  padding: "8px 16px", 
                  borderRadius: 10, 
                  cursor: "pointer", 
                  fontSize: 12, 
                  fontWeight: 700, 
                  transition: "all 0.2s" 
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Top Performer Card */}
        {top && perf[top.id] && (
          <div style={{ ...glass, padding: "24px 32px", background: `linear-gradient(90deg, ${top.color}15, transparent)`, borderColor: `${top.color}33`, borderLeft: `4px solid ${top.color}`, display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${top.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={24} color={top.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: top.color, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Market Leader</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>{top.name}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: perf[top.id].change >= 0 ? "#34d399" : "#f43f5e" }}>
                {perf[top.id].change >= 0 ? "+" : ""}{perf[top.id].change.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Relative performance ({tf})</div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>
          
          {/* Left Column: Rankings */}
          <div style={glass}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
              <BarChart3 size={16} color="#94a3b8" />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Sector Rankings</span>
            </div>
            <div style={{ padding: "8px" }}>
              {ranked.map((s, i) => {
                const chg = perf[s.id]?.change || 0;
                const active = focus?.id === s.id;
                const sentimentColor = chg >= 0 ? "#34d399" : "#f43f5e";
                return (
                  <div key={s.id} onClick={() => pickSector(s)}
                    style={{ 
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, cursor: "pointer", 
                      background: active ? `${s.color}15` : "transparent", 
                      border: active ? `1px solid ${s.color}33` : "1px solid transparent",
                      transition: "all 0.2s" 
                    }}
                    onMouseEnter={e => !active && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", width: 16 }}>{i+1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: active ? s.color : "#e2e8f0" }}>{s.id}</div>
                      <div style={{ height: 3, width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(Math.abs(chg)/20*100, 100)}%`, height: "100%", background: sentimentColor, borderRadius: 99 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: sentimentColor }}>
                      {chg >= 0 ? "+" : ""}{chg.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Chart */}
          <div style={{ ...glass, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Activity size={16} color="#818cf8" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>Relative Performance vs Nifty 50</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", maxWidth: 400 }}>
                {SECTORS.map(s => (
                  <button key={s.id} onClick={() => toggle(s.id)}
                    onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
                    style={{ 
                      background: vis.has(s.id) ? `${s.color}20` : "rgba(255,255,255,0.03)", 
                      border: `1px solid ${vis.has(s.id) ? s.color + "55" : "rgba(255,255,255,0.08)"}`, 
                      color: vis.has(s.id) ? s.color : "#64748b", 
                      padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 10, fontWeight: 700, 
                      transition: "all 0.2s", opacity: (hover && hover !== s.id) ? 0.35 : 1 
                    }}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.1)" 
                    tick={{ fontSize: 10, fill: "#64748b" }} 
                    tickFormatter={(val) => {
                      if (!val) return '';
                      const d = new Date(val);
                      return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                    }}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.1)" 
                    tick={{ fontSize: 10, fill: "#64748b" }} 
                    tickFormatter={v => `${(v-100).toFixed(0)}%`} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={100} stroke="rgba(255,255,255,0.15)" strokeDasharray="5 5" />
                  {SECTORS.map(s => (
                    <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color}
                      strokeWidth={focus?.id === s.id ? 3 : hover === s.id ? 2.5 : 2}
                      dot={false} activeDot={vis.has(s.id) ? { r: 4, fill: s.color, strokeWidth: 0 } : false}
                      strokeOpacity={!vis.has(s.id) ? 0 : focus ? (focus.id === s.id ? 1 : 0.1) : hover ? (hover === s.id ? 1 : 0.2) : 1}
                      animationDuration={1000}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Drill-down: Constituent Stocks */}
        {focus && stockData && (
          <div style={{ ...glass, overflow: "hidden", animation: "slideUp 0.4s ease-out" }}>
            <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${focus.color}15`, border: `1px solid ${focus.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PieChart size={20} color={focus.color} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", margin: 0 }}>{focus.name} Constituents</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{stockData.stocks.length} tracked stocks</span>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#475569" }} />
                    <span style={{ fontSize: 12, color: (perf[focus.id]?.change || 0) >= 0 ? "#34d399" : "#f43f5e", fontWeight: 700 }}>
                      Sector performance: {(perf[focus.id]?.change || 0) >= 0 ? "+" : ""}{(perf[focus.id]?.change || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {stockData.sector_saa_status === 'CLEAR' ? (
                  <div style={chip("rgba(52,211,153,0.1)", "#34d399", "rgba(52,211,153,0.2)")}>
                    <CheckCircle2 size={12} style={{ marginRight: 6 }} /> SAA CLEAR
                  </div>
                ) : (
                  <div style={chip("rgba(244,63,94,0.1)", "#f43f5e", "rgba(244,63,94,0.2)")}>
                    <XCircle size={12} style={{ marginRight: 6 }} /> SAA BLOCKED
                  </div>
                )}
                <button onClick={() => setFocus(null)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", width: 32, height: 32, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            </div>

            <div style={{ padding: "0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 100px 100px", padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Symbol & Conviction</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Strategy & Recommendation</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "right" }}>Price</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "right" }}>{tf} Change</div>
              </div>

              {stockData.stocks.map((stock: any) => {
                const chg = tf === "1W" ? stock.change_1w : tf === "1M" ? stock.change_1m : tf === "3M" ? stock.change_3m : stock.change_6m;
                const pos = chg >= 0;
                const s = sigC(stock.signal);
                const isExpanded = expandedSymbol === stock.symbol;

                return (
                  <div key={stock.symbol} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div 
                      onClick={() => setExpandedSymbol(isExpanded ? null : stock.symbol)}
                      style={{ display: "grid", gridTemplateColumns: "240px 1fr 100px 100px", alignItems: "center", padding: "16px 32px", transition: "all 0.2s", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#818cf8" }}>
                          {stock.symbol[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{stock.symbol}</div>
                          <div style={{ height: 3, width: 60, background: "rgba(255,255,255,0.05)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                            <div style={{ width: `${stock.conviction}%`, height: "100%", background: stock.conviction >= 70 ? "#34d399" : "#fbbf24", borderRadius: 99 }} />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={chip(s.bg, s.color, s.border)}>{stock.signal}</div>
                        <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{stock.name}</span>
                      </div>

                      <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                        {stock.price > 0 ? `₹${stock.price.toLocaleString()}` : "N/A"}
                      </div>
                      
                      <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: pos ? "#34d399" : "#f43f5e" }}>
                          {pos ? "+" : ""}{chg.toFixed(2)}%
                        </span>
                        {isExpanded ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "20px 32px", background: "rgba(0,0,0,0.15)", borderTop: "1px solid rgba(255,255,255,0.02)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 24 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Institutional Score</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: stock.conviction >= 70 ? "#34d399" : "#fbbf24" }}>{stock.conviction}/100</div>
                            </div>
                            <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.05)" }} />
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Market Cap Category</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>Large Cap</div>
                            </div>
                          </div>
                          <Link href={`/stocks/${stock.symbol}/footprint`} style={{ ...chip("rgba(56,189,248,0.1)", "#38bdf8", "rgba(56,189,248,0.2)"), textDecoration: "none", gap: 6, padding: "8px 16px" }}>
                            Detailed Footprint <ArrowUpRight size={14} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

      </div>
    </div>
  );
}