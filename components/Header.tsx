
import React, { useRef } from 'react';
import { LogoIcon } from './icons/LogoIcon';

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
        <header className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-wrap items-center justify-between">
            <div className="flex items-center space-x-3">
                <LogoIcon className="h-10 w-10 text-indigo-600" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">FIQ Control Tower</h1>
                    <p className="text-sm text-gray-500">Bespoke Solutions for Supply Chain Innovators</p>
                </div>
            </div>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
                 <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange} 
                    accept=".csv" 
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100 cursor-pointer"
                />
                {isDataLoaded && (
                    <button 
                        onClick={handleReset} 
                        className="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition duration-200"
                    >
                        Reset
                    </button>
                )}
            </div>
        </header>
    );
};
