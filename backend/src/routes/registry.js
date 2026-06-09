const express = require('express');
const router = express.Router();
const LogicRegistry = require('../models/LogicRegistry');
const SystemConfig = require('../models/SystemConfig');

/**
 * GET /api/v1/registry
 * Fetch all logic changes
 */
router.get('/', async (req, res) => {
    const changes = await LogicRegistry.find().sort({ createdAt: -1 });
    res.json(changes);
});

/**
 * GET /api/v1/registry/pending
 * Fetch pending approvals
 */
router.get('/pending', async (req, res) => {
    const pending = await LogicRegistry.find({ approval_status: 'PENDING' }).sort({ createdAt: -1 });
    res.json(pending);
});

/**
 * GET /api/v1/registry/config
 * Get current system weights and thresholds
 */
router.get('/config', async (req, res) => {
    const config = await SystemConfig.findOne({ config_id: 'current_weights' });
    res.json(config);
});

/**
 * PATCH /api/v1/registry/:id
 * Approve or Reject a proposed change
 */
router.patch('/:id', async (req, res) => {
    const { status, approved_by } = req.body;
    
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    const registration = await LogicRegistry.findById(req.params.id);
    if (!registration) {
        return res.status(404).json({ message: 'Registry entry not found' });
    }

    registration.approval_status = status;
    registration.approved_by = approved_by || 'rahman';
    registration.approval_date = new Date();
    await registration.save();

    // If approved, update the SystemConfig
    if (status === 'APPROVED') {
        const config = await SystemConfig.findOne({ config_id: 'current_weights' });
        
        if (config) {
            // Apply the change based on affected_parameter
            // For now, we handle basic weight and threshold updates
            // Example affected_parameter: 'weights.fii_score_max' or 'thresholds.scanner_min_confidence'
            const paramPath = registration.affected_parameter.split('.');
            let current = config;
            for (let i = 0; i < paramPath.length - 1; i++) {
                current = current[paramPath[i]];
            }
            current[paramPath[paramPath.length - 1]] = registration.new_value;
            
            config.last_updated_by = approved_by || 'rahman';
            await config.save();
        }
    }

    res.json({ message: `Change ${status.toLowerCase()} and applied.`, registration });
});

module.exports = router;
