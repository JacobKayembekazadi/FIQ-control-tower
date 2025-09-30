
import { GoogleGenAI } from "@google/genai";
import { processDataForDashboard } from "../utils/dataProcessor";

// --- API KEY HANDLING -------------------------------------------------------
// We support three sources (in priority order):
// 1. Runtime override stored in localStorage (user-entered in UI)
// 2. Vite-exposed environment variable (build time) VITE_GEMINI_API_KEY
// 3. Legacy process.env / window shim (development fallbacks)

const LOCAL_STORAGE_KEY = 'fiq_gemini_api_key';

function readLocalStorageKey(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

let runtimeApiKey: string | null = readLocalStorageKey();

const buildTimeKey = (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (globalThis as any).process?.env?.VITE_GEMINI_API_KEY ||
  (globalThis as any).process?.env?.GEMINI_API_KEY ||
  (window as any).VITE_GEMINI_API_KEY;

function resolveApiKey(): string | null {
  return runtimeApiKey || buildTimeKey || null;
}

let ai: GoogleGenAI | null = null;

function initClient() {
  const key = resolveApiKey();
  if (!key) {
    ai = null;
    return;
  }
  try {
    ai = new GoogleGenAI({ apiKey: key });
  } catch (err) {
    console.error('Failed to initialize Google GenAI client', err);
    ai = null;
  }
}

initClient();

export function isAiEnabled(): boolean {
  return !!ai && !!resolveApiKey();
}

export function getActiveApiKeySource(): 'runtime' | 'build' | 'none' {
  if (runtimeApiKey) return 'runtime';
  if (buildTimeKey) return 'build';
  return 'none';
}

export function setRuntimeApiKey(key: string): { success: boolean; message: string } {
  if (!key || key.trim().length < 10) {
    return { success: false, message: 'API key appears invalid (too short).' };
  }
  try {
    runtimeApiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, runtimeApiKey);
    }
    initClient();
    if (!ai) {
      return { success: false, message: 'Failed to initialize AI client with provided key.' };
    }
    return { success: true, message: 'API key saved for this browser.' };
  } catch (e) {
    console.error('Failed to set runtime API key', e);
    return { success: false, message: 'Unexpected error storing key.' };
  }
}

export function clearRuntimeApiKey() {
  runtimeApiKey = null;
  try { if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
  initClient();
}

export const callGeminiApi = async (systemInstruction: string, userQuery: string): Promise<string> => {
  if (!isAiEnabled()) {
    return Promise.resolve("AI functionality is disabled. API key is missing or invalid.");
  }
  
  try {
    const response = await ai!.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION:\n${systemInstruction}` }] },
        { role: 'user', parts: [{ text: userQuery }] }
      ]
    });

    const text = response.text;
    if (text) {
      return text;
    } else {
      throw new Error("Invalid API response structure or empty response.");
    }
  } catch (error) {
    console.error("Gemini API call failed:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid') || error.message.includes('API Key must be set')) {
            return "Error: The provided API key is not valid. Please check your configuration.";
        }
    }
    return "An error occurred while communicating with the AI. Please try again later.";
  }
};

// Create geminiService object with analyzeData method expected by FloatingAiChat
export const geminiService = {
  analyzeData: async (data: any[], query: string): Promise<string> => {
    if (!data || data.length === 0) {
      return "No data has been loaded yet. Please upload your supply chain data first to enable AI analysis.";
    }

    try {
      const dataLength = data.length;
      const columns = Object.keys(data[0] || {});

      // Partition by type
      const byType: Record<string, any[]> = {};
      data.forEach(r => {
        const t = r.type || 'unknown';
        (byType[t] = byType[t] || []).push(r);
      });

      // Pull KPI summary (best effort)
      let dashboardSummary: any = {};
      try {
        dashboardSummary = processDataForDashboard(data as any);
      } catch (e) {
        console.warn('processDataForDashboard failed in geminiService', e);
      }

      const orders = byType['order'] || [];
      const statusDistribution: Record<string, number> = {};
      const productQty: Record<string, number> = {};
      const locationCounts: Record<string, number> = {};
      let minOrderDate: number | null = null;
      let maxOrderDate: number | null = null;
      let delayed = 0, cancelled = 0, backordered = 0, deliveredWithDates = 0, onTimeDelivered = 0;

      orders.forEach(o => {
        const s = o.status || 'Unknown';
        statusDistribution[s] = (statusDistribution[s] || 0) + 1;
        if (o.product_name) productQty[o.product_name] = (productQty[o.product_name] || 0) + (Number(o.quantity) || 0);
        if (o.location) locationCounts[o.location] = (locationCounts[o.location] || 0) + 1;
        if (o.order_date instanceof Date) {
          const ts = o.order_date.getTime();
          if (minOrderDate === null || ts < minOrderDate) minOrderDate = ts;
          if (maxOrderDate === null || ts > maxOrderDate) maxOrderDate = ts;
        }
        const sl = String(s).toLowerCase();
        if (sl.includes('delay')) delayed++;
        if (sl.includes('cancel')) cancelled++;
        if (sl.includes('backorder')) backordered++;
        if (sl.includes('delivered') && o.delivery_date && o.required_shipping_date) {
          deliveredWithDates++;
          if (o.delivery_date <= o.required_shipping_date) onTimeDelivered++;
        }
      });

      const topProducts = Object.entries(productQty).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name, qty])=>({name, totalQuantity: qty}));
      const riskSummary = {
        delayed,
        cancelled,
        backordered,
        potentialRiskRate: orders.length ? ((delayed + cancelled + backordered)/orders.length)*100 : 0
      };

      const samplePerType: Record<string, any[]> = {};
      Object.entries(byType).forEach(([t, rows]) => {
        samplePerType[t] = rows.slice(0,5).map(r => {
          const c: any = { ...r };
          ['order_date','ship_date','delivery_date','required_shipping_date'].forEach(k => {
            if (c[k] instanceof Date) c[k] = (c[k] as Date).toISOString().split('T')[0];
          });
          return c;
        });
      });

      const summary = {
        recordCount: dataLength,
        columns,
        types: Object.fromEntries(Object.entries(byType).map(([t, rows]) => [t, rows.length])),
        kpis: dashboardSummary.kpis || null,
        statusDistribution,
        topProducts,
        locationCounts,
        orderDateRange: {
          start: minOrderDate ? new Date(minOrderDate).toISOString().split('T')[0] : null,
          end: maxOrderDate ? new Date(maxOrderDate).toISOString().split('T')[0] : null
        },
        onTimeDeliveryRateFromDelivered: deliveredWithDates ? (onTimeDelivered / deliveredWithDates) * 100 : null,
        riskSummary,
        sampleRecords: samplePerType
      };

      const systemInstruction = `You are FIQ AI. You ALREADY have the dataset summary. Never claim data is missing. Provide quantitative insights, trends, risks, and recommendations strictly from the provided JSON. If something is not present, state that transparently instead of asking for data.`;

      const userPayload = [
        'DATASET_SUMMARY_JSON:',
        '```json',
        JSON.stringify(summary, null, 2),
        '```',
        'USER_REQUEST:',
        query,
        'OUTPUT REQUIREMENTS:',
        '1. Start with 5-10 bullet key insights (quantified).',
        '2. Follow with markdown tables (e.g., Status Distribution, Top Products, Risk Summary) using REAL numbers.',
        '3. Highlight trends (earliest vs latest order_date, fastest vs slowest statuses if inferable).',
        '4. Provide a Risk & Opportunity section with concrete metrics (e.g., Delayed = X orders = Y%).',
        '5. Provide 3-5 actionable recommendations tied to exact metrics.',
        '6. NEVER generic placeholders. NEVER request the raw data again.'
      ].join('\n');

      return callGeminiApi(systemInstruction, userPayload);
    } catch (err) {
      console.error('analyzeData summary build failed', err);
      return 'An internal error occurred while preparing the data summary.';
    }
  }
};
