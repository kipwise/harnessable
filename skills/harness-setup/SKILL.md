---
name: harness-setup
description: Introduce harness engineering, explore your codebase, visualize constraints and workflow options, and generate a phased implementation workflow tailored to your repo.
user-invokable: true
---

# Harness Explore

Introduce the harness engineering methodology, understand your codebase through the lens of agent workflows, and generate a phased implementation workflow with clear instructions per phase — tailored to your repo.

**Invoke with:** `/harness-setup`

This is the exploration half of the harness loop:

```
/harness-setup (shape) → use generated skills (real work) → /harness-retro (reflect) → /harness-setup ...
```

---

## Visual Companion

After Phase 2 (Ask), offer the visual companion. This offer MUST be its own message — do not combine it with other content.

> "I'd like to show you the assessment and setup flow in your browser — it's easier to see the architecture and make selections visually. Want to try it? (Requires opening a local URL)"

Wait for the user's response. If they decline, proceed with terminal-only mode.

### If accepted: Start the visual companion server

The harness channel ships a local server at `channel/server.ts` (relative to the harnessable skills directory). Start it with the project's screen directory:

```bash
# Find the server relative to this skill's location
HARNESS_SERVER="$(dirname "$(dirname "$(find .claude/skills/harness-engine -name SKILL.md 2>/dev/null | head -1)")")/../../channel/server.ts"

# If channel/server.ts is not found locally, check common locations
if [ ! -f "$HARNESS_SERVER" ]; then
  for dir in /Users/*/Repo/harnessable ~/.harnessable; do
    [ -f "$dir/channel/server.ts" ] && HARNESS_SERVER="$dir/channel/server.ts" && break
  done
fi

# Start the server — always pass SCREEN_DIR so it finds this project's screens
HARNESS_SCREEN_DIR="$(pwd)/.harness/screens" bun run "$HARNESS_SERVER" &
```

The server prints its URL to stderr: `harness: http://localhost:PORT`. Tell the user to open it.

### How it works

The visual companion works the same way regardless of whether MCP channel is connected:

1. **Agent writes all screen files upfront** to `.harness/screens/` — `01-intro.html`, `02-assessment.html`, `03-selection.html`. Write content fragments (no `<!DOCTYPE>`, no `<html>`) — the server wraps them in the frame template.
2. **Server shows screen 1** immediately. User reads, clicks Continue.
3. **Server auto-advances** to screen 2, then screen 3 — no agent round-trip needed.
4. **User makes selections** on screen 3 (phases, concepts). Clicks are captured automatically.
5. **Agent collects decisions:**
   - If MCP channel is connected: `<channel>` events arrive in the conversation automatically — agent proceeds.
   - If no MCP: ask the user to confirm when they're done selecting (e.g., user says "OK" or "done"), then read `.harness/events.jsonl` or fetch `GET http://localhost:PORT/events` for all captured decisions.

**MCP channel enhancement** (when `mcp__harness__reply` tool exists):
- `mcp__harness__reply({ type: "status", text: "..." })` — update the status bar
- `mcp__harness__reply({ type: "update", html: "..." })` — append to the update zone
- `mcp__harness__reply({ type: "screen", html: "..." })` — push a screen directly (bypasses file queue)

**Keep interactions simple:**
- Use **simple buttons** for choices — not dropdowns, text inputs, or complex components
- **One clear action per screen** — the user should always know what to click
- **Don't over-fragment** — information-only content goes on one scrollable page with a "Continue" button at the bottom

### If declined: Terminal-only mode

No browser needed. Works everywhere.
- Questions and decisions: asked in the terminal
- Visualization: generate a single HTML file at `.harness/explore-visualization.html` and open it, but all decisions still happen in the terminal
- Progress: reported as text in the terminal

### HTML patterns (both channel and server modes)

The frame template provides CSS classes. Write **content fragments** (no `<!DOCTYPE>`, no `<html>`) — the server wraps them automatically.

**Single-select options** (user picks one):
```html
<div class="options">
  <div class="option" data-choice="solo" data-event-type="answer" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content"><h3>Solo developer</h3><p>Just me and AI agents</p></div>
  </div>
  <div class="option" data-choice="team" data-event-type="answer" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content"><h3>Team</h3><p>Multiple developers</p></div>
  </div>
</div>
```

**Binary choices** (two separate buttons — use for adopt/skip, include/skip):
```html
<div style="display:flex;gap:0.75rem;margin:0.75rem 0">
  <button class="btn" data-choice="adopt:concept-name" data-event-type="concept_decision" onclick="this.disabled=true; this.textContent='✓ Adopted'; toggleSelect(this)">Adopt</button>
  <button class="btn btn-secondary" data-choice="skip:concept-name" data-event-type="concept_decision" onclick="this.disabled=true; this.textContent='Skipped'; toggleSelect(this)">Skip for now</button>
</div>
```

**Confirm/Continue button:**
```html
<button class="btn" data-choice="confirm:step-name" data-event-type="confirm" onclick="this.textContent='✓'; this.disabled=true; toggleSelect(this)">Continue</button>
```

**Available CSS classes:** `.options`, `.option`, `.cards`, `.card`, `.card-body`, `.badge`, `.badge-green`, `.badge-amber`, `.badge-red`, `.badge-blue`, `.btn`, `.btn-secondary`, `.section`, `.divider`, `.subtitle`, `.arch`, `.arch-line`, `.mockup`, `.mockup-header`, `.mockup-body`, `.split`, `.pros-cons`

---

## Phase 1: Scan the Codebase

Before asking questions, thoroughly scan the project:

### Build & Test Tooling
- **Package manager**: package.json (npm/yarn/pnpm), Cargo.toml, go.mod, pyproject.toml, Gemfile
- **Build system**: turbo.json, nx.json, Makefile, build scripts
- **Test framework**: vitest/jest, pytest, go test, rspec
- **Linter & formatter**: eslint, prettier, ruff, golangci-lint, rubocop
- **Type checker**: tsconfig.json, mypy, pyright
- **Monorepo structure**: workspace config, package directories

### CI/CD & Deploy
- **CI config**: .github/workflows/, .circleci/, .gitlab-ci.yml, Jenkinsfile
- **Deploy config**: vercel.json, railway.toml, netlify.toml, Dockerfile
- **Preview environments**: PR-based deploys, staging config

### Project Management
- **PM tool config**: .linear/, jira config, GitHub project references
- **Issue references**: commit messages with issue IDs (KIP-XX, PROJ-XX, #123)
- **Branching model**: branch naming patterns from git log

### Database & Services
- **Database**: PostgreSQL, MySQL, SQLite, MongoDB — migration tools, seed data
- **External services**: APIs, message queues, caches
- **Dev environment**: docker-compose, devcontainers, Nix, local setup scripts

### Repository Structure
- **README and docs**: Project purpose, contributing guides, architecture docs
- **Existing workflow docs**: CONTRIBUTING.md, development guides, ADRs
- **Code organization**: src layout, test location conventions

Note what you've learned and what remains unclear.

## Phase 2: Ask

<HARD-GATE>
You MUST complete Phase 2 (ask questions and get answers) BEFORE pushing any visualization screens or generating any HTML. Do NOT skip ahead to Phase 3. The visualization depends on the user's answers about team size, PM tool, pain points, and workflow preferences.
</HARD-GATE>

STOP and ask the user focused questions. Only ask what you couldn't infer from the scan.

**Channel mode:** Push each question as an interactive screen with clickable options. One question at a time — wait for the `<channel type="answer">` event before pushing the next.

**Terminal mode:** Ask questions directly in the terminal. Use the platform's built-in question mechanism if available (e.g., AskUserQuestion). For multiple-choice, present numbered options.

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

## Phase 3: Visualize — The Full Picture

<HARD-GATE>
Do NOT start Phase 3 until Phase 1 (scan) and Phase 2 (ask) are both complete. You need the scan results AND the user's answers to generate an accurate assessment. If you skipped Phase 2, go back and ask now.
</HARD-GATE>

After scanning and asking, present the findings to the user. The visualization has **three screens** (visual companion) or **one comprehensive page** (terminal-only fallback).

### Visual Companion — Three Screens

If the user accepted the visual companion, generate **all three screen files upfront** before the user sees anything. The server queues them and auto-advances on Continue clicks — no agent round-trip between screens.

Follow this sequence:
1. Write `01-intro.html` to `.harness/screens/` — Introduction to harness engineering (informational, Continue button)
2. **Start the server** — the user sees screen 1 immediately in their browser
3. While the user is reading screen 1, write `02-assessment.html` and `03-selection.html` — the server picks them up automatically

When the user clicks Continue on screen 1, the server instantly shows screen 2, then screen 3. No agent round-trip needed.

After writing all three files, tell the user: "The assessment is ready in your browser. Take a look — when you're done making selections on the last screen, let me know."

If MCP channel is connected, `<channel>` events arrive automatically as the user clicks. If not, wait for the user to say they're done, then read `.harness/events.jsonl` to collect their selections.

**Visual quality:** If the `frontend-design:frontend-design` skill is available, use it when crafting the HTML for these screens. The explore visualization is the user's first impression of Harnessable — it should feel polished and intentional, not like raw agent output. Use the frame template's CSS classes as a foundation, but invest in layout, spacing, and visual hierarchy.

#### Screen 1: Introduction to Harness Engineering

A **single scrollable page** that explains the methodology. No interaction needed except a "Continue" button at the bottom. Don't break this into multiple screens — it's just information.

Cover:
- **The problem:** AI agents skip verification, lose context, ship without CI, produce inconsistent quality
- **The solution:** Phased workflows with exit gates. Each phase is a focused skill (40-140 lines). A universal driver orchestrates them through a state file.
- **The architecture:**
  ```
  Launcher → Driver → [understand] → [execute] → [verify] → [ship] → COMPLETE
  ```
- **The key principles:** Verify by proof, record at transitions, fail fast, improve through evidence
- **The harness loop:** `/harness-setup` → real work → `/harness-retro` → reshape

End with a Continue button:
```html
<button class="btn" data-choice="confirm:intro" data-event-type="confirm" onclick="this.textContent='✓'; this.disabled=true; toggleSelect(this)">Continue</button>
```

The server auto-advances to Screen 2 when the user clicks Continue.

#### Screen 2: Situational Assessment

A **single scrollable page** that gives an honest assessment of the codebase's readiness. This is the most important screen — it tells the user the truth about where they stand.

Include on this page:

**Codebase Profile:** Tech stack, tools, infrastructure (language, framework, test runner, CI, deploy target, database, etc.)

**What's ready** (green indicators):
- Capabilities the codebase already has (e.g., "Strong CI pipeline with 5 checks", "Docker Compose dev environment")

**What's missing** (amber/red indicators):
- Constraints and gaps (e.g., "No environment isolation — multiple agents will conflict on ports and DB")

**Readiness assessment — be honest:**
- If they can't isolate environments → they're **not ready for orchestration** (multiple agents would overlap). Say this clearly. They're ready for a **single implementation agent**, which is still very useful.
- If they have no CI → the verify phase can only run local checks. Suggest they set up CI as a next engineering step — Harnessable can't solve that for them.
- If they have no PM tool → the pickup phase accepts plain text descriptions instead of issue fetching. That's fine.
- Don't promise what the harness can't deliver. Be upfront about what's an engineering problem vs. what Harnessable can actually help with.

**What Harnessable will set up for you:**
- The phases that make sense for this codebase (list them)
- The architecture: launcher + N phase skills + driver
- What each phase does with this project's actual commands

End with a Continue button. The server auto-advances to Screen 3 when the user clicks.

#### Screen 3: Selection

An **interactive screen** where the user chooses their path. Use simple clickable options — buttons or option cards. No complex layouts.

**Mandatory vs optional phases:**

Some phases are **mandatory** — they cannot be removed. Show them as always-included (no clickable action):
- **understand** — always needed
- **execute** — always needed
- **verify** — always needed
- **ship** — always needed

Optional phases depend on the codebase. For each optional phase, give **two separate buttons** — Include or Skip. Don't use toggles (they're confusing when you can't de-select):
```html
<h3>Optional: Plan phase</h3>
<p>Break work into discrete tasks and get approval before coding.</p>
<div style="display:flex;gap:0.75rem;margin:0.75rem 0">
  <button class="btn" data-choice="include:plan" data-event-type="phase_toggle" onclick="this.disabled=true; this.textContent='✓ Included'; toggleSelect(this)">Include</button>
  <button class="btn" class="btn-secondary" data-choice="skip:plan" data-event-type="phase_toggle" onclick="this.disabled=true; this.textContent='Skipped'; toggleSelect(this)">Skip</button>
</div>
```

Only show optional phases that are relevant to this codebase:
- **pickup** — only if PM tool detected
- **design** — only if frontend/UI framework detected
- **environment** — only if database or dev server detected
- **plan** — show for non-trivial projects
- **cleanup** — automatically included if environment is included

**Concept adoption** — only show concepts the codebase is ready for. For each, provide **two separate buttons** — Adopt or Skip. Don't show concepts with unmet prerequisites (e.g., don't show orchestration if they can't isolate environments):
```html
<h3>Environment Isolation</h3>
<p>Each task gets its own worktree, database, and port. Required for multi-agent work.</p>
<div style="display:flex;gap:0.75rem;margin:0.75rem 0">
  <button class="btn" data-choice="adopt:env-isolation" data-event-type="concept_decision" onclick="this.disabled=true; this.textContent='✓ Adopted'; toggleSelect(this)">Adopt</button>
  <button class="btn" class="btn-secondary" data-choice="skip:env-isolation" data-event-type="concept_decision" onclick="this.disabled=true; this.textContent='Skipped'; toggleSelect(this)">Skip for now</button>
</div>
```

**Suggested next steps** — for things Harnessable can't solve (missing CI, no PM tool), list them as engineering recommendations. Don't try to include them in the harness setup.

End with a "Generate" button:
```html
<button class="btn" data-choice="confirm:generate" data-event-type="confirm" onclick="this.textContent='Generating... ✓'; this.disabled=true; toggleSelect(this)">Generate My Harness</button>
```

Wait for the user's selections. If MCP channel is connected, `<channel type="confirm" step="generate">` arrives automatically. Otherwise, wait for the user to confirm in the terminal, then read `.harness/events.jsonl` to collect all phase/concept decisions before proceeding to Phase 4.

### Terminal-Only Mode (no visual companion)

If the user declined the visual companion, generate a **single standalone HTML file** at `.harness/explore-visualization.html` combining all three sections on one scrollable page. Open it for reference:
```bash
open .harness/explore-visualization.html   # macOS
xdg-open .harness/explore-visualization.html # Linux
```

**Visual Design:** If the `frontend-design:frontend-design` skill is available, use it. Check for design cues in the codebase (CSS variables, brand colors, UI framework). Use a clean, neutral dark theme if no cues found. Inline CSS, no external dependencies. Always generate fresh.

Walk through decisions in the terminal:
- "Take a look at the visualization. When you're ready, let me know which phases and concepts feel right."
- Ask one decision at a time — don't dump all questions at once.

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
├── retros/               # past retro results and friction dashboard snapshots
└── state.json            # harness-level state: concepts, metrics, configuration
```

**Important distinction:** This `state.json` is the **harness-level** state — it tracks adopted concepts, accumulated metrics, and configuration across all implementations. Per-task state files (tracking lifecycle progress through phases) are created at runtime by the launcher and live in the worktree or working directory.

Write `.harness/state.json`:
```json
{
  "created_at": "<timestamp>",
  "last_explore": "<timestamp>",
  "last_retro": null,
  "concepts_adopted": ["<list of concepts the user chose>"],
  "concepts_deferred": ["<list of 'not now' concepts>"],
  "concepts_dismissed": ["<list of 'not relevant' concepts>"],
  "generated_skills": ["<list of skill names generated>"],
  "metrics": {
    "implementation_count": 0,
    "total_harness_issues": 0,
    "total_discoveries": 0,
    "retro_count": 0
  }
}
```

The `metrics` section is accumulated by the generated phase skills (increments `implementation_count`, counts harness issues and discoveries from each conversation file) and by `/harness-retro` (increments `retro_count`, rolls up totals). This gives the retro cross-round data without a separate metrics directory.

Add `.harness/` to the project's `.gitignore` if the user prefers (conversations and retros can also be committed — ask the user).

## Phase 6: Generate Skills

Generate the **driver + launcher + phase skills architecture** based on the user's codebase and choices. Read [phase-skill-architecture.md](../harness-refs/reference/phase-skill-architecture.md) for the full architecture reference — state file schema, templates, and concept-to-phase mapping.

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

Present the proposed phases to the user: "Based on what I found, your harness will have these phases: [list]. Does this feel right?"

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

Generate a launcher skill (name it for this repo — e.g., `/implement`, `/build`, `/dev`) that:

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

Here's what each phase skill should contain (adapt to the codebase):

**pickup** — Fetch issue from PM tool, display title/AC/labels. Validate AC are testable (stop if vague). Mark issue "In Progress". Checklist: `issue_fetched`, `ac_clear`.

**understand** — Read architecture docs, specs, existing code in areas being changed. Identify files to touch, patterns to follow. Fetch external library docs if needed. Checklist: `code_explored`, `scope_clear`.

**design** — Brainstorm approach for complex changes. For UI: prototype, take screenshots, present for feedback. Checklist: `approach_decided`, `design_approved` (if applicable).

**environment** — Install dependencies with actual install command. Set up isolated database (if applicable). Start dev server on dedicated port. Health check. Create conversation file. Checklist: `deps_installed`, `server_healthy`.

**plan** — Break work into discrete tasks. Get approval (solo: human, teammate: orchestrator or auto). Checklist: `plan_created`, `plan_approved`.

**execute** — Sync from base branch. Implement changes task by task. Add tests. Escalate after 2 failed fix attempts. Checklist: `tasks_complete`, `tests_pass`.

**verify** — Run full verification suite (actual commands). Prove each AC through running system — classify by strategy (API: curl, UI: browser automation, infra: DB queries). Record evidence. Checklist: `verification_passes`, `ac_proved`.

**ship** — Sync from base, re-verify. Push branch, create PR with AC evidence. Monitor CI, fix failures. Update PM tool status. Checklist: `pr_created`, `ci_green`.

**cleanup** — Stop dev server, drop database, remove worktree, delete local branch. Checklist: `resources_released`.

### 6e. Present and Write

1. Present the full architecture to the user: launcher + N phase skills
2. Show each skill's key content (don't just list names — show what each does)
3. After approval, write all skills to the project's skill directory
4. Update `.harness/state.json` with `generated_skills` list

**If MCP channel is available**, push progress updates during generation:
```
mcp__harness__reply({ type: "status", text: "Generating phase skills..." })
mcp__harness__reply({ type: "update", html: "<div style='color:var(--success)'>✓ harness-build-understand created</div>" })
// ... for each skill
mcp__harness__reply({ type: "status", text: "✓ All skills generated" })
```

### Generation Rules

1. **Name the launcher for this repo** — not generically
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

Engineering workflow for agent-driven development on this project. Generated by [Harnessable](https://github.com/harnessable/harnessable).

## What is Harness Engineering?

Harness engineering gives AI agents a disciplined, phased workflow for shipping software. Instead of letting agents work ad-hoc (skipping verification, losing context, producing inconsistent quality), every task follows clear phases with explicit instructions and exit gates.

The harness improves over time — after real work, `/harness-retro` reviews what happened and reshapes the workflow based on evidence.

## Architecture

```
/<launcher-name> ISSUE-123
  → creates state file + branch
  → invokes universal driver
    → driver loops through phase skills:
      [phase 1] → [phase 2] → ... → [phase N]
    → each phase: focused skill (40-140 lines) with checklist + exit gate
  → driver announces "WORKFLOW COMPLETE"
```

**Why phase skills:** A single big skill loses agent attention by late phases. Phase skills keep each turn focused — the agent sees one phase at a time, not the whole workflow.

## The Loop

```
/harness-setup (shape) → real work → /harness-retro (reflect) → /harness-setup ...
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
| `/<launcher>` | Build launcher — creates state, invokes driver | Yes |
| `harness-build-understand` | Explore code, identify scope | No |
| ... | ... | ... |
| `harness-engine` | Universal state machine (ships with Harnessable) | No |

## Principles

1. **Verify by proof, not assumption** — run the system, capture output, cite evidence
2. **Persist everything** — progress recorded to .harness/conversations/ at each phase transition
3. **Adapt to the repo** — skills use this project's actual commands
4. **Fail fast, surface early** — hit a blocker? Flag it, don't spiral
5. **Self-improve** — /harness-retro reviews rounds and reshapes the workflow

## Harness Data

- `.harness/conversations/` — per-implementation records (phase progress, decisions, evidence)
- `.harness/retros/` — past retrospective results
- `.harness/state.json` — harness-level config (concepts, metrics). Per-task state files are created at runtime by the launcher.

## Reshaping

Run `/harness-retro` after a few rounds of work to review friction and reshape the workflow.
Run `/harness-setup` to re-examine the codebase and explore new concepts.
```

Adapt the template to fit what was actually generated. `HARNESS.md` is committed to the repo — it's documentation for the team.

## Phase 8: Orient

After writing context, initializing `.harness/`, and generating skills:

**Visual companion:** Write a final `04-complete.html` to `.harness/screens/` showing everything that was created — the architecture diagram, the list of generated skills, how to use the launcher, and the harness loop. The server shows it after the user finishes with screen 3. If MCP is available, also push via `mcp__harness__reply({ type: "screen", html: "..." })`.

**In the terminal**, output:

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
> **How to use it:** Run `/<launcher-name> ISSUE-123` (or a plain text description). The launcher creates a state file, the driver loops through your phase skills — each one does focused work with clear exit gates. Progress is recorded automatically.
>
> **How it improves:** After a few rounds of real work, run `/harness-retro`. It reads the recorded conversations, maps friction to specific phase skills, and suggests targeted improvements.
>
> The harness loop: `/harness-setup` (shape) → real work → `/harness-retro` (reflect) → reshape

---

## Re-Exploring

`/harness-setup` can be run again anytime:
- After `/harness-retro` surfaces new concepts to explore
- After the codebase changes significantly (new tools, new deploy target)
- When the team grows or workflow changes
- When you want to rethink the harness shape

On re-runs, read `.harness/state.json` and existing skills. Show what's changed since last exploration. Regenerate or update skills as needed. Update `state.json` with new concept decisions.
