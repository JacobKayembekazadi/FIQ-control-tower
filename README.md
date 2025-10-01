<div align="center">
  <img width="100%" alt="FIQ Control Tower Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  <h1>FIQ Supply Chain Control Tower</h1>
  <p><strong>AI‑driven supply chain visibility, risk detection, and proactive analytics.</strong></p>
  <p>
    <a href="#overview">Overview</a> ·
    <a href="#features">Features</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#setup">Setup</a> ·
    <a href="#usage">Usage</a> ·
    <a href="#prompting">Prompting</a> ·
    <a href="#security">Security</a> ·
    <a href="#roadmap">Roadmap</a>
  </p>
</div>

---

## Overview

The FIQ Control Tower is an interactive analytics and AI assistant platform for mid‑market supply chain & operations teams. It ingests ad‑hoc CSV exports (orders, shipments, inventory), computes operational KPIs, surfaces risk signals, and enables natural‑language investigation powered by Google Gemini. All processing is currently in‑memory (no backend persistence in MVP) for rapid iteration and low friction.

### Documentation Suite

| Document | Purpose |
|----------|---------|
| `architectural_document.md` | System structure, flows, diagrams, components |
| `product_requirements_document.md` | PRD: user stories, requirements, acceptance criteria |
| `testing_strategy.md` | Test types, tooling, data, coverage and quality strategy |

---

## Features

- 🔄 **Flexible CSV Mapping** – Map arbitrary headers to canonical schema; preserves originals.
- 📊 **Real-Time KPIs** – Fill Rate, Cycle Time, On‑Time Shipping %, Inventory Turnover.
- 🧠 **AI Analyst (Gemini)** – Structured context injection produces quantitative insight (no “please provide data” loops).
- 🚨 **Risk Flags** – Delayed, cancelled, backordered counts & ratios.
- 📈 **Visualizations** – Status distribution, inventory by location, order volume over time.
- 💬 **Floating Chat + Analyst Panel** – Two interaction paradigms (quick Q&A vs structured insight cards).
- 🧪 **Deterministic Prompt Assembly** – Summarized dataset JSON ensures reproducible model behavior.
- ⚙️ **Proxy Fallback (Design)** – Supports serverless proxy pattern for key isolation (implemented if backend route added).

---

## Architecture

High‑level flow:
1. CSV Upload → Parsing (PapaParse) → Raw rows.
2. Column Mapping → Normalized + raw field merge.
3. KPI & Aggregation (`utils/dataProcessor.ts`).
4. UI Composition (cards, charts, tables).
5. AI Request → `services/geminiService.ts` builds structured prompt (dataset summary JSON + user intent).
6. Gemini Response → Render Markdown-like narrative + tables.

See full diagrams (flow, sequence, ER) in `architectural_document.md`.

### Project Structure (Simplified)

```text
.
├── components/                # UI (KPI cards, charts, tables, modals, AI panels)
├── services/geminiService.ts  # Gemini integration + summarization logic
├── utils/dataProcessor.ts     # Data transformations & KPI math
├── architectural_document.md
├── product_requirements_document.md
├── testing_strategy.md
├── package.json
└── README.md
```

Duplicate `src/` modules exist temporarily; root-level versions are authoritative (see Technical Debt).

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | React 19 + TypeScript | SPA via Vite |
| Bundler | Vite 6 | Fast dev + tree‑shaking |
| Styling | Tailwind CSS | Utility + design tokens (migration underway) |
| Charts | Recharts 3 | Declarative composable charts |
| Parsing | PapaParse | Streaming/robust CSV handling |
| AI | `@google/genai` | Gemini 1.5 models (flash → pro fallback strategy) |
| Runtime (Proxy optional) | Serverless (e.g. Vercel) | For secure key usage |

---

## Setup

### Prerequisites
- Node 18+ (LTS recommended)
- npm (or pnpm/yarn with adjustments)
- A Gemini API Key (Google AI Studio)

### Install

```bash
git clone https://github.com/JacobKayembekazadi/FIQ-control-tower.git
cd FIQ-control-tower
npm install
```

### Environment File

Copy a template (create if absent):

```bash
cp .env.example .env.local || echo "VITE_GEMINI_API_KEY=REPLACE_ME" > .env.local
```

Populate required variables (see Environment section).

### Run Dev

```bash
npm run dev
```

### Build & Preview

```bash
npm run build
npm run preview
```

---

## Environment

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Client | Yes (direct SDK path) | Exposed for client usage; visible in bundle |
| `GEMINI_API_KEY` | Server (proxy) | Optional | Used only if serverless proxy endpoint is present |
| `VITE_GEMINI_USE_PROXY` | Client | Optional (`true`/`false`) | Forces proxy even if client key present |

Security best practice: For production, prefer proxy mode to avoid embedding raw keys when feasible.

---

## Usage

1. Launch dev server.
2. Click Upload → select CSV(s).
3. Map headers to canonical fields (retain defaults where auto-detected).
4. Confirm → dashboard populates KPI cards + charts.
5. Open AI (floating button) → choose a predefined suggestion or enter a question:
   > "Summarize fulfillment risks and propose mitigation steps."
6. Review AI response (tables + bullets). Iterate with follow‑up questions.

### Data Mapping Canonical Fields
`type`, `id`, `product_name`, `quantity`, `status`, `order_date`, `ship_date`, `delivery_date`, `required_shipping_date`, `location` (+ passthrough custom columns).

### KPI Definitions

| KPI | Formula | Edge Handling |
|-----|---------|---------------|
| Fill Rate | shipped_or_delivered / total_orders | 0 if no orders |
| Cycle Time (days) | avg(delivery − order) | `N/A` if none delivered |
| On‑Time % | on_time_shipments / shipments_with_required_date | Excludes missing required date |
| Inventory Turnover | total_shipped_qty / avg_inventory | 0 if denominator 0 |

---

## Integration Credentials

Obtain a Gemini API key from Google AI Studio. Place in `.env.local` as `VITE_GEMINI_API_KEY` for direct client SDK usage. If adding a serverless proxy route (`/api/gemini`):

| Mode | Pros | Cons |
|------|------|------|
| Direct (current default) | Lower latency | Key exposed in bundle |
| Proxy | Key concealed server-side; model fallback logic centralized | Slight added latency |

Future enhancement: rotate keys and enforce request quotas server‑side.

---

## Prompting

The service composes a deterministic prompt object:

1. System instruction (formatting + quantitative requirement).
2. Dataset summary JSON (schema, samples, distributions, KPI snapshot, risk counts).
3. User message.

Guidelines for best results:
- Ask for concrete metrics or comparisons ("Compare on‑time % vs cancellations").
- Request structured output ("Provide a risk table with columns: Risk, Count, %").
- Avoid re-uploading or pasting raw CSV—context already embedded.

Example user prompt:

```
Identify top 3 fulfillment risks, quantify their impact, and propose mitigation actions with time horizons.
```

---

## Security

| Concern | Current State | Planned Improvement |
|---------|---------------|---------------------|
| API Key Exposure | Direct client inclusion when using SDK | Default to proxy with server key |
| Data Persistence | None (in-memory only) | Optional encrypted persistence layer |
| Input Validation | Basic parsing & null guards | Schema validation + sanitization |
| Secrets in Repo | Prevented via `.env*` ignore | CI secret scanning |
| Prompt Injection | Dataset summary constrained; no tool execution | Add pattern filters / guardrails |

Recommendations for production hardening are detailed in `architectural_document.md`.

---

## Roadmap

- [ ] Serverless proxy default (secure key path)
- [ ] Streaming AI responses (partial token flush)
- [ ] Multi-dataset joins (orders + suppliers + carriers)
- [ ] User auth & session persistence
- [ ] Performance budget automation (Lighthouse CI + bundle analyzer)
- [ ] Enhanced anomaly detection & predictive ETAs
- [ ] Export AI insights to CSV / PDF
- [ ] Configurable KPI formulas per tenant
- [ ] Accessibility audit & remediation pass

See detailed prioritization in `product_requirements_document.md`.

---

## Contributing

1. Fork repository & create feature branch (`feat/<slug>`).
2. (Future) Run tests & lint (see `testing_strategy.md`).
3. Keep commits atomic; write descriptive messages.
4. Open PR referencing related requirement / issue.
5. Provide before/after screenshots for UI changes.

Quality gates (planned): build passes, type-check clean, unit + integration tests green, no bundle size regression.

---

## License

Currently proprietary / internal. Add an OSS license (e.g., MIT or Apache 2.0) before external distribution.

---

## Troubleshooting

| Issue | Symptom | Resolution |
|-------|---------|------------|
| Missing AI Key | "NO_KEY_DETECTED" or empty AI response | Ensure `VITE_GEMINI_API_KEY` in `.env.local`, restart dev server |
| Large CSV slow | UI stalls on upload | Split file, or implement planned streaming/downsampling; keep rows <50k for MVP |
| Incorrect dates | KPIs show `N/A` unexpectedly | Confirm date columns mapped correctly; verify formats (ISO / M/D/YYYY) |
| AI Hallucination | Generic advice w/o numbers | Rephrase prompt to request quantified metrics; ensure dataset parsed correctly |
| Build fails | Vite import or type errors | Run `npm run build` to see stack; clear `node_modules` and reinstall |
| Env not applied | Changes ignored | Stop dev server; delete Vite cache (`node_modules/.vite`) then restart |
| Proxy future mode fails | 401 from `/api/gemini` | Ensure server key (`GEMINI_API_KEY`) set in deployment environment |

Additional debugging patterns & performance harness guidance in `testing_strategy.md`.

---

**Need help?** Open an issue with: steps, expected vs actual, anonymized CSV snippet, environment details.  
**Data caution:** Never attach real production data—sanitize identifiers and sensitive values.

---

_FIQ Control Tower – accelerating operational insight through structured data + responsible AI._
