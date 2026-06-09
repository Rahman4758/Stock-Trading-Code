require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const SectorStock = require('./src/models/SectorStock');

const mapping = {
    // Auto & Ancillaries
    'BHARATFORG': 'NIFTY_AUTO', 'BOSCHLTD': 'NIFTY_AUTO', 'EXIDEIND': 'NIFTY_AUTO', 
    'MOTHERSON': 'NIFTY_AUTO', 'FORCEMOT': 'NIFTY_AUTO', 'UNOMINDA': 'NIFTY_AUTO', 
    'AMBER': 'NIFTY_AUTO', 'SONACOMS': 'NIFTY_AUTO', 'TIINDIA': 'NIFTY_AUTO', 'HYUNDAI': 'NIFTY_AUTO',
    
    // Banking
    'AUBANK': 'NIFTY_BANK', 'BANDHANBNK': 'NIFTY_BANK', 'CANBK': 'NIFTY_BANK', 
    'FEDERALBNK': 'NIFTY_BANK', 'IDFCFIRSTB': 'NIFTY_BANK', 'RBLBANK': 'NIFTY_BANK', 
    'BANKINDIA': 'NIFTY_BANK', 'INDIANB': 'NIFTY_BANK', 'UNIONBANK': 'NIFTY_BANK', 'YESBANK': 'NIFTY_BANK',
    
    // Financial Services / Insurance / AMC
    'BAJFINANCE': 'NIFTY_FINANCIAL', 'BAJAJFINSV': 'NIFTY_FINANCIAL', 'SBILIFE': 'NIFTY_FINANCIAL', 
    'HDFCLIFE': 'NIFTY_FINANCIAL', 'CHOLAFIN': 'NIFTY_FINANCIAL', 'ABCAPITAL': 'NIFTY_FINANCIAL', 
    'HDFCAMC': 'NIFTY_FINANCIAL', 'ICICIGI': 'NIFTY_FINANCIAL', 'ICICIPRULI': 'NIFTY_FINANCIAL', 
    'LICHSGFIN': 'NIFTY_FINANCIAL', 'LTF': 'NIFTY_FINANCIAL', 'MANAPPURAM': 'NIFTY_FINANCIAL', 
    'MFSL': 'NIFTY_FINANCIAL', 'MUTHOOTFIN': 'NIFTY_FINANCIAL', 'PFC': 'NIFTY_FINANCIAL', 
    'RECLTD': 'NIFTY_FINANCIAL', 'SBICARD': 'NIFTY_FINANCIAL', 'SHRIRAMFIN': 'NIFTY_FINANCIAL', 
    'ANGELONE': 'NIFTY_FINANCIAL', 'BAJAJHLDNG': 'NIFTY_FINANCIAL', 'CDSL': 'NIFTY_FINANCIAL', 
    'CAMS': 'NIFTY_FINANCIAL', 'BSE': 'NIFTY_FINANCIAL', 'IREDA': 'NIFTY_FINANCIAL', 
    'PNBHOUSING': 'NIFTY_FINANCIAL', 'POLICYBZR': 'NIFTY_FINANCIAL', 'IRFC': 'NIFTY_FINANCIAL', 
    'JIOFIN': 'NIFTY_FINANCIAL', 'LICI': 'NIFTY_FINANCIAL', 'KFINTECH': 'NIFTY_FINANCIAL', 
    '360ONE': 'NIFTY_FINANCIAL', 'MOTILALOFS': 'NIFTY_FINANCIAL', 'NAM-INDIA': 'NIFTY_FINANCIAL', 
    'PAYTM': 'NIFTY_FINANCIAL', 'SAMMAANCAP': 'NIFTY_FINANCIAL', 'NUVAMA': 'NIFTY_FINANCIAL',
    
    // IT / Telecom / Tech
    'BHARTIARTL': 'NIFTY_IT', 'IDEA': 'NIFTY_IT', 'INDUSTOWER': 'NIFTY_IT', 'DIXON': 'NIFTY_IT', 
    'MPHASIS': 'NIFTY_IT', 'NAUKRI': 'NIFTY_IT', 'OFSS': 'NIFTY_IT', 'KPITTECH': 'NIFTY_IT', 
    'LTM': 'NIFTY_IT', 'TATAELXSI': 'NIFTY_IT',
    
    // Pharma / Healthcare
    'ALKEM': 'NIFTY_PHARMA', 'BIOCON': 'NIFTY_PHARMA', 'GLENMARK': 'NIFTY_PHARMA', 
    'LAURUSLABS': 'NIFTY_PHARMA', 'FORTIS': 'NIFTY_HEALTHCARE', 'MAXHEALTH': 'NIFTY_HEALTHCARE', 
    'MANKIND': 'NIFTY_PHARMA',
    
    // FMCG / Consumption / Retail
    'TITAN': 'NIFTY_FMCG', 'ASIANPAINT': 'NIFTY_FMCG', 'TRENT': 'NIFTY_FMCG', 'COLPAL': 'NIFTY_FMCG', 
    'JUBLFOOD': 'NIFTY_FMCG', 'PAGEIND': 'NIFTY_FMCG', 'PIDILITIND': 'NIFTY_FMCG', 
    'GODFRYPHLP': 'NIFTY_FMCG', 'DMART': 'NIFTY_FMCG', 'NYKAA': 'NIFTY_FMCG', 
    'KALYANKJIL': 'NIFTY_FMCG', 'SWIGGY': 'NIFTY_FMCG', 'RADICO': 'NIFTY_FMCG', 
    'UNITDSPR': 'NIFTY_FMCG', 'PATANJALI': 'NIFTY_FMCG', 'UPL': 'NIFTY_FMCG', 'PIIND': 'NIFTY_FMCG',
    
    // Metal
    'HINDZINC': 'NIFTY_METAL',
    
    // Energy / Power
    'ADANIENT': 'NIFTY_ENERGY', 'HINDPETRO': 'NIFTY_ENERGY', 'IEX': 'NIFTY_ENERGY', 
    'PETRONET': 'NIFTY_ENERGY', 'TATAPOWER': 'NIFTY_ENERGY', 'ADANIPOWER': 'NIFTY_ENERGY', 
    'JSWENERGY': 'NIFTY_ENERGY', 'INOXWIND': 'NIFTY_ENERGY', 'NHPC': 'NIFTY_ENERGY', 
    'OIL': 'NIFTY_ENERGY', 'POWERINDIA': 'NIFTY_ENERGY', 'PREMIERENE': 'NIFTY_ENERGY', 
    'SUZLON': 'NIFTY_ENERGY', 'WAAREEENER': 'NIFTY_ENERGY',
    
    // Infra / Capital Goods / Defence / Others
    'LT': 'NIFTY_INFRA', 'ADANIPORTS': 'NIFTY_INFRA', 'GRASIM': 'NIFTY_INFRA', 'ULTRACEMCO': 'NIFTY_INFRA', 
    'HAL': 'NIFTY_INFRA', 'BEL': 'NIFTY_INFRA', 'CUMMINSIND': 'NIFTY_INFRA', 'ABB': 'NIFTY_INFRA', 
    'ADANIENSOL': 'NIFTY_INFRA', 'AMBUJACEM': 'NIFTY_INFRA', 'ASTRAL': 'NIFTY_INFRA', 'CONCOR': 'NIFTY_INFRA', 
    'CROMPTON': 'NIFTY_INFRA', 'DALBHARAT': 'NIFTY_INFRA', 'HAVELLS': 'NIFTY_INFRA', 'INDHOTEL': 'NIFTY_INFRA', 
    'INDIGO': 'NIFTY_INFRA', 'POLYCAB': 'NIFTY_INFRA', 'SHREECEM': 'NIFTY_INFRA', 'SIEMENS': 'NIFTY_INFRA', 
    'SRF': 'NIFTY_INFRA', 'VOLTAS': 'NIFTY_INFRA', 'BLUESTARCO': 'NIFTY_INFRA', 'BDL': 'NIFTY_INFRA', 
    'CGPOWER': 'NIFTY_INFRA', 'APLAPOLLO': 'NIFTY_INFRA', 'COCHINSHIP': 'NIFTY_INFRA', 'DELHIVERY': 'NIFTY_INFRA', 
    'GMRAIRPORT': 'NIFTY_INFRA', 'RVNL': 'NIFTY_INFRA', 'KAYNES': 'NIFTY_IT', 'KEI': 'NIFTY_INFRA', 
    'MAZDOCK': 'NIFTY_INFRA', 'NBCC': 'NIFTY_INFRA', 'PGEL': 'NIFTY_INFRA', 'SOLARINDS': 'NIFTY_INFRA', 
    'SUPREMEIND': 'NIFTY_INFRA', 'MCX': 'NIFTY_FINANCIAL', 'ETERNAL': 'NIFTY_INFRA', 'TMPV': 'NIFTY_INFRA', 'VMM': 'NIFTY_INFRA'
};

async function run() {
    await connectMongo();
    
    let count = 0;
    for (const [symbol, sectorId] of Object.entries(mapping)) {
        await SectorStock.findOneAndUpdate(
            { symbol },
            { symbol, sector_id: sectorId },
            { upsert: true }
        );
        count++;
    }
    
    // Fallback: Any remaining active stocks map to NIFTY50 / NIFTY_INFRA generically
    const Stock = require('./src/models/Stock');
    const allActive = await Stock.find({ isActive: true }).lean();
    const allMapped = await SectorStock.find({}).lean();
    const mappedSymbols = new Set(allMapped.map(s => s.symbol));
    
    let fallbackCount = 0;
    for (const s of allActive) {
        if (!mappedSymbols.has(s.symbol) && s.symbol !== 'NIFTYNXT50') {
            await SectorStock.findOneAndUpdate(
                { symbol: s.symbol },
                { symbol: s.symbol, sector_id: 'NIFTY_INFRA' },
                { upsert: true }
            );
            fallbackCount++;
        }
    }
    
    console.log(`Successfully mapped ${count} specific stocks and ${fallbackCount} fallback stocks to sectors.`);
    process.exit(0);
}

run();
