require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Personnalise ici le comportement de ton IA
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  "Tu es un assistant IA utile, clair et concis. Réponds en français sauf si l'utilisateur écrit dans une autre langue.";

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Petite protection anti-abus très basique (limite de requêtes par IP)
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReq = 20;
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  if (entry.count > maxReq) {
    return res.status(429).json({ error: 'Trop de requêtes, réessaie dans une minute.' });
  }
  next();
}

app.post('/api/chat', rateLimit, async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "Clé API manquante côté serveur (GROQ_API_KEY)." });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Le champ "messages" est requis.' });
  }

  // On ne garde que role/content, et on limite l'historique envoyé
  const cleanMessages = messages
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...cleanMessages],
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      res.write(`event: error\ndata: ${JSON.stringify({ error: errText || 'Erreur API Groq' })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // garde la ligne incomplète pour le prochain tour

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        try {
          const evt = JSON.parse(dataStr);
          const textChunk = evt.choices?.[0]?.delta?.content;
          if (textChunk) {
            res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
          }
          if (evt.choices?.[0]?.finish_reason) {
            res.write('event: done\ndata: {}\n\n');
          }
        } catch (_) {
          // ligne SSE non-JSON, on ignore
        }
      }
    }

    res.end();
  } catch (err) {
    console.error(err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Erreur serveur.' })}\n\n`);
    res.end();
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
