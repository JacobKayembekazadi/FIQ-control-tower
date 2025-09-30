
import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { Header } from './components/Header';
import { KpiCard } from './components/KpiCard';
import { AiAnalyst } from './components/AiAnalyst';
import { ProactiveAlerts } from './components/ProactiveAlerts';
import { OrdersTable } from './components/OrdersTable';
import { DataMappingModal } from './components/DataMappingModal';
import { DashboardChart } from './components/DashboardChart';
import type { DataRow, KpiData, ChartData, MappedData } from './types';
import { processDataForDashboard } from './utils/dataProcessor';

const App: React.FC = () => {
    const [originalData, setOriginalData] = useState<DataRow[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<DataRow[]>([]);
    const [unmappedData, setUnmappedData] = useState<Record<string, string>[]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    
    const [kpis, setKpis] = useState<KpiData>({ fillRate: 0, cycleTime: 'N/A', onTimeRate: 0, inventoryTurnover: 0 });
    const [ordersChartData, setOrdersChartData] = useState<ChartData[]>([]);
    const [inventoryChartData, setInventoryChartData] = useState<ChartData[]>([]);
    const [volumeChartData, setVolumeChartData] = useState<ChartData[]>([]);

    const [isMappingModalOpen, setMappingModalOpen] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const resetDashboard = useCallback(() => {
        setOriginalData([]);
        setFilteredOrders([]);
        setUnmappedData([]);
        setCsvHeaders([]);
        setKpis({ fillRate: 0, cycleTime: 'N/A', onTimeRate: 0, inventoryTurnover: 0 });
        setOrdersChartData([]);
        setInventoryChartData([]);
        setVolumeChartData([]);
        setMappingModalOpen(false);
        setUploadError(null);
    }, []);

    useEffect(() => {
        if (originalData.length > 0) {
            const { kpis, ordersChartData, inventoryChartData, volumeChartData, orders } = processDataForDashboard(originalData);
            setKpis(kpis);
            setOrdersChartData(ordersChartData);
            setInventoryChartData(inventoryChartData);
            setVolumeChartData(volumeChartData);
            setFilteredOrders(orders);
        }
    }, [originalData]);

    const handleFileUpload = (file: File) => {
        resetDashboard();
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim(),
            complete: (results) => {
                const parsedData = results.data as Record<string, string>[];
                if (!parsedData || parsedData.length === 0) {
                    setUploadError("CSV file is empty or could not be read.");
                    return;
                }
                setUnmappedData(parsedData);
                setCsvHeaders(Object.keys(parsedData[0]));
                setMappingModalOpen(true);
            },
            error: () => {
                setUploadError("Failed to parse the CSV file.");
            }
        });
    };

    // FIX: Changed parameter type from MappedData[] to DataRow[] to match the actual data type after processing.
    const handleMappingConfirm = (mappedData: DataRow[]) => {
        setOriginalData(mappedData);
        setMappingModalOpen(false);
    };

    const handleChartClick = (payload: any) => {
        if (payload && payload.name) {
            const clickedStatus = payload.name;
            const allOrders = originalData.filter(row => row.type === 'order');
            const isAlreadyFiltered = filteredOrders.length < allOrders.length && filteredOrders.every(o => o.status === clickedStatus);

            if (isAlreadyFiltered) {
                setFilteredOrders(allOrders);
            } else {
                const newFilteredOrders = allOrders.filter(order => order.status === clickedStatus);
                setFilteredOrders(newFilteredOrders);
            }
        }
    };
    
    const isDataLoaded = originalData.length > 0;

    return (
        <>
            <div className={`container mx-auto p-4 md:p-6 transition-filter duration-300 ${isMappingModalOpen ? 'blur-sm' : ''}`}>
                <Header onFileUpload={handleFileUpload} onReset={resetDashboard} isDataLoaded={isDataLoaded} />
                
                {uploadError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">File Error: </strong>
                        <span className="block sm:inline">{uploadError}</span>
                    </div>
                )}

                <main className="space-y-6">
                    <ProactiveAlerts data={originalData} isDataLoaded={isDataLoaded} />
                    <AiAnalyst data={originalData} isDataLoaded={isDataLoaded} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        <KpiCard title="Order Fill Rate" value={`${kpis.fillRate.toFixed(1)}%`} />
                        <KpiCard title="Avg. Order Cycle (Days)" value={kpis.cycleTime.toString()} />
                        <KpiCard title="On-Time Shipping" value={`${kpis.onTimeRate.toFixed(1)}%`} />
                        <KpiCard title="Inventory Turnover" value={kpis.inventoryTurnover.toFixed(2)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DashboardChart title="Orders by Status" type="pie" data={ordersChartData} onChartClick={handleChartClick} />
                        <DashboardChart title="Inventory by Warehouse" type="bar" data={inventoryChartData} dataKey="quantity" />
                    </div>

                    <DashboardChart title="Order Volume Over Time" type="line" data={volumeChartData} dataKey="orders" />
                    
                    <OrdersTable orders={filteredOrders} />
                </main>
            </div>
            {isMappingModalOpen && (
                <DataMappingModal
                    isOpen={isMappingModalOpen}
                    onClose={() => { setMappingModalOpen(false); resetDashboard(); }}
                    onConfirm={handleMappingConfirm}
                    data={unmappedData}
                    headers={csvHeaders}
                />
            )}
        </>
    );
};

export default App;
