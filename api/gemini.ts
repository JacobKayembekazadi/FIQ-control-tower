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
    return res.status(500).json({ error: 'Server Gemini API key not configured' });
  }

  try {
    const { systemInstruction, userContent } = req.body || {};
    if (!userContent || typeof userContent !== 'string') {
      return res.status(400).json({ error: 'Missing userContent string in body' });
    }

    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    // Build request body following Gemini REST spec
    const body: any = {
      contents: [
        ...(systemInstruction ? [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTION:\n${systemInstruction}` }] }] : []),
        { role: 'user', parts: [{ text: userContent }] }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini upstream error ${response.status}: ${errText}` });
    }

    const json: any = await response.json();
    // Attempt to extract text segments
    let fullText = '';
    try {
      const candidates = json.candidates || [];
      for (const c of candidates) {
        const parts = c.content?.parts || [];
        for (const p of parts) if (p.text) fullText += p.text + '\n';
        if (fullText) break; // take first candidate with text
      }
      fullText = fullText.trim();
    } catch (e) {
      // ignore, will fallback below
    }

    if (!fullText) {
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    return res.status(200).json({ text: fullText });
  } catch (error: any) {
    console.error('Gemini proxy failure', error);
    return res.status(500).json({ error: 'Internal server error contacting Gemini' });
  }
}
