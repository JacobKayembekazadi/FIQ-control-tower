
import React from 'react';

interface LoadingSpinnerProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className = 'h-8 w-8 border-indigo-600', ...props }) => {
    return (
        <div 
            className={`animate-spin rounded-full border-b-2 ${className}`}
            {...props}
        ></div>
    );
};
