const express = require('express');
const router = express.Router();
const { runAdminAIChat, executeTool } = require('../services/ai.service');
const { authenticate, authorize } = require('../middleware/auth');

// All AI administrative tools are guarded by Admin role
router.use(authenticate, authorize('admin'));

// Check AI status
router.get('/status', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'online',
    hasApiKey: hasEnvKey,
    supportedTools: [
      'listUsers',
      'updateUserStatus',
      'listOrders',
      'updateOrderStatus',
      'getPlatformStats',
      'searchProducts',
    ],
  });
});

// Admin chat with LLM tool calling
router.post('/chat', async (req, res) => {
  try {
    const { message, history, customApiKey } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message text is required.' });
    }

    const result = await runAdminAIChat({
      message: message.trim(),
      history: history || [],
      customApiKey,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error processing AI chat' });
  }
});

// Direct tool test runner
router.post('/execute-tool', async (req, res) => {
  try {
    const { toolName, args } = req.body;
    if (!toolName) {
      return res.status(400).json({ message: 'toolName is required' });
    }

    const output = await executeTool(toolName, args || {});
    res.json({ success: true, toolName, output });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error executing tool' });
  }
});

module.exports = router;
