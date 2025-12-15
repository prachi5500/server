import express from 'express';
import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// ✅ Get user's cart
router.get('/', authRequired, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id, status: 'active' })
      .populate('userId', 'email name phone')
      .lean();

    if (!cart) {
      // Create new cart if doesn't exist
      cart = await Cart.create({
        userId: req.user._id,
        items: [],
        status: 'active'
      });
    }

    res.json({
      success: true,
      data: cart,
      message: 'Cart fetched successfully'
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart'
    });
  }
});

// ✅ Add item to cart
router.post('/items', authRequired, async (req, res) => {
  try {
    const { item } = req.body;
    
    if (!item || !item.productId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item data'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: req.user._id, status: 'active' });

    if (!cart) {
      cart = new Cart({
        userId: req.user._id,
        items: [],
        status: 'active'
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      cartItem => cartItem.productId === item.productId
    );

    if (existingItemIndex > -1) {
      // Update existing item
      cart.items[existingItemIndex] = {
        ...cart.items[existingItemIndex].toObject(),
        ...item,
        quantity: (cart.items[existingItemIndex].quantity || 1) + (item.quantity || 1),
        updatedAt: new Date()
      };
    } else {
      // Add new item
      const cartItem = {
        ...item,
        quantity: item.quantity || 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      cart.items.push(cartItem);
    }

    // Save cart
    await cart.save();

    // Populate user data
    await cart.populate('userId', 'email name phone');

    res.status(200).json({
      success: true,
      data: cart,
      message: existingItemIndex > -1 ? 'Item updated in cart' : 'Item added to cart'
    });
  } catch (error) {
    console.error('Add item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart'
    });
  }
});

// ✅ Update item quantity
router.put('/items/:productId', authRequired, async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity'
      });
    }

    const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => item.productId === productId);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].updatedAt = new Date();

    await cart.save();
    await cart.populate('userId', 'email name phone');

    res.json({
      success: true,
      data: cart,
      message: 'Item quantity updated'
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update item quantity'
    });
  }
});

// ✅ Remove item from cart
router.delete('/items/:productId', authRequired, async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item.productId !== productId);

    if (cart.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    await cart.save();
    await cart.populate('userId', 'email name phone');

    res.json({
      success: true,
      data: cart,
      message: 'Item removed from cart'
    });
  } catch (error) {
    console.error('Remove item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart'
    });
  }
});

// ✅ Clear entire cart
router.delete('/', authRequired, async (req, res) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { userId: req.user._id, status: 'active' },
      { 
        $set: { 
          items: [],
          totalItems: 0,
          subTotal: 0,
          discount: 0,
          totalAmount: 0,
          lastActive: new Date()
        }
      },
      { new: true }
    ).populate('userId', 'email name phone');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    res.json({
      success: true,
      data: cart,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
});

// ✅ Update cart status (checkout, purchased, etc.)
router.put('/status', authRequired, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'checkout', 'purchased', 'abandoned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { 
        $set: { 
          status: status,
          lastActive: new Date()
        }
      },
      { new: true }
    ).populate('userId', 'email name phone');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    res.json({
      success: true,
      data: cart,
      message: `Cart status updated to ${status}`
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart status'
    });
  }
});

// ✅ Get cart summary
router.get('/summary', authRequired, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id, status: 'active' })
      .select('totalItems subTotal discount shipping totalAmount')
      .lean();

    if (!cart) {
      return res.json({
        success: true,
        data: {
          totalItems: 0,
          subTotal: 0,
          discount: 0,
          shipping: 0,
          totalAmount: 0
        }
      });
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Cart summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cart summary'
    });
  }
});

export default router;