# TECHNICAL SPECIFICATION & INTEGRATION GUIDE
Version 2.0 | Enterprise Edition | NSE/BSE India

8 Layers Analysis Depth | 15-Day Data Window | 5 Signals | T-7 Days Optimal Entry Window

INSTITUTIONAL ALGO ENGINE Event-Driven Smart Money System | Technical Specification

Institutional Algo Engine v2.0 | Confidential
## 1. System Overview

The Institutional Algo Engine is an enterprise-grade stock analysis system designed to track,
monitor, and signal trades based on how institutional investors (FII, DII, operators) position
themselves before corporate events. The core insight is simple: institutions have access to
deeper fundamental data and build positions 15–30 days before events. Retail traders enter 1–3
days before — too late. This system bridges that gap.

### 1.1 Core Philosophy
Technical charts are only the footprint of institutional activity. The real signal lives in:
• FII/DII daily net flows — who is accumulating vs distributing
• Delivery percentage — high delivery means genuine conviction buying, not speculation
• Put-Call Ratio (PCR) — options market positioning reveals institutional direction
• Open Interest (OI) changes — fresh longs vs short covering vs distribution
• Fundamental event calendar — earnings, board meetings, index rebalancing

### 1.2 Why This Approach Works

TCS Case Study (March–April 2025):
Price fell from ₹2600 to ₹2380 while market was also weak — retail panic sold.
Institutions accumulated in the ₹2380–2440 zone over 15 days before Q4 results.
Signals visible: Rising delivery %, put writing at 2400 strike, DII net buying.
1 week before results: Price began moving from ₹2436 toward ₹2567+ — institutions exiting
into retail FOMO.
Retail entered at ₹2550+. Institutions were already taking profits.

### 1.3 Signal Timeline

| Phase | Timing | Signal Type | Action |
|-------|--------|-------------|--------|
| Radar | 20–30 days | Event detected | Add to watchlist. Start daily monitoring. |
| Accumulation | 15–20 days | FII/DII flow begins | Watch delivery %, PCR, OI buildup. |
| Conviction Build | 7–14 days | Score rising weekly | Prepare position. Score must be ≥60. |
| Entry Window | 5–7 days | Multi-factor confirmed | Enter with full planned size. |
| Active Hold | 1–5 days | Price movement starts | Trail SL. Partial booking at T1. |
| Event Day | 0 days | Institutional exit | Exit 50% before announcement. |

## 2. The 8-Layer Analysis Framework

Every stock in the system is scored across 8 independent layers. Each layer captures a different
dimension of institutional behavior. Only when multiple layers align does the system generate a
high-confidence signal.

### 2.1 Scoring Matrix

| Layer | Max | What It Measures |
|-------|-----|------------------|
| Layer 1 — Event Calendar | 20/20 | Event type, proximity, historical move, direction bias |
| Layer 2 — Smart Money Price Action | 25/25 | Accumulation/distribution footprint in price + volume |
| Layer 3 — FII/DII Flow | 25/25 | 15-day net flow trend, divergence alerts, F&O stance |
| Layer 4 — OI & Options | 20/20 | Max pain, call wall, put floor, IV environment |
| Layer 5 — Fundamentals | 10/10 | Delivery %, revenue trend, earnings growth proxy |

TOTAL SCORE 100 
≥75 = STRONG BUY | 60–74 = BUY | 45–59 = WATCH | <45 = AVOID

### 2.2 Layer Details

**Layer 1 — Event Calendar Intelligence**
The system scans for all upcoming corporate events within a 20-day window. For each event it
calculates: event type and expected market impact, days remaining to event, historical average
post-event price move (%), and directional bias based on institutional positioning. Supported
event types include quarterly earnings (Q1–Q4), board meetings (dividend/buyback/split
decisions), AGM/EGM, analyst days, Nifty/Sensex index rebalancing, promoter lock-in expiry
windows, and macro events with sector-level impact (RBI policy, Fed decisions, crude oil
moves).

**Layer 2 — Smart Money Price Action**
This layer reads the institutional fingerprint in daily price and volume data over 15 trading
sessions. Bullish accumulation signals include: stock falling or flat while market rises
(divergence accumulation), high volume on green candles and low volume on red candles,
gradual higher lows forming near key support, rising delivery percentage while price is stagnant,
and large OI buildup in ATM/ITM call options. Bearish distribution signals are the mirror: stock
rising while market falls, high volume red days, price near resistance with declining delivery, and
heavy call writing at resistance (capping price).

**Layer 3 — FII/DII Flow Analysis**
This is the most important fundamental layer. The system tracks 15 sessions of FII and DII net
cash market activity. Key calculations: 3-day, 5-day, and 10-day rolling net flow averages for
both FII and DII, divergence detection (FII selling but DII aggressively buying = potential floor,
both buying = high conviction), sector-level flow rotation analysis, and F&O positioning (FII net
long futures + buying cash = maximum conviction). Cross-matching with price action determines
whether the stock's move is institutionally supported or a retail-driven trap.

**Layer 4 — Options & OI Intelligence**
The options chain reveals where institutions are protecting profits and where they expect price
to land on expiry. The system tracks: max pain level (price that causes maximum option buyer
losses = institutional target), highest call OI strike (resistance wall), highest put OI strike
(support floor), OI change today vs yesterday (fresh put writing = bullish, fresh call writing =
bearish), futures stance (long buildup vs short covering vs distribution), and implied volatility
environment (elevated IV pre-event = buy options; suppressed IV = sell options / avoid
directional plays).

**Layer 5 — Fundamental Signal**
Rather than relying on technical indicators, this layer focuses on data that reflects genuine
business conviction. High delivery percentage (>55%) means institutions are taking actual
delivery of shares — they intend to hold, not just trade. Revenue and earnings trend proxies are
built from the flow data. The 8-point fundamental checklist scores: delivery % consistency, net
bullish session count, combined FII+DII positivity, PCR above 0.9, revenue trend direction,
conviction delta (weekly change), and total score threshold.

## 3. Data Requirements & API Integration

The system requires daily data feeds from multiple sources. Below are the exact data points
needed, their sources, and recommended Indian market APIs for production integration.

### 3.1 Required Data Points — Daily

| Data Point | Frequency | Source | Why It Matters |
|------------|-----------|--------|----------------|
| FII Net Cash Flow | Daily (EOD) | NSE India / SEBI | Core institutional direction |
| DII Net Cash Flow | Daily (EOD) | NSE India / SEBI | Domestic conviction support |
| FII F&O Net Position | Daily (EOD) | NSE Derivatives | Hedged vs directional stance |
| Stock Delivery % | Daily (EOD) | NSE Bhavcopy | Genuine buying vs speculation |
| Options Chain (OI) | Intraday | NSE / Zerodha Kite | Max pain, call wall, put floor |
| Futures OI Change | Daily (EOD) | NSE Derivatives | Long buildup vs short buildup |
| Implied Volatility | Intraday | NSE / Upstox | Event premium & IV crush timing |
| Corporate Event Date | As announced | BSE Listings / NSE Corp | Trigger for monitoring window |
| Quarterly Revenue/PAT | Quarterly | BSE/NSE Results | Fundamental conviction base |
| Promoter Shareholding | Quarterly | SEBI Bulk Deals | Insider direction signal |

### 3.2 Recommended Indian Market APIs

Production API Stack (India)
1. Zerodha Kite Connect API — Options chain, live OI, futures data, delivery %
Endpoint: api.kite.trade | Cost: ₹2000/month | Coverage: NSE + BSE
2. Upstox API v2 — Real-time quotes, historical OHLCV, options data
Endpoint: api.upstox.com/v2 | Free tier available | WebSocket support
3. NSE India Website (Direct Scraping) — FII/DII daily data, bhavcopy, corporate events
URL: nseindia.com/api | Rate limit: 1 req/sec | No auth required
4. BSE Corporate Announcements — Board meeting dates, earnings dates, AGM notices
URL: bseindia.com/corporates | Free | XML/JSON format
5. Screener.in API — Fundamental data, quarterly results, peer comparison
URL: screener.in | Free tier: 100 req/day | Premium: unlimited

### 3.3 Data Storage Schema
Store daily snapshots per stock in a time-series structure. Minimum 15 sessions required for
conviction scoring. Recommended database: PostgreSQL with TimescaleDB extension for time-
series optimization, or MongoDB for flexible schema during development.

`daily_snapshot` table schema:
- symbol (VARCHAR) — Stock symbol e.g. TCS, INFY
- date (DATE) — Trading date
- fii_net_cr (DECIMAL) — FII net cash flow in Crores
- dii_net_cr (DECIMAL) — DII net cash flow in Crores
- fii_fno_net (DECIMAL) — FII F&O net position value
- delivery_pct (DECIMAL) — Delivery percentage for the day
- pcr (DECIMAL) — Put-Call Ratio (total OI based)
- oi_change_pct (DECIMAL) — Futures OI % change
- iv_atm (DECIMAL) — ATM implied volatility
- close_price (DECIMAL) — Day close price
- institutional_bias (ENUM) — bullish / bearish / neutral (computed)
- conviction_score (INTEGER) — Computed score 0–100

## 4. Event Monitor — Auto-Tracking Engine

The Event Monitor is the core operational component. It automatically identifies stocks with
events in the next 15–20 days, initiates daily tracking, builds conviction scores over time, and
triggers buy/sell recommendations when confidence crosses the threshold in the 7-day pre-
event window.

### 4.1 Stock Selection Logic
The system scans the NSE/BSE corporate event calendar every morning at 9:00 AM IST and
automatically adds stocks to the monitoring queue if they meet all of the following criteria:
• Corporate event (earnings, board meeting, AGM) is within 15–20 calendar days
• Stock is part of Nifty 500 universe (sufficient institutional participation)
• 30-day average daily volume > ₹10 Cr (sufficient liquidity for institutional activity)
• F&O segment stock (options data available for OI analysis)
• Not already in monitoring queue for a different event

### 4.2 Daily Data Collection Workflow
After market close (3:45 PM IST), the following automated steps run in sequence:
1. Fetch FII/DII net cash data from NSE India for all monitored stocks
2. Pull options chain snapshot (OI, IV, PCR) from Kite Connect API
3. Download NSE bhavcopy to extract delivery % for each stock
4. Fetch futures OI and change data from NSE derivatives segment
5. Compute daily institutional_bias (bullish / bearish / neutral)
6. Update conviction score by running 5-layer weighted algorithm
7. Store snapshot in daily_snapshot table with computed metrics
8. Compare today's score with yesterday's score — calculate delta
9. If score delta > 10 in 3 consecutive days: trigger WATCH alert
10. If score ≥ 70 AND days_to_event ≤ 7: trigger BUY/SELL recommendation

### 4.3 Conviction Score Algorithm

Conviction Score Formula (0–100 scale):
FII Component (0–25): score = min(25, max(0, (avg_fii_net / 1000) * 12 + 13))
DII Component (0–20): score = min(20, max(0, (avg_dii_net / 800) * 10 + 10))
PCR Component (0–20): score = (pcr >= 1.2) ? 20 : (pcr >= 0.9) ? 12 : 5
Delivery Component (0–15): score = (del_pct >= 60) ? 15 : (del_pct >= 50) ? 10 : 4
Fundamental (0–10): score = (rev_growth >= 5) ? 10 : (rev_growth >= 0) ? 6 : 2
Conviction Score = sum of all components (capped at 100)
Weekly Delta = today_score - score_7_days_ago
Rising delta over 3+ days = institutional accumulation in progress

### 4.4 Alert Threshold Logic

| Alert Type | Score Threshold | Days to Event | Recommended Action |
|------------|-----------------|---------------|--------------------|
| RADAR | Any | 15–20 days | Add to monitor. No position yet. |
| WATCH | ≥ 50 | 10–14 days | Review daily. Prepare capital. |
| PREPARE | ≥ 60 | 7–9 days | Small pilot entry (20–25% of planned size). |
| BUY | ≥ 70 | 4–7 days | Full entry. Set SL. Institutional window open. |
| STRONG BUY | ≥ 80 | 3–7 days | Full entry + add on dips. High confidence. |
| EXIT 50% | Any | 0–1 days | Before announcement. Lock partial profit. |
| FULL EXIT | Any | Event day | Post-event if T1 not hit. Avoid result gap risk. |

## 5. Trade Blueprint Generator

When the system generates a BUY or STRONG BUY signal (score ≥ 70, days ≤ 7), it
automatically produces a complete trade plan. This section defines the exact rules for each
component of the trade blueprint.

### 5.1 Entry Rules
• Ideal entry: Previous day's closing price ± 0.3% (limit order, not market)
• Entry zone: ATR-based band — Entry ± 0.5 × ATR(14)
• Entry trigger: Requires confirmation — price must hold above previous day's low for 30 minutes after market open
• Never chase: If price gaps up more than 1.5% at open, skip entry and wait for pullback to entry zone
• Staggered entry: 50% at ideal entry, 50% added if price dips to entry zone lower bound

### 5.2 Target Calculation
• T1 (40% booking): Previous swing high OR +3% from entry, whichever is closer
• T2 (40% booking): Next major resistance level OR +6% from entry
• T3 (20% booking): Extended target — Options max pain level OR +10% from entry
• Minimum acceptable risk-reward: 1:2 (if R:R < 2, skip the trade)

### 5.3 Stop Loss Rules
• Initial SL: Previous swing low OR Entry - 1.5 × ATR(14), whichever is lower
• Trail SL to entry cost after T1 is hit (breakeven trade from T1 onwards)
• Trail SL to T1 level after T2 is hit
• Hard rule: Mandatory full exit if daily candle closes below SL — no averaging down
• Institutional exit signal: Full exit if FII turns net seller for 3 consecutive sessions

### 5.4 Position Sizing Formula

Position Size = (Portfolio Capital × Risk %) / (Entry Price - Stop Loss Price)
Default risk per trade: 1% of total portfolio capital
Maximum single stock allocation: 5% of portfolio
Maximum sector allocation: 15% of portfolio (e.g. max 3 IT stocks simultaneously)
Example: Portfolio = ₹10,00,000 | Entry = ₹2440 | SL = ₹2380
Risk amount = ₹10,00,000 × 1% = ₹10,000
Per share risk = ₹2440 - ₹2380 = ₹60
Quantity = ₹10,000 / ₹60 = 166 shares (round to nearest lot)

### 5.5 Institutional Exit Recognition
The most important skill is recognizing when institutions are exiting. Exit when you see:
• Sudden high volume red candle after a sustained up-move (distribution candle)
• FII turning net seller after being net buyer for 10+ sessions
• Price reaches call wall (maximum OI resistance) and stalls for 2+ sessions
• Event day gap-up > 3% at open — institutions selling into retail excitement
• PCR drops sharply (from >1.0 to <0.8) — put writers exiting = bullish support weakening

## 6. Dashboard Components & UI

The frontend consists of two main views: the Event Monitor Dashboard (daily watchlist with
auto-tracking) and the Stock Detail View (deep-dive analysis per stock). Both are built as React
components with the Anthropic Claude API integrated for AI-powered institutional narrative
generation.

### 6.1 Event Monitor Dashboard
Left panel: Sorted watchlist of all stocks with events in next 20 days. Each row shows symbol,
signal badge (BUY/WATCH/AVOID), days to event, and a mini conviction sparkline. Right
panel: 4-tab detail view per selected stock.

Tab Content & Purpose
Daily Data: 15-day table: FII net, DII net, PCR, Delivery %, institutional bias dot per day. Color-coded green/red for direction.
Conviction: Area chart of conviction score over 15 days. Weekly delta indicator. Entry window recommendation based on score + days remaining.
Fundamental: 8-point checklist with pass/fail. Revenue trend, delivery consistency, smart money combined flow. Focus on data over charts.
AI Analysis: Claude API generates institutional narrative: FII/DII behavior, fundamental view, OI insight, pre-event strategy, risk factors, verdict with confidence %.

### 6.2 AI Analysis Integration (Claude API)
Each stock analysis sends a structured prompt to Claude Sonnet with all 15-day data points.
The API returns a JSON object with 10 fields covering institutional summary, fundamental view,
FII/DII insight, OI insight, conviction trend, pre-event strategy, risk factor, verdict
(BUY/WATCH/AVOID), target entry window, and confidence percentage.

Claude API Call — Key Parameters:
Model: claude-sonnet-4-20250514
Max tokens: 1000 (sufficient for structured JSON response)
System prompt: Institutional equity analyst role with JSON-only output instruction
User prompt: 15-day data summary with all computed metrics and scores
Response parsing: JSON.parse() with try/catch and markdown fence stripping
Caching: Cache response per stock per day — avoid redundant API calls
Cost optimization: Only trigger AI analysis when user clicks 'Analyze' button

## 7. Implementation Roadmap

Suggested development phases for building and deploying this system. Each phase is
independently valuable and can be released incrementally.

**Phase 1 — Foundation (Week 1–2)**
• Set up NSE India API scraper for FII/DII daily data
• Set up NSE bhavcopy parser for delivery % extraction
• Create PostgreSQL schema with daily_snapshot and event_calendar tables
• Build event calendar scanner (BSE/NSE corporate announcements)
• Implement basic conviction score algorithm (5 components)
• Manual testing with 5 stocks from current event calendar

**Phase 2 — Options Layer (Week 3–4)**
• Integrate Zerodha Kite Connect API for options chain data
• Build OI analysis engine: max pain, call wall, put floor calculation
• Add PCR computation from options chain
• Add futures OI change tracking
• Validate Layer 4 signals against historical events (back-test 10 stocks)

**Phase 3 — Dashboard (Week 5–6)**
• Build React Event Monitor component with left panel watchlist
• Build 4-tab detail view: Daily Data, Conviction, Fundamental, AI Analysis
• Integrate Claude API for institutional narrative generation
• Add real-time conviction sparklines and score delta indicators
• Mobile-responsive design (primary usage is mobile)

**Phase 4 — Automation & Alerts (Week 7–8)**
• Set up cron job for EOD data collection (3:45 PM IST daily)
• Build alert system: WhatsApp/Telegram bot for BUY signals
• Add conviction delta alerts (3-day rising delta = WATCH notification)
• Historical back-test engine: test system on last 12 months of events
• Performance dashboard: win rate, average R:R, average holding period

**Phase 5 — Enterprise Features (Week 9–12)**
• Portfolio-level exposure tracking (sector limits, total deployed capital)
• Automated trade journal with entry/exit tracking
• Comparative analysis: this event vs last 4 similar events for same stock
• Promoter and bulk deal monitoring integration (SEBI data)
• Custom universe builder (user can define which stocks to monitor)

## 8. Risk Management Framework

IMPORTANT: This system identifies institutional positioning patterns.
It does not guarantee outcomes. Institutions can and do exit before events.
All trades must be sized according to the position sizing formula in Section 5.4.
Never allocate more than 5% of portfolio to a single event-driven trade.

### 8.1 Known Failure Modes
• FII data lag: SEBI publishes FII data with 1-day lag. System uses T-1 data for T-day decisions.
• Event postponement: Board meetings and earnings dates can change. Always verify 24 hours before entry.
• Sector-wide selling: If Nifty IT or Nifty Bank falls >2% on event day, even strong individual signals fail.
• Operator traps: Mid-cap and small-cap stocks can show fake accumulation signals — stick to Nifty 500.
• IV crush post-event: If using options, the trade must account for 30–50% IV drop after announcement.

### 8.2 System Confidence Limitations
• Score ≥ 80 does not mean 80% probability of success — it means strong multi-factor alignment.
• Back-tested win rate target: 60–65% on score ≥ 70 setups with R:R ≥ 1:2.
• Expected drawdown in any single month: maximum 5% of portfolio (enforced by position sizing rules).
• The system is designed for 3–7 day event-driven trades, not long-term investing.
