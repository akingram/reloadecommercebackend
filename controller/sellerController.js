const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Seller = require("../models/sellerModel");
const axios = require("axios");
const mongoose = require("mongoose");

const TEST_ACCOUNTS = [
  { accountNumber: '0000000000', bankCode: '044', accountName: 'Test Account' },
  { accountNumber: '1111111111', bankCode: '058', accountName: 'Test Account Two' },
  { accountNumber: '2222222222', bankCode: '232', accountName: 'Test Account Three' },
];

const verificationCache = new Map();

// Get seller dashboard stats
const getSellerStats = async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Get total products
    const totalProducts = await Product.countDocuments({ seller: sellerId });

    // Get orders for this seller's products
    const sellerOrders = await Order.find({
      "items.productId": {
        $in: await Product.find({ seller: sellerId }).distinct("_id"),
      },
    });

    // Calculate stats
    const totalOrders = sellerOrders.length;
    const pendingOrders = sellerOrders.filter(
      (order) => order.paymentStatus === "hold"
    ).length;
    const completedOrders = sellerOrders.filter(
      (order) => order.paymentStatus === "paid"
    ).length;

    // Calculate revenue
    let totalRevenue = 0;
    let pendingRevenue = 0;

    sellerOrders.forEach((order) => {
      // Get items that belong to this seller
      const sellerItems = order.items.filter(
        (item) =>
          item.productId &&
          item.productId.seller &&
          item.productId.seller.toString() === sellerId.toString()
      );

      const orderAmount = sellerItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );

      if (order.paymentStatus === "paid") {
        totalRevenue += orderAmount;
      } else if (order.paymentStatus === "hold") {
        pendingRevenue += orderAmount;
      }
    });

    const stats = {
      totalProducts,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue,
      pendingRevenue,
    };

    res.status(200).json({
      success: true,
      data: stats,
      message: "Stats retrieved successfully",
    });
  } catch (error) {
    console.error("Get seller stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get seller stats",
      error: error.message,
    });
  }
};

// Get seller orders
const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { limit, page = 1, status } = req.query;

    // Get products belonging to this seller
    const sellerProducts = await Product.find({ seller: sellerId }).select(
      "_id"
    );
    const productIds = sellerProducts.map((product) => product._id);

    // Build query
    let query = {
      "items.productId": { $in: productIds },
    };

    // Add status filter if provided
    if (status && status !== "all") {
      query.paymentStatus = status;
    }

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate("items.productId", "title images price seller")
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit) : 50)
      .skip((parseInt(page) - 1) * (limit ? parseInt(limit) : 50));

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      orders,
      totalOrders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / (limit ? parseInt(limit) : 50)),
      message: "Orders retrieved successfully",
    });
  } catch (error) {
    console.error("Get seller orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get seller orders",
      error: error.message,
    });
  }
};

// Get specific order details for seller
const getSellerOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user._id;


    if (!orderId || orderId === "undefined" || orderId === "null") {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const order = await Order.findById(orderId)
      .populate("items.productId", "title images price seller")
      .populate("userId", "username email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    // Check if any items in this order belong to the seller
    const hasSellerItems = order.items.some(
      (item) =>
        item.productId &&
        item.productId.seller &&
        item.productId.seller.toString() === sellerId.toString()
    );

    if (!hasSellerItems) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    // Filter items to only show seller's items
    const sellerItems = order.items.filter(
      (item) =>
        item.productId &&
        item.productId.seller &&
        item.productId.seller.toString() === sellerId.toString()
    );

    // Create a modified order object with only seller's items
    const sellerOrder = {
      ...order.toObject(),
      items: sellerItems,
    };


    res.status(200).json({
      success: true,
      order: sellerOrder,
      message: "Order details retrieved successfully",
    });
  } catch (error) {
    console.error("Get seller order details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get order details",
      error: error.message,
    });
  }
};

// Update seller profile
const updateSellerProfile = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { storeName, email, phoneNumber, address, categories, description } =
      req.body;

    // Check if email is already taken by another seller
    if (email) {
      const existingSeller = await Seller.findOne({
        email,
        _id: { $ne: sellerId },
      });

      if (existingSeller) {
        return res.status(400).json({
          success: false,
          message: "Email is already taken by another seller",
        });
      }
    }

    const updatedSeller = await Seller.findByIdAndUpdate(
      sellerId,
      {
        storeName,
        email,
        phoneNumber,
        address,
        categories,
        description,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedSeller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    res.status(200).json({
      success: true,
      seller: updatedSeller,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update seller profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};


// Get top selling products for seller
const getTopSellingProducts = async (req, res) => {
  try {
    const sellerId = req.user._id;
    // Aggregate to get top selling products
    const topProducts = await Order.aggregate([
      // Unwind items array
      { $unwind: "$items" },

      // Lookup product details
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },

      // Unwind product array
      { $unwind: "$product" },

      // Match only products from this seller
      {
        $match: {
          "product.seller": sellerId,
        },
      },

      // Group by product
      {
        $group: {
          _id: "$product._id",
          name: { $first: "$product.title" },
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
          image: { $first: { $arrayElemAt: ["$product.images", 0] } },
        },
      },

      // Sort by total sold (descending)
      { $sort: { totalSold: -1 } },

      // Limit to top 10
      { $limit: 10 },
    ]);
    res.status(200).json({
      success: true,
      products: topProducts,
      message: "Top selling products retrieved successfully",
    });
  } catch (error) {
    console.error("Get top selling products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get top selling products",
      error: error.message,
    });
  }
};

// Setup seller payment with Paystack
const getBanks = async (req, res) => {
  try {
    const response = await axios.get("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
      params: {
        country: "nigeria",
        currency: "NGN",
        perPage: 100,
      },
      timeout: 10000,
    });

    // Sort banks alphabetically by name and only include active banks
    const sortedBanks = response.data.data
      .filter((bank) => bank.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((bank) => ({
        code: bank.code,
        name: bank.name,
      }));

    res.status(200).json({
      success: true,
      banks: sortedBanks,
      message: "Banks retrieved successfully",
    });
  } catch (error) {
    console.error("Get banks error:", error);

    // In test mode, return mock banks if Paystack fails
    if (process.env.NODE_ENV === 'development' || process.env.PAYSTACK_SECRET_KEY?.includes('test')) {
      const mockBanks = [
        { code: '044', name: 'Access Bank' },
        { code: '058', name: 'GTBank' },
        { code: '232', name: 'Sterling Bank' },
        { code: '033', name: 'United Bank for Africa' },
        { code: '215', name: 'Unity Bank' },
        { code: '035', name: 'Wema Bank' },
        { code: '057', name: 'Zenith Bank' }
      ];
      
      return res.status(200).json({
        success: true,
        banks: mockBanks,
        message: 'Banks retrieved successfully (Mock Data)'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `Failed to fetch banks: ${error.response.data.message}`,
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: "Bank service temporarily unavailable. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch banks",
      error: error.message,
    });
  }
};

// Verify bank account with Paystack (with caching and test mode)
const verifyBankAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;



    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: 'Account number and bank code are required'
      });
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Account number must be 10 digits'
      });
    }

    // Check cache first
    const cacheKey = `${accountNumber}-${bankCode}`;
    const cachedResult = verificationCache.get(cacheKey);
    
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    // Test mode handling
    const isTestMode = process.env.NODE_ENV === 'development' || process.env.PAYSTACK_SECRET_KEY?.includes('test');
    
    if (isTestMode) {
      
      // Check if it's a known test account
      const testAccount = TEST_ACCOUNTS.find(acc => 
        acc.accountNumber === accountNumber && acc.bankCode === bankCode
      );
      
      const result = {
        success: true,
        accountName: testAccount ? testAccount.accountName : 'TEST ACCOUNT NAME',
        message: 'Account verified successfully (Test Mode)'
      };
      
      // Cache the result for 5 minutes
      verificationCache.set(cacheKey, result);
      setTimeout(() => verificationCache.delete(cacheKey), 5 * 60 * 1000);
      
      return res.status(200).json(result);
    }

    // Production verification with Paystack
    const verificationResponse = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        timeout: 10000
      }
    );

    if (!verificationResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: `Account verification failed: ${verificationResponse.data.message}`
      });
    }

    const accountName = verificationResponse.data.data.account_name;
    const result = {
      success: true,
      accountName,
      message: 'Account verified successfully'
    };

    // Cache successful verification for 5 minutes
    verificationCache.set(cacheKey, result);
    setTimeout(() => verificationCache.delete(cacheKey), 5 * 60 * 1000);

    res.status(200).json(result);

  } catch (error) {
    console.error('Account verification error:', error);

    // Handle rate limits and use mock responses in test mode
    if (error.response?.status === 429) {
      const isTestMode = process.env.NODE_ENV === 'development' || process.env.PAYSTACK_SECRET_KEY?.includes('test');
      
      if (isTestMode) {
        const cacheKey = `${req.body.accountNumber}-${req.body.bankCode}`;
        const result = {
          success: true,
          accountName: 'TEST ACCOUNT NAME',
          message: 'Account verified successfully (Mock - Rate Limited)'
        };
        
        verificationCache.set(cacheKey, result);
        setTimeout(() => verificationCache.delete(cacheKey), 5 * 60 * 1000);
        
        return res.status(200).json(result);
      }
      
      return res.status(429).json({
        success: false,
        message: 'Bank verification service is busy. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to verify account',
      error: error.message
    });
  }
};

// Setup seller payment with Paystack (with test mode support)
const setupSellerPayment = async (req, res) => {
  try {
    const { bankCode, accountNumber, accountName, bankName } = req.body;
    const sellerId = req.user._id;

    // Validate required fields
    if (!bankCode || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: "Bank code, account number, and account name are required"
      });
    }

    // Validate account number format
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: "Account number must be exactly 10 digits"
      });
    }

    // Check if seller already has payment setup
    const existingSeller = await Seller.findById(sellerId);
    if (existingSeller?.isPaymentSetup) {
      return res.status(400).json({
        success: false,
        message: "Payment is already setup for this seller"
      });
    }

    const isTestMode = process.env.NODE_ENV === 'development' || process.env.PAYSTACK_SECRET_KEY?.includes('test');

    // In test mode, skip Paystack verification and create mock recipient
    if (isTestMode) {
      
      const updatedSeller = await Seller.findByIdAndUpdate(
        sellerId,
        {
          paystackRecipientCode: 'TEST_RECIPIENT_CODE',
          bankDetails: {
            bankCode,
            accountNumber: accountNumber,
            accountName: accountName,
            bankName: bankName || `Bank (${bankCode})`,
          },
          isPaymentSetup: true,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

      if (!updatedSeller) {
        return res.status(404).json({
          success: false,
          message: "Seller not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment details saved successfully (Test Mode)",
        seller: updatedSeller,
      });
    }

    // Production mode - verify with Paystack
    const verificationResponse = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        timeout: 10000,
      }
    );

    if (!verificationResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: `Account verification failed: ${verificationResponse.data.message}`
      });
    }

    const verifiedAccountName = verificationResponse.data.data.account_name;


    // Create transfer recipien
    const recipientResponse = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name: verifiedAccountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        timeout: 10000,
      }
    );



    if (!recipientResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: `Recipient creation failed: ${recipientResponse.data.message}`
      });
    }

    const recipientCode = recipientResponse.data.data.recipient_code;

    // Update seller with payment details
    const updatedSeller = await Seller.findByIdAndUpdate(
      sellerId,
      {
        paystackRecipientCode: recipientCode,
        bankDetails: {
          bankCode,
          accountNumber: accountNumber,
          accountName: verifiedAccountName,
          bankName: bankName || `Bank (${bankCode})`,
        },
        isPaymentSetup: true,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedSeller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment details saved successfully",
      seller: updatedSeller,
    });
  } catch (error) {
    console.error("Payment setup error:", error);

    // Handle specific error cases
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: "Payment service is currently busy. Please try again in a few minutes."
      });
    } else if (error.response) {
      const paystackError = error.response.data;
      return res.status(400).json({
        success: false,
        message: `Payment setup failed: ${paystackError.message || 'Invalid bank details'}`,
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: "Payment service temporarily unavailable. Please try again.",
      });
    } else if (error.code === "ECONNABORTED") {
      return res.status(408).json({
        success: false,
        message: "Payment service timeout. Please try again.",
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: "Failed to setup payment",
      error: error.message,
    });
  }
};

module.exports = {
  getSellerStats,
  getSellerOrders,
  getSellerOrderDetails,
  updateSellerProfile,
  getTopSellingProducts,
  setupSellerPayment,
  getBanks,
  verifyBankAccount,
};
