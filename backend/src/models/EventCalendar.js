const mongoose = require('mongoose');

const eventCalendarSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        index: true,
        uppercase: true,
        trim: true
    },
    company_name: {
        type: String,
        required: true
    },
    sector: {
        type: String
    },
    event_type: {
        type: String,
        enum: ['Earnings', 'Board Meeting', 'AGM/EGM', 'Analyst Day', 'Index Rebalance', 'Macro', 'Other', 'Multiple Events'],
        required: true
    },
    event_date: {
        type: Date,
        required: true,
        index: true
    },
    description: {
        type: String
    },
    // Used for status tracking: is it an event we are actively monitoring?
    is_active_monitoring: {
        type: Boolean,
        default: true
    },
    // The expected impact historically for this event (optional tracking)
    expected_impact: {
        type: String,
        enum: ['High', 'Medium', 'Low', 'Unknown'],
        default: 'Unknown'
    }
}, {
    timestamps: true
});

// Let's ensure we don't duplicate events for the exact same company on the same date with the same type
eventCalendarSchema.index({ symbol: 1, event_date: 1, event_type: 1 }, { unique: true });

module.exports = mongoose.model('EventCalendar', eventCalendarSchema);
