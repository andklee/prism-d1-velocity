# Module 04: Instrumenting AI Metrics

| | |
|---|---|
| **Duration** | 45 minutes |
| **Prerequisites** | Module 02 complete (working sample-app with AI-assisted commits) |
| **Learning Objective** | Install git hooks and CI steps that emit enhanced DORA metrics to the PRISM pipeline |

---

## Instructor Facilitation Guide

### [0-10 min] The 6 AI-DORA Metrics

> **Instructor Note:** Put the metric table on the projector and leave it up for the entire module. Participants will reference it repeatedly.

PRISM extends the standard 4 DORA metrics with 2 AI-specific metrics, giving you 6 total:

| # | Metric | What It Measures | Source |
|---|--------|-----------------|--------|
| 1 | **Deployment Frequency** | How often you ship to production | CI/CD pipeline events |
| 2 | **Lead Time for Changes** | Time from commit to production | Git timestamps + deploy timestamps |
| 3 | **Change Failure Rate** | % of deployments causing incidents | Incident system + deploy events |
| 4 | **Mean Time to Recovery** | How fast you recover from failures | Incident open/close timestamps |
| 5 | **AI Contribution Ratio** | % of commits/PRs with AI involvement | Git trailer `AI-Origin` |
| 6 | **AI Acceptance Rate** | % of AI-generated code that passes review/eval | PR reviews + eval gate results |

**Key talking points:**

1. Metrics 1-4 are standard DORA. If you already track these, PRISM enhances them with AI context (e.g., "deployment frequency *of AI-assisted changes* vs. human-only").

2. Metric 5 (AI Contribution Ratio) answers: "How much of our velocity comes from AI?" This is what your CTO wants to show the board.

3. Metric 6 (AI Acceptance Rate) answers: "Is our AI output actually good, or are we generating code that gets reverted?" A team with 80% AI contribution but 30% acceptance rate has a garbage problem, not a velocity gain.

4. All 6 metrics start with **data captured at commit time**. That's why the git hooks we're about to install are the foundation of everything.

---

### [10-15 min] How Metadata Flows

Draw the data flow on the whiteboard:

```
Developer Machine              GitHub                 AWS
┌──────────────────┐   ┌────────────────┐   ┌────────────────────────┐
│ prepare-commit-msg│   │ GitHub Actions │   │ EventBridge            │
│ hook: adds AI     │──>│ workflow:      │──>│ Rule matches           │
│ trailers to commit│   │ extracts       │   │ ai-metric events       │
│                   │   │ trailers,      │   │        │               │
│ post-commit hook: │   │ emits metric   │   │        v               │
│ logs locally      │   │ event to       │   │ Timestream (store)     │
└──────────────────┘   │ EventBridge    │   │        │               │
                        └────────────────┘   │        v               │
                                              │ CloudWatch Dashboard  │
                                              │ QuickSight Dashboard  │
                                              └────────────────────────┘
```

Explain each stage:
1. **prepare-commit-msg hook** -- Runs before the commit message editor opens. Detects if Claude Code was the author and automatically adds AI-Origin, AI-Model, and AI-Confidence trailers.
2. **post-commit hook** -- Runs after commit. Logs the commit metadata to a local file (useful for offline work).
3. **GitHub Actions workflow step** -- On push/merge, extracts trailers from all new commits and emits structured events to Amazon EventBridge.
4. **EventBridge rule** -- Routes `ai-metric` events to Timestream for storage.
5. **Dashboards** -- CloudWatch and QuickSight query Timestream and render the 6 metrics.

> **Instructor Note:** Participants will install steps 1-3 today. Steps 4-5 are pre-deployed in the workshop AWS account (or covered in Module 05's CDK deploy).

---

### [15-25 min] Exercise 1: Install PRISM Git Hooks

Direct participants to `exercises/01-install-hooks.md`.

They will:
1. Copy the hook scripts into their sample-app `.git/hooks/` directory
2. Make a test commit and verify the trailers are auto-added
3. Understand the detection logic

> **Instructor Note:** The most common issue is file permissions. The hook scripts must be executable (`chmod +x`). If a participant's commit goes through without trailers, check permissions first.

---

### [25-35 min] Exercise 2: Make 3 Types of Commits

Direct participants to `exercises/02-three-commits.md`.

They will:
1. Make a **human-only** commit (edit a file manually, commit manually)
2. Make an **AI-assisted** commit (use Claude Code to help, but human edits too)
3. Make an **AI-generated** commit (Claude Code does everything)
4. Verify that each commit has the correct AI-Origin trailer

This exercise generates the test data they'll need for Module 05's dashboards.

---

### [35-42 min] Exercise 3: Configure GitHub Actions Metric Emission

Direct participants to `exercises/03-github-actions-metrics.md`.

They will:
1. Add a GitHub Actions workflow that runs on push to main
2. The workflow extracts trailers from new commits
3. Emits metric events to EventBridge via AWS CLI

> **Instructor Note:** If participants don't have push access to a GitHub repo, they can review the workflow YAML and do a dry-run locally. The important thing is understanding the extraction and emission pattern, not the CI platform specifics.

---

---

### Beyond Commit Metrics: The Full Event Pipeline

The git hooks and CI workflow emit `prism.d1.commit` and `prism.d1.pr` events. But the PRISM pipeline captures **14 event types** across the full AI development lifecycle:

| Event Type | Source | What It Captures |
|---|---|---|
| `prism.d1.commit` | Git hooks, GitHub webhook | AI origin, model, files changed, diff stats |
| `prism.d1.pr` | GitHub webhook | Lead time, AI-to-merge ratio, acceptance rate, spec-to-code hours |
| `prism.d1.deploy` | GitHub webhook | Deployment frequency, change failure rate |
| `prism.d1.eval` | Eval gate workflow | Eval score, rubric name, pass/fail, per-criterion scores |
| `prism.d1.agent` | Agent runtime (metrics.py) | Steps, tools, tokens, duration, guardrail triggers |
| `prism.d1.agent.eval` | Agent eval workflow | Agent quality scores |
| `prism.d1.guardrail` | Agent runtime | Trigger category, type, action (BLOCK/ANONYMIZE), agent name |
| `prism.d1.mcp.tool_call` | MCP audit logger | Tool name, session, scopes, authorized flag, duration |
| `prism.d1.token` | CloudTrail → token-processor Lambda | Model, input/output tokens, cost USD, developer, IAM principal |
| `prism.d1.cost` | token-commit-correlator Lambda | Cost per commit, total tokens, models used |
| `prism.d1.security` | exfiltration-detector Lambda | Alert type, table, principal, read count |
| `prism.d1.quality` | defect-correlator Lambda | AI defect rate, human defect rate, commit counts |
| `prism.d1.incident` | (Planned) | Incident tracking |
| `prism.d1.assessment` | Assessment API | PRISM level assessment |

**Specialized Lambda Processors:**

Beyond the core metrics-processor, five specialized Lambdas handle derived calculations:

| Lambda | Trigger | What It Does |
|---|---|---|
| `token-processor` | CloudTrail Bedrock API calls | Extracts tokens, looks up pricing + developer identity, emits `prism.d1.token` |
| `token-commit-correlator` | `prism.d1.commit` events | Matches token events within 5-min window, emits `prism.d1.cost` |
| `defect-correlator` | Failed `prism.d1.deploy` events | Queries commit origins, calculates AI vs human defect rates |
| `spec-to-code-calculator` | Merged `prism.d1.pr` events | Finds earliest spec commit, calculates hours to merge |
| `exfiltration-detector` | CloudTrail DynamoDB read events | Monitors for anomalous read volumes on PRISM tables |

**New CloudWatch Metrics (beyond DORA + AI-DORA):**

| Category | Metrics |
|---|---|
| Eval Gates | `EvalGatePassRateByRubric`, `EvalScore` (per rubric) |
| Guardrails | `GuardrailTriggerCount`, `GuardrailBlockCount`, `GuardrailAnonymizeCount` |
| MCP Governance | `MCPToolCallCount`, `MCPAuthDeniedCount`, `MCPToolCallDurationMs` |
| Cost | `BedrockTokensInput`, `BedrockTokensOutput`, `BedrockCostUSD`, `CostPerCommit`, `TokenEfficiency` |
| Quality | `PostMergeDefectRateAI`, `PostMergeDefectRateHuman` |
| Security | `ExfiltrationAlertCount` |

---

### [42-45 min] Wrap-Up

**Check for understanding:**
- "What's the difference between the prepare-commit-msg hook and the post-commit hook?"
- "Why do we emit metrics from CI rather than from the developer's machine?"
- "What happens if a developer uninstalls the git hooks?"

**Answer to the third question:** The CI workflow is the source of truth, not the local hooks. Local hooks are a convenience that gives developers immediate feedback. The CI workflow runs on every push regardless and extracts trailers if present. If a developer removes their hooks, commits won't have trailers, and the CI workflow will log those as `AI-Origin: unknown`. This shows up on the dashboard as a data quality issue that the team lead can address.

**Bridge to Module 04:** You now have metrics flowing from commits through CI. But we're only measuring quantity -- how much AI involvement. In Module 04, we add quality gates: is the AI-generated code actually correct?

---

## Common Questions

**Q: Do the git hooks slow down commits?**
A: The prepare-commit-msg hook runs in <100ms (it's checking environment variables, not calling an API). The post-commit hook appends to a local log file. Neither adds perceptible delay.

**Q: What if we use GitLab or Bitbucket instead of GitHub?**
A: The git hooks are platform-agnostic. The CI metric emission step is GitHub Actions-specific in the workshop, but the same `aws events put-events` command works in any CI system. We have examples for GitLab CI and Bitbucket Pipelines in the PRISM docs.

**Q: Can a developer fake the AI-Origin trailer?**
A: Yes. Local git trailers are not cryptographically signed. The hooks add them automatically based on detection heuristics, but a developer could manually edit them. This is by design -- the system measures contribution patterns, not enforces them. If someone is gaming the metrics, that's a management conversation, not a technical control.
