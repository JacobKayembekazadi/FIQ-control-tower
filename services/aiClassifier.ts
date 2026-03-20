import { GoogleGenAI } from '@google/genai';
import type { AirtableTable } from './airtableService';

export interface ClassificationResult {
  tableName: string;
  confidence: number;
  reasoning: string;
  fieldMapping: Record<string, string>; // CSV header -> Airtable field name
}

function getGeminiKey(): string {
  const env = (import.meta as any).env ?? {};
  return env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '';
}

/**
 * Uses Gemini to classify a CSV upload and determine which Airtable table it belongs to.
 * Falls back to keyword matching if AI is unavailable or returns an unexpected response.
 */
export async function classifyCSV(
  headers: string[],
  sampleRows: Record<string, string>[],
  availableTables: AirtableTable[],
): Promise<ClassificationResult> {
  const tableNames = availableTables.map((t) => t.name).join(', ');
  const sample = JSON.stringify(sampleRows.slice(0, 3), null, 2);

  const prompt = `You are an AI layer in a supply chain management system. A user has uploaded a CSV file and you need to route it to the correct Airtable table.

Available tables in this base: ${tableNames}

CSV column headers: ${headers.join(', ')}

Sample rows (first 3):
${sample}

Analyze the CSV structure and determine:
1. Which table this data belongs to (use the exact name from the available tables list)
2. Your confidence score from 0.0 to 1.0
3. Brief reasoning (1-2 sentences)
4. A field mapping from each CSV column to the corresponding Airtable field name

Standard Airtable field names to map to: type, id, product_name, quantity, status, order_date, ship_date, delivery_date, required_shipping_date, location

Respond ONLY with valid JSON matching this exact structure:
{
  "tableName": "<exact table name>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<1-2 sentences explaining your decision>",
  "fieldMapping": { "<csv_column>": "<airtable_field>" }
}`;

  const apiKey = getGeminiKey();

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = (response.text ?? '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ClassificationResult;
        // Validate the returned tableName against what's actually available
        const validName = availableTables.find((t) => t.name === parsed.tableName)?.name;
        if (validName) {
          return { ...parsed, tableName: validName };
        }
      }
    } catch {
      // Fall through to keyword matching
    }
  }

  // ── Keyword fallback ────────────────────────────────────────────────────────
  const headerStr = headers.join(' ').toLowerCase();
  let matchedTable = availableTables[0]?.name ?? 'Orders';

  if (/ship|freight|carrier|tracking|courier/.test(headerStr)) {
    const t = availableTables.find((t) => /shipment/i.test(t.name));
    if (t) matchedTable = t.name;
  } else if (/inventory|stock|sku|warehouse|on.hand|available/.test(headerStr)) {
    const t = availableTables.find((t) => /inventor/i.test(t.name));
    if (t) matchedTable = t.name;
  } else {
    const t = availableTables.find((t) => /order/i.test(t.name));
    if (t) matchedTable = t.name;
  }

  // Best-effort field mapping by name similarity
  const knownFields = [
    'type', 'id', 'product_name', 'quantity', 'status',
    'order_date', 'ship_date', 'delivery_date', 'required_shipping_date', 'location',
  ];
  const fieldMapping: Record<string, string> = {};
  for (const col of headers) {
    const normalized = col.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const match = knownFields.find(
      (f) => f === normalized || normalized.includes(f.replace(/_/g, '')),
    );
    fieldMapping[col] = match ?? normalized;
  }

  return {
    tableName: matchedTable,
    confidence: 0.55,
    reasoning: 'Gemini unavailable — used column header keyword matching as fallback.',
    fieldMapping,
  };
}
