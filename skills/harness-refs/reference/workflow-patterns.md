# Workflow Patterns

Patterns for structuring implementation work. These are reference material for concepts in the library — adopt what fits your friction, not everything at once.

## The Core Loop

Every implementation follows this structure at minimum:

### Pickup
- Fetch the issue from the PM tool (Linear, Jira, GitHub Issues)
- Display: title, description, acceptance criteria, priority, labels
- If acceptance criteria are missing or vague → **stop and ask**
- Mark the issue "In Progress"

### Understand
- Read relevant docs, specs, and architecture files
- Read existing code in the area being changed
- Identify files to touch, existing tests, established patterns
- If the issue involves external libraries, fetch current docs

### Build
**Design (if needed):** Skip if the task has clear AC and no design ambiguity.
- For API/data model decisions: brainstorm options, evaluate tradeoffs
- For visual/UI changes: prototype first, get feedback, then implement
- Record design decisions

**Plan:** Break work into discrete tasks, order by dependency, get approval if non-trivial.

**Implement:** Sync from base branch, work through tasks, escalate if stuck after 2 attempts.

### Verify
- Run the full verification suite (build, lint, type-check, test)
- Prove each acceptance criterion through the running system
- Classify criteria: API (curl), UI (browser automation), Infrastructure (DB queries)
- Record verification evidence

### Ship
- Sync from base branch, re-run verification
- Create PR with structured description (summary, AC evidence, test plan, issue link)
- Link to issue in PM tool
- Wait for CI to pass, fix failures
- Address review feedback, loop until approved/merged

### Cleanup
- Stop dev server (if running)
- Drop isolated database (if created)
- Remove worktree (if used)
- Delete local feature branch

## Profiles

→ *Concept: Process Profiles*

Not every task needs the same ceremony. Match process to complexity:

| Profile | When to Use | What's lighter |
|---|---|---|
| **full** | Complex features, cross-cutting changes | Nothing skipped |
| **feature** | Standard feature with clear AC | Skip agent self-review |
| **foundation** | Backend/infra with no UI | Skip design, cloud verify, E2E |
| **bugfix** | Bug with clear reproduction | Skip design, plan; add systematic debugging |
| **quick** | One-file changes, docs, config | Build → verify → ship only |

## Branching Patterns

Read the branching model from harness context. Common patterns:

### Trunk-based
- Feature branches off `main`
- Short-lived (< 1 day ideally)
- PR reviewed and merged to `main`

### Wave branches
→ *Concept: Multi-Agent Coordination, Integration Quality*
- Wave branch off `main` for a batch of related features
- Feature branches target the wave branch
- Wave branch merged to `main` after all features land and quality passes
- Quality gates run on the integrated wave branch

### Gitflow
- Feature branches off `develop`
- Release branches for stabilization
- Hotfix branches off `main`

## Commit Conventions

Read commit format from harness context. If not specified, use conventional commits:

```
<type>(<scope>): <description> [ISSUE-ID]

Types: feat, fix, chore, refactor, test, docs, style, perf
Scope: the area of the codebase (api, web, db, auth, etc.)
```

## Vertical Feature Slices

→ *Concept: Vertical Feature Slices*

Default to one ticket per user-visible capability — schema + API + UI + tests in one PR.

**The acid test:** "Would a user notice if this ticket shipped alone?" If not, it's infrastructure that should be bundled into the first feature that needs it.

Layer-based tickets are the exception — only when 3+ features genuinely share the same infrastructure and it can't be embedded in the first feature.

## Architecture Lock-In

→ *Concept: Architecture Lock-In*

For non-trivial milestones, lock hard-to-reverse decisions before creating implementation tickets:
- Schema design (tables, columns, indexes, relationships)
- API contracts (endpoints, request/response shapes, auth)
- Technology choices (frameworks, libraries, patterns)
- Page/component inventory (routes, data dependencies)

Human reviews and approves the design. Implementation tickets reference it. If something needs to change mid-implementation, stop and surface it — don't improvise architecture.
