
import React, { useState } from 'react';
import type { DataRow } from '../types';
import { callGeminiApi } from '../services/geminiService';
import Papa from 'papaparse';
import { LoadingSpinner } from './icons/LoadingSpinner';

interface AiAnalystProps {
    data: DataRow[];
    isDataLoaded: boolean;
}

export const AiAnalyst: React.FC<AiAnalystProps> = ({ data, isDataLoaded }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleQuery = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setResponse('');

        const dataSample = data.slice(0, 100);
        const dataString = Papa.unparse(dataSample.map(d => ({
            ...d,
            order_date: d.order_date?.toISOString().split('T')[0],
            ship_date: d.ship_date?.toISOString().split('T')[0],
            delivery_date: d.delivery_date?.toISOString().split('T')[0],
            required_shipping_date: d.required_shipping_date?.toISOString().split('T')[0],
        })));

        const systemPrompt = `You are FIQ's AI Supply Chain Analyst. Your role is to answer questions based on a provided CSV data sample. Be concise, insightful, and present your findings clearly. If the data doesn't contain the answer, state that clearly. The data contains records with a 'type' column, which can be 'order', 'shipment', or 'inventory'.`;
        const userQuery = `Based on the following supply chain data, please answer this question: "${query}"\n\nCSV Data:\n${dataString}`;

        const result = await callGeminiApi(systemPrompt, userQuery);
        setResponse(result);
        setIsLoading(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3">Ask Your Data (AI Analyst)</h2>
            <div className="flex flex-col md:flex-row gap-4">
                <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && isDataLoaded && !isLoading && handleQuery()}
                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" 
                    placeholder={isDataLoaded ? "e.g., 'Which products are at risk of stockout?'" : "Upload data to ask questions"}
                    disabled={!isDataLoaded || isLoading}
                />
                <button 
                    onClick={handleQuery}
                    className="bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-indigo-300 disabled:cursor-not-allowed" 
                    disabled={!isDataLoaded || isLoading}
                >
                    {isLoading ? 'Thinking...' : 'Ask AI'}
                </button>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg min-h-[80px] flex items-center justify-center">
                {isLoading ? (
                    <LoadingSpinner className="h-8 w-8 border-indigo-600" />
                ) : (
                    <p className={`text-gray-600 ${response ? 'text-left' : 'text-center'}`} dangerouslySetInnerHTML={{ __html: response ? response.replace(/\n/g, '<br />') : 'AI insights will appear here.' }} />
                )}
            </div>
        </div>
    );
};
