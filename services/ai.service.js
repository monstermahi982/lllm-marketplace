const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Tool definitions schema for Gemini function calling
const toolDeclarations = [
  {
    name: 'listUsers',
    description: 'Fetch and list platform users filtered by role or verification status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        role: {
          type: 'STRING',
          description: 'Filter by role: admin, seller, or buyer',
        },
        status: {
          type: 'STRING',
          description: 'Filter by account status: pending, approved, rejected, or blocked',
        },
        limit: {
          type: 'NUMBER',
          description: 'Max number of users to return (default 10)',
        },
      },
    },
  },
  {
    name: 'updateUserStatus',
    description: 'Approve, reject, block, or set pending status for a specific user by userId or email.',
    parameters: {
      type: 'OBJECT',
      properties: {
        userIdOrEmail: {
          type: 'STRING',
          description: 'The MongoDB _id or the email address of the user',
        },
        status: {
          type: 'STRING',
          description: 'The target status: approved, rejected, blocked, or pending',
        },
        reason: {
          type: 'STRING',
          description: 'Optional admin explanation or rationale for the status change',
        },
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
        status: {
          type: 'STRING',
          description: 'Filter orders by status: pending, approved, rejected, cancelled, completed',
        },
        limit: {
          type: 'NUMBER',
          description: 'Max number of orders to return',
        },
      },
    },
  },
  {
    name: 'updateOrderStatus',
    description: 'Update the status of a specific order (e.g. approve, reject, or cancel).',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: {
          type: 'STRING',
          description: 'The MongoDB _id of the order to update',
        },
        status: {
          type: 'STRING',
          description: 'New status for the order: approved, rejected, cancelled, or completed',
        },
      },
      required: ['orderId', 'status'],
    },
  },
  {
    name: 'getPlatformStats',
    description: 'Retrieve high-level marketplace analytics: user count, pending approvals, order count, and total sales.',
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
        query: {
          type: 'STRING',
          description: 'Search keyword',
        },
      },
      required: ['query'],
    },
  },
];

// Actual execution handlers for each tool
const executeTool = async (name, args) => {
  console.log(`[AI Tool Call] Executing '${name}' with args:`, args);

  switch (name) {
    case 'listUsers': {
      const filter = {};
      if (args.role) filter.role = args.role.toLowerCase();
      if (args.status) filter.status = args.status.toLowerCase();
      const limit = Number(args.limit) || 10;
      const users = await User.find(filter)
        .select('_id name email role status createdAt')
        .sort({ createdAt: -1 })
        .limit(limit);

      return {
        count: users.length,
        users: users.map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          registeredAt: u.createdAt,
        })),
      };
    }

    case 'updateUserStatus': {
      const { userIdOrEmail, status, reason } = args;
      const cleanStatus = status.toLowerCase();

      if (!['pending', 'approved', 'rejected', 'blocked'].includes(cleanStatus)) {
        return { error: `Invalid status '${status}'. Must be pending, approved, rejected, or blocked.` };
      }

      let user = null;
      if (userIdOrEmail.match(/^[0-9a-fA-F]{24}$/)) {
        user = await User.findById(userIdOrEmail);
      }
      if (!user) {
        user = await User.findOne({ email: userIdOrEmail.toLowerCase().trim() });
      }

      if (!user) {
        return { error: `User with identifier '${userIdOrEmail}' was not found.` };
      }

      if (user.role === 'admin' && cleanStatus === 'blocked') {
        return { error: 'Security restriction: Admin users cannot be blocked.' };
      }

      const previousStatus = user.status;
      user.status = cleanStatus;
      await user.save();

      return {
        success: true,
        message: `User '${user.name}' (${user.email}) status changed from '${previousStatus}' to '${cleanStatus}'.`,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        reason: reason || 'Admin action via AI agent',
      };
    }

    case 'listOrders': {
      const filter = {};
      if (args.status) filter.status = args.status.toLowerCase();
      const limit = Number(args.limit) || 10;

      const orders = await Order.find(filter)
        .populate('buyer', 'name email')
        .populate('seller', 'name email')
        .populate('product', 'title price discount')
        .sort({ createdAt: -1 })
        .limit(limit);

      return {
        count: orders.length,
        orders: orders.map((o) => ({
          orderId: o._id,
          buyer: o.buyer ? `${o.buyer.name} (${o.buyer.email})` : 'Unknown',
          seller: o.seller ? `${o.seller.name} (${o.seller.email})` : 'Unknown',
          product: o.product ? o.product.title : 'Deleted Product',
          quantity: o.quantity,
          totalPrice: o.totalPrice,
          status: o.status,
          date: o.createdAt,
        })),
      };
    }

    case 'updateOrderStatus': {
      const { orderId, status } = args;
      const cleanStatus = status.toLowerCase();

      if (!['pending', 'approved', 'rejected', 'cancelled', 'completed'].includes(cleanStatus)) {
        return { error: `Invalid order status '${status}'.` };
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return { error: `Order with ID '${orderId}' not found.` };
      }

      // If rejected or cancelled, restock product
      if ((cleanStatus === 'rejected' || cleanStatus === 'cancelled') && !['rejected', 'cancelled'].includes(order.status)) {
        await Product.findByIdAndUpdate(order.product, {
          $inc: { quantity: order.quantity },
        });
      }

      const prevStatus = order.status;
      order.status = cleanStatus;
      await order.save();

      return {
        success: true,
        message: `Order #${order._id} status updated from '${prevStatus}' to '${cleanStatus}'.`,
        orderId: order._id,
        newStatus: cleanStatus,
      };
    }

    case 'getPlatformStats': {
      const totalUsers = await User.countDocuments();
      const pendingUsers = await User.countDocuments({ status: 'pending' });
      const approvedUsers = await User.countDocuments({ status: 'approved' });
      const blockedUsers = await User.countDocuments({ status: 'blocked' });

      const totalProducts = await Product.countDocuments();
      const totalOrders = await Order.countDocuments();

      const revenueAgg = await Order.aggregate([
        { $match: { status: { $in: ['approved', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]);

      const sales = revenueAgg[0]?.total || 0;

      return {
        metrics: {
          totalUsers,
          pendingUsers,
          approvedUsers,
          blockedUsers,
          totalProducts,
          totalOrders,
          grossMerchandiseValue: sales,
        },
      };
    }

    case 'searchProducts': {
      const regex = new RegExp(args.query, 'i');
      const products = await Product.find({
        $or: [{ title: regex }, { description: regex }],
      })
        .populate('seller', 'name email')
        .limit(10);

      return {
        count: products.length,
        products: products.map((p) => ({
          id: p._id,
          title: p.title,
          price: p.price,
          discount: p.discount,
          quantity: p.quantity,
          seller: p.seller?.name || 'Unknown',
        })),
      };
    }

    default:
      return { error: `Unknown tool '${name}'` };
  }
};

/**
 * Handle AI Admin Chat with Gemini Function Calling & Resilient Fallback
 */
const runAdminAIChat = async ({ message, history = [], customApiKey }) => {
  const envKey = (process.env.GEMINI_API_KEY || '').trim();
  const apiKey = (customApiKey || envKey).trim();

  const toolExecutionsLog = [];

  // Helper to execute matching tool based on intent
  const executeInferredTool = async (text) => {
    const lower = text.toLowerCase();
    let localResult = null;
    let toolName = '';
    let toolArgs = {};

    if (lower.includes('stat') || lower.includes('metric') || lower.includes('overview') || lower.includes('analytics') || lower.includes('sales')) {
      toolName = 'getPlatformStats';
      toolArgs = {};
      localResult = await executeTool(toolName, toolArgs);
    } else if (lower.includes('pending') || (lower.includes('user') && lower.includes('list')) || lower.includes('all user')) {
      const status = lower.includes('pending') ? 'pending' : (lower.includes('approved') ? 'approved' : lower.includes('blocked') ? 'blocked' : undefined);
      const role = lower.includes('seller') ? 'seller' : (lower.includes('buyer') ? 'buyer' : undefined);
      toolName = 'listUsers';
      toolArgs = { role, status };
      localResult = await executeTool(toolName, toolArgs);
    } else if (lower.includes('approve') && (lower.includes('user') || lower.includes('@') || lower.includes('seller') || lower.includes('buyer'))) {
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const target = emailMatch ? emailMatch[0] : text.replace(/approve/i, '').replace(/user/i, '').trim();
      toolName = 'updateUserStatus';
      toolArgs = { userIdOrEmail: target, status: 'approved' };
      localResult = await executeTool(toolName, toolArgs);
    } else if (lower.includes('block') && (lower.includes('user') || lower.includes('@') || lower.includes('seller') || lower.includes('buyer'))) {
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const target = emailMatch ? emailMatch[0] : text.replace(/block/i, '').replace(/user/i, '').trim();
      toolName = 'updateUserStatus';
      toolArgs = { userIdOrEmail: target, status: 'blocked' };
      localResult = await executeTool(toolName, toolArgs);
    } else if (lower.includes('order')) {
      toolName = 'listOrders';
      toolArgs = {};
      localResult = await executeTool(toolName, toolArgs);
    } else if (lower.includes('product') || lower.includes('search')) {
      const query = text.replace(/search/i, '').replace(/product/i, '').replace(/products/i, '').trim() || 'all';
      toolName = 'searchProducts';
      toolArgs = { query };
      localResult = await executeTool(toolName, toolArgs);
    }

    if (toolName && localResult) {
      toolExecutionsLog.push({
        tool: toolName,
        input: toolArgs,
        output: localResult,
      });
      return { toolName, localResult };
    }
    return null;
  };

  const isGeminiKeyValidFormat = apiKey && apiKey.startsWith('AIzaSy');

  // If no Gemini key or invalid key format, execute tool locally
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || !isGeminiKeyValidFormat) {
    const executed = await executeInferredTool(message);
    if (executed) {
      return {
        reply: `Executed '${executed.toolName}' tool successfully:\n\n${JSON.stringify(executed.localResult, null, 2)}\n\n💡 Tip: To enable full conversational natural language with Gemini, enter your Google AI Studio API key (starts with AIzaSy...) in the top right.`,
        toolExecutions: toolExecutionsLog,
        hasApiKey: false,
      };
    }

    return {
      reply: `I am your Admin AI Agent. You can ask me to:
- "Show platform statistics"
- "List all pending users"
- "Approve user <email>"
- "Block user <email>"
- "List all orders"
- "Search products"

(Configure a free Google AI Studio key starting with AIzaSy... to enable full Gemini LLM tool calling).`,
      toolExecutions: [],
      hasApiKey: false,
    };
  }

  // Live Gemini Tool Calling
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction:
        'You are the intelligent Admin AI Agent for this e-commerce marketplace platform. You have direct tools to inspect users, approve/reject/block users, check orders, cancel or update orders, search products, and view live platform statistics. Always call the relevant tool when asked, then formulate a concise response based on the tool result.',
      tools: [{ functionDeclarations: toolDeclarations }],
    });

    const chat = model.startChat({
      history: history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
    });

    let response = await chat.sendMessage(message);
    let candidate = response.response;

    let turns = 0;
    while (candidate.functionCalls() && candidate.functionCalls().length > 0 && turns < 5) {
      turns++;
      const functionCalls = candidate.functionCalls();
      const functionResponses = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        const result = await executeTool(name, args);

        toolExecutionsLog.push({
          tool: name,
          input: args,
          output: result,
        });

        functionResponses.push({
          functionResponse: {
            name,
            response: { result },
          },
        });
      }

      response = await chat.sendMessage(functionResponses);
      candidate = response.response;
    }

    const reply = candidate.text();
    return {
      reply,
      toolExecutions: toolExecutionsLog,
      hasApiKey: true,
    };
  } catch (error) {
    console.warn('Gemini API call failed, falling back to local tool runner:', error.message);
    const executed = await executeInferredTool(message);

    if (executed) {
      return {
        reply: `[Gemini Notice: ${error.message}]\nI executed the '${executed.toolName}' tool for you directly on the database:\n\n${JSON.stringify(executed.localResult, null, 2)}`,
        toolExecutions: toolExecutionsLog,
        hasApiKey: true,
      };
    }

    return {
      reply: `Gemini API Error: ${error.message}. Please check that your Gemini API key from Google AI Studio is active.`,
      toolExecutions: toolExecutionsLog,
      error: error.message,
      hasApiKey: true,
    };
  }
};

module.exports = {
  runAdminAIChat,
  executeTool,
};
