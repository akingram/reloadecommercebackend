const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
    storeName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    categories: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    profileImage: {
        type: String,
        default: null
    },
    description: {
        type: String,
        default: ''
    },
    // Payment fields
    paystackRecipientCode: {
        type: String,
        default: null
    },
    bankDetails: {
        bankCode: String,
        accountNumber: String, // This will store the masked version
        accountName: String,
        bankName: String
    },
    isPaymentSetup: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Seller', sellerSchema);