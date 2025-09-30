
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you'd want to handle this more gracefully.
  // For this environment, we'll log a warning.
  console.warn("Gemini API key not found in environment variables. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const callGeminiApi = async (systemInstruction: string, userQuery: string): Promise<string> => {
  if (!API_KEY) {
    return Promise.resolve("AI functionality is disabled. API key is missing.");
  }
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
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
        if (error.message.includes('API key not valid')) {
            return "Error: The provided API key is not valid. Please check your configuration.";
        }
    }
    return "An error occurred while communicating with the AI. Please try again later.";
  }
};
