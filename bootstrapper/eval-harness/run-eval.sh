#!/usr/bin/env bash
# run-eval.sh — Run a Bedrock Evaluation against a rubric and emit results to EventBridge.
#
# Usage:
#   ./run-eval.sh <rubric-file> <input-file> [--config <config-file>] [--spec <spec-file>]
#
# Examples:
#   ./run-eval.sh rubrics/code-quality.json src/handler.ts
#   ./run-eval.sh rubrics/api-response-quality.json src/api/ --config custom-config.json
#   ./run-eval.sh rubrics/spec-compliance.json src/handler.ts --spec specs/feature.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CONFIG="${SCRIPT_DIR}/eval-config.json"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
RUBRIC_FILE=""
INPUT_FILE=""
CONFIG_FILE="${DEFAULT_CONFIG}"
SPEC_FILE=""

usage() {
    echo "Usage: $0 <rubric-file> <input-file> [--config <config-file>] [--spec <spec-file>]"
    echo ""
    echo "Arguments:"
    echo "  rubric-file   Path to the rubric JSON file (e.g., rubrics/code-quality.json)"
    echo "  input-file    Path to the code file or directory to evaluate"
    echo "  --config      Path to eval config JSON (default: eval-config.json)"
    echo "  --spec        Path to spec file for spec-compliance evaluation"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --spec)
            SPEC_FILE="$2"
            shift 2
            ;;
        --help|-h)
            usage
            ;;
        *)
            if [[ -z "${RUBRIC_FILE}" ]]; then
                RUBRIC_FILE="$1"
            elif [[ -z "${INPUT_FILE}" ]]; then
                INPUT_FILE="$1"
            else
                echo "Error: unexpected argument '$1'"
                usage
            fi
            shift
            ;;
    esac
done

if [[ -z "${RUBRIC_FILE}" || -z "${INPUT_FILE}" ]]; then
    echo "Error: rubric-file and input-file are required."
    usage
fi

# ---------------------------------------------------------------------------
# Validate inputs
# ---------------------------------------------------------------------------
if [[ ! -f "${RUBRIC_FILE}" ]]; then
    echo "Error: rubric file not found: ${RUBRIC_FILE}"
    exit 1
fi

if [[ ! -e "${INPUT_FILE}" ]]; then
    echo "Error: input file/directory not found: ${INPUT_FILE}"
    exit 1
fi

if [[ ! -f "${CONFIG_FILE}" ]]; then
    echo "Error: config file not found: ${CONFIG_FILE}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Check dependencies
# ---------------------------------------------------------------------------
for cmd in aws jq; do
    if ! command -v "${cmd}" &>/dev/null; then
        echo "Error: '${cmd}' is required but not found in PATH."
        exit 1
    fi
done

# ---------------------------------------------------------------------------
# Load configuration
# ---------------------------------------------------------------------------
PASS_THRESHOLD=$(jq -r '.pass_threshold' "${CONFIG_FILE}")
MODEL_ID=$(jq -r '.model_id' "${CONFIG_FILE}")
EVAL_MODEL_ID=$(jq -r '.eval_model_id' "${CONFIG_FILE}")
EVENT_BUS=$(jq -r '.event_bus' "${CONFIG_FILE}")
AWS_REGION=$(jq -r '.aws_region' "${CONFIG_FILE}")
OUTPUT_DIR=$(jq -r '.output_dir // ".prism/eval-results"' "${CONFIG_FILE}")
EMIT_TO_EB=$(jq -r '.emit_to_eventbridge // true' "${CONFIG_FILE}")

RUBRIC_NAME=$(jq -r '.rubric_name' "${RUBRIC_FILE}")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EVAL_ID="eval-$(date +%s)-$$"

echo "=== PRISM D1 Eval Harness ==="
echo "Rubric:     ${RUBRIC_NAME}"
echo "Input:      ${INPUT_FILE}"
echo "Model:      ${EVAL_MODEL_ID}"
echo "Threshold:  ${PASS_THRESHOLD}"
echo "Eval ID:    ${EVAL_ID}"
echo ""

# ---------------------------------------------------------------------------
# Collect input content
# ---------------------------------------------------------------------------
if [[ -d "${INPUT_FILE}" ]]; then
    INPUT_CONTENT=$(find "${INPUT_FILE}" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.rs" \) -exec cat {} +)
else
    INPUT_CONTENT=$(cat "${INPUT_FILE}")
fi

if [[ -z "${INPUT_CONTENT}" ]]; then
    echo "Error: no evaluable content found in ${INPUT_FILE}"
    exit 1
fi

RUBRIC_CONTENT=$(cat "${RUBRIC_FILE}")

# Load spec content if provided
SPEC_CONTENT=""
if [[ -n "${SPEC_FILE}" ]]; then
    if [[ ! -f "${SPEC_FILE}" ]]; then
        echo "Warning: spec file not found: ${SPEC_FILE}. Proceeding without spec."
    else
        SPEC_CONTENT=$(cat "${SPEC_FILE}")
        echo "Spec:       ${SPEC_FILE}"
    fi
fi

# ---------------------------------------------------------------------------
# Build the evaluation prompt
# ---------------------------------------------------------------------------
if [[ -n "${SPEC_CONTENT}" ]]; then
    EVAL_PROMPT=$(jq -n \
        --arg rubric "${RUBRIC_CONTENT}" \
        --arg code "${INPUT_CONTENT}" \
        --arg spec "${SPEC_CONTENT}" \
        '{
            "rubric": ($rubric | fromjson),
            "code_to_evaluate": $code,
            "spec": $spec,
            "instructions": "Evaluate the provided code against each criterion in the rubric, using the spec as the source of truth for requirements. For each criterion, provide a score (1-5) and reasoning. Then calculate the weighted overall score normalized to 0-1. Return a JSON object matching the output_format in the rubric."
        }')
else
    EVAL_PROMPT=$(jq -n \
        --arg rubric "${RUBRIC_CONTENT}" \
        --arg code "${INPUT_CONTENT}" \
        '{
            "rubric": ($rubric | fromjson),
            "code_to_evaluate": $code,
            "instructions": "Evaluate the provided code against each criterion in the rubric. For each criterion, provide a score (1-5) and reasoning. Then calculate the weighted overall score normalized to 0-1. Return a JSON object matching the output_format in the rubric."
        }')
fi

# ---------------------------------------------------------------------------
# Call Bedrock
# ---------------------------------------------------------------------------
echo "Invoking Bedrock model ${EVAL_MODEL_ID}..."

BEDROCK_REQUEST=$(echo "${EVAL_PROMPT}" | jq '{
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    messages: [{
        role: "user",
        content: ("You are a code evaluator. Evaluate the following code against the rubric and return ONLY a JSON object with the evaluation results.\n\n" + (. | tostring))
    }]
}')

# Write request to temp file — avoids shell escaping issues with --body
BEDROCK_REQ_FILE=$(mktemp)
echo "${BEDROCK_REQUEST}" > "${BEDROCK_REQ_FILE}"

BEDROCK_RESP_FILE=$(mktemp)
BEDROCK_ERR_FILE=$(mktemp)
aws bedrock-runtime invoke-model \
    --region "${AWS_REGION}" \
    --model-id "${EVAL_MODEL_ID}" \
    --content-type "application/json" \
    --accept "application/json" \
    --body "fileb://${BEDROCK_REQ_FILE}" \
    "${BEDROCK_RESP_FILE}" 2>"${BEDROCK_ERR_FILE}" || {
        echo "Error: Bedrock invoke-model failed:" >&2
        cat "${BEDROCK_ERR_FILE}" >&2
        rm -f "${BEDROCK_REQ_FILE}" "${BEDROCK_RESP_FILE}" "${BEDROCK_ERR_FILE}"
        exit 1
    }

BEDROCK_RESPONSE=$(cat "${BEDROCK_RESP_FILE}")
rm -f "${BEDROCK_REQ_FILE}" "${BEDROCK_RESP_FILE}" "${BEDROCK_ERR_FILE}"

test -n "${BEDROCK_RESPONSE}" || {
    echo "Error: Bedrock invocation failed. Check AWS credentials and model access."
    echo "Hint: Ensure you have access to ${EVAL_MODEL_ID} in ${AWS_REGION}."
    exit 1
}

# ---------------------------------------------------------------------------
# Parse the evaluation result
# ---------------------------------------------------------------------------
EVAL_RESULT=$(echo "${BEDROCK_RESPONSE}" | jq -r '.content[0].text // .body' 2>/dev/null | jq '.' 2>/dev/null) || {
    echo "Warning: Could not parse structured eval result. Raw response saved."
    EVAL_RESULT="${BEDROCK_RESPONSE}"
}

OVERALL_SCORE=$(echo "${EVAL_RESULT}" | jq -r '.overall_score // 0' 2>/dev/null || echo "0")

# Determine pass/fail
PASS=$(echo "${OVERALL_SCORE} >= ${PASS_THRESHOLD}" | bc -l 2>/dev/null || echo "0")
if [[ "${PASS}" == "1" ]]; then
    RESULT="PASS"
else
    RESULT="FAIL"
fi

# ---------------------------------------------------------------------------
# Save results locally
# ---------------------------------------------------------------------------
mkdir -p "${OUTPUT_DIR}"
RESULT_FILE="${OUTPUT_DIR}/${EVAL_ID}.json"

jq -n \
    --arg eval_id "${EVAL_ID}" \
    --arg rubric "${RUBRIC_NAME}" \
    --arg input "${INPUT_FILE}" \
    --arg timestamp "${TIMESTAMP}" \
    --argjson score "${OVERALL_SCORE}" \
    --arg threshold "${PASS_THRESHOLD}" \
    --arg result "${RESULT}" \
    --argjson detail "${EVAL_RESULT}" \
    '{
        "eval_id": $eval_id,
        "rubric": $rubric,
        "input": $input,
        "timestamp": $timestamp,
        "overall_score": $score,
        "pass_threshold": ($threshold | tonumber),
        "result": $result,
        "detail": $detail
    }' > "${RESULT_FILE}"

echo ""
echo "=== Evaluation Result ==="
echo "Score:    ${OVERALL_SCORE}"
echo "Threshold: ${PASS_THRESHOLD}"
echo "Result:   ${RESULT}"
echo "Saved to: ${RESULT_FILE}"

# ---------------------------------------------------------------------------
# Emit EventBridge event
# ---------------------------------------------------------------------------
if [[ "${EMIT_TO_EB}" == "true" ]]; then
    echo ""
    echo "Emitting prism.d1.eval event to EventBridge..."

    TEAM_ID="unknown"
    REPO="unknown"
    PRISM_LEVEL=2
    if [[ -f ".prism/config.json" ]]; then
        TEAM_ID=$(jq -r '.team_id // "unknown"' .prism/config.json)
        REPO=$(jq -r '.repo // "unknown"' .prism/config.json)
        PRISM_LEVEL=$(jq -r '.prism_level // 2' .prism/config.json)
    fi

    # Extract criterion-level scores from eval result for EventBridge
    CRITERION_SCORES=$(echo "${EVAL_RESULT}" | jq -c '
      if .criteria then
        [.criteria | to_entries[] | {
          name: .key,
          score: (.value.score // .value.rating // 0),
          max_score: (.value.max_score // 5),
          reasoning: (.value.reasoning // .value.rationale // "" | .[0:200])
        }]
      else [] end
    ' 2>/dev/null || echo "[]")

    EB_EVENT=$(jq -n \
        --arg team_id "${TEAM_ID}" \
        --arg repo "${REPO}" \
        --arg timestamp "${TIMESTAMP}" \
        --arg prism_level "${PRISM_LEVEL}" \
        --argjson score "${OVERALL_SCORE}" \
        --arg rubric "${RUBRIC_NAME}" \
        --arg result "${RESULT}" \
        --arg eval_model "${EVAL_MODEL_ID}" \
        --arg eval_id "${EVAL_ID}" \
        --arg input_file "${INPUT_FILE}" \
        --argjson criterion_scores "${CRITERION_SCORES}" \
        '{
            "team_id": $team_id,
            "repo": $repo,
            "timestamp": $timestamp,
            "prism_level": ($prism_level | tonumber),
            "metric": {
                "name": "eval_score",
                "value": $score,
                "unit": "score"
            },
            "ai_context": {
                "tool": "bedrock-eval",
                "model": $eval_model,
                "origin": "ai-generated"
            },
            "eval": {
                "eval_id": $eval_id,
                "rubric": $rubric,
                "result": $result,
                "score": $score,
                "input_file": $input_file,
                "criterion_scores": $criterion_scores
            }
        }')

    aws events put-events \
        --region "${AWS_REGION}" \
        --entries "[{
            \"Source\": \"prism.d1.velocity\",
            \"DetailType\": \"prism.d1.eval\",
            \"EventBusName\": \"${EVENT_BUS}\",
            \"Detail\": $(echo "${EB_EVENT}" | jq -c '.' | jq -Rs '.')
        }]" > /dev/null 2>&1 && echo "Event emitted successfully." || echo "Warning: Failed to emit EventBridge event (non-blocking)."
fi

# ---------------------------------------------------------------------------
# Exit with appropriate code
# ---------------------------------------------------------------------------
if [[ "${RESULT}" == "PASS" ]]; then
    echo ""
    echo "Evaluation PASSED."
    exit 0
else
    echo ""
    echo "Evaluation FAILED. Score ${OVERALL_SCORE} is below threshold ${PASS_THRESHOLD}."
    exit 1
fi
