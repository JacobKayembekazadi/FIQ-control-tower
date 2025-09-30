
import React from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from 'recharts';
import type { ChartData } from '../types';

interface DashboardChartProps {
    title: string;
    type: 'bar' | 'pie' | 'line';
    data: ChartData[];
    dataKey?: string;
    onChartClick?: (payload: any) => void;
}

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#6B7280', '#8B5CF6'];

export const DashboardChart: React.FC<DashboardChartProps> = ({ title, type, data, dataKey, onChartClick }) => {
    const renderChart = () => {
        if (!data || data.length === 0) {
            return <div className="flex items-center justify-center h-full text-gray-500">No data to display</div>;
        }

        switch (type) {
            case 'bar':
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey={dataKey || "value"} fill="#8B5CF6" />
                    </BarChart>
                );
            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            onClick={onChartClick ? (d) => onChartClick(d) : undefined}
                            className="cursor-pointer"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                );
            case 'line':
                 return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey={dataKey || "value"} stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
};
