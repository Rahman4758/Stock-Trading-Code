# InstitutionalEdge — Practical Trading Playbook

> Your complete guide to **building conviction**, **entering trades**, and **exiting positions** using this system.

---

## 🧠 Why Signals Change Daily (And Why That's Normal)

Smart money doesn't buy in one shot. Institutions accumulate over **10-20 trading days**. This means:

```
Day 1-5:    Institution starts buying quietly      → Score rises from 50 → 65
Day 6-10:   Buying increases, OI confirms           → Score jumps to 75 → "BUY" signal
Day 11-15:  Peak accumulation, all factors align    → Score hits 85+ → "A Grade"
Day 16-20:  Buying slows, positions are full        → Score drops to 70 → "WAIT"
Day 21+:    Distribution begins                     → Score falls below 60 → "EXIT"
```

**A stock that was "BUY" yesterday and "WAIT" today doesn't mean the trade is bad — it means the ENTRY WINDOW narrowed.** This is exactly how real institutions work.

---

## 📊 How Conviction Is Built (The Two-Layer System)

### Layer 1: Institutional Score (60% weight) — "Are smart money buying?"
| Factor | What It Checks | Lookback |
|--------|---------------|----------|
| FII/DII Flow (30%) | Net buying/selling by institutions | Last 20 days |
| Bulk Deals (25%) | Large block trades by Tier-1/2 funds | Last 20 days |
| OI Structure (20%) | Long Buildup vs Short Buildup in F&O | Last 5 days (weighted recent) |
| Delivery % (15%) | High delivery = genuine buying, not intraday | Last 20 days |
| Hidden Accumulation (10%) | Volume up + price flat = stealth buying | Last 20 days |

**Gate Rule:** Only if this score ≥ 70 does the system run Layer 2.

### Layer 2: Technical Score (40% weight) — "Is the chart ready?"
| Factor | What It Checks | Max Points |
|--------|---------------|------------|
| Trend (Stage 2) | Price > EMA50 > EMA150 > EMA200, slope positive | 25 |
| Breakout Quality | Volume spike at pivot, pocket pivot | 20 |
| Momentum | RSI 50-65, MACD bullish cross, ADX > 25 | 20 |
| Relative Strength | Stock beating Nifty50 over 52 weeks | 15 |
| Volume Pattern | OBV rising + high delivery on up days | 10 |
| Risk/Reward | SL to Target1 ratio ≥ 3:1 | 10 |

**Final Score = (Institutional × 0.60) + (Technical × 0.40)**

---

## 🎯 The Grade System — What To Do With Each Grade

| Grade | Final Score | Your Action | Position Size | Holding Period |
|-------|------------|-------------|---------------|----------------|
| **A+** | 90+ | **BUY immediately** at pivot breakout | Full position (2% risk) | 10-20 days |
| **A** | 80-89 | **BUY** on breakout confirmation candle | Standard position (1.5% risk) | 10-15 days |
| **B** | 70-79 | **Half position** now, add on confirmation | 50% position | 5-10 days |
| **C** | 60-69 | **Watchlist only** — wait for technical upgrade | Don't buy | Watch 3-5 days |
| **SKIP** | <60 | **Ignore** — no confluence | Don't buy | — |

---

## 🚪 Exact Entry Rules

### When to Enter:
1. **Grade must be A+ or A** (don't chase B grades unless you have experience)
2. **No blocking flags** — if you see `TREND_FAIL` or `POOR_RR`, skip even if grade is A
3. **Checklist score ≥ 8/11** — at least 8 of 11 pre-trade conditions should be ✅

### How to Enter:
```
Entry Price  = The "ENTRY POINT" shown in the Trade Card (pivot price)
Chase Limit  = Don't buy if price is > 5% above pivot (shown as "Chase Limit")
Stop Loss    = Shown in Trade Card (based on swing low + ATR)
```

### Example:
```
HDFCBANK — Grade: A+, Final Score: 92
  Entry Point:  ₹1,620  (buy here or on breakout above this)
  Chase Limit:  ₹1,701  (if price is already above this, DON'T chase)
  Stop Loss:    ₹1,555  (exit entire position if price closes below)
  Target 1:     ₹1,720  (book 50% profit here)
  Target 2:     ₹1,810  (book remaining 50% here)
  Risk/Reward:  2.5:1
```

---

## 🚨 Exact Exit Rules (6 Triggers)

Exit when **ANY ONE** of these triggers fires:

| # | Trigger | Action | Priority |
|---|---------|--------|----------|
| 1 | **Stop Loss hit** — price closes below SL | Exit 100% immediately | 🔴 Highest |
| 2 | **Target 1 hit** — price reaches T1 | Book 50%, move SL to breakeven | 🟡 |
| 3 | **Target 2 hit** — price reaches T2 | Book remaining 50% | 🟢 |
| 4 | **Institutional Score drops below 60** | Exit 100% — institutions are selling | 🔴 High |
| 5 | **Price closes below EMA(50)** | Exit 100% — trend breakdown | 🟡 |
| 6 | **OI Signal turns Short Buildup** | Exit 100% — bearish derivative signal | 🟡 |

> The ExitMonitor runs automatically every day and checks all 6 triggers for your open positions.

---

## 📅 Your Daily Workflow

### After Market Close (4:30 PM IST):
1. **Refresh the dashboard** — pipeline syncs new data automatically
2. **Check the Scanner page** — look for A+ and A grades
3. **Click to expand** any A+/A stock → read the Checklist and Trade Card
4. **Check Flags** — if you see `TREND_FAIL`, `POOR_RR`, or `CHASING`, skip that stock
5. **For existing positions** — check if ExitMonitor flagged any exits

### Decision Framework:
```
New A+ stock appeared?
  └─ Was it A+ yesterday too?
       ├─ YES → Strong conviction, buy at pivot
       └─ NO  → Wait 1 day to confirm it holds grade

Stock dropped from A+ to B?
  └─ Already in trade?
       ├─ YES → Hold, but tighten SL to breakeven
       └─ NO  → Don't enter, wait for re-upgrade

Stock has flags (TREND_FAIL)?
  └─ Always skip, regardless of score
```

---

## ⏱️ How Long Should You Hold?

| Scenario | Hold Period | Why |
|----------|-----------|-----|
| A+ grade, no flags, strong breakout | 15-20 days | Full institutional cycle |
| A grade, good checklist | 10-15 days | Standard swing trade |
| B grade (if you entered) | 5-10 days | Quick partial, tighter SL |
| Score drops below 60 while holding | EXIT immediately | Distribution started — don't fight institutions |

---

## 🔑 Key Principle

> **You are NOT predicting the market. You are following the money.**
> 
> When FIIs spend ₹500 crores buying HDFCBANK over 2 weeks while the stock is still near support — that's your edge. They don't buy that much without conviction. Your job is to ride their wave, not predict the wave.

**The system tells you WHAT institutions are doing. Your job is:**
1. Enter when they're accumulating (Score ≥ 70, Grade A/A+)
2. Exit when they stop or start selling (Score drops / SL hits)
3. Never fight the data — if the grade drops, respect it
