const express = require('express');
const Watch = require('../models/Watch');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Helper function to parse form JSON data if multipart
const parseWatchBody = (req) => {
  let body = req.body;
  if (typeof body.watchColor === 'string') {
    try {
      body.watchColor = JSON.parse(body.watchColor);
    } catch (e) {
      body.watchColor = {};
    }
  }
  return body;
};

// =========================================================
// PUBLIC ROUTE - Unauthenticated Access for Customer Showcase
// =========================================================

// @route   GET /api/watches/public
// @desc    Get list of available watches for public store showcase
// @access  Public (No Auth Token Required)
router.get('/public', async (req, res) => {
  try {
    const {
      search,
      gender,
      watchType,
      mechanism,
      quality,
      page = 1,
      limit = 100,
    } = req.query;

    const query = { status: 'Available' };

    if (gender && gender !== 'All') {
      query.gender = gender;
    }

    if (watchType && watchType !== 'All') {
      query.watchType = watchType;
    }

    if (mechanism && mechanism !== 'All') {
      query.mechanism = mechanism;
    }

    if (quality && quality !== 'All') {
      query.quality = quality;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { brandName: searchRegex },
        { modelName: searchRegex },
        { modelCode: searchRegex },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Watch.countDocuments(query);
    const watches = await Watch.find(query)
      .select('brandName modelName modelCode gender watchType mechanism watchColor quality sellingPrice imageUrl createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: watches.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: watches,
    });
  } catch (error) {
    console.error('Error in public watch showcase API:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch public watch showcase' });
  }
});

// =========================================================
// PROTECTED ADMIN ROUTES - Require JWT Authorization
// =========================================================

router.use(protect);

// @route   GET /api/watches/export/sales
// @desc    Export sales details as CSV file download
// @access  Private (Admin)
router.get('/export/sales', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
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

    const query = { status: 'Sold' };
    if (startDate) {
      query.soldAt = { $gte: startDate };
    }

    const soldWatches = await Watch.find(query).sort({ soldAt: -1 });

    const headers = [
      'Sale Date',
      'Brand Name',
      'Model Name',
      'Model Code',
      'Gender',
      'Quality',
      'Watch Type',
      'Mechanism',
      'Buying Cost (INR)',
      'Target Price (INR)',
      'Final Sold Price (INR)',
      'Net Profit (INR)',
      'Profit Margin (%)',
      'Buyer Name',
      'Buyer Number',
    ];

    let csvContent = headers.join(',') + '\n';

    soldWatches.forEach((w) => {
      const soldDate = w.soldAt ? new Date(w.soldAt).toISOString().split('T')[0] : '';
      const profit = (w.finalPrice || 0) - (w.buyingPrice || 0);
      const margin = w.finalPrice && w.finalPrice > 0 ? ((profit / w.finalPrice) * 100).toFixed(2) : '0.00';

      const row = [
        `"${soldDate}"`,
        `"${w.brandName || ''}"`,
        `"${w.modelName || ''}"`,
        `"${w.modelCode || ''}"`,
        `"${w.gender || 'Unisex'}"`,
        `"${w.quality || ''}"`,
        `"${w.watchType || ''}"`,
        `"${w.mechanism || ''}"`,
        w.buyingPrice || 0,
        w.sellingPrice || 0,
        w.finalPrice || 0,
        profit,
        margin,
        `"${(w.buyerName || '').replace(/"/g, '""')}"`,
        `"${(w.buyerNumber || '').replace(/"/g, '""')}"`,
      ];
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=SmarterTimes_Sales_Report_${period}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting sales CSV:', error);
    res.status(500).json({ success: false, message: 'Failed to generate sales CSV export' });
  }
});

// @route   GET /api/watches/export/stock
// @desc    Export current stock details as CSV file download
// @access  Private (Admin)
router.get('/export/stock', async (req, res) => {
  try {
    const availableWatches = await Watch.find({ status: 'Available' }).sort({ createdAt: -1 });

    const headers = [
      'Date Added',
      'Brand Name',
      'Model Name',
      'Model Code',
      'Gender',
      'Quality',
      'Watch Type',
      'Mechanism',
      'Dial Color',
      'Band Color',
      'Buying Cost (INR)',
      'Target Selling Price (INR)',
      'Status',
      'Item Notes',
    ];

    let csvContent = headers.join(',') + '\n';

    availableWatches.forEach((w) => {
      const addedDate = w.createdAt ? new Date(w.createdAt).toISOString().split('T')[0] : '';
      const row = [
        `"${addedDate}"`,
        `"${w.brandName || ''}"`,
        `"${w.modelName || ''}"`,
        `"${w.modelCode || ''}"`,
        `"${w.gender || 'Unisex'}"`,
        `"${w.quality || ''}"`,
        `"${w.watchType || ''}"`,
        `"${w.mechanism || ''}"`,
        `"${w.watchColor?.dialColor || ''}"`,
        `"${w.watchColor?.chainOrStrapColor || ''}"`,
        w.buyingPrice || 0,
        w.sellingPrice || 0,
        `"${w.status}"`,
        `"${(w.notes || '').replace(/"/g, '""')}"`,
      ];
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=SmarterTimes_Available_Stock_Report.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting stock CSV:', error);
    res.status(500).json({ success: false, message: 'Failed to generate stock CSV export' });
  }
});

// @route   GET /api/watches
// @desc    Get list of watches with filtering, search & pagination
// @access  Private (Admin)
router.get('/', async (req, res) => {
  try {
    const {
      search,
      status,
      gender,
      quality,
      mechanism,
      watchType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 100,
    } = req.query;

    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (gender && gender !== 'All') {
      query.gender = gender;
    }

    if (quality && quality !== 'All') {
      query.quality = quality;
    }

    if (mechanism && mechanism !== 'All') {
      query.mechanism = mechanism;
    }

    if (watchType && watchType !== 'All') {
      query.watchType = watchType;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { brandName: searchRegex },
        { modelName: searchRegex },
        { modelCode: searchRegex },
        { buyerName: searchRegex },
        { buyerNumber: searchRegex },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Watch.countDocuments(query);
    const watches = await Watch.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: watches.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: watches,
    });
  } catch (error) {
    console.error('Error fetching watches:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch watch records' });
  }
});

// @route   GET /api/watches/:id
// @desc    Get single watch by ID
// @access  Private (Admin)
router.get('/:id', async (req, res) => {
  try {
    const watch = await Watch.findById(req.params.id);
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Watch record not found' });
    }
    res.json({ success: true, data: watch });
  } catch (error) {
    console.error('Error fetching single watch:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch watch details' });
  }
});

// @route   POST /api/watches
// @desc    Add new watch detail with optional Cloudinary image upload
// @access  Private (Admin)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const body = parseWatchBody(req);

    const {
      brandName,
      modelName,
      modelCode,
      gender,
      watchType,
      mechanism,
      watchColor,
      quality,
      buyingPrice,
      sellingPrice,
      notes,
    } = body;

    if (!brandName || !modelName || !watchType || !mechanism || !quality || buyingPrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required watch fields: brandName, modelName, watchType, mechanism, quality, buyingPrice, sellingPrice',
      });
    }

    if (!watchColor || !watchColor.dialColor || !watchColor.chainOrStrapColor) {
      return res.status(400).json({
        success: false,
        message: 'Watch color object with dialColor and chainOrStrapColor is required',
      });
    }

    let imageUrl = '';
    let imagePublicId = '';

    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploadRes.secure_url;
      imagePublicId = uploadRes.public_id;
    }

    const watch = await Watch.create({
      brandName,
      modelName,
      modelCode: modelCode || '',
      gender: gender || 'Unisex',
      watchType,
      mechanism,
      watchColor: {
        dialColor: watchColor.dialColor,
        chainOrStrapColor: watchColor.chainOrStrapColor,
      },
      quality,
      buyingPrice: Number(buyingPrice),
      sellingPrice: Number(sellingPrice),
      status: 'Available',
      notes: notes || '',
      imageUrl,
      imagePublicId,
    });

    res.status(201).json({
      success: true,
      message: 'Watch details added successfully',
      data: watch,
    });
  } catch (error) {
    console.error('Error adding watch:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to add watch' });
  }
});

// @route   PUT /api/watches/:id
// @desc    Update watch details & update Cloudinary image if new file attached
// @access  Private (Admin)
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    let watch = await Watch.findById(req.params.id);
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Watch record not found' });
    }

    const body = parseWatchBody(req);

    const {
      brandName,
      modelName,
      modelCode,
      gender,
      watchType,
      mechanism,
      watchColor,
      quality,
      buyingPrice,
      sellingPrice,
      status,
      finalPrice,
      buyerName,
      buyerNumber,
      soldAt,
      notes,
      removeImage,
    } = body;

    if (req.file) {
      if (watch.imagePublicId) {
        await deleteFromCloudinary(watch.imagePublicId);
      }
      const uploadRes = await uploadToCloudinary(req.file.buffer);
      watch.imageUrl = uploadRes.secure_url;
      watch.imagePublicId = uploadRes.public_id;
    } else if (removeImage === 'true' || removeImage === true) {
      if (watch.imagePublicId) {
        await deleteFromCloudinary(watch.imagePublicId);
      }
      watch.imageUrl = '';
      watch.imagePublicId = '';
    }

    if (brandName) watch.brandName = brandName;
    if (modelName) watch.modelName = modelName;
    if (modelCode !== undefined) watch.modelCode = modelCode;
    if (gender) watch.gender = gender;
    if (watchType) watch.watchType = watchType;
    if (mechanism) watch.mechanism = mechanism;
    if (watchColor) {
      if (watchColor.dialColor) watch.watchColor.dialColor = watchColor.dialColor;
      if (watchColor.chainOrStrapColor) watch.watchColor.chainOrStrapColor = watchColor.chainOrStrapColor;
    }
    if (quality) watch.quality = quality;
    if (buyingPrice !== undefined) watch.buyingPrice = Number(buyingPrice);
    if (sellingPrice !== undefined) watch.sellingPrice = Number(sellingPrice);
    if (notes !== undefined) watch.notes = notes;

    if (status) {
      watch.status = status;
      if (status === 'Sold') {
        if (finalPrice !== undefined) watch.finalPrice = Number(finalPrice);
        if (buyerName !== undefined) watch.buyerName = buyerName;
        if (buyerNumber !== undefined) watch.buyerNumber = buyerNumber;
        watch.soldAt = soldAt ? new Date(soldAt) : (watch.soldAt || new Date());
      } else if (status === 'Available') {
        watch.finalPrice = null;
        watch.buyerName = '';
        watch.buyerNumber = '';
        watch.soldAt = null;
      }
    }

    const updatedWatch = await watch.save();

    res.json({
      success: true,
      message: 'Watch updated successfully',
      data: updatedWatch,
    });
  } catch (error) {
    console.error('Error updating watch:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update watch' });
  }
});

// @route   PATCH /api/watches/:id/sell
// @desc    Update watch status to Sold with sale details & custom selling date
// @access  Private (Admin)
router.patch('/:id/sell', async (req, res) => {
  try {
    const { finalPrice, buyerName, buyerNumber, soldAt } = req.body;

    if (finalPrice === undefined || finalPrice === null || isNaN(Number(finalPrice))) {
      return res.status(400).json({
        success: false,
        message: 'Valid final price is required to mark watch as sold',
      });
    }

    const watch = await Watch.findById(req.params.id);
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Watch record not found' });
    }

    watch.status = 'Sold';
    watch.finalPrice = Number(finalPrice);
    watch.buyerName = buyerName || watch.buyerName || '';
    watch.buyerNumber = buyerNumber || watch.buyerNumber || '';
    watch.soldAt = soldAt ? new Date(soldAt) : new Date();

    const savedWatch = await watch.save();

    res.json({
      success: true,
      message: 'Watch marked as sold successfully',
      data: savedWatch,
    });
  } catch (error) {
    console.error('Error recording watch sale:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to record sale' });
  }
});

// @route   DELETE /api/watches/:id
// @desc    Delete watch record AND delete its image from Cloudinary
// @access  Private (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const watch = await Watch.findById(req.params.id);
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Watch record not found' });
    }

    if (watch.imagePublicId) {
      await deleteFromCloudinary(watch.imagePublicId);
    }

    await Watch.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Watch record and Cloudinary image deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting watch:', error);
    res.status(500).json({ success: false, message: 'Failed to delete watch record' });
  }
});

module.exports = router;
