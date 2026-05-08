# MusallahBoard Production Plan

Path from the current PoC (hosted Vite site + `setup.sh`-hardened Pi kiosk) to a
production fleet with per-device identity, remote control from the admin
portal, granular per-board configuration, and offline resilience.

## Goals

1. **Granular per-board config** — frame ordering, scrolling messages, dark-mode
   rules, weather coords, etc. configurable per physical device, not just per
   `boardLocation`.
2. **Each board as its own entity in the admin portal** — a Boards tab with
   live status, telemetry, and per-device config.
3. **Direct Pi control from the admin portal** — refresh, restart kiosk,
   reboot, screenshot, change URL, brightness/display power.
4. **Offline-after-first-boot** — keep showing yesterday's payload through
   short network outages.

## Non-goals

- Replacing `setup.sh`. It's already production-grade Pi hardening; agent
  install is appended to it.
- Replacing the hosted Vite site. UI continues to deploy as a static site.
- Electron. Service worker covers offline; agent covers control plane.
- mTLS for the control plane. HMAC over a per-device secret is sufficient and
  much simpler to operate. mTLS is a future drop-in upgrade if needed.

## Repository scope

The real admin UI lives in the separate `utmmsa-pwa` repo
(`src/pages/AdminPage.tsx`). "Admin portal" everywhere in this document
refers to the `utmmsa-pwa` admin page.

The defunct admin/signin code that previously lived in this repo
(`admin/`, `signin/`, `js/admin.js`, `js/signin.js`, `js/auth.js`,
`js/data.js`, `js/services/`, `css/admin.css`) has been removed. The
`vite.config.js` MPA config and `friendlyRoutePlugin` redirect were
removed at the same time. This repo is now solely the kiosk display.

## Architecture

Three pieces, two control channels.

```
┌─────────────────────┐                ┌─────────────────────┐
│  Hosted Vite site   │ ◄─frontend WS─►│                     │
│  (board.lensbridge) │                │                     │
│  + service worker   │ ◄──HTTP fetch──┤                     │
└─────────┬───────────┘                │                     │
          │ rendered in                │      Backend        │
          ▼                            │                     │
┌─────────────────────┐                │  Device entity      │
│   Chromium kiosk    │                │  DeviceConfig       │
│   (labwc, on Pi)    │                │  Command audit log  │
└─────────▲───────────┘                │                     │
          │ DevTools Protocol          │                     │
          │ on 127.0.0.1:9222          │                     │
┌─────────┴───────────┐                │                     │
│  Device agent       │ ◄───agent WS──►│                     │
│  (Go, systemd)      │                │                     │
│  HMAC + heartbeat   │ ◄───HTTP POST──┤                     │
└─────────────────────┘                └─────────────────────┘
```

**Frontend WS** carries content/config updates (`payload-updated`,
`config-updated`, `refresh`). Already half-built (`js/app.js:664`); needs
`deviceId` scoping.

**Agent WS** carries Pi-level commands (reboot, restart kiosk, screenshot, set
URL, brightness, display power). New.

The split keeps the agent small and audit-able. Content edits don't need
elevated privileges, so they don't touch the agent.

## What flows where

| Operation | Channel | Notes |
|---|---|---|
| Add/edit poster, event, jummah slot | Backend HTTP, then frontend WS push | Hot-applied, no reload |
| Change scrolling message / frame order on one board | Frontend WS push | Per-device config update |
| Force full page reload | Frontend WS | Existing `REFRESH` message |
| Refresh without reload | Agent WS → CDP `Page.reload` | Fallback if frontend WS dead |
| Restart Chromium | Agent WS → `systemctl restart musallahboard-kiosk.service` | |
| Reboot / shutdown Pi | Agent WS → sudoers-allowed binary | |
| Take screenshot | Agent WS → `grim` → upload | |
| Change kiosk URL | Agent WS → rewrite `url.txt` + restart kiosk | |
| Brightness / display power | Agent WS → `vcgencmd display_power` / `wlr-randr` | |

## Component plan

### 1. Service worker (offline)

In the existing Vite app, using `vite-plugin-pwa` (Workbox under the hood).

- Precache app shell (HTML/CSS/JS/fonts/logo).
- Stale-while-revalidate `/api/musallah/payload`.
- Cache-first for poster images, capped by count + max-age.
- Network-first with cache fallback for prayer times.
- Optional: replace remote prayer-times API with `adhan-js` for fully-local
  computation.

Independent of the agent work. Ship anytime.

### 2. Device agent (`musallahboard-agent`)

Go, single static `arm64` binary, ~10MB. Runs as `admin` user under systemd
with a narrow sudoers allowlist.

**Project layout:**

```
musallahboard-agent/
  cmd/agent/main.go              // wiring, signal handling
  internal/
    config/                      // /etc/musallahboard/agent.toml load/save
    enroll/                      // one-time token → device credentials
    transport/                   // HTTP + WS clients with HMAC signing
    telemetry/                   // metric collectors
    commands/                    // dispatcher + one file per command type
    kiosk/                       // CDP client, url.txt management
    sysctl/                      // narrow wrappers around sudoers-allowed cmds
  packaging/
    musallahboard-agent.service  // systemd unit
    musallahboard-agent.sudoers  // sudoers.d allowlist
    nfpm.yaml                    // .deb packaging config
  Makefile                       // cross-compile + package
```

**Identity:** `/etc/musallahboard/agent.toml`, mode 0600, root-owned,
admin-readable. Contains `deviceId` (UUID) and `deviceSecret` (HMAC key).
Survives kiosk-user wipes; independent of cookies.

**systemd unit** (`musallahboard-agent.service`):

```ini
[Unit]
Description=MusallahBoard device agent
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
User=admin
ExecStart=/usr/local/bin/musallahboard-agent
Restart=always
RestartSec=5

# Crash-loop guard: if the agent fails to start 5 times in 60s,
# stop trying. Prevents a bad agent update from death-looping and
# eating CPU / filling logs across the fleet.
StartLimitBurst=5
StartLimitIntervalSec=60

NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/etc/musallahboard /var/lib/musallahboard /var/log/musallahboard
ProtectKernelTunables=yes
ProtectKernelModules=yes
RestrictSUIDSGID=yes
LockPersonality=yes
WatchdogSec=60s

[Install]
WantedBy=multi-user.target
```

**Sudoers allowlist** (`/etc/sudoers.d/musallahboard-agent`, mode 0440):

```
admin ALL=(root) NOPASSWD: /sbin/reboot
admin ALL=(root) NOPASSWD: /sbin/shutdown -h now
admin ALL=(root) NOPASSWD: /bin/systemctl restart musallahboard-kiosk.service
admin ALL=(root) NOPASSWD: /bin/systemctl stop musallahboard-kiosk.service
admin ALL=(root) NOPASSWD: /bin/systemctl start musallahboard-kiosk.service
admin ALL=(root) NOPASSWD: /usr/bin/vcgencmd display_power 0
admin ALL=(root) NOPASSWD: /usr/bin/vcgencmd display_power 1
```

Exact paths, exact args. No wildcards on dangerous commands.

**Key dependencies:**

- `nhooyr.io/websocket` (or `gorilla/websocket`) for the command channel
- `github.com/coreos/go-systemd/v22` for sd_notify + journal
- `github.com/chromedp/chromedp` for Chromium DevTools Protocol
- `github.com/BurntSushi/toml` for config

**Things to get right:**

- `exec.Command(name, args...)` — never shell out with string concat.
- Atomic state writes (`*.tmp` + fsync + rename).
- WS reconnect with exponential backoff + jitter.
- Idempotency ring buffer of last 100 command IDs.
- Redact `deviceSecret` from all logs.
- `exec.CommandContext` with timeouts for long-running commands.
- Log to stdout; let journald handle persistence.
- **Safe mode after repeated crashes.** On startup the agent checks a
  `/var/lib/musallahboard/crash-counter` file. If it shows ≥3 consecutive
  failed runs (no clean exit recorded), boot in heartbeat-only mode:
  enroll if needed, send heartbeats with a `safeMode: true` flag, but
  refuse to execute any commands. This complements systemd's
  `StartLimitBurst` — that stops the death-loop, this lets the device
  still report in so the admin sees *why* it's degraded. The counter
  resets after one clean run of >5 minutes.

### 3. Backend additions

**New tables:**

- `Device` — id, displayName, boardLocation, roomCode, hardwareModel,
  enrolledAt, lastHeartbeat, agentVersion, currentTelemetry (JSON or columns:
  cpuTempC, throttleFlags, uptime, memUsedMb, kioskAlive, currentUrl,
  ipAddr, ssid).
- `DeviceConfig` — deviceId FK, configVersion, JSON of overrides
  (frameOverrides, scrollingMessages, darkMode, brightnessSchedule,
  weatherCoords, kioskUrl).
- `DeviceCommand` — id, deviceId, type, params, issuedBy, issuedAt,
  expiresAt, status (`queued|dispatched|acked|completed|failed`),
  result, error. The audit log.
- `EnrollToken` — token (hashed), createdBy, expiresAt, consumedAt,
  consumedByDeviceId.

**New endpoints:**

```
POST  /api/devices/enroll                       (one-time token)
POST  /api/devices/{id}/heartbeat               (HMAC, every 30s)
GET   /api/devices/{id}/config                  (HMAC, agent pulls)
WSS   /api/devices/{id}/commands                (HMAC handshake, persistent)

GET   /api/admin/devices                        (admin auth, fleet list)
POST  /api/admin/devices/{id}/commands          (admin auth, enqueue cmd)
POST  /api/admin/devices/{id}/config            (admin auth, write config)
GET   /api/admin/devices/{id}/command-history   (admin auth, audit log)
POST  /api/admin/devices/{id}/rotate-secret     (admin auth, force re-enroll)
POST  /api/admin/enroll-tokens                  (admin auth, mint enroll token)
```

**Modified endpoint:**

- `GET /api/musallah/payload` — accept `?deviceId=…`, merge location defaults
  with per-device override.

**Modified frontend WS** (`/api/refresh-musallahboard` →
`/api/board/stream?deviceId=…`):

- Tracks which device each connection belongs to.
- Pushes scoped messages: `{type: "config-updated"}`, `{type: "refresh"}`.
- Existing broadcast `REFRESH` semantics preserved as a fallback path.

### 4. Auth model

HMAC-SHA256 over `(method + path + timestamp + nonce + sha256(body))` using
the per-device shared secret.

- Backend rejects requests with timestamp skew >5min.
- Backend rejects seen nonces (Redis set or bloom filter, 10min TTL).
- WebSocket: HMAC-signed handshake on connect, then trust the connection for
  its lifetime.
- TLS handles confidentiality; HMAC handles authenticity + replay protection.

Secret rotation: admin-triggered endpoint invalidates the secret; agent
detects auth failure on next heartbeat and prompts for re-enrollment via the
local journal log (admin SSHes in and re-runs `agent enroll`).

### 5. Command protocol

**Backend → agent:**

```json
{
  "id": "cmd_01HXYZ...",
  "type": "refresh|restart_kiosk|reboot|set_url|screenshot|run_diagnostics|update_agent",
  "params": { },
  "issuedAt": 1715000000,
  "issuedBy": "admin@utmmsa.ca",
  "expiresAt": 1715000060
}
```

**Agent → backend acks:**

```json
{
  "id": "cmd_01HXYZ...",
  "status": "received|running|completed|failed",
  "result": { },
  "error": null
}
```

Rules:

- Each command has a unique `id`; agent dedupes against ring buffer.
- Reject any command where `now() > expiresAt` (prevents stale commands
  firing after a long disconnect).
- Long-running commands ack `running` immediately, then `completed` later —
  ack may arrive on a different WS connection.
- Backend tracks `dispatched → acked → completed/failed`; admin UI shows the
  status.

### 6. Admin portal (`utmmsa-pwa/src/pages/AdminPage.tsx`)

New `Boards` tab next to Events/Announcements/Spaces/Originals.

**Per-device card:**

- Status dot (green <60s, yellow <5min, red beyond).
- Display name, board location, room code.
- Live metrics: CPU temp, throttle flags, uptime, agent version.
- Current URL, kiosk alive indicator.
- Last screenshot thumbnail (clickable for full).

**Action buttons:**

- Refresh, Restart kiosk, Reboot, Take screenshot, Set URL.
- Each button POSTs to `/api/admin/devices/{id}/commands`.
- Pending commands show as in-flight; admin sees `acked` and `completed`
  states.

**Per-device config editor:**

- Frame ordering and durations.
- Scrolling messages (multiple).
- Dark mode rules.
- Brightness schedule.
- Weather coords override.
- Save → backend writes `DeviceConfig`, pushes `config-updated` on the
  frontend WS.

**Device management:**

- Mint enroll token (one-time, 1-hour TTL).
- Rename device, set room code.
- Rotate device secret.
- View command audit log.

### 7. Frontend (kiosk) changes

- Register service worker (Workbox).
- Read `?deviceId=…` from URL; fall back to cookie if absent.
- `getBoardPayload` includes `deviceId` in the query string.
- WS connection URL includes `deviceId`.
- Handle `config-updated` push by re-fetching payload and re-rendering
  in place (no reload). Slideshow re-init may be needed.
- Cookies become a fallback only. `weatherApiKey` moves server-side; the
  backend resolves weather per-device.

### 8. `setup.sh` changes

Append four steps to the existing script:

1. **Verify time sync.** Prayer times are timezone-sensitive and the Pi has
   no battery-backed RTC, so a power cycle leaves it with whatever time it
   booted with until NTP catches up. The script must:
   - `sudo timedatectl set-timezone America/Toronto` (or whatever the
     operator selects — prompt for it like `HOSTNAME`).
   - `sudo systemctl enable --now systemd-timesyncd`.
   - Block until `timedatectl show --property=NTPSynchronized` returns
     `yes` (with a 60s timeout and a clear error if it doesn't sync —
     don't continue install with a wrong clock).
   - Add a one-line healthcheck the agent runs at startup: refuse to
     execute time-sensitive commands if the system clock disagrees with
     `Date:` header from the backend by >2 minutes.
2. **Convert kiosk launcher to a systemd service.** `start-kiosk.sh`
   becomes `musallahboard-kiosk.service` so the agent can stop/start/
   restart it via the sudoers allowlist instead of pgrep+kill.
3. **Install the agent `.deb`:** `sudo apt install -y
   ./musallahboard-agent_*.deb`.
4. **Enroll:** `sudo musallahboard-agent enroll --token=$ENROLL_TOKEN
   --backend=https://backend.utmmsa.ca`.

Operator generates the enroll token in the admin portal at the same time
they paste the SSH key. Token is single-use and time-bound.

### 9. Alerting

Heartbeats let admins *see* a dead board on the dashboard. Alerts *tell*
them. Without this, "remote management" still requires someone watching
the screen.

**Backend cron** (every minute) scans `Device` rows:

- `lastHeartbeat` older than 5 minutes → fire `device.down` alert.
- Recovery (heartbeat resumes) → fire `device.recovered` alert.
- Sustained `cpuTempC > 80` for 5 minutes → fire `device.thermal` alert.
- Sustained `throttleFlags != 0` for 5 minutes → fire `device.throttled`
  alert (undervoltage / throttling — usually a power supply issue).
- Repeated command failures from one device → fire `device.flapping`
  alert.

**Delivery:** webhook URLs configured per `Organization` (so when
multi-tenancy lands later, each org points at its own Discord/Slack/
email gateway). Payload is a small JSON `{event, device, severity,
message, link}` — let the webhook receiver format it.

**Suppression:** dedupe by `(deviceId, eventType)` with a 30-minute
cooldown. A flapping board shouldn't page 60 times an hour.

**`AlertRule` table** (deviceId nullable, eventType, threshold, channel)
makes the rules editable from the admin portal later. For Phase 1, hard-
coded rules with the webhook URL in env config are fine.

## Migration phases

Each phase ships independently and adds value. No big-bang.

### Phase 0 — Today
Leave the existing kiosk and `setup.sh` running.

### Phase 1 — Read-only fleet visibility (~weekend)

**Goal:** every Pi appears in the admin portal with live telemetry. Zero
behavior change on the screens.

- Service worker in the Vite app.
- `Device` table + enroll endpoint + heartbeat endpoint.
- Agent skeleton:
  - `cmd/agent/main.go`, signal handling, sd_notify (~50 lines)
  - `internal/config` — TOML load/save (~80 lines)
  - `internal/enroll` — token enrollment (~100 lines)
  - `internal/transport` — HMAC HTTP client (~120 lines)
  - `internal/telemetry` — uptime/temp/throttle/mem/kiosk-alive (~150 lines)
  - heartbeat ticker (~50 lines)
  - safe-mode crash counter
  - systemd unit (with `StartLimitBurst`) + sudoers + Makefile
- `setup.sh` appendix: timezone prompt, NTP enable + sync verification,
  kiosk-as-service conversion, agent install + enroll.
- Admin portal: read-only `Boards` tab.

About 700 lines of Go. Validates the protocol round-trip end-to-end.

### Phase 2 — Safe commands + alerting (~week)

**Goal:** admin can refresh, screenshot, restart kiosk from the portal,
and gets paged when a board drops.

- WS command channel in agent + backend.
- Commands: `refresh` (CDP), `screenshot` (grim + upload),
  `restart_kiosk` (sudoers).
- `DeviceCommand` audit log + admin-side history view.
- Action buttons in admin portal.
- Idempotency, expiry, ack flow.
- Alerting cron + webhook delivery for `device.down`, `device.recovered`,
  `device.thermal`, `device.throttled`, `device.flapping`. Hard-coded
  rules + env-configured webhook URL is fine for this phase; `AlertRule`
  table can come later.

### Phase 3 — Per-device config (~week)

**Goal:** different boards can show different things.

- `DeviceConfig` table + admin endpoints.
- `/api/musallah/payload?deviceId=…` merges defaults + override.
- Frontend reads `?deviceId=…`, sends it on payload requests.
- Per-device config editor in admin portal.
- Frontend WS handles `config-updated` with hot re-render.
- Migrate scrolling messages and frame order from `BoardConfig` to
  `DeviceConfig`.
- Cookies become a fallback path only; `weatherApiKey` moves server-side.

### Phase 4 — Privileged commands (~week)

**Goal:** full remote management.

- Commands: `reboot`, `shutdown`, `set_url`, `display_power`,
  `set_brightness`.
- Sudoers allowlist as specified.
- Admin UI buttons with confirmation modals for destructive actions.
- Secret rotation flow.

### Phase 5 — Operations polish (ongoing)

- Agent self-update (`update_agent` command + signed binary pull).
- Optional journald shipping (warn+ stream, rate-limited).
- Brightness/blanking schedules driven from `DeviceConfig`.
- Per-board command history visible in admin.
- Prometheus-style metrics endpoint on `127.0.0.1:9100` for SSH-tunnel
  debugging.

## Failure modes designed for

| Scenario | Behavior |
|---|---|
| WS drops mid-command | Agent acks `received` immediately; survives disconnect. Backend resends. Agent dedupes by `id`. |
| Agent down, admin clicks reboot | Backend queues with short `expiresAt` (60s). Expires if not delivered. Admin sees "device offline." |
| Backend down | Agent buffers nothing for heartbeat (it's just telemetry); WS reconnects with backoff. |
| Agent process crashes | systemd `Restart=always`. Hardware watchdog (already in `setup.sh`) catches kernel wedges. |
| Long op during partition | Acks `running` first; `completed` arrives on next WS connection. |
| Compromised `deviceSecret` | Admin rotates; agent re-enrolls via local journal prompt. |
| Malicious-looking command | Type-checked on agent; only known types execute; sudoers gates privileged calls. |
| WiFi flake | Service worker serves last payload; agent buffers commands at backend with expiry. |
| First-boot with no network | Agent retries enrollment forever; kiosk shows the loading state until backend reachable. |

## Tech choices summary

| Concern | Choice | Why |
|---|---|---|
| Agent language | Go | Single static binary, cross-compile, stdlib coverage |
| Agent transport | HTTPS + WSS | Already deployed, no MQTT broker to run |
| Auth | HMAC over per-device secret | Simpler than mTLS for ~10 devices; drop-in upgradeable |
| Packaging | `.deb` via `nfpm` | Native to Pi OS; integrates with apt |
| systemd | `Type=notify` + `WatchdogSec` | Same pattern as existing hardware watchdog |
| Config storage | TOML at `/etc/musallahboard/agent.toml` | Human-editable for emergency, mode 0600 |
| Offline | Service worker (Workbox via `vite-plugin-pwa`) | ~50 lines, no architectural change |
| Admin UI | New `Boards` tab in existing `AdminPage.tsx` | Reuses existing auth + tab pattern |

## What this plan deliberately does not do

- Replace `setup.sh` (Phase 1 just appends to it).
- Rewrite the kiosk UI (the existing Vite app stays).
- Move to Electron (offline is a service-worker problem; native bits are
  shell-out from the agent).
- Use mTLS, MQTT, or a service mesh.
- Bundle the static site into the agent (the hosted-CDN model is fine; if
  cold-boot offline ever becomes a need, the agent can serve a local copy
  on `127.0.0.1:8081` as a Phase-6 enhancement).

## First concrete deliverable

Phase 1, in this order:

1. Service worker in `js/app.js` (independent, ship anytime).
2. Backend: `Device` table + `POST /api/devices/enroll` +
   `POST /api/devices/{id}/heartbeat` + `GET /api/admin/devices`.
3. Agent repo skeleton: `main.go`, config, enroll, transport, telemetry,
   heartbeat. Cross-compile to `arm64`. Package as `.deb`.
4. `setup.sh` appendix: install + enroll prompt.
5. Admin portal: `Boards` tab, read-only fleet list with status dot, last
   heartbeat, CPU temp, agent version.

End state of Phase 1: every Pi shows up in the portal with live telemetry,
nothing on the screens has changed, and the foundation is laid for every
subsequent phase to plug in.
