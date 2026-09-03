<div align="center">

<table>
<tr>
<td align="center" width="9999" bgcolor="#1a1b26">

<img src="https://img.shields.io/badge/ANTI_N8-0D1117?style=for-the-badge&labelColor=0D1117&color=5865F2" alt="AntiN8" />

<br><br>

# **ANTI N8**

<br>

### `> Discord Anti-Nuke & Anti-Abuse Security Bot`

<br>

<img src="https://img.shields.io/badge/ONLINE-3BA55C?style=flat-square&logo=discord&logoColor=white" />
<img src="https://img.shields.io/discord/members/1415328129521815696?style=flat-square&color=5865F2&logo=discord&logoColor=white" />
<img src="https://img.shields.io/badge/VERSION-1.0.0-blue?style=flat-square" />
<img src="https://img.shields.io/badge/NODE.JS-18%2B-339933?style=flat-square&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/DISCORD.JS-14-5865F2?style=flat-square&logo=discord&logoColor=white" />
<img src="https://img.shields.io/badge/LICENSE-MIT-yellow?style=flat-square" />

<br><br>

`Built by Zynrax Development`

<br>

<img src="https://img.shields.io/badge/JOIN_SERVER-5865F2?style=for-the-badge&logo=discord&logoColor=white&link=https://discord.gg/zynrax" />

</td>
</tr>
</table>

</div>

---

<div align="center">

## What is AntiN8?

</div>

AntiN8 is a production-grade Discord security bot that protects your server from nukes, raids, and abuse. It monitors every Gateway event in real time, applies risk analysis, and enforces configurable punishments — all without polling or external databases.

**Gateway first. Memory first. SQLite second. Discord API last.**

---

## 20 Security Modules

<details>
<summary><b>Channel Protection</b></summary>

- Anti Channel Nuke — mass create, delete, permission overwrite abuse
- Anti Permission Nuke — dangerous grants on protected channels
- Snapshot restore for deleted channels

</details>

<details>
<summary><b>Role Protection</b></summary>

- Anti Role Nuke — mass create, delete, permission escalation
- Anti Admin Escalation — detects Administrator permission addition
- Anti Member Role Abuse — rapid role assignment/removal
- Anti Linked Role — Discord Linked Role protection
- Snapshot restore for deleted roles

</details>

<details>
<summary><b>Abuse Prevention</b></summary>

- Anti Ban — multi-window mass ban detection (5/10s, 10/30s, 20/60s)
- Anti Kick — same architecture for kicks
- Anti Raid — member join velocity tracking
- Anti Mass Mention — @everyone/@here flood detection
- Anti Bot Add — unauthorized bot blocking
- Anti Webhook Nuke — webhook creation/deletion tracking

</details>

<details>
<summary><b>Resource Protection</b></summary>

- Anti Invite Nuke — invite spam detection
- Anti Invite Role — dangerous role payloads in invites
- Anti Emoji/Sticker Nuke — creation/deletion spam
- Anti Integration Abuse — integration tampering
- Anti AutoMod Abuse — AutoMod rule protection
- Anti Scheduled Event Abuse — event spam
- Emergency Lockdown — server-wide lockdown mode

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
| Cold Path | Config, whitelist, owners, incidents | SQLite (WAL mode) |
| External | Audit logs, executor resolution | Discord REST API |

---

## Permission Risk Engine

Every role is scored by its actual Discord permission flags — never by name.

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

```
/security setup              Initialize security
/security status             Show dashboard
/security config             View configuration
/security lockdown           Activate lockdown
/security unlock             Deactivate lockdown

/security whitelist add      Whitelist user/role
/security whitelist remove   Remove from whitelist
/security whitelist list     List entries

/security owner add          Add extra owner
/security owner remove       Remove extra owner
/security owner list         List owners

/security protection enable  Enable module
/security protection disable Disable module
/security protection toggle  Toggle module

/security thresholds ban     Set ban threshold
/security thresholds kick    Set kick threshold
/security thresholds view    View all thresholds

/security punishments set    Set punishment
/security punishments view   View punishments

/security incidents          View incidents
/security logs               View logs

/security protected role add       Protect role
/security protected role remove    Unprotect role
/security protected role list      List protected roles
/security protected channel add    Protect channel
/security protected channel remove Unprotect channel
/security protected channel list   List protected channels
/security protected webhook add    Protect webhook
/security protected webhook remove Unprotect webhook
/security protected webhook list   List protected webhooks
```

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

Then in Discord: `/security setup`

---

## Tech

| | |
|---|---|
| Runtime | Node.js 18+ |
| Library | Discord.js 14 |
| Database | SQLite (better-sqlite3) |
| Cache | Native Map/Set |
| UI | Components V2 |

No Redis. No MongoDB. No TypeScript. No polling.

---

<table>
<tr>
<td align="center" width="9999" bgcolor="#1a1b26">

<br>

### Support

<img src="https://img.shields.io/badge/JOIN_DISCORD-5865F2?style=for-the-badge&logo=discord&logoColor=white" />

For questions, bug reports, or feature requests — join the server or open an issue.

<br>

`Built with care by Zynrax Development`

<br>

</td>
</tr>
</table>
