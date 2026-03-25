# Concepts

A mapping from workflow friction to the concept that addresses it. Use this as a coaching reference — when `/harness-retro` notices a friction pattern, it points here to suggest what to adopt.

This isn't a progression. Different teams discover different friction in different orders. The concepts are independent — adopt what you need, skip what you don't.

---

## How to Read This

Each concept has:
- **Friction signals** — what you'll notice when this concept is missing
- **The concept** — the principle, in one sentence
- **What changes** — how your workflow shifts when you adopt it
- **Reference** — the detailed guide
- **Related skills** — Harnessable skills that implement this concept

---

## Verification Discipline

**Friction signals:**
- Agent says "the code looks correct" without running it
- Acceptance criteria marked done with no captured output
- Feature works for the agent but breaks during review
- Reviewer asks "did you test this?" — answer is unclear
- UI verified with curl (SSR HTML doesn't reflect client-side state)

**The concept:** Every claim about working software must be backed by evidence from the running system. Reading code is research, not verification.

**What changes:**
1. Before implementation, classify each acceptance criterion by verification strategy: API (curl/httpie), UI (browser automation), Infrastructure (DB queries/config checks)
2. After implementation, execute each verification and capture the output
3. Include captured evidence in the PR description
4. Never use curl to verify UI behavior

**Reference:** [quality-assurance.md](quality-assurance.md)
**Typically baked into:** the generated implementation skill's verify step.

---

## Session Resilience

**Friction signals:**
- Session drops and the next agent starts from scratch
- Context from a long implementation is lost between turns
- Decisions made early in implementation are forgotten later
- Two agents work on the same issue without knowing what the other decided
- Discoveries about the codebase are invisible to future agents

**The concept:** Progress, decisions, and discoveries must live in files — not in agent memory. If a session dies, the work survives.

**What changes:**
1. After each major step, write a conversation file: current phase, decisions, discoveries, verification evidence
2. On resume, read the conversation file and continue from the documented phase
3. Include the conversation file in the PR (it becomes part of the project's knowledge)

**The test:** Could a fresh agent pick up the conversation file and continue without the original agent?

**Reference:** [session-resilience.md](session-resilience.md)
**Typically baked into:** the generated implementation skill via `.harness/conversations/` recording. This is included by default — not a separate concept to adopt.

---

## Environment Isolation

**Friction signals:**
- Two agents modify the same files and conflict
- Database state from one feature leaks into another
- Port 3000 is already in use and nobody knows why
- Cleanup is manual — zombie dev servers accumulate
- Can't context-switch between features without stashing/committing

**The concept:** Each piece of work gets its own code, data, and network isolation. Cleanup is deterministic.

**What changes:**
1. Before building, create a git worktree (code isolation without full clone)
2. Create a separate database per feature (template cloning for speed)
3. Assign a unique port per feature (base + offset)
4. Record state in a `.dev-state` file for deterministic teardown
5. After shipping, tear down everything: stop server, drop DB, remove worktree

**Reference:** [environment-management.md](environment-management.md)
**When adopted:** `/harness-setup` or `/harness-retro` generates a codebase-specific environment setup skill.

---

## Quality Gates

**Friction signals:**
- Human reviewers consistently catch issues agents should have caught
- Review rounds are dominated by mechanical fixes (naming, reuse, efficiency) instead of design discussions
- Same category of bug (null checks, N+1 queries, duplicated utilities) recurs across PRs
- Agent ships code that works but is clearly first-draft quality

**The concept:** Before shipping, run parallel review agents checking different quality dimensions. Confidence-score findings to filter false positives.

**What changes:**
1. After local verification passes, run 6-7 parallel review agents (code reuse, quality, efficiency, bugs, library API correctness, comment compliance)
2. Each finding gets a 0-100 confidence score
3. Drop findings below 50 (likely false positives or nitpicks)
4. Fix remaining findings, re-verify

**Reference:** [quality-assurance.md](quality-assurance.md)
**When adopted:** `/harness-setup` or `/harness-retro` generates a codebase-specific quality review skill.

---

## Process Profiles

**Friction signals:**
- A one-line config change goes through the same process as a complex feature
- Simple tasks feel over-processed and slow
- Complex tasks are under-verified because the process doesn't distinguish them
- Team debates "how much process" per ticket instead of having clear defaults

**The concept:** Match ceremony to task complexity. Define profiles that make the decision automatic.

**What changes:**
Define profiles in your harness context:

| Profile | When | What's lighter |
|---------|------|---------------|
| **full** | Complex features, cross-cutting changes | Nothing skipped |
| **feature** | Standard feature with clear AC | Skip agent self-review |
| **foundation** | Backend/infra, no UI | Skip design, cloud verify |
| **bugfix** | Bug with clear reproduction | Skip design, plan; add debugging |
| **quick** | Docs, config, one-file changes | Build → verify → ship only |

**Reference:** [workflow-patterns.md](workflow-patterns.md)
**Typically baked into:** the generated implementation skill as profile-based branching logic.

---

## Multi-Agent Coordination

**Friction signals:**
- Multiple tickets worked sequentially when they could be parallel
- Parallel agents step on each other (branch conflicts, environment collisions)
- No coordination point between individual feature PRs and main
- No visibility into what parallel agents are doing
- Merged features individually look good but conflict when combined

**The concept:** One orchestrator dispatches teammates, manages dependencies, tracks state, and coordinates the merge flow. Wave-based dispatch groups independent work for maximum parallelism.

**What changes:**
1. Orchestrator analyzes tickets, builds dependency graph, assigns waves
2. Creates a wave branch — feature PRs target this, not main
3. Dispatches teammate agents with clear context (issue, profile, target branch)
4. Monitors progress via heartbeats, gates merges, handles review routing
5. After all features merge to wave, runs quality checks on integrated code
6. Wave branch merges to main as a single reviewed unit

**Reference:** [agent-coordination.md](agent-coordination.md)
**When adopted:** `/harness-setup` or `/harness-retro` generates a codebase-specific orchestration skill.

---

## Integration Quality

**Friction signals:**
- Individual PRs pass review but the combined codebase has inconsistencies
- Features use different naming conventions, error patterns, or API shapes
- Two features independently implement the same utility
- E2E tests pass per-feature but fail on the integrated branch
- "Works in isolation" but breaks when combined

**The concept:** Quality checks on individual PRs create a fragmented view. Run quality gates on the integrated branch — after all features merge — to see cross-PR inconsistencies.

**What changes:**
1. Feature PRs target a wave/integration branch, not main
2. After all features merge to the integration branch, run quality gates on the combined diff
3. Check for cross-feature naming drift, pattern violations, duplicated utilities
4. Run E2E suite against the integrated state
5. Fix issues on the integration branch before merging to main

**Reference:** [quality-assurance.md](quality-assurance.md), [agent-coordination.md](agent-coordination.md)
**When adopted:** typically combined with Multi-Agent Coordination — quality checks run on the integration branch as part of the orchestration skill.

---

## Project Management Integration

**Friction signals:**
- Issue status is out of sync with actual work (shows "To Do" but agent is halfway done)
- Stakeholders can't tell what's happening without asking
- Agent actions on GitHub/Linear/Jira look like human actions — attribution is unclear
- PRs aren't linked to issues — context is lost
- Follow-up work discovered during implementation isn't tracked

**The concept:** Work with your PM tool as part of the workflow — status updates, issue linking, agent attribution, and follow-up issue creation happen as natural byproducts of the loop.

**What changes:**
1. Pickup marks issue "In Progress"
2. PR creation links to the issue and marks "In Review"
3. Agent comments are prefixed with attribution (`🤖 Agent (ISSUE-XX):`)
4. Discovered follow-up work becomes new issues with source reference
5. Status updates happen at natural milestones, not as extra ceremony

**Reference:** [project-management.md](project-management.md)
**Typically baked into:** the generated implementation skill's pickup and ship steps. Issue creation may get its own generated skill if the team needs it.

---

## Self-Improvement Loop

**Friction signals:**
- The same problem happens across multiple implementations
- You know something should be different but haven't formalized the change
- Harness issues (wrong skill instructions) are mixed with product bugs
- Good approaches aren't codified — each agent reinvents them
- The workflow feels the same quality it was weeks ago

**The concept:** After each round of work, retrospect. Distinguish harness issues from product bugs. Propose specific skill edits. Apply with human approval. The workflow gets better every round.

**What changes:**
1. During implementation, record harness issues separately: what happened, root cause, workaround, suggested fix, turns wasted
2. After each round, run `/retrospective`: gather evidence, classify findings, propose changes
3. Apply approved changes to skill files
4. Track what worked well, not just what broke — codify validated approaches

**Reference:** [self-improvement.md](self-improvement.md)
**Built into Harnessable:** this is what `/harness-retro` does. Not a separate concept to adopt — it's part of the harness loop.

---

## Acceptance Criteria Discipline

**Friction signals:**
- Agents interpret vague criteria differently than humans expect
- "It works" or "users can log in" passes as an acceptance criterion
- Review rounds are spent debating what "done" means
- Verification is impossible because criteria aren't testable

**The concept:** Every acceptance criterion must be specific enough that an agent can verify it through the running system — a curl command, a browser interaction, a database query. If it can't be verified, it's not ready for implementation.

**What changes:**
1. At pickup, check: is every AC testable? If not, stop and ask for clarification
2. Bad: "Users can log in" — Good: "POST /api/auth/login returns 200 with valid credentials and sets session cookie"
3. Before implementation, map each criterion to its verification strategy
4. If a criterion can't be mapped, it needs to be rewritten

**Reference:** [project-management.md](project-management.md)
**Typically baked into:** the generated implementation skill's pickup step (check AC before starting).

---

## Architecture Lock-In

**Friction signals:**
- Agents discover missing database columns mid-implementation
- The first feature sets a pattern, later features follow it, then everything gets refactored
- 10+ refactoring tickets appear because the architecture wasn't decided upfront
- API shapes, data models, or technology choices change after implementation starts

**The concept:** For non-trivial milestones, lock schema, API contracts, and technology choices in a design document before creating implementation tickets. Hard-to-reverse decisions are human calls.

**What changes:**
1. Before creating implementation tickets, produce a design document: schema, API endpoints, page/component inventory, technology choices
2. Human reviews and locks the design
3. Implementation tickets reference the locked design — agents don't improvise architecture
4. If something needs to change mid-implementation, stop and surface it

**Reference:** [workflow-patterns.md](workflow-patterns.md)
**When adopted:** `/harness-setup` generates a design/architecture skill, or bakes architecture review into the implementation skill's understand step.

---

## Vertical Feature Slices

**Friction signals:**
- Features are split into layer-based tickets (DB ticket, API ticket, UI ticket)
- Layer tickets create artificial sequential dependencies
- Calendar time per feature is 3-5x implementation time due to sequential blocking
- Integration testing is impossible until all layers are done

**The concept:** Default to one ticket per user-visible capability — schema + API + UI in one PR. Layer-based tickets are the exception, not the default.

**What changes:**
1. Each ticket represents a complete user-facing capability
2. The acid test: "Would a user notice if this ticket shipped alone?"
3. Layer-based tickets only when 3+ features genuinely share the same infrastructure
4. Ticket can be verified end-to-end without waiting for other tickets

**Reference:** [workflow-patterns.md](workflow-patterns.md)
**When adopted:** baked into issue creation practices — the generated implementation skill or a dedicated issue creation skill.
