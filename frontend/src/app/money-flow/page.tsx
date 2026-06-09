"use client";

import { useMemo, useState } from "react";
import { useMarketFlow } from "@/context/MarketFlowContext";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function MoneyFlowPage() {
  const { loading, error, fiiDii, sectors, assets, smartMoney, optionsFlow, liquidity, rotation, alerts } = useMarketFlow();
  const [flowWindow, setFlowWindow] = useState<"Today" | "5D" | "20D">("Today");
  const [signalFilter, setSignalFilter] = useState<"All" | "Accumulation" | "Distribution" | "Watch">("All");
  const [assetRange, setAssetRange] = useState<"1W" | "1M" | "3M" | "6M" | "1Y">("1M");

  const sentimentColor =
    liquidity?.sentiment === "RISK ON" ? "#34d399" : liquidity?.sentiment === "RISK OFF" ? "#f87171" : "#fbbf24";

  const marketOverview = fiiDii?.today || {};
  const fiiTrend = fiiDii?.trend30 || [];

  // Custom Tooltip for Institutional Floor Analysis
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "10px", fontSize: 11, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)" }}>
          <div style={{ color: "#8b949e", marginBottom: 8, fontWeight: 700, borderBottom: "1px solid #30363d", paddingBottom: 4 }}>Date: {label}</div>
          {payload.map((item: any) => {
            const isNifty = item.name === "Nifty 50";
            const val = Number(item.value);
            const change = item.payload.niftyChange || 0;
            const color = isNifty ? (change >= 0 ? "#34d399" : "#f87171") : (val >= 0 ? "#34d399" : "#f87171");
            const displayVal = isNifty ? val.toLocaleString() : `${val.toFixed(2)} Cr`;
            return (
              <div key={item.name} style={{ color, display: "flex", justifyContent: "space-between", gap: 24, padding: "2px 0" }}>
                <span>{item.name}:</span>
                <span style={{ fontWeight: 800 }}>{displayVal}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Tooltip for Panel 2 Sources
  const SourceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = Number(payload[0].value);
      const color = payload[0].name === "Retail (Est)" ? "#94a3b8" : (val >= 0 ? "#34d399" : "#f87171");
      return (
        <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "8px 12px", fontSize: 10 }}>
          <div style={{ color: "#8b949e", marginBottom: 4 }}>{label}</div>
          <div style={{ color, fontWeight: 800 }}>{val.toFixed(2)} Cr</div>
        </div>
      );
    }
    return null;
  };
  
  // Advanced Data Preparation: Map FII vs DII vs Nifty for Institutional Analysis
  const spark = useMemo(() => {
    return fiiTrend.slice(-20).map((d: any, idx: number) => {
        const prevNifty = idx > 0 ? fiiTrend.slice(-20)[idx-1].nifty_close : d.nifty_close;
        const priceChange = d.nifty_close - prevNifty;
        
        // Institutional Regime Logic
        let regime = "NEUTRAL";
        let regimeColor = "#94a3b8";
        
        if (d.fii_net > 0 && priceChange > 0) { regime = "AGGRESSIVE LONG"; regimeColor = "#34d399"; }
        else if (d.fii_net < 0 && priceChange > 0) { regime = "ABSORPTION SELLING"; regimeColor = "#fbbf24"; }
        else if (d.fii_net > 0 && priceChange < 0) { regime = "ACCUMULATION (TRAP)"; regimeColor = "#60a5fa"; }
        else if (d.fii_net < 0 && priceChange < 0) { regime = "DISTRIBUTION/SELL-OFF"; regimeColor = "#f87171"; }

        return { 
            date: d.date?.slice(5), 
            fii_net: d.fii_net,
            dii_net: d.dii_net,
            net_absorption: (d.fii_net || 0) + (d.dii_net || 0),
            nifty: d.nifty_close,
            niftyChange: priceChange,
            regime,
            regimeColor
        };
    });
  }, [fiiTrend]);

  const currentRegime = spark[spark.length - 1] || { regime: "STABLE", regimeColor: "#94a3b8" };

  // Advanced Mapping for Time-Window Filtering (Panel 2)
  const windowKey = (flowWindow === "Today" ? "d1" : flowWindow === "5D" ? "d5" : "d20") as "d1" | "d5" | "d20";
  const sourceStats = fiiDii ? fiiDii[windowKey] : { fii_net: 0, dii_net: 0 };
  const currentSectors = (sectors as any)?.[windowKey] || [];
  
  const topSectors = [...currentSectors].sort((a: any, b: any) => b.flow_cr - a.flow_cr);

  const filteredSignals = (smartMoney || []).filter((row: any) => {
    if (signalFilter === "All") return true;
    return row.signal === signalFilter;
  });

  const sankeyData = useMemo(() => {
    const leaders = topSectors.slice(0, 4);
    const nodes = [
      { name: "FII Inflow" },
      { name: "DII Inflow" },
      { name: "Retail Inflow" },
      { name: "Equity Market" },
      { name: "Gold" },
      { name: "Bond Outflow" },
      ...leaders.map((s: any) => ({ name: s.sector })),
    ];
    const links = [
      { source: 0, target: 3, value: Math.max(100, Number(sourceStats.fii_net || 0) + 1000) },
      { source: 1, target: 3, value: Math.max(100, Number(sourceStats.dii_net || 0) + 800) },
      { source: 2, target: 3, value: 900 },
      { source: 5, target: 4, value: 700 },
      ...leaders.map((s: any, i: number) => ({
        source: 3,
        target: 6 + i,
        value: Math.max(80, Math.abs(s.flow_cr)),
      })),
    ];
    return { nodes, links };
  }, [topSectors, sourceStats]);

  const assetPanel = useMemo(() => {
    const assetKeys = ["NIFTY50", "GOLD", "USDINR", "BRENTOIL", "US10Y"];
    const rangeBucket = assets?.ranges?.[assetRange];
    if (rangeBucket) {
      return { chartRows: rangeBucket.points || [], ranking: rangeBucket.ranking || [], assetKeys };
    }

    // Backward compatibility: handle legacy backend shape { assets: [{ asset, series, normalized_rs, signal }] }
    const legacyAssets = (assets as any)?.assets;
    if (Array.isArray(legacyAssets) && legacyAssets.length > 0) {
      const rangeToPoints: Record<string, number> = { "1W": 5, "1M": 22, "3M": 66, "6M": 132, "1Y": 264 };
      const nameMap: Record<string, string> = {
        "USD/INR": "USDINR",
        "BRENT OIL": "BRENTOIL",
      };
      const rowsByIdx: Record<number, any> = {};
      let maxLen = 0;
      legacyAssets.forEach((entry: any) => {
        const key = nameMap[entry.asset] || entry.asset;
        if (!Array.isArray(entry.series)) return;
        maxLen = Math.max(maxLen, entry.series.length);
        entry.series.forEach((val: number, idx: number) => {
          if (!rowsByIdx[idx]) rowsByIdx[idx] = { idx: idx + 1 };
          rowsByIdx[idx][key] = Number(val);
        });
      });

      const take = Math.min(rangeToPoints[assetRange] || maxLen, maxLen);
      const startIdx = Math.max(0, maxLen - take);
      const rawRows = Object.values(rowsByIdx)
        .sort((a: any, b: any) => a.idx - b.idx)
        .slice(startIdx);

      // Normalize legacy raw price levels to RS base 100 for comparable plotting.
      const baseByKey: Record<string, number> = {};
      rawRows.forEach((row: any) => {
        assetKeys.forEach((k) => {
          const v = Number(row[k]);
          if (!baseByKey[k] && Number.isFinite(v) && v > 0) baseByKey[k] = v;
        });
      });

      const chartRows = rawRows.map((row: any, i: number) => {
        const normalized: any = { idx: i + 1 };
        assetKeys.forEach((k) => {
          const v = Number(row[k]);
          const b = baseByKey[k];
          if (!b || !Number.isFinite(v) || v <= 0) {
            normalized[k] = null;
            return;
          }
          normalized[k] = Number(((v / b) * 100).toFixed(2));
        });
        return normalized;
      });

      const ranking = legacyAssets
        .map((entry: any) => ({
          asset: nameMap[entry.asset] || entry.asset,
          rs_score: Number(entry.normalized_rs || 0),
          change_pct: Number((Number(entry.normalized_rs || 0) - 100).toFixed(2)),
          conviction: Number((Math.max(0, Math.min(100, (Number(entry.normalized_rs || 0) - 95) * 10))).toFixed(1)),
          flow_signal: entry.signal || "Benchmark",
        }))
        .sort((a: any, b: any) => b.rs_score - a.rs_score);
      const usedKeys = Array.from(
        new Set(ranking.map((r: any) => r.asset).filter((k: string) => ["NIFTY50", "GOLD", "USDINR", "BRENTOIL", "US10Y"].includes(k)))
      );
      return { chartRows, ranking, assetKeys: usedKeys.length ? usedKeys : assetKeys };
    }

    return { chartRows: [], ranking: [], assetKeys };
  }, [assets, assetRange]);

  const rotationPanel = useMemo(() => {
    const currentRotation = rotation ? rotation[windowKey] : null;
    const phaseText = currentRotation?.current_phase || "Phase Unknown";
    const match = String(phaseText).match(/Phase\s*(\d)/i);
    const phaseNumber = match ? Number(match[1]) : 0;
    const confidence = Number(currentRotation?.confidence || 0);
    const nextSectors = (currentRotation?.next_predicted_sector || []).filter(Boolean);

    const phaseGuide = [
      { id: 1, label: "Early Recovery", color: "#60a5fa", hint: "Risk low, quality names start moving." },
      { id: 2, label: "Mid Bull", color: "#34d399", hint: "Trend healthy, broader participation." },
      { id: 3, label: "Late Bull", color: "#fbbf24", hint: "Momentum strong, be selective." },
      { id: 4, label: "Distribution", color: "#f97316", hint: "Smart money rotates out of leaders." },
      { id: 5, label: "Risk-Off", color: "#f87171", hint: "Capital protection is priority." },
    ];

    const confidenceLabel =
      confidence >= 75 ? "High confidence" : confidence >= 50 ? "Medium confidence" : "Low confidence";

    const plainMessage =
      nextSectors.length > 0
        ? `Agle kuch sessions mein flow ${nextSectors.join(" + ")} side rotate ho sakta hai.`
        : "Abhi clear sector leader nahi hai. Capital ko defensive rakho.";

    return { phaseText, phaseNumber, confidence, phaseGuide, confidenceLabel, nextSectors, plainMessage };
  }, [rotation, windowKey]);

  if (loading) return <div className="text-slate-300" style={{ padding: 40, textAlign: 'center' }}>Loading money flow intelligence...</div>;
  if (error) return <div className="text-red-400" style={{ padding: 40 }}>{error}</div>;

  return (
    <div style={{ color: "#e2e8f0", display: "grid", gap: 16, fontFamily: "'JetBrains Mono','Inter',sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Money Flow Intelligence Dashboard</h1>
        <div style={{ color: sentimentColor, fontWeight: 700 }}>Sentiment: {liquidity?.sentiment}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <StatCard title="Nifty 50" value={String(marketOverview.nifty_close || "-")} />
        <StatCard title="Bank Nifty" value={String(marketOverview.banknifty_close || "-")} />
        <StatCard title="FII Net (Cr)" value={String(marketOverview.fii_net || "-")} />
        <StatCard title="DII Net (Cr)" value={String(marketOverview.dii_net || "-")} />
        <StatCard title="India VIX" value={String(marketOverview.india_vix || "-")} />
        <StatCard title="USD/INR" value={String(marketOverview.usd_inr || "-")} />
      </div>

      <Card title={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span>Panel 1 — Institutional Floor Analysis (IFA)</span>
            <div style={{ fontSize: 10, padding: "2px 8px", background: currentRegime.regimeColor + "22", color: currentRegime.regimeColor, borderRadius: 4, border: `1px solid ${currentRegime.regimeColor}44`, fontWeight: 800 }}>
                REGIME: {currentRegime.regime}
            </div>
        </div>
      }>
        <div style={{ height: 180, background: "#010409", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={spark}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#484f58", fontSize: 10 }} 
                dy={5}
              />
              
              <YAxis yAxisId="flow_axis" hide domain={['auto', 'auto']} />
              <YAxis yAxisId="nifty_axis" orientation="right" hide domain={['dataMin - 150', 'dataMax + 150']} />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Bar 
                yAxisId="flow_axis"
                dataKey="fii_net" 
                name="FII Net"
                isAnimationActive={false}
              >
                {spark.map((entry: any, index: number) => (
                  <Cell key={`cell-fii-${index}`} fill={entry.fii_net > 0 ? "#238636" : "#da3633"} />
                ))}
              </Bar>

              <Bar 
                yAxisId="flow_axis"
                dataKey="dii_net" 
                name="DII Net"
                isAnimationActive={false}
              >
                {spark.map((entry: any, index: number) => (
                  <Cell key={`cell-dii-${index}`} fill={entry.dii_net > 0 ? "#2ea043aa" : "#f85149aa"} />
                ))}
              </Bar>
              
              <Line 
                yAxisId="nifty_axis"
                type="monotone" 
                dataKey="nifty" 
                name="Nifty 50"
                stroke="#58a6ff" 
                strokeWidth={2} 
                dot={{ r: 2, fill: "#58a6ff" }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#238636" }}>
            <div style={{ width: 10, height: 10, background: "#238636", borderRadius: 2 }} /> INSTITUTIONAL FLOW
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#58a6ff" }}>
            <div style={{ width: 10, height: 10, background: "#58a6ff", borderRadius: 2 }} /> NIFTY 50 (PRICE)
          </div>
        </div>
      </Card>

      <Card title="Panel 2 — Money Flow Transmission (Sources → Sectors)">
        <div style={{ display: "flex", gap: 8, marginBottom: 15 }}>
          {(["Today", "5D", "20D"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setFlowWindow(w)}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                background: flowWindow === w ? "#38bdf8" : "rgba(255,255,255,0.05)",
                color: flowWindow === w ? "#000" : "#94a3b8",
                cursor: "pointer"
              }}
            >
              {w}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 15, alignItems: "center" }}>
          {/* STAGE 1: SOURCES */}
          <div style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.1)", borderRadius: 12, padding: 15 }}>
            <div style={{ fontSize: 9, color: "#10b981", letterSpacing: 2, marginBottom: 12, fontWeight: 800 }}>SOURCE OF CAPITAL (NET CR)</div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={[
                  { name: "FII (Foreign)", val: sourceStats.fii_net, fill: sourceStats.fii_net > 0 ? "#10b981" : "#f87171" },
                  { name: "DII (Domestic)", val: sourceStats.dii_net, fill: sourceStats.dii_net > 0 ? "#10b981" : "#f87171" },
                  { name: "Retail (Est)", val: Math.abs(sourceStats.fii_net * 0.1), fill: "#94a3b8" }
                ]}>
                  <XAxis type="number" hide domain={['auto', 'auto']} />
                  <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip content={<SourceTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="val" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TRANSMISSION ARROW */}
          <div style={{ textAlign: "center", fontSize: 24, color: "#1e293b" }}>➔</div>

          {/* STAGE 2: DEPLOYMENT */}
          <div style={{ background: "rgba(56,189,248,0.03)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 12, padding: 15 }}>
            <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: 2, marginBottom: 12, fontWeight: 800 }}>SECTOR DEPLOYMENT</div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={topSectors.slice(0, 5).map(s => ({ 
                  name: s.sector, 
                  val: s.flow_cr,
                  color: s.flow_cr >= 0 ? "#34d399" : "#f87171"
                }))}>
                  <XAxis type="number" hide domain={['auto', 'auto']} />
                  <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }} 
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11 }}
                    formatter={(val: number | undefined) => [`${val || 0} Cr`, "Flow"]}
                  />
                  <Bar dataKey="val" radius={[0, 4, 4, 0]} barSize={18}>
                    {topSectors.slice(0, 5).map((entry: any, index: number) => {
                      let badgeColor = entry.flow_cr >= 0 ? "#34d399" : "#f87171";
                      if (entry.rotation_badge === 'MOMENTUM') badgeColor = "#34d399";
                      else if (entry.rotation_badge === 'ABSORPTION') badgeColor = "#fbbf24";
                      else if (entry.rotation_badge === 'DISTRIBUTION') badgeColor = "#f97316";
                      else if (entry.rotation_badge === 'SELLOFF') badgeColor = "#f87171";
                      return <Cell key={`cell-${index}`} fill={badgeColor} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 15, padding: "10px 15px", background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 10, color: "#475569", display: "flex", justifyContent: "space-between" }}>
          <span>Market Sentiment: <b>{liquidity?.sentiment || "Neutral"}</b></span>
          <span>Flow Velocity: <b>High</b></span>
          <span>Top Intake: <b>{topSectors[0]?.sector}</b></span>
        </div>
      </Card>

      <Card title="Panel 3 — Sector Rotation Heatmap">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {topSectors.map((s: any) => {
            let badgeColor = "#94a3b8"; 
            let bgColor = "rgba(148,163,184,0.1)";
            let borderColor = "rgba(148,163,184,0.2)";

            if (s.rotation_badge === 'MOMENTUM') { badgeColor = "#34d399"; bgColor = "rgba(52,211,153,0.15)"; borderColor = "rgba(52,211,153,0.3)"; }
            else if (s.rotation_badge === 'ABSORPTION') { badgeColor = "#fbbf24"; bgColor = "rgba(251,191,36,0.15)"; borderColor = "rgba(251,191,36,0.3)"; }
            else if (s.rotation_badge === 'DISTRIBUTION') { badgeColor = "#f97316"; bgColor = "rgba(249,115,22,0.15)"; borderColor = "rgba(249,115,22,0.3)"; }
            else if (s.rotation_badge === 'SELLOFF') { badgeColor = "#f87171"; bgColor = "rgba(248,113,113,0.15)"; borderColor = "rgba(248,113,113,0.3)"; }
            else if (s.flow_cr >= 0) { badgeColor = "#34d399"; bgColor = "rgba(52,211,153,0.15)"; } // Fallback
            else { badgeColor = "#f87171"; bgColor = "rgba(248,113,113,0.15)"; } // Fallback

            return (
              <div key={`${s.sector}-${s.flow_cr}`} style={{ 
                border: `1px solid ${borderColor}`,
                borderRadius: 12, 
                padding: "16px 14px", 
                background: bgColor,
                transition: "all 0.2s ease"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ fontSize: 13, color: "#f8fafc" }}>{s.sector}</strong>
                  <span style={{ 
                    fontSize: 10, 
                    fontWeight: 800, 
                    padding: "2px 6px", 
                    borderRadius: 4, 
                    background: "rgba(0,0,0,0.3)",
                    color: badgeColor 
                  }}>{s.rotation_badge}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: badgeColor, letterSpacing: -1 }}>
                  {s.flow_cr >= 0 ? "+" : ""}{s.flow_cr} Cr
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: s.rs_score > 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>Trend {s.rs_score}%</span>
                  <span>Del {s.delivery_pct}%</span>
                  <span>OI {s.oi_change_pct}%</span>
                </div>
                <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={`${s.sector}-b-${idx}`}
                      style={{
                        flex: 1,
                        height: 12,
                        borderRadius: 4,
                        background: idx < Math.max(1, Math.round(Math.abs(s.flow_cr) / 800)) ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Panel 4 — Smart Money Signals">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {(["All", "Accumulation", "Distribution", "Watch"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSignalFilter(f)}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                padding: "6px 10px",
                background: signalFilter === f ? "rgba(59,130,246,0.2)" : "transparent",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Stock", "SMS Score", "Signal", "Delivery %", "Volume vs Avg", "OI Trend", "Price vs VWAP", "Action"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.15)", padding: 8 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map((r: any, i: number) => {
                const isBullish = r.signal === "Accumulation";
                const isAboveVwap = r.vwap_position === "Above";
                const signalColor = isBullish ? "#34d399" : "#f87171";
                const vwapColor = isAboveVwap ? "#34d399" : r.vwap_position === "Below" ? "#f87171" : "#94a3b8";

                return (
                  <tr key={`${r.symbol}-${r.setupType || i}`} style={{ borderLeft: r.sms_score >= 8 ? "3px solid #34d399" : "3px solid transparent", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{r.symbol}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ 
                        background: r.sms_score >= 7 ? "rgba(52,211,153,0.15)" : r.sms_score <= 3 ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.05)",
                        color: r.sms_score >= 7 ? "#34d399" : r.sms_score <= 3 ? "#f87171" : "#f0f6fc",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontWeight: 800
                      }}>
                        {r.sms_score}/10
                      </span>
                    </td>
                    <td style={{ padding: 12, color: signalColor, fontWeight: 700 }}>{r.signal}</td>
                    <td style={{ padding: 12, fontWeight: 600 }}>{r.delivery_pct}%</td>
                    <td style={{ padding: 12, fontWeight: 600 }}>{r.volume_ratio}x</td>
                    <td style={{ padding: 12, fontSize: 12, color: "#94a3b8" }}>{r.oi_trend}</td>
                    <td style={{ padding: 12, color: vwapColor, fontWeight: 700, fontSize: 13 }}>{r.vwap_position}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ 
                        color: r.sms_score >= 7 ? "#34d399" : r.sms_score >= 3 ? "#fbbf24" : "#f87171",
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: 1
                      }}>
                        {r.sms_score >= 7 ? "BUY" : r.sms_score >= 3 ? "WATCH" : "EXIT"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Panel 5 — Asset Class Comparison">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {(["1W", "1M", "3M", "6M", "1Y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setAssetRange(r)}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                padding: "6px 10px",
                background: assetRange === r ? "rgba(245,158,11,0.25)" : "transparent",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={assetPanel.chartRows}>
              <XAxis dataKey="idx" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value: any, key: any) => [
                  value == null ? "No data" : `${Number(value).toFixed(2)} RS`,
                  key,
                ]}
                labelFormatter={(label) => `Point ${label}`}
              />
              {assetPanel.assetKeys.map((key) => {
                const colorMap: Record<string, string> = {
                  NIFTY50: "#38bdf8",
                  GOLD: "#facc15",
                  USDINR: "#fb7185",
                  BRENTOIL: "#f97316",
                  US10Y: "#22c55e",
                };
                return <Line key={key} dataKey={key} stroke={colorMap[key]} dot={false} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rank", "Asset", "RS Score", "Change %", "Conviction", "Flow Signal"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.15)", padding: 8 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assetPanel.ranking.length > 0 ? (
                assetPanel.ranking.map((row: any, i: number) => (
                  <tr key={row.asset}>
                    <td style={{ padding: 8 }}>{i + 1}</td>
                    <td style={{ padding: 8 }}>{row.asset}</td>
                    <td style={{ padding: 8 }}>{row.rs_score.toFixed(2)}</td>
                    <td style={{ padding: 8, color: row.change_pct >= 0 ? "#34d399" : "#f87171" }}>
                      {row.change_pct >= 0 ? "+" : ""}
                      {row.change_pct.toFixed(2)}%
                    </td>
                    <td style={{ padding: 8 }}>{row.conviction.toFixed(1)}%</td>
                    <td style={{ padding: 8 }}>{row.flow_signal}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ padding: 8, color: "#94a3b8" }} colSpan={6}>
                    No asset flow data available for this range yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card title="Panel 6 — Rotation Prediction Engine">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Market Stage (Current)</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: "#f8fafc" }}>{rotationPanel.phaseText}</div>
              </div>
              <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", color: "#93c5fd", fontWeight: 700, fontSize: 11 }}>
                {rotationPanel.confidence}% · {rotationPanel.confidenceLabel}
              </div>
            </div>

            <div style={{ padding: 10, borderRadius: 10, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 700, marginBottom: 6 }}>Simple Read (Easy)</div>
              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.45 }}>{rotationPanel.plainMessage}</div>
            </div>

            <div>
              <div style={{ marginBottom: 6, fontSize: 11, color: "#94a3b8" }}>Probability Meter</div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.1)", borderRadius: 999 }}>
                <div style={{ width: `${rotationPanel.confidence}%`, height: "100%", background: "linear-gradient(90deg, #60a5fa, #34d399)", borderRadius: 999 }} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {rotationPanel.phaseGuide.map((phase) => {
                const active = phase.id === rotationPanel.phaseNumber;
                return (
                  <div
                    key={phase.id}
                    style={{
                      border: `1px solid ${active ? phase.color + "88" : "rgba(255,255,255,0.12)"}`,
                      borderRadius: 10,
                      padding: "8px 10px",
                      background: active ? phase.color + "22" : "rgba(255,255,255,0.02)",
                      display: "grid",
                      gridTemplateColumns: "70px 1fr",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: active ? phase.color : "#94a3b8" }}>P{phase.id}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{phase.label}</div>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>{phase.hint}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title="Panel 6 — Options Intelligence">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
            <span>Spot Price</span>
            <span style={{ fontWeight: 800 }}>{optionsFlow?.spot != null ? optionsFlow.spot : "N/A"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
            <span>PCR</span>
            <span style={{ fontWeight: 800, color: (optionsFlow?.pcr ?? 1) > 1.2 ? "#f87171" : (optionsFlow?.pcr ?? 1) < 0.8 ? "#34d399" : "#e2e8f0" }}>
              {optionsFlow?.pcr != null ? Number(optionsFlow.pcr).toFixed(2) : "N/A"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
            <span>Max Pain Proxy</span>
            <span style={{ fontWeight: 800, color: "#fbbf24" }}>{optionsFlow?.maxPain != null ? optionsFlow.maxPain : "N/A"}</span>
          </div>
          <div style={{ marginBottom: 8, padding: "8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", color: "#93c5fd", fontSize: 12 }}>
            Source: {optionsFlow?.data_source || "UNAVAILABLE"}
          </div>
          <div style={{ marginTop: 12, padding: "10px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, textAlign: "center", color: "#60a5fa", fontWeight: 700 }}>
            {optionsFlow?.interpretation || "No derivative signal available yet"}
          </div>
        </Card>
      </div>

      <Card title="Panel 7 — Alert Feed (Auto-refresh ready)">
        <div style={{ display: "grid", gap: 8 }}>
          {alerts.length > 0 ? (
            alerts.map((a: any, i: number) => {
              const sev = String(a.severity || "LOW").toUpperCase();
              const isHigh = sev === "HIGH";
              const isMedium = sev === "MEDIUM";
              const color = isHigh ? "#f87171" : isMedium ? "#fbbf24" : "#60a5fa";
              const bg = isHigh ? "rgba(248,113,113,0.12)" : isMedium ? "rgba(251,191,36,0.1)" : "rgba(96,165,250,0.1)";
              const border = isHigh ? "rgba(248,113,113,0.35)" : isMedium ? "rgba(251,191,36,0.35)" : "rgba(96,165,250,0.35)";

              const titleMap: Record<string, string> = {
                FII_ANOMALY: "Foreign Flow Shock",
              };
              const friendlyTitle = titleMap[a.type] || "Market Alert";
              const meaning = isHigh
                ? "Heavy institutional movement detected. Short-term volatility can increase."
                : isMedium
                ? "Noticeable flow imbalance. Trend may become choppy."
                : "Informational alert. Watch for confirmation before action.";
              const action = isHigh
                ? "Reduce aggressive entries, tighten stop-loss, avoid over-leverage."
                : isMedium
                ? "Trade selective setups only and wait for follow-through."
                : "Keep monitoring; no immediate defensive action required.";

              return (
                <div
                  key={`${a.type}-${i}`}
                  style={{
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    padding: 12,
                    background: bg,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 800, color: "#f8fafc", fontSize: 15 }}>{friendlyTitle}</div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color,
                        border: `1px solid ${border}`,
                        borderRadius: 999,
                        padding: "2px 8px",
                        background: "rgba(0,0,0,0.2)",
                      }}
                    >
                      {sev}
                    </span>
                  </div>

                  <div style={{ color: "#e2e8f0", fontSize: 14 }}>
                    <strong>What happened:</strong> {a.message}
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                    <strong>Why it matters:</strong> {meaning}
                  </div>
                  <div style={{ color: "#dbeafe", fontSize: 13 }}>
                    <strong>Suggested action:</strong> {action}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                border: "1px solid rgba(148,163,184,0.3)",
                borderRadius: 10,
                padding: 12,
                background: "rgba(148,163,184,0.08)",
                color: "#cbd5e1",
              }}
            >
              No active alerts right now. Market flow looks stable.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ 
      border: "1px solid rgba(255,255,255,0.1)", 
      borderRadius: 12, 
      padding: 16, 
      background: "#0d1117", // Solid background to kill blur
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)" 
    }}>
      <h2 style={{ fontSize: 12, fontWeight: 800, color: "#8b949e", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1.5 }}>{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, background: "#161b22" }}>
      <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6fc" }}>{value}</div>
    </div>
  );
}
