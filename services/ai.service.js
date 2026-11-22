const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { tool } = require('@langchain/core/tools');
const { HumanMessage, AIMessage, ToolMessage, SystemMessage } = require('@langchain/core/messages');
const { z } = require('zod');

const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

/**
 * Identify write operations that require explicit user confirmation
 */
const WRITE_TOOLS = [
  'updateUserStatus',
  'updateOrderStatus',
  'updateSellerOrderStatus',
  'addProduct',
  'updateProduct',
  'deleteProduct',
  'buyProduct',
  'cancelOrder',
];

/**
 * Execute actual database write operations once confirmed by the user
 */
const executeConfirmedWriteAction = async ({ tool: toolName, args, currentUser }) => {
  console.log(`[LangChain HITL] Executing CONFIRMED write operation: '${toolName}'`, args);

  switch (toolName) {
    case 'updateUserStatus': {
      const { userIdOrEmail, status, reason } = args;
      const cleanStatus = status.toLowerCase();
      let targetUser = null;
      if (userIdOrEmail.match(/^[0-9a-fA-F]{24}$/)) {
        targetUser = await User.findById(userIdOrEmail);
      }
      if (!targetUser) {
        targetUser = await User.findOne({ email: userIdOrEmail.toLowerCase().trim() });
      }
      if (!targetUser) return { error: `User '${userIdOrEmail}' was not found.` };
      if (targetUser.role === 'admin' && cleanStatus === 'blocked') {
        return { error: 'Security constraint: Admin users cannot be blocked.' };
      }

      const prev = targetUser.status;
      targetUser.status = cleanStatus;
      await targetUser.save();

      return {
        success: true,
        message: `User '${targetUser.name}' (${targetUser.email}) status has been updated from '${prev}' to '${cleanStatus}'.`,
        user: { id: targetUser._id, name: targetUser.name, email: targetUser.email, status: targetUser.status },
        reason: reason || 'Admin confirmed update',
      };
    }

    case 'updateOrderStatus': {
      const { orderId, status } = args;
      const cleanStatus = status.toLowerCase();
      const order = await Order.findById(orderId);
      if (!order) return { error: `Order #${orderId} was not found.` };

      if ((cleanStatus === 'rejected' || cleanStatus === 'cancelled') && !['rejected', 'cancelled'].includes(order.status)) {
        await Product.findByIdAndUpdate(order.product, { $inc: { quantity: order.quantity } });
      }
      const prev = order.status;
      order.status = cleanStatus;
      await order.save();
      return { success: true, message: `Order #${order._id} status updated from '${prev}' to '${cleanStatus}'.` };
    }

    case 'updateSellerOrderStatus': {
      const { orderId, status } = args;
      const cleanStatus = status.toLowerCase();
      const order = await Order.findOne({ _id: orderId, seller: currentUser._id });
      if (!order) return { error: `Order #${orderId} not found under your seller catalog.` };

      if (cleanStatus === 'rejected' && order.status !== 'rejected') {
        await Product.findByIdAndUpdate(order.product, { $inc: { quantity: order.quantity } });
      }
      const prev = order.status;
      order.status = cleanStatus;
      await order.save();
      return { success: true, message: `Customer order #${order._id} marked as '${cleanStatus}'.` };
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
        message: `Product '${product.title}' has been successfully created in your inventory with ${product.quantity} units at $${product.price}.`,
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
      return { success: true, message: `Product '${product.title}' removed from inventory.` };
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
      if (product.quantity < qty) return { error: `Insufficient stock for '${product.title}'. Only ${product.quantity} items left.` };

      const unitPrice = product.price;
      const discount = product.discount || 0;
      const effectiveUnit = unitPrice * (1 - discount / 100);
      const totalPrice = Number((effectiveUnit * qty).toFixed(2));

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
      return { success: true, message: `Order #${order._id} cancelled successfully and inventory refunded.` };
    }

    default:
      return { error: `Unknown write tool '${toolName}'.` };
  }
};

/**
 * Build LangChain Dynamic Tools for the given user role
 */
const createLangChainTools = (currentUser, pendingActionHolder) => {
  const tools = [];

  // Common: whoAmI
  tools.push(
    tool(
      async () => {
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
          return JSON.stringify({ ...baseInfo, totalProducts: productCount, totalOrdersReceived: orderCount });
        }
        if (currentUser.role === 'buyer') {
          const orderCount = await Order.countDocuments({ buyer: currentUser._id });
          return JSON.stringify({ ...baseInfo, totalOrdersPlaced: orderCount });
        }
        if (currentUser.role === 'admin') {
          const totalUsers = await User.countDocuments();
          return JSON.stringify({ ...baseInfo, platformUsersTotal: totalUsers, privileges: 'Full System Admin' });
        }
        return JSON.stringify(baseInfo);
      },
      {
        name: 'whoAmI',
        description: 'Get profile information, account status, and role details of the currently logged-in user.',
        schema: z.object({}),
      }
    )
  );

  // Common: recentProducts
  tools.push(
    tool(
      async (args) => {
        const limit = args.limit || 8;
        const products = await Product.find({ quantity: { $gt: 0 } })
          .populate('seller', 'name')
          .sort({ createdAt: -1 })
          .limit(limit);
        return JSON.stringify({
          count: products.length,
          products: products.map((p) => ({
            id: p._id,
            title: p.title,
            price: p.price,
            discount: p.discount,
            effectivePrice: p.discount > 0 ? Number((p.price * (1 - p.discount / 100)).toFixed(2)) : p.price,
            stock: p.quantity,
            seller: p.seller?.name || 'Verified Seller',
          })),
        });
      },
      {
        name: 'getRecentProducts',
        description: 'Fetch the most recent products added to the marketplace catalog.',
        schema: z.object({
          limit: z.number().optional().describe('Maximum products to return'),
        }),
      }
    )
  );

  // ADMIN TOOLS
  if (currentUser.role === 'admin') {
    tools.push(
      tool(
        async () => {
          const totalUsers = await User.countDocuments();
          const pendingUsers = await User.countDocuments({ status: 'pending' });
          const totalProducts = await Product.countDocuments();
          const totalOrders = await Order.countDocuments();
          const salesAgg = await Order.aggregate([
            { $match: { status: { $in: ['approved', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } },
          ]);
          return JSON.stringify({
            totalUsers,
            pendingUsers,
            totalProducts,
            totalOrders,
            platformSales: salesAgg[0]?.total || 0,
          });
        },
        {
          name: 'getPlatformStats',
          description: 'Get platform analytics: users count, pending approvals, products count, orders count, and sales GMV.',
          schema: z.object({}),
        }
      ),

      tool(
        async (args) => {
          const filter = {};
          if (args.role) filter.role = args.role.toLowerCase();
          if (args.status) filter.status = args.status.toLowerCase();
          const limit = args.limit || 15;
          const users = await User.find(filter)
            .select('_id name email role status createdAt')
            .sort({ createdAt: -1 })
            .limit(limit);
          return JSON.stringify({
            count: users.length,
            users: users.map((u) => ({
              id: u._id,
              name: u.name,
              email: u.email,
              role: u.role,
              status: u.status,
              registered: u.createdAt,
            })),
          });
        },
        {
          name: 'listUsers',
          description: 'List platform users filtered by role or verification status (e.g. pending approvals).',
          schema: z.object({
            role: z.string().optional().describe('Role: admin, seller, or buyer'),
            status: z.string().optional().describe('Status: pending, approved, rejected, or blocked'),
            limit: z.number().optional().describe('Limit results'),
          }),
        }
      ),

      tool(
        async (args) => {
          const filter = {};
          if (args.status) filter.status = args.status.toLowerCase();
          const limit = args.limit || 15;
          const orders = await Order.find(filter)
            .populate('buyer', 'name email')
            .populate('seller', 'name email')
            .populate('product', 'title price')
            .sort({ createdAt: -1 })
            .limit(limit);
          return JSON.stringify({
            count: orders.length,
            orders: orders.map((o) => ({
              orderId: o._id,
              product: o.product?.title || 'Unknown',
              buyer: o.buyer?.name,
              seller: o.seller?.name,
              quantity: o.quantity,
              totalPrice: o.totalPrice,
              status: o.status,
              createdAt: o.createdAt,
            })),
          });
        },
        {
          name: 'listOrders',
          description: 'List platform orders (e.g. new orders, orders to review, pending, approved).',
          schema: z.object({
            status: z.string().optional().describe('Order status filter: pending, approved, rejected, cancelled, completed'),
            limit: z.number().optional().describe('Limit results'),
          }),
        }
      ),

      // WRITE TOOL: updateUserStatus (triggers confirmation)
      tool(
        async (args) => {
          pendingActionHolder.pendingAction = {
            tool: 'updateUserStatus',
            args,
            actionName: `${args.status.toUpperCase()} User`,
            summary: `Update status of user '${args.userIdOrEmail}' to '${args.status}'.`,
            changes: { targetUser: args.userIdOrEmail, targetStatus: args.status, reason: args.reason || 'Admin action' },
          };
          return JSON.stringify({
            requires_confirmation: true,
            message: `CONFIRMATION NEEDED: You are requesting to update user '${args.userIdOrEmail}' status to '${args.status}'. Please ask the user for confirmation.`,
            pendingAction: pendingActionHolder.pendingAction,
          });
        },
        {
          name: 'updateUserStatus',
          description: 'Approve, reject, or block a user profile. NOTE: Requires user confirmation before database write.',
          schema: z.object({
            userIdOrEmail: z.string().describe('User ID or email address'),
            status: z.string().describe('Target status: approved, rejected, blocked, or pending'),
            reason: z.string().optional().describe('Admin rationale'),
          }),
        }
      ),

      // WRITE TOOL: updateOrderStatus (triggers confirmation)
      tool(
        async (args) => {
          pendingActionHolder.pendingAction = {
            tool: 'updateOrderStatus',
            args,
            actionName: `Update Order Status to ${args.status.toUpperCase()}`,
            summary: `Change status of order #${args.orderId} to '${args.status}'.`,
            changes: { orderId: args.orderId, newStatus: args.status },
          };
          return JSON.stringify({
            requires_confirmation: true,
            message: `CONFIRMATION NEEDED: You are updating order #${args.orderId} to '${args.status}'. Please ask the user for confirmation.`,
            pendingAction: pendingActionHolder.pendingAction,
          });
        },
        {
          name: 'updateOrderStatus',
          description: 'Change order status as Admin (approve, reject, cancel). NOTE: Requires user confirmation.',
          schema: z.object({
            orderId: z.string().describe('Order MongoDB ID'),
            status: z.string().describe('Target status: approved, rejected, cancelled, completed'),
          }),
        }
      )
    );
  }

  // SELLER TOOLS
  if (currentUser.role === 'seller') {
    tools.push(
      tool(
        async () => {
          const sellerId = currentUser._id;
          const deliveredAgg = await Order.aggregate([
            { $match: { seller: sellerId, status: { $in: ['approved', 'completed'] } } },
            { $group: { _id: null, totalEarnings: { $sum: '$totalPrice' }, count: { $sum: 1 }, unitsSold: { $sum: '$quantity' } } },
          ]);
          const pendingAgg = await Order.aggregate([
            { $match: { seller: sellerId, status: 'pending' } },
            { $group: { _id: null, upcomingEarnings: { $sum: '$totalPrice' }, pendingCount: { $sum: 1 } } },
          ]);

          return JSON.stringify({
            deliveredEarnings: Number((deliveredAgg[0]?.totalEarnings || 0).toFixed(2)),
            upcomingPendingEarnings: Number((pendingAgg[0]?.upcomingEarnings || 0).toFixed(2)),
            totalCompletedOrders: deliveredAgg[0]?.count || 0,
            pendingOrdersCount: pendingAgg[0]?.pendingCount || 0,
            totalUnitsSold: deliveredAgg[0]?.unitsSold || 0,
          });
        },
        {
          name: 'getSellerEarnings',
          description: 'Get seller revenue, delivered earnings, upcoming revenue from pending orders, and sales stats.',
          schema: z.object({}),
        }
      ),

      tool(
        async () => {
          const products = await Product.find({ seller: currentUser._id }).sort({ createdAt: -1 });
          return JSON.stringify({
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
          });
        },
        {
          name: 'listMyProducts',
          description: "List seller's owned inventory products with stock quantities and discounts.",
          schema: z.object({}),
        }
      ),

      tool(
        async (args) => {
          const filter = { seller: currentUser._id };
          if (args.status) filter.status = args.status.toLowerCase();
          const orders = await Order.find(filter)
            .populate('buyer', 'name email')
            .populate('product', 'title price discount')
            .sort({ createdAt: -1 });
          return JSON.stringify({
            count: orders.length,
            orders: orders.map((o) => ({
              orderId: o._id,
              product: o.product?.title || 'Unknown',
              buyer: o.buyer?.name,
              quantity: o.quantity,
              totalPrice: o.totalPrice,
              status: o.status,
              createdAt: o.createdAt,
            })),
          });
        },
        {
          name: 'listSellerOrders',
          description: 'List incoming customer orders for review and fulfillment.',
          schema: z.object({
            status: z.string().optional().describe('Order status filter: pending, approved, completed, rejected'),
          }),
        }
      ),

      // WRITE TOOL: addProduct
      tool(
        async (args) => {
          pendingActionHolder.pendingAction = {
            tool: 'addProduct',
            args,
            actionName: 'Create New Product',
            summary: `Add product '${args.title}' with ${args.quantity} units at $${args.price} (Discount: ${args.discount || 0}%).`,
            changes: { title: args.title, quantity: args.quantity, price: args.price, discount: args.discount || 0 },
          };
          return JSON.stringify({
            requires_confirmation: true,
            message: `CONFIRMATION NEEDED: You are creating product '${args.title}' (${args.quantity} units at $${args.price}). Please ask the seller for confirmation.`,
            pendingAction: pendingActionHolder.pendingAction,
          });
        },
        {
          name: 'addProduct',
          description: 'Create a new product in seller inventory. NOTE: Requires confirmation before DB write.',
          schema: z.object({
            title: z.string().describe('Product title'),
            description: z.string().optional().describe('Product description'),
            quantity: z.number().describe('Stock quantity'),
            price: z.number().describe('Unit price'),
            discount: z.number().optional().describe('Discount percentage (0-100)'),
          }),
        }
      ),

      // WRITE TOOL: updateProduct
      tool(
        async (args) => {
          pendingActionHolder.pendingAction = {
            tool: 'updateProduct',
            args,
            actionName: 'Update Product Details',
            summary: `Modify product '${args.productIdOrTitle}'.`,
            changes: args,
          };
          return JSON.stringify({
            requires_confirmation: true,
            message: `CONFIRMATION NEEDED: You are updating product '${args.productIdOrTitle}'. Please ask for confirmation.`,
            pendingAction: pendingActionHolder.pendingAction,
          });
        },
        {
          name: 'updateProduct',
          description: 'Update price, discount, or quantity of seller product. NOTE: Requires confirmation.',
          schema: z.object({
            productIdOrTitle: z.string().describe('Product ID or product title'),
            quantity: z.number().optional(),
            price: z.number().optional(),
            discount: z.number().optional(),
            description: z.string().optional(),
          }),
        }
      ),

      // WRITE TOOL: updateSellerOrderStatus
      tool(
        async (args) => {
          pendingActionHolder.pendingAction = {
            tool: 'updateSellerOrderStatus',
            args,
            actionName: `Mark Order as ${args.status.toUpperCase()}`,
            summary: `Update order #${args.orderId} status to '${args.status}'.`,
            changes: { orderId: args.orderId, status: args.status },
          };
          return JSON.stringify({
            requires_confirmation: true,
            message: `CONFIRMATION NEEDED: You are updating customer order #${args.orderId} to '${args.status}'. Please ask for confirmation.`,
            pendingAction: pendingActionHolder.pendingAction,
          });
        },
        {
          name: 'updateSellerOrderStatus',
          description: 'Accept, decline, or mark delivered an incoming order. NOTE: Requires confirmation.',
          schema: z.object({
            orderId: z.string().describe('Order ID'),
            status: z.string().describe('Status: approved, rejected, or completed'),
          }),
        }
      )
    );
  }

  // BUYER TOOLS
  if (currentUser.role === 'buyer') {
    tools.push(
      tool(
        async (args) => {
          const filter = { quantity: { $gt: 0 } };
          if (args.query) {
            const r = new RegExp(args.query, 'i');
            filter.$or = [{ title: r }, { description: r }];
          }
          if (args.maxPrice) {
            filter.price = { $lte: Number(args.maxPrice) };
          }
          const products = await Product.find(filter).populate('seller', 'name').sort({ createdAt: -1 }).limit(10);
          return JSON.stringify({
            count: products.length,
            products: products.map((p) => ({
              id: p._id,
              title: p.title,
              description: p.description,
              price: p.price,
              discount: p.discount,
              finalPrice: p.discount > 0 ? Number((p.price * (1 - p.discount / 100)).toFixed(2)) : p.price,
              stock: p.quantity,
              seller: p.seller?.name || 'Verified Seller',
            })),
          });
        },
        {
          name: 'browseProducts',
          description: 'Search and browse marketplace catalog products with pricing, discounts, and availability.',
          schema: z.object({
            query: z.string().optional().describe('Search query term'),
            maxPrice: z.number().optional().describe('Budget limit'),
          }),
        }
      ),

      tool(
        async (args) => {
          const filter = { buyer: currentUser._id };
          if (args.status) filter.status = args.status.toLowerCase();
          const orders = await Order.find(filter)
            .populate('seller', 'name email')
            .populate('product', 'title price discount')
            .sort({ createdAt: -1 });
          return JSON.stringify({
            count: orders.length,
            orders: orders.map((o) => ({
              orderId: o._id,
              product: o.product?.title || 'Unknown Product',
              seller: o.seller?.name,
              quantity: o.quantity,
              totalPrice: o.totalPrice,
              status: o.status,
              createdAt: o.createdAt,
            })),
          });
        },
        {
          name: 'listMyOrders',
          description: 'List buyer order history with delivery statuses, items, and totals.',
          schema: z.object({
            status: z.string().optional().describe('Order status: pending, approved, completed, cancelled'),
          }),
        }
      ),

      // WRITE TOOL: buyProduct (triggers confirmation)
      tool(
        async (args) => {
          const qty = Math.max(1, Number(args.quantity) || 1);
          let product = null;
          if (args.productIdOrTitle.match(/^[0-9a-fA-F]{24}$/)) {
            product = await Product.findById(args.productIdOrTitle);
          }
          if (!product) {
            product = await Product.findOne({ title: new RegExp(args.productIdOrTitle, 'i') });
          }

          if (!product) return JSON.stringify({ error: `Product '${args.productIdOrTitle}' not found in catalog.` });
          if (product.quantity < qty) return JSON.stringify({ error: `Only ${product.quantity} items available for '${product.title}'.` });

          const effectivePrice = product.discount > 0 ? product.price * (1 - product.discount / 100) : product.price;
          const totalCost = Number((effectivePrice * qty).toFixed(2));

          pendingActionHolder.pendingAction = {
            tool: 'buyProduct',
            args: { productIdOrTitle: product._id.toString(), quantity: qty },
            actionName: 'Purchase Order Checkout',
            summary: `Buy ${qty} unit(s) of '${product.title}' for a total of $${totalCost.toFixed(2)}.`,
            changes: {
              product: product.title,
              quantity: qty,
              unitPrice: product.price,
              discount: product.discount,
              totalCost: totalCost,
            },
          };

          return JSON.stringify({
            requires_confirmation: true,
            message: `CONFIRMATION NEEDED: You are placing an order for ${qty} unit(s) of '${product.title}' totaling $${totalCost.toFixed(2)}. Please ask the buyer for confirmation.`,
            pendingAction: pendingActionHolder.pendingAction,
          });
        },
        {
          name: 'buyProduct',
          description: 'Place an order to buy a product. NOTE: Requires explicit buyer confirmation before deducting inventory and placing order.',
          schema: z.object({
            productIdOrTitle: z.string().describe('Product ID or product name'),
            quantity: z.number().optional().describe('Units to purchase'),
          }),
        }
      ),

      // WRITE TOOL: cancelOrder
      tool(
        async (args) => {
          pendingActionHolder.pendingAction = {
            tool: 'cancelOrder',
            args,
            actionName: 'Cancel Order',
            summary: `Cancel order #${args.orderId} and refund inventory.`,
            changes: { orderId: args.orderId },
          };
          return JSON.stringify({
            requires_confirmation: true,
            message: `CONFIRMATION NEEDED: You are cancelling order #${args.orderId}. Please ask for confirmation.`,
            pendingAction: pendingActionHolder.pendingAction,
          });
        },
        {
          name: 'cancelOrder',
          description: 'Cancel a pending order and refund inventory. NOTE: Requires confirmation.',
          schema: z.object({
            orderId: z.string().describe('Order ID to cancel'),
          }),
        }
      )
    );
  }

  return tools;
};

/**
 * Main LangChain Chat Orchestrator with HITL Confirmation Loop
 */
const runMarketplaceChat = async ({ message, history = [], currentUser, pendingAction = null }) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const toolExecutionsLog = [];
  const pendingActionHolder = { pendingAction: null };

  // Check if user is confirming or cancelling an existing pending write action
  const cleanInput = message.trim().toLowerCase();
  const isAffirmative = ['yes', 'confirm', 'proceed', 'agreed', 'agree', 'ok', 'do it', 'sure'].includes(cleanInput);
  const isNegative = ['no', 'cancel', 'abort', 'stop', "don't", 'reject'].includes(cleanInput);

  if (pendingAction && (isAffirmative || isNegative)) {
    if (isAffirmative) {
      const execResult = await executeConfirmedWriteAction({
        tool: pendingAction.tool,
        args: pendingAction.args,
        currentUser,
      });

      toolExecutionsLog.push({
        tool: pendingAction.tool,
        input: pendingAction.args,
        output: execResult,
      });

      return {
        reply: `✅ **Action Confirmed & Executed**\n\n${execResult.message || 'The changes have been successfully committed to the database.'}`,
        toolExecutions: toolExecutionsLog,
        pendingAction: null,
      };
    } else {
      return {
        reply: `❌ **Action Cancelled**\n\nNo changes were made to the database. Let me know if you would like assistance with anything else!`,
        toolExecutions: [],
        pendingAction: null,
      };
    }
  }

  // System instruction with LangChain HITL formatting rules
  const systemPrompt = `You are **Nexus AI**, the intelligent Copilot for this marketplace platform.
User Context:
- Name: ${currentUser.name}
- Email: ${currentUser.email}
- Role: ${currentUser.role}
- Account Status: ${currentUser.status}

CRITICAL OPERATIONAL RULES:
1. Always communicate politely, clearly, and concisely in structured English.
2. Present lists, statistics, orders, and products as **CLEAN MARKDOWN TABLES** or bullet lists.
3. NEVER output raw JSON in your text responses.
4. WRITE OPERATIONS IN THE DATABASE (such as approving/blocking users, creating/updating products, updating order status, purchasing products, or cancelling orders) REQUIRE EXPLICIT USER CONFIRMATION:
   - When a tool returns "requires_confirmation: true", inform the user clearly of the proposed changes in a formatted summary, and explicitly ask:
     "Do you agree to proceed with these changes? Please confirm (yes / no)."
5. When the user asks "Who am I?" or "Tell me about myself", invoke 'whoAmI' and display their profile summary table.
6. When the user asks for "today's users approval", "new orders", "orders to review", or "recent products", invoke the matching tool immediately.`;

  try {
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-flash-lite-latest',
      apiKey,
      temperature: 0.1,
    });

    const tools = createLangChainTools(currentUser, pendingActionHolder);
    const modelWithTools = model.bindTools(tools);

    // Build LangChain Message History
    const langchainMessages = [new SystemMessage(systemPrompt)];

    for (const h of history.slice(-6)) {
      if (h.role === 'user') langchainMessages.push(new HumanMessage(h.content));
      else if (h.role === 'assistant') langchainMessages.push(new AIMessage(h.content));
    }

    langchainMessages.push(new HumanMessage(message));

    // Turn 1
    let response = await modelWithTools.invoke(langchainMessages);

    // Multi-turn tool execution loop
    let turns = 0;
    while (response.tool_calls && response.tool_calls.length > 0 && turns < 5) {
      turns++;
      langchainMessages.push(response);

      for (const call of response.tool_calls) {
        const matchingTool = tools.find((t) => t.name === call.name);
        let outputStr = '{}';

        if (matchingTool) {
          outputStr = await matchingTool.invoke(call.args);
          try {
            toolExecutionsLog.push({
              tool: call.name,
              input: call.args,
              output: JSON.parse(outputStr),
            });
          } catch {
            toolExecutionsLog.push({ tool: call.name, input: call.args, output: outputStr });
          }
        }

        langchainMessages.push(
          new ToolMessage({
            content: outputStr,
            tool_call_id: call.id,
            name: call.name,
          })
        );
      }

      response = await modelWithTools.invoke(langchainMessages);
    }

    const reply = response.content || 'Action processed.';

    return {
      reply,
      toolExecutions: toolExecutionsLog,
      pendingAction: pendingActionHolder.pendingAction,
    };
  } catch (error) {
    console.error('LangChain Agent Error:', error.message);
    return {
      reply: `Nexus AI encountered an issue: ${error.message}. Please retry or check connection.`,
      toolExecutions: toolExecutionsLog,
      pendingAction: null,
    };
  }
};

module.exports = {
  runMarketplaceChat,
  executeConfirmedWriteAction,
};
