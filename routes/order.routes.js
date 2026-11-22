const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticate, authorize, requireApproved } = require('../middleware/auth');

// Buyer: Place an order
router.post('/', authenticate, authorize('buyer', 'admin'), requireApproved, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid productId and positive quantity are required.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({
        message: `Insufficient stock. Only ${product.quantity} items available.`,
      });
    }

    const unitPrice = product.price;
    const discount = product.discount || 0;
    const effectiveUnitPrice = unitPrice * (1 - discount / 100);
    const totalPrice = Number((effectiveUnitPrice * quantity).toFixed(2));

    // Deduct stock from product
    product.quantity -= Number(quantity);
    await product.save();

    const order = await Order.create({
      buyer: req.user._id,
      seller: product.seller,
      product: product._id,
      quantity: Number(quantity),
      unitPrice,
      discount,
      totalPrice,
      status: 'pending',
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .populate('product', 'title price discount');

    res.status(201).json({
      message: 'Order placed successfully',
      order: populatedOrder,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error placing order' });
  }
});

// Buyer: Get my placed orders
router.get('/my-orders', authenticate, authorize('buyer', 'admin'), async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate('seller', 'name email')
      .populate('product', 'title price discount')
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching orders' });
  }
});

// Buyer: Cancel order
router.patch('/:id/cancel', authenticate, authorize('buyer', 'admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (req.user.role !== 'admin' && order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to cancel this order.' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: `Cannot cancel order with status '${order.status}'. Only pending orders can be cancelled.` });
    }

    // Restore inventory
    await Product.findByIdAndUpdate(order.product, {
      $inc: { quantity: order.quantity },
    });

    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error cancelling order' });
  }
});

// Seller: Get incoming orders for this seller's products
router.get('/seller-orders', authenticate, authorize('seller', 'admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { seller: req.user._id };
    const orders = await Order.find(filter)
      .populate('buyer', 'name email status')
      .populate('product', 'title price discount')
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching seller orders' });
  }
});

// Seller: Get financial metrics and earnings
router.get('/seller-earnings', authenticate, authorize('seller', 'admin'), async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Delivered / Completed Earnings
    const deliveredAgg = await Order.aggregate([
      { $match: { seller: sellerId, status: { $in: ['approved', 'completed'] } } },
      { $group: { _id: null, totalEarnings: { $sum: '$totalPrice' }, count: { $sum: 1 }, unitsSold: { $sum: '$quantity' } } },
    ]);

    // Upcoming / Pending Earnings
    const pendingAgg = await Order.aggregate([
      { $match: { seller: sellerId, status: 'pending' } },
      { $group: { _id: null, upcomingEarnings: { $sum: '$totalPrice' }, pendingCount: { $sum: 1 } } },
    ]);

    const deliveredEarnings = deliveredAgg[0]?.totalEarnings || 0;
    const deliveredOrders = deliveredAgg[0]?.count || 0;
    const unitsSold = deliveredAgg[0]?.unitsSold || 0;
    const upcomingEarnings = pendingAgg[0]?.upcomingEarnings || 0;
    const pendingOrdersCount = pendingAgg[0]?.pendingCount || 0;

    res.json({
      deliveredEarnings: Number(deliveredEarnings.toFixed(2)),
      upcomingPendingEarnings: Number(upcomingEarnings.toFixed(2)),
      totalCompletedOrders: deliveredOrders,
      pendingOrdersCount,
      totalUnitsSold: unitsSold,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching seller earnings' });
  }
});

// Seller: Update order status (approved, rejected, completed)
router.patch('/:id/seller-status', authenticate, authorize('seller', 'admin'), requireApproved, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Can be approved, rejected, or completed.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (req.user.role !== 'admin' && order.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to manage this order.' });
    }

    // If seller rejects order, refund inventory back to product
    if (status === 'rejected' && order.status !== 'rejected' && order.status !== 'cancelled') {
      await Product.findByIdAndUpdate(order.product, {
        $inc: { quantity: order.quantity },
      });
    }

    order.status = status;
    await order.save();

    res.json({ message: `Order marked as ${status}`, order });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating order status' });
  }
});

module.exports = router;
