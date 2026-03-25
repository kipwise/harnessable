# Self-Improvement

Retrospective patterns, harness issue tracking, and the feedback loop that makes agent engineering get better over time.

## The Feedback Loop

```
Implement → Record Issues → Retrospective → Propose Changes → Apply → Implement (better)
```

Every implementation round generates data about what worked and what didn't. The retrospective turns that data into concrete skill improvements.

## Harness Issues vs. Product Bugs

**Harness issues** are problems with the **skill instructions themselves** — the agent followed the skill correctly but the skill was wrong, incomplete, or unclear.

**Product bugs** are problems with the **application code** — the code doesn't work as expected.

| Example | Type |
|---|---|
| "Skill says to run `npm test` but repo uses `pnpm test`" | Harness issue |
| "Login endpoint returns 500 instead of 200" | Product bug |
| "Skill doesn't mention running `build` before `test` in monorepos" | Harness issue |
| "User profile page shows wrong name" | Product bug |
| "Verification phase doesn't check E2E specs" | Harness issue |

## Recording Harness Issues

During implementation, record harness issues in the conversation file:

```markdown
### [Phase N] Brief title

- **What happened:** What you tried and what went wrong
- **Root cause:** Why the skill instruction was incorrect/missing
- **Workaround:** What you did instead
- **Suggested fix:** How the skill should be updated
- **Turns wasted:** Approximate count
```

Key fields:
- **Turns wasted**: Quantifies the cost. This helps prioritize fixes.
- **Suggested fix**: Must be specific enough to apply mechanically. "The skill should be clearer" is not actionable. "Phase 4 Step 1 should include `pnpm build` after `pnpm install`" is actionable.

## Retrospective Process

### Phase 1: Gather Evidence
Collect from all available sources:
- Conversation files: `## Harness Issues`, `## Discoveries`, `## Metrics`
- PR review comments: patterns in reviewer feedback
- Known issues from memory: were any repeated?

### Phase 2: Analyze
Classify each finding:

| Category | Description | Action |
|---|---|---|
| **Harness bug** | Skill instruction is wrong/outdated | Propose specific edit |
| **Harness gap** | Scenario the skill doesn't cover | Propose new section/step |
| **Repeated issue** | Known issue that happened again | Escalate — previous fix didn't work |
| **Process improvement** | Pattern that worked well | Propose codifying it |
| **Not actionable** | One-off, external dependency | Note but don't change skills |

### Phase 3: Present Findings
Group by category, lead with highest-impact items. Include:
- Evidence (quotes, metrics)
- Impact (turns wasted, human interventions)
- Proposed fix (specific enough to apply)
- Confidence (high/medium/low)

### Phase 4: Apply
With human approval:
1. Edit skill files with the proposed changes
2. Update memory with new/resolved harness issues
3. Report what changed

## Guidelines

- **Be self-critical.** Focus on what broke, what was slow, what needed human correction.
- **Be specific.** Propose diffs, not vibes.
- **Don't over-correct.** One-off issues caused by unusual circumstances don't need permanent skill changes.
- **Record successes too.** If an approach worked well, codify it so it's not lost.
- **Respect human judgment.** Present findings and let the human decide.

## Memory System

For cross-session learning, maintain a memory system:
- **Harness issues**: Known problems and their fixes
- **Patterns**: Technical patterns discovered during implementation
- **Feedback**: User corrections and validated approaches
- **Project context**: Ongoing work, deadlines, team dynamics

Memory files are indexed in a central file (e.g., `MEMORY.md`) for quick lookup. Keep entries specific and dated so stale entries can be identified and cleaned up.

## When to Run Retrospectives

- **After every orchestration round** — review all teammates' work
- **After complex single implementations** — review the conversation file
- **After human feedback reveals a process gap** — capture before it's forgotten
- **Periodically** — even without incidents, review recent work for patterns
