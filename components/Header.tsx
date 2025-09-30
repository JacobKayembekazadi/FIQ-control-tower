
import React, { useRef } from 'react';

interface HeaderProps {
    onFileUpload: (file: File) => void;
    onReset: () => void;
    isDataLoaded: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onFileUpload, onReset, isDataLoaded }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onFileUpload(file);
        }
    };
    
    const handleReset = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onReset();
    }

    return (
        <header className="fiq-header">
            <div className="fiq-header-logo-section">
                <img 
                    src="/images/FIQ-logo.webp" 
                    alt="FIQ Logo" 
                    className="h-20 w-20 object-contain"
                />
                <div>
                    <h1 className="fiq-header-title">FIQ Control Tower</h1>
                    <p className="fiq-header-subtitle">Bespoke Solutions for Supply Chain Innovators</p>
                </div>
            </div>
            <div className="fiq-header-actions">
                 <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange} 
                    accept=".csv" 
                    className="fiq-file-input"
                    title="Upload CSV file"
                />
                {isDataLoaded && (
                    <button 
                        onClick={handleReset} 
                        className="fiq-button-reset"
                    >
                        Reset
                    </button>
                )}
            </div>
        </header>
    );
};
