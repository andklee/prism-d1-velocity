# PRISM D1 Velocity — Workshop Overview

**Total duration:** 4 hours core + 25 minutes optional extensions
**Delivery:** Instructor-led, hands-on
**Target:** Startup engineering teams (20-200 engineers, Series A-D)

---

## At a Glance

| Module | Duration | What They Do | What They Walk Away With |
|---|---|---|---|
| [00 Prerequisites](#module-00-prerequisites--environment-setup) | 30 min | Install tools, verify Bedrock access | Working AI-DLC toolchain |
| [01 AI-SDLC Foundations](#module-01-ai-sdlc-foundations) | 45 min | Configure Claude Code, first AI commit | CLAUDE.md in their repo, commit metadata flowing |
| [02 Agent Development](#module-02-agent-development) | 70 min | Build agent, MCP server, multi-agent orchestration | Working AI agent with tool auth and guardrails |
| [03 AI-Assisted Development](#module-03-ai-assisted-development) | 45 min | Write specs, implement with Kiro/Claude Code/CLI | Spec-driven workflow, any AI surface |
| [04 Instrumenting AI Metrics](#module-04-instrumenting-ai-metrics) | 45 min | Install hooks, emit events to EventBridge | 18 event types flowing through pipeline |
| [05 Eval Gates in CI/CD](#module-05-eval-gates-in-cicd) | 45 min | Create rubrics, add eval gate to CI | 5 Bedrock eval rubrics blocking bad merges |
| [06 Dashboards & Visibility](#module-06-dashboards--visibility) | 30 min | Deploy dashboards, generate sample data | 5 live dashboards + 12 alarms |

**Extensions** (optional, when Security Agent is available):
- Module 03: Design review (+10 min)
- Module 05: Code review (+10 min)
- Module 06: CISO dashboard walkthrough (+5 min)

---

## What the Customer Gets at Each Stage

```
Module 00    Module 01    Module 02    Module 03    Module 04    Module 05    Module 06
  Setup   →  First AI  →  Agents   →  Specs +   →  Metrics  →  Quality  →  Dashboards
             commit       + MCP       AI surface    pipeline     gates
  │            │            │            │            │            │            │
  ▼            ▼            ▼            ▼            ▼            ▼            ▼
  Tools      CLAUDE.md    Agent with   Spec-driven  18 event    5 rubrics    5 dashboards
  verified   configured   MCP auth +   workflow     types +     blocking     12 alarms
             AI-Origin    guardrails   3 surfaces   30+ CW      bad code     CISO view
             tagging                                metrics
  │            │            │            │            │            │            │
  ▼            ▼            ▼            ▼            ▼            ▼            ▼
  L1           L1.5         L2           L2           L2.5         L3           L3
```

---

## Module Details

### Module 00: Prerequisites & Environment Setup

**Duration:** 30 min | **PRISM Level:** L1 entry

| | |
|---|---|
| **What they do** | Install Claude Code CLI, configure Bedrock access, set up Kiro IDE, clone sample-app, run setup verification script |
| **AWS services used** | Bedrock (model access verification) |
| **Tools configured** | Claude Code, Kiro, Git, AWS CLI, Python 3.11+ |
| **What they walk away with** | Fully verified AI-DLC toolchain — all prerequisite checks green |

---

### Module 01: AI-SDLC Foundations

**Duration:** 45 min | **PRISM Level:** L1 → L1.5

| | |
|---|---|
| **What they do** | Configure CLAUDE.md for their repo, make their first AI-assisted commit with proper trailers (AI-Origin, AI-Model, Spec-Ref), understand commit metadata |
| **AWS services used** | Bedrock (Claude inference) |
| **Key concept** | CLAUDE.md is the configuration contract between the developer and the AI — it defines conventions, constraints, and context |
| **What they walk away with** | CLAUDE.md in their repo, every commit auto-tagged with AI origin metadata |

---

### Module 02: Agent Development

**Duration:** 70 min (+15 min AgentCore extension) | **PRISM Level:** L1.5 → L2

| | |
|---|---|
| **What they do** | Build a task assistant agent (Strands SDK), create an MCP tool server (TypeScript), connect agent to MCP for tool discovery, build a multi-agent orchestrator (planner/executor/reviewer) |
| **AWS services used** | Bedrock (Claude Sonnet + Haiku), AgentCore (extension) |
| **Key concepts** | Agentic loop, MCP tool discovery, scope-based authorization (tasks:read/write/delete), agents-as-tools pattern, Bedrock Guardrails (content filters, PII, denied topics) |
| **Exercises** | 1. Build first agent (30 lines), 2. MCP tool server, 3. Multi-agent orchestration, 4. AgentCore deploy (extension) |
| **What they walk away with** | Working AI agent with MCP auth, guardrail config, multi-agent patterns, agent metrics emitting to EventBridge |

---

### Module 03: AI-Assisted Development

**Duration:** 45 min (+10 min Security Agent extension) | **PRISM Level:** L2

| | |
|---|---|
| **What they do** | Write a spec (requirements, acceptance criteria, design constraints, API contract), implement it using their preferred AI surface (Kiro IDE, Claude Code in VS Code/JetBrains, or Claude Code CLI), iterate when the spec has gaps |
| **AWS services used** | Bedrock (via Kiro or Claude Code) |
| **Key concepts** | "Spec quality before spec automation," spec-implementation loop, all surfaces use the same Bedrock backend and emit the same PRISM metrics, spec-to-code turnaround as a metric |
| **Exercises** | 1. Write auth spec, 2. Implement with chosen AI surface, 3. Iterate on spec gaps |
| **Extension** | Security Agent design review: upload spec as context artifact → pen test with spec awareness → review architectural security findings → revise spec |
| **What they walk away with** | Spec-driven development workflow, understanding that AI surface choice doesn't matter (same metrics), spec-compliance eval rubric concept |

---

### Module 04: Instrumenting AI Metrics

**Duration:** 45 min | **PRISM Level:** L2 → L2.5

| | |
|---|---|
| **What they do** | Install PRISM git hooks (prepare-commit-msg, post-commit, post-merge), make 3 types of commits (human-only, AI-assisted, AI-generated), configure GitHub Actions metric emission workflow |
| **AWS services used** | EventBridge, Lambda, DynamoDB, CloudWatch |
| **Key concepts** | AI-Origin trailer detection (env vars: CLAUDE_CODE, KIRO_SESSION, Q_DEVELOPER_SESSION), CI as source of truth (not local hooks), 18 event types flowing through the pipeline |
| **Exercises** | 1. Install hooks, 2. Three commits (human/assisted/generated), 3. GitHub Actions metric emission |
| **What they walk away with** | Instrumented repo — every commit, PR, deploy, eval, agent invocation, guardrail trigger, token usage, and security finding emitting structured events to EventBridge |

**Full event pipeline covered:**

| Category | Event Types |
|---|---|
| Core DORA | commit, pr, deploy |
| Eval quality | eval |
| Agent ops | agent, agent.eval, guardrail, mcp.tool_call |
| Cost | token, cost |
| Security | security, security.design_review, security.code_review, security.pen_test, security.remediation |
| Quality | quality |

---

### Module 05: Eval Gates in CI/CD

**Duration:** 45 min (+10 min Security Agent extension) | **PRISM Level:** L2.5 → L3

| | |
|---|---|
| **What they do** | Create an eval rubric (JSON with weighted criteria), add Bedrock evaluation gate to CI/CD (GitHub Actions), catch a hallucination live (the crowd-pleaser demo) |
| **AWS services used** | Bedrock Runtime (Claude Haiku as judge model) |
| **Key concepts** | LLM-as-Judge pattern, rubric-based scoring (0-1 scale, 0.82 pass threshold), smart rubric routing (agent files → agent-quality, security files → security-compliance), per-rubric dashboard metrics |
| **Exercises** | 1. Create eval rubric, 2. Add eval gate to CI, 3. Catch a hallucination |
| **Extension** | Security Agent code review: see eval gate + Security Agent running in parallel on a PR, demo SECURITY-09 blocking merge on Critical finding |
| **What they walk away with** | 5 eval rubrics (code-quality, API, security-compliance with 10 criteria, agent-quality, spec-compliance) blocking bad AI code before merge |

**5 rubrics:**

| Rubric | Criteria | Routed To |
|---|---|---|
| code-quality | 7 (correctness, readability, maintainability, error handling, testing, performance, docs) | Default — all files |
| api-response-quality | 6 (contract, status codes, validation, pagination, errors, idempotency) | api/handler/route/controller files |
| security-compliance | 10 (auth, injection, secrets, data protection, IAM, errors, HTTP headers, logging, dependencies, Security Agent findings) | auth/security/guard/policy files |
| agent-quality | 5 (reasoning, tool selection, error recovery, efficiency, output quality) | agent/assistant/orchestrator files |
| spec-compliance | 4 (requirement coverage, interface adherence, edge cases, spec intent) | Files with Spec-Ref trailer |

---

### Module 06: Dashboards & Visibility

**Duration:** 30 min (+5 min CISO dashboard extension) | **PRISM Level:** L3

| | |
|---|---|
| **What they do** | Deploy CloudWatch dashboards via CDK, generate 7 days of sample data (~500+ events), configure alarms, explore the dashboards |
| **AWS services used** | CloudWatch (dashboards + alarms), DynamoDB, QuickSight |
| **Key concepts** | Two-audience dashboard strategy (team vs executive), every widget has an info tooltip explaining the metric, 12 alarms with specific thresholds, "bad day" pattern recognition exercise |
| **Exercises** | 1. Deploy dashboard (CDK), 2. Generate sample data + explore, 3. Configure alarms |
| **Extension** | CISO Compliance dashboard walkthrough: security posture, AI code risk profile, shift-left effectiveness |
| **What they walk away with** | 5 live dashboards, 12 alarms, sample data showing realistic patterns, understanding of what healthy L3 metrics look like |

**5 dashboards:**

| Dashboard | Audience | Sections |
|---|---|---|
| Team Velocity | Developers, tech leads | DORA + AI-DORA, Agent ops, Eval by rubric, Guardrails, MCP governance, Cost intelligence, AI attribution, Security Agent findings |
| Executive Readout | CTOs, VPEs, board | DORA summary, AI contribution trend, Quality gates, Security & compliance, Cost intelligence |
| CISO Compliance | CISOs, security leaders | Security posture, AI code risk profile, Shift-left effectiveness |
| AI-DORA Analysis | Eng managers, platform teams | DORA KPIs, AI contribution by team, Quality & evals, Spec efficiency |
| PRISM Level Tracker | SAs, program managers | Current level, Domain breakdown radar, Benchmarks by stage |

**12 alarms:**

| Alarm | Threshold | Category |
|---|---|---|
| AI Acceptance Rate Low | < 20% / 6h | Adoption |
| Eval Gate Pass Rate Low | < 70% / 6h | Quality |
| Change Failure Rate High | > 20% / 6h | Reliability |
| Agent Success Rate Low | < 80% / 1h | Agent ops |
| Guardrail Block Rate High | > 50/hr | Safety |
| Bedrock Daily Cost High | > $100/day | Cost |
| Token Efficiency Low | > 500 tokens/line / 6h | Cost |
| Exfiltration Alert | >= 1 | Security |
| Security Critical Finding | >= 1/hr | Security |
| Pen Test Exploit Detected | >= 1 | Security |
| Security Remediation SLA | avg > 72h / 24h | Security |
| Security Finding Rate High | > 50/6h | Security |

---

## End-to-End: What the Customer Has After 4 Hours

| Category | What They Have | Where It Lives |
|---|---|---|
| **Configuration** | CLAUDE.md, AI-DLC steering files, .prism/config | Their repo |
| **Instrumentation** | Git hooks (3), GitHub workflows (4), eval harness | Their repo |
| **Agents** | Task assistant agent, MCP server with auth, guardrail config | Their repo |
| **Quality gates** | 5 eval rubrics, 0.82 pass threshold, smart routing | Their CI/CD |
| **Infrastructure** | EventBridge bus, 8 Lambdas, DynamoDB (KMS), CloudWatch | Their AWS account |
| **Dashboards** | 5 dashboards (Team, Exec, CISO, AI-DORA, Level Tracker) | CloudWatch + QuickSight |
| **Alarms** | 12 CloudWatch alarms with SNS-ready thresholds | CloudWatch |
| **Security** | Bedrock Guardrails, MCP authorization, exfiltration detection | Their AWS account |
| **Maturity** | PRISM L3.0 (Integrated) with clear path to L4 | Assessment + dashboard |

---

## Homework (Post-Workshop)

| Action | Time | Impact |
|---|---|---|
| Add CLAUDE.md + AI-DLC steering files to main repo | 30 min | Every AI commit gets metadata |
| Install git hooks | 10 min | Local metric capture starts |
| Deploy CDK stack | 10 min | Full pipeline live |
| Enable CloudTrail for Bedrock | 15 min | Cost tracking active |
| Seed identity mapping table | 5 min/developer | Per-developer cost attribution |
| Set up Security Agent (when available) | 30 min | Design review + pen testing |
| Review dashboards after 2 weeks of real data | 30 min | Establish baselines, set team-specific thresholds |
