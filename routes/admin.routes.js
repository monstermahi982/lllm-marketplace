const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticate, authorize } = require('../middleware/auth');

// Apply admin guard to all routes in this router
router.use(authenticate, authorize('admin'));

// List all users
router.get('/users', async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching users' });
  }
});

// Update user verification status (approved, rejected, blocked, pending)
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected', 'blocked'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.role === 'admin' && status === 'blocked') {
      return res.status(400).json({ message: 'Cannot block an admin user.' });
    }

    user.status = status;
    await user.save();

    res.json({ message: `User status updated to ${status}`, user });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating user status' });
  }
});

// List all orders on platform
router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('buyer', 'name email status')
      .populate('seller', 'name email status')
      .populate('product', 'title price discount quantity')
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching orders' });
  }
});

// Update order status as Admin
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid order status.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // If order is rejected or cancelled and wasn't before, refund product inventory
    if ((status === 'rejected' || status === 'cancelled') && !['rejected', 'cancelled'].includes(order.status)) {
      await Product.findByIdAndUpdate(order.product, {
        $inc: { quantity: order.quantity },
      });
    }

    order.status = status;
    await order.save();

    res.json({ message: `Order status updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating order status' });
  }
});

// Platform Statistics
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ['approved', 'completed'] } } },
      { $group: { _id: null, totalSales: { $sum: '$totalPrice' } } },
    ]);

    const totalSales = revenueResult[0]?.totalSales || 0;

    res.json({
      stats: {
        totalUsers,
        pendingUsers,
        totalProducts,
        totalOrders,
        totalSales,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching platform statistics' });
  }
});

module.exports = router;
