# AntiN8

Production-grade Discord Anti-Nuke and Anti-Abuse security bot built by Zynrax Development.

AntiN8 is a comprehensive server protection platform designed for real-world Discord communities, including large servers with high activity. It monitors guild events in real time through the Discord Gateway, applies risk analysis, and enforces configurable punishments to defend against raiders, malicious insiders, and automated abuse.

---

## Credits

Built and maintained by Zynrax Development.

Lead Developer: `<@1415328129521815696>`

---

## Why AntiN8

Most anti-nuke bots rely on polling, external databases, or incomplete detection. AntiN8 is built from the ground up with a Gateway-first architecture that processes events as they arrive, caches state in memory for instant lookups, and only touches the Discord API when absolutely necessary. This means faster response times, lower resource usage, and more reliable protection.

Every security decision is based on actual Discord permission flags, not role names. Every punishment is validated against hierarchy and permissions before execution. Every incident is logged with full context for audit purposes.

---

## Features

### Core Security Modules

| Module | Description |
|--------|-------------|
| Anti Channel Nuke | Detects mass channel creation, deletion, permission overwrite abuse, and position manipulation. Restores deleted channels from snapshots. |
| Anti Role Nuke | Detects mass role creation, deletion, and dangerous permission escalation. Maintains role snapshots for rollback. |
| Anti Permission Nuke | Monitors permission overwrite changes on channels. Blocks dangerous grants such as Administrator or ManageRoles on protected resources. |
| Anti Webhook Nuke | Tracks webhook creation and deletion rates. Protects designated webhooks from unauthorized removal. |
| Anti Emoji Nuke | Detects mass emoji creation and deletion spam. |
| Anti Sticker Nuke | Detects mass sticker creation and deletion spam. |
| Anti Ban | Detects mass ban waves using configurable multi-window thresholds (e.g., 5 bans in 10s, 10 in 30s, 20 in 60s). Resolves executor via audit log correlation. |
| Anti Kick | Same architecture as Anti Ban, applied to kick actions. |
| Anti Member Role Abuse | Tracks rapid role assignment and removal. Blocks dangerous role grants to members. |
| Anti Administrator Escalation | Dedicated module for detecting when Administrator permission is added to roles or assigned to members. |
| Anti Bot Add | Blocks unauthorized bot additions. Maintains trusted, allowed, and blocked bot lists per guild. |
| Anti Integration Abuse | Monitors integration creation, update, and deletion events. |
| Anti AutoMod Abuse | Protects AutoMod rule configuration from unauthorized changes. |
| Anti Scheduled Event Abuse | Detects event creation and deletion spam. |
| Anti Invite Nuke | Detects invite creation and deletion spam. Maintains an invite cache without polling. |
| Anti Invite Role | Inspects invite role payloads directly from Gateway events. Calculates risk based on granted permissions and takes action proportionally. |
| Anti Linked Role | Detects Discord Linked Roles through role metadata. Protects linked role deletion, modification, and permission escalation. |
| Anti Raid | Tracks member join patterns. Activates lockdown when join velocity exceeds threshold. |
| Anti Mass Mention Abuse | Detects @everyone and @here mention floods per channel. |
| Emergency Lockdown | Server-wide lockdown mode that increases sensitivity across all modules and blocks dangerous operations. |

### Architecture

AntiN8 follows a strict performance hierarchy:

```
Gateway Event
      |
Memory Cache
      |
Local Security Check
      |
Targeted Discord API Request (only when required)
```

- **Gateway First**: All detection is driven by Discord Gateway events. No polling. No intervals. No timers for event processing.
- **Memory First**: Rate limits, deduplication, snapshots, and audit resolutions are stored in native JavaScript Maps and Sets. Hot-path security checks never touch the database.
- **SQLite Second**: Persistent configuration, whitelist entries, extra owners, protected resources, incidents, and punishment history are stored in SQLite via better-sqlite3 with WAL mode and prepared statements.
- **Discord API Last**: REST requests and audit log fetches are made only when the executor cannot be determined from available data. Every API call is intentional and targeted.

### Permission Risk Engine

Roles are evaluated by their actual Discord permission flags, never by name. The engine uses a centralized weight system:

| Permission | Weight | Category |
|------------|--------|----------|
| Administrator | 100 | Critical |
| ManageGuild | 90 | High |
| ManageRoles | 90 | High |
| ManageChannels | 80 | High |
| ManageWebhooks | 70 | High |
| BanMembers | 70 | High |
| KickMembers | 60 | High |
| ModerateMembers | 50 | Medium |
| ManageMessages | 40 | Medium |
| ManageThreads | 30 | Medium |
| ManageNicknames | 20 | Medium |
| ManageEvents | 20 | Medium |
| MentionEveryone | 30 | Medium |

Risk levels:

| Level | Range | Response |
|-------|-------|----------|
| LOW | 0-29 | Log only |
| MEDIUM | 30-69 | Log and notify |
| HIGH | 70-89 | Delete resource and log |
| CRITICAL | 90-100 | Delete resource, punish executor, and log as critical incident |

### Whitelist System

Granular per-user, per-role, and per-bot whitelisting with per-action or ALL bypass support.

- Users can be whitelisted for specific actions (e.g., ROLE_UPDATE, INVITE_CREATE) or for ALL actions
- Roles can be whitelisted to exempt all members with that role
- Bots can be whitelisted to allow specific bot operations
- Whitelist entries are stored in SQLite and loaded into memory on startup
- Changes are reflected immediately in both cache and database

### Extra Owner System

Multiple extra owners can be designated per guild. Extra owners bypass security enforcement and are treated with the same trust level as the guild owner for Anti-Nuke operations.

Trust priority:

```
Guild Owner
    |
Extra Owner
    |
Explicit Trusted User
    |
Whitelisted User/Role
    |
Normal User
```

### Punishment Engine

Configurable punishment actions per severity level:

| Action | Description |
|--------|-------------|
| NONE | No action taken |
| STRIP_ROLES | Remove all roles from the target |
| REMOVE_DANGEROUS_ROLE | Remove only roles with dangerous permissions |
| KICK | Remove the target from the server |
| BAN | Permanently ban the target |
| TIMEOUT | Timeout the target for a configurable duration |
| QUARANTINE | Move the target to a quarantine channel |

All punishments verify:

- Bot has the required permissions
- Role hierarchy allows the action
- Target is manageable by the bot
- Target is not the guild owner
- Target is not AntiN8 itself

### Snapshot and Rollback

Channel, role, webhook, emoji, and sticker states are snapshotted on creation and maintained in memory. When a protected resource is deleted, AntiN8 restores it from the most recent snapshot.

Snapshot data includes:

- **Channels**: name, type, position, parent, permission overwrites, topic, nsfw, slowmode
- **Roles**: name, color, hoist, mentionable, permissions, position, icon, unicode emoji
- **Webhooks**: name, avatar, channel, token
- **Emojis**: name, image, roles
- **Stickers**: name, description, tags, file

### Incident Engine

Every serious security event is recorded as an incident with full context:

```json
{
  "id": "guild-timestamp-random",
  "guildId": "1234567890",
  "module": "antichannel",
  "action": "channelDelete",
  "executorId": "9876543210",
  "targetId": "1112223333",
  "severity": "CRITICAL",
  "risk": 95,
  "evidence": {},
  "actionTaken": "BAN",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Incidents are stored in SQLite and queryable via slash commands. They provide a complete audit trail of all security actions taken by the bot.

### Audit Log Correlation

When an executor cannot be determined from the Gateway event alone, AntiN8 fetches and correlates audit log entries. The correlator matches:

- Action type
- Target ID
- Timestamp within a configurable window
- Executor identity

Results are cached in memory to avoid redundant API calls. If the executor cannot be reliably identified, no punishment is applied.

### Event Deduplication

During event bursts (raids, mass operations), the same event may be processed multiple times. AntiN8 uses an in-memory deduplication cache with configurable TTL to prevent duplicate processing and duplicate punishments.

### Rate Limiting

All rate-sensitive modules use in-memory counters with automatic expiration. Rate limit state is per-guild and per-action, ensuring accurate detection without cross-guild interference.

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Discord Library | Discord.js 14 |
| Database | SQLite via better-sqlite3 |
| Caching | Native JavaScript Map, Set, WeakMap |
| Module System | ESM (ECMAScript Modules) |
| UI Framework | Discord Components V2 |

No Redis. No MongoDB. No TypeScript. No external caching databases. No polling frameworks.

---

## Project Structure

```
src/
  index.js                          Entry point, client setup, command registration
  config/
    defaults.js                     Default security configuration factory
  cache/
    GuildCache.js                   Per-guild in-memory state management
  database/
    Database.js                     SQLite connection, prepared statements, migrations
    migrations/
      001_initial.js                Table creation for all 12 tables
      index.js                      Migration runner
  security/
    PermissionAnalyzer.js           Permission flag risk scoring
    RiskEngine.js                   Central risk calculation for all modules
    AuditCorrelator.js              Audit log executor resolution with caching
    PunishmentEngine.js             Punishment execution with hierarchy checks
    SnapshotManager.js              Resource snapshots and rollback
    IncidentEngine.js               Incident recording and retrieval
    WhitelistManager.js             Whitelist CRUD and lookup
    OwnerManager.js                 Extra owner CRUD and lookup
  modules/
    antichannel/index.js            Channel create/delete/update handlers
    antirôle/index.js               Role create/delete/update handlers
    antipermission/index.js         Permission overwrite change handlers
    antiwebhook/index.js            Webhook create/delete/update handlers
    antiemoji/index.js              Emoji create/delete/update handlers
    antisticker/index.js            Sticker create/delete/update handlers
    antiban/index.js                Mass ban detection
    antikick/index.js               Mass kick detection
    antimemberrole/index.js         Role assignment abuse detection
    antiadministrator/index.js      Administrator escalation detection
    antibot/index.js                Unauthorized bot detection
    antiintegration/index.js        Integration abuse detection
    antiautomod/index.js            AutoMod abuse detection
    antischeduledevent/index.js     Scheduled event abuse detection
    antiinvite/index.js             Invite spam detection
    antiinvite-role/index.js        Dangerous invite role detection
    antilinked-role/index.js        Linked role protection
    antiraid/index.js               Raid detection
    antimassmention/index.js        Mass mention abuse detection
    emergencylockdown/index.js      Lockdown mode management
  events/
    index.js                        Gateway event registration and routing
    ready.js                        Client ready handler, cache population
  commands/
    index.js                        Slash command definitions and handlers
  components/
    dashboard.js                    Overview dashboard (Components V2)
    configPanel.js                  Configuration panel
    whitelistPanel.js               Whitelist management panel
    incidentPanel.js                Incident history panel
    lockdownPanel.js                Lockdown control panel
  utils/
    helpers.js                      Shared utility functions
```

---

## Commands

### General

| Command | Permission | Description |
|---------|------------|-------------|
| `/security setup` | Administrator | Initialize security for the server |
| `/security status` | Manage Server | Show security status dashboard |
| `/security config` | Administrator | View configuration |

### Lockdown

| Command | Permission | Description |
|---------|------------|-------------|
| `/security lockdown` | Administrator | Activate lockdown mode |
| `/security unlock` | Administrator | Deactivate lockdown mode |

### Whitelist Management

| Command | Permission | Description |
|---------|------------|-------------|
| `/security whitelist add` | Administrator | Add user or role to whitelist |
| `/security whitelist remove` | Administrator | Remove from whitelist |
| `/security whitelist list` | Manage Server | List whitelist entries |

### Extra Owner Management

| Command | Permission | Description |
|---------|------------|-------------|
| `/security owner add` | Administrator | Add extra owner |
| `/security owner remove` | Administrator | Remove extra owner |
| `/security owner list` | Manage Server | List extra owners |

### Module Control

| Command | Permission | Description |
|---------|------------|-------------|
| `/security protection enable` | Administrator | Enable a protection module |
| `/security protection disable` | Administrator | Disable a protection module |
| `/security protection toggle` | Administrator | Toggle a protection module |

### Threshold Configuration

| Command | Permission | Description |
|---------|------------|-------------|
| `/security thresholds ban` | Administrator | Set ban thresholds |
| `/security thresholds kick` | Administrator | Set kick thresholds |
| `/security thresholds channel` | Administrator | Set channel thresholds |
| `/security thresholds role` | Administrator | Set role thresholds |
| `/security thresholds view` | Manage Server | View current thresholds |

### Punishment Configuration

| Command | Permission | Description |
|---------|------------|-------------|
| `/security punishments set` | Administrator | Set punishment for severity level |
| `/security punishments view` | Manage Server | View punishment configuration |

### Monitoring

| Command | Permission | Description |
|---------|------------|-------------|
| `/security incidents` | Manage Server | View recent incidents |
| `/security logs` | Manage Server | View security logs |

### Protected Resources

| Command | Permission | Description |
|---------|------------|-------------|
| `/security protected role add` | Administrator | Add protected role |
| `/security protected role remove` | Administrator | Remove protected role |
| `/security protected role list` | Manage Server | List protected roles |
| `/security protected channel add` | Administrator | Add protected channel |
| `/security protected channel remove` | Administrator | Remove protected channel |
| `/security protected channel list` | Manage Server | List protected channels |
| `/security protected webhook add` | Administrator | Add protected webhook |
| `/security protected webhook remove` | Administrator | Remove protected webhook |
| `/security protected webhook list` | Manage Server | List protected webhooks |

---

## Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Discord bot application with the following intents enabled:
  - Guilds
  - Guild Members
  - Guild Bans
  - Guild Invites
  - Guild Webhooks
  - Guild Emojis and Stickers
  - Guild Scheduled Events
  - Message Content
  - Guild Messages
  - AutoModeration Configuration
  - AutoModeration Execution
- Bot must have Administrator permission in target guilds

### Installation

```bash
git clone https://github.com/Nex-Devz/Antinuke-bot.git
cd Antinuke-bot
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```
TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
```

### Running

```bash
npm start
```

For development with auto-restart on file changes:

```bash
npm run dev
```

### First-Time Setup

1. Invite the bot to your server with Administrator permission
2. Run `/security setup` in any channel the bot can access
3. Configure protected roles with `/security protected role add @role`
4. Configure protected channels with `/security protected channel add #channel`
5. Add trusted users to the whitelist with `/security whitelist add @user`
6. Review the security status with `/security status`

---

## Default Configuration

AntiN8 ships with sensible defaults. All thresholds and actions are configurable per guild.

### Default Thresholds

| Action | Count | Window |
|--------|-------|--------|
| Bans | 5 | 10 seconds |
| Kicks | 5 | 10 seconds |
| Channel Creates | 3 | 10 seconds |
| Channel Deletes | 2 | 10 seconds |
| Role Creates | 3 | 10 seconds |
| Role Deletes | 2 | 10 seconds |
| Invite Creates | 5 | 10 seconds |
| Invite Deletes | 3 | 10 seconds |
| Webhook Creates | 2 | 10 seconds |
| Emoji Creates | 5 | 10 seconds |
| Sticker Creates | 3 | 10 seconds |
| Mass Mentions | 5 | 10 seconds |
| Raid Members | 10 | 10 seconds |

### Default Punishments

| Severity | Action |
|----------|--------|
| LOW | LOG |
| MEDIUM | STRIP_ROLES |
| HIGH | KICK |
| CRITICAL | BAN |

---

## Database Schema

AntiN8 uses 12 SQLite tables:

| Table | Purpose |
|-------|---------|
| guilds | Guild metadata and owner information |
| security_config | Per-guild security configuration (JSON) |
| whitelist | Whitelist entries with per-action bypass |
| extra_owners | Designated extra owners per guild |
| protected_roles | Roles protected from unauthorized changes |
| protected_channels | Channels protected from unauthorized changes |
| protected_webhooks | Webhooks protected from unauthorized changes |
| trusted_bots | Bots trusted to operate without restriction |
| security_incidents | Full incident history with evidence |
| security_snapshots | Resource snapshots for rollback |
| punishment_history | Record of all punishments applied |
| invite_history | Invite state tracking |

---

## Performance

AntiN8 is optimized for large servers with high event throughput:

- No REST requests per Gateway event
- No audit log fetches per event
- No SQLite queries per event
- No invite fetches per member join
- No full guild fetch loops
- No continuous polling or timers

All hot-path operations run entirely in memory. Database operations are limited to configuration changes and incident recording. API requests are made only when executor identification is genuinely required.

---

## Error Handling

AntiN8 handles all Discord API error states gracefully:

- 403 Forbidden: Logged and skipped, never crashes
- 404 Not Found: Resource already removed, logged
- 429 Rate Limited: Respected with backoff
- 500+ Server Errors: Logged with context
- Missing permissions: Detected before action, logged
- Role hierarchy failures: Verified before punishment
- Database failures: Logged, operation skipped
- Gateway reconnects: Handled by Discord.js

A single guild operation failure never crashes the entire bot.

---

## Support

For questions, bug reports, or feature requests:

- Discord Support Server: https://discord.gg/zynrax
- Server ID: `1415328129521815696`
- Server Widget: https://discord.com/api/guilds/1415328129521815696/widget.png
- Open an issue on the repository

When reporting a bug, include:

- Bot version
- Node.js version
- Discord.js version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant console output

---

## License

MIT
