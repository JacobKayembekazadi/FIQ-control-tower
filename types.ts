
export interface DataRow {
  type: 'order' | 'shipment' | 'inventory' | string;
  id: string;
  product_name: string;
  quantity: number;
  status: string;
  order_date: Date | null;
  ship_date: Date | null;
  delivery_date: Date | null;
  required_shipping_date: Date | null;
  location: string;
  [key: string]: any; // Allows for other columns from CSV
}

export type MappedData = Omit<DataRow, 'quantity'> & { quantity: string | number };

export interface KpiData {
    fillRate: number;
    cycleTime: number | 'N/A';
    onTimeRate: number;
    inventoryTurnover: number;
}

export interface ChartData {
    name: string;
    [key: string]: string | number;
}
