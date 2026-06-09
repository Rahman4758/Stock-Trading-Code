"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AssetFlowResponse,
  getAssetFlow,
  getFiiDiiData,
  getFlowAlerts,
  getLiquidityEngine,
  getOptionsFlow,
  getRotationSignal,
  getSectorFlow,
  getSmartMoneySignals,
  SectorFlowItem,
  SmartMoneySignalItem,
} from "@/lib/moneyFlowApi";

type MarketFlowState = {
  loading: boolean;
  error: string | null;
  fiiDii: any;
  sectors: SectorFlowItem[];
  assets: AssetFlowResponse | null;
  smartMoney: SmartMoneySignalItem[];
  optionsFlow: any;
  liquidity: any;
  rotation: any;
  alerts: any[];
  refetch: () => Promise<void>;
};

const MarketFlowContext = createContext<MarketFlowState | null>(null);

export function MarketFlowProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fiiDii, setFiiDii] = useState<any>(null);
  const [sectors, setSectors] = useState<any>(null);
  const [assets, setAssets] = useState<AssetFlowResponse | null>(null);
  const [smartMoney, setSmartMoney] = useState<SmartMoneySignalItem[]>([]);
  const [optionsFlow, setOptionsFlow] = useState<any>(null);
  const [liquidity, setLiquidity] = useState<any>(null);
  const [rotation, setRotation] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fii, sec, ast, sms, opt, liq, rot, alr] = await Promise.all([
        getFiiDiiData(),
        getSectorFlow(),
        getAssetFlow(),
        getSmartMoneySignals(),
        getOptionsFlow(),
        getLiquidityEngine(),
        getRotationSignal(),
        getFlowAlerts(),
      ]);
      setFiiDii(fii);
      setSectors(sec);
      setAssets(ast);
      setSmartMoney(sms.rows || []);
      setOptionsFlow(opt);
      setLiquidity(liq);
      setRotation(rot);
      setAlerts(alr || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load market flow module");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  const value = useMemo(
    () => ({ loading, error, fiiDii, sectors, assets, smartMoney, optionsFlow, liquidity, rotation, alerts, refetch }),
    [loading, error, fiiDii, sectors, assets, smartMoney, optionsFlow, liquidity, rotation, alerts]
  );

  return <MarketFlowContext.Provider value={value}>{children}</MarketFlowContext.Provider>;
}

export function useMarketFlow() {
  const ctx = useContext(MarketFlowContext);
  if (!ctx) {
    throw new Error("useMarketFlow must be used inside MarketFlowProvider");
  }
  return ctx;
}
