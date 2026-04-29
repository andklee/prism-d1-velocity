#!/usr/bin/env bash
# PRISM D1 Velocity -- Sample Metric Data Generator
# Generates 7 days of realistic team commit, PR, and eval data
# and sends it to EventBridge for dashboard population.
#
# Usage:
#   ./generate-sample-data.sh                          # defaults
#   ./generate-sample-data.sh prism-d1-metrics us-west-2
#   AWS_REGION=us-west-2 ./generate-sample-data.sh

set -euo pipefail

EVENT_BUS="${1:-prism-d1-metrics}"
REGION="${2:-${AWS_REGION:-us-west-2}}"
TEAM_ID="${PRISM_TEAM_ID:-demo-team}"

echo "=== PRISM D1 Sample Data Generator ==="
echo "Event bus: $EVENT_BUS"
echo "Region:    $REGION"
echo "Team ID:   $TEAM_ID"
echo ""

# Verify AWS credentials
if ! aws sts get-caller-identity --region "$REGION" &>/dev/null; then
  echo "ERROR: AWS credentials not valid. Run 'aws configure' first."
  exit 1
fi

# Verify event bus exists
if ! aws events describe-event-bus --name "$EVENT_BUS" --region "$REGION" &>/dev/null; then
  echo "ERROR: Event bus '$EVENT_BUS' not found in $REGION."
  echo "Did you run 'npx cdk deploy --all' first?"
  exit 1
fi

# Team configuration
ENGINEERS=("alice" "bob" "carol" "dave" "eve")
REPOS=("prism-d1-sample-app" "frontend-web")
AI_ORIGINS=("human" "ai-assisted" "ai-generated" "ai-assisted")  # 75% AI
TOOLS=("claude-code" "claude-code" "kiro" "claude-code")

TOTAL_EVENTS=0

emit_event() {
  local DETAIL_TYPE="$1"
  local DETAIL="$2"

  aws events put-events \
    --region "$REGION" \
    --entries "[{
      \"Source\": \"prism.d1.velocity\",
      \"DetailType\": \"$DETAIL_TYPE\",
      \"EventBusName\": \"$EVENT_BUS\",
      \"Detail\": $(echo "$DETAIL" | jq -Rs .)
    }]" > /dev/null 2>&1

  ((TOTAL_EVENTS++))
}

# Generate 7 days of data
for DAY_OFFSET in $(seq 7 -1 1); do
  if [[ "$OSTYPE" == "darwin"* ]]; then
    DAY_DATE=$(date -v-"${DAY_OFFSET}d" +%Y-%m-%d)
    DAY_NAME=$(date -v-"${DAY_OFFSET}d" "+%A")
  else
    DAY_DATE=$(date -d "$DAY_OFFSET days ago" +%Y-%m-%d)
    DAY_NAME=$(date -d "$DAY_DATE" "+%A")
  fi

  # Weekend = less activity
  COMMITS_PER_DAY=$((RANDOM % 8 + 12))
  if [ "$DAY_NAME" = "Saturday" ] || [ "$DAY_NAME" = "Sunday" ]; then
    COMMITS_PER_DAY=$((RANDOM % 3 + 1))
  fi

  echo "Generating $COMMITS_PER_DAY events for $DAY_DATE ($DAY_NAME)..."

  # Day 4 is the "bad day" — new engineer using AI without specs
  IS_BAD_DAY=false
  if [ "$DAY_OFFSET" -eq 4 ]; then
    IS_BAD_DAY=true
    echo "  (Bad day scenario — high AI usage, low acceptance)"
  fi

  for COMMIT_NUM in $(seq 1 "$COMMITS_PER_DAY"); do
    ENGINEER=${ENGINEERS[$((RANDOM % ${#ENGINEERS[@]}))]}
    REPO=${REPOS[$((RANDOM % ${#REPOS[@]}))]}
    AI_ORIGIN=${AI_ORIGINS[$((RANDOM % ${#AI_ORIGINS[@]}))]}
    TOOL=${TOOLS[$((RANDOM % ${#TOOLS[@]}))]}

    if [ "$AI_ORIGIN" = "human" ]; then
      TOOL="n/a"
      MODEL="n/a"
    else
      MODEL="us.anthropic.claude-haiku-4-5-20251001-v1:0"
    fi

    # Bad day: eve uses AI for everything
    if [ "$IS_BAD_DAY" = true ] && [ "$ENGINEER" = "eve" ]; then
      AI_ORIGIN="ai-generated"
      TOOL="claude-code"
    fi

    LINES_CHANGED=$((RANDOM % 150 + 10))
    HOUR=$((RANDOM % 10 + 8))
    MINUTE=$((RANDOM % 60))
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $HOUR):$(printf '%02d' $MINUTE):00Z"

    # --- Emit prism.d1.commit ---
    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --arg ai_origin "$AI_ORIGIN" \
      --arg tool "$TOOL" \
      --arg model "$MODEL" \
      --argjson lines_changed "$LINES_CHANGED" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "commit", "value": 1, "unit": "count" },
        "ai_context": { "tool": $tool, "model": $model, "origin": $ai_origin },
        "dora": { "deployment_frequency": null, "lead_time_seconds": null },
        "ai_dora": { "ai_to_merge_ratio": (if $ai_origin != "human" then 1 else 0 end) }
      }')

    emit_event "prism.d1.commit" "$DETAIL"
  done

  # --- Generate 2-4 PR merges per day ---
  PR_COUNT=$((RANDOM % 3 + 2))
  if [ "$DAY_NAME" = "Saturday" ] || [ "$DAY_NAME" = "Sunday" ]; then
    PR_COUNT=$((RANDOM % 2))
  fi

  for PR_NUM in $(seq 1 "$PR_COUNT"); do
    ENGINEER=${ENGINEERS[$((RANDOM % ${#ENGINEERS[@]}))]}
    REPO=${REPOS[$((RANDOM % ${#REPOS[@]}))]}
    TOTAL_COMMITS=$((RANDOM % 5 + 2))
    AI_COMMITS=$((RANDOM % (TOTAL_COMMITS + 1)))

    if [ "$TOTAL_COMMITS" -gt 0 ]; then
      AI_RATIO=$(echo "scale=4; $AI_COMMITS / $TOTAL_COMMITS" | bc -l | sed 's/^\./0./')
    else
      AI_RATIO="0"
    fi

    # Lead time trending down over the week (AI improving velocity)
    BASE_LEAD_TIME=$((3600 * (DAY_OFFSET + 1)))
    LEAD_TIME=$((BASE_LEAD_TIME + RANDOM % 3600))
    LEAD_HOURS=$(echo "scale=2; $LEAD_TIME / 3600" | bc -l | sed 's/^\./0./')

    PR_NUMBER=$((100 + DAY_OFFSET * 10 + PR_NUM))
    HOUR=$((RANDOM % 10 + 8))
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $HOUR):30:00Z"

    AI_ORIGIN="ai-assisted"
    if [ "$AI_COMMITS" -eq 0 ]; then AI_ORIGIN="human"; fi

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --argjson ai_ratio "$AI_RATIO" \
      --argjson total_commits "$TOTAL_COMMITS" \
      --argjson ai_commits "$AI_COMMITS" \
      --argjson lead_time_seconds "$LEAD_TIME" \
      --argjson lead_time_hours "$LEAD_HOURS" \
      --argjson pr_number "$PR_NUMBER" \
      --arg pr_author "$ENGINEER" \
      --arg ai_origin "$AI_ORIGIN" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "ai_to_merge_ratio", "value": $ai_ratio, "unit": "ratio" },
        "ai_context": { "tool": "github-actions", "model": "n/a", "origin": $ai_origin },
        "dora": { "lead_time_seconds": $lead_time_seconds, "lead_time_hours": $lead_time_hours },
        "ai_dora": {
          "ai_to_merge_ratio": $ai_ratio,
          "total_commits": $total_commits,
          "ai_commits": $ai_commits
        },
        "pr": { "number": $pr_number, "author": $pr_author }
      }')

    emit_event "prism.d1.pr" "$DETAIL"

    # --- Also emit a deploy event per merged PR ---
    DEPLOY_DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --argjson lead_time_hours "$LEAD_HOURS" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "deployment", "value": 1, "unit": "count" },
        "dora": { "deployment_frequency": 1, "lead_time_hours": $lead_time_hours }
      }')

    emit_event "prism.d1.deploy" "$DEPLOY_DETAIL"
  done

  # --- Generate eval gate results ---
  EVAL_COUNT=$((PR_COUNT))
  for EVAL_NUM in $(seq 1 "$EVAL_COUNT"); do
    REPO=${REPOS[$((RANDOM % ${#REPOS[@]}))]}
    PR_NUMBER=$((100 + DAY_OFFSET * 10 + EVAL_NUM))

    # Normal: 85-90% pass. Bad day: 50% pass
    SCORE="0.88"
    RESULT="PASS"
    if [ "$IS_BAD_DAY" = true ] && [ $((RANDOM % 2)) -eq 0 ]; then
      SCORE="0.62"
      RESULT="FAIL"
    elif [ $((RANDOM % 8)) -eq 0 ]; then
      SCORE="0.71"
      RESULT="FAIL"
    fi

    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):45:00Z"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --argjson score "$SCORE" \
      --arg result "$RESULT" \
      --argjson pr_number "$PR_NUMBER" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "eval_score", "value": $score, "unit": "score" },
        "ai_context": { "tool": "bedrock-eval", "model": "us.anthropic.claude-haiku-4-5-20251001-v1:0", "origin": "ai-generated" },
        "ai_dora": { "eval_gate_pass_rate": (if $result == "PASS" then 1 else 0 end) },
        "eval": { "result": $result, "pr_number": $pr_number }
      }')

    emit_event "prism.d1.eval" "$DETAIL"
  done
done

# ================================================================
# PILLAR 2-7 + SECURITY AGENT METRICS
# ================================================================

echo ""
echo "Generating guardrail, MCP, cost, attribution, and security agent events..."

for DAY_OFFSET in $(seq 7 -1 1); do
  if [[ "$OSTYPE" == "darwin"* ]]; then
    DAY_DATE=$(date -v-"${DAY_OFFSET}d" +%Y-%m-%d)
    DAY_NAME=$(date -v-"${DAY_OFFSET}d" "+%A")
  else
    DAY_DATE=$(date -d "$DAY_OFFSET days ago" +%Y-%m-%d)
    DAY_NAME=$(date -d "$DAY_DATE" "+%A")
  fi

  # Weekend = less activity
  if [ "$DAY_NAME" = "Saturday" ] || [ "$DAY_NAME" = "Sunday" ]; then
    continue
  fi

  # --- Guardrail trigger events ---
  GUARDRAIL_CATEGORIES=("CONTENT_FILTER" "SENSITIVE_INFO" "SENSITIVE_INFO" "DENIED_TOPIC")
  GUARDRAIL_TYPES=("PROMPT_ATTACK" "EMAIL" "PHONE" "competitor-recommendations")
  GUARDRAIL_ACTIONS=("BLOCK" "ANONYMIZE" "ANONYMIZE" "BLOCK")

  GUARDRAIL_COUNT=$((RANDOM % 8 + 3))
  for GR_NUM in $(seq 1 "$GUARDRAIL_COUNT"); do
    GR_IDX=$((RANDOM % ${#GUARDRAIL_CATEGORIES[@]}))
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --arg category "${GUARDRAIL_CATEGORIES[$GR_IDX]}" \
      --arg type "${GUARDRAIL_TYPES[$GR_IDX]}" \
      --arg action "${GUARDRAIL_ACTIONS[$GR_IDX]}" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 3,
        "metric": { "name": "guardrail_trigger", "value": 1, "unit": "count" },
        "guardrail": {
          "guardrail_id": "gr-demo-001",
          "guardrail_name": "prism-d1-agent-guardrail",
          "trigger_category": $category,
          "trigger_type": $type,
          "action_taken": $action,
          "agent_name": "task-assistant",
          "invocation_id": ("inv-" + $timestamp)
        }
      }')

    emit_event "prism.d1.guardrail" "$DETAIL"
  done

  # --- MCP tool call events ---
  MCP_TOOLS=("list_tasks" "create_task" "update_task" "search_tasks" "delete_task")
  MCP_RISKS=("low" "medium" "medium" "low" "high")

  MCP_COUNT=$((RANDOM % 40 + 20))
  for MCP_NUM in $(seq 1 "$MCP_COUNT"); do
    TOOL_IDX=$((RANDOM % ${#MCP_TOOLS[@]}))
    AUTHORIZED=true
    RESULT_STATUS="success"

    # 2% chance of denied call
    if [ $((RANDOM % 50)) -eq 0 ]; then
      AUTHORIZED=false
      RESULT_STATUS="denied"
    fi

    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"
    DURATION=$((RANDOM % 200 + 50))

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --arg tool_name "${MCP_TOOLS[$TOOL_IDX]}" \
      --argjson authorized "$AUTHORIZED" \
      --arg risk_level "${MCP_RISKS[$TOOL_IDX]}" \
      --argjson duration_ms "$DURATION" \
      --arg result_status "$RESULT_STATUS" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 3,
        "metric": { "name": "mcp_tool_call", "value": 1, "unit": "count" },
        "mcp_tool_call": {
          "session_id": ("sess-demo-" + $timestamp),
          "client_id": "task-assistant",
          "tool_name": $tool_name,
          "scopes_used": ["tasks:read", "tasks:write"],
          "authorized": $authorized,
          "risk_level": $risk_level,
          "duration_ms": $duration_ms,
          "result_status": $result_status
        }
      }')

    emit_event "prism.d1.mcp.tool_call" "$DETAIL"
  done

  # --- Token usage events ---
  MODELS=("anthropic.claude-sonnet-4-20250514" "anthropic.claude-haiku-4-5-20251001" "anthropic.claude-sonnet-4-20250514")
  TOKEN_COUNT=$((RANDOM % 15 + 8))
  for TK_NUM in $(seq 1 "$TOKEN_COUNT"); do
    MODEL_IDX=$((RANDOM % ${#MODELS[@]}))
    INPUT_TOKENS=$((RANDOM % 3000 + 500))
    OUTPUT_TOKENS=$((RANDOM % 1500 + 200))

    # Price calculation
    if [ "$MODEL_IDX" -eq 1 ]; then
      # Haiku: cheaper
      COST=$(echo "scale=6; ($INPUT_TOKENS / 1000) * 0.0008 + ($OUTPUT_TOKENS / 1000) * 0.004" | bc -l | sed 's/^\./0./')
    else
      # Sonnet
      COST=$(echo "scale=6; ($INPUT_TOKENS / 1000) * 0.003 + ($OUTPUT_TOKENS / 1000) * 0.015" | bc -l | sed 's/^\./0./')
    fi

    ENGINEER=${ENGINEERS[$((RANDOM % ${#ENGINEERS[@]}))]}
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --arg model "${MODELS[$MODEL_IDX]}" \
      --argjson input_tokens "$INPUT_TOKENS" \
      --argjson output_tokens "$OUTPUT_TOKENS" \
      --argjson cost "$COST" \
      --arg developer "$ENGINEER" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "bedrock_token_usage", "value": ($input_tokens + $output_tokens), "unit": "count" },
        "ai_context": { "tool": "bedrock", "model": $model, "origin": "ai-generated" },
        "token": {
          "model_id": $model,
          "input_tokens": $input_tokens,
          "output_tokens": $output_tokens,
          "total_tokens": ($input_tokens + $output_tokens),
          "cost_usd": $cost,
          "iam_principal": ("arn:aws:iam::123456789012:user/" + $developer),
          "developer_email": ($developer + "@company.com")
        }
      }')

    emit_event "prism.d1.token" "$DETAIL"
  done

  # --- Cost per commit events ---
  COST_COUNT=$((RANDOM % 6 + 3))
  for CST_NUM in $(seq 1 "$COST_COUNT"); do
    TOTAL_TOKENS=$((RANDOM % 4000 + 1000))
    TOTAL_COST=$(echo "scale=6; $TOTAL_TOKENS * 0.000008" | bc -l | sed 's/^\./0./')
    LINES_CHANGED=$((RANDOM % 80 + 10))
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --argjson total_tokens "$TOTAL_TOKENS" \
      --argjson total_cost "$TOTAL_COST" \
      --argjson lines_changed "$LINES_CHANGED" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "cost_per_commit", "value": $lines_changed, "unit": "lines" },
        "cost": {
          "commit_sha": "abc1234",
          "total_tokens": $total_tokens,
          "total_cost_usd": $total_cost,
          "models_used": ["anthropic.claude-sonnet-4-20250514"],
          "developer_email": "demo@company.com"
        }
      }')

    emit_event "prism.d1.cost" "$DETAIL"
  done

  # --- Eval gate per-rubric events ---
  RUBRICS=("code-quality" "api-response-quality" "security-compliance" "agent-quality" "spec-compliance")
  for RUBRIC in "${RUBRICS[@]}"; do
    SCORE=$(echo "scale=2; ($RANDOM % 20 + 75) / 100" | bc -l | sed 's/^\./0./')
    RESULT="PASS"
    if (( $(echo "$SCORE < 0.82" | bc -l) )); then
      RESULT="FAIL"
    fi
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --argjson score "$SCORE" \
      --arg result "$RESULT" \
      --arg rubric "$RUBRIC" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 3,
        "metric": { "name": "eval_score", "value": $score, "unit": "score" },
        "eval": { "eval_id": ("eval-demo-" + $rubric), "rubric": $rubric, "result": $result, "score": $score }
      }')

    emit_event "prism.d1.eval" "$DETAIL"
  done

  # --- AI vs Human defect rate (quality) events ---
  # One per day, triggered by deploy
  AI_DEFECT=$(echo "scale=4; ($RANDOM % 40 + 10) / 1000" | bc -l | sed 's/^\./0./')
  HUMAN_DEFECT=$(echo "scale=4; ($RANDOM % 60 + 20) / 1000" | bc -l | sed 's/^\./0./')
  AI_COMMITS=$((RANDOM % 8 + 4))
  HUMAN_COMMITS=$((RANDOM % 5 + 2))
  TIMESTAMP="${DAY_DATE}T17:00:00Z"

  DETAIL=$(jq -n \
    --arg team_id "$TEAM_ID" \
    --arg repo "${REPOS[0]}" \
    --arg timestamp "$TIMESTAMP" \
    --argjson ai_defect "$AI_DEFECT" \
    --argjson human_defect "$HUMAN_DEFECT" \
    --argjson ai_commits "$AI_COMMITS" \
    --argjson human_commits "$HUMAN_COMMITS" \
    '{
      "team_id": $team_id,
      "repo": $repo,
      "timestamp": $timestamp,
      "prism_level": 2,
      "metric": { "name": "post_merge_defect_rate", "value": (($ai_defect + $human_defect) / 2), "unit": "percent" },
      "quality": {
        "deployment_id": ("deploy-" + $timestamp),
        "ai_defect_rate": $ai_defect,
        "human_defect_rate": $human_defect,
        "total_ai_commits": $ai_commits,
        "total_human_commits": $human_commits
      }
    }')

  emit_event "prism.d1.quality" "$DETAIL"

  # --- Agent invocation events ---
  AGENT_COUNT=$((RANDOM % 15 + 5))
  for AG_NUM in $(seq 1 "$AGENT_COUNT"); do
    STEPS=$((RANDOM % 8 + 2))
    TOOLS_INVOKED=$((RANDOM % 5 + 1))
    TOKENS=$((RANDOM % 3000 + 500))
    DURATION=$((RANDOM % 2000 + 500))
    GR_TRIGGERED=$((RANDOM % 3))
    STATUS="success"
    if [ $((RANDOM % 15)) -eq 0 ]; then STATUS="failure"; fi

    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --argjson steps "$STEPS" \
      --argjson tools "$TOOLS_INVOKED" \
      --argjson tokens "$TOKENS" \
      --argjson duration "$DURATION" \
      --argjson guardrails "$GR_TRIGGERED" \
      --arg status "$STATUS" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 3,
        "metric": { "name": "agent_invocation", "value": 1, "unit": "count" },
        "ai_context": { "tool": "strands-agent", "model": "anthropic.claude-sonnet-4-20250514", "origin": "ai-generated" },
        "agent": {
          "agent_name": "task-assistant",
          "steps_taken": $steps,
          "tools_invoked": $tools,
          "duration_ms": $duration,
          "tokens_used": $tokens,
          "status": $status,
          "guardrails_triggered": $guardrails
        }
      }')

    emit_event "prism.d1.agent" "$DETAIL"
  done

  # --- Security Agent findings ---
  PHASES=("design_review" "code_review" "pen_test")
  SEVERITIES=("LOW" "MEDIUM" "MEDIUM" "HIGH" "LOW")
  CATEGORIES=("Injection" "Authentication" "Cryptography" "Access Control" "Configuration")
  AI_ORIGINS_SEC=("ai-assisted" "ai-assisted" "human" "ai-generated" "human")

  SA_COUNT=$((RANDOM % 4 + 1))
  for SA_NUM in $(seq 1 "$SA_COUNT"); do
    PHASE_IDX=$((RANDOM % ${#PHASES[@]}))
    SEV_IDX=$((RANDOM % ${#SEVERITIES[@]}))
    CAT_IDX=$((RANDOM % ${#CATEGORIES[@]}))
    ORIGIN_IDX=$((RANDOM % ${#AI_ORIGINS_SEC[@]}))

    EXPLOIT=false
    if [ "${PHASES[$PHASE_IDX]}" = "pen_test" ] && [ $((RANDOM % 5)) -eq 0 ]; then
      EXPLOIT=true
    fi

    CVSS=$(echo "scale=1; ($RANDOM % 80 + 10) / 10" | bc -l | sed 's/^\./0./')
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"
    FINDING_ID="SA-$(printf '%04d' $((DAY_OFFSET * 10 + SA_NUM)))"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --arg phase "${PHASES[$PHASE_IDX]}" \
      --arg severity "${SEVERITIES[$SEV_IDX]}" \
      --arg category "${CATEGORIES[$CAT_IDX]}" \
      --argjson cvss "$CVSS" \
      --argjson exploit "$EXPLOIT" \
      --arg ai_origin "${AI_ORIGINS_SEC[$ORIGIN_IDX]}" \
      --arg finding_id "$FINDING_ID" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 3,
        "metric": { "name": "security_finding", "value": 1, "unit": "count" },
        "ai_context": { "tool": "security-agent", "model": "aws-security-agent", "origin": $ai_origin },
        "security_agent_finding": {
          "finding_id": $finding_id,
          "phase": $phase,
          "severity": $severity,
          "cvss_score": $cvss,
          "title": ($category + " issue in " + $phase),
          "description": "Sample finding for demo purposes",
          "category": $category,
          "cwe_id": "CWE-79",
          "exploit_validated": $exploit,
          "remediation_guidance": "Review and fix the identified issue",
          "compliance_mappings": ["SOC2-CC6.1"],
          "ai_origin": $ai_origin,
          "pr_number": null,
          "commit_sha": null,
          "spec_ref": null,
          "environment": "staging",
          "found_at": $timestamp,
          "remediated_at": null
        }
      }')

    emit_event "prism.d1.security.${PHASES[$PHASE_IDX]}" "$DETAIL"
  done

  # --- Security remediation events (some findings get fixed) ---
  if [ $((RANDOM % 3)) -eq 0 ]; then
    REMEDIATION_HOURS=$(echo "scale=2; ($RANDOM % 48 + 4)" | bc -l)
    TIMESTAMP="${DAY_DATE}T16:00:00Z"
    FINDING_ID="SA-$(printf '%04d' $((DAY_OFFSET * 10 + 1)))"
    FIX_ORIGIN=${AI_ORIGINS_SEC[$((RANDOM % ${#AI_ORIGINS_SEC[@]}))]}

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "${REPOS[0]}" \
      --arg timestamp "$TIMESTAMP" \
      --argjson hours "$REMEDIATION_HOURS" \
      --arg fix_origin "$FIX_ORIGIN" \
      --arg finding_id "$FINDING_ID" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 3,
        "metric": { "name": "security_remediation", "value": $hours, "unit": "hours" },
        "security_remediation": {
          "finding_id": $finding_id,
          "severity": "MEDIUM",
          "remediation_time_hours": $hours,
          "remediated_by_origin": $fix_origin,
          "fix_pr_number": 142,
          "finding_phase": "code_review"
        }
      }')

    emit_event "prism.d1.security.remediation" "$DETAIL"
  fi
done

echo ""
echo "=== Generation Complete ==="
echo "Total events emitted: $TOTAL_EVENTS"
echo ""
echo "Open CloudWatch → Dashboards:"
echo "  • PRISM-D1-Team-Velocity      (developer view)"
echo "  • PRISM-D1-Executive-Readout   (leadership view)"
echo "  • PRISM-D1-CISO-Compliance     (security view)"
echo ""
echo "Set time range to 'Last 1 week' for the best view."
