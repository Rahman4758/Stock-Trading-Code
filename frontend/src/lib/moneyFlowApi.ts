import api from "./api";

export interface FiiDiiDataResponse {
  today: Record<string, number | string>;
  d1: { fii_net: number; dii_net: number };
  d5: { fii_net: number; dii_net: number };
  d20: { fii_net: number; dii_net: number };
  trend30: Array<{ date: string; fii_net: number; dii_net: number }>;
}

export interface SectorFlowItem {
  sector: string;
  flow_cr: number;
  fii_flow: number;
  dii_flow: number;
  rotation_badge: string;
}

export interface SectorFlowResponse {
    d1: SectorFlowItem[];
    d5: SectorFlowItem[];
    d20: SectorFlowItem[];
}

export interface SmartMoneySignalItem {
  symbol: string;
  sms_score: number;
  signal: string;
  delivery_pct: number;
  volume_ratio: number;
  oi_trend: string;
  vwap_position: string;
}

export interface AssetFlowPoint {
  idx: number;
  date: string;
  NIFTY50: number | null;
  GOLD: number | null;
  USDINR: number | null;
  BRENTOIL: number | null;
  US10Y: number | null;
}

export interface AssetFlowRankRow {
  asset: string;
  rs_score: number;
  change_pct: number;
  conviction: number;
  flow_signal: string;
}

export interface AssetFlowRangeBucket {
  points: AssetFlowPoint[];
  ranking: AssetFlowRankRow[];
}

export interface AssetFlowResponse {
  asOf: string | null;
  availableRanges: string[];
  ranges: Record<string, AssetFlowRangeBucket>;
}

export const getFiiDiiData = async () => (await api.get<FiiDiiDataResponse>("/money-flow/fii-dii-data")).data;
export const getSectorFlow = async () => (await api.get<SectorFlowResponse>("/money-flow/sector-flow")).data;
export const getAssetFlow = async () => (await api.get<AssetFlowResponse>("/money-flow/asset-flow")).data;
export const getSmartMoneySignals = async () => (await api.get<{ rows: SmartMoneySignalItem[] }>("/money-flow/smart-money-signals")).data;
export const getOptionsFlow = async () => (await api.get("/money-flow/options-flow")).data;
export const getLiquidityEngine = async () => (await api.get("/money-flow/liquidity-engine")).data;
export const getRotationSignal = async () => (await api.get("/money-flow/rotation-signal")).data;
export const getFlowAlerts = async () => (await api.get("/money-flow/alerts")).data;
