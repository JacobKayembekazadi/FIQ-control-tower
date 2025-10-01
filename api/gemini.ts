// Vercel Serverless Function: Gemini Proxy
// Protects the API key by keeping it server-side. Frontend posts prompt + optional systemInstruction.
// Request: POST application/json { systemInstruction?: string, userContent: string }
// Response: { text: string } or { error: string }

import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

// Minimal direct REST call (avoids bundling full client in the function)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    console.error('[gemini proxy] Missing GEMINI_API_KEY environment variable');
    return res.status(401).json({ error: 'Server Gemini API key not configured. Set GEMINI_API_KEY in Vercel project settings.' });
  }

  try {
    const { systemInstruction, userContent, model: requestedModel } = req.body || {};
    if (!userContent || typeof userContent !== 'string') {
      return res.status(400).json({ error: 'Missing userContent string in body' });
    }
    // Prefer explicitly requested model; fallback to a stable known one.
    const primaryModel = requestedModel || 'gemini-1.5-flash';
    const altModel = 'gemini-1.5-pro';

    async function callModel(modelName: string) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
      const body: any = {
        contents: [
          ...(systemInstruction ? [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTION:\n${systemInstruction}` }] }] : []),
          { role: 'user', parts: [{ text: userContent }] }
        ]
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      let raw: any = null;
      try { raw = await response.json(); } catch {
        // attempt to read text if not json
        raw = { nonJson: await response.text() };
      }
      return { response, raw };
    }

    // First attempt
    let { response: r1, raw: raw1 } = await callModel(primaryModel);
    if (!r1.ok && r1.status === 404 && primaryModel !== altModel) {
      console.warn(`[gemini proxy] Model ${primaryModel} 404, retrying with fallback ${altModel}`);
      ({ response: r1, raw: raw1 } = await callModel(altModel));
    }

    if (!r1.ok) {
      console.error('[gemini proxy] Upstream error', r1.status, raw1);
      return res.status(r1.status).json({
        error: 'Gemini upstream error',
        status: r1.status,
        details: raw1
      });
    }

    // Extract text
    let fullText = '';
    try {
      const candidates = raw1.candidates || [];
      for (const c of candidates) {
        const parts = c.content?.parts || [];
        for (const p of parts) if (p.text) fullText += p.text + '\n';
        if (fullText) break;
      }
      fullText = fullText.trim();
    } catch (e) {
      console.warn('[gemini proxy] Failed to parse candidates', e);
    }

    if (!fullText) {
      return res.status(502).json({ error: 'Empty response from Gemini', raw: raw1 });
    }

    return res.status(200).json({ text: fullText, modelUsed: primaryModel });
  } catch (error: any) {
    console.error('Gemini proxy failure', error);
    return res.status(500).json({ error: 'Internal server error contacting Gemini' });
  }
}
