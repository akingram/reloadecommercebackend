const User = require("../models/userModel");
const Seller = require("../models/sellerModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


const signUp = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hashSync(password, 10);
    const userData = await User.create({
      username,
      email,
      password: hashedPassword,
    });
    return res.status(201).json({
      message: "User created successfully",
      userData,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};


const signupSeller = async (req, res) => {
  try {
    const { storeName, email, phoneNumber, address, categories, password } =
      req.body;
    if (
      !storeName ||
      !email ||
      !phoneNumber ||
      !categories ||
      !password ||
      !address
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingUser = await Seller.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Seller already exists" });
    }
    const hashedPassword = await bcrypt.hashSync(password, 10);
    const userData = await Seller.create({
      storeName,
      email,
      password: hashedPassword,
      phoneNumber,
      categories,
      address,
    });
    return res.status(201).json({
      message: "Seller created successfully",
      userData,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// User Login
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: "user" },
      process.env.JWT_SECRET || process.env.JWT,
      { expiresIn: "1h" }
    );
    res.status(200).json({
      data: {
        username: user.username,
        email: user.email,
        _id: user._id
      },
      token,
      message: "Login successful",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const loginSeller = async (req, res) => {
  const { email, password } = req.body;
  try {
    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(400).json({ message: "Seller not found" });
    }

    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: seller._id, role: "seller" },
      process.env.JWT_SECRET || process.env.JWT,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      data: {
        storeName: seller.storeName,
        email: seller.email,
        phoneNumber: seller.phoneNumber,
        categories: seller.categories,
        address: seller.address,
        _id: seller._id
      },
      token,
      message: `Welcome ${seller.storeName}`,
    });

  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Logout (clears cookie)
const logout = (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(200).json({ message: "Logged out successfully" });
};


module.exports = {
  signUp,
  login,
  signupSeller,
  loginSeller,
};
