# CLAUDE.md

## Project Overview
This is the PRISM D1 sample application -- a TypeScript REST API
built with Express.js. It serves as the workshop project for
learning AI-native development lifecycle practices.

## Development Workflow
- ALWAYS check /specs for an existing spec before implementing any feature
- If no spec exists for the requested feature, STOP and create a spec first
- Spec files use the Kiro format (see /specs/template.md for reference)
- Do not implement beyond what the spec's acceptance criteria define

## Code Standards
- TypeScript strict mode (`strict: true` in tsconfig.json)
- No use of `any` type -- use proper interfaces
- All API endpoints must include JSDoc with @route, @param, and @returns
- Error responses follow RFC 7807 Problem Details format
- All new functions require unit tests in the adjacent `.test.ts` file

## Git Commit Conventions
- Use conventional commits: `feat|fix|docs|refactor|test(scope): description`
- Reference the spec file in the commit body: `Spec: specs/<filename>.md`
- Keep commits atomic -- one logical change per commit
- REQUIRED: Include these AI metadata trailers in every commit:
  ```
  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  AI-Origin: ai-generated
  AI-Tool: claude-code
  AI-Model: anthropic.claude-sonnet-4-5-20250929
  ```

## Testing
- Run tests with: `npm test`
- Run single test file: `npx vitest run <path>`
- All tests must pass before committing

## Project Structure
- `/src/routes/` -- API route handlers
- `/src/models/` -- Data models and interfaces
- `/src/middleware/` -- Express middleware
- `/specs/` -- Feature specifications (Kiro format)
- `/tests/` -- Integration tests
