
import React from 'react';
import type { DataRow } from '../types';
import Papa from 'papaparse';

interface OrdersTableProps {
    orders: DataRow[];
}

const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
        case 'delivered': return 'bg-green-100 text-green-800';
        case 'shipped': return 'bg-blue-100 text-blue-800';
        case 'processing': return 'bg-yellow-100 text-yellow-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

export const OrdersTable: React.FC<OrdersTableProps> = ({ orders }) => {
    const isDataLoaded = orders.length > 0;

    const exportToCsv = () => {
        const csvData = orders.map(o => ({
            'Order ID': o.id,
            'Product': o.product_name,
            'Quantity': o.quantity,
            'Status': o.status,
            'Order Date': o.order_date ? o.order_date.toLocaleDateString() : 'N/A'
        }));
        
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'filtered_orders.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Order Details</h3>
                <button 
                    onClick={exportToCsv}
                    disabled={!isDataLoaded}
                    className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-200 disabled:bg-green-300 disabled:cursor-not-allowed"
                >
                    Export to CSV
                </button>
            </div>
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isDataLoaded ? (
                            orders.slice(0, 100).map((order, index) => (
                                <tr key={order.id + index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.product_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.order_date ? order.order_date.toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">No data uploaded</td></tr>
                        )}
                         {isDataLoaded && orders.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">No matching orders found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
