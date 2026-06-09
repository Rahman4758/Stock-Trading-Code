require('express-async-errors');

// Added to trigger nodemon
console.log('Restarting server for dynamic momentum changes...');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');


const { connectMongo, redisClient } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const stocksRouter = require('./routes/stocks');
const scanRouter = require('./routes/scan');
const portfolioRouter = require('./routes/portfolio');
const analysisRouter = require('./routes/analysis');
const footprintRouter = require('./routes/footprint');
const sectorsRouter = require('./routes/sectors');
const syncRouter = require('./routes/sync');
const radarRouter = require('./routes/radar');
const moneyFlowRouter = require('./routes/moneyFlow');
const registryRouter = require('./routes/registry');
const paperRouter = require('./routes/paper');
const vaultRouter = require('./routes/vault');
const watchlistRouter = require('./routes/watchlist');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false, // Disable CSP for easier development on localhost
}));
app.use(morgan('dev'));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: 'InstitutionalEdge MERN API is running 🚀' }));

app.use('/api/v1/stocks', stocksRouter);
app.use('/api/v1/scan', scanRouter);
app.use('/api/v1/portfolio', portfolioRouter);
app.use('/api/v1/analysis', analysisRouter);
app.use('/api/v1/footprint', footprintRouter);
app.use('/api/v1/sectors', sectorsRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/radar', radarRouter);
app.use('/api/v1/money-flow', moneyFlowRouter);
app.use('/api/v1/registry', registryRouter);
app.use('/api/v1/paper', paperRouter);
app.use('/api/v1/vault', vaultRouter);
app.use('/api/v1/watchlist', watchlistRouter);
app.use('/api', moneyFlowRouter);

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

const start = async () => {
    await connectMongo();
    try { await redisClient.connect(); } catch { /* Redis optional */ }
    const server = app.listen(PORT, () => {
        console.log(`\n🚀  InstitutionalEdge API running → http://localhost:${PORT}`);
        console.log(`📄  Routes:`);
        console.log(`    GET  /api/v1/stocks`);
        console.log(`    GET  /api/v1/stocks/:symbol`);
        console.log(`    GET  /api/v1/stocks/:symbol/analysis`);
        console.log(`    GET  /api/v1/scan/latest`);
        console.log(`    GET  /api/v1/scan/divergences`);
        console.log(`    GET  /api/v1/footprint/:symbol`);
        console.log(`    GET  /api/v1/sectors/rotation`);
        console.log(`    GET  /api/v1/portfolio`);
        console.log(`    GET  /api/v1/portfolio/:id/daily-update`);
        console.log(`    POST /api/v1/portfolio/track`);
        console.log(`    DEL  /api/v1/portfolio/:symbol`);
        console.log(`    GET  /api/v1/analysis/:symbol\n`);
    });
    
    // Increase server timeout to 10 minutes to allow long-running scrapes to finish
    server.timeout = 600000;
};

start();
