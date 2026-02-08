# Session Log

Timestamp: 20:27:51 | 02/04/2026

## Summary
- Added unit-test script that excludes integration tests and updated pre-commit to use it.
- Converted webhook status tests to use an ephemeral port to avoid hard-coded high ports.
- Renamed webhook status test file to mark it as integration.

## Reasoning
- Pre-commit should not be blocked by integration tests that require local listeners.
- Ephemeral port allocation reduces port collisions and permission issues.

## Tests
- `pnpm test:unit`
