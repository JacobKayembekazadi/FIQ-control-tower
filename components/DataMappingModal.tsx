
import React, { useState, useMemo, useEffect } from 'react';
import type { DataRow, MappedData } from '../types';
import { REQUIRED_FIELDS } from '../constants';
import { parseDate } from '../utils/dataProcessor';

interface DataMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (mappedData: MappedData[]) => void;
    data: Record<string, string>[];
    headers: string[];
}

type Mapping = Partial<Record<keyof DataRow, string>>;

const isOptional = (key: string) => REQUIRED_FIELDS[key as keyof DataRow]?.includes('(Optional)');
const requiredKeys = Object.keys(REQUIRED_FIELDS).filter(key => !isOptional(key)) as (keyof DataRow)[];

export const DataMappingModal: React.FC<DataMappingModalProps> = ({ isOpen, onClose, onConfirm, data, headers }) => {
    const [mapping, setMapping] = useState<Mapping>({});
    const [previewData, setPreviewData] = useState<MappedData[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        const initialMapping: Mapping = {};
        for (const key in REQUIRED_FIELDS) {
            const fieldKey = key as keyof DataRow;
            const likelyMatch = headers.find(h => h.toLowerCase().replace(/[\s_]/g, '') === fieldKey.toLowerCase().replace(/[\s_]/g, ''));
            if (likelyMatch) {
                initialMapping[fieldKey] = likelyMatch;
            }
        }
        setMapping(initialMapping);
    }, [headers]);

    const handleMappingChange = (key: keyof DataRow, value: string) => {
        setMapping(prev => ({ ...prev, [key]: value }));
        setShowPreview(false); // Hide preview when mapping changes
    };

    const handlePreview = () => {
        const missingRequired = requiredKeys.some(key => !mapping[key]);
        if (missingRequired) {
            alert("Please map all required fields (marked with *).");
            return;
        }

        const mappedPreview = data.slice(0, 5).map(row => {
            const newRow: any = {};
            for (const key in mapping) {
                const dataKey = key as keyof DataRow;
                if (mapping[dataKey]) {
                    newRow[dataKey] = row[mapping[dataKey]!];
                }
            }
            return newRow as MappedData;
        });
        setPreviewData(mappedPreview);
        setShowPreview(true);
    };

    const handleConfirm = () => {
        if (!showPreview) {
            alert("Please preview the data before confirming.");
            return;
        }
        
        const mappedData = data.map(row => {
            const newRow: any = {};
             for (const key in mapping) {
                const dataKey = key as keyof DataRow;
                if (mapping[dataKey]) {
                    newRow[dataKey] = row[mapping[dataKey]!];
                }
            }
            return newRow;
        }).map(row => ({
            ...row,
            quantity: parseInt(row.quantity, 10) || 0,
            order_date: parseDate(row.order_date),
            ship_date: parseDate(row.ship_date),
            delivery_date: parseDate(row.delivery_date),
            required_shipping_date: parseDate(row.required_shipping_date),
        }));

        onConfirm(mappedData as any);
    };
    
    if (!isOpen) return null;

    const mappedHeaders = Object.keys(REQUIRED_FIELDS).filter(key => mapping[key as keyof DataRow]);

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="relative mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                    <h3 className="text-2xl leading-6 font-bold text-gray-900 text-center">Map Your Data Columns</h3>
                    <div className="mt-2 px-7 py-3 text-center">
                        <p className="text-sm text-gray-500">
                            Match your CSV columns to the required dashboard fields, then preview the result before importing.
                        </p>
                    </div>
                    <div className="my-4 text-left space-y-4 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                        {Object.entries(REQUIRED_FIELDS).map(([key, description]) => {
                            const fieldKey = key as keyof DataRow;
                            const optional = isOptional(key);
                            return (
                                <div key={key} className="grid grid-cols-2 gap-4 items-center">
                                    <label className="text-right font-medium text-gray-700">
                                        {description.replace(' (Optional)', '')} {optional ? <span className="text-xs text-gray-400">(Optional)</span> : <span className="text-red-500">*</span>}
                                    </label>
                                    <select
                                        value={mapping[fieldKey] || ''}
                                        onChange={(e) => handleMappingChange(fieldKey, e.target.value)}
                                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Don't Map</option>
                                        {headers.map(header => <option key={header} value={header}>{header}</option>)}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                    
                    {showPreview && (
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800">Data Preview</h4>
                            <div className="overflow-x-auto border rounded-lg max-h-60">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            {mappedHeaders.map(key => (
                                                <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                                    {REQUIRED_FIELDS[key as keyof DataRow].replace(' (Optional)', '')}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {previewData.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {mappedHeaders.map(key => {
                                                    const cellValue = row[key as keyof DataRow] || '';
                                                    let displayValue = cellValue;
                                                    let isInvalid = false;
                                                    if(key.includes('_date')){
                                                        const parsed = parseDate(cellValue);
                                                        displayValue = parsed ? parsed.toLocaleDateString() : 'Invalid Date';
                                                        isInvalid = !parsed;
                                                    }
                                                    return (
                                                        <td key={key} className={`px-4 py-2 whitespace-nowrap ${isInvalid ? 'text-red-500 font-semibold' : 'text-gray-700'}`}>
                                                            {displayValue as string}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    
                    <div className="items-center px-4 py-3 space-y-3 mt-4">
                        <button onClick={handlePreview} className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {showPreview ? 'Remap & Preview Again' : 'Preview Mapped Data'}
                        </button>
                         {showPreview && (
                            <button onClick={handleConfirm} className="px-4 py-2 bg-indigo-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                Confirm & Import Data
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
