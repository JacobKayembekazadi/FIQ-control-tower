import React, { useState, useRef, useEffect } from 'react';
import type { DataRow } from '../types';
import { callGeminiApi } from '../services/geminiService';
import Papa from 'papaparse';
import { LoadingSpinner } from './icons/LoadingSpinner';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    data?: any; // For structured data like tables
    type?: 'text' | 'table' | 'chart' | 'code';
}

interface FloatingAiChatProps {
    data: DataRow[];
    isDataLoaded: boolean;
}

export const FloatingAiChat: React.FC<FloatingAiChatProps> = ({ data, isDataLoaded }) => {
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Parse AI response for tables and structured data
    const parseAiResponse = (response: string) => {
        // Check if response contains table data
        const tableMatch = response.match(/\|(.+)\|/g);
        if (tableMatch && tableMatch.length > 1) {
            // Extract table data
            const rows = tableMatch.map(row => 
                row.split('|').map(cell => cell.trim()).filter(cell => cell)
            );
            
            if (rows.length > 0) {
                const headers = rows[0];
                const data = rows.slice(1).filter(row => 
                    !row.every(cell => cell.includes('-')) // Skip separator rows
                );
                
                return {
                    type: 'table' as const,
                    text: response.replace(/\|(.+)\|/g, '').trim(),
                    data: { headers, rows: data }
                };
            }
        }
        
        // Check for JSON data
        try {
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                const jsonData = JSON.parse(jsonMatch[1]);
                return {
                    type: 'table' as const,
                    text: response.replace(/```json\n([\s\S]*?)\n```/, '').trim(),
                    data: jsonData
                };
            }
        } catch (e) {
            // Not valid JSON, continue
        }
        
        return {
            type: 'text' as const,
            text: response,
            data: null
        };
    };

    const handleQuery = async () => {
        if (!query.trim()) return;
        
        const userMessage: Message = {
            id: Date.now().toString(),
            text: query.trim(),
            isUser: true,
            timestamp: new Date(),
            type: 'text'
        };

        setMessages(prev => [...prev, userMessage]);
        setQuery('');
        setIsLoading(true);

        const dataSample = data.slice(0, 200); // Increased sample size
        const dataString = Papa.unparse(dataSample.map(d => ({
            ...d,
            order_date: d.order_date?.toISOString().split('T')[0],
            ship_date: d.ship_date?.toISOString().split('T')[0],
            delivery_date: d.delivery_date?.toISOString().split('T')[0],
            required_shipping_date: d.required_shipping_date?.toISOString().split('T')[0],
        })));

        // Build conversation context
        const conversationHistory = messages.slice(-6).map(msg => 
            `${msg.isUser ? 'User' : 'AI'}: ${msg.text}`
        ).join('\n');

        const systemPrompt = `You are FIQ's AI Supply Chain Analyst. Your role is to answer questions based on a provided CSV data sample and maintain context from previous questions in the conversation. 

IMPORTANT: When users ask for tables, lists, or structured data:
- Format your response with proper markdown tables using | symbols
- For example: | Header1 | Header2 | Header3 |
- Always include headers and data rows
- Use clear, descriptive column names
- Sort data meaningfully (by value, date, etc.)
- Limit tables to 10-15 rows for readability
- If you have calculations or summaries, present them in table format when possible

Be concise, insightful, and present your findings clearly. If the data doesn't contain the answer, state that clearly. The data contains records with a 'type' column, which can be 'order', 'shipment', or 'inventory'.

Previous conversation context:
${conversationHistory}`;

        const userQuery = `Based on the following supply chain data, please answer this question: "${userMessage.text}"\n\nCSV Data:\n${dataString}`;

        try {
            const result = await callGeminiApi(systemPrompt, userQuery);
            const parsedResponse = parseAiResponse(result);
            
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: parsedResponse.text,
                isUser: false,
                timestamp: new Date(),
                type: parsedResponse.type,
                data: parsedResponse.data
            };
            setMessages(prev => [...prev, aiMessage]);
            
            // Show notification if chat is closed
            if (!isOpen) {
                setHasNewMessage(true);
            }
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I encountered an error while processing your request. Please try again.",
                isUser: false,
                timestamp: new Date(),
                type: 'text'
            };
            setMessages(prev => [...prev, errorMessage]);
        }
        
        setIsLoading(false);
    };

    const clearChat = () => {
        setMessages([]);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const openChat = () => {
        setIsOpen(true);
        setHasNewMessage(false);
    };

    // Render table component
    const TableRenderer: React.FC<{ data: any }> = ({ data }) => {
        if (!data || !data.headers || !data.rows) return null;
        
        return (
            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                        <tr>
                            {data.headers.map((header: string, index: number) => (
                                <th key={index} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.map((row: string[], rowIndex: number) => (
                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {row.map((cell: string, cellIndex: number) => (
                                    <td key={cellIndex} className="px-3 py-2 text-gray-800 border-b">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <>
            {/* Floating Chat Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={openChat}
                    disabled={!isDataLoaded}
                    className={`
                        relative bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg 
                        transition-all duration-300 hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed
                        ${isOpen ? 'scale-0' : 'scale-100'}
                    `}
                >
                    {/* Chat Icon */}
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    
                    {/* Notification Badge */}
                    {hasNewMessage && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                            !
                        </div>
                    )}
                    
                    {/* Message Count Badge */}
                    {messages.length > 0 && !hasNewMessage && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {messages.length > 9 ? '9+' : messages.length}
                        </div>
                    )}
                </button>
            </div>

            {/* Chat Modal - Much Larger Canvas */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black bg-opacity-50"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Chat Window - Larger Canvas */}
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Chat Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                    🤖
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">AI Data Analytics Workspace</h3>
                                    <p className="text-sm text-indigo-100">
                                        {isDataLoaded ? 'Ready to analyze your data' : 'Waiting for data upload'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {messages.length > 0 && (
                                    <button
                                        onClick={clearChat}
                                        className="text-indigo-200 hover:text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                                        title="Clear chat"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-indigo-200 hover:text-white px-3 py-1 rounded flex items-center gap-1"
                                    title="Close workspace"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Chat Messages - Larger Canvas */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                            {messages.length === 0 && (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center max-w-2xl">
                                        <div className="text-6xl mb-6">�</div>
                                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">AI Data Analytics Workspace</h2>
                                        <p className="text-gray-600 mb-6 text-lg">
                                            {isDataLoaded ? 
                                                "Ask me anything about your supply chain data. I can create tables, analyze trends, and provide insights!" : 
                                                "Upload some data first, then I can help you analyze it with tables, charts, and insights!"
                                            }
                                        </p>
                                        {isDataLoaded && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                                                <button
                                                    onClick={() => setQuery("Create a table showing top 10 products by sales volume")}
                                                    className="p-4 bg-white hover:bg-gray-50 rounded-lg shadow-sm text-left border-l-4 border-blue-500"
                                                >
                                                    <div className="font-medium text-gray-800">📈 Sales Analysis</div>
                                                    <div className="text-sm text-gray-600 mt-1">"Top 10 products by sales volume"</div>
                                                </button>
                                                <button
                                                    onClick={() => setQuery("Give me a table of warehouse performance metrics")}
                                                    className="p-4 bg-white hover:bg-gray-50 rounded-lg shadow-sm text-left border-l-4 border-green-500"
                                                >
                                                    <div className="font-medium text-gray-800">🏪 Warehouse Performance</div>
                                                    <div className="text-sm text-gray-600 mt-1">"Warehouse performance metrics table"</div>
                                                </button>
                                                <button
                                                    onClick={() => setQuery("Show me products at risk of stockout in a table format")}
                                                    className="p-4 bg-white hover:bg-gray-50 rounded-lg shadow-sm text-left border-l-4 border-red-500"
                                                >
                                                    <div className="font-medium text-gray-800">⚠️ Risk Analysis</div>
                                                    <div className="text-sm text-gray-600 mt-1">"Products at risk of stockout"</div>
                                                </button>
                                                <button
                                                    onClick={() => setQuery("Create a summary table of delivery performance by region")}
                                                    className="p-4 bg-white hover:bg-gray-50 rounded-lg shadow-sm text-left border-l-4 border-purple-500"
                                                >
                                                    <div className="font-medium text-gray-800">🚚 Delivery Insights</div>
                                                    <div className="text-sm text-gray-600 mt-1">"Delivery performance by region"</div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {messages.map((message) => (
                                <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] rounded-lg p-4 ${
                                        message.isUser 
                                            ? 'bg-indigo-600 text-white' 
                                            : 'bg-white text-gray-800 shadow-sm border'
                                    }`}>
                                        <p className="whitespace-pre-wrap mb-2">{message.text}</p>
                                        
                                        {/* Render table if present */}
                                        {message.type === 'table' && message.data && (
                                            <TableRenderer data={message.data} />
                                        )}
                                        
                                        <p className={`text-xs mt-2 ${
                                            message.isUser ? 'text-indigo-200' : 'text-gray-500'
                                        }`}>
                                            {formatTime(message.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white text-gray-800 rounded-lg p-4 flex items-center gap-3 shadow-sm border">
                                        <LoadingSpinner className="h-5 w-5 border-gray-600" />
                                        <span>Analyzing data and preparing results...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input - Enhanced */}
                        <div className="border-t border-gray-200 p-6 bg-white rounded-b-xl">
                            <div className="flex gap-4">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && isDataLoaded && !isLoading && handleQuery()}
                                    className="flex-1 p-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                                    placeholder={isDataLoaded ? "Ask for tables, analysis, insights... e.g., 'Show me top products in warehouse B as a table'" : "Upload data first to start analyzing"}
                                    disabled={!isDataLoaded || isLoading}
                                />
                                <button
                                    onClick={handleQuery}
                                    className="bg-indigo-600 text-white px-6 py-4 rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-indigo-300 disabled:cursor-not-allowed font-medium"
                                    disabled={!isDataLoaded || isLoading || !query.trim()}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                            <div className="mt-3 text-xs text-gray-500">
                                💡 Try: "Create a table of...", "Show me top 10...", "Analyze trends for...", "Compare performance between..."
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};