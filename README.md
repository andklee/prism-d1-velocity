# PRISM D1: Velocity — AI Development Lifecycle Workshop

> :warning: **Sample Project — Not Production-Ready**
>
> This project is provided as a sample and reference implementation only. It is not designed, tested, or hardened for production use. Use it as a starting point or learning resource, and perform your own security review, testing, and operational hardening before deploying to any production environment.

> Compress the idea-to-production loop with disciplined AI adoption.

Part of the [PRISM Framework](../README.md) (Progressive Readiness Index for Scalable Maturity) — the D1 Velocity pillar focuses on AI-native software development lifecycle practices that are **measurable from Day 1**.

## What This Repo Contains

### For Engineering Leaders (Top-Down Visibility)

- **AWS-native dashboards** comparable to Jellyfish/Swarmia — but built on CloudWatch + QuickSight
- **Enhanced DORA metrics** with AI-specific dimensions (acceptance rate, AI-to-merge ratio, eval gate pass rate)
- **Executive readout templates** that connect engineering metrics to business outcomes
- **PRISM level tracking** — see your org's maturity score change over time

### For Engineering Teams (Bottom-Up Activation)

- **4-hour workshop** (+ extensions) with hands-on exercises using Claude Code + Bedrock
- **Spec-driven development** templates compatible with Kiro
- **AI agent development** — build agents with Strands SDK, MCP, and Amazon Bedrock AgentCore
- **Bootstrapper code** — git hooks, CI workflows, eval harnesses, agent configs teams inherit permanently
- **Sample application** with task API + MCP server + Strands agent to practice AI-DLC patterns

## Quick Start

### Prerequisites

Run the prism-cli command to verify and setup everything:

```bash
bash prism-cli.sh workshop verify-setup
```

Or install manually:

- AWS Account with Bedrock access (Claude models enabled)
- Node.js 20+ and npm
- Python 3.11+ (for Strands Agent)
- AWS CLI v2 and CDK v2 (`npm install -g aws-cdk`)
- Claude Code CLI configured for Bedrock (`export CLAUDE_CODE_USE_BEDROCK=1`)
- Git 2.40+, jq, GitHub CLI

The setup script supports flags:
- `--skip-aws` — skip AWS credential and Bedrock checks (for offline prep)
- `--skip-kiro` — skip Kiro IDE check
- `--verify-only` — only verify, don't install anything

### Deploy the Metrics Platform

```bash
cd infra
npm install
npx cdk bootstrap   # First time only
npx cdk deploy --all
```

### Assess a Customer

#### Web Assessment Tool (Recommended)

The prism-cli includes a local web interface for running the full assessment flow — scan, interview, and report generation — in a browser.

```bash
bash prism-cli.sh assessment web
# Opens http://localhost:3120
```

The web tool supports two workflows:

**Self-service (customer runs it themselves):**
1. Customer clones this repo and runs `bash prism-cli.sh assessment web`
2. Scans their own repository from the web UI
3. Exports the scan results as JSON and sends the file to you
4. Optionally completes the interview themselves and sends the final HTML report

**SA-led (you run it):**
1. Import the customer's scan JSON into the web UI (skip re-scanning)
2. Conduct the interview using the built-in guide with scoring rubrics
3. Generate the HTML report directly in the browser

**AI Agent interview:**
1. After scanning (or importing a scan), choose "AI Agent Interview" from the next steps
2. An AI agent conducts the 20-question interview conversationally, asks follow-up probes, and scores responses against the rubrics automatically
3. The agent uses context from prior answers to ask smarter questions and avoid repetition
4. When complete, generates the same assessment report as the manual flow

The AI agent requires **Amazon Bedrock access** — specifically the `us.anthropic.claude-sonnet-4-6` model (Claude Sonnet 4.6 via cross-region inference). To set this up:
- Enable model access in the [Bedrock console](https://console.aws.amazon.com/bedrock/home#/modelaccess) (Anthropic → Claude Sonnet 4.6)
- Configure AWS credentials locally (`aws configure`, SSO, or environment variables)
- The agent validates Bedrock access on startup and shows setup instructions if anything is missing

The interview form includes the full question bank, scoring rubrics, and scanner-informed focus areas. Reports can be printed or saved as PDF from the browser.

#### Manual Assessment

For a CLI-only or fully manual workflow, run the [PRISM Assessment](assessment/README.md) to determine maturity level and onboarding track. See the [full methodology guide](assessment/ASSESSMENT-GUIDE.md) for scanner logic, interview rubrics, and scoring formulas.

### Run the Workshop

Open the [AWS Workshop](https://studio.us-east-1.prod.workshops.aws/preview/d0a8b037-dfe0-4023-9ce2-f5de32ee4c67/builds/394a0905-cfd8-46de-9ee1-0615f21744f5) from your browser.

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
# Copy into your project
cp -r bootstrapper/ ~/your-repo/.prism/
cd ~/your-repo

# Install hooks and workflows
.prism/metric-hooks/install.sh
cp .prism/github-workflows/*.yml .github/workflows/
cp .prism/claude-code/CLAUDE.md ./CLAUDE.md

# For agent projects, also copy:
cp .prism/agent-configs/ ./agent-configs/
cp .prism/claude-code/CLAUDE-agent.md ./CLAUDE-agent.md

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
| **Post-Merge Defect Rate** | Bug tracker + AI origin tag | <= 1.2x human | <= 0.9x |
| **Eval Gate Pass Rate** | Bedrock Evaluations in CI | >= 80% | >= 95% |
| **AI Test Coverage Delta** | Coverage tool + AI origin tag | > 15% | > 40% |

## Architecture

```
Developer Workstation              AWS Metrics Platform
────────────────────              ────────────────────
Claude Code ──────┐
Kiro Specs ───────┤               ┌──────────────┐
Git Hooks ────────┼── API GW ───→ │ EventBridge  │
GitHub Actions ───┤               └──────┬───────┘
Bedrock Evals ────┤                      │
Strands Agents ───┘               ┌──────▼───────┐
      │                           │   Lambda     │  enrich + normalize
  MCP Server ←── Tool Discovery   └──────┬───────┘
      │                                  │
  AgentCore ←── Runtime + Ops    ┌───────┼────────┐
                                 ▼       ▼        ▼
                             DynamoDB DynamoDB CloudWatch
                             (events) (metadata)   │
                                 │       │        │
                                 └───────┼────────┘
                                         ▼
                              ┌──────────────────┐
                              │    QuickSight    │  Executive Readout
                              │    CloudWatch    │  Team Dashboard
                              └──────────────────┘
```

## PRISM Maturity Levels (D1 Velocity)

| Level | Name | What It Looks Like |
|-------|------|--------------------|
| L1 | Experimental | Ad hoc AI use, no metrics, no shared tooling |
| L2 | Structured | Claude Code + Kiro adopted, acceptance rate tracked in CI |
| L3 | Integrated | Eval gates in pipeline, AI-DORA dashboards live, spec-driven workflow |
| L4 | Orchestrated | Multi-team platform, AI FinOps, governed agent scope |
| L5 | Autonomous | Agents contributing to architecture, >20% autonomous deployments |

## AI Agent Development

The repo includes a complete agent development stack for PRISM Level 3+ teams:

| Component | Technology | Location |
|-----------|-----------|----------|
| **Agent Framework** | Strands Agents SDK (Python) | `sample-app/agent/` |
| **Tool Integration** | Model Context Protocol (MCP) | `sample-app/src/mcp/` |
| **Production Hosting** | Amazon Bedrock AgentCore | `bootstrapper/agent-configs/` |
| **Agent Eval** | Bedrock Evaluations | `bootstrapper/eval-harness/rubrics/agent-quality.json` |
| **Workshop** | Module 02: Agent Development | `workshop/02-agent-development/` |

## Competitive Landscape & Roadmap

- **[Competitive Landscape](docs/competitive-landscape.md)** — How PRISM D1 compares to Swarmia, Jellyfish, LinearB, DX, Faros AI, and Pluralsight Flow across DORA, AI-native metrics, and platform capabilities
- **[Community Roadmap](docs/ROADMAP.md)** — 47 prioritized backlog items across 9 phases to reach and exceed feature parity with commercial tools — open for community contributions
- **[Data Architecture](docs/data-architecture.md)** — Complete metrics pipeline documentation: 7 data sources, 8 event types, AI tool detection, CloudWatch metrics catalog, and the token/cost tracking gap

**GitHub Pages**: [sunilpp.github.io/prism-d1-velocity](https://sunilpp.github.io/prism-d1-velocity/)

## License

Internal use — AWS Solutions Architecture, Startups Organization.
