
export const REQUIRED_FIELDS: Record<keyof import('./types').DataRow, string> = {
    'type': 'Record Type (e.g., order, shipment)',
    'id': 'Order/Shipment ID',
    'product_name': 'Product Name',
    'quantity': 'Quantity',
    'status': 'Status (e.g., Shipped, Processing)',
    'order_date': 'Order Date',
    'ship_date': 'Ship Date (Optional)',
    'delivery_date': 'Delivery Date (Optional)',
    'required_shipping_date': 'Required Ship Date (Optional)',
    'location': 'Warehouse/Location'
};
