const express = require('express');
const router = express.Router();
const ChatConversation = require('../models/ChatConversation');
const { runMarketplaceChat, executeConfirmedWriteAction } = require('../services/ai.service');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Get status
router.get('/status', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'online',
    assistantName: 'Nexus AI Copilot (LangChain)',
    hasApiKey: hasEnvKey,
    userRole: req.user.role,
  });
});

// List conversations for user
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await ChatConversation.find({ user: req.user._id })
      .select('_id title role pendingAction createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching conversations' });
  }
});

// Create conversation
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
          content: `Hello ${req.user.name}! I am **Nexus AI**, your intelligent marketplace copilot powered by LangChain. How can I help you manage your ${
            req.user.role === 'admin'
              ? 'platform, users, and orders'
              : req.user.role === 'seller'
              ? 'inventory, earnings, and store operations'
              : 'shopping catalog, purchases, and orders'
          } today?`,
          toolExecutions: [],
        },
      ],
    });

    res.status(201).json({ conversation });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating conversation' });
  }
});

// Get single conversation
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

// Delete conversation
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

// Send message in conversation
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { message, confirmAction } = req.body;
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

    // Auto-title on first user message
    if (conversation.title === 'New Conversation' || !conversation.title) {
      conversation.title = message.trim().slice(0, 32) + (message.length > 32 ? '...' : '');
    }

    const currentPending = conversation.pendingAction;

    // Run LangChain Chat
    const aiResult = await runMarketplaceChat({
      message: confirmAction !== undefined ? (confirmAction ? 'yes' : 'no') : message.trim(),
      history: conversation.messages.slice(-8),
      currentUser: req.user,
      pendingAction: currentPending,
    });

    // Update conversation pending action
    conversation.pendingAction = aiResult.pendingAction || null;

    // Append Assistant message
    const assistantMsg = {
      role: 'assistant',
      content: aiResult.reply || 'Action processed.',
      toolExecutions: aiResult.toolExecutions || [],
      pendingAction: aiResult.pendingAction || null,
    };

    conversation.messages.push(assistantMsg);
    await conversation.save();

    res.json({
      conversation,
      latestMessage: assistantMsg,
      toolExecutions: aiResult.toolExecutions || [],
      pendingAction: aiResult.pendingAction || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error processing message' });
  }
});

// Explicit confirmation endpoint for button clicks
router.post('/conversations/:id/action-decision', async (req, res) => {
  try {
    const { confirmed } = req.body; // true or false
    let conversation = await ChatConversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const pending = conversation.pendingAction;
    if (!pending) {
      return res.status(400).json({ message: 'No pending action waiting for confirmation.' });
    }

    let replyText = '';
    const toolExecutions = [];

    if (confirmed) {
      const result = await executeConfirmedWriteAction({
        tool: pending.tool,
        args: pending.args,
        currentUser: req.user,
      });

      toolExecutions.push({
        tool: pending.tool,
        input: pending.args,
        output: result,
      });

      replyText = `✅ **Action Confirmed & Executed**\n\n${result.message || 'Changes have been committed to the database successfully.'}`;
    } else {
      replyText = `❌ **Action Cancelled**\n\nThe requested database operation has been cancelled. No changes were made.`;
    }

    // Add user note
    conversation.messages.push({
      role: 'user',
      content: confirmed ? 'Confirm and apply changes' : 'Cancel this action',
    });

    // Add assistant response
    const assistantMsg = {
      role: 'assistant',
      content: replyText,
      toolExecutions,
      pendingAction: null,
    };

    conversation.messages.push(assistantMsg);
    conversation.pendingAction = null;
    await conversation.save();

    res.json({
      conversation,
      latestMessage: assistantMsg,
      toolExecutions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error processing action decision' });
  }
});

module.exports = router;
