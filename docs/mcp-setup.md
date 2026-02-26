# MCP Setup (Supabase)

## Current DonateCrate MCP Target

- MCP server name: `supabase-donatecrate`
- Project ref: `xwukslimpjoyzjswctcj`
- URL: `https://mcp.supabase.com/mcp?project_ref=xwukslimpjoyzjswctcj`
- Active Supabase MCP entries expected in global config: only `supabase-donatecrate`.

## 1) Add/Update MCP Server

```bash
codex mcp remove supabase-donatecrate || true
codex mcp remove supabase-playon || true
codex mcp remove supabase-tracthrift || true
codex mcp add supabase-donatecrate --url "https://mcp.supabase.com/mcp?project_ref=xwukslimpjoyzjswctcj"
codex mcp list
```

## 2) Authenticate (OAuth)

```bash
codex mcp login supabase-donatecrate
```

This prints an authorization URL. Open it in your browser and complete Supabase auth.

## 3) Verify Access

Run in Codex after OAuth succeeds:

```bash
codex mcp get supabase-donatecrate
```

Then inside a Codex session, list resources/templates against `supabase-donatecrate`.

## 4) Troubleshooting

- `Address already in use (os error 48)`:
  - Another login process is holding callback port `6274`.
  - Find and stop it:

```bash
lsof -nP -iTCP:6274 -sTCP:LISTEN
kill <PID>
```

- `Auth required` or OAuth refresh errors:
  - Run `codex mcp login supabase-donatecrate` again.

- New MCP server not visible in an already-running Codex chat:
  - Start a new session/thread after adding servers in global config.
  - Existing threads may still reference the previous server list.
