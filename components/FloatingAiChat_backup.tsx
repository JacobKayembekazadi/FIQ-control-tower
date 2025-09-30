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
    data?: any;
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
        const tableMatch = response.match(/\|(.+)\|/g);
        if (tableMatch && tableMatch.length > 1) {
            const rows = tableMatch.map(row => 
                row.split('|').map(cell => cell.trim()).filter(cell => cell)
            );
            
            if (rows.length > 0) {
                const headers = rows[0];
                const data = rows.slice(1).filter(row => 
                    !row.every(cell => cell.includes('-'))
                );
                
                return {
                    type: 'table' as const,
                    text: response.replace(/\|(.+)\|/g, '').trim(),
                    data: { headers, rows: data }
                };
            }
        }
        
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

        const dataSample = data.slice(0, 200);
        const dataString = Papa.unparse(dataSample.map(d => ({
            ...d,
            order_date: d.order_date?.toISOString().split('T')[0],
            ship_date: d.ship_date?.toISOString().split('T')[0],
            delivery_date: d.delivery_date?.toISOString().split('T')[0],
            required_shipping_date: d.required_shipping_date?.toISOString().split('T')[0],
        })));

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

    // Enhanced Table Renderer
    const TableRenderer: React.FC<{ data: any }> = ({ data }) => {
        if (!data || !data.headers || !data.rows) return null;
        
        return (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-600">
                <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-700 to-gray-600">
                        <tr>
                            {data.headers.map((header: string, index: number) => (
                                <th key={index} className="px-4 py-3 text-left font-semibold text-gray-100 first:rounded-tl-xl last:rounded-tr-xl">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.map((row: string[], rowIndex: number) => (
                            <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'} hover:bg-gray-700 transition-colors`}>
                                {row.map((cell: string, cellIndex: number) => (
                                    <td key={cellIndex} className="px-4 py-3 text-gray-200 border-t border-gray-700">
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
            {/* Floating Chat Button - Enhanced */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={openChat}
                    disabled={!isDataLoaded}
                    className={`
                        relative bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                        text-white p-4 rounded-2xl shadow-xl transition-all duration-300 hover:scale-110 
                        disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm
                        ${isOpen ? 'scale-0' : 'scale-100'}
                    `}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    
                    {hasNewMessage && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                            !
                        </div>
                    )}
                    
                    {messages.length > 0 && !hasNewMessage && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {messages.length > 9 ? '9+' : messages.length}
                        </div>
                    )}
                </button>
            </div>

            {/* Enhanced Chat Modal - Fixed Layout */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div 
                        className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col animate-in zoom-in-95 duration-300 border border-gray-700 overflow-hidden">
                        {/* Premium Header - Fixed */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-bold text-white mb-1">Welcome to FIQ AI</h1>
                                    <p className="text-gray-400 text-sm">
                                        {isDataLoaded ? 'Advanced supply chain analytics with AI-powered insights' : 'Upload your data to unlock AI-powered analytics'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {messages.length > 0 && (
                                    <button
                                        onClick={clearChat}
                                        className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors"
                                        title="Clear conversation"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-gray-400 hover:text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors"
                                    title="Close workspace"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Content Area - Fixed Flex */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-6">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center max-w-6xl mx-auto">
                                    {/* Feature Cards - Fixed Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 w-full">
                                        <div className="group bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl min-h-[180px] flex flex-col"
                                             onClick={() => setQuery("Create a comprehensive sales performance table")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Sales Analytics</h3>
                                                <p className="text-blue-100 text-sm leading-relaxed">Generate detailed sales performance reports and insights</p>
                                            </div>
                                        </div>

                                        <div className="group bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl min-h-[180px] flex flex-col"
                                             onClick={() => setQuery("Show me warehouse performance metrics in a detailed table")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Warehouse Optimization</h3>
                                                <p className="text-purple-100 text-sm leading-relaxed">Analyze warehouse efficiency and capacity utilization</p>
                                            </div>
                                        </div>

                                        <div className="group bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl min-h-[180px] flex flex-col"
                                             onClick={() => setQuery("Identify products at risk and create action plan table")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Risk Analysis</h3>
                                                <p className="text-green-100 text-sm leading-relaxed">Identify supply chain risks and mitigation strategies</p>
                                            </div>
                                        </div>

                                        <div className="group bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl min-h-[180px] flex flex-col"
                                             onClick={() => setQuery("Generate delivery performance summary with regional breakdown")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Performance Insights</h3>
                                                <p className="text-orange-100 text-sm leading-relaxed">Real-time performance metrics and KPI tracking</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Welcome Message - Fixed */}
                                    <div className="text-center mb-6">
                                        <h2 className="text-3xl font-bold text-white mb-4">How can I help you today?</h2>
                                        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                                            {isDataLoaded ? 
                                                "I'm ready to analyze your supply chain data. Ask me anything or use the quick actions above." : 
                                                "Upload your supply chain data to get started with AI-powered analytics and insights."
                                            }
                                        </p>
                                    </div>

                                    {/* Quick Suggestions - Fixed */}
                                    {isDataLoaded && (
                                        <div className="flex flex-wrap gap-3 justify-center">
                                            {[
                                                { emoji: '📈', text: 'Key trends', query: 'What are the key trends in my data?' },
                                                { emoji: '🏆', text: 'Top performers', query: 'Show me top performing products' },
                                                { emoji: '🔍', text: 'Bottlenecks', query: 'Analyze supply chain bottlenecks' },
                                                { emoji: '📊', text: 'Summary report', query: 'Create a comprehensive summary report' }
                                            ].map((suggestion, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setQuery(suggestion.query)}
                                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full text-sm transition-all duration-200 border border-gray-600 hover:border-gray-500 hover:shadow-lg"
                                                >
                                                    <span className="mr-2">{suggestion.emoji}</span>
                                                    {suggestion.text}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Messages */}
                            {messages.map((message) => (
                                <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-6 ${
                                        message.isUser 
                                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg' 
                                            : 'bg-gray-800 text-gray-100 shadow-lg border border-gray-700'
                                    }`}>
                                        <p className="whitespace-pre-wrap mb-3 leading-relaxed">{message.text}</p>
                                        
                                        {message.type === 'table' && message.data && (
                                            <TableRenderer data={message.data} />
                                        )}
                                        
                                        <p className={`text-xs mt-3 ${
                                            message.isUser ? 'text-blue-200' : 'text-gray-500'
                                        }`}>
                                            {formatTime(message.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800 text-gray-100 rounded-2xl p-6 flex items-center gap-4 shadow-lg border border-gray-700">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                        </div>
                                        <span className="text-gray-300">Analyzing your data...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Enhanced Input Area */}
                        <div className="border-t border-gray-700 p-6 bg-gradient-to-r from-gray-800 to-gray-900">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && isDataLoaded && !isLoading && handleQuery()}
                                        className="w-full p-4 bg-gray-700 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-800 text-white placeholder-gray-400 text-base transition-all"
                                        placeholder={isDataLoaded ? "Ask me anything about your supply chain data..." : "Upload data to start analyzing"}
                                        disabled={!isDataLoaded || isLoading}
                                    />
                                </div>
                                <button
                                    onClick={handleQuery}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl"
                                    disabled={!isDataLoaded || isLoading || !query.trim()}
                                    title="Send message"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Try: "Create a table of...", "Analyze performance for...", "Show me trends in...", "Compare metrics between..."
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};