import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    amount: { type: Number, required: false },
    currency: { type: String, default: 'INR' },
    razorpay_order_id: { type: String, required: true },
    razorpay_payment_id: { type: String, required: true },

    // Extra details
    status: { type: String, default: 'success' }, // success, failed, etc.

    customer_name: { type: String, default: null },
    customer_phone: { type: String, default: null },
    live_location: { type: String, default: null },

    address_line1: { type: String, default: null },
    address_line2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    pincode: { type: String, default: null },

    payment_type: { type: String, default: null }, // UPI, Card, Netbanking, Wallet
    payment_method: { type: String, default: null }, // gateway "method" raw value

    bank_reference_id: { type: String, default: null }, // bank ref / UPI txn id
    card_last4: { type: String, default: null },
    issuer_bank: { type: String, default: null },

    // Yahan pe har order me kaun-kaun se cards kharide gaye woh save hoga
    items: [
      {
        templateId: { type: String, required: true },
        title: { type: String, default: null },
        price: { type: Number, default: null },
        templateName: { type: String, default: null },

        // 👇 naya: user-edited card images
        frontImageUrl: { type: String, default: null },
        backImageUrl: { type: String, default: null },
        // optional generated PDF containing front+back
        pdfUrl: { type: String, default: null },
      },
    ],

    payment_method_details: { type: Object, default: null }, // raw details from gateway
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);