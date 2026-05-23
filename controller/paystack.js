
// const Order = require("../models/orderModel");
// const Product = require("../models/productModel");
// const Seller = require("../models/sellerModel");
// const Cart = require("../models/cart")
// const axios = require("axios"); 


// // 1. Initialize Transaction - USING AXIOS INSTEAD
// const initializeTransaction = async (orderTotal, email, orderId, origin) => {
//   try {

//     const amount = Math.round(orderTotal * 100); // Convert to kobo
//     if (amount < 100) {
//       throw new Error("Amount must be at least ₵1");
//     }

//     const payload = {
//       email: email.trim().toLowerCase(),
//       amount: amount,
//       reference: `order_${orderId}_${Date.now()}`,
//       callback_url: `${origin}/payment-verify?orderId=${orderId}`,
//       metadata: {
//         order_id: orderId.toString(),
//         custom_fields: [
//           {
//             display_name: "Order ID",
//             variable_name: "order_id",
//             value: orderId.toString(),
//           },
//         ],
//       },
//     };


//     const response = await axios.post(
//       "https://api.paystack.co/transaction/initialize",
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     if (!response.data.status) {
//       throw new Error(
//         response.data.message || "Paystack initialization failed"
//       );
//     }

//     return response.data;
//   } catch (error) {
//     console.error(
//       "Payment initialization error:",
//       error.response?.data || error.message
//     );
//     throw new Error(
//       error.response?.data?.message || "Failed to initialize payment"
//     );
//   }
// };

// const verifyTransaction = async (reference, orderId) => {
//   try {

//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${reference}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         },
//       }
//     );


//     if (!response.data.status || response.data.data.status !== "success") {
//       throw new Error(
//         "Payment verification failed: " +
//           (response.data.message || "Unknown error")
//       );
//     }

//     const order = await Order.findById(orderId);
//     if (!order) throw new Error("Order not found");
//     if (order.paystackReference !== reference)
//       throw new Error("Reference mismatch");

//     // Update to hold status
//     order.paymentStatus = "hold";
//     order.paymentConfirmedAt = new Date();
//     await order.save();

//     // Clear cart after successful payment verification
//     if (order.userId) {
//       await Cart.findOneAndDelete({ userId: order.userId });
//     } else if (order.sessionId) {
//       await Cart.findOneAndDelete({ sessionId: order.sessionId });
//     }

//     return order;
//   } catch (error) {
//     console.error("Verification error:", error.response?.data || error.message);
//     throw new Error(
//       error.response?.data?.message || "Payment verification failed"
//     );
//   }
// };


// const transferToSeller = async (order, sellerId, amount, orderId) => {
//   try {
//     // Get seller's payment details
//     const seller = await Seller.findById(sellerId);
//     if (!seller || !seller.paystackRecipientCode) {
//       throw new Error("Seller payment details not configured");
//     }

//     // Check if we're in test mode
//     const isTestMode = process.env.NODE_ENV === 'development' || 
//                        process.env.PAYSTACK_SECRET_KEY?.includes('test');

//     if (isTestMode) {
//       // Paystack test mode doesn't allow actual transfers
//       const mockTransferCode = `test_transfer_${orderId}_${sellerId}_${Date.now()}`;
      
//       return mockTransferCode;
//     }
//     const response = await axios.post(
//       "https://api.paystack.co/transfer",
//       {
//         source: "balance",
//         amount: Math.round(amount * 100), // Convert to kobo
//         recipient: seller.paystackRecipientCode,
//         reason: `Payment for order ${orderId}`,
//         reference: `transfer_${orderId}_${sellerId}_${Date.now()}`,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//         timeout: 30000, // 30 second timeout
//       }
//     );

//     if (!response.data.status) {
//       throw new Error("Transfer failed: " + response.data.message);
//     }
//     return response.data.data.transfer_code;
//   } catch (error) {
//     console.error("Transfer error:", error.response?.data || error.message);
    
//     // If it's a test mode limitation error, simulate success
//     if (error.response?.data?.message?.includes('Test mode')) {
//       return `test_transfer_${orderId}_${sellerId}_${Date.now()}`;
//     }
    
//     throw new Error(
//       error.response?.data?.message || "Failed to transfer to seller"
//     );
//   }
// };

// module.exports = {initializeTransaction, verifyTransaction, transferToSeller}


const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Seller = require("../models/sellerModel");
const Cart = require("../models/cart");
const axios = require("axios");

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";
const FLW_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// 1. Initialize Transaction
const initializeTransaction = async (orderTotal, email, orderId, origin) => {
  try {
    if (orderTotal < 1) {
      throw new Error("Amount must be at least GHS 1");
    }

    const payload = {
      tx_ref: `order_${orderId}_${Date.now()}`,
      amount: orderTotal,
      currency: "GHS",
      redirect_url: `${origin}/payment-verify?orderId=${orderId}`,
      customer: {
        email: email.trim().toLowerCase(),
      },
      meta: {
        order_id: orderId.toString(),
      },
      customizations: {
        title: "Order Payment",
      },
    };

    const response = await axios.post(
      `${FLUTTERWAVE_BASE_URL}/payments`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status !== "success") {
      throw new Error(
        response.data.message || "Flutterwave initialization failed"
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      "Payment initialization error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to initialize payment"
    );
  }
};

// 2. Verify Transaction
const verifyTransaction = async (transaction_id, orderId) => {
  try {
    const response = await axios.get(
      `${FLUTTERWAVE_BASE_URL}/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const flwData = response.data.data;

    if (
      response.data.status !== "success" ||
      flwData.status !== "successful" ||
      flwData.currency !== "GHS"
    ) {
      throw new Error("Payment verification failed: " + (response.data.message || "Unknown error"));
    }

    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    // Verify amount matches
    if (flwData.amount < order.totalAmount) {
      throw new Error("Amount mismatch: payment does not match order total");
    }

    // Update to hold status
    order.paymentStatus = "hold";
    order.paymentConfirmedAt = new Date();
    order.flutterwaveTransactionId = transaction_id;
    await order.save();

    // Clear cart after successful payment
    if (order.userId) {
      await Cart.findOneAndDelete({ userId: order.userId });
    } else if (order.sessionId) {
      await Cart.findOneAndDelete({ sessionId: order.sessionId });
    }

    return order;
  } catch (error) {
    console.error("Verification error:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || "Payment verification failed"
    );
  }
};

// 3. Transfer to Seller
const transferToSeller = async (order, sellerId, amount, orderId) => {
  try {
    const seller = await Seller.findById(sellerId);
    if (!seller || !seller.flutterwaveRecipientCode) {
      throw new Error("Seller payment details not configured");
    }

    const isTestMode =
      process.env.NODE_ENV === "development" ||
      FLW_SECRET_KEY?.includes("test");

    if (isTestMode) {
      const mockTransferCode = `test_transfer_${orderId}_${sellerId}_${Date.now()}`;
      return mockTransferCode;
    }

    const response = await axios.post(
      `${FLUTTERWAVE_BASE_URL}/transfers`,
      {
        account_bank: seller.bankCode,
        account_number: seller.accountNumber,
        amount: amount,
        currency: "GHS",
        reference: `transfer_${orderId}_${sellerId}_${Date.now()}`,
        narration: `Payment for order ${orderId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data.status !== "success") {
      throw new Error("Transfer failed: " + response.data.message);
    }

    return response.data.data.id;
  } catch (error) {
    console.error("Transfer error:", error.response?.data || error.message);

    if (error.response?.data?.message?.includes("test")) {
      return `test_transfer_${orderId}_${sellerId}_${Date.now()}`;
    }

    throw new Error(
      error.response?.data?.message || "Failed to transfer to seller"
    );
  }
};

module.exports = { initializeTransaction, verifyTransaction, transferToSeller };