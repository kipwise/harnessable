# Project Management Integration

Working with issue trackers, PR workflows, and status updates.

## Issue Lifecycle

### Standard Flow
```
Backlog → Ready → In Progress → In Review → Done
```

### Agent Behavior at Each Stage
- **Backlog/Ready**: Don't touch unless assigned
- **In Progress**: Set when starting work (Phase: Pickup)
- **In Review**: Set when PR is created (Phase: PR & CI). Do NOT set to "Done" — let the merge trigger that
- **Done**: Set by the system on PR merge, or by the human manually

## Issue Format

Well-formed issues have:
1. **Title**: Clear, action-oriented (e.g., "Add user profile page" not "User stuff")
2. **Description**: Context, motivation, any relevant links
3. **Acceptance Criteria**: Testable, specific, complete
4. **Labels**: Status indicators, priority, type (feature, bug, chore)
5. **Dependencies**: What must be done first

### Bad Acceptance Criteria
```
- Users can log in           ← too vague, what does "can" mean?
- The page works             ← untestable
- Fix the bug                ← which bug? what's the expected behavior?
```

### Good Acceptance Criteria
```
- POST /api/auth/login returns 200 with valid credentials and sets session cookie
- POST /api/auth/login returns 401 with invalid credentials
- Login form shows validation errors for empty email/password fields
- After successful login, user is redirected to /dashboard
```

## Agent Attribution

When agents use human credentials to interact with PM tools and GitHub, every comment must be clearly attributed:

```
🤖 **Agent (ISSUE-XX):**

[Comment content here]
```

Field updates (assignee, status) don't need attribution — they're metadata, not communication.

## PR Workflow

### PR Description Template
```markdown
## Summary
[Why this change exists — 1-3 bullets]

## Acceptance Criteria
- [x] Criterion 1 — [verification evidence]
- [x] Criterion 2 — [verification evidence]

## Test Plan
[Automated tests added/modified]

## Verification
[Commands + outputs from local verification]

## Issue
ISSUE-XX
```

### PR Lifecycle
1. Create PR targeting the correct branch (main, wave branch, develop)
2. Link to the PM issue
3. Wait for CI to pass
4. Request review (or signal readiness to orchestrator)
5. Address feedback (see review-response patterns)
6. Merge when approved

### CI Monitoring
After pushing:
1. Check CI status periodically
2. If checks fail, diagnose and fix
3. Push fixes and re-check
4. Only signal "ready for review" when CI is green

## Linking Issues to PRs

Reference the issue ID in:
- **Commit messages**: `feat(api): add login endpoint [ISSUE-XX]`
- **PR title**: Include the issue ID
- **PR description**: Link to the issue

Many PM tools auto-link when they detect the issue ID pattern in commits or PR descriptions.

## Status Updates

Keep stakeholders informed at natural milestones:

| Event | Update |
|---|---|
| Starting work | Set issue to "In Progress" |
| Hit a blocker | Comment on the issue with context |
| Design decision needed | Comment with options, add appropriate label |
| PR created | Link PR to issue, set to "In Review" |
| PR merged | Issue auto-transitions (or manually set to "Done") |

## Creating Issues

When implementation reveals follow-up work:
- **Discovered bugs**: Create a bug issue with reproduction steps
- **Scope expansion**: Create a follow-up issue, keep current scope tight
- **Technical debt**: Create a chore issue with context on why and when to address
- **Dependencies**: Create and link as blocking/blocked-by

Always reference the source: "Discovered during ISSUE-XX implementation"
