
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
}

interface AiAnalystProps {
    data: DataRow[];
    isDataLoaded: boolean;
}

export const AiAnalyst: React.FC<AiAnalystProps> = ({ data, isDataLoaded }) => {
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    const handleQuery = async () => {
        if (!query.trim()) return;
        
        const userMessage: Message = {
            id: Date.now().toString(),
            text: query.trim(),
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setQuery('');
        setIsLoading(true);

        const dataSample = data.slice(0, 100);
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

        const systemPrompt = `You are FIQ's AI Supply Chain Analyst. Your role is to answer questions based on a provided CSV data sample and maintain context from previous questions in the conversation. Be concise, insightful, and present your findings clearly. If the data doesn't contain the answer, state that clearly. The data contains records with a 'type' column, which can be 'order', 'shipment', or 'inventory'. 

Previous conversation context:
${conversationHistory}`;

        const userQuery = `Based on the following supply chain data, please answer this question: "${userMessage.text}"\n\nCSV Data:\n${dataString}`;

        try {
            const result = await callGeminiApi(systemPrompt, userQuery);
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: result,
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I encountered an error while processing your request. Please try again.",
                isUser: false,
                timestamp: new Date()
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

    if (!isExpanded) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">💬 AI Data Chat</h2>
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-indigo-300"
                        disabled={!isDataLoaded}
                    >
                        Start Chat
                    </button>
                </div>
                <p className="text-gray-600 text-center">
                    {isDataLoaded ? 
                        "Click 'Start Chat' to have a conversation with your data using AI" : 
                        "Upload data to start chatting with AI about your supply chain insights"
                    }
                </p>
                {messages.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500 mb-2">Last conversation had {messages.length} messages</p>
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                            Continue conversation →
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">💬 AI Data Chat</h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Online
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                        <button
                            onClick={clearChat}
                            className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded text-sm"
                        >
                            Clear
                        </button>
                    )}
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded"
                    >
                        Minimize
                    </button>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="h-96 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🤖</div>
                            <p className="text-gray-600 mb-2">Hi! I'm your AI Data Analyst</p>
                            <p className="text-sm text-gray-500">Ask me anything about your supply chain data!</p>
                            <div className="mt-4 space-y-2">
                                <p className="text-xs text-gray-400">Try asking:</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <button
                                        onClick={() => setQuery("Which products are at risk of stockout?")}
                                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full"
                                    >
                                        "Which products are at risk?"
                                    </button>
                                    <button
                                        onClick={() => setQuery("What are the top performing products?")}
                                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full"
                                    >
                                        "Top performing products?"
                                    </button>
                                    <button
                                        onClick={() => setQuery("Show me delivery performance trends")}
                                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full"
                                    >
                                        "Delivery performance?"
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            message.isUser 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-800'
                        }`}>
                            <p className="whitespace-pre-wrap">{message.text}</p>
                            <p className={`text-xs mt-1 ${
                                message.isUser ? 'text-indigo-200' : 'text-gray-500'
                            }`}>
                                {formatTime(message.timestamp)}
                            </p>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                            <LoadingSpinner className="h-4 w-4 border-gray-600" />
                            <span className="text-sm">AI is thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 p-4">
                <div className="flex gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && isDataLoaded && !isLoading && handleQuery()}
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                        placeholder={isDataLoaded ? "Ask about your data..." : "Upload data to start chatting"}
                        disabled={!isDataLoaded || isLoading}
                    />
                    <button
                        onClick={handleQuery}
                        className="bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                        disabled={!isDataLoaded || isLoading || !query.trim()}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};
