# PRISM D1: Velocity — AI Development Lifecycle Workshop

> :warning: **Sample Project — Not Production-Ready**
>
> This project is provided as a sample and reference implementation only. It is not designed, tested, or hardened for production use. Use it as a starting point or learning resource, and perform your own security review, testing, and operational hardening before deploying to any production environment.

> Compress the idea-to-production loop with disciplined AI adoption.

Part of the [PRISM Framework](../README.md) (Progressive Readiness Index for Scalable Maturity) — the D1 Velocity pillar focuses on AI-native software development lifecycle practices that are **measurable from Day 1**.

## Architecture

![PRISM D1 Velocity Architecture](assets/images/architecture-overview.svg)

## What This Repo Contains

### For Engineering Leaders (Top-Down Visibility)

- **[Executive Readout Dashboard](docs/dashboard-executive.html)** ([spec](docs/data-architecture.md#cloudwatch-executive-readout-prism-d1-executive-readout)) — PRISM level, DORA summary, AI contribution trends, security & compliance posture, cost intelligence
- **[CISO Compliance Dashboard](docs/data-architecture.md#cloudwatch-ciso-compliance-prism-d1-ciso-compliance)** — Security posture, AI code risk profile, shift-left effectiveness, remediation SLA tracking
- **[PRISM Level Tracker](docs/data-architecture.md#quicksight-prism-level-tracker)** (QuickSight) — Maturity progression by team, radar chart of sub-dimensions, benchmarks by funding stage
- **[AI-DORA Analysis](docs/data-architecture.md#quicksight-ai-dora-analysis)** (QuickSight) — Deep-dive exploratory analysis across teams, repos, and AI tools
- **Enhanced DORA metrics** with 6 AI-specific dimensions (acceptance rate, AI-to-merge ratio, eval gate pass rate, spec-to-code hours, post-merge defect rate, AI test coverage delta)
- **[Executive readout templates](docs/leader-guide/executive-readout-template.md)** connecting engineering metrics to business outcomes

### For Engineering Teams (Bottom-Up Activation)

- **[Team Velocity Dashboard](docs/dashboard-team.html)** ([spec](docs/data-architecture.md#cloudwatch-team-velocity-prism-d1-team-velocity)) — Real-time DORA metrics, eval gate quality by rubric, guardrail safety, MCP tool governance, cost per commit, AI vs human defect rates, Security Agent findings
- **4-hour workshop** (+ extensions) with hands-on exercises using Claude Code, Kiro, and Bedrock
- **Spec-driven development** templates with [AI-DLC steering files](bootstrapper/aidlc-steering/) (adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows))
- **AI agent development** — Strands SDK, MCP with [scope-based auth](sample-app/src/mcp/auth/), Amazon Bedrock AgentCore
- **[AWS Security Agent integration](bootstrapper/security-agent/)** — design review, code review, pen testing ([setup guide](bootstrapper/security-agent/SETUP-GUIDE.md))
- **Bootstrapper code** — git hooks, CI workflows, eval harnesses, agent configs teams inherit on day one

### For Security Leaders (Governance & Compliance)

- **Bedrock Guardrails** — content filters, PII protection, denied topics with per-trigger metrics
- **MCP Authorization** — scope-based tool access control with audit trail
- **Eval Gates** — 5 rubrics (code-quality, API, security, agent, spec-compliance) + SECURITY-09 (Security Agent findings)
- **KMS encryption** on all data stores, VPC isolation, exfiltration detection
- **12 CloudWatch alarms** including security critical finding, pen test exploit, remediation SLA

## Quick Start

### Prerequisites

```bash
./scripts/setup.sh
```

Or install manually: AWS Account with Bedrock access, Node.js 20+, Python 3.11+, AWS CLI v2, CDK v2, Claude Code CLI, Git 2.40+, jq, GitHub CLI.

### Deploy the Metrics Platform

```bash
cd infra
npm install
npx cdk bootstrap   # First time only
npx cdk deploy --all
```

This deploys: EventBridge bus, 8 Lambda processors, DynamoDB tables (KMS-encrypted), 5 CloudWatch dashboards, 12 alarms, Bedrock Guardrails, Security Agent AgentSpace, model pricing table, identity mapping table.

### Assess a Customer

Run the [PRISM Assessment](assessment/README.md) to determine maturity level and onboarding track. See the [full methodology guide](assessment/ASSESSMENT-GUIDE.md) for scanner logic, interview rubrics, and scoring formulas.

### Run the Workshop

Start with [Module 00: Prerequisites](workshop/00-prerequisites/README.md) and work through sequentially.

### Run the Sample Agent (No AWS Required)

```bash
cd sample-app
npm install && npm run dev          # Start the task API

cd agent
pip install -e ".[dev]"
python scripts/run-demo.py --mock   # Run agent demo with mock model
```

### Adopt the Bootstrapper (Post-Workshop)

```bash
cp -r bootstrapper/ ~/your-repo/.prism/
cd ~/your-repo

# Install hooks and workflows
.prism/metric-hooks/install.sh
cp .prism/github-workflows/*.yml .github/workflows/
cp .prism/claude-code/CLAUDE.md ./CLAUDE.md

# For agent projects:
cp .prism/agent-configs/ ./agent-configs/
cp .prism/claude-code/CLAUDE-agent.md ./CLAUDE-agent.md

# For Security Agent:
.prism/security-agent/setup.sh --api-url <url> --api-key <key> --team-id <team>

# Configure your team ID
echo 'PRISM_TEAM_ID=your-team-name' >> .env
```

## Enhanced AI-DORA Metrics

| Metric | Source | L2 Target | L4 Target |
|--------|--------|-----------|-----------|
| Deployment Frequency | GitHub/CodePipeline | Weekly | Daily+ |
| Lead Time for Changes | PR created → deployed | < 1 week | < 1 day |
| Change Failure Rate | Rollback/hotfix ratio | < 15% | < 5% |
| MTTR | Incident → resolution | < 24h | < 1h |
| **AI Acceptance Rate** | Git hooks + Claude Code | >= 30% | >= 55% |
| **AI-to-Merge Ratio** | CI metadata | >= 20% | >= 45% |
| **Spec-to-Code Turnaround** | Spec commit → PR ready | Baseline set | < 2 days |
| **Post-Merge Defect Rate** | Defect correlator + AI origin tag | <= 1.2x human | <= 0.9x |
| **Eval Gate Pass Rate** | Bedrock Evaluations in CI | >= 80% | >= 95% |
| **AI Test Coverage Delta** | Coverage tool + AI origin tag | > 15% | > 40% |

## Workshop Modules

| # | Module | Duration | Key Outcome |
|---|--------|----------|-------------|
| 00 | [Prerequisites](workshop/00-prerequisites/) | 30 min | Environment ready, Bedrock access confirmed |
| 01 | [AI-SDLC Foundations](workshop/01-ai-sdlc-foundations/) | 45 min | Claude Code configured, first AI-assisted commit |
| 02 | [Agent Development](workshop/02-agent-development/) | 70 min | Strands agent + MCP server (with auth) + multi-agent orchestration |
| 03 | [AI-Assisted Development](workshop/03-spec-driven-development/) | 45 min | Spec-driven development with Kiro, Claude Code IDE, or Claude Code CLI |
| 04 | [Instrumenting AI Metrics](workshop/04-instrumenting-ai-metrics/) | 45 min | Git hooks + CI emitting 18 event types to EventBridge |
| 05 | [Eval Gates in CI/CD](workshop/05-eval-gates-cicd/) | 45 min | 5 Bedrock eval rubrics + SECURITY-09 blocking bad merges |
| 06 | [Dashboards & Visibility](workshop/06-dashboards-visibility/) | 30 min | 5 dashboards live (Team, Executive, CISO, 2 QuickSight) |

Extension exercises: Security Agent design review (+10 min in Module 03), code review (+10 min in Module 05), CISO dashboard walkthrough (+5 min in Module 06).

## PRISM Maturity Levels (D1 Velocity)

| Level | Name | What It Looks Like |
|-------|------|--------------------|
| L1 | Experimental | Ad hoc AI use, no metrics, no shared tooling |
| L2 | Structured | Claude Code + Kiro adopted, acceptance rate tracked in CI |
| L3 | Integrated | Eval gates in pipeline, AI-DORA dashboards live, spec-driven workflow |
| L4 | Orchestrated | Multi-team platform, AI FinOps, governed agent scope, Security Agent |
| L5 | Autonomous | Agents contributing to architecture, >20% autonomous deployments |

## AI Agent Development

| Component | Technology | Location |
|-----------|-----------|----------|
| **Agent Framework** | Strands Agents SDK (Python) | `sample-app/agent/` |
| **Tool Integration** | Model Context Protocol (MCP) with scope-based auth | `sample-app/src/mcp/` |
| **Production Hosting** | Amazon Bedrock AgentCore | `bootstrapper/agent-configs/` |
| **Agent Eval** | Bedrock Evaluations (5 rubrics) | `bootstrapper/eval-harness/rubrics/` |
| **Security** | Bedrock Guardrails + MCP authorization + Security Agent | `infra/lib/constructs/` |
| **Workshop** | Module 02: Agent Development | `workshop/02-agent-development/` |

## Documentation & Resources

| Resource | Description |
|----------|-------------|
| **[Data Architecture & Dashboard Guide](docs/data-architecture.md)** | 9 data sources, 18 event types, 5 dashboards (widget-by-widget guide), 30+ CloudWatch metrics, 12 alarms |
| **[Competitive Landscape](docs/competitive-landscape.md)** | PRISM vs. Swarmia, Jellyfish, LinearB, DX, Faros AI — 9 differentiators |
| **[Community Roadmap](docs/ROADMAP.md)** | Prioritized backlog across 9 phases |
| **[Security Agent Setup Guide](bootstrapper/security-agent/SETUP-GUIDE.md)** | 10-step guide: console setup, domain verification, GitHub connection, webhook, identity mapping |
| **[AI-DLC Steering Files](bootstrapper/aidlc-steering/)** | Development workflow rules adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) |
| **[ROI Model](docs/leader-guide/roi-model.md)** | Defensible ROI calculations for CFO conversations |

**GitHub Pages**: [sunilpp.github.io/prism-d1-velocity](https://sunilpp.github.io/prism-d1-velocity/)

## License

Internal use — AWS Solutions Architecture, Startups Organization.
