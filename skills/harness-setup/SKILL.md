---
name: harness-setup
description: Scan your codebase, assess workflow readiness, and generate a phased implementation workflow tailored to your repo.
user-invokable: true
safety: read-heavy
---

**Safety:** This skill is primarily read-only during setup. It scans your codebase (read), asks you questions, then generates new skill files and a `.harness/` directory — all with your approval before each write. It does not modify your existing code, delete files, run builds, or start services. Every file write is presented for approval first.

When invoked, print this banner before doing anything else:

```
██╗  ██╗ █████╗ ██████╗ ███╗   ██╗███████╗███████╗███████╗
██║  ██║██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔════╝██╔════╝
███████║███████║██████╔╝██╔██╗ ██║█████╗  ███████╗███████╗
██╔══██║██╔══██║██╔══██╗██║╚██╗██║██╔══╝  ╚════██║╚════██║
██║  ██║██║  ██║██║  ██║██║ ╚████║███████╗███████║███████║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚══════╝
```

Then, before anything else, **read the existing agent-facing config** if one exists — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md`, or similar. This gives you a head start on project context, team conventions, tech stack, and workflow preferences. Use what you learn to skip redundant questions and ask smarter ones.

Then output the intro and **in the same message**, use the Agent tool with `run_in_background: true` to dispatch the scan (Phase 1). Do NOT wait for the scan to return. Immediately start asking the user questions (Phase 2) in the same response.

<CRITICAL>
You MUST use `Agent` with `run_in_background: true` for the scan. Do NOT use the Explore agent type in the foreground. Do NOT wait for scan results before asking questions. The scan and questions happen simultaneously — the user should see your first question within seconds, not after a multi-minute scan.
</CRITICAL>

Output this intro, then ask your first question right after it:

> **What is this?** Harnessable gives AI agents a disciplined, phased workflow for shipping software. Instead of one big prompt, every task follows focused phases — each with explicit instructions and an exit gate. A universal engine orchestrates them through a state file.
>
> ```
> Launcher → Engine → [understand] → [execute] → [verify] → [ship] → COMPLETE
> ```
>
> I'm scanning your codebase in the background. Let me ask you a few questions while that runs.

---

## Phase 1: Scan the Codebase (background agent)

Use `Agent` tool with `run_in_background: true` to dispatch a scan agent. You will be notified when it completes. Do NOT poll or wait for it.

The scan agent should explore:

**Build & Test Tooling:** package.json (npm/yarn/pnpm), Cargo.toml, go.mod, pyproject.toml, Gemfile. Build system (turbo.json, nx.json, Makefile). Test framework (vitest/jest, pytest, go test, rspec). Linter & formatter (eslint, prettier, ruff, golangci-lint). Type checker (tsconfig.json, mypy, pyright). Monorepo structure (workspace config, package directories).

**CI/CD & Deploy:** CI config (.github/workflows/, .circleci/, .gitlab-ci.yml). Deploy config (vercel.json, railway.toml, Dockerfile). Preview environments.

**Project Management:** PM tool config (.linear/, jira config, GitHub project references). Issue references in commit messages (KIP-XX, PROJ-XX, #123). Branching model from git log.

**Database & Services:** Database (PostgreSQL, MySQL, SQLite, MongoDB — migration tools, seed data). External services (APIs, message queues, caches). Dev environment (docker-compose, devcontainers, local setup scripts).

**Repository Structure:** README and docs. Existing workflow docs (CONTRIBUTING.md, ADRs). Code organization (src layout, test location conventions).

**Installed Skills:** Scan `.claude/skills/`, `.cursor/skills/`, `.agents/`, and any plugin/skill directories for existing skills that are NOT part of Harnessable (ignore `harness-*` skills). Read each `SKILL.md` frontmatter (name, description) to understand what's available. Only report skills that actually exist on disk — do NOT assume or suggest skills that weren't found.

The agent should return a structured summary of everything found — including the list of installed skills with their names and descriptions — and what remains unclear.

## Phase 2: Ask (in parallel with scan)

Start asking questions immediately — don't wait for the scan to complete. Use AskUserQuestion (or the platform's equivalent) for each question. For multiple-choice, present numbered options.

Some questions may become unnecessary once the scan finishes (e.g., "What test framework?" if the scan found vitest). That's fine — skip questions the scan already answered if its results arrive while you're still asking.

### Questions to ask (skip what the scan already answered)

**Team & Process:**
- Who works on this repo? (solo dev, small team, large team, mix of humans and agents)
- How are PRs reviewed? (required approvals, self-merge for small changes)
- Should agents work autonomously or check in frequently?

**Workflow:**
- What PM tool do you use? (Linear, Jira, GitHub Issues, none)
- What's your branching model? (trunk-based, feature branches, gitflow)
- What must pass before a PR? (tests, lint, type-check, build)

**Pain Points:**
- What's the most frustrating part of your current workflow with agents?
- Where do things break down? (quality, speed, coordination, context loss, environment)
- What have you tried that worked well?

Skip questions where the answer is clear from the scan.

## Phase 3: Assess & Select

<HARD-GATE>
Do NOT start Phase 3 until BOTH the background scan agent has returned AND you have the user's answers. If the scan is still running when the user finishes answering, tell the user "Waiting for the codebase scan to finish..." and wait. You will be automatically notified when it completes — do NOT poll, do NOT start a duplicate scan, do NOT use SendMessage to check on it. Just wait. If the user is still answering when the scan finishes, finish asking.
</HARD-GATE>

Present the assessment and collect selections in the terminal.

### Step 1: Codebase Profile

Output a summary of what you found:

```
## Codebase Profile

| Area | Details |
|------|---------|
| Language | TypeScript (Node.js) |
| Framework | Express + Prisma |
| Tests | Vitest, 47 test files |
| CI | GitHub Actions (3 workflows) |
| Deploy | Railway via Dockerfile |
| Database | PostgreSQL (Prisma migrations) |
| PM Tool | Linear (KIP-XX pattern) |
```

### Step 2: Readiness Assessment

**Be honest.** Present what's ready and what's not:

**What's ready** — capabilities the codebase already has (e.g., "Strong CI pipeline with 5 checks", "Docker Compose dev environment")

**What's missing** — constraints and gaps (e.g., "No environment isolation — multiple agents will conflict on ports and DB")

**Readiness rules:**
- If they can't isolate environments → they're **not ready for orchestration** (multiple agents would overlap). Say this clearly. They're ready for a **single implementation agent**, which is still very useful.
- If they have no CI → the verify phase can only run local checks. Suggest they set up CI as a next engineering step — Harnessable can't solve that for them.
- If they have no PM tool → the pickup phase accepts plain text descriptions instead of issue fetching. That's fine.
- Don't promise what the harness can't deliver. Be upfront about what's an engineering problem vs. what Harnessable can actually help with.

### Step 3: Phase Selection

Present mandatory and optional phases. Use AskUserQuestion for each optional phase.

**Mandatory phases** (always included, just list them):
- **understand** — always needed
- **execute** — always needed
- **verify** — always needed
- **ship** — always needed

**Optional phases** — ask one at a time. Only show phases relevant to this codebase:
- **pickup** — only if PM tool detected
- **design** — only if frontend/UI framework detected
- **environment** — only if database or dev server detected
- **plan** — show for non-trivial projects
- **cleanup** — automatically included if environment is included

For each optional phase, ask:

> **Include the [phase] phase?**
> [One sentence explaining what it does for this codebase.]
> (yes / no)

### Step 4: Concept Selection

Only show concepts the codebase is ready for. Don't show concepts with unmet prerequisites (e.g., don't show orchestration if they can't isolate environments).

For each relevant concept, ask:

> **Adopt [concept name]?**
> [One sentence explaining what it does.] [One sentence on what changes in the workflow.]
> (yes / skip for now)

### Step 5: Name Your Launcher

Ask the user what they want to call their main workflow command. Suggest a default based on the project:

> **What should I call your launcher skill?** This is the command you'll invoke to start a task (e.g., `/implement`, `/build`, `/dev`, `/ship`).
> Default: `/implement`

Use their choice throughout the generated skills. If they accept the default, use `/implement`.

### Step 6: Skill Integration

If the scan found non-Harnessable skills installed in the project, present each relevant one to the user. Only show skills that were actually found on disk — never suggest skills that don't exist. Only show skills that map naturally to a phase (don't force it).

For each relevant skill found, ask:

> **Use `/<skill-name>` in the harness?**
> [One sentence on what it does — from its SKILL.md description.] I'd integrate it into the **[phase]** phase — [one sentence on how].
> (yes / no)

Only reference skills the user approves. Skip this step entirely if no relevant skills were found by the scan.

### Step 7: Engineering Recommendations

For things Harnessable can't solve (missing CI, no PM tool), list them as recommendations:

> **Suggested next steps** (outside of Harnessable):
> - Set up CI — without it, the verify phase can only run local checks
> - Consider environment isolation — needed before multi-agent work

Before starting generation, tell the user:

> I'm going to generate your harness now — this creates several skill files, updates your config, and initializes `.harness/`. You may be prompted to approve file writes. This takes a couple of minutes.

## Phase 4: Write Harness Context

Synthesize findings into a `## Harness Context` section:

```markdown
## Harness Context

Persistent engineering workflow context. Generated by `/harness-setup`.

### Repository
[Monorepo/polyrepo, language, framework, package manager, key directories]

### Verification
[Exact commands for: build, test, lint, type-check, format. What must pass before PR.]

### CI/CD
[CI system, required checks, deploy target, preview environment pattern]

### Project Management
[PM tool, issue format, issue ID pattern, what "ready" looks like]

### Branching & Shipping
[Branching model, branch naming convention, merge strategy, release process]

### Team & Process
[Team size, review process, agent autonomy level, off-limits areas]

### Environment
[Dev server command, database setup, required env vars, ports]
```

Write to the AI config file (this is for agents to read — separate from `HARNESS.md` which is for humans):
- **Claude Code**: `CLAUDE.md`
- **Cursor**: `.cursorrules`
- **Gemini CLI**: `GEMINI.md`

## Phase 5: Initialize .harness/

Create the `.harness/` directory in the project root. This is the harness's own space — separate from the user's codebase, never touching their code or docs.

```
.harness/
├── conversations/        # per-implementation records (phase progress, decisions, evidence)
└── retros/               # past retro results
```

No harness-level state file — `state.json` is only created per-task at runtime by the launcher (it tracks lifecycle phase progression). Harness-level information (adopted concepts, generated skills) is derivable: check which skills exist in the skill directory and read `HARNESS.md`.

Conversations and retros should be committed to the repo — `/harness-learn` reads them to identify cross-round patterns and improve the workflow over time. Do NOT add `.harness/` to `.gitignore`.

## Phase 6: Generate Skills

Generate the **engine + launcher + phase skills architecture** based on the user's codebase and choices. Read [phase-skill-architecture.md](../harness-refs/reference/phase-skill-architecture.md) for the full architecture reference — state file schema, templates, and concept-to-phase mapping.

### 6a. Determine Lifecycle Phases

Based on scan results and user answers, decide which phases this codebase needs:

| Phase | Include when | Scan signal |
|-------|-------------|-------------|
| **pickup** | PM tool exists | Linear/Jira/GitHub Issues config, issue ID patterns in commits |
| **understand** | Always | — |
| **design** | Frontend-heavy, complex UI, or user has design pain points | UI framework detected, design system, `needs-design` patterns |
| **environment** | DB, dev server, or multi-agent work | docker-compose, database config, dev server scripts, migration tools |
| **plan** | Non-trivial projects | Default for full/feature profiles; skip for quick/bugfix |
| **execute** | Always | — |
| **verify** | Always | Content shaped by test/lint/type-check tools detected |
| **ship** | Always | Content shaped by CI, branching model, review process |
| **cleanup** | When environment phase exists | Mirrors environment phase teardown |

**Minimal harness** (solo dev, no DB, no PM tool): `understand → execute → verify → ship` — 4 phase skills + launcher.

**Full harness** (team, DB, PM tool, frontend): all 9 phases.

### 6b. Determine Profiles

Profiles control which phases are skipped. Based on the codebase:

| Profile | Always available? | Condition |
|---------|------------------|-----------|
| **full** | Yes | Default — all phases active |
| **feature** | Yes | Skip design (unless flagged) |
| **bugfix** | Yes | Skip design + plan |
| **quick** | Yes | execute → verify → ship only |
| **foundation** | Only if backend + frontend distinction exists | Monorepo with separate API/UI layers |
| **design** | Only if frontend exists | UI framework detected |

### 6c. Generate Build Launcher

Generate a launcher skill using the name the user chose in Step 5 (default: `/implement`):

1. **Fetches the task** — from the detected PM tool (Linear MCP, GitHub CLI, Jira) or accepts a plain text description if no PM tool
2. **Determines profile** — from `--profile` flag, default, or task labels
3. **Creates branch** (or worktree if Environment Isolation is adopted)
4. **Writes `.harness/state.json`** with the lifecycle array — phases and statuses based on profile. Skipped phases get `{ "status": "skipped", "reason": "profile:<name>" }`
5. **Invokes `/harness-engine`** with the state file path
6. **Session recovery** — if state file already exists for this task, invoke driver directly (it resumes from current phase)

Use the launcher template from [phase-skill-architecture.md](../harness-refs/reference/phase-skill-architecture.md). Fill in with actual commands.

### 6d. Generate Phase Skills

For each phase in the lifecycle, generate a `harness-build-{phase}/SKILL.md` following the phase skill template. Each skill MUST have:

**1. Actual commands** — no `<placeholder>` syntax. Use the real commands from the harness context.

**2. Checklist items** — machine-readable items the driver validates. Every checklist item starts as `null` and must be set to `true`, `false`, or `"skipped"` by the phase skill.

**3. Escalation rules** — when to stop and ask the human (ambiguous requirements, architecture decisions, stuck after 2 attempts).

**4. Recording baked in** — at each phase transition, write progress to `.harness/conversations/`. Not as extra ceremony — as a natural part of completing each phase.

**5. Integrate approved skills** — for each installed skill the user approved in Step 6, add an instruction in the relevant phase skill to invoke it. Don't duplicate what the skill already does — just invoke it at the right moment. Only include skills the user explicitly approved.

Here's what each phase skill should contain (adapt to the codebase):

**pickup** — Fetch issue from PM tool, display title/AC/labels. Validate AC are testable (stop if vague). Mark issue "In Progress". Checklist: `issue_fetched`, `ac_clear`.

**understand** — Read architecture docs, specs, existing code in areas being changed. Identify files to touch, patterns to follow. Fetch external library docs if needed. Checklist: `code_explored`, `scope_clear`.

**design** — Brainstorm approach for complex changes. For UI: prototype, take screenshots, present for feedback. Checklist: `approach_decided`, `design_approved` (if applicable).

**environment** — Install dependencies with actual install command. Set up isolated database (if applicable). Start dev server on dedicated port. Health check. Create conversation file. Checklist: `deps_installed`, `server_healthy`.

**plan** — Break work into discrete tasks. Get approval (solo: human, teammate: orchestrator or auto). Checklist: `plan_created`, `plan_approved`.

**execute** — Sync from base branch. Implement changes task by task. Add tests. Escalate after 2 failed fix attempts. Checklist: `tasks_complete`, `tests_pass`.

**verify** — Run full verification suite (actual commands). Prove each AC through running system — classify by strategy (API: curl, UI: browser automation, infra: DB queries). Record evidence. Checklist: `verification_passes`, `ac_proved`.

**ship** — Sync from base, re-verify. Push branch, create PR with AC evidence. Monitor CI, fix failures. Update PM tool status. Checklist: `pr_created`, `ci_green`.

**cleanup** — Tear down task-specific resources created by the environment phase (stop dev server, remove worktree). Only cleans up what the harness created — never touches pre-existing resources. Checklist: `resources_released`.

### 6e. Present and Write

1. Present the full architecture to the user: launcher + N phase skills
2. Show each skill's key content (don't just list names — show what each does)
3. After approval, write all skills to the project's skill directory
4. Update `HARNESS.md` with the generated skills list

### Generation Rules

1. **Use the name the user chose** for the launcher
2. **Use actual commands** — no `<placeholder>` syntax in any generated skill
3. **Present skills** to the user before writing
4. **Write as SKILL.md** in the project's skill directory (one directory per skill)
5. **Phase skills are not user-invocable** — only the launcher is
6. **All skills write state to `.harness/`** — not to the user's codebase
7. **Reference the harness-refs principles** where relevant
8. **40-140 lines per phase skill** — if a skill grows beyond this, it's doing too much

### Concept Integration

For each concept the user chose to adopt, integrate it into the appropriate phase skills (see the concept-to-phase mapping in [phase-skill-architecture.md](../harness-refs/reference/phase-skill-architecture.md)):

- **Environment Isolation** → generates the environment + cleanup phase skills
- **Quality Gates** → adds parallel review agent step to the verify phase skill
- **PM Integration** → adds PM tool calls to pickup and ship phase skills
- **AC Discipline** → adds AC validation to the pickup phase skill
- **Multi-Agent Coordination** → generates the full orchestrate launcher + orchestrate phase skills (analyze, dispatch, collect, setup, quality, merge, conclude)

## Phase 7: Write HARNESS.md

Generate a `HARNESS.md` at the project root. This is the human-readable front door to the harness — it explains what harness engineering is, how the workflow works for this project, and references everything in `.harness/`.

```markdown
# Harness

Engineering workflow for agent-driven development on this project. Generated by [Harnessable](https://github.com/kipwise/harnessable).

## What is Harness Engineering?

Harness engineering gives AI agents a disciplined, phased workflow for shipping software. Instead of letting agents work ad-hoc (skipping verification, losing context, producing inconsistent quality), every task follows clear phases with explicit instructions and exit gates.

The harness improves over time — after real work, `/harness-learn` reviews what happened and reshapes the workflow based on evidence.

## Architecture

```
/<launcher-name> ISSUE-123
  → creates state file + branch
  → invokes universal engine
    → engine loops through phase skills:
      [phase 1] → [phase 2] → ... → [phase N]
    → each phase: focused skill (40-140 lines) with checklist + exit gate
  → engine announces "WORKFLOW COMPLETE"
```

**Why phase skills:** A single big skill loses agent attention by late phases. Phase skills keep each turn focused — the agent sees one phase at a time, not the whole workflow.

## The Loop

```
/harness-setup (shape) → real work → /harness-learn (reflect) → /harness-setup ...
```

## Current Workflow

[List each phase with: what it does, key commands, exit gate. Use the actual phases generated for this codebase.]

## Profiles

[Profile matrix showing which phases each profile includes.]

## Adopted Concepts

[List each concept the team has adopted and what it means for this project.]

## Generated Skills

| Skill | Purpose | User-invocable |
|-------|---------|---------------|
| `/<launcher>` | Build launcher — creates state, invokes engine | Yes |
| `harness-build-understand` | Explore code, identify scope | No |
| ... | ... | ... |
| `harness-engine` | Universal state machine (ships with Harnessable) | No |

## Principles

1. **Verify by proof, not assumption** — run the system, capture output, cite evidence
2. **Persist everything** — progress recorded to .harness/conversations/ at each phase transition
3. **Adapt to the repo** — skills use this project's actual commands
4. **Fail fast, surface early** — hit a blocker? Flag it, don't spiral
5. **Self-improve** — /harness-learn reviews rounds and reshapes the workflow

## Harness Data

- `.harness/conversations/` — per-implementation records (phase progress, decisions, evidence)
- `.harness/retros/` — past retrospective results

## Reshaping

Run `/harness-learn` after a few rounds of work to review friction and reshape the workflow.
Run `/harness-setup` to re-examine the codebase and explore new concepts.
```

Adapt the template to fit what was actually generated. `HARNESS.md` is committed to the repo — it's documentation for the team.

## Phase 8: Orient

After writing context, initializing `.harness/`, and generating skills, output:

> You're set up. Here's what was created:
>
> **Architecture:**
> - `/<launcher-name>` — your build launcher (the skill you invoke)
> - N phase skills — focused work per phase (understand, execute, verify, ship, etc.)
> - `harness-engine` — universal state machine that loops through phases (ships with Harnessable)
>
> **Data:**
> - `.harness/` directory for recording progress and state
> - `HARNESS.md` documenting the workflow for your team
>
> **How to use it:** Run `/<launcher-name> ISSUE-123` (or a plain text description). The launcher creates a state file, the engine loops through your phase skills — each one does focused work with clear exit gates. Progress is recorded automatically.
>
> **How it improves:** After a few rounds of real work, run `/harness-learn`. It reads the recorded conversations, maps friction to specific phase skills, and suggests targeted improvements.
>
> The harness loop: `/harness-setup` (shape) → real work → `/harness-learn` (reflect) → reshape

---

## Re-running

`/harness-setup` can be run again anytime:
- After `/harness-learn` surfaces new concepts to explore
- After the codebase changes significantly (new tools, new deploy target)
- When the team grows or workflow changes
- When you want to rethink the harness shape

On re-runs, read `HARNESS.md` and existing skills. Show what's changed since last exploration. Regenerate or update skills as needed.
