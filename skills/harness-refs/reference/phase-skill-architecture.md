# Phase Skill Architecture

The driver + launcher + phase skills pattern decomposes a monolithic implementation workflow into focused, manageable pieces. This is the reference for generating and working with phase skills.

## Why Phase Skills Beat Monolithic Skills

A monolithic `/implement` skill grows to 300+ lines. By phase 7, the agent has forgotten phase 2's instructions. The phase skill pattern solves this:

| Layer | Role | Size | Varies per codebase? |
|-------|------|------|---------------------|
| **Driver** | State machine loop — read state, dispatch, validate, loop | ~45 lines | No (ships static) |
| **Launcher** | Create worktree + state file, invoke driver | ~80-150 lines | Yes (generated) |
| **Phase skills** | Focused work for one phase — inputs, steps, checklist, exit gate | 40-140 lines each | Yes (generated) |

The agent sees 40-140 lines per phase turn, not 300+ lines for the whole workflow. This is the key reliability improvement.

## The Flow

```
User invokes launcher (/implement ISSUE-123)
  → Launcher fetches issue, creates worktree, writes state file
  → Launcher invokes /harness-engine with state file path
    → Driver reads state, finds first pending phase
    → Driver invokes phase skill (e.g., /harness-build-understand)
      → Phase skill does focused work, updates state file
    → Driver validates checklist, records completion
    → Driver loops to next phase
    → ... until all phases done
  → Driver announces "WORKFLOW COMPLETE"
```

## State File Schema

The state file is the single source of truth. It lives at `.harness/state.json` in the worktree (or project root if no worktree).

### Build State File

```json
{
  "version": 1,
  "type": "build",
  "issue": "<id or null>",
  "issue_title": "<title or task description>",
  "profile": "<profile name>",
  "mode": "solo",
  "target_branch": "main",
  "state_file_path": "<absolute path to this file>",
  "created_at": "<ISO-8601 timestamp>",
  "updated_at": "<ISO-8601 timestamp>",

  "environment": {
    "worktree_path": null,
    "branch": null,
    "dev_server_port": null,
    "dev_server_pid": null,
    "db_name": null,
    "env_file_path": null,
    "conversation_file": null,
    "health_check": null
  },

  "lifecycle": [
    {
      "phase": "understand",
      "skill": "harness-build-understand",
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "outputs": {},
      "checklist": {
        "code_explored": null,
        "scope_clear": null
      }
    }
  ]
}
```

### Orchestrate State File

```json
{
  "version": 1,
  "type": "orchestrate",
  "milestone": "<milestone identifier>",
  "team_name": "orchestrate-<milestone>",
  "state_file_path": "<absolute path>",
  "created_at": "<ISO-8601 timestamp>",
  "updated_at": "<ISO-8601 timestamp>",

  "environment": {
    "worktree_path": null,
    "integration_branch": null,
    "integration_pr": null,
    "dev_server_port": null,
    "dev_server_pid": null,
    "db_name": null,
    "health_check": null
  },

  "lifecycle": [
    { "phase": "analyze",  "skill": "harness-orchestrate-analyze",  "status": "pending" },
    { "phase": "dispatch", "skill": "harness-orchestrate-dispatch", "status": "pending" },
    { "phase": "collect",  "skill": "harness-orchestrate-collect",  "status": "pending" },
    { "phase": "setup",    "skill": "harness-orchestrate-setup",    "status": "pending" },
    { "phase": "quality",  "skill": "harness-orchestrate-quality",  "status": "pending" },
    { "phase": "merge",    "skill": "harness-orchestrate-merge",    "status": "pending" },
    { "phase": "conclude", "skill": "harness-orchestrate-conclude", "status": "pending" }
  ],

  "tickets": {}
}
```

### State File Rules

- **Real timestamps only** — run `date -u +%Y-%m-%dT%H:%M:%SZ`, never fabricate.
- **Single writer** — only one agent writes to a state file at a time.
- **Trust if fresh** — if updated within 4 hours, trust it. Otherwise reconstruct from live sources.
- **Lifecycle is ordered** — phases execute top-to-bottom. The driver never reorders.

### Phase Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Not yet started |
| `in_progress` | Currently executing |
| `done` | Completed successfully |
| `skipped` | Skipped by profile (include `reason` field) |
| `waiting` | Paused, waiting for external input |
| `blocked` | Cannot proceed, dependency unmet |

### Checklist Validation

Each phase can have a `checklist` object. The driver validates it after the phase skill returns:

| Value | Meaning | Driver action |
|-------|---------|--------------|
| `null` | Not yet evaluated | Stop — report the gap |
| `true` | Passed | Continue |
| `"skipped"` | Intentionally skipped | Continue |
| `false` | Failed | Stop — report the failure |

## Phase Skill Template

Every generated phase skill follows this structure:

```markdown
---
name: harness-build-<phase>
description: <One-line description of what this phase does>
user-invocable: false
---

# <Phase Name>

## Inputs

Read from the state file:
- [What data this phase needs from previous phases or environment]

## Instructions

[Step-by-step instructions with actual commands for this codebase.
Each step is concrete — no placeholders, no "adapt as needed."
Include escalation rules: when to stop and ask the human.]

## Update State File

After completing work:
- Set `lifecycle[this_phase].status` to `"done"`
- Set `lifecycle[this_phase].outputs` with any data the next phase needs
- Update `lifecycle[this_phase].checklist` items to `true`, `false`, or `"skipped"`
- Update `environment` fields if this phase set up resources
- Set `updated_at` to current timestamp

## Checklist

The driver validates these after this phase returns:

| Item | What it means |
|------|--------------|
| `item_name` | [What must be true] |

## Exit Gate

[Human-readable description of what must be true before the driver advances.
This is documentation — the checklist is the machine-readable version.]
```

## Launcher Template

The build launcher is a user-invocable skill that creates the state file and invokes the driver:

```markdown
---
name: <project-specific name, e.g., "implement">
description: "Build agent — creates state file, invokes harness driver for the full task lifecycle."
user-invocable: true
---

# /<launcher-name>

**YOUR ONLY JOB:** fetch the task, create a state file, invoke the driver. Do NOT implement anything yourself.

**Usage:** `/<launcher-name> ISSUE-123` or `/<launcher-name> ISSUE-123 --profile feature`

## Steps

### 1. Fetch task
[PM tool integration OR accept plain text description]

### 2. Determine profile
[Profile selection logic — default, flag override, label-based]

### 3. Create branch (or worktree)
[Branching strategy for this codebase]

### 4. Write state file
Write `.harness/state.json` with lifecycle array based on profile.
[Profile-to-phase matrix for this codebase]

### 5. Invoke driver
Invoke `/harness-engine`: "State file: `<path>/.harness/state.json`"

## Session Recovery
If state file exists for this issue:
1. Read `.harness/state.json`
2. Invoke `/harness-engine` — it resumes from current phase.
```

## Lifecycle Phases

These are the possible phases. Not every codebase needs all of them — `/harness-setup` determines which to include based on the scan.

| Phase | Purpose | Include when |
|-------|---------|-------------|
| **pickup** | Fetch issue, validate AC, mark in-progress | PM tool exists |
| **understand** | Read docs, explore code, identify scope | Always |
| **design** | Prototype, brainstorm architecture | Frontend-heavy or complex UI |
| **environment** | Worktree, DB, dev server, health check | DB, dev server, or multi-agent |
| **plan** | Break into tasks, get approval | Non-trivial projects |
| **execute** | Implement changes, add tests | Always |
| **verify** | Run full verification, prove AC, quality review | Always |
| **ship** | Push, create PR, monitor CI, update PM | Always |
| **cleanup** | Stop server, drop DB, remove worktree | When environment phase exists |

**Minimal harness** (solo dev, simple project): `understand → execute → verify → ship`
**Full harness** (team, DB, PM tool): all 9 phases

## Profiles

Profiles control which phases are included. Skipped phases get `{ "status": "skipped", "reason": "profile:<name>" }` in the lifecycle.

| Profile | When to use | What's lighter |
|---------|-------------|---------------|
| **full** | Complex features, solo default | Nothing skipped |
| **feature** | Standard feature, clear requirements | Skip design (unless flagged) |
| **bugfix** | Bug with reproduction steps | Skip design + plan |
| **quick** | One-file, docs, config changes | execute → verify → ship only |
| **foundation** | Backend/infra, no UI | Skip design |
| **design** | Design-heavy, new pages/layouts | Nothing skipped, design phase emphasized |

## Concept-to-Phase Mapping

When concepts are adopted (via `/harness-setup` or `/harness-retro`), they augment specific phase skills:

| Concept | Phases affected | What changes |
|---------|----------------|-------------|
| **Verification Discipline** | verify | Classify AC by strategy (API/UI/infra), capture evidence, never curl for UI |
| **Session Resilience** | ALL (baked in) | Record progress at phase transitions to `.harness/conversations/` |
| **Environment Isolation** | NEW: environment, cleanup | Generate these phases — worktree + DB + port isolation + teardown |
| **Quality Gates** | verify | Add parallel review agents step after verification passes |
| **Process Profiles** | launcher | Update profile matrix with project-appropriate profiles |
| **Multi-Agent Coordination** | NEW: orchestrate workflow | Generate orchestrate launcher + 7 orchestrate phase skills |
| **Integration Quality** | orchestrate-quality | Add integrated quality checks on combined branch |
| **PM Integration** | pickup, ship | Add PM tool MCP calls for status updates |
| **AC Discipline** | pickup | Add AC validation — stop if vague or untestable |
| **Architecture Lock-In** | design | Add design doc requirement + human lock step |
| **Vertical Feature Slices** | N/A (coaching) | Issue creation guidance, not a phase skill concern |
| **Self-Improvement Loop** | N/A (baked in) | Handled by `/harness-retro`, not phase skills |

## Orchestrate Phases

When "Multi-Agent Coordination" is adopted, these orchestrate phases are generated:

| Phase | Purpose |
|-------|---------|
| **analyze** | Fetch tickets, build dependency graph, assign profiles/risk, present strategy, wait for approval |
| **dispatch** | Create team, spawn teammates for unblocked tickets |
| **collect** | Loop: receive heartbeats, handle design reviews, process PRs, merge by risk, unblock dependents |
| **setup** | Install deps, create DB, start dev server on integration branch |
| **quality** | Run quality review + E2E on integrated code |
| **merge** | Present integration PR to human, merge to main on approval |
| **conclude** | Clean all resources, aggregate metrics, run retrospective |

## Risk-Based Merge Strategy (Orchestration)

When orchestrating multiple agents, PRs are routed by risk level:

| Risk | Verification | Merge |
|------|-------------|-------|
| **Low** (bugfix, foundation) | Tests only (+ UI screenshots if frontend touched) | Auto-merge after DoD check |
| **Medium** (feature) | Tests + UI screenshots if frontend touched | Human reviews PR before merge |
| **High** (design, novel) | Tests + UI screenshots + design evidence | Human reviews PR + design |

**Critical rule:** Verification is based on **what changed**, not just risk level. Any PR touching frontend files requires UI verification regardless of risk.
