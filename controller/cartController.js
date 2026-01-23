const Cart = require("../models/cart");
const Product = require("../models/productModel");
const { v4: uuidv4 } = require("uuid");

const handleError = (res, error) => {
    console.error("Error details:", error);
    res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
};

const addToCart = async (req, res) => {
    try {
        let { productId, quantity = 1, sessionId } = req.body; // <-- use let
        const userId = req.user?._id || null;

        if (!productId || !quantity) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        if (quantity < 1) {
            return res.status(400).json({ message: "Quantity must be at least 1" });
        }

        const product = await Product.findById(productId).select("price stock");
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ message: "Insufficient stock available" });
        }

        let cart;
        if (userId) {
            cart = await Cart.findOne({ userId });
        } else {
            if (!sessionId) {
                sessionId = uuidv4(); // generate if guest has no sessionId
            }
            cart = await Cart.findOne({ sessionId });
        }

        if (!cart) {
            cart = new Cart({
                userId: userId || null,
                sessionId: userId ? null : sessionId,
                items: [{ productId, quantity, price: product.price }],
            });
        } else {
            const itemIndex = cart.items.findIndex(
                (item) => item.productId.toString() === productId
            );
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += quantity;
                if (cart.items[itemIndex].quantity > product.stock) {
                    return res
                        .status(400)
                        .json({ message: "Insufficient stock available" });
                }
            } else {
                cart.items.push({ productId, quantity, price: product.price });
            }
        }

        await cart.save();

        const populatedCart = await Cart.findById(cart._id).populate({
            path: "items.productId",
            select: "title images price category seller",
            populate: { path: "seller", select: "storeName" },
        });

        return res.status(200).json({
            message: "Product added to cart successfully",
            cart: populatedCart,
            sessionId: cart.sessionId, // always return so frontend can store
        });
    } catch (error) {
        handleError(res, error);
    }
};


const updateCart = async (req, res) => {
    try {
        const { productId, quantity, sessionId } = req.body;
        const userId = req.user?._id || null;
        if (!productId || !quantity) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        if (quantity < 1) {
            return res.status(400).json({ message: "Quantity must be at least 1" });
        }

        const product = await Product.findById(productId).select("price stock");
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ message: "Insufficient stock available" });
        }

        let cart;
        if (userId) {
            cart = await Cart.findOne({ userId });
        } else {
            if (!sessionId) {
                sessionId = uuidv4(); // generate if guest has no sessionId
            }
            cart = await Cart.findOne({ sessionId });
        }

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId
        );
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not in cart' });
        }

        cart.items[itemIndex].quantity = quantity;
        await cart.save();

        const populatedCart = await Cart.findById(cart._id).populate({
            path: 'items.productId',
            select: 'title images price category seller',
            populate: { path: 'seller', select: 'storeName' },
        });

        return res.status(200).json({
            message: 'Cart updated',
            cart: populatedCart,
        });

    } catch (error) {
        handleError(res, error);
    }
};


const deleteCartItem = async (req, res) => {
    try {
        const { productId } = req.params;
        const { sessionId } = req.query;
        const userId = req.user?._id || null;

        let cart;
        if (userId) {
            cart = await Cart.findOne({ userId });
        } else {
            if (!sessionId) {
                sessionId = uuidv4(); // generate if guest has no sessionId
            }
            cart = await Cart.findOne({ sessionId });
        }

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId
        );
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not in cart' });
        }

        cart.items.splice(itemIndex, 1);
        if (cart.items.length === 0) {
            await Cart.deleteOne({ _id: cart._id });
            return res.status(200).json({ message: 'Cart cleared' });
        }

        await cart.save();
        const populatedCart = await Cart.findById(cart._id).populate({
            path: 'items.productId',
            select: 'title images price category seller',
            populate: { path: 'seller', select: 'storeName' },
        });

        return res.status(200).json({
            message: 'Item removed from cart',
            cart: populatedCart,
        });
    } catch (error) {
        console.error('Delete cart item error:', error.message);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


const getCart = async (req, res) => {
    try {
        const { sessionId } = req.query;
        const userId = req.user?._id;

        let cart;
        if (userId) {
            cart = await Cart.findOne({ userId }).populate({
                path: 'items.productId',
                select: 'title images price category seller stock',
                populate: { path: 'seller', select: 'storeName' },
            });
        } else if (sessionId) {
            cart = await Cart.findOne({ sessionId }).populate({
                path: 'items.productId',
                select: 'title images price category seller stock',
                populate: { path: 'seller', select: 'storeName' },
            });
        } else {
            return res.status(400).json({ message: 'User ID or session ID required' });
        }

        if (!cart) {
            return res.status(200).json({ message: 'Cart is empty', cart: { items: [] } });
        }

        // Validate stock for each item
        for (const item of cart.items) {
            if (item.productId.stock < item.quantity) {
                item.quantity = item.productId.stock;
                if (item.quantity === 0) {
                    cart.items = cart.items.filter(
                        (i) => i.productId.toString() !== item.productId._id.toString()
                    );
                }
            }
        }

        if (cart.items.length === 0) {
            await Cart.deleteOne({ _id: cart._id });
            return res.status(200).json({ message: 'Cart is empty', cart: { items: [] } });
        }

        await cart.save();
        return res.status(200).json({ message: 'Cart retrieved', cart });
    } catch (error) {
        console.error('Get cart error:', error.message);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const syncCart = async (req, res) => {
    try {
        let { items, sessionId } = req.body;
        const userId = req.user?._id || null;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty items' });
        }

        let cart;
        if (userId) {
            cart = await Cart.findOne({ userId });
        } else {
            if (!sessionId) {
                sessionId = uuidv4();
            }
            cart = await Cart.findOne({ sessionId });
        }

        // Clear existing items
        if (cart) {
            cart.items = [];
        } else {
            cart = new Cart({
                userId: userId || null,
                sessionId: userId ? null : sessionId,
                items: [],
            });
        }

        let hasPriceChanges = false;
        // Add and validate each item
        for (const itemData of items) {
            const { productId, quantity, price: clientPrice } = itemData;
            const product = await Product.findById(productId).select('price stock title');
            if (!product) {
                return res.status(404).json({ message: `Product ${productId} not found` });
            }
            if (product.price !== clientPrice) {
                console.warn(`Price changed for ${product.title}: ${clientPrice} -> ${product.price}`);
                hasPriceChanges = true;
            }
            if (quantity < 1 || product.stock < quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.title}. Available: ${product.stock}`
                });
            }
            cart.items.push({ productId, quantity, price: product.price });
        }

        await cart.save();

        // Populate and validate stock
        const populatedCart = await Cart.findById(cart._id).populate({
            path: 'items.productId',
            select: 'title images price category seller stock',
            populate: { path: 'seller', select: 'storeName' },
        });

        if (!populatedCart) {
            return res.status(404).json({ message: 'Cart not found after save' });
        }

        // Adjust for stock changes
        let hasChanges = false;
        for (let i = 0; i < populatedCart.items.length; i++) {
            const item = populatedCart.items[i];
            if (item.productId.stock < item.quantity) {
                const oldQty = item.quantity;
                item.quantity = item.productId.stock;
                hasChanges = true;
                if (item.quantity === 0) {
                    populatedCart.items.splice(i, 1);
                    i--;
                }
                console.warn(`Adjusted ${item.productId.title}: ${oldQty} -> ${item.quantity}`);
            }
        }

        if (hasChanges) {
            await populatedCart.save();
        }

        if (populatedCart.items.length === 0) {
            await Cart.deleteOne({ _id: populatedCart._id });
            return res.status(200).json({
                message: 'Cart synced but now empty due to stock',
                cart: { items: [] },
                sessionId,
                hasPriceChanges
            });
        }

        const message = hasPriceChanges
            ? 'Cart synced with price updates'
            : 'Cart synced successfully';

        return res.status(200).json({
            message,
            cart: populatedCart,
            sessionId,
            hasPriceChanges
        });
    } catch (error) {
        handleError(res, error);
    }
};
module.exports = {
    addToCart,
    updateCart,
    deleteCartItem,
    getCart,
    syncCart
}