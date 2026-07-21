const express = require('express');
const Watch = require('../models/Watch');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// @route   GET /api/dashboard/stats
// @desc    Get aggregated practical dashboard statistics with period selection
// @access  Private (Admin)
router.get('/stats', async (req, res) => {
  try {
    const { period = 'month' } = req.query; // 'day', 'week', 'month', 'year', 'all'

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

    // Available Inventory Stats
    const availableWatches = await Watch.find({ status: 'Available' });
    const totalAvailableCount = availableWatches.length;

    let totalAvailableBuyingCost = 0;
    let totalAvailableExpectedRevenue = 0;

    availableWatches.forEach((w) => {
      totalAvailableBuyingCost += w.buyingPrice || 0;
      totalAvailableExpectedRevenue += w.sellingPrice || 0;
    });

    const expectedInventoryProfit = totalAvailableExpectedRevenue - totalAvailableBuyingCost;

    // Sold Items Query for Period
    const soldQuery = { status: 'Sold' };
    if (startDate) {
      soldQuery.soldAt = { $gte: startDate };
    }

    const soldWatches = await Watch.find(soldQuery).sort({ soldAt: -1 });
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
        ? Number(((totalRealizedProfit / totalRealizedRevenue) * 100).toFixed(2))
        : 0;

    const averageSaleValue =
      totalSoldCount > 0
        ? Number((totalRealizedRevenue / totalSoldCount).toFixed(2))
        : 0;

    const averageProfitPerWatch =
      totalSoldCount > 0
        ? Number((totalRealizedProfit / totalSoldCount).toFixed(2))
        : 0;

    // Breakdown by Gender
    const genderBreakdown = {
      Men: { soldCount: 0, availableCount: 0, revenue: 0, profit: 0 },
      Women: { soldCount: 0, availableCount: 0, revenue: 0, profit: 0 },
      Unisex: { soldCount: 0, availableCount: 0, revenue: 0, profit: 0 },
    };

    availableWatches.forEach((w) => {
      const g = w.gender || 'Unisex';
      if (genderBreakdown[g]) {
        genderBreakdown[g].availableCount += 1;
      }
    });

    soldWatches.forEach((w) => {
      const g = w.gender || 'Unisex';
      const profit = (w.finalPrice || 0) - (w.buyingPrice || 0);
      if (genderBreakdown[g]) {
        genderBreakdown[g].soldCount += 1;
        genderBreakdown[g].revenue += w.finalPrice || 0;
        genderBreakdown[g].profit += profit;
      }
    });

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

    const brandMap = {};

    soldWatches.forEach((w) => {
      const profit = (w.finalPrice || 0) - (w.buyingPrice || 0);

      if (qualityBreakdown[w.quality]) {
        qualityBreakdown[w.quality].count += 1;
        qualityBreakdown[w.quality].revenue += w.finalPrice || 0;
        qualityBreakdown[w.quality].profit += profit;
      }

      if (mechanismBreakdown[w.mechanism]) {
        mechanismBreakdown[w.mechanism].count += 1;
        mechanismBreakdown[w.mechanism].revenue += w.finalPrice || 0;
        mechanismBreakdown[w.mechanism].profit += profit;
      }

      if (watchTypeBreakdown[w.watchType]) {
        watchTypeBreakdown[w.watchType].count += 1;
        watchTypeBreakdown[w.watchType].revenue += w.finalPrice || 0;
        watchTypeBreakdown[w.watchType].profit += profit;
      }

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

    const totalSystemItems = await Watch.countDocuments();

    res.json({
      success: true,
      period,
      metrics: {
        totalSystemItems,
        totalWatchesInStore: totalSystemItems,
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
          profitMarginPercentage,
          averageSaleValue,
          averageProfitPerWatch,
        },
      },
      breakdowns: {
        gender: genderBreakdown,
        quality: qualityBreakdown,
        mechanism: mechanismBreakdown,
        watchType: watchTypeBreakdown,
        topBrands,
      },
      salesList: soldWatches,
    });
  } catch (error) {
    console.error('Error in dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to compute dashboard metrics' });
  }
});

module.exports = router;
