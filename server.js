const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

const path = require('path');

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/ai', require('./routes/ai.routes'));

// Serve frontend build if exists
app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'), (err) => {
    if (err) next();
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Multi-Role Marketplace API',
  });
});

// Seed Initial Data if database is fresh
const seedInitialData = async () => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      console.log('Seeding default admin user...');
      const admin = await User.create({
        name: 'Platform Admin',
        email: 'admin@marketplace.com',
        password: 'adminpassword123',
        role: 'admin',
        status: 'approved',
      });
      console.log(`Default Admin created: ${admin.email} (Password: adminpassword123)`);

      // Seed a seller
      const seller = await User.create({
        name: 'Apex Electronics',
        email: 'seller@apex.com',
        password: 'sellerpassword123',
        role: 'seller',
        status: 'approved',
      });

      // Seed a pending seller
      await User.create({
        name: 'Fresh Grocers Inc',
        email: 'seller@freshgrocers.com',
        password: 'password123',
        role: 'seller',
        status: 'pending',
      });

      // Seed a buyer
      const buyer = await User.create({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'buyerpassword123',
        role: 'buyer',
        status: 'approved',
      });

      // Seed a pending buyer
      await User.create({
        name: 'Bob Smith',
        email: 'bob@example.com',
        password: 'password123',
        role: 'buyer',
        status: 'pending',
      });

      // Seed sample products
      const p1 = await Product.create({
        title: 'Noise Cancelling Wireless Headphones',
        description: 'Premium active noise-cancelling over-ear headphones with 40-hour battery life.',
        quantity: 25,
        price: 199.99,
        discount: 15,
        seller: seller._id,
      });

      const p2 = await Product.create({
        title: 'Ergonomic Mechanical Keyboard',
        description: 'Hot-swappable RGB mechanical keyboard with tactile switches.',
        quantity: 40,
        price: 129.5,
        discount: 10,
        seller: seller._id,
      });

      const p3 = await Product.create({
        title: '4K Ultra-Wide Curved Monitor 34"',
        description: '144Hz HDR gaming and productivity curved monitor with USB-C hub.',
        quantity: 12,
        price: 499.0,
        discount: 20,
        seller: seller._id,
      });

      // Seed a sample order
      await Order.create({
        buyer: buyer._id,
        seller: seller._id,
        product: p1._id,
        quantity: 1,
        unitPrice: p1.price,
        discount: p1.discount,
        totalPrice: Number((p1.price * (1 - p1.discount / 100)).toFixed(2)),
        status: 'pending',
      });

      console.log('Sample seed data created successfully.');
    }
  } catch (error) {
    console.error('Error during data seeding:', error.message);
  }
};

const PORT = process.env.PORT || 5001;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedInitialData();
});
