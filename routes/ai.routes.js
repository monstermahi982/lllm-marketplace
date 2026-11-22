const express = require('express');
const router = express.Router();
const ChatConversation = require('../models/ChatConversation');
const { runMarketplaceChat, executeTool } = require('../services/ai.service');
const { authenticate } = require('../middleware/auth');

// All AI features require an authenticated session (Admin, Seller, or Buyer)
router.use(authenticate);

// Get service status
router.get('/status', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'online',
    assistantName: 'Nexus AI Copilot',
    hasApiKey: hasEnvKey,
    userRole: req.user.role,
  });
});

// List all conversations for current user
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await ChatConversation.find({ user: req.user._id })
      .select('_id title role createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching conversations' });
  }
});

// Create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await ChatConversation.create({
      user: req.user._id,
      role: req.user.role,
      title: title || 'New Conversation',
      messages: [
        {
          role: 'assistant',
          content: `Hello ${req.user.name}! I am **Nexus AI**, your marketplace assistant. Ask me anything about your ${req.user.role === 'admin' ? 'users, platform metrics, and orders' : req.user.role === 'seller' ? 'products, inventory, incoming orders, and earnings' : 'products to buy, orders, and profile'}.`,
          toolExecutions: [],
        },
      ],
    });

    res.status(201).json({ conversation });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating conversation' });
  }
});

// Get a specific conversation with all its messages
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await ChatConversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ conversation });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching conversation' });
  }
});

// Delete a conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    const result = await ChatConversation.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!result) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting conversation' });
  }
});

// Send message to a conversation
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content is required.' });
    }

    let conversation = await ChatConversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message.trim(),
    });

    // Auto-title if it's the first user message and title was default
    if (conversation.title === 'New Conversation' || !conversation.title) {
      conversation.title = message.trim().slice(0, 30) + (message.length > 30 ? '...' : '');
    }

    // Run AI Copilot
    const aiResult = await runMarketplaceChat({
      message: message.trim(),
      history: conversation.messages.slice(-8),
      currentUser: req.user,
    });

    // Append Assistant message
    conversation.messages.push({
      role: 'assistant',
      content: aiResult.reply || 'No response generated.',
      toolExecutions: aiResult.toolExecutions || [],
    });

    await conversation.save();

    res.json({
      conversation,
      latestMessage: conversation.messages[conversation.messages.length - 1],
      toolExecutions: aiResult.toolExecutions || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error processing AI message' });
  }
});

// Standalone quick chat endpoint (backwards compatible)
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message text is required.' });
    }

    const result = await runMarketplaceChat({
      message: message.trim(),
      history: history || [],
      currentUser: req.user,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error in AI chat' });
  }
});

module.exports = router;
