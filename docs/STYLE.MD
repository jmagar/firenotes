# Output Style Guide

**Status:** Canonical Source of Truth  
**Scope:** Formatting, styling, and structure for all tool output and tool descriptions.  
**Applies To:** Flux and Scout actions/subactions.

---

## 1. Purpose

This document is strictly about presentation.

Goals:

- Maximum glanceability
- Strong visual continuity
- Token-efficient output through formatting (not data hiding)
- Consistent output grammar across all actions/subactions

---

## 2. Non-Negotiable Principles

1. Show all important information.
2. Optimize scan speed first.
3. Keep wording compact and consistent.
4. Use one visual language everywhere.
5. Use Unicode intentionally for faster reading.

---

## 3. Global Output Structure

Unless an action template says otherwise, every response follows:

1. Title
2. Summary line(s) or summary box
3. Legend line (required for mixed states)
4. Request Echo line (required when filters/options are applied)
5. Result Freshness line (required for volatile data)
6. Main body (table/list/sections)
7. Warning/conflict block (if needed)

### 3.1 Title Format

- `⟪Entity⟫ on ⟪host⟫`
- `⟪Entity⟫ (all)`
- `⟪Operation⟫ for ⟪target⟫ on ⟪host⟫`

Examples:

- `Docker Containers on squirts`
- `Host Discovery (all)`
- `Container Logs for swag on squirts`

### 3.2 Summary Format

Use compact segments separated by `|`.

Examples:

- `Showing 20 of 41 containers | state: all`
- `Stacks found: 12 | Locations: 2`
- `Lines returned: 100 (requested: 100) | truncated: no | follow: no`
- `Hosts: 5 | OK: 3 | Warn: 1 | Fail: 1`

For dense outputs, prefer a boxed summary:

```text
┌ Summary ───────────────────────────┐
│ Total: 41 | Running: 38 | Down: 3 │
└────────────────────────────────────┘
```

For all-host operations, include a rollup line in the summary:

`Hosts: N | OK: N | Warn: N | Fail: N`

### 3.3 Legend Line (Mixed States)

If output includes mixed states, include this directly below summary:

`Legend: ● running  ◐ partial  ○ stopped  ⚠ warning  ✗ failed`

### 3.4 Section Headers

- Structural blocks: uppercase (`PORT MAPPINGS`, `LEVELS`, `RECLAIMED`)
- Semantic blocks: Title Case (`Top locations`, `Compose paths`)
- Long output sections should use dividers:
  - `── Top locations ──`
  - `── Stacks ──`

### 3.5 Request Echo (Filtered/Scoped Output)

If any filters/options affect output, include a single Request Echo line directly above the body.

Format:

`Filters: key=value, key=value, ...`

Example:

`Filters: state=running, host=squirts, limit=20`

### 3.6 Result Freshness (Volatile Output)

For volatile data (`logs`, `stats`, `resources`, `uptime`, discovery scans), include freshness timestamp line.

Format:

`As of (ET): HH:MM:SS | MM/DD/YYYY`

Example:

`As of (ET): 14:42:10 | 02/13/2026`

---

## 4. Canonical Symbol Set

### 4.1 Status and State

- `●` running/active/healthy
- `◐` partial/degraded/mixed
- `○` stopped/inactive
- `✓` success/enabled/available
- `✗` failure/disabled/unavailable
- `⚠` warning/conflict/risk
- `ℹ` info note

Optional text tags for non-Unicode or low-fidelity surfaces:

- `[critical]` for `✗`
- `[warn]` for `⚠` / `◐`
- `[ok]` for `✓` / `●`

### 4.2 Structural Symbols

- `→` mapping (`host→container/protocol`)
- `…` truncated continuation
- `+N` overflow count
- `—` unavailable/not present

### 4.3 Trend Symbols

- `↗` increasing
- `↘` decreasing
- `→` unchanged

Use trend symbols only when a before/after delta exists.

Do not use alternate symbols for the same meaning.

---

## 5. Alignment and Spacing

### 5.1 Tables

- Always include header row and divider row.
- Left-align text columns.
- Keep column order stable between calls.
- Empty result tables still render header + divider + one `—` row.

Canonical compact column abbreviations (use when width is constrained):

- `Svc` (Service)
- `Cnt` (Count)
- `Recs` (Recommendations)
- `En` (Enabled)
- `Dur` (Duration)
- `Lvl` (Level)

Template:

```text
Host         Address              ZFS Dataset
------------ -------------------- --- --------------------
squirts      squirts:22           ✓   rpool/appdata
```

Empty template:

```text
Host         OK ZFS Paths Recs
------------ -- --- ----- ----
—            —  —   —     —
```

### 5.2 Width and Truncation

- Name-like fields: 24-25 chars
- Project/service fields: 15-20 chars
- Status fields: 9-10 chars
- Truncate with `…`
- Overflow counts use `+N`

### 5.3 Missing Values

- Use `—` only
- Never use `-`, `N/A`, `null`, or blank placeholders

---

## 6. Token-Efficient Formatting Rules

1. Group repetitive items by a stable key.
2. Use compact previews for long lists.
3. Keep high-signal summaries near the top.
4. Do not bloat rows with repeated context.
5. Apply severity-first ordering for mixed-state tables.

Examples:

- Group ports by container
- Show first 2 services + `…`
- Show first 3 ports + `+N`
- Sort rows by severity: `⚠/✗` → `◐` → `●` → `○`

---

## 7. Canonical Output Templates

## 7.1 Port Mappings (`host:ports`)

```text
Port Usage on squirts
Found 82 exposed ports across 41 containers

Protocols: TCP: 78, UDP: 4
Port ranges: System: 14, User: 68, Dynamic: 0

PORT MAPPINGS:
  swag [swag]: 2002→22/tcp, 443→443/tcp, 80→80/tcp
  adguard [adguard]: 3000→3000/tcp, 53→53/tcp, 53→53/udp, 3010→80/tcp

⚠ Conflicts: 53/udp (2), 443/tcp (1)
```

Rules:

- One container per line
- Mapping format: `host→container/proto`
- Include project in brackets when available
- Conflicts must be grouped with counts (`port/proto (N)`)

## 7.2 Host Listings (`docker_hosts list`)

```text
Docker Hosts (7 configured)
Host         Address              ZFS Dataset
------------ -------------------- --- --------------------
tootie       tootie:29229         ✓   cache/appdata
shart        SHART:22             ✓   backup/appdata
squirts      squirts:22           ✓   rpool/appdata
vivobook-wsl vivobook-wsl:22      ✗   —
```

Rules:

- Count in title
- Always include ZFS indicator
- Missing dataset is `—`

## 7.3 Container Listings (`docker_container list`)

```text
Docker Containers on squirts
Showing 20 of 41 containers | state: all
Legend: ● running  ◐ restarting  ○ stopped

  Container                  Ports               Project
  -------------------------  ------------------- ---------------
◐ unstable-worker            8080,8081+1         infra
● swag-mcp                   8012                swag-mcp
○ elasticsearch              —                   syslog-mcp
```

Rules:

- Status marker at row start
- Ports show first 3 host ports then `+N`
- No ports shown as `—`
- Sort rows by severity: `⚠/✗` → `◐` → `●` → `○`

## 7.4 Stack Listings (`docker_compose list`)

```text
Docker Compose Stacks on squirts (28 total)
Status breakdown: running: 27, partial: 1
Legend: ● running  ◐ partial  ○ stopped

  Stack                      Status     Services
  -------------------------  ---------- -------------------------
◐ syslog-mcp                 partial    [3] syslog-ng,elasticsearch…
● swag-mcp                   running    [1] swag-mcp
● authelia                   running    [3] authelia,authelia-redis…
```

Rules:

- Include status breakdown near top
- Services start with `[N]`
- Show first 2 names, then `…`
- Sort rows by severity first

## 7.5 Logs (`container logs`, `compose logs`, `scout logs:*`)

```text
Container Logs for swag on squirts
Lines returned: 100 (requested: 100) | truncated: no | follow: no

Preview (first 5):
  [stdout] [..] line 1
  [stdout] [..] line 2
  [stderr] [..] line 3
  [stdout] [..] line 4
  [stderr] [..] line 5

Preview (last 5):
  [stdout] [..]
```

Rules:

- Preview-first format
- Include counts and flags
- Preserve stream/source context
- Prefix line stream when known (`[stdout]`, `[stderr]`)

## 7.6 Host CRUD Summaries

```text
Host added: prod (prod.example.com)
SSH: docker@prod.example.com:22 | tested: ✓
```

```text
Host updated: prod
Fields: ssh_user, ssh_port, zfs_capable
```

```text
Host removed: prod (prod.example.com)
```

```text
SSH OK: prod prod.example.com:22
Docker: 24.0.6
```

Rules:

- 1-2 lines, unless warning/error
- Updated fields listed explicitly

## 7.7 Compose Discovery (`docker_compose discover`)

```text
Compose Discovery on squirts
Stacks found: 12 | Locations: 2
Suggested compose_path: /mnt/user/compose

── Top locations ──
  /mnt/user/compose: 10 stacks
  /srv/compose: 2 stacks

── Stacks ──
  swag-mcp: /mnt/user/compose/swag-mcp
  syslog-mcp: /mnt/user/compose/syslog-mcp
  …
```

## 7.8 Cleanup Summaries (`docker_hosts cleanup`)

```text
Docker Cleanup (check) on squirts
Total reclaimable: 5.2 GB (23%)

LEVELS:
  safe: 1.1 GB (4%)
  moderate: 3.7 GB (16%)
  aggressive: 5.2 GB (23%)
```

```text
Docker Cleanup (safe) on squirts

RECLAIMED:
  containers: 512 MB
  networks: 0 B
  build cache: 1.3 GB
```

```text
Cleanup Schedules (2 total, 1 active)
Host         Type      Freq     Time  En
------------ --------- -------- ----- --
prod         safe      daily    02:00 ✓
test         moderate  weekly   03:30 ✗
```

## 7.9 Host Discovery (`docker_hosts discover`)

Single host:

```text
Host Discovery on squirts
Compose paths: 3 | Appdata paths: 2 | ZFS: ✓
ZFS dataset: rpool/appdata

── Compose paths ──
  /mnt/user/compose/swag-mcp
  /mnt/user/compose/syslog-mcp
  …

── Appdata paths ──
  /mnt/user/appdata
```

All hosts:

```text
Host Discovery (all)
Hosts: 5 | OK: 3 | Warn: 1 | Fail: 1 | ZFS-capable: 3 | Total paths: 27 | Recommendations: 8
Legend: ✓ healthy  ✗ unavailable

Host         OK ZFS Paths Recs
------------ -- --- ----- ----
prod         ✓  ✓   12    4
test         ✓  ✗   3     1
edge         ✗  ✗   0     0
```

---

## 8. Action-by-Action Styling

## 8.1 Flux `help`

- Title: `Flux Help`
- Group actions by family
- Mark destructive operations with `⚠`
- Include legend at end

## 8.2 Flux `container:*`

- `list/search`: status table sorted by severity
- `inspect`: summary block first, details second
- `stats`: compact metrics table (CPU/MEM/NET) + trend glyphs when available (`↗`, `↘`, `→`)
- `top`: process table
- `logs`: preview template from 7.5
- lifecycle (`start/stop/restart/pause/resume`): one-line result + final state
- `pull/recreate`: outcome + warnings if relevant
- `exec`: command + exit code + output preview

## 8.3 Flux `compose:*`

- `list`: stack table from 7.4, severity-sorted
- `status`: service-level status table, severity-sorted
- `up/down/restart/recreate`: concise impact summary
- `pull/build`: per-service result summary
- `logs`: preview template
- `refresh`: discovered/updated counts

## 8.4 Flux `docker:*`

- `info`: compact system card
- `df`: usage summary by category
- `images`: repo/tag/size/created table
- `pull`: image + digest + status
- `build`: tag + duration + cache note
- `rmi`: removed artifacts + dependency warning if needed
- `prune`: target + reclaimed amount + what removed
- `networks/volumes`: compact inventory table

## 8.5 Flux `host:*`

- `status`: quick health line
- `resources`: CPU/MEM/DISK summary blocks + trend glyphs when comparing snapshots
- `info`: OS/kernel/arch card
- `uptime`: uptime + load
- `services`: unit/state/enabled table, severity-sorted
- `network`: iface/IP table
- `mounts`: mount/device/fs/usage table
- `ports`: canonical port mapping style
- `doctor`: checklist with pass/warn/fail counts

## 8.6 Scout `help`

- Same style as Flux help

## 8.7 Scout simple actions

- `nodes`: host inventory table
- `peek`: file preview or tree summary
- `exec`: command + exit code + output preview
- `find`: matches + limits summary
- `delta`: diff header + line stats
- `emit`: per-target status rows
- `beam`: transfer summary (`source → destination`)
- `ps`: process table
- `df`: filesystem usage table

## 8.8 Scout `zfs:*`

- `pools`: pool health table
- `datasets`: used/avail/mountpoint table
- `snapshots`: snapshot listing table

## 8.9 Scout `logs:*`

- Use 7.5 template
- Include source-specific context (syslog/journal/dmesg/auth)

---

## 9. Tool Description Style

Tool descriptions must be consistent with runtime output tone.

Rules:

- Start with a direct capability sentence
- Provide a short “How to use” block
- Group operations by category
- Mark destructive operations with `⚠`
- End with a legend

Canonical legend:

```text
Legend:
● State-changing operation
⚠ Destructive operation (requires force: true)
✓ Diagnostic/health check
```

---

## 10. Error, Warning, and Empty States

## 10.1 Errors

```text
✗ <Operation> failed on <target>
Reason: <concise root cause>
Next: <actionable recovery hint>
```

## 10.2 Warnings

```text
⚠ <Warning summary>
Detail: <impact>
```

Threshold-triggered warnings are mandatory for resource metrics:

- Disk usage `> 85%` => `⚠`
- Memory usage `> 90%` => `⚠`
- CPU sustained `> 90%` (windowed metric) => `⚠`

## 10.3 Empty states

```text
No <resource> found on <scope>
Filters: <active filters>
```

Do not present empty result sets as failures.

If the empty state is tabular, render the empty table shell from section 5.1.

---

## 11. Numbers, Dates, and Units

- Bytes: `B`, `KB`, `MB`, `GB`, `TB`
- Percent: integer or one decimal (`23%`, `23.4%`)
- Duration: compact (`2m 13s`, `5h 2m`)
- Timestamps: use EST by default (not UTC/ISO)
- Canonical timestamp format: `HH:MM:SS | MM/DD/YYYY`

Rounding policy:

- `GB`/`MB`: 1 decimal place
- `KB`/`B`: integer
- Percentages: 1 decimal max

Trend examples when deltas exist:

- `CPU: 34% ↗`
- `Memory: 61% ↘`
- `Load: 1.22 →`

---

## 12. Ordering Defaults

Unless explicitly overridden:

- Stable deterministic ordering
- Severity-first ordering for mixed states: `⚠/✗` → `◐` → `●` → `○`
- Tie-breaker after severity: `name` ascending
- Discovery sections sorted by descending count
- Logs presented with first and last previews

Pagination footer standard (when truncated):

`Showing X–Y of Z | next_offset: N`

---

## 13. Continuity Rules

1. Same symbols everywhere (`●◐○✓✗⚠→…+N—↗↘`)
2. Same null marker everywhere (`—`)
3. Same title/summary/legend pattern everywhere
4. Same overflow/truncation rules everywhere
5. Same action/subaction naming everywhere
6. Same severity sort order everywhere

---

## 14. Compliance Checklist

A formatted response is compliant only if:

- It has a clear title
- It has at least one summary line (or boxed summary)
- It includes a legend line when mixed states appear
- It uses canonical symbols correctly
- It uses aligned tables/lists when applicable
- It uses `…` and `+N` consistently
- It surfaces warnings/conflicts explicitly
- It uses grouped conflict counts where conflicts repeat
- It preserves essential details without noisy repetition
- It applies deterministic tie-breakers after severity sort
- It includes pagination footer when results are truncated

---

## 15. Final Rule

Any new action/subaction must adopt the same formatting language before release.
