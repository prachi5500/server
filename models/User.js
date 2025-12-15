import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  name: { type: String, required: true, 
    trim: true, },
  phone: { type: String,  required: true, 
    trim: true,},
  // For Forgot Password
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Number, default: null },
  // For OTP authentication
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
  isVerified: { type: Boolean, default: false }
 
}, { timestamps: true });

export default mongoose.model('User', userSchema);