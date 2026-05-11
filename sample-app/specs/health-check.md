# Feature: Health Check Endpoint

## Requirements
- [ ] Provide a GET endpoint that returns service health status
- [ ] Include uptime and timestamp in the response
- [ ] Return HTTP 200 when healthy

## Acceptance Criteria
- Given the service is running, when GET /health is called, then return 200 with status "ok"
- Given the service is running, when GET /health is called, then include "uptime" in seconds
- Given the service is running, when GET /health is called, then include "timestamp" in ISO 8601

## Design Constraints
- No authentication required on this endpoint
- Response time must be < 50ms (no database calls)

## API Contract
- Method: GET
- Path: /health
- Response: `{ "status": "ok", "uptime": 1234, "timestamp": "2026-04-13T10:00:00Z" }`
