const { asyncHandler } = require('../middleware/errorHandler');
const qbo = require('../services/qbo.service');

// GET /api/qbo/estimates?q=<customer or estimate #>&refresh=true
exports.listEstimates = asyncHandler(async (req, res) => {
    const estimates = await qbo.getOpenEstimates({
        search: req.query.q,
        forceRefresh: req.query.refresh === 'true',
    });
    res.json({ count: estimates.length, estimates });
});