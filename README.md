<div align="center">
   <img width="100%" alt="FIQ Control Tower Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
   <h1>FIQ Supply Chain Control Tower</h1>
   <p><strong>AI-driven supply chain visibility, risk detection, and proactive analytics.</strong></p>
   <p>
      <a href="#quick-start">Quick Start</a> ·
      <a href="#features">Features</a> ·
      <a href="#architecture">Architecture</a> ·
      <a href="#ai-assistant">AI Assistant</a> ·
      <a href="#data-mapping">Data Mapping</a> ·
      <a href="#roadmap">Roadmap</a>
   </p>
</div>

---

## Overview
The FIQ Supply Chain Control Tower provides a unified, interactive dashboard for analyzing orders, shipments, inventory, and performance KPIs with a built‑in AI Analyst (Gemini) that produces context‑aware insights using your uploaded CSV data. It is built with **React 19 + TypeScript + Vite** and includes a structured **data mapping layer** so users can adapt arbitrary CSV headers to a canonical internal model.

## Key Features
- 🔄 **Flexible CSV Data Import & Mapping** – Map arbitrary column names (e.g., `Ship Date`, `shipment_date`, `ship_date`) into the internal schema.
- 📊 **Real-Time KPIs** – Fill Rate, Average Order Cycle Time, On-Time Shipping %, Inventory Turnover.
- 🧠 **Context-Aware AI Assistant** – Gemini-powered, summarizes dataset structure, distributions, risk metrics, and trends without asking for the data again.
- 🚨 **Risk & Exception Detection** – Identifies delayed, cancelled, backordered items (extensible for SLA breaches).
- 📈 **Interactive Visualizations** – Recharts-based status, inventory, and temporal trend charts.
- 🧱 **Design System & Theming** – FIQ Quantify Design Tokens (typography, color, elevation, spacing).
- 💬 **Floating Global AI Chat** – Accessible on every screen; creates tables, insights, action plans.
- 🔐 **Sensitive Data Hygiene** – API keys isolated via environment variables; raw CSV never committed.

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind (CDN) + Custom FIQ Design Tokens |
| Charts | Recharts 3 |
| Data Parsing | PapaParse |
| AI | Google Gemini (`@google/genai`) |

## Project Structure
```
.
├── App.tsx                    # Main dashboard shell (root)
├── components/                # Core UI components (header, cards, chat, tables)
├── services/geminiService.ts  # AI service (enhanced prompt + dataset summary)
├── utils/dataProcessor.ts     # KPI + aggregation logic
├── public/                    # Static assets (design tokens, images)
├── .env.example               # Template for secrets
├── package.json
└── README.md
```

> Note: There is also a `src/` duplication for some components/services. The root-level versions are the active ones; long term these should be consolidated (see [Technical Debt](#technical-debt)).

## Quick Start
### 1. Clone & Install
```bash
git clone <REPO_URL>
cd FIQ-control-tower
npm install
```

### 2. Configure Environment
Copy the example file and set your Gemini key:
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```
GEMINI_API_KEY=YOUR_KEY
```

### 3. Run Development Server
```bash
npm run dev
```
Visit the printed localhost URL (Vite may select a free port like 3000–3005).

### 4. Upload a CSV
Use the header bar upload button. After parsing, map your columns → preview → confirm import.

### 5. Open AI Assistant
Click the floating FIQ AI button (bottom-right), choose a feature card, or ask a question (e.g.:
> "Identify at-risk orders and propose mitigation actions.")

## Data Mapping
The mapping modal allows users to align arbitrary CSV headers to internal canonical fields. All **original columns are preserved** in memory alongside normalized fields so the AI can leverage the full raw dataset. Parsed date fields are converted to `Date` objects; raw string versions remain under original keys.

### Canonical Core Fields
`type`, `id`, `product_name`, `quantity`, `status`, `order_date`, `ship_date`, `delivery_date`, `required_shipping_date`, `location` (+ any passthrough custom fields).

## AI Assistant
The AI pipeline builds a structured JSON summary each query:
- Record counts, column list, type distribution
- Status distribution & risk metrics (delayed/cancelled/backordered)
- Top products by shipped quantity
- Location frequency
- Order date range & on-time delivery rate
- KPI snapshot (Fill Rate, Cycle Time, On-Time %, Inventory Turnover)
- Sample records per type (truncated)

This JSON is injected into the Gemini prompt to eliminate “data not provided” responses. The assistant MUST use quantitative values; placeholders or generic methodology are rejected by prompt design.

### Example Prompt Strategy (Extract)
```
DATASET_SUMMARY_JSON: { ... }
USER_REQUEST: "What are key trends?"
OUTPUT REQUIREMENTS:
1. Bullet insights (quantified)
2. Markdown tables
3. Risks & actions with metrics
```

## KPI Definitions
| KPI | Formula | Notes |
|-----|---------|-------|
| Fill Rate | (Shipped or Delivered Orders) / Total Orders * 100 | Uses statuses `Shipped` + `Delivered` |
| Avg Order Cycle (Days) | Mean(Delivery Date − Order Date) | Only delivered orders with both dates |
| On-Time Shipping % | Shipments shipped on/before required date / Shipments with required date * 100 | Based on shipment rows (type = shipment) |
| Inventory Turnover | Total Shipped Quantity / Avg Inventory | Simplified estimator |

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (output in `dist/`) |
| `npm run preview` | Preview production build |

## Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Auth for Google Gemini API |
| `GEMINI_MODEL` | No | Override model (defaults in code) |

Never commit real keys. Use `.env.local` which is git‑ignored.

## Architecture
High-level flow:
1. User uploads CSV → PapaParse → raw array of records.
2. Mapping modal assigns columns → normalized + raw merged dataset.
3. `processDataForDashboard` computes KPIs & chart aggregations.
4. Floating AI Chat sends enhanced prompt with serialized dataset summary.
5. Gemini returns structured insight text → rendered with optional table parsing.

## Extensibility Ideas
- Add streaming responses (Server-Sent Events or WebSocket) for incremental AI replies.
- Persist datasets (SQLite / Postgres) with user sessions.
- Add authentication & role-based access.
- Multi-file dataset merging (orders + shipments + suppliers).
- Add anomaly detection (Z-score / isolation forest) pre-AI summarization.

## Performance Considerations
- Current summarization is in-memory; for very large CSVs add size thresholds + downsampling.
- Consider lazy-loading large table components.
- Token optimization: truncate extremely wide columns or high-cardinality categorical lists.

## Testing Suggestions (Not Yet Implemented)
- Unit: `dataProcessor` KPI math.
- Snapshot: AI prompt assembly (assert summary invariants).
- E2E: Upload–Map–Ask flow (Playwright/Cypress).

## Security Notes
- API key only read at runtime from environment.
- No server-side proxy included yet (calls are client-side: consider moving to a backend to conceal key).
- Add input sanitation before future persistence features.

## Technical Debt
- Duplicate `src/` vs root component/service copies → consolidate.
- Centralize design tokens & migrate off CDN Tailwind to a build-integrated config for purge/tree-shaking.
- Introduce state management (Zustand/Redux) if complexity grows.

## Roadmap
- [ ] Streaming AI responses
- [ ] Multi-dataset join (orders + suppliers + carriers)
- [ ] User auth & session persistence
- [ ] Advanced risk scoring model
- [ ] Export AI tables to CSV / Excel
- [ ] Configurable KPI formulas per tenant

## Contributing
1. Fork & branch (`feat/<name>`)
2. Write focused commits
3. Ensure build passes: `npm run build`
4. Open PR with clear summary & screenshots

## License
Currently proprietary / internal (add explicit LICENSE file if distributing externally).

---
**Need help?** Open an issue or start a discussion with context (CSV sample, expected vs actual behavior, logs).  
**Reminder:** Never attach real production data—sanitize or mock first.
