const mongoose = require('mongoose');
const SectorStock = require('./src/models/SectorStock');

const MAPPING = {
  IT:     [ {s:"TCS", n:"Tata Consultancy Services"}, {s:"INFY", n:"Infosys"}, {s:"HCLTECH", n:"HCL Technologies"}, {s:"WIPRO", n:"Wipro"}, {s:"TECHM", n:"Tech Mahindra"} ],
  BANK:   [ {s:"HDFCBANK", n:"HDFC Bank"}, {s:"ICICIBANK", n:"ICICI Bank"}, {s:"SBIN", n:"State Bank of India"}, {s:"AXISBANK", n:"Axis Bank"}, {s:"KOTAKBANK", n:"Kotak Mahindra Bank"} ],
  AUTO:   [ {s:"MARUTI", n:"Maruti Suzuki"}, {s:"TATAMOTORS", n:"Tata Motors"}, {s:"MM", n:"Mahindra & Mahindra"}, {s:"HEROMOTOCO", n:"Hero MotoCorp"}, {s:"BAJAJ-AUTO", n:"Bajaj Auto"} ],
  PHARMA: [ {s:"SUNPHARMA", n:"Sun Pharma"}, {s:"CIPLA", n:"Cipla"}, {s:"AUROPHARMA", n:"Aurobindo Pharma"}, {s:"DRREDDY", n:"Dr Reddy's"}, {s:"DIVISLAB", n:"Divi's Labs"} ],
  FMCG:   [ {s:"HINDUNILVR", n:"HUL"}, {s:"ITC", n:"ITC Ltd"}, {s:"NESTLEIND", n:"Nestle India"}, {s:"DABUR", n:"Dabur India"}, {s:"MARICO", n:"Marico"} ],
  METAL:  [ {s:"TATASTEEL", n:"Tata Steel"}, {s:"HINDALCO", n:"Hindalco"}, {s:"JSWSTEEL", n:"JSW Steel"}, {s:"COALINDIA", n:"Coal India"}, {s:"NMDC", n:"NMDC"} ],
  REALTY: [ {s:"DLF", n:"DLF Ltd"}, {s:"OBEROIRLTY", n:"Oberoi Realty"}, {s:"PRESTIGE", n:"Prestige Estates"}, {s:"GODREJPROP", n:"Godrej Properties"}, {s:"PHOENIXLTD", n:"Phoenix Mills"} ],
  ENERGY: [ {s:"RELIANCE", n:"Reliance Industries"}, {s:"ONGC", n:"ONGC"}, {s:"NTPC", n:"NTPC"}, {s:"POWERGRID", n:"Power Grid"}, {s:"BPCL", n:"BPCL"} ],
};

async function seed() {
    await mongoose.connect('mongodb://localhost:27017/institutional-edge');
    console.log('Connected to MongoDB');

    await SectorStock.deleteMany({});
    
    const stocks = [];
    for (const [sectorId, items] of Object.entries(MAPPING)) {
        items.forEach(item => {
            stocks.push({
                sector_id: sectorId,
                symbol: item.s,
                name: item.n
            });
        });
    }

    await SectorStock.insertMany(stocks);
    console.log(`Seeded ${stocks.length} stocks across 8 sectors.`);
    process.exit(0);
}

seed().catch(console.error);
