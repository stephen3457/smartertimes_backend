const mongoose = require('mongoose');

const watchSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: [true, 'Brand Name is required'],
      trim: true,
      index: true,
    },
    modelName: {
      type: String,
      required: [true, 'Model Name is required'],
      trim: true,
    },
    modelCode: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      enum: {
        values: ['Men', 'Women', 'Unisex'],
        message: '{VALUE} is not a valid gender',
      },
      default: 'Unisex',
      index: true,
    },
    watchType: {
      type: String,
      required: [true, 'Watch Type is required'],
      enum: {
        values: ['Chain', 'Strap', 'Ceramic'],
        message: '{VALUE} is not a valid watch type',
      },
    },
    mechanism: {
      type: String,
      required: [true, 'Mechanism is required'],
      enum: {
        values: ['Quartz Movements', 'Automatic watches', 'Digital watch'],
        message: '{VALUE} is not a valid mechanism',
      },
    },
    watchColor: {
      dialColor: {
        type: String,
        required: [true, 'Dial color is required'],
        trim: true,
      },
      chainOrStrapColor: {
        type: String,
        required: [true, 'Chain or strap color is required'],
        trim: true,
      },
    },
    quality: {
      type: String,
      required: [true, 'Quality is required'],
      enum: {
        values: ['OG', 'First Copy', 'Second Copy'],
        message: '{VALUE} is not a valid quality tier',
      },
    },
    buyingPrice: {
      type: Number,
      required: [true, 'Buying price is required'],
      min: [0, 'Buying price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['Available', 'Sold'],
      default: 'Available',
      index: true,
    },
    finalPrice: {
      type: Number,
      min: [0, 'Final price cannot be negative'],
      default: null,
    },
    buyerName: {
      type: String,
      trim: true,
      default: '',
    },
    buyerNumber: {
      type: String,
      trim: true,
      default: '',
    },
    soldAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    imagePublicId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Virtual calculation helper for profit
watchSchema.virtual('profit').get(function () {
  if (this.status === 'Sold' && this.finalPrice !== null && this.finalPrice !== undefined) {
    return Number((this.finalPrice - this.buyingPrice).toFixed(2));
  }
  return 0;
});

// Virtual calculation helper for profit margin percentage
watchSchema.virtual('profitMargin').get(function () {
  if (this.status === 'Sold' && this.finalPrice && this.finalPrice > 0) {
    const profit = this.finalPrice - this.buyingPrice;
    return Number(((profit / this.finalPrice) * 100).toFixed(2));
  }
  return 0;
});

watchSchema.set('toJSON', { virtuals: true });
watchSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Watch', watchSchema);
