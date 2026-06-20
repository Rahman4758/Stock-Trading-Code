import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    headers: { 'Content-Type': 'application/json' },
});

export interface SmartMoneyScores {
    institutionalFlow: number;
    bulkDeal: number;
    oiSignal: number;
    delivery: number;
    hiddenAccumulation: number;
}

export interface Stock {
    _id: string;
    symbol: string;
    name: string;
    sector: string;
    industry?: string;
    marketCap?: number;
    isFno?: boolean;
    indexCategory?: string;
    isActive: boolean;
}

export interface StockRecommendation {
    symbol: string;
    currentPrice?: number;
    compositeScore: number;
    scores: SmartMoneyScores;
    interpretation: string;
}

export interface PreTradeChecklist {
    institutionalScore_gte70: boolean;
    stage2Confirmed: boolean;
    validBreakoutPattern: boolean;
    rsi_in_ideal_zone: boolean;
    macd_bullish: boolean;
    adx_trending: boolean;
    rs_vs_nifty_positive: boolean;
    breakout_volume_confirmed: boolean;
    stoploss_defined: boolean;
    rr_ratio_gte3: boolean;
    nifty_in_uptrend: boolean;
}

export interface TechnicalSubScores {
    trend: number;
    breakout: number;
    momentum: number;
    relativeStrength: number;
    volumePattern: number;
    riskReward: number;
}

export interface TradeLevels {
    pivotPrice: number;
    chaseLimit: number;
    stopLoss: number;
    target1: number;
    target2: number;
    rrRatio: number;
}

export interface ScanResult {
    symbol: string;
    currentPrice: number;
    
    // Scores
    compositeScore: number; // Institutional Score
    technicalScore?: number;
    finalScore: number;
    scores: SmartMoneyScores; 
    subScores?: TechnicalSubScores;
    
    // Trade Info
    grade: string;
    action: string;
    setupType?: string;
    flags: string[];
    
    // Details
    preTradeChecklist?: PreTradeChecklist;
    checklistScore?: string;
    levels?: TradeLevels;
    
    // Legacy mapping
    recommendation?: string;
    confidence?: string;

    // Streak tracking
    streakDays?: number;
    streakGrade?: string;
    
    // Index mapping
    indexCategory?: string;
}

export interface DivergenceAlert {
    symbol: string;
    date: string;
    alertType: string;
    severity: string;
    message: string;
    actionRecommendation: string;
    expectedMove: string;
    confidence: number;
}

export interface SectorRank {
    indexName: string;
    rsCurrent: number;
    rsTrend: string;
    rotationSignal: string;
    close: number;
}

export interface SectorRotationResponse {
    leaders: SectorRank[];
    laggards: SectorRank[];
    all: SectorRank[];
}

export interface FootprintDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    deliveryPct: number;
    sma20?: number;
    sma50?: number;
    fiiNet?: number;
    diiNet?: number;
    combinedNet?: number;
    fiiBuy?: number;
    fiiSell?: number;
    diiBuy?: number;
    diiSell?: number;
    oiChangePct?: number;
    oiSignal?: string;
    oiDate?: string;
    bulkBuys?: number;
    bulkSells?: number;
    // Stock-level accumulation indicators (calculated server-side)
    cmf?: number | null;       // Chaikin Money Flow (CMF-20): -1 to +1
    deliveryFlow?: number;     // Volume × Delivery% — strong-hands absorption quantity
    mfv?: number;              // Money Flow Volume (raw, used for CMF rolling calc)
}

export interface OiStrike {
    strike: number;
    oi: number;
    oiChange: number;
    oiChangePct: number;
}

export interface OptionsIntelligence {
    pcrToday:         number | null;
    pcrYesterday:     number | null;
    pcrShift:         number | null;
    pcrSentiment:     'RISING' | 'FALLING' | 'NEUTRAL';
    putStrikeSignal:  'STRONG_PUT_BUILDUP' | 'WEAK_PUT_BUILDUP' | 'NEUTRAL';
    callStrikeSignal: 'STRONG_CALL_BUILDUP' | 'WEAK_CALL_BUILDUP' | 'NEUTRAL';
    topPutStrikes:    OiStrike[];
    topCallStrikes:   OiStrike[];
    maxPain:          number | null;
}

export interface FootprintChartResponse {
    symbol: string;
    dataPoints: number;
    chartData: FootprintDataPoint[];
    latestScore?: {
        compositeScore: number;
        interpretation: string;
        scores: SmartMoneyScores;
        anchorDate: string;
    } | null;
    optionsIntelligence?: OptionsIntelligence | null;
}

export interface TrackedPortfolioItem {
    _id: string;
    symbol: string;
    buyPrice: number;
    quantity: number;
    notes?: string;
    alertPrice?: number;
}

export interface PortfolioDailyUpdate {
    symbol: string;
    currentPrice: number;
    pnl: number;
    pnlPct: number;
    stopLoss: number;
    targetPrice: number;
    recommendation: string;
    score: number;
}

// API Calls
export const getLatestScan = async () => {
    const response = await api.get<ScanResult[]>('/scan/latest');
    return response.data;
};

export const getAllScannedStocks = async () => {
    const response = await api.get<ScanResult[]>('/scan/all');
    return response.data;
};

export const getAllStocks = async (): Promise<Stock[]> => {
    const response = await api.get<Stock[]>('/stocks?limit=500');
    return response.data;
};


export const getDivergences = async () => {
    const response = await api.get<DivergenceAlert[]>('/scan/divergences');
    return response.data;
};

export const getFootprint = async (symbol: string, days: number = 90) => {
    const response = await api.get<FootprintChartResponse>(`/footprint/${symbol}?days=${days}`);
    return response.data;
};

export const getSectorRotation = async () => {
    const response = await api.get<SectorRotationResponse>('/sectors/rotation');
    return response.data;
};

export const getPortfolio = async () => {
    const response = await api.get<any[]>('/portfolio');
    return response.data;
};

export const getPortfolioUpdate = async (id: string) => {
    const response = await api.get<PortfolioDailyUpdate>(`/portfolio/${id}/daily-update`);
    return response.data;
};

export const trackPortfolio = async (symbol: string, buyPrice: number, quantity: number, notes?: string, target1?: number, stopLoss?: number, trade_type?: string) => {
    const response = await api.post<TrackedPortfolioItem>('/portfolio/track', { symbol, buyPrice, quantity, notes, target1, stopLoss, entryReason: notes, trade_type });
    return response.data;
};

export const removeFromPortfolio = async (symbol: string) => {
    const response = await api.delete<TrackedPortfolioItem>(`/portfolio/${symbol}`);
    return response.data;
};

export const getStockDetail = async (symbol: string) => {
    const response = await api.get<Stock>(`/stocks/${symbol}`);
    return response.data;
};

export const getStockAnalysis = async (symbol: string) => {
    const response = await api.get<StockRecommendation>(`/stocks/${symbol}/analysis`);
    return response.data;
};

export const getSyncStatus = async () => {
    const response = await api.get<{ 
        needsSync: boolean; 
        isSyncing: boolean; 
        latestDataDate: string;
        expectedDate: string;
        currentDate: string;
        isMarketHoliday: boolean;
        isMarketOpen: boolean;
        tradingDaysMissing: number;
        calDaysToFetch: number;
        cooldownActive?: boolean;
        lastSync: { success: boolean; timestamp: string; summary?: any; } | null;
    }>('/sync/status');
    return response.data;
};

export const getDeepAnalysis = async (symbol: string) => {
    const response = await api.get(`/portfolio/${symbol}/deep-analysis`);
    return response.data;
};

export const getHoldingDetail = async (symbol: string) => {
    const response = await api.get(`/portfolio/${symbol}/holding-detail`);
    return response.data;
};

export const getJournal = async () => {
    const response = await api.get('/portfolio/v2/journal');
    return response.data;
};

export const runSync = async () => {
    // 10 minute timeout for long-running scraper
    const response = await api.post<{ message: string }>('/sync/run', {}, { timeout: 600000 });
    return response.data;
};

// AI Chat API
export const chatWithAI = async (symbol: string, contextData: any, message: string, history?: any[]) => {
    const response = await api.post<{ reply: string }>('/ai/chat', { symbol, contextData, message, history });
    return response.data;
};

// Watchlist API
export const getWatchlist = () => api.get('/watchlist');
export const searchWatchlistStocks = (query: string) => api.get(`/watchlist/search?q=${query}`);
export const addToWatchlist = (data: { symbol: string; addedFrom?: string; category?: string; notes?: string; isOwned?: boolean; buyPrice?: number; sellPrice?: number; stopLoss?: number; quantity?: number; buyDate?: string }) => api.post('/watchlist/add', data);
export const removeFromWatchlist = (symbol: string) => api.delete(`/watchlist/${symbol}`);
export const getWatchlistAnalysis = (symbol: string) => api.get(`/watchlist/${symbol}/analysis`);
export const analyzeWatchlistStock = (symbol: string) => api.post(`/watchlist/${symbol}/analyze`);
export const sendWatchlistChat = (symbol: string, message: string) => api.post(`/watchlist/${symbol}/chat`, { message });
export const analyzeAllWatchlist = () => api.post('/watchlist/analyze-all');
export const updateWatchlistItem = (symbol: string, data: { category?: string; notes?: string }) => api.patch(`/watchlist/${symbol}`, data);

export default api;
