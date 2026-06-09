const FiiDiiData = require("../models/FiiDiiData");
const SectorIndex = require("../models/SectorIndex");
const DailySnapshot = require("../models/DailySnapshot");
const DailyPrice = require("../models/DailyPrice");
const MacroData = require("../models/MacroData");
const OiData = require("../models/OiData");
const Stock = require("../models/Stock");

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const normalizeTo100 = (value, min, max) => {
  if (max === min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
};

const toCr = (val) => val ? parseFloat((val / 10000000).toFixed(2)) : 0;

class MoneyFlowService {
  /**
   * FII/DII Data
   * Aggregates per-stock records into market-wide daily totals and matches with Nifty prices.
   */
  async getFiiDiiData() {
    // 1. Fetch market-wide flow using the FiiRepository (avoids expensive sum and double-counting)
    const fiiRepo = require('../repositories/FiiRepository');
    const marketFlow = await fiiRepo.getMarketFlow(30);

    if (!marketFlow || marketFlow.length === 0) return { today: {}, d1: {}, d5: {}, d20: {}, trend30: [] };


    // 2. Fetch Top Stats and History concurrently
    const [niftyLatest, banknifty, vix, macro, niftyHistory] = await Promise.all([
        SectorIndex.findOne({ indexName: 'NIFTY50' }).sort({ date: -1 }).lean(),
        SectorIndex.findOne({ indexName: 'NIFTY_BANK' }).sort({ date: -1 }).lean(),
        SectorIndex.findOne({ indexName: 'INDIA_VIX' }).sort({ date: -1 }).lean(),
        MacroData.findOne().sort({ date: -1 }).lean(),
        SectorIndex.find({ indexName: 'NIFTY50' }).sort({ date: -1 }).limit(60).lean()
    ]);

    // Create a date -> price map (YYYY-MM-DD)
    const niftyMap = new Map();
    niftyHistory.forEach(n => {
        const dateKey = n.date.toISOString().split('T')[0];
        if (!niftyMap.has(dateKey)) niftyMap.set(dateKey, n.close);
    });

    // 3. Scale Institutional Flows (Raw Rupees to Crores)
    const toCr = (val) => val ? parseFloat((val / 10000000).toFixed(2)) : 0;

    const rows = marketFlow.map((d) => {
      const dateKey = d.date;
      const historicalNifty = niftyMap.get(dateKey) || niftyLatest?.close || 0;

      return {
        date: dateKey,
        fii_buy: toCr(d.fiiGrossBuy),
        fii_sell: toCr(d.fiiGrossSell),
        dii_buy: toCr(d.diiGrossBuy),
        dii_sell: toCr(d.diiGrossSell),
        fii_net: toCr(d.fiiNet),
        dii_net: toCr(d.diiNet),
        nifty_close: historicalNifty,
        usd_inr: macro?.usd_inr || 0
      };
    });

    const latest = {
        ...rows[rows.length - 1],
        nifty_close: niftyLatest?.close || "-",
        banknifty_close: banknifty?.close || "-",
        india_vix: vix?.close || "-",
        usd_inr: macro?.usd_inr || "-"
    };

    // Calculate multi-window stats for the dashboard Panel 2
    const getStats = (days) => {
        const slice = rows.slice(-days);
        return {
            fii_net: parseFloat(slice.reduce((acc, r) => acc + r.fii_net, 0).toFixed(2)),
            dii_net: parseFloat(slice.reduce((acc, r) => acc + r.dii_net, 0).toFixed(2))
        };
    };

    return { 
        today: latest, 
        d1: getStats(1),
        d5: getStats(5),
        d20: getStats(20),
        trend30: rows 
    };
  }

  async getReferenceDate() {
    // Prefer DailySnapshot if populated
    const latest = await DailySnapshot.findOne({ 
        $or: [{ volume_ratio: { $gt: 0 } }, { delivery_pct: { $gt: 0 } }] 
    }).sort({ date: -1 }).select('date').lean();
    
    if (latest) return latest.date;

    // Fallback: use the most recent DailyPrice date (always populated by main pipeline)
    const latestPrice = await DailyPrice.findOne()
        .sort({ date: -1 }).select('date').lean();

    return latestPrice ? latestPrice.date : new Date();
  }

  /**
   * Sector Flow
   * Aggregates real FII/DII flow from stocks grouped by their sectors.
   */
  async getSectorFlow() {
    const windows = [1, 5, 20];
    const result = { d1: [], d5: [], d20: [] };
    const refDate = await this.getReferenceDate();

    for (const days of windows) {
        // Calculate window relative to the latest available data date
        const fromDate = new Date(refDate);
        fromDate.setDate(fromDate.getDate() - (days - 1));
        fromDate.setHours(0, 0, 0, 0);

        const flow = await FiiDiiData.aggregate([
            { $match: { date: { $gte: fromDate } } },
            {
                $lookup: {
                    from: 'stocks',
                    localField: 'symbol',
                    foreignField: 'symbol',
                    as: 'stockInfo'
                }
            },
            { $unwind: '$stockInfo' },
            {
                $group: {
                    _id: '$stockInfo.sector',
                    fii_net: { $sum: '$fiiNet' },
                    dii_net: { $sum: '$diiNet' },
                    stocks_tracked: { $addToSet: '$symbol' }
                }
            },
            { $sort: { fii_net: -1 } }
        ]);

        const SECTOR_MAP = {
            'FMCG': 'FMCG (Daily Needs)',
            'AUTO': 'Auto & Lifestyle',
            'BANK': 'Banks & Finance',
            'IT': 'IT & Software',
            'PHARMA': 'Pharma & Hospitals',
            'ENERGY': 'Power & Energy',
            'TELECOM': 'Telecom',
            'METAL': 'Metal & Mining',
            'METALS': 'Metal & Mining',
            'FINANCE': 'Banks & Finance'
        };

        const REVERSE_SECTOR_MAP = Object.entries(SECTOR_MAP).reduce((acc, [k, v]) => { acc[v] = k; return acc; }, {});

        // Determine timeframe for SectorPerformance lookup
        let tf = '1M';
        if (days === 1 || days === 5) tf = '1W';
        if (days === 20) tf = '1M';

        const SectorPerformance = require('../models/SectorPerformance');
        const performanceData = await SectorPerformance.find({ timeframe: tf }).lean();
        const perfMap = {};
        performanceData.forEach(p => {
            perfMap[p.sector_id] = p.total_change;
        });

        const mapped = await Promise.all(flow.map(async f => {
            // --- delivery_pct: use a 10-day lookback to find the latest available record per stock.
            const delivLookback = new Date(refDate);
            delivLookback.setDate(delivLookback.getDate() - 10);

            const deliveryDocs = await DailyPrice.aggregate([
                { $match: { symbol: { $in: f.stocks_tracked }, date: { $gte: delivLookback }, deliveryPct: { $gt: 0 } } },
                { $sort: { symbol: 1, date: -1 } },
                { $group: { _id: '$symbol', deliveryPct: { $first: '$deliveryPct' } } }
            ]);

            const avgDelivery = deliveryDocs.length > 0
                ? deliveryDocs.reduce((acc, d) => acc + (d.deliveryPct || 0), 0) / deliveryDocs.length
                : 0;

            const oiDocs = await OiData.find({
                symbol: { $in: f.stocks_tracked },
                date: { $gte: fromDate }
            }).select('oiChangePct').lean();

            const oiValues = oiDocs.map(o => o.oiChangePct || 0).filter(v => v !== 0);
            const avgOi = oiValues.length > 0
                ? oiValues.reduce((a, b) => a + b, 0) / oiValues.length
                : 0;

            const sectorNameUI = SECTOR_MAP[f._id] || f._id || 'General';
            const rawSectorCode = f._id; // like 'IT', 'METAL'
            
            // Map the total change to RS Score
            const avgRs = perfMap[rawSectorCode] !== undefined ? perfMap[rawSectorCode] : 0;

            // Advanced Rotation Badge Logic
            let badge = 'NEUTRAL';
            if (f.fii_net > 0 && avgRs > 0) badge = 'MOMENTUM';
            else if (f.fii_net > 0 && avgRs < 0) badge = 'ABSORPTION';
            else if (f.fii_net < 0 && avgRs > 0) badge = 'DISTRIBUTION';
            else if (f.fii_net < 0 && avgRs < 0) badge = 'SELLOFF';

            return {
                sector: sectorNameUI,
                flow_cr: toCr(f.fii_net + f.dii_net),
                fii_flow: toCr(f.fii_net),
                dii_flow: toCr(f.dii_net),
                delivery_pct: parseFloat(avgDelivery.toFixed(2)),
                oi_change_pct: parseFloat(avgOi.toFixed(2)),
                rs_score: parseFloat(avgRs.toFixed(2)), // Now represents % Price Change
                rotation_badge: badge
            };
        }));

        const merged = Object.values(mapped.reduce((acc, curr) => {
            if (!acc[curr.sector]) {
                acc[curr.sector] = { ...curr, _count: 1 };
            } else {
                acc[curr.sector].flow_cr += curr.flow_cr;
                acc[curr.sector].fii_flow += curr.fii_flow;
                acc[curr.sector].dii_flow += curr.dii_flow;
                acc[curr.sector].delivery_pct += curr.delivery_pct;
                acc[curr.sector].oi_change_pct += curr.oi_change_pct;
                acc[curr.sector].rs_score += curr.rs_score;
                acc[curr.sector]._count += 1;
            }
            return acc;
        }, {}));

        const finalMapped = merged.map(item => {
            if (item._count > 1) {
                item.delivery_pct = parseFloat((item.delivery_pct / item._count).toFixed(2));
                item.oi_change_pct = parseFloat((item.oi_change_pct / item._count).toFixed(2));
                item.rs_score = parseFloat((item.rs_score / item._count).toFixed(2));
                item.flow_cr = parseFloat(item.flow_cr.toFixed(2));
                item.fii_flow = parseFloat(item.fii_flow.toFixed(2));
                item.dii_flow = parseFloat(item.dii_flow.toFixed(2));

                let badge = 'NEUTRAL';
                if (item.fii_flow > 0 && item.rs_score > 0) badge = 'MOMENTUM';
                else if (item.fii_flow > 0 && item.rs_score < 0) badge = 'ABSORPTION';
                else if (item.fii_flow < 0 && item.rs_score > 0) badge = 'DISTRIBUTION';
                else if (item.fii_flow < 0 && item.rs_score < 0) badge = 'SELLOFF';
                item.rotation_badge = badge;
            }
            delete item._count;
            return item;
        }).sort((a, b) => b.fii_flow - a.fii_flow);

        const key = `d${days}`;
        result[key] = finalMapped;
    }

    return result;
  }

  /**
   * Asset Flow
   * Combines Macro data (Gold, USDINR) with Index performance.
   */
  async getAssetFlow() {
    const [macroRows, sectorNiftyRows, dailyNiftyRows] = await Promise.all([
      MacroData.find()
        .sort({ date: -1 })
        .limit(320)
        .select("date gold_price usd_inr brent_oil us10y")
        .lean(),
      SectorIndex.find({ indexName: { $in: ["NIFTY50", "NIFTY 50", "^NSEI"] } })
        .sort({ date: -1 })
        .limit(320)
        .select("date close")
        .lean(),
      DailyPrice.find({ symbol: { $in: ["NIFTY 50", "NIFTY50", "^NSEI"] } })
        .sort({ date: -1 })
        .limit(320)
        .select("date close")
        .lean(),
    ]);

    if (!macroRows.length && !sectorNiftyRows.length && !dailyNiftyRows.length) {
      return { asOf: null, ranges: {}, availableRanges: [] };
    }

    const macroByDate = new Map();
    for (const row of macroRows) {
      const key = row.date.toISOString().slice(0, 10);
      macroByDate.set(key, row);
    }

    const niftyByDate = new Map();
    [...sectorNiftyRows, ...dailyNiftyRows].forEach((row) => {
      const key = row.date.toISOString().slice(0, 10);
      if (!niftyByDate.has(key) || !niftyByDate.get(key)) {
        niftyByDate.set(key, row.close);
      }
    });

    const dateKeys = Array.from(new Set([...macroByDate.keys(), ...niftyByDate.keys()])).sort();

    const timeline = dateKeys
      .map((key) => {
        const macro = macroByDate.get(key);
        const nifty = niftyByDate.get(key);
        return {
          date: key,
          NIFTY50: Number(nifty || 0),
          GOLD: Number(macro?.gold_price || 0),
          USDINR: Number(macro?.usd_inr || 0),
          BRENTOIL: Number(macro?.brent_oil || 0),
          US10Y: Number(macro?.us10y || 0),
        };
      })
      .filter((row) => row.NIFTY50 > 0 || row.GOLD > 0 || row.USDINR > 0 || row.BRENTOIL > 0 || row.US10Y > 0);

    // Forward-fill sparse macro/index points so chart lines remain continuous across ranges.
    const carry = { NIFTY50: 0, GOLD: 0, USDINR: 0, BRENTOIL: 0, US10Y: 0 };
    timeline.forEach((row) => {
      Object.keys(carry).forEach((k) => {
        const key = k;
        if (Number(row[key]) > 0) carry[key] = Number(row[key]);
        else if (carry[key] > 0) row[key] = carry[key];
      });
    });

    const rangeToPoints = {
      "1W": 5,
      "1M": 22,
      "3M": 66,
      "6M": 132,
      "1Y": 264,
    };

    const assetMeta = [
      { key: "NIFTY50", invert: false },
      { key: "GOLD", invert: false },
      { key: "USDINR", invert: false },
      { key: "BRENTOIL", invert: false },
      // Lower yields often imply risk-on. Invert so "up" means supportive flow.
      { key: "US10Y", invert: true },
    ];

    const buildRange = (sliceRows) => {
      const starts = {};
      assetMeta.forEach(({ key }) => {
        const first = sliceRows.find((r) => Number(r[key]) > 0);
        starts[key] = first ? Number(first[key]) : 0;
      });

      const series = sliceRows.map((row, idx) => {
        const point = { idx: idx + 1, date: row.date };
        assetMeta.forEach(({ key, invert }) => {
          const base = starts[key];
          const val = Number(row[key] || 0);
          if (!base || !val) {
            point[key] = null;
            return;
          }
          const normalized = invert ? (base / val) * 100 : (val / base) * 100;
          point[key] = Number(normalized.toFixed(2));
        });
        return point;
      });

      const ranking = assetMeta
        .map(({ key }) => {
          const vals = series.map((r) => r[key]).filter((v) => typeof v === "number");
          if (!vals.length) {
            return {
              asset: key,
              rs_score: 0,
              change_pct: 0,
              conviction: 0,
              flow_signal: "No Data",
            };
          }
          const last = vals[vals.length - 1];
          const changePct = last - 100;
          const conviction = Number(normalizeTo100(last, 96, 104).toFixed(1));
          let flowSignal = "Benchmark";
          if (last >= 102) flowSignal = "Leading";
          else if (last <= 98) flowSignal = "Outflow Confirmed";

          return {
            asset: key,
            rs_score: Number(last.toFixed(2)),
            change_pct: Number(changePct.toFixed(2)),
            conviction,
            flow_signal: flowSignal,
          };
        })
        .sort((a, b) => b.rs_score - a.rs_score);

      return { points: series, ranking };
    };

    const ranges = {};
    Object.entries(rangeToPoints).forEach(([range, count]) => {
      if (!timeline.length) {
        ranges[range] = { points: [], ranking: [] };
        return;
      }
      const slice = timeline.slice(-Math.min(count, timeline.length));
      ranges[range] = buildRange(slice);
    });

    return {
      asOf: timeline[timeline.length - 1]?.date || null,
      availableRanges: Object.keys(rangeToPoints),
      ranges,
    };
  }

  /**
   * Smart Money Signals
   * Real dynamic signals from DailySnapshot (pooled 9-agent conviction).
   */
  async getSmartMoneySignals() {
    const snapshots = await DailySnapshot.find()
        .sort({ date: -1, conviction_score: -1 })
        .limit(20)
        .lean();

    const rows = snapshots.map(s => ({
        symbol: s.symbol,
        sms_score: Math.round(s.conviction_score / 10),
        signal: s.institutional_bias === 'bullish' ? 'Accumulation' : 'Distribution',
        delivery_pct: s.delivery_pct || 0,
        volume_ratio: s.volume_ratio || 0,
        rsi: s.rsi || 0,
        vwap_position: s.vwap_position || "N/A",
        oi_trend: s.institutional_bias === 'bullish' ? 'Long Buildup' : 'Short Buildup'
    }));

    return { date: new Date().toISOString(), rows };
  }

  /**
   * Options Flow
   * Real PCR and OI data from the index options scraper.
   */
  async getOptionsFlow() {
    const [niftyPrice, indexOi] = await Promise.all([
      SectorIndex.findOne({ indexName: { $in: ["NIFTY50", "NIFTY 50", "^NSEI"] } }).sort({ date: -1 }).lean(),
      OiData.findOne({
        symbol: { $in: ["NIFTY", "NIFTY50", "NIFTY 50", "^NSEI"] },
        pcr: { $gt: 0 },
      })
        .sort({ date: -1, updatedAt: -1, createdAt: -1 })
        .lean(),
    ]);

    // If index-level options row is missing, aggregate latest symbol-level options data.
    let fallbackPcr = null;
    let dominantSignal = "NEUTRAL";
    if (!indexOi) {
      const latestDateDoc = await OiData.findOne({ pcr: { $gt: 0 } }).sort({ date: -1 }).select("date").lean();
      if (latestDateDoc?.date) {
        const latestDate = latestDateDoc.date;
        const latestRows = await OiData.find({ date: latestDate }).select("callOi putOi oiSignal").lean();
        const totals = latestRows.reduce(
          (acc, r) => {
            acc.callOi += Number(r.callOi || 0);
            acc.putOi += Number(r.putOi || 0);
            acc.signals[r.oiSignal || "NEUTRAL"] = (acc.signals[r.oiSignal || "NEUTRAL"] || 0) + 1;
            return acc;
          },
          { callOi: 0, putOi: 0, signals: {} }
        );
        fallbackPcr = totals.callOi > 0 ? Number((totals.putOi / totals.callOi).toFixed(4)) : null;
        dominantSignal = Object.entries(totals.signals).sort((a, b) => b[1] - a[1])[0]?.[0] || "NEUTRAL";
      }
    }

    const spot = Number(niftyPrice?.close || 0);
    const currentPcr = Number(indexOi?.pcr || fallbackPcr || 0);
    const oiSignal = (indexOi?.oiSignal || dominantSignal || "NEUTRAL").toUpperCase();

    let maxPain = null;
    if (spot > 0) {
      maxPain = Math.round(spot / 50) * 50;
      if (currentPcr > 1.2) maxPain += 50;
      if (currentPcr > 0 && currentPcr < 0.8) maxPain -= 50;
    }

    const interpretationMap = {
      LONG_BUILDUP: "Bullish buildup in derivatives (long positions increasing).",
      SHORT_BUILDUP: "Bearish buildup in derivatives (short positions increasing).",
      SHORT_COVERING: "Short covering underway; upside squeeze possible.",
      LONG_UNWINDING: "Long unwinding underway; upside conviction weak.",
      NEUTRAL: "Derivative positioning is currently balanced.",
    };

    return {
      spot: spot > 0 ? Number(spot.toFixed(2)) : null,
      pcr: currentPcr > 0 ? currentPcr : null,
      maxPain,
      interpretation: interpretationMap[oiSignal] || interpretationMap.NEUTRAL,
      signal: oiSignal,
      data_source: indexOi ? "INDEX_OPTIONS" : fallbackPcr ? "AGGREGATED_STOCK_OPTIONS" : "UNAVAILABLE",
      strikes: [],
    };
  }

  async getLiquidityEngine() {
    const macro = await MacroData.findOne().sort({ date: -1 }).lean();
    const fii = await FiiDiiData.find().sort({ date: -1 }).limit(3).lean();
    
    if (!macro || fii.length === 0) return { sentiment: "NEUTRAL", signals: [] };

    const fii3DayBuy = fii.every(d => d.fiiNet > 500);
    const riskOff = macro.gold_price > 2000 && macro.usd_inr > 83;
    const sentiment = fii3DayBuy ? "RISK ON" : riskOff ? "RISK OFF" : "NEUTRAL";

    return {
      sentiment,
      signals: [
        { key: "fii_three_day_buying", active: fii3DayBuy },
        { key: "gold_up_nifty_down", active: macro.gold_price > 2000 },
        { key: "usd_inr_pressure", active: macro.usd_inr > 83 },
        { key: "domestic_support_floor", active: fii[0].diiNet > 1000 },
      ],
    };
  }

  async getRotationSignal() {
    const flows = await this.getSectorFlow();
    
    const buildPhase = (sectorFlow) => {
      if (!sectorFlow || sectorFlow.length === 0) return { current_phase: "Phase 0 — Unknown", next_predicted_sector: [], confidence: 50 };

      // Sort sectors by flow_cr (total flow)
      const sortedSectors = [...sectorFlow].sort((a, b) => b.flow_cr - a.flow_cr);
      const leaders = sortedSectors.slice(0, 3).map(s => s.sector);
      const flowTotal = sortedSectors.reduce((acc, curr) => acc + curr.flow_cr, 0);

      let phase = "Phase 1 — Early Recovery";
      let confidence = 55;

      if (flowTotal > 2000) {
        phase = "Phase 2 — Mid Bull";
        confidence = 65;
        if (leaders.includes("IT") || leaders.includes("Banks & Finance")) {
            phase = "Phase 3 — Late Bull";
            confidence = 85;
        }
      } else if (flowTotal < -2000) {
        phase = "Phase 5 — Risk-Off";
        confidence = 80;
      } else if (flowTotal < 0) {
        phase = "Phase 4 — Distribution";
        confidence = 60;
      }

      return {
        current_phase: phase,
        next_predicted_sector: sortedSectors.slice(3, 5).map(s => s.sector),
        confidence
      };
    };

    return {
      d1: buildPhase(flows.d1),
      d5: buildPhase(flows.d5),
      d20: buildPhase(flows.d20),
    };
  }

  async getAlerts() {
    const fii = await FiiDiiData.findOne().sort({ date: -1 }).lean();
    const alerts = [];
    
    if (fii && Math.abs(fii.fiiNet) > 3000) {
        alerts.push({
            type: "FII_ANOMALY",
            severity: "HIGH",
            message: `External Flow Anomaly: FII net ${fii.fiiNet > 0 ? 'Buy' : 'Sell'} of ${Math.abs(fii.fiiNet)} Cr`
        });
    }

    return alerts;
  }
}

module.exports = new MoneyFlowService();
