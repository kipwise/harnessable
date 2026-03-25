#!/usr/bin/env bun
/**
 * Harness Channel — interactive visual companion for harness engineering.
 *
 * Serves a screen queue in the browser. Works identically with or without MCP.
 *
 * Data paths:
 *   Agent → Browser:  write HTML files to SCREEN_DIR → file watcher → screen queue → browser
 *                      (or) reply tool via MCP → WebSocket broadcast → browser
 *   Browser → Agent:  click [data-choice] → WebSocket → events.jsonl + /events endpoint
 *                      (and if MCP connected) → mcp.notification → <channel> in Claude Code
 *   Screen advance:   confirm event → server auto-advances currentIndex → browser reloads
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch } from 'fs'
import { join, dirname, extname } from 'path'
import type { ServerWebSocket } from 'bun'

// ========== Configuration ==========

const PORT = Number(process.env.HARNESS_PORT ?? 0) // 0 = auto-assign
const SCREEN_DIR = process.env.HARNESS_SCREEN_DIR || join(process.cwd(), '.harness', 'screens')
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

// ========== State ==========

const clients = new Set<ServerWebSocket<unknown>>()
const screens: string[] = []   // ordered screen queue (HTML fragments)
let currentIndex = 0           // which screen is showing
const events: Record<string, unknown>[] = [] // captured browser events
let lastActivity = Date.now()
let browserOpened = false
const EVENTS_FILE = join(dirname(SCREEN_DIR), 'events.jsonl')

function touchActivity() {
  lastActivity = Date.now()
}

function broadcast(msg: Record<string, unknown>) {
  const data = JSON.stringify(msg)
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data)
  }
}

// ========== MCP Server ==========

const mcp = new Server(
  { name: 'harness', version: '1.0.0' },
  {
    capabilities: { tools: {}, experimental: { 'claude/channel': {} } },
    instructions: [
      'This is the harness channel — an interactive visual companion for harness engineering.',
      '',
      'User interactions from the harness UI arrive as <channel source="harness" type="...">.',
      'The type attribute tells you what kind of interaction it is:',
      '  - phase_toggle: user toggled a phase on/off',
      '  - concept_decision: user adopted/deferred/dismissed a concept',
      '  - confirm: user confirmed a step (check the step attribute)',
      '  - answer: user answered a question',
      '',
      'Use the reply tool to push content to the browser:',
      '  - reply({ type: "screen", html: "..." }) — replace the entire content area',
      '  - reply({ type: "status", text: "..." }) — update the status bar',
      '  - reply({ type: "update", html: "..." }) — append to the update zone',
      '',
      'HTML content supports interactive elements:',
      '  - [data-choice="value"] — clickable element that sends a channel event',
      '  - [data-event-type="type"] — sets the channel event type (default: "choice")',
      '  - data-multiselect on container — allows multiple selections',
      '  - onclick="toggleSelect(this)" — handles selection UI',
      '',
      `The UI is at http://localhost:[auto].`,
    ].join('\n'),
  },
)

// ========== Tools ==========

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description:
        'Send content to the harness browser UI. Use type "screen" to replace the page, "status" to update the status bar, or "update" to append to the update zone.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['screen', 'status', 'update'],
            description: 'screen = full content replacement, status = status bar text, update = append to update zone',
          },
          text: { type: 'string', description: 'Text content (for status type)' },
          html: { type: 'string', description: 'HTML content (for screen and update types)' },
        },
        required: ['type'],
      },
    },
  ],
}))

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>
  try {
    if (req.params.name === 'reply') {
      const type = args.type as string
      const text = (args.text as string) ?? ''
      const html = (args.html as string) ?? ''

      if (type === 'screen') {
        screens.push(html)
        currentIndex = screens.length - 1
        maybeOpenBrowser()
      }

      broadcast({ type, text, html })
      touchActivity()
      return { content: [{ type: 'text', text: `Sent ${type} to browser` }] }
    }
    return {
      content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }],
      isError: true,
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `${req.params.name}: ${err instanceof Error ? err.message : err}` }],
      isError: true,
    }
  }
})

// ========== Event Capture (Browser → Agent) ==========

function captureEvent(eventType: string, content: string, extra?: Record<string, string>) {
  const event = { type: eventType, content, ...extra, ts: Date.now() }
  events.push(event)
  try {
    appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n')
  } catch { /* events dir may not exist yet — non-fatal */ }

  // Auto-advance screen on confirm (Continue/Generate button clicks)
  if (eventType === 'confirm' && currentIndex < screens.length - 1) {
    currentIndex++
    broadcast({ type: 'reload' })
  }
}

function deliver(eventType: string, content: string, extra?: Record<string, string>) {
  captureEvent(eventType, content, extra)
  void mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content,
      meta: { type: eventType, ...extra },
    },
  })
}

// ========== Connect MCP ==========

await mcp.connect(new StdioServerTransport())

// ========== Browser Auto-Open ==========

function maybeOpenBrowser() {
  if (browserOpened) return
  browserOpened = true
  const url = `http://localhost:${httpServer.port}`
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  Bun.spawn([cmd, url], { stdio: ['ignore', 'ignore', 'ignore'] })
}

// ========== HTTP + WebSocket Server ==========

const httpServer = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  fetch(req, server) {
    const url = new URL(req.url)
    touchActivity()

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return
      return new Response('upgrade failed', { status: 400 })
    }

    // Main page — frame template
    if (url.pathname === '/') {
      return new Response(FRAME_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    // Current screen content (fetched by client JS)
    if (url.pathname === '/screen') {
      return new Response(screens[currentIndex] || WAITING_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    // Captured events (agent reads these when MCP channel is not available)
    if (url.pathname === '/events') {
      return Response.json(events, {
        headers: { 'access-control-allow-origin': '*' },
      })
    }

    // Static files from screen dir
    if (url.pathname.startsWith('/files/')) {
      const f = url.pathname.slice(7)
      if (f.includes('..') || f.includes('/')) return new Response('bad', { status: 400 })
      try {
        const filePath = join(SCREEN_DIR, f)
        return new Response(readFileSync(filePath), {
          headers: { 'content-type': mime(extname(f).toLowerCase()) },
        })
      } catch {
        return new Response('404', { status: 404 })
      }
    }

    return new Response('404', { status: 404 })
  },
  websocket: {
    open(ws) {
      clients.add(ws)
    },
    close(ws) {
      clients.delete(ws)
    },
    message(_ws, raw) {
      try {
        const event = JSON.parse(String(raw)) as Record<string, string>
        touchActivity()

        const eventType = event.event_type || event.type || 'choice'
        const choice = event.choice || ''
        const text = event.text || ''

        // Format human-readable content for the channel event
        let content = ''
        if (eventType === 'phase_toggle') {
          const [, phase] = choice.split(':')
          content = `Phase: ${phase}\nSelected: ${event.selected}`
        } else if (eventType === 'concept_decision') {
          const [action, concept] = choice.split(':')
          content = `Concept: ${concept}\nAction: ${action}`
        } else if (eventType === 'confirm') {
          const [, step] = choice.split(':')
          content = `Step: ${step}\nAll selections confirmed.`
        } else if (eventType === 'answer') {
          content = `Question: ${event.question || choice}\nAnswer: ${text}`
        } else {
          content = `Choice: ${choice}\n${text}`
        }

        deliver(eventType, content, { choice })
      } catch {
        // Ignore malformed messages
      }
    },
  },
})

process.stderr.write(`harness: http://localhost:${httpServer.port}\n`)

// ========== File Watcher + Screen Queue ==========

if (!existsSync(SCREEN_DIR)) mkdirSync(SCREEN_DIR, { recursive: true })

// Load existing screen files on startup (sorted by filename for deterministic order)
function loadScreensFromDir() {
  const files = readdirSync(SCREEN_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort() // 01-intro.html, 02-assessment.html, 03-selection.html
  const loaded: string[] = []
  for (const f of files) {
    loaded.push(readFileSync(join(SCREEN_DIR, f), 'utf-8'))
  }
  return loaded
}

const knownFiles = new Set(
  readdirSync(SCREEN_DIR).filter((f) => f.endsWith('.html')),
)

// Pre-populate screen queue from existing files
const initialScreens = loadScreensFromDir()
if (initialScreens.length > 0) {
  screens.push(...initialScreens)
  maybeOpenBrowser()
}

try {
  watch(SCREEN_DIR, (_, filename) => {
    if (!filename?.endsWith('.html')) return
    const filePath = join(SCREEN_DIR, filename)
    if (!existsSync(filePath)) return
    touchActivity()

    if (!knownFiles.has(filename)) {
      // New file — add to queue
      knownFiles.add(filename)
      screens.push(readFileSync(filePath, 'utf-8'))
      // If this is the first screen, show it
      if (screens.length === 1) {
        currentIndex = 0
        maybeOpenBrowser()
      }
      broadcast({ type: 'reload' })
    } else {
      // Existing file changed — rebuild queue from disk to preserve order
      const fresh = loadScreensFromDir()
      screens.length = 0
      screens.push(...fresh)
      broadcast({ type: 'reload' })
    }
  })
} catch {
  // File watching is optional — reply tool is the primary mechanism
}

// ========== Idle Timeout ==========

const idleCheck = setInterval(() => {
  if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
    process.stderr.write('harness: idle timeout, shutting down\n')
    clearInterval(idleCheck)
    process.exit(0)
  }
}, 60_000)
idleCheck.unref()

// ========== MIME Types ==========

function mime(ext: string) {
  const m: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
    '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  }
  return m[ext] ?? 'application/octet-stream'
}

// ========== Embedded HTML ==========

const WAITING_HTML = `
<div style="display:flex;align-items:center;justify-content:center;min-height:70vh;flex-direction:column;gap:1.5rem;opacity:0;animation:fadeUp 0.6s ease forwards">
  <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent-dim));display:flex;align-items:center;justify-content:center">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" stroke-width="2" stroke-linecap="round"><path d="M12 2v4m0 12v4m-7.07-15.07l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
  </div>
  <div style="text-align:center">
    <h2 style="color:var(--text-primary);font-size:1.25rem;margin-bottom:0.35rem">Harness Companion</h2>
    <p style="color:var(--text-tertiary);font-size:0.85rem;margin:0">Waiting for the agent to begin...</p>
  </div>
  <div style="width:20px;height:20px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite"></div>
</div>
<style>@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}</style>`

const HELPER_JS = `
(function() {
  const ws = new WebSocket('ws://' + location.host + '/ws');
  let ready = false;
  const queue = [];

  function send(event) {
    event.timestamp = Date.now();
    if (ready) ws.send(JSON.stringify(event));
    else queue.push(event);
  }

  ws.onopen = () => {
    ready = true;
    queue.forEach(e => ws.send(JSON.stringify(e)));
    queue.length = 0;
    document.getElementById('conn-status').textContent = 'connected';
    document.getElementById('conn-dot').classList.add('live');
  };

  ws.onclose = () => {
    ready = false;
    document.getElementById('conn-status').textContent = 'reconnecting';
    document.getElementById('conn-dot').classList.remove('live');
    setTimeout(() => location.reload(), 1000);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'reload') {
      fetch('/screen').then(r => r.text()).then(html => {
        document.getElementById('content').innerHTML = html;
        bindHandlers();
      });
      return;
    }

    if (msg.type === 'screen') {
      document.getElementById('content').innerHTML = msg.html;
      bindHandlers();
      return;
    }

    if (msg.type === 'status') {
      const bar = document.getElementById('status-text');
      bar.textContent = msg.text;
      bar.style.color = 'var(--accent)';
      // Also update the footer indicator with the status
      const indicator = document.getElementById('indicator-text');
      if (indicator) {
        indicator.innerHTML = '<span style="color:var(--accent);font-weight:500">' + msg.text + '</span>';
      }
      return;
    }

    if (msg.type === 'update') {
      const zone = document.getElementById('update-zone');
      zone.innerHTML += msg.html;
      zone.scrollTop = zone.scrollHeight;
      return;
    }
  };

  // Bind click handlers for [data-choice] elements
  function bindHandlers() {
    document.querySelectorAll('[data-choice]').forEach(el => {
      if (el.dataset.bound) return;
      el.dataset.bound = 'true';
      el.addEventListener('click', () => {
        toggleSelect(el);
        const eventType = el.dataset.eventType || 'choice';
        const choiceText = el.textContent.trim().substring(0, 200);
        send({
          type: eventType,
          event_type: eventType,
          choice: el.dataset.choice,
          text: choiceText,
          selected: el.classList.contains('selected') ? 'true' : 'false',
          question: el.dataset.question || '',
        });
        const label = el.querySelector('h3')?.textContent?.trim() || el.dataset.choice || choiceText.substring(0, 40);
        updateIndicator(label);
      });
    });
  }

  // Selection management
  window.toggleSelect = function(el) {
    const container = el.closest('.options, .cards');
    const multi = container && container.dataset.multiselect !== undefined;
    if (container && !multi) {
      container.querySelectorAll('.option, .card').forEach(o => o.classList.remove('selected'));
    }
    el.classList.toggle('selected');
  };

  function updateIndicator(action) {
    const indicator = document.getElementById('indicator-text');
    if (!indicator) return;
    if (action) {
      indicator.innerHTML = '<span style="color:var(--success);font-weight:500">✓ ' + action + '</span>';
    }
  }

  // Initial bind
  fetch('/screen').then(r => r.text()).then(html => {
    document.getElementById('content').innerHTML = html;
    bindHandlers();
  });

  // Expose API
  window.harness = { send, toggleSelect };
})();`

const FRAME_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Harness</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }

  :root {
    --bg-primary: #0b0d11;
    --bg-secondary: #12151c;
    --bg-tertiary: #1a1e28;
    --bg-elevated: #1f2430;
    --border: #1e2230;
    --border-strong: #2a3040;
    --text-primary: #e8eaf0;
    --text-secondary: #7c8299;
    --text-tertiary: #4d5368;
    --accent: #e2a84b;
    --accent-dim: #c48a2a;
    --accent-glow: rgba(226,168,75,0.08);
    --accent-glow-strong: rgba(226,168,75,0.15);
    --success: #4ade80;
    --success-dim: rgba(74,222,128,0.1);
    --warning: #fbbf24;
    --warning-dim: rgba(251,191,36,0.1);
    --error: #f87171;
    --error-dim: rgba(248,113,113,0.1);
    --info: #60a5fa;
    --info-dim: rgba(96,165,250,0.1);
    --selected-bg: var(--accent-glow-strong);
    --selected-border: var(--accent);
    --font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
    --radius: 10px;
    --radius-lg: 14px;
  }

  body {
    font-family: var(--font-body);
    background: var(--bg-primary);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    line-height: 1.65;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
  }

  /* ===== FRAME: HEADER ===== */
  .header {
    background: var(--bg-secondary);
    padding: 0 1.75rem;
    height: 44px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .header .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .header .brand-icon {
    width: 22px; height: 22px;
    border-radius: 5px;
    background: linear-gradient(135deg, var(--accent), var(--accent-dim));
    display: flex; align-items: center; justify-content: center;
  }
  .header .brand-icon svg { width: 12px; height: 12px; }
  .header h1 {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .header .conn {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--text-tertiary);
  }
  .header .conn-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--text-tertiary);
    transition: background 0.3s;
  }
  .header .conn-dot.live { background: var(--success); box-shadow: 0 0 6px var(--success); }

  /* ===== FRAME: STATUS BAR ===== */
  .status-bar {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 0 1.75rem;
    height: 32px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .status-bar span {
    font-size: 0.78rem;
    font-family: var(--font-mono);
    color: var(--text-tertiary);
    transition: color 0.2s;
  }

  /* ===== FRAME: MAIN CONTENT ===== */
  .main {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
  .main::-webkit-scrollbar { width: 6px; }
  .main::-webkit-scrollbar-track { background: transparent; }
  .main::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

  #content {
    padding: 2.5rem 2rem 4rem;
    max-width: 720px;
    margin: 0 auto;
    min-height: 100%;
  }

  /* ===== FRAME: UPDATE ZONE ===== */
  #update-zone {
    max-height: 160px;
    overflow-y: auto;
    padding: 0;
    font-size: 0.82rem;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    border-top: 1px solid var(--border);
    display: none;
    background: var(--bg-secondary);
  }
  #update-zone:not(:empty) { display: block; padding: 0.75rem 1.75rem; }

  /* ===== FRAME: FOOTER ===== */
  .indicator-bar {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 0 1.75rem;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .indicator-bar span {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-tertiary);
    transition: color 0.2s;
  }

  /* ===== TYPOGRAPHY ===== */
  h2 {
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 0.4rem;
    color: var(--text-primary);
  }
  h3 {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 0.3rem;
    color: var(--text-primary);
  }
  h4 {
    font-size: 0.82rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }
  p {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.7;
  }
  .subtitle {
    color: var(--text-tertiary);
    font-size: 0.95rem;
    margin-bottom: 2rem;
  }
  strong { color: var(--text-primary); font-weight: 600; }

  /* ===== OPTIONS (clickable choices) ===== */
  .options { display: flex; flex-direction: column; gap: 0.6rem; }
  .option {
    background: var(--bg-secondary);
    border: 1.5px solid var(--border-strong);
    border-radius: var(--radius);
    padding: 1rem 1.15rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    position: relative;
  }
  .option::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius);
    opacity: 0;
    background: var(--accent-glow);
    transition: opacity 0.2s;
    pointer-events: none;
  }
  .option:hover { border-color: var(--accent-dim); }
  .option:hover::after { opacity: 1; }
  .option:active { transform: scale(0.995); }
  .option.selected {
    background: var(--selected-bg);
    border-color: var(--selected-border);
  }
  .option .letter {
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    width: 2rem; height: 2rem;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 600; font-size: 0.8rem; flex-shrink: 0;
    font-family: var(--font-mono);
    transition: all 0.2s;
  }
  .option.selected .letter {
    background: var(--accent);
    color: var(--bg-primary);
  }
  .option .content { flex: 1; min-width: 0; }
  .option .content h3 { font-size: 0.92rem; margin-bottom: 0.1rem; }
  .option .content p { color: var(--text-tertiary); font-size: 0.82rem; margin: 0; line-height: 1.5; }

  /* ===== CARDS ===== */
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; }
  .card {
    background: var(--bg-secondary);
    border: 1.5px solid var(--border-strong);
    border-radius: var(--radius-lg);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.25s ease;
    position: relative;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
    opacity: 0;
    background: var(--accent-glow);
    transition: opacity 0.25s;
    pointer-events: none;
  }
  .card:hover { border-color: var(--accent-dim); transform: translateY(-2px); }
  .card:hover::before { opacity: 1; }
  .card.selected { border-color: var(--selected-border); }
  .card-body { padding: 1.1rem 1.15rem; position: relative; }
  .card-body h3 { margin-bottom: 0.2rem; font-size: 0.95rem; }
  .card-body p { color: var(--text-tertiary); font-size: 0.82rem; margin: 0; }

  /* ===== BADGES ===== */
  .badge {
    display: inline-block;
    padding: 0.15em 0.55em;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 600;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }
  .badge-green { background: var(--success-dim); color: var(--success); }
  .badge-amber { background: var(--warning-dim); color: var(--warning); }
  .badge-red { background: var(--error-dim); color: var(--error); }
  .badge-blue { background: var(--info-dim); color: var(--info); }

  /* ===== MOCKUP CONTAINER ===== */
  .mockup {
    background: var(--bg-secondary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: 1.5rem;
  }
  .mockup-header {
    background: var(--bg-tertiary);
    padding: 0.45rem 1rem;
    font-size: 0.72rem;
    font-family: var(--font-mono);
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .mockup-header::before {
    content: '';
    display: inline-flex;
    gap: 5px;
  }
  .mockup-body { padding: 1.5rem; }

  /* ===== SPLIT VIEW ===== */
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 700px) { .split { grid-template-columns: 1fr; } }

  /* ===== PROS/CONS ===== */
  .pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 1rem 0; }
  .pros, .cons {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
  }
  .pros { border-left: 3px solid var(--success); }
  .cons { border-left: 3px solid var(--error); }
  .pros h4 { color: var(--success); }
  .cons h4 { color: var(--error); }
  .pros ul, .cons ul { font-size: 0.85rem; color: var(--text-secondary); }

  /* ===== BUTTONS ===== */
  .btn {
    font-family: var(--font-body);
    background: var(--accent);
    color: var(--bg-primary);
    border: none;
    padding: 0.65rem 1.6rem;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    letter-spacing: 0.01em;
  }
  .btn:hover {
    background: var(--accent-dim);
    box-shadow: 0 0 20px var(--accent-glow);
  }
  .btn:active { transform: scale(0.97); }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 500;
  }
  .btn-secondary:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
    box-shadow: none;
  }

  /* ===== TABLES ===== */
  table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; }
  th, td {
    text-align: left;
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.88rem;
  }
  th {
    color: var(--text-tertiary);
    font-weight: 600;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-mono);
  }
  td { color: var(--text-secondary); }

  /* ===== ARCHITECTURE DIAGRAM ===== */
  .arch {
    background: var(--bg-secondary);
    border: 1px solid var(--border-strong);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    padding: 1.25rem 1.5rem;
    margin: 1.5rem 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.8;
  }
  .arch-line {
    padding: 0.15rem 0 0.15rem 1.25rem;
    border-left: 1px solid var(--border-strong);
    color: var(--text-tertiary);
  }
  .arch-line.top {
    border-left: none;
    padding-left: 0;
    color: var(--accent);
    font-weight: 600;
  }

  /* ===== SECTION SPACING ===== */
  .section { margin-bottom: 2.5rem; }
  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-strong), transparent);
    margin: 2.5rem 0;
  }

  /* ===== LISTS ===== */
  ul { padding-left: 1.25rem; margin: 0.5rem 0; }
  li {
    margin: 0.4rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }
  li strong { color: var(--text-primary); }
  li::marker { color: var(--text-tertiary); }

  /* ===== CODE ===== */
  code {
    font-family: var(--font-mono);
    background: var(--bg-tertiary);
    padding: 0.18em 0.45em;
    border-radius: 4px;
    font-size: 0.82em;
    color: var(--accent);
  }
  pre {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.7;
    color: var(--text-secondary);
    margin: 1rem 0;
  }

  /* ===== ANIMATIONS ===== */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  #content > * {
    animation: fadeUp 0.35s ease forwards;
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 640px) {
    #content { padding: 1.5rem 1.25rem 3rem; }
    h2 { font-size: 1.35rem; }
    .cards { grid-template-columns: 1fr; }
    .pros-cons { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v4m0 12v4m-7.07-15.07l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4"/></svg></div>
      <h1>Harness</h1>
    </div>
    <div class="conn"><span class="conn-dot" id="conn-dot"></span><span id="conn-status">connecting</span></div>
  </div>
  <div class="status-bar"><span id="status-text">ready</span></div>
  <div class="main"><div id="content"></div></div>
  <div id="update-zone"></div>
  <div class="indicator-bar"><span id="indicator-text">ready</span></div>
  <script>${HELPER_JS}</script>
</body>
</html>`
