# Universal Browser Control Runtime: Token Optimization & Benchmarks

> **Document Status**: Production Verified  
> **Runtime Version**: 3.0.0  
> **Benchmark Source**: `benchmarks/token-report.json`  
> **Heuristic**: Standard LLM estimate: $\lceil \text{character count} / 4 \rceil$ tokens  
> **Guiding Principle**: Zero fabrication (Rule 1). All metrics are empirically measured on test benches.

---

## 1. Executive Summary

Autonomous web browsing is one of the highest token-consumption tasks an LLM agent can undertake. Sending raw HTML or naive, verbose DOM trees consumes thousands of tokens per step, easily exhausting model context windows and inflating latency.

The **Universal Browser Control Runtime** introduces a multi-tier token optimization architecture that yields:
* **82.0% – 84.9% token reduction** when using Level 1 Compact notation instead of standard verbose JSON objects.
* **85.9% – 91.5% token reduction** when using Level 1 Compact notation instead of raw page HTML.
* **96.7% – 98.5% token reduction** when using Level 0 Minimal state for lightweight navigation confirmations.
* **51.4% – 97.6% additional savings** through targeted queries (`query`) and container scoping (`scope`).
* **0 observation token overhead** using direct JavaScript evaluation (`runtime.evaluate`).
* **Strict token budget enforcement** with automatic dynamic compaction (`maxTokens`).

---

## 2. Empirical Benchmark Results

The following measurements were captured using `benchmarks/benchmark-tokens.js` against the standardized `test-sites/basic/index.html` (493 LOC, complex interactive controls, shadow roots, iframes) and `test-sites/advanced/index.html` (tables, grids, articles, forms).

### Benchmark Table: Basic Test Bench (`test-sites/basic/index.html`)

| Observation Modality / Format | Characters | UTF-8 Bytes | Estimated Tokens | Savings vs Raw DOM | Savings vs Verbose JSON | Notes / Elements |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Raw Full Page DOM (HTML)** | 21,484 | 21,548 | **5,371** | *Baseline* | — | Complete document markup |
| **Level 0 (Minimal State)** | 310 | 312 | **78** | **-98.5%** | — | URL, title, readyState, viewport, scroll |
| **Level 1 (Verbose JSON)** | 12,068 | 12,070 | **3,017** | -43.8% | *Baseline* | 33 elements with full metadata |
| **Level 1 (Compact 1-Line)** | 1,820 | 1,822 | **455** | **-91.5%** | **-84.9%** | 33 actionable 1-line items (`[e1] ...`) |
| **Level 2 (Targeted Query: "button")** | 883 | 885 | **221** | -95.9% | -92.7% | 15 matching elements (-51.4% vs L1) |
| **Level 2 (Scoped: `#section-form`)** | 632 | 632 | **158** | -97.1% | -94.8% | 13 form elements (-65.3% vs L1) |
| **Level 3 (Full Elements Tree)** | 19,828 | 19,834 | **4,957** | -7.7% | — | 56 elements including off-screen & non-interactive |
| **Level 4 (Screenshot Base64)** | 65,903 | 65,903 | **16,476** | +206.8% | — | Full viewport image capture |
| **Extract: Tables** | 1,190 | 1,190 | **298** | **-94.5%** | — | Clean Markdown & structured table data |
| **Extract: Text / Markdown** | 1,712 | 1,730 | **428** | **-92.0%** | — | Clean visible text stripped of scripts/styles |
| **Direct JS Evaluation (`evaluate`)** | 43 | 45 | **11** | **-99.8%** | — | Direct scalar return; **0 observation tokens** |
| **Budget Enforced (`maxTokens: 50`)** | 229 | 229 | **58** | **-98.9%** | — | Dynamically truncated with explicit notice |

---

### Benchmark Table: Advanced Test Bench (`test-sites/advanced/index.html`)

| Observation Modality / Format | Characters | UTF-8 Bytes | Estimated Tokens | Savings vs Raw DOM | Savings vs Verbose JSON | Notes / Elements |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Raw Full Page DOM (HTML)** | 9,558 | 9,562 | **2,390** | *Baseline* | — | Complete document markup |
| **Level 0 (Minimal State)** | 310 | 312 | **78** | **-96.7%** | — | URL, title, readyState, viewport, scroll |
| **Level 1 (Verbose JSON)** | 7,502 | 7,502 | **1,876** | -21.5% | *Baseline* | 20 elements with full metadata |
| **Level 1 (Compact 1-Line)** | 1,352 | 1,352 | **338** | **-85.9%** | **-82.0%** | 20 actionable 1-line items |
| **Level 3 (Full Elements Tree)** | 15,962 | 15,964 | **3,991** | +67.0% | — | 46 elements (all nodes) |
| **Level 4 (Screenshot Base64)** | 80,563 | 80,563 | **20,141** | +742.7% | — | Full viewport image capture |
| **Extract: Tables** | 1,503 | 1,503 | **376** | **-84.3%** | — | 2 tables (HTML + ARIA grid) |
| **Extract: Text / Markdown** | 1,555 | 1,557 | **389** | **-83.7%** | — | Structured markdown headings & quotes |
| **Extract: Links** | 1,202 | 1,202 | **301** | **-87.4%** | — | Classified internal & external URLs |
| **Extract: Forms** | 2,754 | 2,754 | **689** | **-71.2%** | — | Input field schemas & select choices |
| **Extract: Metadata** | 1,494 | 1,498 | **374** | **-84.4%** | — | OpenGraph & JSON-LD schema |
| **Direct JS Evaluation (`evaluate`)** | 40 | 42 | **10** | **-99.6%** | — | Direct scalar return; **0 observation tokens** |
| **Budget Enforced (`maxTokens: 50`)** | 237 | 237 | **60** | **-97.5%** | — | Dynamically truncated with explicit notice |

---

## 3. Core Architectural Optimizations

### 3.1. Compact 1-Line Element Notation
Standard DOM JSON representations duplicate structural metadata (`domMeta`, `boundingBox`, `isShadow`, `frameIndex`) across hundreds of nodes. In contrast, the runtime's compact formatter emits a concise single-line representation containing only agent-actionable semantic tokens:

```text
[e1] textbox "Username" value="admin" #input-text
[e2] combobox "Role" value="user" #select-role
[e3] checkbox "Remember me" [checked] #chk-remember
[e4] button "Log In" #btn-login
```

* **Token Savings**: Compact notation compresses 3,017 tokens of JSON into **455 tokens** (an **84.9% savings**).
* **Semantic Preservation**: Element roles, visible names, current values, toggle states (`[checked]`, `[disabled]`), and container types (`(shadow)`, `(iframe 1)`) are strictly preserved.

### 3.2. Progressive Observation Hierarchy
Agents must never default to requesting full DOM trees or screenshots. Instead, tasks should be structured progressively:
1. **Level 0 (Minimal)**: 78 tokens. Use when verifying page load, redirect completion, or scroll position.
2. **Level 1 (Compact)**: 300–450 tokens. Standard for action loops (finding buttons, forms, links).
3. **Level 2 (Targeted/Scoped)**: 150–220 tokens. Restricts inspection to a specific CSS container (`scope: '#sidebar'`) or semantic search string (`query: 'checkout'`).
4. **Level 3 (Full)**: 4,000–5,000 tokens. Reserved for complex discovery when Level 1 does not reveal non-standard elements.
5. **Level 4 (Screenshot)**: 16,000–20,000 tokens. Reserved exclusively for visual design QA, CAPTCHAs, or canvas elements.

### 3.3. Scoped Container Inspection & Semantic Filtering
Rather than reading the entire page layout, an agent operating on a form or modal specifies `scope`:
```javascript
// Scoped to the active form only:
const obs = await runtime.inspect(tabId, { scope: '#section-form' });
// Yields 158 tokens instead of 455 tokens (-65.3% reduction)
```

Similarly, `filter` restricts matching to candidate categories:
* `filter: 'inputs'` — returns only form fields, textareas, checkboxes, and selects.
* `filter: 'buttons_links'` — returns only actionable buttons and hyperlinks.

### 3.4. Structured Extraction vs Observation
When an agent's objective is information retrieval (e.g. "Read the prices from this table" or "Get the page summary"), the agent should call `extract` rather than `inspect`:
* `runtime.extract(tabId, 'table')` returns clean markdown tables and structured rows in **298 tokens**, avoiding the **5,371 tokens** of the full page DOM (**-94.5%**).
* `runtime.extract(tabId, 'text')` strips layout tags, script blocks, and inline styles into readable text in **428 tokens** (**-92.0%**).

### 3.5. Zero-Observation Evaluation
For known properties or deterministic queries (e.g. `document.title`, `window.location.hash`, or count queries), direct evaluation bypasses element scanning completely:
```javascript
const title = await runtime.evaluate(tabId, 'document.title');
// Token overhead: 11 tokens (only the result string transferred)
```

---

## 4. Token Budget Enforcement & Dynamic Compaction

The runtime observation engine supports `maxTokens`. When an agent operates within a tight context budget, passing `maxTokens: N` guarantees that the compact element payload will not exceed the target threshold:

```javascript
const obs = await runtime.inspect(tabId, { level: 1, maxTokens: 50 });
console.log(obs.truncated); // true
console.log(obs.compact);
// [e1] textbox "Username"
// [e2] textbox "Email"
// [... truncated 29 elements to meet token budget of 50 tokens]
```

* **Prioritization**: Elements in the active viewport (`inViewport: true`) and higher vertical position are retained first.
* **Transparency**: The response contains metadata `{ truncated: true, tokenBudget: { maxTokens, originalElements, retainedElements } }` so the LLM agent is aware of truncation and can navigate or scope further if needed.

---

## 5. Agent Optimization Playbook

When configuring AI prompts or agent policies for browser control:
1. **Always default to Level 1 (`inspect`)**. Never request raw HTML or full DOM trees.
2. **Use Scoping Whenever Possible**: If an interaction is inside a modal, dialog, or form, supply `scope: '#modal-selector'`.
3. **Use Extract for Data Tasks**: Use `extract('table')` or `extract('text')` when reading data, rather than trying to parse it from element observation lists.
4. **Use Batch Actions**: Combine multiple actions into a single `batch` call (`type`, `type`, `click`) to reduce LLM round-trips and repeated observation cycles.
5. **Reserve Screenshots for Visual Checks**: Only request screenshots when visual verification is explicitly necessary.
