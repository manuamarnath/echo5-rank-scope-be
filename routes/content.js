const express = require('express');
const router = express.Router();
const { chatGPT, getEmbeddings, OPENAI_MODEL } = require('../services/openai');
const auth = require('../middleware/auth');

// Test endpoint without auth for testing
router.post('/test', async (req, res) => {
  try {
    const { prompt, model = OPENAI_MODEL, temperature = 0.7, max_tokens = 2048, originality_proof } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Stronger system instruction: require original phrasing and mark direct quotes
    const systemInstruction = `You are an expert SEO content writer. Produce high-quality, SEO-optimized content. IMPORTANT: Do NOT reproduce text verbatim from competitor sources or other external materials. Paraphrase ideas, add unique examples or insights, and explicitly mark any direct quotes with attribution.`;

    const messages = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ];

    // If the client requests an originality proof, explicitly ask the model to append
    // a short Originality Declaration at the end of the generated output.
    if (originality_proof) {
      messages.push({ role: 'user', content: 'Please append an "Originality Declaration:" section (1-3 sentences) at the end that confirms the content is original and notes any direct quotes/attributions.' });
    }

    const content = await chatGPT(messages, { model, temperature, max_tokens });

    const responsePayload = {
      content,
      model,
      timestamp: new Date().toISOString(),
    };

    // Include a simple server-side noted flag indicating we requested originality proof
    if (originality_proof) responsePayload.originalityRequested = true;

    // Basic novelty check using embeddings if client provided competitor text or headings
    if (originality_proof) {
      try {
        const threshold = 0.85; // cosine similarity threshold considered too similar

        // Build comparison texts from request body: prefer explicit `comparisons`,
        // otherwise try `competitors` array with headings.
        const comparisonTexts = [];
        if (Array.isArray(req.body.comparisons) && req.body.comparisons.length > 0) {
          req.body.comparisons.forEach(c => { if (c && typeof c === 'string') comparisonTexts.push(c); });
        } else if (Array.isArray(req.body.competitors) && req.body.competitors.length > 0) {
          req.body.competitors.forEach(comp => {
            const headings = Array.isArray(comp.headings) ? comp.headings.join('\n') : '';
            comparisonTexts.push(`${comp.title || ''}\n${headings}`.trim());
          });
        }

        if (comparisonTexts.length > 0) {
          // Get embeddings for generated content and comparison texts
          const textsToEmbed = [content, ...comparisonTexts];
          const embeddings = await getEmbeddings(textsToEmbed);
          const contentEmbedding = embeddings[0];

          const cosine = (a, b) => {
            const dot = a.reduce((s, v, i) => s + v * b[i], 0);
            const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
            const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
            return dot / (magA * magB + 1e-12);
          };

          let maxSim = 0;
          let maxIndex = -1;
          for (let i = 1; i < embeddings.length; i++) {
            const sim = cosine(contentEmbedding, embeddings[i]);
            if (sim > maxSim) {
              maxSim = sim;
              maxIndex = i - 1;
            }
          }

          responsePayload.novelty = {
            maxSimilarity: maxSim,
            similarToIndex: maxIndex,
            threshold,
            passed: maxSim <= threshold,
          };

          // If too similar, request a paraphrase/regeneration to reduce similarity
          if (maxSim > threshold) {
            const paraphrasePrompt = `Paraphrase the following content to reduce similarity with the provided competitor text while preserving meaning and SEO intent.\n\nOriginal Content:\n${content}\n\nCompetitor Excerpt:\n${comparisonTexts[maxIndex]}\n\nReturn the full paraphrased article and append an \"Originality Declaration:\" (1-2 sentences) stating that the content is original.`;
            const paraphraseMessages = [
              { role: 'system', content: 'You are an expert content writer. Rephrase content to be original and avoid close similarity to the competitor text provided.' },
              { role: 'user', content: paraphrasePrompt }
            ];
            const paraphrased = await chatGPT(paraphraseMessages, { model, temperature, max_tokens });
            responsePayload.rephrased = true;
            responsePayload.previousSimilarity = maxSim;
            responsePayload.content = paraphrased;
          }
        }
      } catch (err) {
        console.error('Novelty check failed:', err);
        // Non-fatal: do not block generation, just continue
        responsePayload.noveltyCheckError = String(err.message || err);
      }
    }

    res.json(responsePayload);
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
    const { prompt, model = OPENAI_MODEL, temperature = 0.7, max_tokens = 2048 } = req.body;
    
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