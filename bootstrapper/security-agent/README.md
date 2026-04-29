# AWS Security Agent Integration

Connects AWS Security Agent to the PRISM D1 metrics pipeline for proactive security scanning across the AI-DLC lifecycle.

## What It Does

| Phase | Trigger | What Gets Scanned | PRISM Event |
|---|---|---|---|
| Design Review | Spec/design doc committed | Architecture decisions, data flows, auth design | `prism.d1.security.design_review` |
| Code Review | PR opened/updated | Source code against org security policies | `prism.d1.security.code_review` |
| Pen Testing | Deploy to staging | Running application (OWASP Top 10, business logic) | `prism.d1.security.pen_test` |

Findings flow into the PRISM pipeline where they're:
- Correlated with AI vs human code origin
- Tracked for remediation time
- Surfaced in Team, Executive, and CISO dashboards
- Used to block eval gates when Critical/High findings are open (SECURITY-09)

## Setup

**Full step-by-step guide:** [SETUP-GUIDE.md](SETUP-GUIDE.md) — covers console setup, domain verification, GitHub connection, security policies, webhook configuration, identity mapping, and end-to-end verification.

**Quick start** (after completing the console setup in the guide):

```bash
# From your project root
chmod +x /path/to/bootstrapper/security-agent/setup.sh

/path/to/bootstrapper/security-agent/setup.sh \
  --api-url https://your-api.execute-api.us-west-2.amazonaws.com/v1 \
  --api-key your-prism-api-key \
  --team-id your-team-name
```

This creates `.prism/security-agent.json` with scan configuration.

## GitHub Workflow

Copy the scan workflow to trigger Security Agent on spec changes, PRs, and deployments:

```bash
cp /path/to/bootstrapper/security-agent/prism-security-agent-scan.yml .github/workflows/
```

Required GitHub configuration:
- **Secret:** `PRISM_API_KEY` — your PRISM D1 API key
- **Variable:** `PRISM_API_URL` — your PRISM D1 API Gateway URL
- **Variable:** `PRISM_TEAM_ID` — your team identifier
- **Variable:** `PRISM_AWS_ROLE_ARN` — OIDC role with Security Agent permissions

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/security-findings` | POST | Submit Security Agent findings to PRISM pipeline |
| `/security-findings/{team_id}` | GET | Query findings for a team (default: last 7 days) |

## Dashboards

Security Agent data appears in:
- **Team Velocity** → "Security Agent Findings" section
- **Executive Readout** → "Security & Compliance" section
- **CISO Compliance** → dedicated dashboard with AI risk profile, shift-left, SLA tracking

## Configuration

`.prism/security-agent.json` controls:

```json
{
  "scan_config": {
    "design_review": { "enabled": true, "trigger": "on_spec_commit" },
    "code_review": { "enabled": true, "trigger": "on_pr" },
    "pen_test": { "enabled": true, "trigger": "on_deploy_to_staging" }
  },
  "severity_thresholds": {
    "block_merge": ["CRITICAL", "HIGH"],
    "remediation_sla_hours": { "CRITICAL": 24, "HIGH": 72, "MEDIUM": 720 }
  }
}
```
