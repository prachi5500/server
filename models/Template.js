import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  config: { type: Object, default: {} },
  background_url: { type: String, default: null },
  back_background_url: { type: String, default: null },
  thumbnail_url: { type: String, default: null },
  price: { type: Number, default: 2.99 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('Template', templateSchema);
