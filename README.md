<div align="center">

# Lune

### Discord Anti-Nuke & Anti-Abuse Security Bot

<img src="https://cdn.jsdelivr.net/gh/Nex-Devz/Antinuke-bot@main/assets/lune-logo.png" alt="Lune Logo" width="128" height="128">

![Discord.js](https://img.shields.io/badge/Discord.js-14-5865F2?style=flat-square&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

**Gateway first. Memory first. SQLite second. Discord API last.**

</div>

---

## What is Lune?

Lune is a production-grade Discord security bot that protects your server from nukes, raids, and abuse. It monitors every Gateway event in real time, applies risk analysis, and enforces configurable punishments -- all without polling or external databases. It also ships a full **AutoMod** toolkit that provisions native Discord AutoMod rules from an in-chat dashboard.

---

## 19 Security Modules

<details>
<summary><b>Channel Protection</b></summary>

- Anti Channel Nuke -- mass create, delete, permission overwrite abuse
- Anti Permission Nuke -- dangerous grants on protected channels
- Snapshot restore for deleted channels

</details>

<details>
<summary><b>Role Protection</b></summary>

- Anti Role Nuke -- mass create, delete, permission escalation
- Anti Admin Escalation -- detects Administrator permission addition
- Anti Member Role Abuse -- rapid role assignment/removal
- Anti Linked Role -- Discord Linked Role protection
- Snapshot restore for deleted roles

</details>

<details>
<summary><b>Abuse Prevention</b></summary>

- Anti Ban -- multi-window mass ban detection (5/10s, 10/30s, 20/60s)
- Anti Kick -- same architecture for kicks
- Anti Raid -- member join velocity tracking
- Anti Mass Mention -- @everyone/@here flood detection
- Anti Bot Add -- unauthorized bot blocking
- Anti Webhook Nuke -- webhook creation/deletion tracking

</details>

<details>
<summary><b>Resource Protection</b></summary>

- Anti Invite Nuke -- invite spam detection
- Anti Invite Role -- dangerous role payloads in invites
- Anti Emoji/Sticker Nuke -- creation/deletion spam
- Anti Integration Abuse -- integration tampering
- Anti AutoMod Abuse -- AutoMod rule protection
- Anti Scheduled Event Abuse -- event spam
- Emergency Lockdown -- server-wide lockdown mode

</details>

---

## Architecture

```
   Discord Gateway Event
          |
   Memory Cache Check
          |
   Local Risk Calculation
          |
   Targeted API Request (only when needed)
```

| Layer | What | Where |
|-------|------|-------|
| Hot Path | Rate limits, dedup, snapshots, audit cache | JavaScript Map/Set |
| Cold Path | Config, whitelist, owners, incidents, AutoMod rules/violations/stats | SQLite (WAL mode) |
| External | Audit logs, executor resolution, AutoMod rule API | Discord REST API |

**AutoMod tables**

| Table | Purpose |
|-------|---------|
| `guild_automod` | Per-guild AutoMod settings (log channel, notifications, DM, escalation) |
| `automod_rules` | Lune's rule definitions + their state and Discord rule ID |
| `automod_violations` | Every enforcement event (user, rule, channel, action, timestamp) |
| `automod_stats` | Daily counters for blocked / timeout / alert actions |

---

## Permission Risk Engine

Every role is scored by its actual Discord permission flags -- never by name.

```
Administrator       100  ████████████████████
ManageGuild          90  ██████████████████
ManageRoles          90  ██████████████████
ManageChannels       80  ████████████████
ManageWebhooks       70  ██████████████
BanMembers           70  ██████████████
KickMembers          60  ████████████
ModerateMembers      50  ██████████
ManageMessages       40  ████████
MentionEveryone      30  ██████
```

| Level | Range | Action |
|-------|-------|--------|
| LOW | 0-29 | Log |
| MEDIUM | 30-69 | Log + Notify |
| HIGH | 70-89 | Delete + Log |
| CRITICAL | 90-100 | Delete + Punish + Incident |

---

## Punishment Engine

| Severity | Default | Options |
|----------|---------|---------|
| LOW | Log | NONE, LOG |
| MEDIUM | Strip Roles | STRIP_ROLES, REMOVE_DANGEROUS_ROLE, TIMEOUT |
| HIGH | Kick | KICK, TIMEOUT, QUARANTINE |
| CRITICAL | Ban | BAN, KICK |

All punishments verify: bot permissions, role hierarchy, target manageability, not guild owner, not the bot itself.

---

## Commands

**Slash Commands**

| Command | Description |
|---------|-------------|
| `/antinuke` | Open security panel |
| `/whitelist add` | Whitelist a user |
| `/whitelist remove` | Remove from whitelist |
| `/whitelist list` | View whitelisted users |
| `/coowner add` | Add extra owner |
| `/coowner remove` | Remove extra owner |
| `/coowner list` | View extra owners |
| `/lockdown` | Activate lockdown mode |
| `/unlock` | Deactivate lockdown |
| `/automod overview` | AutoMod dashboard overview |
| `/automod modules` | Manage AutoMod protection modules |
| `/automod rules` | List created AutoMod rules |
| `/automod stats` | AutoMod enforcement statistics |
| `/automod logs` | Recent AutoMod enforcement logs |

**Aliases:** `/wl` and `/trust` work as aliases for `/whitelist`

**Prefix Commands**

| Command | Description |
|---------|-------------|
| `&help` | Show categorised help menu (Security / AutoMod / General) |
| `&ping` | Check bot latency |
| `&antinuke` | Open security panel |

---

## AutoMod

Lune also manages native **Discord AutoMod** rules from a Component V2 dashboard opened with `/automod`. No need to touch Discord's built-in AutoMod settings -- everything is driven from the `/automod` panel.

**Modules**

| Module | Trigger | Default |
|--------|---------|---------|
| Keyword | Blocked word filtering | block |
| Spam | Message flooding detection | block |
| Mention Spam | Mass-mention / raid mentions | block |
| Profanity | Native preset (profanity, sexual content, slurs) | block |

**Per-rule options**

- Action mode: **Block**, **Timeout**, or **Alert only**
- Exempt **roles** and **channels** (so admins / staff / support channels aren't affected)
- Custom timeout duration and mention limit

**Dashboard pages**

Overview, Modules, Configure, Rules, Exclusions, Statistics, Settings, Logs.

**Settings**

- **Log channel** -- where AutoMod alerts and logs are posted
- **Notifications** -- toggle moderator alerts when a rule triggers
- **DM offenders** -- send the offending user a direct message
- **Escalation** -- automatically timeout users with 5+ violations inside 10 minutes

AutoMod rules are created on Discord when you hit **Sync Rules to Discord** in the Rules page. The bot requires the **Manage Guild** permission to create native AutoMod rules.

---

## Quick Start

```bash
git clone https://github.com/Nex-Devz/Antinuke-bot.git
cd Antinuke-bot
npm install
cp .env.example .env
```

Edit `.env`:

```
TOKEN=your_bot_token
CLIENT_ID=your_client_id
```

```bash
npm start
```

Then in Discord: `/antinuke` to open the security panel, or `/automod` to manage AutoMod rules.

---

## Tech

|| |
|---|---|
| Runtime | Node.js 18+ |
| Library | Discord.js 14 |
| Database | SQLite (better-sqlite3) |
| Cache | Native Map/Set |
| UI | Components V2 |
| AutoMod | Native Discord AutoMod rule API |

No Redis. No MongoDB. No TypeScript. No polling.

---

<div align="center">

### Support

For questions, bug reports, or feature requests -- join the server or open an issue.

[Join Discord](https://discord.gg/zynrax)

**Built by Zynrax Development**

</div>