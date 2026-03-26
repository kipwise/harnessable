# Harnessable

**Disciplined, phased workflows for AI coding agents — shaped by your codebase.**

AI agents are powerful but unreliable without structure. They skip verification, lose context between sessions, ship without checking CI, and produce inconsistent quality. Harnessable gives them a disciplined, phased workflow — and helps you shape it to fit your repo, your team, and your actual friction.

## The methodology

Every task follows clear **phases**. Each phase is a focused skill (40-140 lines) with explicit instructions and an **exit gate** the agent must pass before moving on. A universal **driver** loops through them via a state file.

```
Launcher → Driver → [understand] → [execute] → [verify] → [ship] → COMPLETE
```

This is the universal structure. The implementation is specific to your codebase — your commands, your tools, your branching model. A Django project's verify phase runs `pytest + flake8 + pylint + mypy`. A Go project's runs `go test + golangci-lint`. The methodology is the same; the phase skills are generated.

**Why phase skills work:** A monolithic implementation skill grows to 300+ lines. By the verify phase, the agent has forgotten the understand phase's instructions. Phase skills keep each turn focused — the agent sees one phase at a time (40-140 lines), not the whole workflow. A universal driver orchestrates the sequence through a state file.

**The key principles:**
1. **Verify by proof** — run the system and capture output, don't just read code
2. **Record at phase transitions** — progress survives session drops, enables improvement
3. **Fail fast** — stuck after 2 attempts? Surface it, don't spiral
4. **Improve through evidence** — retrospect on what worked, reshape the workflow

## The harness loop

```
/harness-setup (shape) → use generated skills (real work) → /harness-retro (reflect) → ...
```

**Setup.** `/harness-setup` scans your codebase, assesses workflow readiness, and generates a **launcher + phase skills** — each phase is a focused skill (40-140 lines) with your actual commands, exit gates, and recording built in.

**Use.** Invoke the launcher with a task. The driver loops through phase skills — each one does focused work and records progress. The state file tracks where you are.

**Reflect.** `/harness-retro` reads the recorded data, maps friction to specific phase skills, and suggests targeted improvements — editing specific phase skills or adding new phases when the evidence is clear.

**Reshape.** Your workflow evolves with each round. Phase skills get sharper. New phases appear when friction demands them.

## What ships

```
/harness-setup        → scan codebase, assess, generate launcher + phase skills
/harness-retro        → review friction per phase, reshape skills
/harness-learn        → guided onboarding for newcomers (concept + your harness)
harness-refs   → core principles, anti-patterns, concept library (hub)
harness-engine        → universal state machine — loops through phase skills via state file
```

**The driver is the only action skill that ships.** It's 100% portable — 45 lines of state machine logic that never references any codebase detail. Everything else (launcher, phase skills, environment setup, quality gates) is generated from your codebase using your actual commands, paths, and tools.

`HARNESS.md` at the project root documents the workflow for the team. `.harness/` stores implementation records, retro results, and state — separate from your codebase.

```
HARNESS.md               # human-readable workflow documentation (committed)
.harness/
├── conversations/        # per-implementation records (phase progress, decisions, evidence)
└── retros/               # past retro results and friction snapshots
```

## The concept library

Beyond the universal phased workflow, concepts address specific friction patterns. They're coaching material — not pre-built skills. When adopted, the harness generates a skill using your actual tools.

| Concept | Friction it addresses |
|---|---|
| Verification Discipline | "Looks correct" without running it |
| Session Resilience | Progress lost on session drop |
| Environment Isolation | Agents conflicting on DB, ports, files |
| Quality Gates | Issues caught in review that agents should catch |
| Process Profiles | Simple tasks feel over-processed |
| Multi-Agent Coordination | Sequential work that could be parallel |
| Integration Quality | Individual PRs fine, combined code broken |
| Acceptance Criteria Discipline | Debates about what "done" means |
| Architecture Lock-In | Refactoring cascades from undecided architecture |
| Vertical Feature Slices | Layer-based tickets creating sequential blocking |

## Install

```bash
npx skills add kipwise/harnessable
```

Or manually copy `skills/` into your project's `.claude/skills/`, `.cursor/skills/`, or equivalent.

## Compatibility

Works with any AI coding agent that supports the SKILL.md format:
Cursor, Claude Code, Gemini CLI, Codex CLI, VS Code Copilot, Kiro, OpenCode, and more.

## License

Apache 2.0

---
