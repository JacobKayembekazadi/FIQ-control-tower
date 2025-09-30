
import React from 'react';

interface KpiCardProps {
    title: string;
    value: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value }) => {
    return (
        <div className="bg-white p-5 rounded-lg shadow-md text-center border-l-4 border-indigo-500 transition-all duration-300 ease-in-out hover:transform hover:-translate-y-1 hover:shadow-xl">
            <h3 className="text-md font-semibold text-gray-500 truncate">{title}</h3>
            <p className="text-3xl font-bold mt-2 text-indigo-600">{value}</p>
        </div>
    );
};
