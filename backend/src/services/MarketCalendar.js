/**
 * MarketCalendar.js
 *
 * Authoritative NSE market holiday calendar for 2025–2026.
 * Used to determine:
 *  - Whether a given date was a trading day
 *  - The last trading day from any reference date
 *  - How many actual trading days are missing since last sync
 *
 * Source: NSE India official holiday list
 * https://www.nseindia.com/resources/exchange-communication-holidays
 *
 * Update this file at the start of each calendar year.
 */

// All dates in 'YYYY-MM-DD' format (IST).
// Weekends (Sat/Sun) are excluded automatically — only list weekday holidays here.
const NSE_HOLIDAYS = new Set([
    // ── 2025 ─────────────────────────────────────────────────────────────────
    '2025-01-26', // Republic Day
    '2025-02-26', // Chhatrapati Shivaji Maharaj Jayanti
    '2025-03-14', // Holi
    '2025-04-10', // Ram Navami
    '2025-04-14', // Dr. Babasaheb Ambedkar Jayanti
    '2025-04-18', // Good Friday
    '2025-05-01', // Maharashtra Day (Labour Day)
    '2025-08-15', // Independence Day
    '2025-08-27', // Ganesh Chaturthi
    '2025-10-02', // Gandhi Jayanti (Mahatma Gandhi Birthday)
    '2025-10-02', // Gandhi Jayanti (Mahatma Gandhi Birthday)
    '2025-10-21', // Diwali Laxmi Pujan (Muhurat Trading — special session, not a full holiday)
    '2025-10-22', // Diwali Balipratipada
    '2025-11-05', // Prakash Gurpurab (Guru Nanak Jayanti)
    '2025-12-25', // Christmas

    // ── 2026 ─────────────────────────────────────────────────────────────────
    '2026-01-26', // Republic Day
    '2026-03-19', // Holi (second day — exchange closed)
    '2026-03-20', // Holi
    '2026-04-02', // Ram Navami (tentative)
    '2026-04-03', // Good Friday
    '2026-04-14', // Dr. Babasaheb Ambedkar Jayanti
    '2026-05-01', // Maharashtra Day (Labour Day) ← TODAY
    '2026-05-28', // Buddha Purnima
    '2026-06-19', // Eid ul-Adha (Id-ul-Zuha) — tentative
    '2026-08-15', // Independence Day
    '2026-09-16', // Ganesh Chaturthi — tentative
    '2026-10-02', // Gandhi Jayanti
    '2026-11-09', // Diwali Laxmi Pujan — tentative
    '2026-11-10', // Diwali Balipratipada — tentative
    '2026-11-25', // Guru Nanak Jayanti — tentative
    '2026-12-25', // Christmas
]);

class MarketCalendar {
    /**
     * Check if a given date is a trading day.
     * Excludes: weekends (Sat/Sun) + NSE holidays.
     * @param {Date|string} date
     * @returns {boolean}
     */
    isTradingDay(date) {
        const d = typeof date === 'string' ? new Date(date + 'T00:00:00+05:30') : new Date(date);
        const day = d.getDay(); // 0=Sun, 6=Sat
        if (day === 0 || day === 6) return false; // Weekend

        const dateStr = this._toIST(d);
        return !NSE_HOLIDAYS.has(dateStr);
    }

    /**
     * Get the most recent trading day on or before a given date.
     * Goes backwards until it finds a trading day.
     * @param {Date} [from=new Date()] - Reference date (defaults to now IST)
     * @returns {Date} - The last trading day at midnight IST
     */
    lastTradingDay(from = new Date()) {
        const d = new Date(from);
        // Walk backward until we find a trading day
        for (let i = 0; i < 14; i++) { // Safety cap at 14 days back
            if (this.isTradingDay(d)) {
                d.setHours(0, 0, 0, 0);
                return d;
            }
            d.setDate(d.getDate() - 1);
        }
        // Fallback (should never happen)
        return from;
    }

    /**
     * Get the last trading day where EOD data is expected to be available.
     * 
     * Rule:
     *  - If today is a trading day AND current IST time >= 18:30 → today
     *  - If today is a trading day AND current IST time < 18:30  → previous trading day
     *  - If today is a holiday/weekend                           → previous trading day
     *
     * @returns {string} YYYY-MM-DD
     */
    /**
     * Get the last trading day where EOD data is expected to be available.
     */
    expectedDataDate() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // +05:30
        const istNow = new Date(now.getTime() + istOffset);
        
        const istHour   = istNow.getUTCHours();
        const istMinute = istNow.getUTCMinutes();
        const isPastEodRelease = (istHour > 18) || (istHour === 18 && istMinute >= 30);

        const todayIST = this._toIST(now);
        const isTodayTradingDay = this.isTradingDay(todayIST);

        if (isTodayTradingDay && isPastEodRelease) {
            // Data for today should be available
            return todayIST;
        }

        // Either it's a holiday or too early — return previous trading day
        const [yyyy, mm, dd] = todayIST.split('-');
        const prev = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd) - 1, 12, 0, 0, 0));
        return this._toIST(this.lastTradingDay(prev));
    }

    /**
     * Count actual trading days between two dates (exclusive of startDate, inclusive of endDate).
     */
    tradingDaysBetween(fromDateStr, toDateStr) {
        return this.getTradingDaysList(fromDateStr, toDateStr).length;
    }

    /**
     * Get an array of actual trading date objects between two dates (exclusive of fromDate, inclusive of toDate).
     */
    getTradingDaysList(fromDateStr, toDateStr) {
        const from = new Date(fromDateStr + 'T00:00:00+05:30');
        const to   = new Date(toDateStr   + 'T00:00:00+05:30');
        if (from >= to) return [];

        const dates = [];
        const cursor = new Date(from);
        cursor.setDate(cursor.getDate() + 1);

        while (cursor <= to) {
            if (this.isTradingDay(cursor)) {
                // Safely convert to a noon UTC date matching the IST date string
                const istStr = this._toIST(cursor);
                const [yyyy, mm, dd] = istStr.split('-');
                const noonUtc = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0, 0));
                dates.push(noonUtc);
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }

    /**
     * Calculate how many calendar days to pass to the data fetcher
     * to cover all missing trading days (with a small buffer for safety).
     * @param {string} latestDateStr - YYYY-MM-DD of last data in DB
     * @returns {number} calendar days to fetch
     */
    calendarDaysToFetch(latestDateStr) {
        const expectedDate = this.expectedDataDate();
        const tradingDaysMissing = this.tradingDaysBetween(latestDateStr, expectedDate);

        if (tradingDaysMissing === 0) return 0; // Already up-to-date

        // Calendar days ≈ trading days × 1.4 (accounting for weekends + holidays)
        // Plus a fixed buffer of 3 days for safety
        const calDays = Math.ceil(tradingDaysMissing * 1.4) + 3;
        return Math.min(Math.max(calDays, 5), 90); // min 5, max 90
    }

    /**
     * Convert a UTC Date to 'YYYY-MM-DD' in IST timezone.
     */
    _toIST(date) {
        const d = new Date(date);
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(d.getTime() + istOffset);
        return istDate.toISOString().split('T')[0];
    }

    /**
     * Check if the market is currently open (Mon–Fri, 9:15–15:30 IST, non-holiday).
     * @returns {boolean}
     */
    isMarketOpen() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        const hour = istNow.getUTCHours();
        const min  = istNow.getUTCMinutes();

        if (!this.isTradingDay(this._toIST(now))) return false;

        const startMin = 9 * 60 + 15;  // 9:15 IST
        const endMin   = 15 * 60 + 30; // 15:30 IST
        const curMin   = hour * 60 + min;

        return curMin >= startMin && curMin <= endMin;
    }
}

module.exports = new MarketCalendar();
