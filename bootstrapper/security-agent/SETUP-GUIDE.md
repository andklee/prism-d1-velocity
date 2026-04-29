# AWS Security Agent — Complete Setup Guide

This guide walks you through connecting AWS Security Agent to the PRISM D1 metrics pipeline. Follow every step in order. Each step tells you exactly what to do, where to do it, and how to verify it worked.

---

## Before You Start

You need all of these before proceeding:

| Requirement | How to Check | If Missing |
|---|---|---|
| AWS account with Security Agent access | `aws securityagent list-agent-spaces --region us-west-2` should not error | Request access via your AWS account team |
| PRISM D1 CDK stack deployed | `aws cloudformation describe-stacks --stack-name PrismD1MetricsPipelineStack --query 'Stacks[0].StackStatus'` should return `CREATE_COMPLETE` or `UPDATE_COMPLETE` | Run `cd infra && npm install && npx cdk deploy --all` |
| PRISM API URL | `aws cloudformation describe-stacks --stack-name PrismD1ApiStack --query 'Stacks[0].Outputs[?OutputKey==\`ApiUrl\`].OutputValue' --output text` | Deploy CDK stack first |
| PRISM API key ID | `aws cloudformation describe-stacks --stack-name PrismD1ApiStack --query 'Stacks[0].Outputs[?OutputKey==\`ApiKeyId\`].OutputValue' --output text` | Deploy CDK stack first |
| PRISM API key value | `aws apigateway get-api-key --api-key <key-id> --include-value --query 'value' --output text` | Deploy CDK stack first |
| GitHub repository | You need a repo to connect for code review | Create one |
| Domain you own | For pen testing — you must prove ownership | Use a staging domain |
| `jq` installed | `jq --version` | `brew install jq` or `apt install jq` |
| `aws` CLI v2 | `aws --version` should show `aws-cli/2.x` | [Install AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |

**Save these values — you'll need them throughout:**

```bash
# Run these commands and save the output
export PRISM_API_URL=$(aws cloudformation describe-stacks \
  --stack-name PrismD1ApiStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

export PRISM_API_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name PrismD1ApiStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' \
  --output text)

export PRISM_API_KEY=$(aws apigateway get-api-key \
  --api-key "${PRISM_API_KEY_ID}" \
  --include-value \
  --query 'value' --output text)

export AGENT_SPACE_ID=$(aws securityagent list-agent-spaces \
  --region us-west-2 \
  --query "agentSpaceSummaries[?name=='prism-d1-security'].agentSpaceId" \
  --output text)

echo "API URL:        ${PRISM_API_URL}"
echo "API Key:        ${PRISM_API_KEY:0:8}..."
echo "Agent Space ID: ${AGENT_SPACE_ID}"
```

If `AGENT_SPACE_ID` is empty, the CDK stack didn't create the Security Agent resources. Re-run `npx cdk deploy --all`.

---

## Step 1: Verify Security Agent Is Working

**Where:** Terminal

```bash
# List your agent spaces
aws securityagent list-agent-spaces --region us-west-2 --output table

# You should see:
# prism-d1-security | as-xxxxxxxxxxxx | ACTIVE
```

**Expected output:** A table with at least one agent space named `prism-d1-security`.

**If you see an error:**
- `UnrecognizedClientException` → Security Agent not enabled for your account
- `AccessDeniedException` → Your IAM role needs `securityagent:*` permissions
- Empty table → CDK stack needs to be deployed

**Verify:** `echo "Step 1 OK: Agent Space ID = ${AGENT_SPACE_ID}"`

---

## Step 2: Register Your Domain for Pen Testing

**Where:** Terminal (or AWS Console → Security Agent → Target Domains)

Pen testing requires proving you own the domain. Choose ONE method:

### Option A: DNS TXT Record (recommended)

```bash
# Register the domain
aws securityagent create-target-domain \
  --target-domain-name api.yourcompany.com \
  --verification-method DNS_TXT \
  --region us-west-2

# The output includes a verification token. Copy it.
```

Now add the DNS TXT record at your DNS provider:

```
Type:   TXT
Name:   _securityagent.api.yourcompany.com
Value:  <paste the verification token from the command output>
TTL:    300
```

Wait 1-5 minutes for DNS propagation, then verify:

```bash
# Check DNS propagation
dig TXT _securityagent.api.yourcompany.com

# Tell Security Agent to verify
aws securityagent verify-target-domain \
  --target-domain-name api.yourcompany.com \
  --region us-west-2

# Check status
aws securityagent batch-get-target-domains \
  --target-domain-names api.yourcompany.com \
  --region us-west-2 \
  --query 'targetDomains[0].verificationStatus'
```

**Expected:** `VERIFIED`

### Option B: HTTP Route

```bash
# Register the domain
aws securityagent create-target-domain \
  --target-domain-name api.yourcompany.com \
  --verification-method HTTP_ROUTE \
  --region us-west-2
```

Host the verification file at:
`https://api.yourcompany.com/.well-known/security-agent-verification`

Then verify:
```bash
curl -s https://api.yourcompany.com/.well-known/security-agent-verification
# Should return the verification content

aws securityagent verify-target-domain \
  --target-domain-name api.yourcompany.com \
  --region us-west-2
```

**Skip this step if you only need design review and code review** (domain is only required for pen testing).

---

## Step 3: Connect GitHub for Code Review

**Where:** AWS Console → Security Agent → Integrations

1. Open [Security Agent console](https://console.aws.amazon.com/securityagent)
2. Click your agent space (`prism-d1-security`)
3. Go to **Integrations** → **Add Integration**
4. Select **GitHub**
5. Authorize Security Agent to access your GitHub organization
6. Select the repositories to monitor
7. Save

**Or via CLI:**

```bash
aws securityagent create-integration \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --integration-type GITHUB \
  --region us-west-2
# Follow the authorization URL in the output
```

**Verify:**

```bash
aws securityagent list-integrations \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --region us-west-2 \
  --output table
```

**Expected:** GitHub integration listed with status `ACTIVE`.

After this, Security Agent automatically reviews every PR opened against the connected repositories.

---

## Step 4: Create a Pen Test Configuration

**Where:** Terminal

```bash
# Get the service role ARN from CDK outputs
SERVICE_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name PrismD1MetricsPipelineStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SecurityAgentServiceRoleArnOutput`].OutputValue' \
  --output text 2>/dev/null || echo "")

# If the role ARN is empty, use the one from the SecurityAgent construct
if [[ -z "${SERVICE_ROLE_ARN}" ]]; then
  SERVICE_ROLE_ARN=$(aws iam list-roles \
    --query "Roles[?contains(RoleName, 'security-agent')].Arn" \
    --output text | head -1)
fi

echo "Service Role: ${SERVICE_ROLE_ARN}"

# Create the pen test configuration
PENTEST_RESULT=$(aws securityagent create-pentest \
  --title "PRISM D1 - Application Pen Test" \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --service-role "${SERVICE_ROLE_ARN}" \
  --assets '{
    "endpoints": [
      {"url": "https://api.yourcompany.com"}
    ]
  }' \
  --code-remediation-strategy DISABLED \
  --region us-west-2 \
  --output json)

PENTEST_ID=$(echo "${PENTEST_RESULT}" | jq -r '.pentestId')
echo "Pen Test ID: ${PENTEST_ID}"
```

**Save the `PENTEST_ID`** — you'll need it for the GitHub workflow.

**Verify:**

```bash
aws securityagent list-pentests \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --region us-west-2 \
  --output table
```

---

## Step 5: Configure the PRISM Webhook

**Where:** AWS Console → Security Agent → Settings

This tells Security Agent to send findings directly to your PRISM API.

1. In the Security Agent console, go to **Settings** → **Notifications** (or **Webhooks**)
2. Click **Add Webhook**
3. Fill in:

| Field | Value |
|---|---|
| **URL** | `${PRISM_API_URL}/security-findings` (e.g., `https://abc123.execute-api.us-west-2.amazonaws.com/v1/security-findings`) |
| **Method** | POST |
| **Header name** | `x-api-key` |
| **Header value** | Your PRISM API key (the `${PRISM_API_KEY}` you saved earlier) |
| **Events** | All finding types |
| **Format** | JSON |

4. Click **Test** → should return `200 OK`
5. Save

**Verify the webhook works:**

```bash
# Send a test finding
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${PRISM_API_URL}/security-findings" \
  -H "x-api-key: ${PRISM_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "findings": [{
      "finding_id": "test-001",
      "type": "code_review",
      "severity": "LOW",
      "title": "Test finding - safe to ignore",
      "description": "Verifying webhook connectivity",
      "category": "Test",
      "repository": "your-org/your-repo",
      "team_id": "your-team",
      "found_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }]
  }'
```

**Expected:** `HTTP Status: 200` and `{"message":"OK","findingsProcessed":1}`

---

## Step 6: Seed Developer Identity Mapping

**Where:** Terminal

PRISM attributes findings to developers by matching IAM principal ARNs to email addresses. Without this mapping, the "AI vs Human" attribution shows "unknown."

**Find your team's IAM ARNs:**

```bash
# See who's been calling Bedrock
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventSource,AttributeValue=bedrock.amazonaws.com \
  --max-results 20 \
  --region us-west-2 \
  --query 'Events[].{User:Username,Time:EventTime}' \
  --output table
```

**Add each developer:**

```bash
# Repeat for each team member
aws dynamodb put-item \
  --table-name prism-identity-mapping \
  --region us-west-2 \
  --item '{
    "iam_principal": {"S": "arn:aws:sts::123456789012:assumed-role/DeveloperRole/jane@company.com"},
    "developer_email": {"S": "jane@company.com"},
    "team_id": {"S": "team-alpha"},
    "display_name": {"S": "Jane Developer"}
  }'
```

**For SSO/Identity Center users**, the principal is the assumed role ARN, not the user ARN. Check CloudTrail to see the exact format.

**Verify:**

```bash
aws dynamodb scan \
  --table-name prism-identity-mapping \
  --region us-west-2 \
  --query 'Items[].{Principal:iam_principal.S,Email:developer_email.S,Team:team_id.S}' \
  --output table
```

---

## Step 7: Configure GitHub Repository Variables

**Where:** GitHub → your repo → Settings → Secrets and Variables → Actions

The GitHub Actions workflow needs these values. Add them as **repository variables** (not secrets, except the API key):

| Type | Name | Value | Where to Find It |
|---|---|---|---|
| **Secret** | `PRISM_API_KEY` | Your PRISM API key | Step "Before You Start" above |
| Variable | `PRISM_API_URL` | `https://xxx.execute-api.us-west-2.amazonaws.com/v1` | CDK output `ApiUrl` |
| Variable | `PRISM_TEAM_ID` | `team-alpha` (your team name) | Your choice |
| Variable | `PRISM_AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/GitHubActionsRole` | Your OIDC role for GitHub Actions |
| Variable | `PRISM_AGENT_SPACE_ID` | `as-xxxxxxxxxxxx` | Step 1 output (`${AGENT_SPACE_ID}`) |
| Variable | `PRISM_PENTEST_ID` | `pt-xxxxxxxxxxxx` | Step 4 output (`${PENTEST_ID}`) |

---

## Step 8: Install the GitHub Workflow

**Where:** Terminal, in your project repo

```bash
# Copy the workflow into your repo
mkdir -p .github/workflows
cp /path/to/bootstrapper/security-agent/prism-security-agent-scan.yml .github/workflows/

# Commit and push
git add .github/workflows/prism-security-agent-scan.yml
git commit -m "Add Security Agent scan workflow"
git push
```

**What the workflow does automatically:**

| Event | Trigger | What Happens |
|---|---|---|
| Push to `specs/**` or `docs/design/**` | Design review | 1. `add-artifact` uploads specs as context → 2. `start-pentest-job` runs analysis using spec context → 3. `list-findings` collects results → 4. Forward to PRISM API |
| PR opened or updated | Code review | Security Agent GitHub integration reviews PR automatically → workflow collects findings via `list-findings` → forward to PRISM API |
| Successful deployment | Pen test | `start-pentest-job` runs pen test against deployed app → poll until complete → `list-findings` → forward to PRISM API |
| Manual dispatch | Any | Select scan type from GitHub Actions UI → runs the corresponding flow above |

**Key concept:** Specs uploaded via `add-artifact` are **context**, not standalone scans. Security Agent uses them to understand your application's intent, then crafts targeted security analysis during pen test execution. This is why design review triggers a pen test job — the pen test engine is what performs the analysis.

All findings are automatically forwarded to the PRISM API endpoint and appear in dashboards.

---

## Step 9: Run the PRISM Setup Script

**Where:** Terminal, in your project repo

```bash
chmod +x /path/to/bootstrapper/security-agent/setup.sh

/path/to/bootstrapper/security-agent/setup.sh \
  --api-url "${PRISM_API_URL}" \
  --api-key "${PRISM_API_KEY}" \
  --team-id team-alpha \
  --region us-west-2
```

This creates `.prism/security-agent.json` with:
- Scan triggers (on_spec_commit, on_pr, on_deploy_to_staging)
- Severity thresholds (CRITICAL/HIGH block merge)
- Remediation SLAs (24h Critical, 72h High, 30d Medium)

---

## Step 10: Verify End-to-End

Run through each flow to confirm everything is connected.

### Test 1: Design Review

```bash
# Create a test spec
cat > specs/test-security-review.md << 'EOF'
# Feature: User Login

## Requirements
1. Accept email and password via POST /auth/login
2. Return JWT token on success

## Design Constraints
- Use bcrypt for password hashing
EOF

git add specs/test-security-review.md
git commit -m "Add test spec for security review"
git push
```

**What happens:**
1. GitHub Actions triggers "PRISM Security Agent Scan" workflow
2. Workflow uploads spec as context artifact (`add-artifact`)
3. Workflow starts pen test job that uses spec context (`start-pentest-job`)
4. Security Agent analyzes your design for security gaps (auth, data flow, rate limiting, etc.)
5. Findings collected and forwarded to PRISM API
6. Findings appear in Team Velocity → "Security Agent Findings" section

**Check:** GitHub Actions tab shows workflow completed → PRISM dashboard shows design_review findings.

### Test 2: Code Review

```bash
# Create a PR with code changes
git checkout -b test-security-review
echo "// test change" >> src/index.ts
git add src/index.ts
git commit -m "Test code for security review

AI-Origin: claude-code"
git push -u origin test-security-review
# Open a PR via GitHub
```

**Check:** Security Agent reviews the PR → findings appear as PR comments AND in PRISM dashboard.

### Test 3: Pen Test (manual)

```bash
# Start a pen test job
aws securityagent start-pentest-job \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --pentest-id "${PENTEST_ID}" \
  --region us-west-2

# Monitor status
aws securityagent list-pentest-jobs-for-pentest \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --pentest-id "${PENTEST_ID}" \
  --region us-west-2 \
  --query 'pentestJobSummaries[0].{JobId:pentestJobId,Status:status}' \
  --output table
```

**Check:** Wait for `COMPLETED` status → findings forwarded to PRISM → visible in CISO Compliance dashboard.

### Test 4: Dashboards

Open each dashboard and verify data:

| Dashboard | URL Pattern | What to Check |
|---|---|---|
| Team Velocity | `https://<region>.console.aws.amazon.com/cloudwatch/home#dashboards:name=PRISM-D1-Team-Velocity` | "Security Agent Findings" section has data |
| CISO Compliance | `https://<region>.console.aws.amazon.com/cloudwatch/home#dashboards:name=PRISM-D1-CISO-Compliance` | Security posture + AI risk profile populated |
| Alarms | `https://<region>.console.aws.amazon.com/cloudwatch/home#alarmsV2:` | `SecurityCriticalFinding` alarm in OK state |

---

## Troubleshooting

| Problem | Check | Fix |
|---|---|---|
| `aws securityagent` command not found | `aws --version` | Upgrade to AWS CLI v2.x |
| Agent space not found | `aws securityagent list-agent-spaces` | Re-deploy CDK: `npx cdk deploy --all` |
| Domain verification stuck | `dig TXT _securityagent.yourdomain.com` | Wait 5 min for DNS propagation; check record is exact |
| No findings in PRISM | Check `security-agent-processor` Lambda logs | Verify webhook URL and API key match |
| Code review not triggering | Check Security Agent console → Integrations | Re-authorize GitHub connection |
| Identity shows "unknown" | `aws dynamodb scan --table-name prism-identity-mapping` | Add missing IAM principal mappings |
| Eval gate not blocking | Check `security-compliance.json` has `security_agent_findings` criterion | Verify `security-response-automator` Lambda wrote penalty record |
| Pen test fails to start | Check IAM service role permissions | Ensure role has `securityagent:StartPentest` permission |
| Workflow fails on push | Check GitHub Actions logs | Verify all 6 repository variables are set |

---

## Quick Reference: All Commands

```bash
# List agent spaces
aws securityagent list-agent-spaces --region us-west-2

# Upload a spec as context (Security Agent uses this during pen tests)
aws securityagent add-artifact \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --artifact-content fileb://specs/my-spec.md \
  --artifact-type MD --file-name my-spec.md

# List uploaded artifacts
aws securityagent list-artifacts \
  --agent-space-id "${AGENT_SPACE_ID}"

# Start a pen test
aws securityagent start-pentest-job \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --pentest-id "${PENTEST_ID}"

# Check pen test status
aws securityagent list-pentest-jobs-for-pentest \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --pentest-id "${PENTEST_ID}" \
  --query 'pentestJobSummaries[0].status'

# Get findings from a pen test job
aws securityagent list-findings \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --pentest-job-id <job-id>

# List all findings in batch
aws securityagent batch-get-findings \
  --agent-space-id "${AGENT_SPACE_ID}" \
  --finding-ids <id1> <id2>

# Register a target domain
aws securityagent create-target-domain \
  --target-domain-name api.example.com \
  --verification-method DNS_TXT

# Verify a domain
aws securityagent verify-target-domain \
  --target-domain-name api.example.com

# Forward findings to PRISM
curl -X POST "${PRISM_API_URL}/security-findings" \
  -H "x-api-key: ${PRISM_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"findings":[...]}'

# Query PRISM for findings
curl -s "${PRISM_API_URL}/security-findings/team-alpha?hours=168" \
  -H "x-api-key: ${PRISM_API_KEY}" | jq '.count'
```

---

## What Gets Created (Summary)

| Resource | How | Purpose |
|---|---|---|
| Agent Space (`prism-d1-security`) | CDK auto-deploys | Security Agent scope + KMS encryption |
| IAM Service Role | CDK auto-deploys | Pen test execution permissions |
| CloudWatch Log Group | CDK auto-deploys | Pen test result logging (6-month retention) |
| Target Domain | Step 2 (manual or CDK) | Pen test scope with ownership proof |
| GitHub Integration | Step 3 (console) | Automated code review on PRs |
| Pen Test Config | Step 4 (CLI) | Reusable pen test definition |
| Webhook | Step 5 (console) | Findings → PRISM API |
| Identity Mapping | Step 6 (CLI) | IAM → developer attribution |
| GitHub Variables (6) | Step 7 (GitHub UI) | Workflow configuration |
| GitHub Workflow | Step 8 (git commit) | Automated scan triggers |
| `.prism/security-agent.json` | Step 9 (setup script) | Local config + SLA thresholds |
