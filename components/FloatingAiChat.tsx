import React, { useState, useRef, useEffect } from 'react';
import { LoadingSpinner } from './icons/LoadingSpinner';
import { geminiService, isAiEnabled } from '../services/geminiService';
import Papa from 'papaparse';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface FloatingAiChatProps {
    data: any[];
    isDataLoaded: boolean;
}

const TableRenderer: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) return null;

    const headers = Object.keys(data[0]);
    
    return (
        <div className="overflow-x-auto mt-4 rounded-lg border border-gray-600">
            <table className="min-w-full divide-y divide-gray-600">
                <thead className="bg-gray-800">
                    <tr>
                        {headers.map((header) => (
                            <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-gray-700 divide-y divide-gray-600">
                    {data.slice(0, 10).map((row, index) => (
                        <tr key={index} className="hover:bg-gray-600">
                            {headers.map((header) => (
                                <td key={header} className="px-4 py-3 whitespace-nowrap text-sm text-gray-200">
                                    {row[header]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length > 10 && (
                <div className="bg-gray-800 px-4 py-2 text-center text-xs text-gray-400">
                    Showing 10 of {data.length} rows
                </div>
            )}
        </div>
    );
};

export const FloatingAiChat: React.FC<FloatingAiChatProps> = ({ data, isDataLoaded }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [aiReady] = useState(isAiEnabled());
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const formatMessage = (content: string) => {
        // Check if the content looks like a table (contains CSV-like data)
        if (content.includes('|') && content.includes('-') && content.split('\n').length > 3) {
            try {
                // Parse table format
                const lines = content.split('\n').filter(line => line.trim() && !line.includes('---'));
                if (lines.length > 1) {
                    const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
                    const rows = lines.slice(1).map(line => {
                        const values = line.split('|').map(v => v.trim()).filter(v => v);
                        const row: any = {};
                        headers.forEach((header, index) => {
                            row[header] = values[index] || '';
                        });
                        return row;
                    }).filter(row => Object.values(row).some(v => v));

                    if (rows.length > 0) {
                        return (
                            <div>
                                <p className="mb-4">{content.split('\n')[0]}</p>
                                <TableRenderer data={rows} />
                            </div>
                        );
                    }
                }
            } catch (error) {
                // Fall back to regular text formatting
            }
        }

        // Regular text formatting with line breaks
        return content.split('\n').map((line, index) => (
            <React.Fragment key={index}>
                {line}
                {index < content.split('\n').length - 1 && <br />}
            </React.Fragment>
        ));
    };

    const handleSubmit = async () => {
        if (!query.trim() || !isDataLoaded || isLoading) return;

        const userMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setQuery('');
        setIsLoading(true);

        try {
            const response = await geminiService.analyzeData(data, query);
            const assistantMessage: Message = { role: 'assistant', content: response };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error getting AI response:', error);
            const errorMessage: Message = { 
                role: 'assistant', 
                content: 'Sorry, I encountered an error while processing your request. Please try again.' 
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Runtime API key entry removed; relies on build-time env now.

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fiq-chat-button"
                    title="Open AI Assistant"
                >
                    <img 
                        src="/images/FIQ-logo.webp" 
                        alt="FIQ AI" 
                        className="w-8 h-8 object-contain transition-transform group-hover:scale-110"
                    />
                </button>
            )}

            {/* Enhanced Chat Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div 
                        className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    <div className="relative fiq-chat-modal w-full max-w-7xl h-[95vh] flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden z-10">
                        {/* Premium Header */}
                        <div className="fiq-chat-header flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="fiq-chat-logo-container flex-shrink-0">
                                    <img 
                                        src="/images/FIQ-logo.webp" 
                                        alt="FIQ Logo" 
                                        className="w-10 h-10 object-contain"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="fiq-chat-title">Welcome to FIQ AI</h1>
                                    <p className="fiq-chat-subtitle">
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

                        {/* Content Area */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-6">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center max-w-6xl mx-auto">
                                    {/* Feature Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 w-full">
                                        <div className="fiq-feature-card"
                                             onClick={() => setQuery("Analyze the actual sales and order data from the uploaded dataset. Create a comprehensive sales performance table showing specific products, order values, quantities, and performance metrics from the real data.")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Sales Analytics</h3>
                                                <p className="text-white text-opacity-80 text-sm leading-relaxed">Generate detailed sales performance reports and insights</p>
                                            </div>
                                        </div>

                                        <div className="fiq-feature-card teal"
                                             onClick={() => setQuery("Analyze warehouse and inventory performance from the uploaded data. Show specific warehouse locations, inventory levels, capacity utilization, and efficiency metrics using the actual data from the dataset.")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Warehouse Optimization</h3>
                                                <p className="text-white text-opacity-80 text-sm leading-relaxed">Analyze warehouse efficiency and capacity utilization</p>
                                            </div>
                                        </div>

                                        <div className="fiq-feature-card red"
                                             onClick={() => setQuery("Analyze the actual supply chain data to identify products, orders, or items that are at risk (delayed, cancelled, backordered, etc.). Create a detailed action plan table with specific products from the dataset, their current status, risk levels, and recommended actions. Use the real data from the uploaded dataset.")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Risk Analysis</h3>
                                                <p className="text-white text-opacity-80 text-sm leading-relaxed">Identify supply chain risks and mitigation strategies</p>
                                            </div>
                                        </div>

                                        <div className="fiq-feature-card dark"
                                             onClick={() => setQuery("Generate a detailed delivery performance analysis using the actual data. Include regional breakdown, on-time delivery rates, shipping performance, and delivery trends based on the uploaded dataset.")}>
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-2 text-lg">Performance Insights</h3>
                                                <p className="text-white text-opacity-80 text-sm leading-relaxed">Real-time performance metrics and KPI tracking</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Welcome Message */}
                                                                        <div className="text-center mb-6">
                                        <h2 className="text-3xl font-bold text-white mb-4">How can I help you today?</h2>
                                        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                                            {isDataLoaded ? 
                                                "I'm ready to analyze your supply chain data. Ask me anything or use the quick actions above." : 
                                                "Upload your supply chain data to get started with AI-powered analytics and insights."
                                            }
                                        </p>
                                    </div>

                                                                                                                                                {/* AI disabled banner removed to avoid UX annoyance */}

                                    {/* Quick Suggestions */}
                                    {isDataLoaded && (
                                        <div className="flex flex-wrap gap-3 justify-center">
                                            {[
                                                { emoji: '📈', text: 'Key trends', query: 'What are the key trends and patterns in my actual supply chain data? Show specific numbers and insights.' },
                                                { emoji: '🏆', text: 'Top performers', query: 'Show me the top performing products, customers, or regions from my actual dataset with specific metrics.' },
                                                { emoji: '🔍', text: 'Bottlenecks', query: 'Analyze my actual data to identify supply chain bottlenecks, delays, and problem areas with specific examples.' },
                                                { emoji: '📊', text: 'Summary report', query: 'Create a comprehensive summary report of my supply chain data with key metrics, insights, and recommendations based on the actual data.' }
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
                            
                            {/* Conversation Display */}
                            {messages.length > 0 && (
                                <div className="space-y-6">
                                    {messages.map((message, index) => (
                                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`flex items-start gap-3 max-w-4xl ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                                {/* Avatar */}
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                    message.role === 'user' 
                                                        ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                                                        : 'bg-gradient-to-br from-gray-700 to-gray-600'
                                                }`}>
                                                    {message.role === 'user' ? (
                                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                        </svg>
                                                    )}
                                                </div>

                                                {/* Message Content */}
                                                <div className={`rounded-2xl px-6 py-4 shadow-lg ${
                                                    message.role === 'user' 
                                                        ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white' 
                                                        : 'bg-gray-700 text-gray-100 border border-gray-600'
                                                }`}>
                                                    <div className="prose prose-sm max-w-none prose-invert">
                                                        {formatMessage(message.content)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="flex items-start gap-3 max-w-4xl">
                                                <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <LoadingSpinner />
                                                </div>
                                                <div className="bg-gray-700 rounded-2xl px-6 py-4 shadow-lg border border-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <LoadingSpinner />
                                                        <span className="text-gray-300 text-sm">AI is thinking...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input Section */}
                        <div className="border-t border-gray-700 p-6 bg-gradient-to-r from-gray-900 to-gray-800 flex-shrink-0">
                            <div className="flex gap-4 max-w-6xl mx-auto">
                                <div className="flex-1 relative">
                                    <textarea
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSubmit();
                                            }
                                        }}
                                        placeholder={isDataLoaded ? "Ask me anything about your supply chain data..." : "Upload data first to start analyzing..."}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-2xl px-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[60px] max-h-32"
                                        disabled={!isDataLoaded || isLoading}
                                        rows={1}
                                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4B5563 #374151' }}
                                    />
                                    <div className="absolute right-3 bottom-3 flex items-center gap-2">
                                        {query.trim() && (
                                            <span className="text-xs text-gray-400">
                                                {query.length}/1000
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!query.trim() || !isDataLoaded || isLoading}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-8 py-4 rounded-2xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
                                >
                                    {isLoading ? (
                                        <LoadingSpinner />
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    )}
                                    Send
                                </button>
                            </div>

                            {/* Quick Actions */}
                            {!isDataLoaded && (
                                <div className="mt-4 text-center">
                                    <p className="text-gray-400 text-sm mb-3">Quick actions to get started:</p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full text-sm transition-colors border border-gray-600">
                                            📁 Upload CSV Data
                                        </button>
                                        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full text-sm transition-colors border border-gray-600">
                                            📊 View Sample Data
                                        </button>
                                        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full text-sm transition-colors border border-gray-600">
                                            💡 Learn About AI Features
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};