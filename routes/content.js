const express = require('express');
const router = express.Router();
const { chatGPT } = require('../services/openai');
const auth = require('../middleware/auth');

// Test endpoint without auth for testing
router.post('/test', async (req, res) => {
  try {
    const { prompt, model = 'meta-llama/llama-3.3-70b-instruct:free', temperature = 0.7, max_tokens = 2048 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const messages = [
      { role: 'system', content: 'You are an expert SEO content writer.' },
      { role: 'user', content: prompt }
    ];

    const content = await chatGPT(messages, { model, temperature, max_tokens });
    
    res.json({ 
      content,
      model,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate content: ' + error.message 
    });
  }
});

// Generate content using ChatGPT (temporarily without auth for testing)
router.post('/generate', async (req, res) => {
  try {
    const { prompt, model = 'meta-llama/llama-3.3-70b-instruct:free', temperature = 0.7, max_tokens = 2048 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const messages = [
      { role: 'system', content: 'You are an expert SEO content writer.' },
      { role: 'user', content: prompt }
    ];

    const content = await chatGPT(messages, { model, temperature, max_tokens });
    
    res.json({ 
      content,
      model,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate content: ' + error.message 
    });
  }
});

module.exports = router;