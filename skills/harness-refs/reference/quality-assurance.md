# Quality Assurance

Verification strategies and quality gate patterns for reliable agent engineering.

## Verification Philosophy

**Proof over assumption.** Every claim must be backed by captured output from the running system. Reading code is research, not verification.

## Verification Strategies

### API Verification
- **Happy path**: curl/httpie request with expected response
- **Error cases**: 401, 400, 404, 422 responses
- **DB state**: Query the database to confirm data was written correctly
- **Record**: Capture both the command and the full response

```bash
# Example: verify an API endpoint
curl -s -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}' | jq .

# Verify DB state
psql -d mydb -c "SELECT * FROM items WHERE name = 'test';"
```

### UI Verification
- **Browser automation**: Playwright, Puppeteer, or equivalent E2E framework
- **Never use curl for UI**: SSR HTML doesn't reflect client-side behavior
- **Screenshot evidence**: Capture screenshots at key states
- **Interaction proofs**: Click, type, navigate — prove the UI responds correctly

### Infrastructure Verification
- **Schema verification**: Inspect tables, columns, constraints, indexes
- **Config verification**: Check environment variables, connection strings
- **Service verification**: Health checks, port availability, process status

## Quality Gate Pattern

Run parallel review agents, each checking a different dimension of code quality. This is faster and more thorough than sequential review.

### Dimensions

1. **Code reuse**: Does the new code duplicate existing utilities?
2. **Code quality**: Redundant state, parameter sprawl, copy-paste, leaky abstractions
3. **Efficiency**: Unnecessary work, missed concurrency, hot-path bloat, N+1 patterns
4. **Bug scan**: Logic errors, null dereferences, race conditions, off-by-one
5. **Library API correctness**: Are external library APIs used correctly per current docs?
6. **Comment compliance**: Do changes violate documented constraints in code comments?
7. **Domain-specific**: Frontend design quality, security review, etc. (optional, context-dependent)

### Confidence Scoring

Each finding gets a 0-100 confidence score:
- **0-25**: Likely false positive or pre-existing issue → drop
- **25-50**: Might be real but could be a nitpick → drop
- **50-75**: Verified real, will be hit in practice → fix
- **75-100**: Confirmed real, high impact → fix immediately

**Threshold**: Drop findings scored below 50.

### False Positive Indicators
- Pre-existing issues not introduced by the current branch
- Issues a linter or type checker would catch (don't duplicate static analysis)
- Pedantic nitpicks a senior engineer wouldn't flag
- Intentional changes in functionality flagged as "bugs"

## The Verification Checklist

Before creating a PR, confirm:

1. **Build passes**: The project compiles/builds without errors
2. **Lint passes**: No linting violations introduced
3. **Type check passes**: No type errors introduced
4. **Tests pass**: All existing tests pass, new tests added for new behavior
5. **AC proved**: Every acceptance criterion has captured evidence
6. **CI monitored**: After PR creation, wait for CI and fix any failures

The exact commands for each step come from the `## Harness Context` section.
