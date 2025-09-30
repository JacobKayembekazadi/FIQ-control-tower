
import React from 'react';

interface KpiCardProps {
    title: string;
    value: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value }) => {
    return (
        <div className="fiq-kpi-card">
            <h3 className="fiq-kpi-title">{title}</h3>
            <p className="fiq-kpi-value">{value}</p>
        </div>
    );
};
