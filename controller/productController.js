const Product = require("../models/productModel");
const cloudinary = require("../middleware/cloudinary");

const handleError = (res, error) => {
    console.error("Error details:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
};

const postProduct = async (req, res) => {
    try {
        const { title, description, price, category, isFeatured } = req.body;
        if (!title || !description || !price || !category) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: "Price must be a non-negative number" });
        }

        let images = [];
        if (req.files && Array.isArray(req.files)) {
            const fileArray = req.files.slice(0, 5);
            for (const file of fileArray) {
                const uploadedImage = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: "image" },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result);
                        }
                    );
                    stream.end(file.buffer);
                });
                images.push(uploadedImage.secure_url);
            }
        }
        const product = await Product.create({
            title: title.trim(),
            description: description.trim(),
            price: parsedPrice,
            category: category.toLowerCase(),
            images: images,
            seller: req.user._id,
            isFeatured: Boolean(isFeatured),
        });

        return res.status(201).json({ message: "Product uploaded successfully", product });
    } catch (error) {
        handleError(res, error);
    }
};




// 1. Trending This Week (High views/sales in last 7 days)
const getTrendingThisWeek = async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trendingProducts = await Product.find({
            createdAt: { $gte: sevenDaysAgo },
            $or: [{ views: { $gte: 50 } }, { sales: { $gte: 10 } }],
        })
            .populate("seller", "storeName") // Adjust field based on Seller schema
            .sort({ views: -1, sales: -1 })
            .limit(10);
        return res.status(200).json(trendingProducts);
    } catch (error) {
        handleError(res, error);
    }
};

// 2. What's Hot This Week (High sales in last 7 days)
const getWhatsHotThisWeek = async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const hotProducts = await Product.find({
            createdAt: { $gte: sevenDaysAgo },
            sales: { $gte: 10 },
        })
            .populate("seller", "storeName")
            .sort({ sales: -1 })
            .limit(10);
        return res.status(200).json(hotProducts);
    } catch (error) {
        handleError(res, error);
    }
};

// 3. Featured Collections
const getFeaturedCollections = async (req, res) => {
    try {
        const featuredProducts = await Product.find({ isFeatured: true })
            .populate("seller", "storeName")
            .sort({ createdAt: -1 })
            .limit(10);
        return res.status(200).json(featuredProducts);
    } catch (error) {
        handleError(res, error);
    }
};

// 4. Shop by Category
const getShopByCategory = async (req, res) => {
    try {
        const { category } = req.query;
        if (!category) {
            return res.status(400).json({ message: "Category is required" });
        }
        const products = await Product.find({ category: category.toLowerCase() })
            .populate("seller", "storeName")
            .sort({ createdAt: -1 })
            .limit(20);

        return res.status(200).json(products);
    } catch (error) {
        handleError(res, error);
    }
};

// 5. Special Offers Just for You (Simplified to show recent products)
const getSpecialOffers = async (req, res) => {
    try {
        const userId = req.user?.id; // Assumes auth middleware
        if (!userId) {
            return res.status(401).json({ message: "User authentication required" });
        }
        const specialOffers = await Product.find({})
            .populate("seller", "storeName")
            .sort({ createdAt: -1 })
            .limit(10);
        return res.status(200).json(specialOffers);
    } catch (error) {
        handleError(res, error);
    }
};

// 6. Style Inspiration (Simplified to show featured or recent products)
const getStyleInspiration = async (req, res) => {
    try {
        const inspirationProducts = await Product.find({ isFeatured: true })
            .populate("seller", "storeName")
            .sort({ createdAt: -1 })
            .limit(10);
        return res.status(200).json(inspirationProducts);
    } catch (error) {
        handleError(res, error);
    }
};

// Updated getAllProduct
const getAllProduct = async (req, res) => {
    try {
        const { category } = req.query;
        const query = category ? { category: category.toLowerCase() } : {};
        const allProduct = await Product.find(query)
            .populate("seller", "storeName")
            .sort({ createdAt: -1 });
        return res.status(200).json(allProduct);
    } catch (error) {
        handleError(res, error);
    }
};

const getSellerProducts = async (req, res) => {
    try {
        const sellerId = req.user._id;
        const { category } = req.query;
        const query = { seller: sellerId };
        if (category) query.category = category.toLowerCase();

        const products = await Product.find(query)
            .populate('seller', 'name')
            .sort({ createdAt: -1 });

        return res.status(200).json(products);
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const { title, description, price, category, isFeatured } = req.body;
        const product = await Product.findOne({ _id: req.params.id, seller: req.user._id });
        if (!product) {
            return res.status(404).json({ message: 'Product not found or not owned by seller' });
        }

        // Validate required fields
        if (!title || !description || !price || !category) {
            return res.status(400).json({ message: 'Title, description, price, and category are required' });
        }
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: 'Price must be a non-negative number' });
        }

        // Update fields
        product.title = title.trim();
        product.description = description.trim();
        product.price = parsedPrice;
        product.category = category.toLowerCase();
        product.isFeatured = Boolean(isFeatured);

        await product.save();
        return res.status(200).json({ message: 'Product updated successfully', product });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};


const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, seller: req.user._id });
        if (!product) {
            return res.status(404).json({ message: 'Product not found or not owned by seller' });
        }
        await product.deleteOne();
        return res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};


const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id).populate('seller', 'storeName');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        return res.status(200).json({
            ...product._doc,
            category: product.category.toLowerCase() === 'clothes' ? 'clothing' : product.category.toLowerCase().replace(/ & /g, '-'),
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

module.exports = {
    postProduct,
    getAllProduct,
    getTrendingThisWeek,
    getWhatsHotThisWeek,
    getFeaturedCollections,
    getShopByCategory,
    getSpecialOffers,
    getStyleInspiration,
    getSellerProducts,
    updateProduct,
    deleteProduct,
    getProductById,
};
