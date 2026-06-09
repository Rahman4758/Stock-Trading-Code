"use client"

import { useState, ChangeEvent, KeyboardEvent } from "react"
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  Target,
  Search,
  AlertTriangle,
  Calendar,
  DollarSign
} from "lucide-react"
import { getStockAnalysis } from "@/lib/api"

interface AnalysisResult {
  symbol: string
  name: string
  sector: string
  accumulation_score: {
    compositeScore: number
    scores: {
      institutionalFlow: number
      bulkDeal: number
      oiSignal: number
      delivery: number
      hiddenAccumulation: number
    }
    interpretation: string
  }
  currentPrice: number
  recommendation: string
}

export default function AnalysisPage() {
  const [symbol, setSymbol] = useState("")
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzeStock = async () => {
    if (!symbol.trim()) {
      setError("Please enter a stock symbol")
      return
    }

    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const result = await getStockAnalysis(symbol.trim().toUpperCase())
      const analysisResult: AnalysisResult = {
        symbol: result.symbol,
        name: result.symbol,
        sector: "Unknown",
        accumulation_score: {
          compositeScore: result.compositeScore,
          scores: {
            institutionalFlow: result.scores.institutionalFlow,
            bulkDeal: result.scores.bulkDeal,
            oiSignal: result.scores.oiSignal,
            delivery: result.scores.delivery,
            hiddenAccumulation: result.scores.hiddenAccumulation
          },
          interpretation: result.interpretation
        },
        currentPrice: result.currentPrice || 0,
        recommendation: result.interpretation.includes("HEAVY ACCUMULATION") ? "STRONG BUY" : 
                        result.interpretation.includes("MODERATE ACCUMULATION") ? "BUY" :
                        result.interpretation.includes("DISTRIBUTION") ? "AVOID" : "HOLD"
      }
      setAnalysis(analysisResult)
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to analyze stock")
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    if (score >= 40) return "text-orange-600"
    return "text-red-600"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-50 border-green-200"
    if (score >= 60) return "bg-yellow-50 border-yellow-200"
    if (score >= 40) return "bg-orange-50 border-orange-200"
    return "bg-red-50 border-red-200"
  }

  const getRecommendationColor = (rec: string) => {
    if (rec.includes('STRONG BUY')) return "bg-green-100 text-green-800"
    if (rec.includes('BUY')) return "bg-green-50 text-green-700"
    if (rec.includes('AVOID')) return "bg-red-100 text-red-800"
    return "bg-muted text-muted-foreground"
  }

  const factorData = analysis ? [
    {
      name: "Institutional Flow",
      score: analysis.accumulation_score.scores.institutionalFlow,
      description: "FII/DII net buying activity",
      icon: TrendingUp,
      color: analysis.accumulation_score.scores.institutionalFlow >= 70 ? "text-green-600" :
        analysis.accumulation_score.scores.institutionalFlow >= 50 ? "text-yellow-600" : "text-red-600"
    },
    {
      name: "Bulk Deals",
      score: analysis.accumulation_score.scores.bulkDeal,
      description: "Smart money bulk transactions",
      icon: Target,
      color: analysis.accumulation_score.scores.bulkDeal >= 70 ? "text-green-600" :
        analysis.accumulation_score.scores.bulkDeal >= 50 ? "text-yellow-600" : "text-red-600"
    },
    {
      name: "OI Signals",
      score: analysis.accumulation_score.scores.oiSignal,
      description: "Options market sentiment",
      icon: BarChart3,
      color: analysis.accumulation_score.scores.oiSignal >= 70 ? "text-green-600" :
        analysis.accumulation_score.scores.oiSignal >= 50 ? "text-yellow-600" : "text-red-600"
    },
    {
      name: "Delivery %",
      score: analysis.accumulation_score.scores.delivery,
      description: "Physical delivery vs trading",
      icon: Activity,
      color: analysis.accumulation_score.scores.delivery >= 70 ? "text-green-600" :
        analysis.accumulation_score.scores.delivery >= 50 ? "text-yellow-600" : "text-red-600"
    },
    {
      name: "Hidden Accumulation",
      score: analysis.accumulation_score.scores.hiddenAccumulation,
      description: "Volume-price divergence patterns",
      icon: Zap,
      color: analysis.accumulation_score.scores.hiddenAccumulation >= 70 ? "text-green-600" :
        analysis.accumulation_score.scores.hiddenAccumulation >= 50 ? "text-yellow-600" : "text-red-600"
    }
  ] : []

  // ── UI helpers (style only, no logic) ─────────────────────────────────────
  const scoreGradient = (score: number) => {
    if (score >= 80) return "linear-gradient(135deg,#34d399,#2dd4bf)"
    if (score >= 60) return "linear-gradient(135deg,#fbbf24,#f97316)"
    if (score >= 40) return "linear-gradient(135deg,#f97316,#ef4444)"
    return "linear-gradient(135deg,#f87171,#ec4899)"
  }

  const scoreGlow = (score: number) => {
    if (score >= 80) return "rgba(52,211,153,0.35)"
    if (score >= 60) return "rgba(251,191,36,0.35)"
    return "rgba(248,113,113,0.35)"
  }

  const recChip = (rec: string): React.CSSProperties => {
    if (rec.includes("STRONG BUY")) return { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }
    if (rec.includes("BUY"))        return { background: "rgba(45,212,191,0.12)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.25)" }
    if (rec.includes("AVOID"))      return { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }
    return { background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }
  }

  const barColor = (score: number) => score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171"
  const signalColor = (isGood: boolean, isBad: boolean) => isGood ? "#34d399" : isBad ? "#f87171" : "#475569"

  const glass: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    backdropFilter: "blur(24px)",
  }

  const tintCard = (color: string): React.CSSProperties => ({
    padding: "16px 18px",
    background: `rgba(${color},0.04)`,
    border: `1px solid rgba(${color},0.12)`,
    borderRadius: 14,
  })

  const sectionHead = (color: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
    textTransform: "uppercase", color, marginBottom: 14,
    display: "flex", alignItems: "center", gap: 7,
  })

  const tableRow: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13,
  }

  return (
    <div style={{ minHeight: "100vh", padding: "40px 24px", background: "radial-gradient(ellipse at 20% 20%,#0f2027 0%,#090d1f 40%,#020408 100%)", fontFamily: "'DM Sans','Inter',sans-serif" }}>

      {/* ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.07) 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.07) 0%,transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Page header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8", boxShadow: "0 0 8px #818cf8" }} />
            <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#818cf8", textTransform: "uppercase", fontWeight: 600 }}>5-Factor Engine</span>
          </div>
          <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Stock{" "}
            <span style={{ background: "linear-gradient(90deg,#818cf8,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Analysis</span>
          </h2>
          <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 14, margin: "8px 0 0", fontWeight: 500 }}>
            Deep institutional analysis using 5-factor accumulation scoring
          </p>
        </div>

        {/* Search */}
        <div style={{ ...glass, padding: 28 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
                <input
                  placeholder="Enter stock symbol (e.g., HDFCBANK)"
                  value={symbol}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSymbol(e.target.value)}
                  onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && analyzeStock()}
                  style={{ width: "100%", padding: "13px 14px 13px 40px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, color: "#f8fafc", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: "0.04em" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(129,140,248,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.15)")}
                />
            </div>
            <button
              onClick={analyzeStock}
              disabled={loading}
              style={{ padding: "13px 28px", background: loading ? "rgba(129,140,248,0.1)" : "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.6 : 1, transition: "opacity 0.2s", whiteSpace: "nowrap" }}
            >
              {loading
                ? <><Activity size={15} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</>
                : <><BarChart3 size={15} /> Analyze</>}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* ── Analysis results ─────────────────────────────────────────────── */}
        {analysis && (
          <>
            {/* Summary */}
            <div style={{ ...glass, padding: 32, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                  {analysis.name} ({analysis.symbol})
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{analysis.sector} Sector</div>
                <div style={{ marginTop: 14 }}>
                  <span style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", ...recChip(analysis.recommendation) }}>
                    {analysis.recommendation}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ width: 100, height: 100, borderRadius: "50%", backgroundImage: scoreGradient(analysis.accumulation_score.compositeScore), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${scoreGlow(analysis.accumulation_score.compositeScore)}` }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{analysis.accumulation_score.compositeScore}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 2 }}>/100</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Composite Score</div>
              </div>

              <div style={{ flex: "1 1 240px", padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 700 }}>Analysis Summary</div>
                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                  {analysis.accumulation_score.interpretation}
                </p>
              </div>
            </div>

            {/* Factor cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
              {factorData.map((factor, index) => {
                const Icon = factor.icon
                return (
                  <div key={index} style={{ ...glass, padding: "18px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={14} color="#818cf8" />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", lineHeight: 1.3 }}>{factor.name}</div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em", marginBottom: 2 }}>
                      {factor.score}<span style={{ fontSize: 13, color: "#64748b" }}>/100</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", marginBottom: 8 }}>
                      <div style={{ height: "100%", borderRadius: 99, width: `${factor.score}%`, background: barColor(factor.score), transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{factor.description}</div>
                  </div>
                )
              })}
            </div>

            {/* Detailed interpretation */}
            <div style={{ ...glass, padding: 28 }}>
              <div style={{ ...sectionHead("#818cf8") }}>
                <Calendar size={14} color="#818cf8" /> Detailed Analysis
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>

                <div style={tintCard("52,211,153")}>
                  <div style={sectionHead("#34d399")}><TrendingUp size={13} color="#34d399" /> Accumulation Factors</div>
                  {([
                    ["Institutional Buying:", analysis.accumulation_score.scores.institutionalFlow >= 70 ? "Strong" : analysis.accumulation_score.scores.institutionalFlow >= 50 ? "Moderate" : "Weak", analysis.accumulation_score.scores.institutionalFlow >= 70],
                    ["Smart Money Activity:", analysis.accumulation_score.scores.bulkDeal >= 70 ? "High" : analysis.accumulation_score.scores.bulkDeal >= 50 ? "Medium" : "Low", analysis.accumulation_score.scores.bulkDeal >= 70],
                    ["Delivery Strength:", analysis.accumulation_score.scores.delivery >= 70 ? "Strong" : analysis.accumulation_score.scores.delivery >= 50 ? "Good" : "Weak", analysis.accumulation_score.scores.delivery >= 70],
                  ] as [string, string, boolean][]).map(([label, val, isGood]) => (
                    <div key={label} style={tableRow}>
                      <span style={{ color: "#94a3b8" }}>{label}</span>
                      <span style={{ fontWeight: 600, color: isGood ? "#34d399" : "#475569" }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={tintCard("248,113,113")}>
                  <div style={sectionHead("#f87171")}><TrendingDown size={13} color="#f87171" /> Distribution Factors</div>
                  {([
                    ["Options Market:", analysis.accumulation_score.scores.oiSignal >= 70 ? "Bullish" : analysis.accumulation_score.scores.oiSignal <= 30 ? "Bearish" : "Neutral", analysis.accumulation_score.scores.oiSignal >= 70, analysis.accumulation_score.scores.oiSignal <= 30],
                    ["Hidden Patterns:", analysis.accumulation_score.scores.hiddenAccumulation >= 70 ? "Accumulation" : analysis.accumulation_score.scores.hiddenAccumulation <= 30 ? "Distribution" : "Normal", analysis.accumulation_score.scores.hiddenAccumulation >= 70, analysis.accumulation_score.scores.hiddenAccumulation <= 30],
                  ] as [string, string, boolean, boolean][]).map(([label, val, isGood, isBad]) => (
                    <div key={label} style={tableRow}>
                      <span style={{ color: "#94a3b8" }}>{label}</span>
                      <span style={{ fontWeight: 600, color: signalColor(isGood, isBad) }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={tintCard("129,140,248")}>
                  <div style={sectionHead("#818cf8")}><DollarSign size={13} color="#818cf8" /> Investment Recommendation</div>
                  <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
                    Based on the composite score of <strong style={{ color: "#e2e8f0" }}>{analysis.accumulation_score.compositeScore}/100</strong>, this stock
                    shows <span style={{ fontWeight: 500, color: "#e2e8f0" }}>{analysis.recommendation.toLowerCase()}</span> characteristics.
                    {analysis.recommendation.includes('STRONG BUY') && " Strong institutional accumulation signals present."}
                    {analysis.recommendation.includes('BUY') && !analysis.recommendation.includes('STRONG') && " Positive institutional activity observed."}
                    {analysis.recommendation.includes('AVOID') && " Significant institutional distribution detected."}
                    {analysis.recommendation.includes('HOLD') && " Mixed signals - monitor for clearer direction."}
                  </p>
                </div>

              </div>
            </div>
          </>
        )}

        {/* ── Info (no analysis yet) ───────────────────────────────────────── */}
        {!analysis && (
          <div style={{ ...glass, padding: 28 }}>
            <div style={{ ...sectionHead("#818cf8") }}>
              <BarChart3 size={14} color="#818cf8" /> How Analysis Works
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>

              <div style={tintCard("129,140,248")}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>5-Factor Scoring System</div>
                {[
                  ["Institutional Flow (30%)", "FII/DII net buying"],
                  ["Bulk Deals (25%)", "Smart money transactions"],
                  ["Options Signals (20%)", "OI build-up patterns"],
                  ["Delivery % (15%)", "Physical delivery strength"],
                  ["Hidden Accumulation (10%)", "Volume-price divergence"],
                ].map(([label, desc]) => (
                  <div key={label} style={tableRow}>
                    <span style={{ color: "#cbd5e1", fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{desc}</span>
                  </div>
                ))}
              </div>

              <div style={tintCard("56,189,248")}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>Score Interpretation</div>
                {([
                  ["85–100", "Strong Buy", "#34d399"],
                  ["70–84", "Buy", "#2dd4bf"],
                  ["40–69", "Hold", "#fbbf24"],
                  ["25–39", "Avoid", "#f97316"],
                  ["0–24", "Strong Sell", "#f87171"],
                ] as [string, string, string][]).map(([range, label, color]) => (
                  <div key={range} style={tableRow}>
                    <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 12 }}>{range}</span>
                    <span style={{ fontWeight: 600, color, fontSize: 12 }}>{label}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::placeholder { color: #64748b !important; }
      `}</style>
    </div>
  )
}