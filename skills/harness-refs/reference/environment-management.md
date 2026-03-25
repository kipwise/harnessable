# Environment Management

Isolated development environments for parallel agent work.

## Why Isolation?

When multiple agents work simultaneously, they need isolated environments to avoid conflicts:
- Code changes in one feature don't affect another
- Database state is independent per feature
- Dev servers run on separate ports
- Cleanup is deterministic — remove one environment without affecting others

## Git Worktrees

Git worktrees provide code isolation without the overhead of full clones.

### Setup
```bash
# Create worktree from the base branch
git worktree add ../project-feat-issue-123 -b feat/issue-123 origin/main

# Or from a wave branch
git worktree add ../project-feat-issue-123 -b feat/issue-123 origin/wave/milestone-w1
```

### Naming Convention
```
../<project-name>-<branch-type>-<issue-id>
```

### Cleanup
```bash
git worktree remove ../project-feat-issue-123
git branch -d feat/issue-123
```

## Database Isolation

For projects with databases, each feature gets its own database instance:

### PostgreSQL
```bash
createdb myproject_feat_123
# Run migrations
DATABASE_URL="postgresql://localhost/myproject_feat_123" <migration-command>
```

### SQLite
```bash
# Just use a different file path
DATABASE_URL="file:./data/myproject_feat_123.db"
```

### Cleanup
```bash
dropdb myproject_feat_123
```

## Port Management

Each dev server needs a unique port to avoid collisions:

### Strategy: Offset from Base
```
Base port: 3000
Feature 1: 3001
Feature 2: 3002
...
```

### Discovery
```bash
# Find an available port
lsof -i :3001  # Check if port is in use
```

### Record
Store the assigned port in a `.dev-state` file in the worktree root:
```bash
echo "DEV_PORT=3001" > .dev-state
echo "DB_NAME=myproject_feat_123" >> .dev-state
echo "DEV_PID=$$" >> .dev-state
```

## Environment Variables

### Strategy
Copy the project's `.env.example` or `.env.local` to the worktree, then override:
- `DATABASE_URL` → point to isolated database
- `PORT` → use assigned port
- Any service-specific URLs that need isolation

### Template
```bash
cp .env.example .env.local
# Override with feature-specific values
echo "DATABASE_URL=postgresql://localhost/myproject_feat_123" >> .env.local
echo "PORT=3001" >> .env.local
```

## Health Check

After environment setup, verify everything works:

1. **Dependencies installed**: Run the install command, confirm no errors
2. **Database accessible**: Run a simple query (e.g., `SELECT 1`)
3. **Dev server starts**: Start the server and confirm it responds
4. **Tests pass**: Run the test suite to confirm baseline is green

Only proceed to implementation after the health check passes.

## Teardown Protocol

Deterministic cleanup when work is complete:

1. **Stop dev server**: Kill the process using the PID from `.dev-state`
2. **Drop database**: Remove the isolated database
3. **Remove worktree**: `git worktree remove <path>`
4. **Delete branch**: `git branch -d <branch>` (local only — remote branch lives in the PR)
5. **Verify**: Confirm no zombie processes, no orphaned databases

### When to Teardown
- **After PR merge to wave branch**: Environment is no longer needed (code is in the wave branch)
- **After PR merge to main**: If not using wave branches
- **On abandonment**: If the work is cancelled or reassigned

### Zombie Detection
```bash
# Find orphaned dev servers
lsof -i :3001-3010

# Find orphaned databases
psql -lqt | grep myproject_feat
```

## Monorepo Considerations

For monorepos with build caching (turbo, nx):
- Each worktree has its own node_modules (pnpm is fast at linking)
- Build cache may not be shared across worktrees — expect cold builds
- Use `--force` flag after editing config files to bypass stale cache
- Verify internal package builds complete before running the dev server
