# Testing Strategy

## Overview

This document defines the testing approach for the FIQ Control Tower (React + Vite + TypeScript) application. It ensures core data processing, AI-assisted analytics, UI integrity, and performance objectives are reliably validated before releases.

## Guiding Principles

- Shift-left: write fast unit tests for pure logic (e.g., `dataProcessor`).
- Deterministic: isolate AI calls behind mock layers; never hit external APIs in CI.
- Representative datasets: use synthetic CSV fixtures that mimic real shape/edge cases.
- Fast feedback: <10 min full test suite target; <30s for unit subset on local dev.
- Clear ownership: each failure points to a maintainable code unit with minimal flakiness.

---

## Test Types & Scope

| Type | Target | Tools | Goal |
|------|--------|-------|------|
| Unit | Pure functions (data parsing, KPI math) | Vitest (or Jest) | Correctness & edge cases |
| Component | React components (cards, charts, modal) | @testing-library/react + Vitest | Render logic & state transitions |
| Integration | File upload → KPI propagation → AI prompt assembly (mock AI) | Vitest + DOM testing | Data flow integrity |
| End-to-End (E2E) | User workflows in browser (upload, view KPIs, ask AI) | Playwright (preferred) or Cypress | Regression of core journeys |
| Performance | Data ingestion time, AI request round-trip (mock timing), bundle size | Custom scripts + Lighthouse | Validate non-functional targets |
| Accessibility | Critical screens (dashboard, AI chat) | axe-core / playwright-axe | AA-level issues surfaced |

---

## Tooling Selection

Because Vite is already in place, adopt **Vitest** (drop-in compatibility, ESM-native). Add Playwright for E2E due to rich trace artifacts + parallelism.

### Dependencies to Add

- `vitest` + `@testing-library/react` + `@testing-library/user-event`
- `jsdom` (Vitest environment)
- `playwright` (and `@axe-core/playwright` optionally)
- `ts-node` (if needed for test utilities)

Add npm scripts:

- `test`: `vitest run`
- `test:watch`: `vitest`
- `test:coverage`: `vitest run --coverage`
- `e2e`: `playwright test`

---
 
## Unit Testing Guidelines

Focus first on `utils/dataProcessor.ts` and any KPI math.

### Targets

- Date parsing resilience (valid formats, invalid strings → null).
- KPI Calculations:
  - Fill Rate edge: zero orders → 0 or `NaN`? Ensure explicit default (0).
  - Cycle Time: no delivered orders → `null` or `N/A` handler.
  - On-Time Rate: exclude rows missing `required_shipping_date`.
  - Inventory Turnover: division-by-zero guard.
- Chart dataset shaping: empty inputs → empty arrays, not exceptions.

### Structure

```text
/ tests
  /unit
    dataProcessor.test.ts
```

### Patterns

- Use table-driven tests for multiple date formats.
- Assert numeric precision (1 decimal where required) using a helper `expectClose(actual, expected, delta=0.01)`.
- Avoid random values; use fixed fixtures.

---
 
## Component Testing

Use React Testing Library (RTL) to validate rendering & interactive behavior.

### Component Targets

- KPI Cards: correct formatting when numbers present / `N/A` fallback.
- DataMapping / Upload flow: shows error state on malformed CSV.
- AI Chat components: disabled state while "loading"; error message branch.
- Charts: presence of correct SVG elements given mock data.

### Techniques

- Mock `geminiService` methods returning static responses.
- Use accessible queries (`getByRole`, `getByText`) for stability.
- Snapshot testing only for tight layout regressions (minimal usage—prefer semantic assertions).

---
 
## Integration Tests

Validate multi-module interaction without full browser stack.

### Example Flow: CSV Upload → KPI Render

1. Mock file input with sample CSV string.
2. Simulate parse and state propagation.
3. Assert KPI context/store values accessible to downstream components.

### AI Prompt Assembly

- Feed mock dataset into `geminiService.analyzeData`.
- Assert prompt payload (system + user composition) includes key metrics.
- Guarantee no raw API key present in constructed messages.

### Error Path

- Simulate proxy JSON error → component renders non-technical message.

---
 
## End-to-End (E2E) Testing

Use Playwright.

### Core Journeys

| ID | Scenario | Steps (High-Level) | Assertions |
|----|----------|--------------------|------------|
| E2E-1 | Upload & KPIs | Visit root → Upload valid CSV | KPI cards show 4 metrics |
| E2E-2 | Malformed Rows | Upload CSV with invalid dates | Warning/state still shows valid KPIs |
| E2E-3 | AI Basic Query | After upload, ask "Summarize risks" | AI panel returns text containing counts |
| E2E-4 | Proxy Fallback | Start with no client key (env) | AI response still appears (proxy path) |
| E2E-5 | Large Dataset | Upload synthetic 50k rows | Processing finishes <3s & UI responsive |
| E2E-6 | Clear Conversation | Interact then clear chat | Conversation list empties |

### Artifacts

- Enable HTML trace & video for failures.
- Store Playwright report in `./playwright-report/`.

### Stability

- Use deterministic test CSVs under `tests/fixtures/`.
- Network: mock Gemini calls via service worker or route interception returning canned JSON.

---
 
## Performance Testing

Lightweight criteria during CI + deeper periodic manual runs.

### KPIs

| Aspect | Target | Method |
|--------|--------|--------|
| Parse & KPI compute (50k rows) | <3s local dev mid-tier laptop | Node script invoking `dataProcessor` with fixture |
| First Meaningful Paint | <2.5s @ 10Mbps (desktop) | Lighthouse CI (budget.json) |
| AI Round-trip (mock) | <8s | Inject artificial latency measure wrapper |
| Bundle size (JS) | <900kB initial | `vite build --report` + size budget check |

### Implementation Notes

- Add a `scripts/perf/` folder with node harness measuring compute time.
- Use `performance.now()`; fail test if threshold exceeded.

---
 
## Accessibility Testing

Automate basic checks early.

- Run axe on dashboard & AI modal (Playwright after state ready).
- Flag color contrast issues (manual review for charts if automated check insufficient).

---
 
## Test Data Management

| Fixture | Purpose |
|---------|---------|
| `orders_small.csv` | Happy path minimal set |
| `orders_invalid_dates.csv` | Date parsing resilience |
| `orders_large_50k.csv` | Performance boundary |
| `orders_missing_required_cols.csv` | Error messaging path |
| `mixed_inventory_shipments.csv` | Chart diversity |

Fixtures stored in `tests/fixtures/`. Large dataset may be generated via script to avoid repo bloat (optional generation script `generate_large_fixture.ts`).

---
 
## Environment & Configuration

- Vitest config in `vitest.config.ts` using `jsdom` environment.
- Playwright config `playwright.config.ts` with retries=1 on CI, workers=auto.
- Use `.env.test` to inject a dummy placeholder for AI key (never real key).
- For proxy fallback tests, explicitly unset `VITE_GEMINI_API_KEY` and set `VITE_GEMINI_USE_PROXY=true`.

---
 
## Mocking Strategy

| Layer | Approach |
|-------|----------|
| Gemini SDK | Mock module export returning resolved Promise with deterministic text |
| Fetch `/api/gemini` | Intercept via Playwright route or Vitest `vi.spyOn(global, 'fetch')` |
| Time | Use `vi.useFakeTimers()` only for debounce/timer logic (avoid in React concurrent features unless needed) |
| File Upload | Create `File` objects from fixture strings |

---
 
## Code Coverage

- Target: 80% statements / 75% branches for `utils` and `services`.
- Exclude: generated files, config, purely presentational dumb components (optional).
- Enforce via `--coverage` + threshold in `vitest.config.ts`.

---
 
## Continuous Integration (Future)

Add workflow steps (GitHub Actions example):

1. Install deps & cache.
2. Lint (if ESLint added later) + type-check (`tsc --noEmit`).
3. Run `vitest run --coverage`.
4. Run `playwright install --with-deps && playwright test`.
5. Build (`vite build`) and attach size report artifact.
6. (Optional) Lighthouse CI against `vite preview` with budgets.

---
 
## Performance Regression Guard (Optional Early Script)

Example pseudocode for a perf harness:

```ts
import { performance } from 'node:perf_hooks';
import { processData } from '../src/utils/dataProcessor';
import fs from 'node:fs';

const csv = fs.readFileSync('tests/fixtures/orders_large_50k.csv','utf8');
const start = performance.now();
processData(csv); // hypothetical unified parse+compute wrapper
const ms = performance.now() - start;
if (ms > 3000) {
  console.error(`Performance regression: ${ms.toFixed(0)}ms > 3000ms target`);
  process.exit(1);
}
```

---
 
## Bug Reporting Procedures

### Definition of a Good Bug Report

| Field | Description |
|-------|-------------|
| Title | Concise summary of the issue & impact |
| Environment | Browser, OS, build hash/commit SHA |
| Steps to Reproduce | Numbered, deterministic actions |
| Expected Result | What should have happened |
| Actual Result | What actually happened (include screenshot/log snippet) |
| Severity | P1 (blocking) → P4 (minor cosmetic) |
| Affected Data Scope | Only current session? All datasets? |
| Attachments | CSV fixtures, console logs, network trace if relevant |

### Triage Workflow

1. Intake in issue tracker with labels: `bug`, `area:ai`, `area:ingest`, `area:ui`, `severity:P?`.
2. Reproduce locally using provided fixture or steps.
3. If not reproducible, request clarifying info (logs, dataset sample).
4. Assign ownership (module lead) and set target fix milestone.
5. Add regression test (unit/integration/E2E) that fails before fix and passes after.
6. Close with reference to commit and test ID.

### Severity Guidelines

| Level | Description | Examples |
|-------|-------------|----------|
| P1 | Complete loss of core path | Upload fails for all CSVs; AI crashes app |
| P2 | Major feature degraded | KPI miscalculation; proxy fallback unreliable |
| P3 | Minor functional issue | Chart label truncation, sporadic warning |
| P4 | Cosmetic / low impact | Spacing, minor copy typo |

---
 
## Risk Mitigation via Testing

| Risk | Test Mitigation |
|------|----------------|
| Incorrect KPI math | Unit tests with edge fixtures |
| AI hallucination leakage | Assert prompt template & redact keys |
| Proxy fallback broken | Integration + E2E without client key |
| Large dataset performance | Perf harness + E2E large upload |
| Silent parse failures | Tests for malformed CSV producing warnings |

---
 
## Maintenance & Review

- Quarterly review of test gaps vs new features (architecture & PRD alignment).
- Remove obsolete snapshots & deprecated fixtures.
- Track flakiness: if a test flakes >2 times per month, stabilize or quarantine.

---
 
## Roadmap (Future Enhancements)

- Add ESLint + lint-staged integration.
- Snapshot visual regression (Chromatic or Playwright screenshots) for critical charts.
- Synthetic monitoring of deployed preview (cron hitting health & basic flow).
- Contract tests if/when backend persistence/API added.

---
*End of testing strategy.*
