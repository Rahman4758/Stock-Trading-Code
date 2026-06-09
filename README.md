# InstitutionalEdge — MERN Stack

> Smart money intelligence platform rewritten in the MERN stack.

## Architecture

| Service | Tech | Port |
|---|---|---|
| **Backend API** | Express.js + Mongoose | 4000 |
| **Analysis Microservice** | Flask + pymongo | 5001 |
| **Frontend** | Next.js | 3000 |
| **Database** | MongoDB 7 | 27017 |
| **Cache** | Redis 7 | 6379 |

## Quick Start

### 1. Start Infrastructure
```powershell
cd c:\Trading\institutional-edge-mern
docker-compose up -d
```

### 2. Install & Run Express Backend
```powershell
cd backend
npm install
node src/seed.js          # populate 20 Nifty50 stocks (run once)
npm run dev               # starts on http://localhost:4000
```

### 3. Install & Run Flask Analysis Service
```powershell
cd analysis-service
pip install -r requirements.txt
python app.py             # starts on http://localhost:5001
```

### 4. Run Data Pipeline (Manual)
```powershell
cd backend
node pipeline.js          # collects FII/DII + Bulk Deals from NSE
```

### 5. Start Frontend
```powershell
cd frontend
npm install
npm run dev               # starts on http://localhost:3000
```

## API Endpoints (Express — :4000)

```
GET  /api/v1/stocks                        List all stocks
GET  /api/v1/stocks/:symbol                Stock detail
GET  /api/v1/stocks/:symbol/analysis       Full analysis
GET  /api/v1/scan/latest?min_score=60      Market scan
GET  /api/v1/portfolio                     Watchlist
POST /api/v1/portfolio                     Add stock  { symbol }
DEL  /api/v1/portfolio/:symbol             Remove stock
GET  /api/v1/analysis/:symbol              Analysis with recommendation
```

## Automated Scheduling

The Express backend automatically schedules a daily pipeline (Mon–Fri at 18:30 IST) via `node-cron` when running. No Airflow required.

## Data Flow

```
NSE API → Node.js Collectors → MongoDB
                                  ↓
                          Flask Analyzer (pymongo)
                                  ↓
                       Express REST API (:4000)
                                  ↓
                       Next.js Dashboard (:3000)
```
