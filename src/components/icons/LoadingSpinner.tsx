
import React from 'react';

// FIX: Changed props to extend HTMLAttributes for a div element instead of SVGProps.
interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
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
