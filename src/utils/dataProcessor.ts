
// FIX: Added KpiData and ChartData to the import to be used in the explicit return type.
import type { DataRow, KpiData, ChartData } from '../types';

export const parseDate = (dateString: any): Date | null => {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') return null;
    // Attempt to handle various common formats, preferring YYYY-MM-DD
    const isoAttempt = new Date(dateString);
    if (!isNaN(isoAttempt.getTime())) {
        // Check if it's a valid date and not just JS being weird
        const utcDate = new Date(Date.UTC(isoAttempt.getFullYear(), isoAttempt.getMonth(), isoAttempt.getDate()));
         if (!isNaN(utcDate.getTime())) return utcDate;
    }
    
    // Fallback for M/D/YYYY or MM/DD/YYYY
    const parts = dateString.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (parts) {
        // Assuming MM/DD/YYYY
        const date = new Date(Date.UTC(parseInt(parts[3], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
        if (!isNaN(date.getTime())) return date;
    }
    
    return null; // Return null if all parsing fails
};

// FIX: Added an interface for the return type of processDataForDashboard for better type safety.
interface ProcessedData {
    kpis: KpiData;
    ordersChartData: ChartData[];
    inventoryChartData: ChartData[];
    volumeChartData: ChartData[];
    orders: DataRow[];
}

// FIX: Added an explicit return type to the function to avoid type inference issues.
export const processDataForDashboard = (data: DataRow[]): ProcessedData => {
    const orders = data.filter(row => row.type === 'order');
    const shipments = data.filter(row => row.type === 'shipment');
    const inventory = data.filter(row => row.type === 'inventory');

    // KPI Calculations
    const shippedOrdersCount = orders.filter(o => o.status === 'Shipped' || o.status === 'Delivered').length;
    const fillRate = orders.length > 0 ? (shippedOrdersCount / orders.length) * 100 : 0;

    const deliveredOrders = orders.filter(o => o.status === 'Delivered' && o.delivery_date && o.order_date);
    let avgCycleTime: number | 'N/A' = 'N/A';
    if (deliveredOrders.length > 0) {
        const totalCycleTime = deliveredOrders.reduce((sum, o) => {
            const cycleTime = (o.delivery_date!.getTime() - o.order_date!.getTime()) / (1000 * 60 * 60 * 24);
            return sum + cycleTime;
        }, 0);
        avgCycleTime = totalCycleTime / deliveredOrders.length;
    }

    const onTimeShipments = shipments.filter(s => s.ship_date && s.required_shipping_date && s.ship_date <= s.required_shipping_date).length;
    const relevantShipments = shipments.filter(s => s.required_shipping_date);
    const onTimeRate = relevantShipments.length > 0 ? (onTimeShipments / relevantShipments.length) * 100 : 0;
    
    const totalShippedQty = orders.filter(o => o.status === 'Shipped' || o.status === 'Delivered').reduce((sum, o) => sum + o.quantity, 0);
    const totalInventory = inventory.reduce((sum, i) => sum + i.quantity, 0);
    const avgInventory = totalInventory > 0 ? totalInventory / (inventory.length / (new Set(inventory.map(i => i.product_name)).size) || 1) : 0; // Simple average
    const inventoryTurnover = avgInventory > 0 ? totalShippedQty / avgInventory : 0;

    // Chart Data
    const orderStatusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const ordersChartData = Object.entries(orderStatusCounts).map(([name, value]) => ({ name, value }));

    const inventoryByWarehouse = inventory.reduce((acc, item) => {
        const location = item.location || 'Unknown';
        acc[location] = (acc[location] || 0) + item.quantity;
        return acc;
    }, {} as Record<string, number>);
    const inventoryChartData = Object.entries(inventoryByWarehouse).map(([name, quantity]) => ({ name, quantity }));
    
    const ordersByDay = orders.reduce((acc, order) => {
        if (order.order_date) {
            const day = order.order_date.toISOString().split('T')[0];
            acc[day] = (acc[day] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    const sortedDates = Object.keys(ordersByDay).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const volumeChartData = sortedDates.map(date => ({ name: date, orders: ordersByDay[date] }));


    return {
        kpis: {
            fillRate,
            cycleTime: typeof avgCycleTime === 'number' ? parseFloat(avgCycleTime.toFixed(1)) : 'N/A',
            onTimeRate,
            inventoryTurnover
        },
        ordersChartData,
        inventoryChartData,
        volumeChartData,
        orders
    };
};
