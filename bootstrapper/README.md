# PRISM D1 Velocity — Bootstrapper

Everything your team needs to adopt AI-native software development practices. Install these components in your repository and start measuring your AI-assisted DORA metrics immediately.

## Components

| Directory | What It Contains |
|---|---|
| `claude-code/` | CLAUDE.md templates for backend, frontend, and platform teams |
| `spec-templates/` | Kiro-compatible specification templates (API, data model, integration, agent workflow) |
| `.prism/eval-harness/` | Amazon Bedrock Evaluation rubrics (5 rubrics) and runner script with `--spec` flag |
| `github-workflows/` | Reusable GitHub Actions for metric collection and eval gating |
| `metric-hooks/` | Git hooks for automatic AI-origin tagging and local metric collection |
| `aidlc-steering/` | AI-DLC development workflow rules for Claude Code, Kiro, and Q Developer (adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)) |
| `agent-configs/` | AgentCore Runtime, Memory, Gateway, and Guardrail templates |
| `mcp-servers/` | Reference MCP server implementations |
| `security-agent/` | AWS Security Agent setup script, GitHub workflow, and configuration for design review, code review, and pen testing integration |

## Quickstart

### Step 1: Install Git Hooks

```bash
cd your-repo

bash prism-cli bootstrapper install-git-hooks --team-id your-team
```

This installs the `prepare-commit-msg` hook and creates the `.prism/` configuration directory. Every commit will now be tagged with AI-origin metadata.

### Step 2: Choose a CLAUDE.md Template

Pick the template that matches your team and copy it to your repo root:

```bash
# Backend/API teams
cp /path/to/bootstrapper/claude-code/CLAUDE-backend-api.md ./CLAUDE.md

# Frontend teams
cp /path/to/bootstrapper/claude-code/CLAUDE-frontend.md ./CLAUDE.md

# Platform/Infrastructure teams
cp /path/to/bootstrapper/claude-code/CLAUDE-platform.md ./CLAUDE.md
```

Customize it for your tech stack, then commit.

### Step 3: Add GitHub Workflows

```bash
mkdir -p .github/workflows
cp /path/to/bootstrapper/github-workflows/prism-ai-metrics.yml .github/workflows/
cp /path/to/bootstrapper/github-workflows/prism-eval-gate.yml .github/workflows/
cp /path/to/bootstrapper/github-workflows/prism-dora-weekly.yml .github/workflows/
```

Configure the required repository secret (`PRISM_METRICS_ROLE_ARN`). See `github-workflows/README.md` for OIDC setup. The team ID is read automatically from `.prism/config.json`.

### Step 4: Configure Eval Harness

```bash
bash prism-cli bootstrapper install-eval-harness --with-rubrics
```

Edit `.prism/eval-harness/eval-config.json` to set your pass threshold and AWS region.

### Step 5: Deploy Metrics Infrastructure

The bootstrapper emits events to an EventBridge custom bus (`prism-d1-metrics`). The infrastructure to receive and visualize these events is in the `../infra/` directory. Deploy it to start seeing your metrics in CloudWatch and QuickSight.

### Step 6: Enable CloudTrail for Bedrock (Required for Cost Tracking)

The cost intelligence pipeline (token usage, cost-per-commit, token efficiency) requires CloudTrail data events for Bedrock. **This is not enabled by default.**

```bash
# Check if you have an existing trail
aws cloudtrail describe-trails --region us-west-2 \
  --query 'trailList[].Name' --output text

# If no trail exists, create one
aws cloudtrail create-trail \
  --name prism-d1-trail \
  --s3-bucket-name <your-cloudtrail-bucket> \
  --region us-west-2

aws cloudtrail start-logging --name prism-d1-trail --region us-west-2

# Enable Bedrock data events on the trail
aws cloudtrail put-event-selectors \
  --trail-name <your-trail-name> \
  --region us-west-2 \
  --advanced-event-selectors '[
    {
      "Name": "ManagementEvents",
      "FieldSelectors": [
        {"Field": "eventCategory", "Equals": ["Management"]}
      ]
    },
    {
      "Name": "BedrockDataEvents",
      "FieldSelectors": [
        {"Field": "eventCategory", "Equals": ["Data"]},
        {"Field": "resources.type", "Equals": ["AWS::Bedrock::Model"]}
      ]
    }
  ]'

# Verify
aws cloudtrail get-event-selectors \
  --trail-name <your-trail-name> \
  --region us-west-2 \
  --query 'AdvancedEventSelectors[].Name'
```

**Without this step**, the following features will not work:
- AI token usage per PR (AIInputTokens / AIOutputTokens)
- AI cost per PR (AICostUSD)
- AI contribution dashboards

**Note:** CloudTrail data events for Bedrock have a small cost (~$0.10 per 100,000 events). For a team of 20 engineers, this is typically < $5/month.

### Step 7: Seed Developer Identity Mapping (Required for Cost Attribution)

The cost pipeline attributes Bedrock usage to individual developers by matching IAM principal ARNs. Without this, the developer field shows "unknown."

```bash
# Find your team's IAM ARNs from CloudTrail
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventSource,AttributeValue=bedrock.amazonaws.com \
  --max-results 20 --region us-west-2 \
  --query 'Events[].{User:Username,Time:EventTime}' --output table

# Add each developer
aws dynamodb put-item --table-name prism-identity-mapping --region us-west-2 \
  --item '{
    "iam_principal": {"S": "arn:aws:sts::123456789012:assumed-role/YourRole/user@company.com"},
    "developer_email": {"S": "user@company.com"},
    "team_id": {"S": "your-team-id"},
    "display_name": {"S": "User Name"}
  }'
```

## Adoption Path

| Phase | Actions | Metrics You Get |
|---|---|---|
| **Day 1** | Install hooks + CLAUDE.md | AI-origin tagging on every commit |
| **Week 1** | Add GitHub workflows | AI-to-merge ratio, lead time, eval scores |
| **Week 2** | Configure eval harness + gate | Automated quality checks on AI code |
| **Ongoing** | Weekly DORA assessment | Full DORA + AI-DORA dashboard |

## Event Schema

All events flow to the `prism-d1-metrics` EventBridge bus with source `prism.d1.velocity`:

| Detail Type | Emitted By | Trigger |
|---|---|---|
| `prism.d1.commit` | Git hooks | Every commit |
| `prism.d1.pr` | GitHub Actions / Git hooks | PR merge |
| `prism.d1.deploy` | GitHub Actions | Merge to main |
| `prism.d1.eval` | Eval harness / GitHub Actions | Bedrock Evaluation run |
| `prism.d1.assessment` | GitHub Actions | Weekly cron |

## Prerequisites

- **AWS CLI v2** — For EventBridge event emission
- **jq** — For JSON processing in hooks and scripts
- **GitHub Actions** — For CI/CD workflows
- **AWS OIDC** — For secure GitHub Actions to AWS authentication
- **Amazon Bedrock** — For code evaluation (model access must be enabled)

## File Inventory

```
bootstrapper/
  README.md                              # This file
  claude-code/
    CLAUDE-backend-api.md                # Backend/API team template
    CLAUDE-frontend.md                   # Frontend team template
    CLAUDE-platform.md                   # Platform/infra team template
    README.md                            # Template selection guide
  spec-templates/
    api-endpoint.md                      # REST API endpoint spec
    data-model.md                        # Database entity spec
    integration.md                       # External service integration spec
    agent-workflow.md                    # Agentic workflow spec (L3+)
    README.md                            # Spec template usage guide
  eval-harness/
    eval-config.json                     # Evaluation configuration
    run-eval.sh                          # Evaluation runner script
    rubrics/
      api-response-quality.json          # API correctness rubric
      code-quality.json                  # General code quality rubric
      security-compliance.json           # Security best practices rubric
    README.md                            # Eval harness setup guide
  github-workflows/
    prism-ai-metrics.yml                 # PR merge metrics workflow
    prism-eval-gate.yml                  # Eval gate workflow
    prism-dora-weekly.yml                # Weekly DORA assessment workflow
    README.md                            # Workflow setup guide
  metric-hooks/
    prepare-commit-msg                   # AI-origin trailer hook
    prepare-commit-msg                   # AI trailer hook
    config.json.template                 # Config template
    README.md                            # Hook installation guide
```
