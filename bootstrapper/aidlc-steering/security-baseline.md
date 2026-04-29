# Security Baseline Rules

> Adapted from [AWS AI-DLC Security Baseline](https://github.com/awslabs/aidlc-workflows).
> These rules are enforced during code generation and validated by the PRISM `security-compliance` eval rubric.

## Enforcement

These are **blocking constraints**, not optional guidance. AI coding agents must verify compliance before presenting code for review. The PRISM eval gate validates these rules automatically via the `security-compliance.json` rubric.

---

## SECURITY-01: Encryption at Rest and in Transit

Every data persistence store must have:
- Encryption at rest using KMS (customer-managed or AWS-managed keys)
- Encryption in transit enforced (TLS 1.2+ for all connections)
- No database connection using unencrypted protocols
- Object storage policies rejecting non-TLS requests

## SECURITY-02: Access Logging on Network Intermediaries

Every network-facing intermediary handling external traffic must have access logging:
- Load balancers: access logs to S3 or CloudWatch
- API Gateway: execution and access logging enabled
- CloudFront: standard or real-time logs configured

## SECURITY-03: Application-Level Logging

Every deployed application must include:
- Structured logging framework (not ad-hoc console.log/print)
- Output directed to CloudWatch Logs or equivalent
- Every log entry: timestamp, correlation/request ID, log level, message
- PII, secrets, tokens, and passwords must NEVER appear in log output

## SECURITY-04: HTTP Security Headers

All HTML-serving endpoints must set:

| Header | Value |
|---|---|
| `Content-Security-Policy` | Restrictive policy (minimum: `default-src 'self'`) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

## SECURITY-05: Input Validation

Every API endpoint must validate all input parameters:
- **Type checking**: reject unexpected types
- **Length/size bounds**: enforce maximums on strings, arrays, payloads
- **Format validation**: allowlist patterns for structured inputs (emails, dates, IDs)
- **Sanitization**: escape or reject HTML/script content for XSS prevention
- **Injection prevention**: parameterized queries for ALL database operations (never string concatenation)

## SECURITY-06: Least-Privilege IAM Policies

Every IAM policy must follow least privilege:
- Specific resource ARNs (no wildcard resources without documented exception)
- Specific actions (no wildcard actions)
- Scope conditions where possible
- Separate read and write into distinct policy statements

## SECURITY-07: Error Information Leakage

Error responses must not leak internals:
- Generic error messages to clients
- Stack traces, file paths, library versions logged server-side only
- Database errors never exposed to clients
- No version numbers or technology identifiers in error responses

## SECURITY-08: Dependency Security

- No known vulnerable dependencies (run `npm audit` / `pip audit` / equivalent)
- Pin dependency versions in lockfiles
- Review transitive dependencies for known issues
- Remove unused dependencies

---

## PRISM Integration

These rules map to the PRISM `security-compliance.json` eval rubric:

| Security Rule | Rubric Criterion | Weight |
|---|---|---|
| SECURITY-01 (Encryption) | `data_protection` | 0.15 |
| SECURITY-02, 03 (Logging) | `error_information_leakage` | 0.10 |
| SECURITY-04, 05 (Headers, Input) | `injection_prevention` | 0.20 |
| SECURITY-06 (IAM) | `least_privilege` | 0.15 |
| SECURITY-07 (Errors) | `error_information_leakage` | 0.10 |
| SECURITY-01 (Auth) | `authentication_authorization` | 0.20 |
| SECURITY-03 (Secrets) | `secret_management` | 0.20 |

The eval gate runs Bedrock against this rubric on every PR. Score below 0.82 blocks merge.
