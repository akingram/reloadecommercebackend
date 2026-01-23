const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    lowercase: true,
    trim: true,
    enum: {
      values: [
        'clothing',
        'footwear',
        'bags & accessories',
        'undergarments',
        'kids & baby fashion',
      ],
    },
  },
  images: [{ type: String }], 
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: [true, 'Seller is required'],
  },
  views: {
    type: Number,
    default: 0,
    min: [0, 'Views cannot be negative'],
  },
  sales: {
    type: Number,
    default: 0,
    min: [0, 'Sales cannot be negative'],
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for essential queries
productSchema.index({ category: 1 }); // For Shop by Category
productSchema.index({ createdAt: -1 }); // For sorting by recency
productSchema.index({ views: -1, sales: -1 }); // For Trending This Week
productSchema.index({ isFeatured: 1 }); // For Featured Collections

module.exports = mongoose.model('Product', productSchema);