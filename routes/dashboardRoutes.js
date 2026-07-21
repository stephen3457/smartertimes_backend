const express = require('express');
const Watch = require('../models/Watch');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// @route   GET /api/dashboard/stats
// @desc    Get aggregated dashboard statistics with period selection
// @access  Private (Admin)
router.get('/stats', async (req, res) => {
  try {
    const { period = 'month' } = req.query; // 'day', 'week', 'month', 'year', 'all'

    // Determine date boundary for sold items based on period
    const now = new Date();
    let startDate = null;

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Available Inventory Stats (Always total current inventory)
    const availableWatches = await Watch.find({ status: 'Available' });
    const totalAvailableCount = availableWatches.length;
    
    const totalAvailableBuyingCost = availableWatches.reduce(
      (sum, w) => sum + (w.buyingPrice || 0),
      0
    );
    const totalAvailableExpectedRevenue = availableWatches.reduce(
      (sum, w) => sum + (w.sellingPrice || 0),
      0
    );
    const expectedInventoryProfit = totalAvailableExpectedRevenue - totalAvailableBuyingCost;

    // Sold Items Filter Query
    const soldQuery = { status: 'Sold' };
    if (startDate) {
      soldQuery.soldAt = { $gte: startDate };
    }

    const soldWatches = await Watch.find(soldQuery);
    const totalSoldCount = soldWatches.length;

    let totalRealizedRevenue = 0;
    let totalSoldBuyingCost = 0;

    soldWatches.forEach((w) => {
      totalRealizedRevenue += w.finalPrice || 0;
      totalSoldBuyingCost += w.buyingPrice || 0;
    });

    const totalRealizedProfit = totalRealizedRevenue - totalSoldBuyingCost;
    const profitMarginPercentage =
      totalRealizedRevenue > 0
        ? ((totalRealizedProfit / totalRealizedRevenue) * 100).toFixed(2)
        : '0.00';

    // Breakdown by Quality
    const qualityBreakdown = {
      OG: { count: 0, revenue: 0, profit: 0 },
      'First Copy': { count: 0, revenue: 0, profit: 0 },
      'Second Copy': { count: 0, revenue: 0, profit: 0 },
    };

    // Breakdown by Mechanism
    const mechanismBreakdown = {
      'Quartz Movements': { count: 0, revenue: 0, profit: 0 },
      'Automatic watches': { count: 0, revenue: 0, profit: 0 },
      'Digital watch': { count: 0, revenue: 0, profit: 0 },
    };

    // Breakdown by Watch Type
    const watchTypeBreakdown = {
      Chain: { count: 0, revenue: 0, profit: 0 },
      Strap: { count: 0, revenue: 0, profit: 0 },
      Ceramic: { count: 0, revenue: 0, profit: 0 },
    };

    // Brand performance map
    const brandMap = {};

    soldWatches.forEach((w) => {
      const profit = (w.finalPrice || 0) - (w.buyingPrice || 0);

      // Quality
      if (qualityBreakdown[w.quality]) {
        qualityBreakdown[w.quality].count += 1;
        qualityBreakdown[w.quality].revenue += w.finalPrice || 0;
        qualityBreakdown[w.quality].profit += profit;
      }

      // Mechanism
      if (mechanismBreakdown[w.mechanism]) {
        mechanismBreakdown[w.mechanism].count += 1;
        mechanismBreakdown[w.mechanism].revenue += w.finalPrice || 0;
        mechanismBreakdown[w.mechanism].profit += profit;
      }

      // Watch Type
      if (watchTypeBreakdown[w.watchType]) {
        watchTypeBreakdown[w.watchType].count += 1;
        watchTypeBreakdown[w.watchType].revenue += w.finalPrice || 0;
        watchTypeBreakdown[w.watchType].profit += profit;
      }

      // Brand Map
      const brand = w.brandName || 'Unknown';
      if (!brandMap[brand]) {
        brandMap[brand] = { brand, count: 0, revenue: 0, profit: 0 };
      }
      brandMap[brand].count += 1;
      brandMap[brand].revenue += w.finalPrice || 0;
      brandMap[brand].profit += profit;
    });

    const topBrands = Object.values(brandMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Recent 5 sales
    const recentSales = await Watch.find({ status: 'Sold' })
      .sort({ soldAt: -1 })
      .limit(5);

    const totalSystemItems = await Watch.countDocuments();

    res.json({
      success: true,
      period,
      metrics: {
        totalSystemItems,
        available: {
          count: totalAvailableCount,
          totalBuyingCost: Number(totalAvailableBuyingCost.toFixed(2)),
          expectedRevenue: Number(totalAvailableExpectedRevenue.toFixed(2)),
          expectedProfit: Number(expectedInventoryProfit.toFixed(2)),
        },
        sold: {
          count: totalSoldCount,
          totalRealizedRevenue: Number(totalRealizedRevenue.toFixed(2)),
          totalBuyingCost: Number(totalSoldBuyingCost.toFixed(2)),
          totalRealizedProfit: Number(totalRealizedProfit.toFixed(2)),
          profitMarginPercentage: Number(profitMarginPercentage),
        },
      },
      breakdowns: {
        quality: qualityBreakdown,
        mechanism: mechanismBreakdown,
        watchType: watchTypeBreakdown,
        topBrands,
      },
      recentSales,
    });
  } catch (error) {
    console.error('Error in dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to compute dashboard metrics' });
  }
});

module.exports = router;
