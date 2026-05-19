# PRISM D1: Velocity — Customer Qualification & Onboarding

> Artifact-level assessment — not a survey, a real score.

## Assessment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    QUALIFICATION                             │
│                                                              │
│  Customer Repo ──→ prism-cli assessment run ──→ Score (0-100)│
│                          12 categories, real artifacts        │
│                                                              │
│  SA Interview ──→ AI Agent (assessment web) ──→ Score (0-100)│
│                     20 questions, 6 sections                 │
│                                                              │
│  Org Readiness ──→ 5 binary factors ──→ Org Score (0-20)    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                     SCORING                                  │
│                                                              │
│  Blended = 40% Scanner + 40% Interview + 20% Org Readiness  │
│                         │                                    │
│                    PRISM D1 Level (L1.0 – L5.0)             │
│                         │                                    │
│                    Verdict:                                   │
│                    • READY_FOR_PILOT (≥L2.0, org≥12)        │
│                    • NEEDS_FOUNDATIONS (≥L1.5, org≥8)        │
│                    • NOT_QUALIFIED (below thresholds)         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    ONBOARDING                                │
│                                                              │
│  Track A: Foundations ──→ Modules 00-02, 2wk pre-work       │
│  Track B: Full Workshop ──→ All modules, 8-week pilot       │
│  Track C: Accelerated ──→ Modules 03-05, targeted gaps      │
│  Track D: Advanced ──→ Custom engagement, L4+ optimization   │
└─────────────────────────────────────────────────────────────┘
```

## How to Run an Assessment

There are two paths depending on who conducts the interview:

### Path 1: CLI Scan → Hand off to SA

Run the repo scanner yourself, then send the results to an SA who will conduct the interview and complete the assessment.

```bash
# Scan the customer's repo and export JSON for the SA
./prism-cli.sh assessment run --repo ~/customer-repos/acme-app --output json --output-file acme-scan.json --verbose
```

The SA imports `acme-scan.json` into the web UI, conducts the interview, and generates the final report.

### Path 2: Self-Service via Web UI

Run the entire assessment yourself — scan, interview, scoring, and report — through the interactive web app:

```bash
./prism-cli.sh assessment web
```

Open `http://localhost:3120`, paste the customer's repo path (or import a JSON scan), then walk through the AI-guided interview. The app scores everything in real-time and generates a downloadable report at the end.

---

## Quickstart

To run any assessment workflow, use `prism-cli`:

```bash
./prism-cli.sh <category> <command> [options]
```

## CLI Commands Reference

### `assessment` — Customer assessment tools

| Command | Description |
|---------|-------------|
| `assessment run` | Run the repo scanner against a customer's codebase |
| `assessment web` | Launch the interactive assessment web UI |

#### `assessment run`
```bash
./prism-cli.sh assessment run --repo /path/to/repo --output json --output-file report.json
```
| Option | Description | Default |
|--------|-------------|---------|
| `-r, --repo <path>` | Path to git repository to scan | `.` |
| `-o, --output <format>` | Output format: `console`, `json`, `markdown` | `console` |
| `-f, --output-file <path>` | Write report to file | — |
| `-v, --verbose` | Show timing and detailed evidence | `false` |

#### `assessment web`
```bash
./prism-cli.sh assessment web --port 3120
```
Launches the full assessment UI with AI-powered interview agent (Bedrock Claude). Includes:
- **Repo scanner** — paste a repo path or import JSON scan results
- **AI interview** — conversational agent asks 20 questions across 6 sections, scores responses in real-time
- **Org readiness** — 5 binary qualification factors
- **Blended scoring** — 40% scanner + 40% interview + 20% org readiness → PRISM level + verdict
- **Onboarding routing** — auto-assigns Track A-D based on score and gaps
- **Report generation** — downloadable HTML/JSON/Markdown customer-facing report

| Option | Description | Default |
|--------|-------------|---------|
| `--port <number>` | Port to serve on | `3120` |

---

## Reference Documentation

| Document | Purpose |
|----------|---------|
| [ASSESSMENT-GUIDE.md](ASSESSMENT-GUIDE.md) | Full methodology: scanner categories, interview rubrics, scoring formula |
| [interview/interview-guide.md](interview/interview-guide.md) | 20 questions with scoring rubrics (0-5 per question) |
| [interview/scoring-sheet.md](interview/scoring-sheet.md) | Printable scoring sheet for manual interviews |
| [interview/pre-interview-checklist.md](interview/pre-interview-checklist.md) | SA prep checklist |
| [scoring/qualification-matrix.md](scoring/qualification-matrix.md) | Level thresholds and verdict criteria |
| [scoring/level-definitions.ts](scoring/level-definitions.ts) | L1.0–L5.0 definitions with evidence markers |
| [onboarding/tracks.md](onboarding/tracks.md) | Track A-D definitions and routing logic |
| [onboarding/email-templates.md](onboarding/email-templates.md) | 5 SA email templates for customer comms |
| [onboarding/pre-work/](onboarding/pre-work/) | Track-specific pre-work checklists |

## Sample Reports

See `reports/sample-reports/` for realistic assessment examples:

| Sample | Company | Level | Verdict | Track | Report |
|--------|---------|-------|---------|-------|--------|
| [L1.5](reports/sample-reports/sample-l1.5-startup.json) | NovaPay (Series A, 6 eng) | L1.5 | NEEDS_FOUNDATIONS | A | [PDF](reports/sample-reports/pdf/novapay-l1.5-assessment.pdf) \| [HTML](reports/sample-reports/pdf/novapay-l1.5-assessment.html) |
| [L2.5](reports/sample-reports/sample-l2.5-startup.json) | Arcline Health (Series B, 14 eng) | L2.5 | READY_FOR_PILOT | B | [PDF](reports/sample-reports/pdf/arcline-health-l2.5-assessment.pdf) \| [HTML](reports/sample-reports/pdf/arcline-health-l2.5-assessment.html) |
| [L3.5](reports/sample-reports/sample-l3.5-startup.json) | Vectrix AI (Series C, 28 eng) | L3.5 | READY_FOR_PILOT | C | [PDF](reports/sample-reports/pdf/vectrix-ai-l3.5-assessment.pdf) \| [HTML](reports/sample-reports/pdf/vectrix-ai-l3.5-assessment.html) |

## Deprecated Code (to be removed)

The following `.ts` files in this directory are **superseded by the CLI** and should not be used directly:

- `scanner/` → replaced by `cli/src/scanner/`
- `scoring/scoring-model.ts` → logic embedded in `cli/src/commands/assessment/web.ts`
- `onboarding/onboarding-router.ts` → logic embedded in `cli/src/commands/assessment/web.ts`
- `reports/report-generator.ts` → logic embedded in `cli/src/commands/assessment/web.ts`
