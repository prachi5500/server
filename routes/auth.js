import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import crypto from "crypto";
import nodemailer from "nodemailer";

const otpStore = new Map();
const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,  
    pass: process.env.SMTP_PASS,
  },
});

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Password validation function
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long`;
  }
  if (!hasUpperCase) {
    return 'Password must contain at least 1 uppercase letter';
  }
  if (!hasLowerCase) {
    return 'Password must contain at least 1 lowercase letter';
  }
  if (!hasSpecialChar) {
    return 'Password must contain at least 1 special character';
  }
  
  return null; // Password is valid
};

// Send OTP to user's email
const sendOTP = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.CONTACT_FROM || 'noreply@example.com',
      to: email,
      subject: 'Your OTP for Login',
      html: `
        <h2>Your OTP for Login</h2>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Error sending OTP:', error);
    return false;
  }
};




router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const usersCount = await User.countDocuments();
    const role = usersCount === 0 ? 'admin' : 'user';
    const user = await User.create({ email, passwordHash, role });
    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Send OTP for signup
router.post('/send-signup-otp', async (req, res) => {
  try {
    const { email, name, phone  } = req.body;
    if (!email) return res.status(400).json({ error: 'All field is required' });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry


     // ✅ OTP store mein save karein with user details
    otpStore.set(email, {
      otp,
      otpExpiry,
      name,
      phone
    });
    // For new users, we'll store the OTP in a temporary user document
    await User.findOneAndUpdate(
      { email },
      { otp, otpExpiry },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send OTP to email
    const sent = await sendOTP(email, otp);
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error in send-signup-otp:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and complete signup
router.post('/verify-signup-otp', async (req, res) => {
  try {
    const { email, otp, password, name, phone } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP and password are required' });
    }

    // Find user with the email and matching OTP
    const user = await User.findOne({
      email,
      otp,
      otpExpiry: { $gt: Date.now() } // Check if OTP is not expired
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if this is the first user (admin)
    const usersCount = await User.countDocuments({ isVerified: true });
    const role = usersCount === 0 ? 'admin' : 'user';

    // Update user with password and mark as verified
    user.passwordHash = passwordHash;
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Error in verify-signup-otp:', error);
    res.status(500).json({ error: 'Failed to complete signup' });
  }
});

// Send OTP for login
router.post('/request-login-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP to email
    const sent = await sendOTP(email, otp);
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error in request-login-otp:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and login
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log('Verify OTP attempt:', { email, otp });
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find user with the email and matching OTP
    const user = await User.findOne({
      email,
      otp,
      otpExpiry: { $gt: Date.now() } // Check if OTP is not expired
    });

    console.log('User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('User OTP:', user.otp);
      console.log('User OTP Expiry:', user.otpExpiry);
      console.log('Current time:', Date.now());
      console.log('OTP expired?', Date.now() > user.otpExpiry);
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Clear OTP fields
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Error in verify-login-otp:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});


// FORGOT PASSWORD (Request Reset)
router.post("/request-reset", async (req, res) => {
  try {
    const { email } = req.body;
// ........
    // console.log("Finding user with token:", token);

    const user = await User.findOne({ email });
    if (!user) {
      // we don't reveal that user does not exist
      return res.json({ message: "If the account exists, reset email sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // const resetLink = http://localhost:8080/reset-password?token=${token};
    const resetLink = `http://localhost:8080/reset-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.CONTACT_FROM,
      to: email,
      subject: "Password Reset",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <br/><br/>
        <p>This link expires in 15 minutes.</p>
      `,
    });

    return res.json({ message: "Reset link sent to your email." });
  } catch (e) {
    console.error("RESET EMAIL FAILED:", e);
    return res.status(500).json({ error: "Could not send reset email" });
  }
});




// reset password route
router.post("/reset-password", async (req, res) => {
  try {
    // ........

console.log("REQ BODY FROM FRONTEND:", req.body);

const { token, password } = req.body;
console.log("TOKEN RECEIVED:", token);
console.log("PASSWORD RECEIVED:", password);

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }, // token still valid
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});




router.get('/me', authRequired, async (req, res) => {
  res.json({ user: { id: req.user._id, email: req.user.email, role: req.user.role ,
    name: req.user.name, 
      phone: req.user.phone, 
  } });
});




export default router;










// Update user profile
router.put('/update-profile', authRequired, async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ 
        error: 'Name and phone are required' 
      });
    }

    // ✅ Validate phone number
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        error: 'Please enter a valid 10-digit phone number' 
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error in update-profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});