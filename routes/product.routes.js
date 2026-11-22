const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticate, authorize, requireApproved } = require('../middleware/auth');

// Public / Buyer: Search and browse products
router.get('/', async (req, res) => {
  try {
    const { search, minPrice, maxPrice, inStockOnly } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (inStockOnly === 'true') {
      filter.quantity = { $gt: 0 };
    }

    const products = await Product.find(filter)
      .populate('seller', 'name email status')
      .sort({ createdAt: -1 });

    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching products' });
  }
});

// Seller: Get all products created by the authenticated seller
router.get('/seller/mine', authenticate, authorize('seller', 'admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { seller: req.user._id };
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching seller products' });
  }
});

// Seller: Create single product
router.post('/', authenticate, authorize('seller', 'admin'), requireApproved, async (req, res) => {
  try {
    const { title, description, quantity, price, discount } = req.body;

    if (!title || quantity === undefined || price === undefined) {
      return res.status(400).json({ message: 'Title, quantity, and price are required.' });
    }

    const product = await Product.create({
      title,
      description: description || '',
      quantity: Number(quantity),
      price: Number(price),
      discount: discount ? Number(discount) : 0,
      seller: req.user._id,
    });

    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating product' });
  }
});

// Seller: Bulk create products
router.post('/bulk', authenticate, authorize('seller', 'admin'), requireApproved, async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array must be provided with at least one product.' });
    }

    const formattedItems = items.map((item) => ({
      title: item.title,
      description: item.description || '',
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
      discount: Number(item.discount) || 0,
      seller: req.user._id,
    }));

    // Validate entries
    for (const item of formattedItems) {
      if (!item.title || item.quantity < 0 || item.price < 0) {
        return res.status(400).json({ message: 'Each item must have a valid title, positive quantity and price.' });
      }
    }

    const createdProducts = await Product.insertMany(formattedItems);
    res.status(201).json({
      message: `Successfully created ${createdProducts.length} products in bulk`,
      products: createdProducts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating bulk products' });
  }
});

// Seller: Update product
router.put('/:id', authenticate, authorize('seller', 'admin'), requireApproved, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to modify this product.' });
    }

    const { title, description, quantity, price, discount } = req.body;
    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (quantity !== undefined) product.quantity = Number(quantity);
    if (price !== undefined) product.price = Number(price);
    if (discount !== undefined) product.discount = Number(discount);

    await product.save();
    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating product' });
  }
});

// Seller: Delete product
router.delete('/:id', authenticate, authorize('seller', 'admin'), requireApproved, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (req.user.role !== 'admin' && product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to delete this product.' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting product' });
  }
});

module.exports = router;
