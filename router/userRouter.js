const express = require('express');
const { signUp, login, signupSeller, loginSeller } = require('../controller/userController');
const { authenticate, restrictToSeller, requireUserOrGuestWithSession, requireAuth } = require('../middleware/auth');
const { postProduct, getAllProduct, getTrendingThisWeek, getWhatsHotThisWeek, getFeaturedCollections, getShopByCategory, getSpecialOffers, getStyleInspiration, getSellerProducts, updateProduct, deleteProduct, getProductById } = require('../controller/productController');
const upload = require('../middleware/multer');
const { addToCart, updateCart, deleteCartItem, getCart, syncCart } = require('../controller/cartController');
const { createOrderAndInitializePayment, verifyPaymentWebhook, confirmOrderDelivery, verifyPaymentManual, getOrders, getOrderDetails } = require('../controller/orderController');
const router = express.Router();
const sellerRoutes = require("./sellerRouter")


// Authentication routes
router.post("/signup", signUp)
router.post("/login", login)
router.post("/seller-signup", signupSeller)
router.post("/seller-login", loginSeller)

// Product routes - SPECIFIC ROUTES FIRST
router.post("/product-upload", authenticate, restrictToSeller, upload, postProduct);
router.get('/all', getAllProduct);
router.get('/trending', getTrendingThisWeek);
router.get('/hot', getWhatsHotThisWeek);
router.get('/featured', getFeaturedCollections);
router.get('/shop-by-category', getShopByCategory);
router.get('/special-offers', authenticate, getSpecialOffers);
router.get('/style-inspiration', getStyleInspiration);
router.get("/seller", authenticate, restrictToSeller, getSellerProducts)

// Cart routes
router.post('/add', addToCart);
router.put('/update', updateCart);
router.delete('/remove/:productId', deleteCartItem);
router.get('/cart', getCart);
router.post('/sync', syncCart);

// Order routes
router.post('/create-order', authenticate, requireUserOrGuestWithSession, createOrderAndInitializePayment);
router.post('/webhook/paystack', verifyPaymentWebhook);
router.get('/verify-payment-handler', verifyPaymentManual);
router.get('/orders', authenticate, getOrders);
router.get('/orders/:orderId', authenticate, getOrderDetails); 
router.post('/:orderId/confirm-delivery', authenticate, requireAuth, confirmOrderDelivery);

router.use('/', sellerRoutes);
router.patch('/:id', authenticate, restrictToSeller, updateProduct);
router.delete('/:id', authenticate, restrictToSeller, deleteProduct)
router.get('/:id', getProductById) 

module.exports = router;