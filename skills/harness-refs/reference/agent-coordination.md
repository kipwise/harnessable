# Agent Coordination

Patterns for multi-agent collaboration: orchestrators, teammates, waves, and heartbeats.

## The Orchestrator-Teammate Model

When multiple issues can be worked in parallel, one agent acts as **orchestrator** and spawns **teammates** to do the implementation work.

### Orchestrator Responsibilities
- Analyze tickets, build dependency graph
- Assign waves (parallel groups)
- Dispatch teammate agents with clear prompts
- Monitor progress via heartbeats
- Gate PR merges (DoD checks, human review routing)
- Run quality wave on integrated branch
- Coordinate human review

### Teammate Responsibilities
- Implement a single issue (or small batch) end-to-end
- Send heartbeat messages at phase transitions
- Report back with PR number, verification results, and environment state
- Address review feedback when routed by orchestrator
- Clean up environment when signaled

## Wave-Based Dispatch

### Why Waves?
Waves group tickets by dependency order. Wave 1 has no dependencies. Wave 2 depends on Wave 1 outputs. This maximizes parallelism while respecting ordering constraints.

### Wave Setup
1. Create a wave branch from the base branch (e.g., `wave/milestone-w1`)
2. All teammate PRs target the wave branch (not main)
3. After all PRs merge to the wave branch, run quality gates on the integrated code
4. Wave branch merges to main as a single unit

### Involvement Levels

Not all tickets need the same oversight:

| Level | What Happens | When to Use |
|---|---|---|
| **Autopilot** | PR auto-merges to wave after DoD checks | Low-risk, established patterns |
| **Human-approved merge** | Orchestrator presents PR to human before merging | Medium risk, needs a human eye |
| **Plan-approved** | Teammate pauses after planning, human reviews plan before code | High risk, novel patterns |

### Risk Assessment
Per-ticket risk signals:
- **High**: Novel architectural pattern, cross-cutting changes, security-sensitive
- **Medium**: New feature with some ambiguity, moderate complexity
- **Low**: Well-defined task, established patterns, minimal scope

## Heartbeat Protocol

Teammates send status updates to the orchestrator at defined points:

### Mandatory Heartbeats
- After environment setup: "ISSUE-XX: Environment ready — localhost:PORT"
- After planning: "ISSUE-XX: Plan complete — N tasks"
- After implementation: "ISSUE-XX: Implementation complete — entering verify"
- After verification: "ISSUE-XX: Verification passed — all AC met"
- After PR creation: "ISSUE-XX: PR #N created"
- Final report: full status with PR URL, verification results, token usage

### During Long Phases
- After each subagent completes: "ISSUE-XX: heartbeat — task 3/6 complete"
- Rule of thumb: if 5+ minutes since last message, send a heartbeat

### What Heartbeats Are NOT
- Heartbeats are status signals, not requests for input
- The orchestrator should NOT act on every heartbeat — accumulate and report at milestones
- Rapid idle notifications ≠ staleness (teammate is cycling turns)

## State File

The orchestrator tracks coordination state in a local JSON file (gitignored):

```json
{
  "created_at": "ISO timestamp",
  "wave_branch": "wave/milestone-w1",
  "wave_state": "implementing | all_merged | quality_wave | ready_for_review | merged_to_main",
  "tickets": {
    "ISSUE-XX": {
      "wave": 1,
      "ticket_state": "queued | dispatched | pr_ready | merged_to_wave",
      "agent_id": "...",
      "pr_number": null,
      "blocked_by": [],
      "last_heartbeat": "ISO timestamp"
    }
  }
}
```

### State Transitions
```
Ticket:  queued → dispatched → pr_ready → merged_to_wave
Wave:    implementing → all_merged → quality_wave → ready_for_review → merged_to_main
```

## Batching Small Tickets

Group multiple small tickets to a single teammate when:
- All are low-risk (bugfix or foundation profile)
- Combined effort < 45 minutes
- No dependencies between them

Batched tickets share one environment and produce one PR with per-ticket commits.

## Health Monitoring

### Stale Teammate Detection
1. **Active heartbeats**: Track last heartbeat timestamp
2. **Passive investigation**: If no heartbeat for 15+ minutes, check worktree activity (git log, file timestamps)
3. **Escalation**: Both layers cold for 15+ minutes → report to human with evidence

### Ground Rules
- Never re-dispatch without human approval (duplicates cause conflicts)
- Idle notifications are NOT staleness (rapid idle = teammate is working)
- When in doubt, investigate before killing

## Early Teardown

Once a teammate's PR merges to the wave branch, its environment is no longer needed. Signal teardown immediately — don't wait for the entire orchestration to conclude. This frees ports, databases, and worktrees for other agents.
