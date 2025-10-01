# Product Requirements Document (PRD)

## Feature Name

### FIQ Control Tower – AI-Driven Supply Chain Analytics (MVP)

---

## Problem Statement

Mid-market supply chain & operations teams lack a fast, low-friction way to:

- Consolidate ad‑hoc order / shipment / inventory CSV extracts.
- Generate KPI dashboards without IT or BI backlogs.
- Ask natural-language questions and obtain contextual, quantified insight.
- Identify risks (delays, backorders, fulfillment inefficiency) early and drive action.

Existing tools are either:

- Heavyweight (ERP/SCM suites) with high integration costs, or
- Static BI dashboards lacking conversational diagnostic intelligence.

The MVP enables a user to upload structured CSV data, instantly visualize operational metrics, and interrogate the dataset via an AI assistant that produces actionable insight summaries.

---

## Referenced Documents

- `architectural_document.md` – System architecture & technical context.

---

## Target Users & Personas

| Persona | Role & Goals | Pain Points Today | MVP Value |
|---------|--------------|-------------------|-----------|
| Supply Chain Analyst | Monitor service levels, cycle times, inventory efficiency | Manual Excel crunching, slow iteration | Instant KPIs + AI insights |
| Operations Manager | Reduce delays & stockouts; improve OTD (On-Time Delivery) | Reactive decisions, limited visibility | Risk surfacing + narrative summaries |
| Inventory Planner | Optimize inventory turnover & positioning | Hard to correlate orders vs stock data quickly | Unified view + guided queries |
| Continuous Improvement Lead | Find systemic bottlenecks | Fragmented metrics | AI-generated prioritized recommendations |

---

## User Stories

### Data Ingestion & Preparation

1. As an Analyst, I can upload one or more CSV files containing orders / shipments / inventory so that I can generate metrics.
2. As a Planner, I want dates automatically parsed so I don’t need to reformat raw exports.
3. As a User, I want the app to gracefully ignore or flag malformed rows without crashing.

### Dashboard & KPIs

1. As an Operations Manager, I can view core KPIs (Fill Rate, Cycle Time, On-Time Rate, Inventory Turnover) after upload.
2. As an Analyst, I can view distribution of order statuses and inventory by location.
3. As a Planner, I can inspect order volume trends by day to spot seasonality or anomalies.
4. As a User, I want quick visual cues (cards/charts) that load within seconds after ingest.

### AI Assistant

1. As a Manager, I can ask natural-language questions about the current dataset.
2. As an Analyst, I receive AI answers with quantified metrics, not vague statements.
3. As a User, I can select from suggested prompt templates to accelerate analysis.
4. As a Risk Owner, I want AI to highlight delays, cancellations, backorders, and potential risk rate.
5. As a User, I need an explanation or clear error if the AI cannot answer due to missing data context.

### Session & Interaction

1. As a User, I can clear the AI conversation to start a new analytical thread.
2. As a User, I want to see 5–10 most recent conversation exchanges persisted in-memory during the session.

### Security & Access (MVP Minimal)

1. As a Product Owner, I need the Gemini API key protected via serverless proxy (or optional direct key for non-production experimentation).

### Performance & Reliability

1. As a User, I expect the initial KPI computation for typical mid-sized datasets (<50k rows) to complete <3s on first load.
2. As an Analyst, I expect AI responses to return within ~8s for standard queries (assuming upstream model latency nominal).

---

## Functional Requirements

### 1. Data Import & Validation

FR-1: Accept CSV upload(s) through UI (drag & drop or file picker).  
FR-2: Use Papa Parse to stream or parse entire file(s) into `DataRow` objects.  
FR-3: Date normalization attempts ISO and common US M/D/YYYY formats (`parseDate`).  
FR-4: Unknown / additional columns preserved via `[key: string]: any` for future extensibility.  
FR-5: Basic row-level robustness: skip or nullify invalid date fields; do not abort entire load.  
FR-6: Provide user feedback if zero valid rows are detected.

### 2. Data Model & Transformation

FR-7: Partition rows by `type` (order, shipment, inventory) for calculations.  
FR-8: Compute KPIs:

- Fill Rate = shipped/delivered orders ÷ total orders.
- Cycle Time = average (delivery_date - order_date) in days.
- On-Time Rate = shipments with ship_date ≤ required_shipping_date ÷ relevant shipments.
- Inventory Turnover = total shipped qty ÷ average inventory.  

FR-9: Produce chart datasets: order status distribution, inventory by location, order volume by day.  
FR-10: Provide raw `orders` subset for downstream drill-down components.

### 3. Dashboard UI

FR-11: Render KPI cards with numeric formatting (one decimal where relevant).  
FR-12: Render at least three chart types (status distribution, inventory by warehouse, volume over time).  
FR-13: Display orders table (initial subset or paginated if dataset large—MVP can show first N=1000).  
FR-14: Provide error or empty states when no data.

### 4. AI Assistant (Floating Chat & Analyst Panel)

FR-15: Summarization input includes structured JSON of dataset metrics & samples.  
FR-16: AI prompt includes explicit system instruction to avoid hallucinated data requests.  
FR-17: Provide feature cards / quick suggestions when chat is empty.  
FR-18: Maintain in-session message list (not persisted across reloads).  
FR-19: Graceful error fallback message on AI/network failures.  
FR-20: Mask API key presence check (`window.__fiqGeminiKeyInfo()`) without exposing full key.  
FR-21: If SDK client not initialized (missing key), fall back to `/api/gemini` proxy.  
FR-22: Support forced proxy mode via `VITE_GEMINI_USE_PROXY=true`.  
FR-23: AI output rendering: preserve line breaks, support simple markdown-like tables if generated.

### 5. Serverless AI Proxy

FR-24: POST `/api/gemini` accepts `{ systemInstruction?, userContent, model? }`.  
FR-25: Use primary model `gemini-1.5-flash` with fallback to `gemini-1.5-pro` on 404.  
FR-26: Return structured JSON: `{ text }` on success; `{ error, status, details? }` on error.  
FR-27: Reject non-POST with 405.  
FR-28: Respond 401 if server API key missing.

### 6. Reliability & Error Handling

FR-29: Log (console) meaningful diagnostics for proxy failures (model errors, missing key, parse errors).  
FR-30: User-facing messages must not leak internal stack traces or full upstream payloads.  
FR-31: Empty Gemini candidate response returns user-safe message.

### 7. Configuration & Environment

FR-32: Support both `GEMINI_API_KEY` (server) and `VITE_GEMINI_API_KEY` (client) injection.  
FR-33: If both present and force proxy flag disabled, prefer client SDK for latency.  
FR-34: Document environment setup in README (developer onboarding).

### 8. Performance (MVP Targets)

FR-35: Initial bundle loads in <2.5s on a 10 Mbps connection (stretch: code-split AI chat later).  
FR-36: Data processing for 50k order lines finishes <3s (chrome mid-tier laptop reference).  
FR-37: AI requests average round-trip <8s (excluding upstream slowdowns >4s).

### 9. Security & Privacy

FR-38: Avoid embedding server key in client when proxy mode active.  
FR-39: Do not log raw API keys to console.  
FR-40: Only hold uploaded data in memory; clear references on page reload or user manual refresh.

### 10. UX & Accessibility

FR-41: Keyboard submission (Enter to send, Shift+Enter for newline) in chat.  
FR-42: Focus management: when chat opens, input should be focusable without mouse.  
FR-43: Color contrast of KPI cards & chat bubbles meets WCAG AA (approx.).  
FR-44: Loading indicators (spinners) visible for async operations >300ms.

---

## Non-Functional Requirements (NFRs)

| Category | Requirement |
|----------|------------|
| Performance | See FR-35..37; optimize DOM diffing & avoid unnecessary re-renders in chat & charts |
| Reliability | Proxy must degrade gracefully; no unhandled promise rejections |
| Scalability | Stateless front-end & serverless scaling per invocation |
| Security | Key isolation via proxy fallback; no secrets in version control |
| Observability | Console logs for AI proxy errors; roadmap: structured logging & metrics |
| Maintainability | Clear modular separation (`services`, `utils`, `components`) |
| Extensibility | DataRow flexible index signature allows future attributes |
| Accessibility | Basic ARIA roles on interactive buttons & alt text for images/logo |
| Localization | English only (MVP); prompts semantically stable for future i18n |
| Privacy | No persistence of user data; all ephemeral in session |

---

## Out of Scope (MVP)

- User authentication & role-based access.
- Multi-tenant persistent storage or historical session recall.
- Real-time streaming updates (WebSockets / event bus).
- Predictive ML models (ETA forecasting, anomaly detection) beyond AI narrative.
- Export of AI answers as PDF/PowerPoint.
- Fine-grained prompt editing history or versioning.
- Mobile-optimized layout (responsive minimal, not fully mobile-first).
- Internationalization / multi-language AI guidance.
- Data lineage and audit logs.
- SSO / enterprise identity integration.


---

## Success Metrics (Post-MVP)

| Metric | Definition | Target (First 60 Days) |
|--------|------------|------------------------|
| Time-to-Insight | Time from CSV upload to first KPI render | < 5s median |
| AI Engagement Rate | % sessions with ≥1 AI query | > 60% |
| AI Response Utility Rating | User qualitative rating (1–5) | ≥ 3.8 average |
| Query Success Rate | % AI calls returning non-error response | > 95% |
| Data Processing Error Rate | % uploads failing parsing or KPI generation | < 2% |
| Return Sessions | Users returning within 14 days (pilot cohort) | > 40% |
| Proxy Fallback Coverage | % AI calls successfully falling back when client key absent | > 99% |
| Bundle First Load | Time to interactive over 10 Mbps | < 2.5s (desktop) |

---

## Acceptance Criteria (Representative)

1. Uploading a valid CSV with order, shipment, inventory rows populates all four KPIs.
2. AI assistant returns a bulleted set of quantified insights for a risk query including at least one table if structure exists.
3. Removing `VITE_GEMINI_API_KEY` and enabling `VITE_GEMINI_USE_PROXY=true` still allows successful AI responses.
4. Invalid date strings do not crash processing (they resolve to null and KPIs still compute for valid rows).
5. A missing server key produces a 401 JSON error from `/api/gemini` (not a generic 500) and a user-facing fallback message.
6. Chat input disables while AI request in-flight and re-enables after completion or error.
7. Cycle Time shows `N/A` if there are zero delivered orders.
8. On-Time Rate calculation excludes shipments without `required_shipping_date`.
9. Risk summary includes delayed + cancelled + backordered counts and percentage.
10. No API key literal appears in any built JavaScript asset when proxy-only mode is used.


---

## Risks & Mitigations (Product View)

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI hallucination of nonexistent metrics | Misleading decisions | Constrained prompt + explicit dataset summary + disclaimers |
| Large CSV memory footprint | Browser performance degradation | Stream parsing & potential future pagination |
| Vendor API rate limits | Degraded AI experience | Add caching & exponential backoff (post-MVP) |
| Unstructured user CSV formats | Parsing failures | Schema heuristic + validation feedback roadmap |
| Scope creep toward full ERP | Delayed MVP | Strict MVP out-of-scope tracking |

---

## Future Enhancements (Post-MVP Backlog Seeds)

- Persistent dataset library + versioning.
- User auth & org-level tenancy.
- Real-time streaming of sensor / IoT / WMS events.
- Predictive delay & stockout scoring models.
- AI response feedback loop (thumbs up/down + retraining signals collection).
- Prompt templating marketplace (save & reuse analyses).
- Multi-lingual output and localized KPI descriptions.
- Export: PDF, CSV (derived metrics), JSON API.
- Notebook-style collaborative analysis mode.


---

## Approval & Stakeholders

| Role | Name/Placeholder | Responsibility |
|------|------------------|----------------|
| Product Manager | (You) | Scope, prioritization, success metrics |
| Tech Lead / Architect | (Engineer Lead) | System design & technical debt governance |
| Frontend Developer | (Dev A) | UI implementation & performance |
| Backend/Serverless Dev | (Dev B) | Proxy & future persistence |
| QA / Test | (QA Lead) | Acceptance validation |
| Data/AI Engineer | (AI Specialist) | Prompt hardening & model evaluation |

---

## Summary

This PRD defines the MVP scope for an AI-augmented supply chain analytics control tower: rapid data onboarding, instant KPI discovery, and conversational insight extraction. It balances speed-to-market with a secure AI integration while clearly deferring persistence, auth, and advanced predictive features to future iterations.

*End of document.*
