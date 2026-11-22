const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

/**
 * Common tool declarations
 */
const whoAmITool = {
  name: 'whoAmI',
  description: 'Get profile information, account status, and role-specific details of the currently logged-in user.',
  parameters: {
    type: 'OBJECT',
    properties: {},
  },
};

/**
 * Admin Tools
 */
const adminToolDeclarations = [
  whoAmITool,
  {
    name: 'listUsers',
    description: 'Fetch and list platform users filtered by role or verification status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        role: { type: 'STRING', description: 'Filter by role: admin, seller, or buyer' },
        status: { type: 'STRING', description: 'Filter by status: pending, approved, rejected, or blocked' },
        limit: { type: 'NUMBER', description: 'Max number of users to return' },
      },
    },
  },
  {
    name: 'updateUserStatus',
    description: 'Approve, reject, block, or set pending status for a specific user by userId or email.',
    parameters: {
      type: 'OBJECT',
      properties: {
        userIdOrEmail: { type: 'STRING', description: 'The MongoDB _id or the email address of the user' },
        status: { type: 'STRING', description: 'Target status: approved, rejected, blocked, or pending' },
        reason: { type: 'STRING', description: 'Optional admin explanation for the status change' },
      },
      required: ['userIdOrEmail', 'status'],
    },
  },
  {
    name: 'listOrders',
    description: 'Retrieve platform orders filtered by status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'Filter by order status: pending, approved, rejected, cancelled, completed' },
        limit: { type: 'NUMBER', description: 'Max number of orders to return' },
      },
    },
  },
  {
    name: 'updateOrderStatus',
    description: 'Update the status of a specific order as Admin (e.g. approve, reject, or cancel).',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: { type: 'STRING', description: 'The MongoDB _id of the order' },
        status: { type: 'STRING', description: 'New status: approved, rejected, cancelled, or completed' },
      },
      required: ['orderId', 'status'],
    },
  },
  {
    name: 'getPlatformStats',
    description: 'Retrieve high-level marketplace analytics: user counts, pending approvals, order counts, and total sales.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'searchProducts',
    description: 'Search products in catalog by title, description, or seller keyword.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search keyword' },
      },
      required: ['query'],
    },
  },
];

/**
 * Seller Tools
 */
const sellerToolDeclarations = [
  whoAmITool,
  {
    name: 'getSellerEarnings',
    description: 'Get seller financial analytics including delivered earnings, upcoming/pending earnings, orders breakdown, and units sold.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'listMyProducts',
    description: "List all inventory products owned by this seller including stock, pricing, and active discounts.",
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'addProduct',
    description: 'Create and add a new product to seller inventory.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title or name of the product' },
        description: { type: 'STRING', description: 'Brief description of features' },
        quantity: { type: 'NUMBER', description: 'Initial stock quantity available' },
        price: { type: 'NUMBER', description: 'Unit selling price' },
        discount: { type: 'NUMBER', description: 'Discount percentage between 0 and 100' },
      },
      required: ['title', 'quantity', 'price'],
    },
  },
  {
    name: 'updateProduct',
    description: 'Update price, discount, quantity, or description of a seller product by product ID or Title.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productIdOrTitle: { type: 'STRING', description: 'Product ID or exact/partial product title' },
        quantity: { type: 'NUMBER', description: 'New quantity' },
        price: { type: 'NUMBER', description: 'New price' },
        discount: { type: 'NUMBER', description: 'New discount percentage' },
        description: { type: 'STRING', description: 'Updated description' },
      },
      required: ['productIdOrTitle'],
    },
  },
  {
    name: 'deleteProduct',
    description: 'Remove a product from seller inventory by product ID or title.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productIdOrTitle: { type: 'STRING', description: 'Product ID or product title' },
      },
      required: ['productIdOrTitle'],
    },
  },
  {
    name: 'listSellerOrders',
    description: "List incoming customer orders for this seller's products with optional status filter.",
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'Filter by status: pending, approved, rejected, completed' },
      },
    },
  },
  {
    name: 'updateSellerOrderStatus',
    description: 'Accept, decline, or mark delivered an incoming customer order.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: { type: 'STRING', description: 'The MongoDB order ID' },
        status: { type: 'STRING', description: 'Target status: approved, rejected, or completed' },
      },
      required: ['orderId', 'status'],
    },
  },
  {
    name: 'searchCatalog',
    description: 'Search marketplace products across other sellers to inspect competitors or pricing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search query' },
      },
      required: ['query'],
    },
  },
];

/**
 * Buyer Tools
 */
const buyerToolDeclarations = [
  whoAmITool,
  {
    name: 'browseProducts',
    description: 'Search, browse and discover verified marketplace products with prices, discounts, and available stock.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search keyword (leave empty to view catalog)' },
        maxPrice: { type: 'NUMBER', description: 'Max price budget filter' },
      },
    },
  },
  {
    name: 'buyProduct',
    description: 'Purchase a product from the marketplace. Checks stock, calculates discount, and reserves inventory.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productIdOrTitle: { type: 'STRING', description: 'Product ID or product title to buy' },
        quantity: { type: 'NUMBER', description: 'Quantity of items to purchase (default 1)' },
      },
      required: ['productIdOrTitle'],
    },
  },
  {
    name: 'listMyOrders',
    description: 'Retrieve order history placed by this buyer with item details, tracking status, and totals.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'Optional status filter: pending, approved, completed, cancelled' },
      },
    },
  },
  {
    name: 'cancelOrder',
    description: 'Cancel a pending order and refund inventory.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: { type: 'STRING', description: 'The order ID to cancel' },
      },
      required: ['orderId'],
    },
  },
];

/**
 * Tool Execution Engine
 */
const executeTool = async (name, args, currentUser) => {
  console.log(`[Nexus AI Tool Call] Role: ${currentUser.role} | Tool: '${name}' | Args:`, args);

  // Common: whoAmI
  if (name === 'whoAmI') {
    const baseInfo = {
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      status: currentUser.status,
      memberSince: currentUser.createdAt,
    };

    if (currentUser.role === 'seller') {
      const productCount = await Product.countDocuments({ seller: currentUser._id });
      const orderCount = await Order.countDocuments({ seller: currentUser._id });
      return { ...baseInfo, totalProducts: productCount, totalOrdersReceived: orderCount };
    }

    if (currentUser.role === 'buyer') {
      const orderCount = await Order.countDocuments({ buyer: currentUser._id });
      return { ...baseInfo, totalOrdersPlaced: orderCount };
    }

    if (currentUser.role === 'admin') {
      const totalUsers = await User.countDocuments();
      return { ...baseInfo, platformUsersTotal: totalUsers, privileges: 'Full System Admin' };
    }

    return baseInfo;
  }

  // ADMIN TOOLS
  if (currentUser.role === 'admin') {
    switch (name) {
      case 'listUsers': {
        const filter = {};
        if (args.role) filter.role = args.role.toLowerCase();
        if (args.status) filter.status = args.status.toLowerCase();
        const limit = Number(args.limit) || 15;
        const users = await User.find(filter).select('_id name email role status createdAt').sort({ createdAt: -1 }).limit(limit);
        return { count: users.length, users: users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status })) };
      }

      case 'updateUserStatus': {
        const { userIdOrEmail, status, reason } = args;
        const cleanStatus = status.toLowerCase();
        let user = null;
        if (userIdOrEmail.match(/^[0-9a-fA-F]{24}$/)) {
          user = await User.findById(userIdOrEmail);
        }
        if (!user) {
          user = await User.findOne({ email: userIdOrEmail.toLowerCase().trim() });
        }
        if (!user) return { error: `User '${userIdOrEmail}' not found.` };
        if (user.role === 'admin' && cleanStatus === 'blocked') return { error: 'Cannot block admin.' };

        const prev = user.status;
        user.status = cleanStatus;
        await user.save();
        return { success: true, message: `User '${user.name}' (${user.email}) status updated from '${prev}' to '${cleanStatus}'.`, user: { id: user._id, name: user.name, email: user.email, status: user.status }, reason: reason || 'Admin update' };
      }

      case 'listOrders': {
        const filter = {};
        if (args.status) filter.status = args.status.toLowerCase();
        const limit = Number(args.limit) || 15;
        const orders = await Order.find(filter).populate('buyer', 'name email').populate('seller', 'name email').populate('product', 'title price').sort({ createdAt: -1 }).limit(limit);
        return {
          count: orders.length,
          orders: orders.map((o) => ({
            orderId: o._id,
            product: o.product?.title || 'Unknown',
            buyer: o.buyer?.name,
            seller: o.seller?.name,
            quantity: o.quantity,
            totalPrice: o.totalPrice,
            status: o.status,
          })),
        };
      }

      case 'updateOrderStatus': {
        const { orderId, status } = args;
        const cleanStatus = status.toLowerCase();
        const order = await Order.findById(orderId);
        if (!order) return { error: `Order #${orderId} not found.` };

        if ((cleanStatus === 'rejected' || cleanStatus === 'cancelled') && !['rejected', 'cancelled'].includes(order.status)) {
          await Product.findByIdAndUpdate(order.product, { $inc: { quantity: order.quantity } });
        }
        const prev = order.status;
        order.status = cleanStatus;
        await order.save();
        return { success: true, message: `Order #${order._id} updated from '${prev}' to '${cleanStatus}'.` };
      }

      case 'getPlatformStats': {
        const totalUsers = await User.countDocuments();
        const pendingUsers = await User.countDocuments({ status: 'pending' });
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const salesAgg = await Order.aggregate([
          { $match: { status: { $in: ['approved', 'completed'] } } },
          { $group: { _id: null, total: { $sum: '$totalPrice' } } },
        ]);
        return { totalUsers, pendingUsers, totalProducts, totalOrders, platformSales: salesAgg[0]?.total || 0 };
      }

      case 'searchProducts': {
        const regex = new RegExp(args.query || '', 'i');
        const products = await Product.find({ $or: [{ title: regex }, { description: regex }] }).populate('seller', 'name email').limit(10);
        return { count: products.length, products: products.map((p) => ({ id: p._id, title: p.title, price: p.price, discount: p.discount, quantity: p.quantity, seller: p.seller?.name })) };
      }
    }
  }

  // SELLER TOOLS
  if (currentUser.role === 'seller') {
    switch (name) {
      case 'getSellerEarnings': {
        const sellerId = currentUser._id;
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

        return {
          deliveredEarnings: Number(deliveredEarnings.toFixed(2)),
          upcomingPendingEarnings: Number(upcomingEarnings.toFixed(2)),
          totalCompletedOrders: deliveredOrders,
          pendingOrdersCount,
          totalUnitsSold: unitsSold,
        };
      }

      case 'listMyProducts': {
        const products = await Product.find({ seller: currentUser._id }).sort({ createdAt: -1 });
        return {
          count: products.length,
          products: products.map((p) => ({
            id: p._id,
            title: p.title,
            description: p.description,
            quantity: p.quantity,
            price: p.price,
            discount: p.discount,
            effectivePrice: p.discount > 0 ? Number((p.price * (1 - p.discount / 100)).toFixed(2)) : p.price,
          })),
        };
      }

      case 'addProduct': {
        if (currentUser.status !== 'approved') {
          return { error: 'Your seller account is pending admin approval. You cannot add products yet.' };
        }
        const { title, description, quantity, price, discount } = args;
        const product = await Product.create({
          title: title.trim(),
          description: description || '',
          quantity: Number(quantity) || 0,
          price: Number(price) || 0,
          discount: discount ? Number(discount) : 0,
          seller: currentUser._id,
        });
        return {
          success: true,
          message: `Product '${product.title}' created successfully in your inventory!`,
          product: { id: product._id, title: product.title, price: product.price, discount: product.discount, quantity: product.quantity },
        };
      }

      case 'updateProduct': {
        const { productIdOrTitle, quantity, price, discount, description } = args;
        let product = null;
        if (productIdOrTitle.match(/^[0-9a-fA-F]{24}$/)) {
          product = await Product.findOne({ _id: productIdOrTitle, seller: currentUser._id });
        }
        if (!product) {
          product = await Product.findOne({ seller: currentUser._id, title: new RegExp(productIdOrTitle, 'i') });
        }
        if (!product) return { error: `Product '${productIdOrTitle}' not found in your inventory.` };

        if (quantity !== undefined) product.quantity = Number(quantity);
        if (price !== undefined) product.price = Number(price);
        if (discount !== undefined) product.discount = Number(discount);
        if (description !== undefined) product.description = description;
        await product.save();

        return { success: true, message: `Product '${product.title}' updated successfully.`, product };
      }

      case 'deleteProduct': {
        const { productIdOrTitle } = args;
        let product = null;
        if (productIdOrTitle.match(/^[0-9a-fA-F]{24}$/)) {
          product = await Product.findOne({ _id: productIdOrTitle, seller: currentUser._id });
        }
        if (!product) {
          product = await Product.findOne({ seller: currentUser._id, title: new RegExp(productIdOrTitle, 'i') });
        }
        if (!product) return { error: `Product '${productIdOrTitle}' not found in your inventory.` };

        await Product.findByIdAndDelete(product._id);
        return { success: true, message: `Product '${product.title}' removed from your inventory.` };
      }

      case 'listSellerOrders': {
        const filter = { seller: currentUser._id };
        if (args.status) filter.status = args.status.toLowerCase();
        const orders = await Order.find(filter).populate('buyer', 'name email').populate('product', 'title price discount').sort({ createdAt: -1 });
        return {
          count: orders.length,
          orders: orders.map((o) => ({
            orderId: o._id,
            product: o.product?.title || 'Unknown',
            buyer: o.buyer?.name,
            quantity: o.quantity,
            totalPrice: o.totalPrice,
            status: o.status,
            date: o.createdAt,
          })),
        };
      }

      case 'updateSellerOrderStatus': {
        const { orderId, status } = args;
        const cleanStatus = status.toLowerCase();
        const order = await Order.findOne({ _id: orderId, seller: currentUser._id });
        if (!order) return { error: `Order #${orderId} not found under your products.` };

        if (cleanStatus === 'rejected' && order.status !== 'rejected') {
          await Product.findByIdAndUpdate(order.product, { $inc: { quantity: order.quantity } });
        }
        const prev = order.status;
        order.status = cleanStatus;
        await order.save();
        return { success: true, message: `Order #${order._id} status changed from '${prev}' to '${cleanStatus}'.` };
      }

      case 'searchCatalog': {
        const regex = new RegExp(args.query || '', 'i');
        const products = await Product.find({ $or: [{ title: regex }, { description: regex }] }).populate('seller', 'name').limit(10);
        return { count: products.length, products: products.map((p) => ({ id: p._id, title: p.title, price: p.price, discount: p.discount, quantity: p.quantity, seller: p.seller?.name })) };
      }
    }
  }

  // BUYER TOOLS
  if (currentUser.role === 'buyer') {
    switch (name) {
      case 'browseProducts': {
        const filter = { quantity: { $gt: 0 } };
        if (args.query) {
          const r = new RegExp(args.query, 'i');
          filter.$or = [{ title: r }, { description: r }];
        }
        if (args.maxPrice) {
          filter.price = { $lte: Number(args.maxPrice) };
        }
        const products = await Product.find(filter).populate('seller', 'name').sort({ createdAt: -1 }).limit(10);
        return {
          count: products.length,
          products: products.map((p) => ({
            id: p._id,
            title: p.title,
            description: p.description,
            price: p.price,
            discount: p.discount,
            finalPrice: p.discount > 0 ? Number((p.price * (1 - p.discount / 100)).toFixed(2)) : p.price,
            quantityInStock: p.quantity,
            seller: p.seller?.name || 'Verified Seller',
          })),
        };
      }

      case 'buyProduct': {
        if (currentUser.status !== 'approved') {
          return { error: 'Your buyer account is pending admin approval. You cannot place orders yet.' };
        }
        const { productIdOrTitle, quantity = 1 } = args;
        const qty = Math.max(1, Number(quantity) || 1);

        let product = null;
        if (productIdOrTitle.match(/^[0-9a-fA-F]{24}$/)) {
          product = await Product.findById(productIdOrTitle);
        }
        if (!product) {
          product = await Product.findOne({ title: new RegExp(productIdOrTitle, 'i') });
        }

        if (!product) return { error: `Product '${productIdOrTitle}' not found in marketplace.` };
        if (product.quantity < qty) return { error: `Insufficient stock for '${product.title}'. Only ${product.quantity} items available.` };

        const unitPrice = product.price;
        const discount = product.discount || 0;
        const effectiveUnit = unitPrice * (1 - discount / 100);
        const totalPrice = Number((effectiveUnit * qty).toFixed(2));

        // Deduct inventory
        product.quantity -= qty;
        await product.save();

        const order = await Order.create({
          buyer: currentUser._id,
          seller: product.seller,
          product: product._id,
          quantity: qty,
          unitPrice,
          discount,
          totalPrice,
          status: 'pending',
        });

        return {
          success: true,
          message: `Order #${order._id.toString().slice(-6)} placed successfully for ${qty} unit(s) of '${product.title}'! Total: $${totalPrice.toFixed(2)}.`,
          orderId: order._id,
          product: product.title,
          quantity: qty,
          totalPrice,
          status: 'pending',
        };
      }

      case 'listMyOrders': {
        const filter = { buyer: currentUser._id };
        if (args.status) filter.status = args.status.toLowerCase();
        const orders = await Order.find(filter).populate('seller', 'name email').populate('product', 'title price discount').sort({ createdAt: -1 });
        return {
          count: orders.length,
          orders: orders.map((o) => ({
            orderId: o._id,
            product: o.product?.title || 'Unknown Product',
            seller: o.seller?.name,
            quantity: o.quantity,
            totalPrice: o.totalPrice,
            status: o.status,
            orderedAt: o.createdAt,
          })),
        };
      }

      case 'cancelOrder': {
        const { orderId } = args;
        const order = await Order.findOne({ _id: orderId, buyer: currentUser._id });
        if (!order) return { error: `Order #${orderId} was not found.` };
        if (order.status !== 'pending') return { error: `Order status is '${order.status}'. Only pending orders can be cancelled.` };

        await Product.findByIdAndUpdate(order.product, { $inc: { quantity: order.quantity } });
        order.status = 'cancelled';
        await order.save();
        return { success: true, message: `Order #${order._id} cancelled successfully and stock refunded.` };
      }
    }
  }

  return { error: `Tool '${name}' is not recognized or not permitted for role '${currentUser.role}'.` };
};

/**
 * Get declarations appropriate for user's role
 */
const getToolsForRole = (role) => {
  if (role === 'admin') return adminToolDeclarations;
  if (role === 'seller') return sellerToolDeclarations;
  if (role === 'buyer') return buyerToolDeclarations;
  return [whoAmITool];
};

/**
 * Main Chat Runner with Multi-Turn Gemini Tool Calling Loop
 */
const runMarketplaceChat = async ({ message, history = [], currentUser }) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const toolExecutionsLog = [];
  const role = currentUser.role;
  const tools = getToolsForRole(role);

  // System instruction tailored for role and formatting
  const systemInstruction = `You are **Nexus AI**, the intelligent Copilot for this e-commerce marketplace platform.
Current User Profile:
- Name: ${currentUser.name}
- Email: ${currentUser.email}
- Role: ${currentUser.role}
- Status: ${currentUser.status}

RULES:
1. Always communicate politely, clearly, and concisely in well-structured English.
2. When presenting lists, metrics, inventory products, or orders, FORMAT THEM AS CLEAN MARKDOWN TABLES or bullet points with bold headers.
3. NEVER output raw JSON in your final answer. Tool execution outputs are already saved and visualized in the system interface.
4. If the user asks "who am i", "tell me about myself", or similar, ALWAYS call the 'whoAmI' tool and present a warm profile breakdown.
5. If the user wants to buy, cancel, add products, update status, or inspect earnings/users/orders, invoke the appropriate tool immediately.
6. If a tool reports an error or restriction (such as unapproved account), explain it gracefully to the user.`;

  // Fallback simulator if Gemini key is missing or invalid
  const executeInferredToolLocally = async (text) => {
    const lower = text.toLowerCase();
    let localResult = null;
    let toolName = '';
    let toolArgs = {};

    if (lower.includes('who am i') || lower.includes('about me') || lower.includes('my profile') || lower.includes('my details')) {
      toolName = 'whoAmI';
      localResult = await executeTool('whoAmI', {}, currentUser);
    } else if (role === 'seller' && (lower.includes('earning') || lower.includes('revenue') || lower.includes('sales'))) {
      toolName = 'getSellerEarnings';
      localResult = await executeTool('getSellerEarnings', {}, currentUser);
    } else if (role === 'seller' && (lower.includes('my product') || lower.includes('my inventory'))) {
      toolName = 'listMyProducts';
      localResult = await executeTool('listMyProducts', {}, currentUser);
    } else if (role === 'buyer' && (lower.includes('buy') || lower.includes('purchase') || lower.includes('order 1') || lower.includes('order 2'))) {
      const match = text.match(/buy\s+(\d+)?\s*(unit|units|piece|pieces)?\s*(of)?\s*(.+)/i);
      const qty = match && match[1] ? Number(match[1]) : 1;
      const target = match && match[4] ? match[4].trim() : text.replace(/buy/i, '').trim();
      toolName = 'buyProduct';
      toolArgs = { productIdOrTitle: target, quantity: qty };
      localResult = await executeTool(toolName, toolArgs, currentUser);
    } else if (role === 'buyer' && (lower.includes('order') || lower.includes('history'))) {
      toolName = 'listMyOrders';
      localResult = await executeTool('listMyOrders', {}, currentUser);
    } else if (role === 'buyer' && (lower.includes('browse') || lower.includes('product') || lower.includes('catalog') || lower.includes('search'))) {
      toolName = 'browseProducts';
      localResult = await executeTool('browseProducts', {}, currentUser);
    } else if (role === 'admin' && (lower.includes('stat') || lower.includes('metric') || lower.includes('overview'))) {
      toolName = 'getPlatformStats';
      localResult = await executeTool('getPlatformStats', {}, currentUser);
    } else if (role === 'admin' && (lower.includes('user') || lower.includes('pending'))) {
      toolName = 'listUsers';
      localResult = await executeTool('listUsers', { status: lower.includes('pending') ? 'pending' : undefined }, currentUser);
    } else if (role === 'admin' && lower.includes('order')) {
      toolName = 'listOrders';
      localResult = await executeTool('listOrders', {}, currentUser);
    }

    if (toolName && localResult) {
      toolExecutionsLog.push({ tool: toolName, input: toolArgs, output: localResult });
      return { toolName, localResult };
    }
    return null;
  };

  // Run with Gemini Generative AI
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // gemini-flash-lite-latest or gemini-3.5-flash
      const model = genAI.getGenerativeModel({
        model: 'gemini-flash-lite-latest',
        systemInstruction,
        tools: [{ functionDeclarations: tools }],
      });

      // Prepare conversation history
      const formattedHistory = history.slice(-8).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));

      const contents = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] },
      ];

      // Turn 1
      let res = await model.generateContent({ contents });
      let candidate = res.response.candidates?.[0];

      // Multi-turn tool execution loop
      let turns = 0;
      while (candidate?.content?.parts?.some((p) => p.functionCall) && turns < 5) {
        turns++;
        const modelContent = candidate.content;
        contents.push(modelContent);

        const functionCalls = modelContent.parts.filter((p) => p.functionCall).map((p) => p.functionCall);

        for (const call of functionCalls) {
          const { name, args } = call;
          const result = await executeTool(name, args, currentUser);

          toolExecutionsLog.push({
            tool: name,
            input: args,
            output: result,
          });

          // Send tool output back as role: 'user' with functionResponse part (compatible with Gemini API)
          contents.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name,
                response: { result },
              },
            }],
          });
        }

        res = await model.generateContent({ contents });
        candidate = res.response.candidates?.[0];
      }

      const reply = res.response.text();
      return {
        reply,
        toolExecutions: toolExecutionsLog,
        hasApiKey: true,
      };
    } catch (error) {
      console.warn('[Nexus AI] Gemini API call issue, executing fallback:', error.message);
      const executed = await executeInferredToolLocally(message);
      if (executed) {
        // Return structured markdown
        let textReply = `I executed the **${executed.toolName}** tool for you.\n\n`;
        if (executed.toolName === 'whoAmI') {
          const u = executed.localResult;
          textReply += `### Your Profile\n- **Name**: ${u.name}\n- **Email**: ${u.email}\n- **Role**: ${u.role}\n- **Status**: ${u.status}\n`;
        } else if (executed.toolName === 'getSellerEarnings') {
          const e = executed.localResult;
          textReply += `### Seller Financial Overview\n| Metric | Value |\n| :--- | :--- |\n| **Delivered / Completed Earnings** | $${e.deliveredEarnings} |\n| **Upcoming / Pending Earnings** | $${e.upcomingPendingEarnings} |\n| **Completed Orders** | ${e.totalCompletedOrders} |\n| **Pending Orders** | ${e.pendingOrdersCount} |\n| **Total Units Sold** | ${e.totalUnitsSold} |\n`;
        } else {
          textReply += `Action executed successfully. Expand the **Executed Tools** card below to inspect the details.`;
        }

        return {
          reply: textReply,
          toolExecutions: toolExecutionsLog,
          hasApiKey: true,
        };
      }

      return {
        reply: `Nexus AI encountered an issue connecting to Gemini: ${error.message}. Please check your connection or retry.`,
        toolExecutions: toolExecutionsLog,
        error: error.message,
        hasApiKey: true,
      };
    }
  }

  // Fallback if no API key
  const executed = await executeInferredToolLocally(message);
  if (executed) {
    return {
      reply: `Executed **${executed.toolName}** successfully. Expand Executed Tools below for raw data.`,
      toolExecutions: toolExecutionsLog,
      hasApiKey: false,
    };
  }

  return {
    reply: `I am **Nexus AI**, your intelligent marketplace copilot. Ask me questions about your profile, products, orders, or earnings!`,
    toolExecutions: [],
    hasApiKey: false,
  };
};

module.exports = {
  runMarketplaceChat,
  executeTool,
};
