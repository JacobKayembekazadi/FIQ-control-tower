import type { DataRow } from '../types';

const AIRTABLE_API = 'https://api.airtable.com/v0';

function getKey(): string {
  return (import.meta as any).env?.VITE_AIRTABLE_API_KEY ?? '';
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getKey()}`,
    'Content-Type': 'application/json',
  };
}

export interface AirtableBase {
  id: string;
  name: string;
}

export interface AirtableTable {
  id: string;
  name: string;
}

// Detect which DataRow type a table represents based on its name
function detectTableType(tableName: string): 'order' | 'shipment' | 'inventory' | null {
  const n = tableName.toLowerCase();
  if (/order/.test(n)) return 'order';
  if (/shipment/.test(n)) return 'shipment';
  if (/inventor/.test(n)) return 'inventory';
  return null;
}

function parseAirtableDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function fieldsToDataRow(fields: Record<string, unknown>, fallbackType: string): DataRow {
  return {
    type: (fields.type as string) || fallbackType,
    id: (fields.id as string) || '',
    product_name: (fields.product_name as string) || '',
    quantity: Number(fields.quantity) || 0,
    status: (fields.status as string) || '',
    order_date: parseAirtableDate(fields.order_date),
    ship_date: parseAirtableDate(fields.ship_date),
    delivery_date: parseAirtableDate(fields.delivery_date),
    required_shipping_date: parseAirtableDate(fields.required_shipping_date),
    location: (fields.location as string) || '',
  };
}

/** Lists all Airtable bases the token has access to. */
export async function listBases(): Promise<AirtableBase[]> {
  const res = await fetch(`${AIRTABLE_API}/meta/bases`, { headers: authHeaders() });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Airtable API error ${res.status}: ${msg}`);
  }
  const data = await res.json();
  return (data.bases ?? []) as AirtableBase[];
}

/** Lists all tables in a base. */
export async function listTables(baseId: string): Promise<AirtableTable[]> {
  const res = await fetch(`${AIRTABLE_API}/meta/bases/${baseId}/tables`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Airtable tables error ${res.status}: ${msg}`);
  }
  const data = await res.json();
  return (data.tables ?? []) as AirtableTable[];
}

/** Fetches all records from a table, handling Airtable's 100-record page limit. */
async function fetchAllRecords(
  baseId: string,
  tableName: string,
): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  const records: { id: string; fields: Record<string, unknown> }[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}`);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) break;

    const data = await res.json();
    records.push(...(data.records ?? []));
    offset = data.offset as string | undefined;
  } while (offset);

  return records;
}

/**
 * Loads all supply-chain records from a base.
 * Scans every table and ingests those whose names match order / shipment / inventory patterns.
 */
export async function loadBaseData(baseId: string): Promise<DataRow[]> {
  const tables = await listTables(baseId);
  const all: DataRow[] = [];

  for (const table of tables) {
    const tableType = detectTableType(table.name);
    if (!tableType) continue;

    const records = await fetchAllRecords(baseId, table.name);
    for (const rec of records) {
      all.push(fieldsToDataRow(rec.fields, tableType));
    }
  }

  return all;
}

/**
 * Writes records to an Airtable table in batches of 10 (Airtable's per-request limit).
 * Returns the total number of records created.
 */
export async function writeRecords(
  baseId: string,
  tableName: string,
  records: Record<string, unknown>[],
): Promise<number> {
  const BATCH = 10;
  let created = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH).map((r) => ({ fields: r }));
    const res = await fetch(
      `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ records: batch }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable write failed: ${err}`);
    }

    const data = await res.json();
    created += (data.records ?? []).length;
  }

  return created;
}
