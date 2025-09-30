
import React, { useState, useEffect } from 'react';
import type { DataRow } from '../types';
import { callGeminiApi } from '../services/geminiService';
import { WarningIcon } from './icons/WarningIcon';
import { LoadingSpinner } from './icons/LoadingSpinner';
import Papa from 'papaparse';

interface ProactiveAlertsProps {
    data: DataRow[];
    isDataLoaded: boolean;
}

export const ProactiveAlerts: React.FC<ProactiveAlertsProps> = ({ data, isDataLoaded }) => {
    const [alerts, setAlerts] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const generateAlerts = async () => {
            if (!isDataLoaded) {
                setAlerts('');
                return;
            };

            setIsLoading(true);
            
            // Simplified risk detection logic
            const issues: string[] = [];
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const inventoryLevels: Record<string, number> = data
                .filter(d => d.type === 'inventory')
                .reduce((acc, item) => {
                    acc[item.product_name] = (acc[item.product_name] || 0) + item.quantity;
                    return acc;
                }, {} as Record<string, number>);

            const openOrders = data.filter(o => o.type === 'order' && o.status === 'Processing');
            const demandByProduct = openOrders.reduce((acc, order) => {
                acc[order.product_name] = (acc[order.product_name] || 0) + order.quantity;
                return acc;
            }, {} as Record<string, number>);
            
            for (const product in demandByProduct) {
                const demand = demandByProduct[product];
                const supply = inventoryLevels[product] || 0;
                if (demand > supply) {
                    issues.push(`Potential stockout for '${product}'. Inventory: ${supply}, Open Orders: ${demand}.`);
                }
            }

            const lateShipments = data.filter(s => s.type === 'shipment' && s.required_shipping_date && s.required_shipping_date < today && s.status !== 'Shipped');
            lateShipments.forEach(shipment => {
                const daysLate = Math.round((today.getTime() - shipment.required_shipping_date!.getTime()) / (1000 * 60 * 60 * 24));
                issues.push(`Shipment ${shipment.id} is ${daysLate} day(s) late.`);
            });

            if (issues.length === 0) {
                setAlerts('<p class="text-green-600 text-center font-semibold">No critical risks detected in the current data.</p>');
                setIsLoading(false);
                return;
            }
            
            const dataSample = data.slice(0, 50);
            const dataString = Papa.unparse(dataSample);

            const systemPrompt = `You are FIQ's Senior Supply Chain Analyst. You've been given a list of raw issues detected in a dataset. Your task is to analyze these issues, prioritize the top 3 most critical ones, and present them as clear, actionable alerts. For each alert, provide a brief "What it is" and a "Recommended Action". Frame the response as an expert consultant reporting to a client.`;
            const userQuery = `Here is a list of potential supply chain issues:\n\n- ${issues.join('\n- ')}\n\nAnd here is a sample of the raw data for context:\n\n${dataString}\n\nPlease summarize and prioritize the top 3 most critical alerts.`;
            
            const result = await callGeminiApi(systemPrompt, userQuery);
            const formattedResult = result
                .replace(/Alert \d:?/g, (match) => `<strong class="text-red-700 block mt-2">${match}</strong>`)
                .replace(/What it is:/g, '<strong class="font-semibold text-gray-800">What it is:</strong>')
                .replace(/Recommended Action:/g, '<strong class="font-semibold text-gray-800">Recommended Action:</strong>');
            
            setAlerts(formattedResult);
            setIsLoading(false);
        };
        
        generateAlerts();
    }, [isDataLoaded, data]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-3">
                <WarningIcon className="h-6 w-6 text-red-500 mr-3" />
                <h2 className="text-xl font-semibold">Proactive AI Alerts</h2>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg min-h-[100px] flex items-center justify-center">
                {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <LoadingSpinner className="h-8 w-8 border-red-600" />
                        <p className="ml-3 text-gray-600">Scanning for critical risks...</p>
                    </div>
                ) : (
                    !isDataLoaded ? (
                        <p className="text-gray-500 text-center">Upload data to automatically identify top supply chain risks.</p>
                    ) : (
                        <div className="text-sm text-left w-full" dangerouslySetInnerHTML={{ __html: alerts.replace(/\n/g, '<br />') }} />
                    )
                )}
            </div>
        </div>
    );
};
