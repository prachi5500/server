import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  // IDs
  id: { type: String, required: true }, // Client side ID
  productId: { type: String }, // Optional linkage
  kind: { type: String, enum: ['classic', 'server'], required: true },
  
  // User Details (Name, Phone, etc.)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Pricing
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },

  // ✅ NEW: Image URLs (Ye missing thay, ab save honge)
  frontImageUrl: { type: String, default: "" },
  backImageUrl:  { type: String, default: "" },
  thumbnailUrl:  { type: String, default: "" },

  // Design Configuration (Positions, Sizes) - Aapke dump ke hisaab se
  frontData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  backData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Server Template Specifics
  serverMeta: {
    name: String,
    background_url: String,
    back_background_url: String,
    config: mongoose.Schema.Types.Mixed,
    qrColor: String,
    qrLogoUrl: String
  },

  // Styles
  selectedFont: { type: String, default: 'Arial, sans-serif' },
  fontSize: { type: Number, default: 16 },
  textColor: { type: String, default: '#000000' },
  accentColor: { type: String, default: '#0ea5e9' },

}, { _id: false }); // Item ka alag _id nahi chahiye agar zaroorat nahi hai

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  items: [cartItemSchema],
  status: { type: String, default: 'active' },
  lastActive: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export default mongoose.models.Cart || mongoose.model('Cart', cartSchema);