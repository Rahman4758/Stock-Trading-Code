const express = require("express");
const router = express.Router();
const moneyFlowService = require("../services/moneyFlowService");
const MacroCollector = require("../collectors/MacroCollector");

/**
 * Money Flow Routes
 * All service methods are now asynchronous as they query MongoDB.
 */

router.get("/fii-dii-data", async (req, res) => {
  try {
    const data = await moneyFlowService.getFiiDiiData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sector-flow", async (req, res) => {
  try {
    const data = await moneyFlowService.getSectorFlow();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/asset-flow", async (req, res) => {
  try {
    const data = await moneyFlowService.getAssetFlow();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/asset-flow/backfill", async (req, res) => {
  try {
    const daysRaw = Number(req.body?.days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.round(daysRaw), 3650) : 365;

    const collector = new MacroCollector();
    await collector.backfill(days);
    await collector.collect();

    const data = await moneyFlowService.getAssetFlow();
    res.json({
      message: `Macro asset backfill completed for ${days} days`,
      asOf: data?.asOf || null,
      availableRanges: data?.availableRanges || [],
      pointsIn1Y: data?.ranges?.["1Y"]?.points?.length || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/smart-money-signals", async (req, res) => {
  try {
    const data = await moneyFlowService.getSmartMoneySignals();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/options-flow", async (req, res) => {
  try {
    const data = await moneyFlowService.getOptionsFlow();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/liquidity-engine", async (req, res) => {
  try {
    const data = await moneyFlowService.getLiquidityEngine();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/rotation-signal", async (req, res) => {
  try {
    const data = await moneyFlowService.getRotationSignal();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/alerts", async (req, res) => {
  try {
    const data = await moneyFlowService.getAlerts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
