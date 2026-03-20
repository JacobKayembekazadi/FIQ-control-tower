
import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { Header } from './components/Header';
import { KpiCard } from './components/KpiCard';
import { FloatingAiChat } from './components/FloatingAiChat';
import { ProactiveAlerts } from './components/ProactiveAlerts';
import { OrdersTable } from './components/OrdersTable';
import { DataMappingModal } from './components/DataMappingModal';
import { DashboardChart } from './components/DashboardChart';
import type { DataRow, KpiData, ChartData, MappedData } from './types';
import { processDataForDashboard } from './utils/dataProcessor';
import {
  listBases,
  listTables,
  loadBaseData,
  writeRecords,
  type AirtableBase,
  type AirtableTable,
} from './services/airtableService';
import { classifyCSV, type ClassificationResult } from './services/aiClassifier';

// ── Classification confirmation modal ────────────────────────────────────────

interface ClassificationModalProps {
  result: ClassificationResult;
  tables: AirtableTable[];
  onConfirm: (tableName: string) => void;
  onCancel: () => void;
}

const ClassificationModal: React.FC<ClassificationModalProps> = ({
  result,
  tables,
  onConfirm,
  onCancel,
}) => {
  const [selected, setSelected] = useState(result.tableName);
  const pct = Math.round(result.confidence * 100);
  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h2 className="text-white text-lg font-semibold">AI Data Classification</h2>
          <p className="text-indigo-200 text-sm mt-0.5">
            AI has analysed your CSV and routed it to the right table
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Confidence bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 font-medium">Confidence</span>
              <span className="font-bold text-gray-800">{pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Reasoning */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <p className="text-indigo-800 text-sm italic">"{result.reasoning}"</p>
          </div>

          {/* Table selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Route to table
            </label>
            <select
              title="Select Airtable table"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              AI suggested <strong>{result.tableName}</strong> — override if needed
            </p>
          </div>

          {/* Field mapping preview */}
          {Object.keys(result.fieldMapping).length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                Field mapping ({Object.keys(result.fieldMapping).length} columns)
              </summary>
              <div className="mt-2 space-y-0.5 pl-2 border-l-2 border-indigo-200">
                {Object.entries(result.fieldMapping).map(([csv, at]) => (
                  <div key={csv} className="flex gap-2">
                    <span className="text-gray-400">{csv}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-indigo-600 font-medium">{at}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-2.5 transition-colors"
          >
            Write to Airtable
          </button>
          <button
            onClick={onCancel}
            className="px-4 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────

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

  // ── Airtable state ──────────────────────────────────────────────────────────
  const [bases, setBases] = useState<AirtableBase[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string>('');
  const [baseTables, setBaseTables] = useState<AirtableTable[]>([]);
  const [isLoadingBases, setIsLoadingBases] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [airtableError, setAirtableError] = useState<string | null>(null);

  // ── AI classification state ─────────────────────────────────────────────────
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null);
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<Record<string, string>[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isWritingToAirtable, setIsWritingToAirtable] = useState(false);

  // ── Load bases on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const key = (import.meta as any).env?.VITE_AIRTABLE_API_KEY;
    if (!key) return;

    setIsLoadingBases(true);
    listBases()
      .then((b) => {
        setBases(b);
        if (b.length > 0) setSelectedBaseId(b[0].id);
      })
      .catch((err) => setAirtableError(String(err)))
      .finally(() => setIsLoadingBases(false));
  }, []);

  // ── Load tables when base selection changes ─────────────────────────────────
  useEffect(() => {
    if (!selectedBaseId) return;
    listTables(selectedBaseId)
      .then(setBaseTables)
      .catch(() => setBaseTables([]));
  }, [selectedBaseId]);

  // ── Recalculate KPIs whenever data changes ──────────────────────────────────
  useEffect(() => {
    if (originalData.length > 0) {
      const { kpis, ordersChartData, inventoryChartData, volumeChartData, orders } =
        processDataForDashboard(originalData);
      setKpis(kpis);
      setOrdersChartData(ordersChartData);
      setInventoryChartData(inventoryChartData);
      setVolumeChartData(volumeChartData);
      setFilteredOrders(orders);
    }
  }, [originalData]);

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

  // ── Load data from selected Airtable base ───────────────────────────────────
  const handleLoadBase = useCallback(async () => {
    if (!selectedBaseId) return;
    setIsLoadingData(true);
    setAirtableError(null);
    resetDashboard();
    try {
      const rows = await loadBaseData(selectedBaseId);
      if (rows.length === 0) {
        setAirtableError('No supply chain data found in this base. Make sure the base has tables named with "Orders", "Shipments", or "Inventory".');
      } else {
        setOriginalData(rows);
      }
    } catch (err) {
      setAirtableError(`Failed to load base: ${String(err)}`);
    } finally {
      setIsLoadingData(false);
    }
  }, [selectedBaseId, resetDashboard]);

  // ── CSV upload → AI classification → write to Airtable ─────────────────────
  const handleFileUpload = (file: File) => {
    resetDashboard();
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async (results) => {
        const parsed = results.data as Record<string, string>[];
        if (!parsed || parsed.length === 0) {
          setUploadError('CSV file is empty or could not be read.');
          return;
        }

        const headers = Object.keys(parsed[0]);

        // If Airtable is configured and a base is selected, use AI classification
        if (selectedBaseId && baseTables.length > 0) {
          setIsClassifying(true);
          setPendingCsvData(parsed);
          try {
            const result = await classifyCSV(headers, parsed, baseTables);
            setClassificationResult(result);
            setShowClassificationModal(true);
          } catch {
            // Fall back to manual mapping if classification fails
            setUnmappedData(parsed);
            setCsvHeaders(headers);
            setMappingModalOpen(true);
          } finally {
            setIsClassifying(false);
          }
        } else {
          // No Airtable configured — use existing manual mapping flow
          setUnmappedData(parsed);
          setCsvHeaders(headers);
          setMappingModalOpen(true);
        }
      },
      error: () => {
        setUploadError('Failed to parse the CSV file.');
      },
    });
  };

  // ── Confirm AI classification → write records to Airtable ──────────────────
  const handleClassificationConfirm = useCallback(
    async (tableName: string) => {
      if (!selectedBaseId || !classificationResult) return;
      setShowClassificationModal(false);
      setIsWritingToAirtable(true);

      try {
        // Map CSV fields using the AI field mapping
        const mapping = classificationResult.fieldMapping;
        const records = pendingCsvData.map((row) => {
          const mapped: Record<string, unknown> = {};
          for (const [csvCol, atField] of Object.entries(mapping)) {
            if (row[csvCol] !== undefined && row[csvCol] !== '') {
              mapped[atField] = row[csvCol];
            }
          }
          return mapped;
        });

        await writeRecords(selectedBaseId, tableName, records);

        // Reload the base to show the newly written data
        await handleLoadBase();
      } catch (err) {
        setAirtableError(`Write failed: ${String(err)}`);
      } finally {
        setIsWritingToAirtable(false);
        setPendingCsvData([]);
        setClassificationResult(null);
      }
    },
    [selectedBaseId, classificationResult, pendingCsvData, handleLoadBase],
  );

  const handleMappingConfirm = (mappedData: MappedData[]) => {
    setOriginalData(mappedData);
    setMappingModalOpen(false);
  };

  const handleChartClick = (payload: any) => {
    if (payload?.name) {
      const clickedStatus = payload.name;
      const allOrders = originalData.filter((row) => row.type === 'order');
      const isAlreadyFiltered =
        filteredOrders.length < allOrders.length &&
        filteredOrders.every((o) => o.status === clickedStatus);

      if (isAlreadyFiltered) {
        setFilteredOrders(allOrders);
      } else {
        setFilteredOrders(allOrders.filter((o) => o.status === clickedStatus));
      }
    }
  };

  const isDataLoaded = originalData.length > 0;
  const hasAirtable = !!(import.meta as any).env?.VITE_AIRTABLE_API_KEY;

  const isBlurred = isMappingModalOpen || showClassificationModal;

  return (
    <>
      <div className={`container mx-auto p-4 md:p-6 transition-filter duration-300 ${isBlurred ? 'blur-sm' : ''}`}>
        <Header onFileUpload={handleFileUpload} onReset={resetDashboard} isDataLoaded={isDataLoaded} />

        {/* ── Airtable Base Selector ─────────────────────────────────────── */}
        {hasAirtable && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2 shrink-0">
                {/* Airtable logo mark */}
                <svg className="w-5 h-5" viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M90.039 9.133L9.329 40.94c-4.75 1.848-4.713 8.532.059 10.324L90.292 82.6a30 30 0 0021.416 0l80.904-31.335c4.772-1.792 4.809-8.476.06-10.324L111.455 9.133a30 30 0 00-21.416 0z" fill="#FCB400"/>
                  <path d="M105.882 95.77v79.647c0 5.03 5.108 8.404 9.703 6.433l89.654-37.794A7.071 7.071 0 00209 137.48V57.833c0-5.03-5.108-8.403-9.703-6.432L115.585 89.19a7.071 7.071 0 00-9.703 6.58z" fill="#18BFFF"/>
                  <path d="M88.27 99.038L61.532 111.73l-2.772 1.314L10.6 135.084c-4.637 2.198-10.1-1.18-10.1-6.309V58.02a6.417 6.417 0 011.015-3.49 7.28 7.28 0 011.36-1.605 6.365 6.365 0 014.54-1.327c.659.06 1.303.22 1.912.474l77.907 31.968a7.127 7.127 0 011.036 12z" fill="#F82B60"/>
                </svg>
                <span className="font-semibold text-gray-700 text-sm">Airtable</span>
              </div>

              {isLoadingBases ? (
                <span className="text-sm text-gray-400 animate-pulse">Loading bases…</span>
              ) : bases.length > 0 ? (
                <>
                  <select
                    title="Select Airtable base"
                    value={selectedBaseId}
                    onChange={(e) => setSelectedBaseId(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                  >
                    {bases.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleLoadBase}
                    disabled={isLoadingData}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    {isLoadingData ? 'Loading…' : 'Load Data'}
                  </button>
                </>
              ) : (
                <span className="text-sm text-gray-400">
                  {airtableError ?? 'No bases found — check your VITE_AIRTABLE_API_KEY'}
                </span>
              )}
            </div>

            {/* Status indicators */}
            {isLoadingData && (
              <p className="text-xs text-indigo-500 mt-2 animate-pulse">
                Fetching records from Airtable…
              </p>
            )}
            {isClassifying && (
              <p className="text-xs text-purple-500 mt-2 animate-pulse">
                AI is analysing your CSV and routing it to the right table…
              </p>
            )}
            {isWritingToAirtable && (
              <p className="text-xs text-green-600 mt-2 animate-pulse">
                Writing records to Airtable…
              </p>
            )}
            {airtableError && !isLoadingData && (
              <p className="text-xs text-red-500 mt-2">{airtableError}</p>
            )}
          </div>
        )}

        {uploadError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">File Error: </strong>
            <span className="block sm:inline">{uploadError}</span>
          </div>
        )}

        <main className="space-y-6">
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

          <ProactiveAlerts data={originalData} isDataLoaded={isDataLoaded} />

          <OrdersTable orders={filteredOrders} />
        </main>
      </div>

      {/* Floating AI Chat */}
      <FloatingAiChat data={originalData} isDataLoaded={isDataLoaded} />

      {/* Manual field mapping modal (CSV without Airtable) */}
      {isMappingModalOpen && (
        <DataMappingModal
          isOpen={isMappingModalOpen}
          onClose={() => { setMappingModalOpen(false); resetDashboard(); }}
          onConfirm={handleMappingConfirm}
          data={unmappedData}
          headers={csvHeaders}
        />
      )}

      {/* AI classification modal (CSV with Airtable) */}
      {showClassificationModal && classificationResult && (
        <ClassificationModal
          result={classificationResult}
          tables={baseTables}
          onConfirm={handleClassificationConfirm}
          onCancel={() => {
            setShowClassificationModal(false);
            setPendingCsvData([]);
            setClassificationResult(null);
          }}
        />
      )}
    </>
  );
};

export default App;
