---
name: harness-refs
description: Core principles for disciplined agent engineering, plus a concept library that maps workflow friction to solutions. Hub skill referenced by all Harnessable action skills.
---

This skill defines the engineering discipline that makes AI agents reliable. It's the hub — every Harnessable action skill reads this for principles. It's also a concept library — when you hit friction in your workflow, the concepts here help you name the problem and shape a response.

## Prerequisite: Harness Context

Before applying any pattern below, read the `## Harness Context` section in the project's AI config file (CLAUDE.md, .cursorrules, GEMINI.md, etc.). If it doesn't exist, run `/harness-setup` first.

All commands, tools, and workflows referenced below should be adapted to the harness context. Never hardcode assumptions about tech stack, PM tool, or deploy target.

---

## Core Principles

These are constant regardless of which concepts you've adopted or how your workflow is shaped.

### 1. Verify by Proof, Not Assumption

**DO**: Run the system, capture output, cite evidence for every claim
**DO**: Prove each acceptance criterion through the running system — curl, browser automation, DB queries
**DO**: Classify criteria by verification strategy (API, UI, infrastructure) before starting

**DON'T**: Read code and claim it works without executing it
**DON'T**: Use `curl` to verify UI behavior — SSR HTML doesn't reflect client-side state
**DON'T**: Mark acceptance criteria as complete without captured evidence

### 2. Persist Everything

**DO**: Write down decisions, discoveries, and progress at natural milestones
**DO**: Record verification evidence alongside the acceptance criteria it proves
**DO**: Make your work resumable — if a session drops, a fresh agent should be able to continue

**DON'T**: Keep progress only in memory — sessions die without warning
**DON'T**: Assume you'll be the same agent that continues the work

### 3. Adapt to the Repo

**DO**: Read harness context before every action skill invocation
**DO**: Use the repo's actual commands for build, test, lint, type-check
**DO**: Follow the repo's branching model, commit format, and review process

**DON'T**: Hardcode `npm test` when the repo uses `pytest`
**DON'T**: Assume GitHub Actions when the repo uses CircleCI

### 4. Fail Fast, Surface Early

**DO**: Hit a blocker → flag it immediately with context and options
**DO**: Scope larger than expected → tell the human before continuing
**DO**: Stuck after 2 fix attempts → escalate with what you've tried

**DON'T**: Spiral for 20 minutes on a failing test without surfacing it
**DON'T**: Silently expand scope beyond what was requested
**DON'T**: Retry the same failing approach hoping it'll work this time

### 5. Self-Improve

**DO**: Record harness issues (problems with skill instructions) separately from product bugs
**DO**: Run retrospectives after implementation rounds — they surface friction patterns
**DO**: Track what worked well, not just what broke

**DON'T**: Ignore repeated failures — if the same issue occurs twice, the skill needs updating
**DON'T**: Over-correct for one-off issues

---

## The Harness Anti-Pattern Test

Review your work against these anti-patterns — they are the fingerprints of undisciplined agent work:

| Anti-Pattern | What It Looks Like | The Fix |
|---|---|---|
| **Ship and pray** | PR created without running verification | Run every check in harness context before PR |
| **Read-and-assume** | "The code looks correct" without execution | Execute, capture output, cite as evidence |
| **Infinite retry** | Same command retried 5 times | Diagnose root cause after attempt 2 |
| **Context amnesia** | Session drops, all progress lost | Write progress at natural milestones |
| **Scope creep silence** | Task grew 3x but no one was told | Flag scope expansion immediately |
| **Mock everything** | Tests pass, production breaks | Hit real systems at verification boundaries |
| **Solo hero** | Sequential work that could be parallelized | Split independent tasks across parallel agents or sessions |
| **Zombie process** | Dev servers, DBs left running after work | Clean up every environment you create |
| **Blind merge** | PR merged without checking CI status | Wait for CI, verify checks pass |
| **Attribution gap** | Agent actions look like human actions | Prefix agent comments with attribution |

---

## Concept Library

These concepts address specific friction patterns that emerge as you use the harness. You don't need all of them. You don't need them in any order. When you hit a pattern of friction, find the concept that names it and decide whether to adopt it.

> *See [concepts reference](reference/concepts.md) for the full friction → concept mapping with detailed signals.*

### Verification Discipline
→ [quality-assurance.md](reference/quality-assurance.md)

**Concept:** Every claim about working software must be backed by captured output from the running system. Classify acceptance criteria by verification strategy (API, UI, infrastructure) before implementation, then prove each one.

**You'll want this when:** An agent says "the code looks correct" without running it. Or acceptance criteria are marked done without evidence. Or a feature "works" locally but breaks in review because nobody actually tested the specific AC.

### Session Resilience (baked in)
→ [session-resilience.md](reference/session-resilience.md)

**Concept:** Externalize progress, decisions, and discoveries to files that survive session drops. The conversation file is the single source of truth — not agent memory.

**This is baked into every generated implementation skill** — agents record progress to `.harness/conversations/` at natural phase transitions. This data also powers `/harness-learn`. It's not a separate concept to adopt.

### Environment Isolation
→ [environment-management.md](reference/environment-management.md)

**Concept:** Each piece of work gets its own isolated environment — code (worktrees), data (separate DBs), and network (dedicated ports). Cleanup is deterministic.

**You'll want this when:** Agents conflict on the same database or port. Or you can't context-switch between features. Or cleanup is manual and zombie processes accumulate.

### Quality Gates
→ [quality-assurance.md](reference/quality-assurance.md)

**Concept:** Before shipping, run parallel review agents checking different dimensions (reuse, quality, efficiency, bugs, API correctness). Confidence-score findings to filter false positives.

**You'll want this when:** Quality issues are caught during human review that agents should have caught themselves. Or review rounds are dominated by mechanical issues rather than design discussions.

### Multi-Agent Coordination
→ [agent-coordination.md](reference/agent-coordination.md)

**Concept:** One orchestrator dispatches teammates, tracks dependencies, manages state, and runs quality checks on integrated code. Wave-based dispatch maximizes parallelism.

**You'll want this when:** You're working tickets sequentially that could be parallel. Or parallel agents are stepping on each other. Or there's no coordination point between individual feature PRs and main.

### Process Profiles
→ [workflow-patterns.md](reference/workflow-patterns.md)

**Concept:** Not all work needs the same ceremony. Match process depth to task complexity — a bugfix is different from a new feature is different from infrastructure work.

**You'll want this when:** Simple tasks feel over-processed. Or complex tasks are under-verified because the process doesn't distinguish them.

### Integration Quality
→ [quality-assurance.md](reference/quality-assurance.md)

**Concept:** Quality checks on individual PRs miss cross-PR inconsistencies. Run quality gates on the integrated branch (after all features merge) to catch naming drift, pattern violations, and interaction bugs.

**You'll want this when:** Individual PRs pass review but the combined codebase has inconsistencies. Or features work in isolation but conflict when integrated.

### Project Management Integration
→ [project-management.md](reference/project-management.md)

**Concept:** Work with your PM tool (Linear, Jira, GitHub Issues) as part of the loop — pickup marks "In Progress", PR creation marks "In Review", agent comments are attributed.

**You'll want this when:** Issue status gets out of sync with actual work. Or stakeholders can't tell what's happening without asking.

### Self-Improvement Loop
→ [self-improvement.md](reference/self-improvement.md)

**Concept:** Distinguish harness issues (problems with skill instructions) from product bugs. After implementation rounds, retrospect: what broke, why, and what skill edit would prevent it next time.

**You'll want this when:** The same friction happens twice. Or you know something should be different but haven't formalized the change.

---

## How Concepts Become Skills

> *See [phase-skill-architecture.md](reference/phase-skill-architecture.md) for the full architecture reference — state file schema, phase skill template, launcher template, and concept-to-phase mapping.*

Concepts are coaching material — patterns and principles. They don't ship as pre-built skills because every codebase needs different implementations.

When a concept is adopted (via `/harness-setup` or `/harness-learn`), it **augments specific phase skills** — adding steps, checklists, or entirely new phases to the lifecycle. The concept-to-phase mapping determines what changes:

| Concept | Phases affected | What changes |
|---------|----------------|-------------|
| Verification Discipline | verify | Classify AC by strategy, capture evidence |
| Session Resilience | ALL (baked in) | Record progress at phase transitions |
| Environment Isolation | NEW: environment, cleanup | Generate worktree + DB + port isolation phases |
| Quality Gates | verify | Add parallel review agents step |
| Process Profiles | launcher | Update profile-to-phase matrix |
| Multi-Agent Coordination | NEW: orchestrate workflow | Generate orchestrate launcher + phase skills |
| Integration Quality | orchestrate-quality | Add integrated quality checks |
| PM Integration | pickup, ship | Add PM tool calls for status updates |
| AC Discipline | pickup | Add AC validation — stop if vague |
| Architecture Lock-In | design | Add design doc + human lock step |
| Vertical Feature Slices | N/A (coaching) | Issue creation guidance |
| Self-Improvement Loop | N/A (baked in) | Handled by `/harness-learn` |

This means every harness is unique. After `/harness-setup`:
- A solo Go developer might have: a launcher + 4 phase skills (understand → execute → verify → ship) and nothing else
- A team on a Rails monorepo might have: a launcher + 9 phase skills with Linear pickup, PostgreSQL environment isolation, and an orchestrate workflow for parallel agents
- A frontend team might have: 7 phase skills with a design phase, Playwright verification, and quality gates in the verify phase

The generated skills use the **driver + launcher + phase skills architecture**: a static universal driver dispatches to focused, generated phase skills through a state file. Each phase skill is 40-140 lines — small enough for agents to follow reliably.

## Implementation Notes

The right amount of process is the minimum needed to ship reliably. If you're spending more time on ceremony than code, simplify. If quality issues slip through, adopt the concept that addresses them.

Run `/harness-setup` to shape your harness. Use the generated skills on real work. Run `/harness-learn` to reflect and reshape. The workflow gets better every round because the skills get more specific to your actual needs.

The harness loop: `/harness-setup` (shape) → real work → `/harness-learn` (reflect) → `/harness-setup` ...
