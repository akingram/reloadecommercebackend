const express = require('express');
const { getSellerStats, getSellerOrders, getSellerOrderDetails, getTopSellingProducts, updateSellerProfile, setupSellerPayment, getBanks, verifyBankAccount } = require('../controller/sellerController');
const { authenticate, restrictToSeller } = require('../middleware/auth');

const router = express.Router();


// Dashboard stats
router.get('/stats', authenticate, restrictToSeller, getSellerStats);

// Orders management
router.get('/orders', authenticate, restrictToSeller, getSellerOrders);

// Products analytics
router.get('/products/top-selling', authenticate, restrictToSeller, getTopSellingProducts);

// Profile management
router.put('/profile', authenticate, restrictToSeller, updateSellerProfile);

router.get('/orders/:orderId', authenticate, restrictToSeller, getSellerOrderDetails);

router.post('/payment/setup', authenticate, restrictToSeller, setupSellerPayment);

router.get('/banks', authenticate, restrictToSeller, getBanks)

router.post('/verify-account', authenticate, restrictToSeller, verifyBankAccount);


module.exports = router;