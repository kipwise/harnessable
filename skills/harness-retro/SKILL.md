---
name: harness-retro
description: Review what happened during implementation, visualize friction patterns, and reshape your harness — fix issues, adopt concepts, generate new skills. The reflection half of the harness loop.
user-invokable: true
---

# Harness Retro

Review real work, see where friction occurred, and reshape your harness. Fix harness issues, adopt new concepts when the evidence is clear, and generate codebase-specific skills.

**Invoke with:** `/harness-retro`

This is the reflection half of the harness loop:

```
/harness-setup (shape) → use generated skills (real work) → /harness-retro (reflect) → /harness-setup ...
```

---

## Delivery Mode

Detect which mode is available (see Delivery Mode in `/harness-setup` for detection logic).

**Terminal mode (default):** Generate friction dashboard as a standalone HTML file at `.harness/retro-dashboard.html`. Open it for the user. Ask for decisions (which findings to apply, which concepts to adopt) in the terminal conversationally.

**Channel mode:** Push friction dashboard and concept suggestions as interactive screens via `mcp__harness__reply`. User clicks findings to apply → `<channel>` events. Push progress updates during apply phase. See `/harness-setup` Delivery Mode section for HTML patterns and event types.

---

## Phase 1: Gather Evidence

### 1a. Harness Data
Read from `.harness/`:
- **`.harness/conversations/`** — all conversation files from recent implementations. Extract: phase progress, decisions, discoveries, verification evidence, harness issues, metrics. **Classify friction by phase** — which phase skill was active when the issue occurred.
- **`.harness/state.json`** — harness-level state: adopted concepts, implementation count, last retro date.
- **`.harness/retros/`** — past retro results. Check: were previous findings addressed? Are issues recurring?

If `.harness/conversations/` is empty or sparse, note this — the retro is limited to git history and PR comments. Suggest that recording be added to the phase skills.

### 1b. Git & PR History
- Recent PRs and their review comments — look for patterns in reviewer feedback
- Git log for recent agent work — what was shipped, how many rounds of fixes
- CI failures — what broke after push

### 1c. Cross-Round Patterns
If enough conversation files exist (5+), look for patterns across rounds:
- Which **phase skills** take longest consistently?
- Which types of harness issues recur in which phases?
- Are the same discoveries made repeatedly?
- What friction signals appear across multiple implementations?
- Are there phases that consistently pass without friction (candidates for simplification)?

This cross-round analysis is what drives structural workflow changes (not just fixing individual issues). After 10+ implementations, prompt: "You have enough data for a big-picture analysis. Want to look at patterns across all rounds?"

## Phase 2: Analyze Harness Issues

Classify each finding:

| Category | Description | Action |
|---|---|---|
| **Harness bug** | Skill instruction is wrong/outdated/missing | Propose specific edit |
| **Harness gap** | Scenario the skill doesn't cover | Propose new section/step |
| **Repeated issue** | Known issue that happened again | Escalate — fix didn't work |
| **Process improvement** | Pattern that worked well | Propose codifying it |
| **Not actionable** | One-off, external dependency | Note for context |

For each finding:
```
### Finding N: [Brief title]

**Category:** harness bug | harness gap | repeated issue | process improvement | not actionable
**Phase:** [Which phase skill this occurred in — e.g., harness-build-verify]
**Evidence:** [What happened — be specific]
**Impact:** [Turns wasted / human interventions / quality degradation]
**Proposed fix:** [Exact phase skill file + section + change]
```

Phase-level classification makes fixes precise — "harness-build-verify step 3 should run coverage before E2E" instead of "step 14 in /implement should..."

## Phase 3: Visualize — Friction Dashboard

Generate an interactive HTML visualization showing what happened during this round of work.

### Visual Design
Match the visual style established by `/harness-setup`. If the explore visualization used the project's brand colors and fonts, use the same here for consistency. If not, use a clean neutral dark theme. Single standalone HTML file with inline CSS, no external dependencies.

**Always generate a fresh visualization.** Never reuse an existing HTML file from a previous retro — the evidence and friction data are specific to this round.

Start a local server and create an HTML page with:

### 3a. Workflow Replay
Show the **state machine progression through phases** with annotations from this round:
- Which phases were reached, which were skipped (by profile)
- Time spent per phase (relative sizing from state file timestamps)
- Where blockers occurred (highlighted in red) — which phase skill?
- Where the human had to intervene (highlighted in amber)
- What went smoothly (highlighted in green)
- Show the driver loop: phase → checklist validation → next phase

If multiple implementations happened, show them side by side to reveal cross-round phase patterns.

### 3b. Friction Map
Overlay friction signals onto the workflow:
- Each friction point shows: what happened, how many times, total impact
- Group by concept: "These 3 friction points all relate to Environment Isolation"
- Show which friction points are addressed by existing skills vs. which need new concepts

### 3c. Harness Issue List
Show all harness issues found, with:
- Severity (turns wasted, human interventions needed)
- Proposed fix (specific skill edit)
- Status (new, repeated, resolved)

Present the visualization to the user. Ask: "Does this match your experience? Anything I missed?"

## Phase 4: Visualize — Concept Suggestions

Based on the friction evidence, generate a second visualization:

### 4a. Evidence-Based Suggestions
For each concept that has concrete evidence from this round, show:
- **Friction observed** — specific incidents from this round, mapped to the phase where they occurred
- **Concept that addresses it** — one sentence
- **What would change** — which phase skills get augmented or generated (see concept-to-phase mapping in [phase-skill-architecture.md](../harness-refs/reference/phase-skill-architecture.md))
- **Skill preview** — what the new/modified phase skill would look like for this codebase

### 4b. Workflow Comparison
Show the current harness workflow alongside "what it would look like" if concepts were adopted:
- Current flow on the left
- Modified flow on the right (with concept integrated)
- Highlighted differences

Make concepts clickable — user can toggle concepts on/off to see different configurations.

### 4c. Interaction
For each concept suggestion:
- **Adopt** — generate the skill now
- **Not now** — acknowledge but don't re-suggest until new evidence
- **Not relevant** — dismiss permanently for this project

**Rules:**
- Suggest at most 2-3 concepts per retro
- Only suggest with concrete evidence from this round
- Respect previous "not now" and "not relevant" decisions

## Phase 5: Present Text Summary

After the visual exploration, present a text summary:

```
## Harness Retro: [round description]

### Harness Issues
[Specific skill edits proposed — highest impact first]

### Concept Suggestions
[Friction → concept mapping, with adopt/defer/dismiss options]

### Process Improvements
[Patterns that worked well — propose codifying]

### Discoveries
[Non-obvious findings worth recording]

---
Summary: N findings. M proposed skill changes. K concept suggestions.
Which should I apply? (all / specific numbers / none)
```

## Phase 6: Apply Changes

After human approval:

### Fix Harness Issues
- Edit specific **phase skill files** with approved changes — small, targeted edits to 40-140 line files

### Generate or Update Phase Skills
For adopted concepts OR improvements to existing phase skills:
1. Read the `## Harness Context`
2. Read the concept's reference doc and the concept-to-phase mapping in [phase-skill-architecture.md](../harness-refs/reference/phase-skill-architecture.md)
3. Determine which phase skills are affected:
   - **Augment existing phase** → edit the phase skill file (add steps, update checklist)
   - **Add new phase** → generate a new phase skill file + update the launcher's lifecycle array
   - **Add orchestration** → generate the full orchestrate launcher + 7 orchestrate phase skills
4. Write or update SKILL.md files with **this repo's actual commands, paths, and tools**
5. Present to user for review before writing
6. Write to the project's skill directory
7. If phases were added/removed, update the launcher's lifecycle and profile matrix

### Update Harness State
- Write retro results to `.harness/retros/YYYY-MM-DD-retro.md`
- Update `.harness/state.json`: increment implementation count, update concepts, record last retro date
- **Update `HARNESS.md`** if the workflow changed: new concepts adopted, skills generated/updated, workflow steps added or removed. `HARNESS.md` should always reflect the current state of the harness.

### Update Harness Context
- If new skills or workflow changes affect the context, update it
- Record adopted/deferred/dismissed concepts so future retros respect decisions

### Report
- List what changed: skill edits, new skills, context updates
- If significant workflow reshape happened, suggest: "Run `/harness-setup` to see the updated workflow shape visually."

## Guidelines

- **Evidence over theory.** Only suggest concepts with concrete friction from this round.
- **Show, don't tell.** The visualizations should make friction obvious — let the user see it, not read about it.
- **Be specific.** "Step 4 should run `pnpm build` after `pnpm install`" — not "the skill should be clearer."
- **Don't over-correct.** One-off issues don't need permanent skill changes.
- **Record successes.** What worked well should be codified too.
- **Generate, don't prescribe.** Skills use this repo's actual tools, not placeholders.
- **Coach, don't lecture.** Concept suggestions are offers, not mandates.
- **Respect decisions.** "Not now" means not now. "Not relevant" means stop.
