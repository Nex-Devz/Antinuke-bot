# AntiN8

Production-grade Discord Anti-Nuke and Anti-Abuse security bot by Zynrax Development.

<p align="center">
  <a href="https://discord.gg/zynrax">
    <img src="https://img.shields.io/discord/1415328129521815696?label=Support%20Server&logo=discord&logoColor=white&color=5865F2" alt="Discord Server" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-18%2B-green" alt="Node.js" />
  <img src="https://img.shields.io/badge/Discord.js-14-blue" alt="Discord.js" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</p>

<p align="center">
  <b>For questions, issues, or support — join our Discord server</b><br>
  <a href="https://discord.gg/zynrax">discord.gg/zynrax</a>
</p>

---

## Why AntiN8

Most anti-nuke bots rely on polling, external databases, or incomplete detection. AntiN8 uses a Gateway-first architecture — events are processed as they arrive, state is cached in memory, and the Discord API is only touched when absolutely necessary. Faster response, lower resource usage, more reliable protection.

Every security decision is based on actual Discord permission flags, not role names. Every punishment is validated against hierarchy before execution. Every incident is logged with full context.

---

## Security Modules

| Module | What it does |
|--------|-------------|
| Anti Channel Nuke | Detects mass channel creation, deletion, and permission overwrite abuse. Restores from snapshots. |
| Anti Role Nuke | Detects mass role creation, deletion, and dangerous permission escalation. |
| Anti Permission Nuke | Blocks dangerous permission grants on protected channels. |
| Anti Webhook Nuke | Tracks webhook creation/deletion rates. Protects designated webhooks. |
| Anti Emoji/Sticker Nuke | Detects mass emoji and sticker creation/deletion spam. |
| Anti Ban | Detects mass ban waves with multi-window thresholds. Resolves executor via audit logs. |
| Anti Kick | Same architecture as Anti Ban for kick actions. |
| Anti Member Role Abuse | Tracks rapid role assignment/removal and dangerous role grants. |
| Anti Admin Escalation | Detects when Administrator permission is added to roles or members. |
| Anti Bot Add | Blocks unauthorized bots. Maintains trusted/allowed/blocked lists. |
| Anti Integration Abuse | Monitors integration creation, update, and deletion. |
| Anti AutoMod Abuse | Protects AutoMod rule configuration from tampering. |
| Anti Scheduled Event Abuse | Detects event creation and deletion spam. |
| Anti Invite Nuke | Detects invite creation/deletion spam with in-memory cache. |
| Anti Invite Role | Inspects invite role payloads for dangerous permissions. |
| Anti Linked Role | Protects Discord Linked Roles from deletion and modification. |
| Anti Raid | Tracks member join velocity. Activates lockdown on threshold breach. |
| Anti Mass Mention | Detects @everyone and @here mention floods. |
| Emergency Lockdown | Server-wide lockdown that increases sensitivity across all modules. |

---

## Architecture

```
Gateway Event  ->  Memory Cache  ->  Local Security Check  ->  Targeted API (only if needed)
```

- **Gateway First** — All detection from Discord Gateway events. No polling.
- **Memory First** — Rate limits, dedup, snapshots, audit cache in Maps/Sets.
- **SQLite Second** — Config, whitelist, owners, incidents, punishment history.
- **API Last** — REST and audit logs only when executor is unknown.

---

## Permission Risk Engine

Roles scored by actual permission flags:

| Permission | Weight |
|------------|--------|
| Administrator | 100 |
| ManageGuild / ManageRoles | 90 |
| ManageChannels | 80 |
| ManageWebhooks / BanMembers | 70 |
| KickMembers | 60 |
| ModerateMembers | 50 |
| ManageMessages / MentionEveryone | 30-40 |

Risk levels: **LOW** (0-29) | **MEDIUM** (30-69) | **HIGH** (70-89) | **CRITICAL** (90-100)

---

## Punishment Engine

| Severity | Default Action |
|----------|----------------|
| LOW | Log only |
| MEDIUM | Strip roles |
| HIGH | Kick |
| CRITICAL | Ban |

All punishments verify bot permissions, role hierarchy, and target manageability. The bot never punishes itself or the guild owner.

---

## Commands

| Command | Permission | Description |
|---------|------------|-------------|
| `/security setup` | Admin | Initialize security |
| `/security status` | Manage Server | Show status dashboard |
| `/security lockdown` | Admin | Activate lockdown |
| `/security unlock` | Admin | Deactivate lockdown |
| `/security whitelist add` | Admin | Whitelist user/role |
| `/security whitelist remove` | Admin | Remove from whitelist |
| `/security whitelist list` | Manage Server | List whitelist |
| `/security owner add` | Admin | Add extra owner |
| `/security owner remove` | Admin | Remove extra owner |
| `/security owner list` | Manage Server | List extra owners |
| `/security protection enable` | Admin | Enable module |
| `/security protection disable` | Admin | Disable module |
| `/security protection toggle` | Admin | Toggle module |
| `/security thresholds ban` | Admin | Set ban thresholds |
| `/security thresholds kick` | Admin | Set kick thresholds |
| `/security thresholds channel` | Admin | Set channel thresholds |
| `/security thresholds role` | Admin | Set role thresholds |
| `/security thresholds view` | Manage Server | View thresholds |
| `/security punishments set` | Admin | Set punishment |
| `/security punishments view` | Manage Server | View punishments |
| `/security incidents` | Manage Server | View incidents |
| `/security logs` | Manage Server | View logs |
| `/security protected role add` | Admin | Protect role |
| `/security protected role remove` | Admin | Unprotect role |
| `/security protected role list` | Manage Server | List protected roles |
| `/security protected channel add` | Admin | Protect channel |
| `/security protected channel remove` | Admin | Unprotect channel |
| `/security protected channel list` | Manage Server | List protected channels |
| `/security protected webhook add` | Admin | Protect webhook |
| `/security protected webhook remove` | Admin | Unprotect webhook |
| `/security protected webhook list` | Manage Server | List protected webhooks |

---

## Setup

### Prerequisites

- Node.js 18+
- Discord bot with these intents: Guilds, GuildMembers, GuildBans, GuildInvites, GuildWebhooks, GuildEmojisAndStickers, GuildScheduledEvents, MessageContent, GuildMessages, AutoModerationConfiguration, AutoModerationExecution
- Bot must have Administrator permission in target guilds

### Install

```bash
git clone https://github.com/Nex-Devz/Antinuke-bot.git
cd Antinuke-bot
npm install
```

### Configure

```bash
cp .env.example .env
```

Set in `.env`:

```
TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
```

### Run

```bash
npm start
```

### First-Time Setup

1. Invite bot with Administrator permission
2. Run `/security setup`
3. Protect roles: `/security protected role add @role`
4. Protect channels: `/security protected channel add #channel`
5. Whitelist trusted users: `/security whitelist add @user`
6. Check status: `/security status`

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Discord | Discord.js 14 |
| Database | SQLite (better-sqlite3) |
| Caching | Native Map, Set, WeakMap |
| UI | Discord Components V2 |

No Redis. No MongoDB. No TypeScript. No external databases.

---

## Support

- Discord: https://discord.gg/zynrax
- Issues: Open an issue on the repository

When reporting a bug include: bot version, Node.js version, steps to reproduce, expected vs actual behavior, and console output.

---

## License

MIT
