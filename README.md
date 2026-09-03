# AntiN8

Production-grade Discord Anti-Nuke and Anti-Abuse security bot built by Zynrax Development.

AntiN8 is a comprehensive server protection platform designed for real-world Discord communities, including large servers with high activity. It monitors guild events in real time through the Discord Gateway, applies risk analysis, and enforces configurable punishments to defend against raiders, malicious insiders, and automated abuse.

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

- **Gateway First**: All detection is driven by Discord Gateway events. No polling.
- **Memory First**: Rate limits, deduplication, snapshots, and audit resolutions are stored in native JavaScript Maps and Sets.
- **SQLite Second**: Persistent configuration, whitelist entries, extra owners, protected resources, incidents, and punishment history are stored in SQLite via better-sqlite3.
- **Discord API Last**: REST requests and audit log fetches are made only when the executor cannot be determined from available data.

### Permission Risk Engine

Roles are evaluated by their actual Discord permission flags, never by name. Each dangerous permission carries a weight:

| Permission | Weight |
|------------|--------|
| Administrator | 100 |
| ManageGuild | 90 |
| ManageRoles | 90 |
| ManageChannels | 80 |
| ManageWebhooks | 70 |
| BanMembers | 70 |
| KickMembers | 60 |
| ModerateMembers | 50 |
| ManageMessages | 40 |
| MentionEveryone | 30 |

Risk levels: LOW (0-29), MEDIUM (30-69), HIGH (70-89), CRITICAL (90-100).

### Whitelist System

Granular per-user, per-role, and per-bot whitelisting with per-action or ALL bypass support.

### Extra Owner System

Multiple extra owners can be designated per guild. Extra owners bypass security enforcement and are treated with the same trust level as the guild owner for Anti-Nuke operations.

### Punishment Engine

Configurable punishment actions per severity level:

- NONE
- STRIP_ROLES
- REMOVE_DANGEROUS_ROLE
- KICK
- BAN
- TIMEOUT
- QUARANTINE

All punishments verify bot permissions, role hierarchy, and target manageability before execution. The bot never punishes itself, the guild owner, or unmanageable targets.

### Snapshot and Rollback

Channel, role, webhook, emoji, and sticker states are snapshotted on creation and maintained in memory. When a protected resource is deleted, AntiN8 restores it from the most recent snapshot.

### Incident Engine

Every serious security event is recorded as an incident with module, action, executor, target, severity, risk score, evidence, and action taken. Incidents are stored in SQLite and queryable via slash commands.

---

## Technology Stack

- Node.js 18+
- Discord.js 14
- SQLite (better-sqlite3)
- Native in-memory caching (Map, Set, WeakMap)
- ESM modules

No Redis. No MongoDB. No TypeScript. No external caching databases.

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

| Command | Permission | Description |
|---------|------------|-------------|
| `/security setup` | Administrator | Initialize security for the server |
| `/security status` | Manage Server | Show security status dashboard |
| `/security config` | Administrator | View configuration |
| `/security lockdown` | Administrator | Activate lockdown mode |
| `/security unlock` | Administrator | Deactivate lockdown mode |
| `/security whitelist add` | Administrator | Add user or role to whitelist |
| `/security whitelist remove` | Administrator | Remove from whitelist |
| `/security whitelist list` | Manage Server | List whitelist entries |
| `/security owner add` | Administrator | Add extra owner |
| `/security owner remove` | Administrator | Remove extra owner |
| `/security owner list` | Manage Server | List extra owners |
| `/security protection enable` | Administrator | Enable a protection module |
| `/security protection disable` | Administrator | Disable a protection module |
| `/security protection toggle` | Administrator | Toggle a protection module |
| `/security thresholds ban` | Administrator | Set ban thresholds |
| `/security thresholds kick` | Administrator | Set kick thresholds |
| `/security thresholds channel` | Administrator | Set channel thresholds |
| `/security thresholds role` | Administrator | Set role thresholds |
| `/security thresholds view` | Manage Server | View current thresholds |
| `/security punishments set` | Administrator | Set punishment for severity level |
| `/security punishments view` | Manage Server | View punishment configuration |
| `/security incidents` | Manage Server | View recent incidents |
| `/security logs` | Manage Server | View security logs |
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

Edit `.env` and set:

```
TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
```

### Running

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

---

## Support

- Discord: https://discord.gg/zynrax
- GitHub: https://github.com/Nex-Devz/Antinuke-bot

---

## License

MIT
