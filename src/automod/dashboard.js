import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  LabelBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  CheckboxGroupBuilder,
  CheckboxGroupOptionBuilder,
  RadioGroupBuilder,
  RadioGroupOptionBuilder
} from "discord.js";
import { RULE_TYPES, MODULE_STATES } from "./AutoModManager.js";
import { getEmoji } from "../utils/emoji.js";

function stateEmoji(state) {
  switch (state) {
    case "ready":
      return getEmoji("enabled") || "\u2705";
    case "disabled":
      return getEmoji("Disabled") || "\u26D4";
    case "loading":
      return getEmoji("loading") || "\u23F3";
    case "error":
      return getEmoji("floovi_cross") || "\u274C";
    default:
      return getEmoji("Refresh") || "\uD83D\uDD04";
  }
}

function footer() {
  return new ContainerBuilder()
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("[Zynrax Development](https://discord.gg/zynrax)")
    );
}

function baseContainer() {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# Luna AutoMod\nPolicy-based content filtering")
    )
    .addSeparatorComponents(new SeparatorBuilder());
}

function navRow(active) {
  const defs = [
    ["overview", "Overview"],
    ["modules", "Modules"],
    ["configure", "Configure"],
    ["rules", "Rules"],
    ["exclusions", "Exclusions"],
    ["stats", "Stats"],
    ["settings", "Settings"],
    ["logs", "Logs"]
  ];
  const make = (slice) => new ActionRowBuilder().addComponents(
    ...slice.map(([key, label]) =>
      new ButtonBuilder()
        .setCustomId(`am_nav:${key}`)
        .setLabel(label)
        .setStyle(active === key ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );
  return [make(defs.slice(0, 4)), make(defs.slice(4))];
}

function moduleButtons(guildId, type, rule) {
  const enabled = rule?.enabled ?? true;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`am_mod:${guildId}:${type}:on`)
      .setLabel("Enable")
      .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(enabled),
    new ButtonBuilder()
      .setCustomId(`am_mod:${guildId}:${type}:off`)
      .setLabel("Disable")
      .setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Danger)
      .setDisabled(!enabled),
    new ButtonBuilder()
      .setCustomId(`am_cfg:${guildId}:${type}`)
      .setLabel("Configure")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`am_back:${guildId}`)
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
  );
}

export function buildOverviewContainer(manager, guildId) {
  const cfg = manager.getGuildDB(guildId);
  const rules = manager.getRules(guildId);
  const stats = manager.getStats(guildId, 7);
  const client = manager.client;

  const container = baseContainer();

  const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) || "";
  try {
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Status:** ${cfg.enabled ? "**ENABLED**" : "**PAUSED**"}\n**Rules:** ${rules.size} configured\n\nProtect your server with native Discord AutoMod rules — keyword, spam, mention and profanity filtering. Configure, preview and manage rules from one dashboard.`
        )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));
    container.addSectionComponents(section);
  } catch {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Status:** ${cfg.enabled ? "**ENABLED**" : "**PAUSED**"}\n**Rules:** ${rules.size} configured`
      )
    );
  }

  const lines = Object.entries(RULE_TYPES).map(([type, def]) => {
    const rule = rules.get(type);
    const emoji = stateEmoji(rule?.state ?? "disabled");
    return `> ${emoji} **${def.label}** — ${rule?.enabled === false ? "Disabled" : "Active"}`;
  }).join("\n");

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Modules**\n${lines}`)
  );

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**7-day totals** — Blocked: **${stats.blocked}** · Timeouts: **${stats.timeouts}** · Alerts: **${stats.alerts}**\nUse the navigation below to manage modules and settings.`
    )
  );

  container.addActionRowComponents(...navRow("overview"));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`am_toggle_all:${guildId}`)
        .setLabel(cfg.enabled ? "Pause All" : "Resume All")
        .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("[Zynrax Development](https://discord.gg/zynrax)")
  );

  return container;
}

export function buildModulesContainer(manager, guildId) {
  const rules = manager.getRules(guildId);
  const container = baseContainer();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("**Protection Modules**\nUse the buttons to enable, disable or configure each module.")
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  const lines = Object.entries(RULE_TYPES).map(([type, def]) => {
    const rule = rules.get(type);
    const s = rule?.state ?? "pending";
    return `> ${stateEmoji(s)} **${def.label}** — ${MODULE_STATES[s] || "Pending"}\n${def.desc}`;
  }).join("\n\n");

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
  container.addSeparatorComponents(new SeparatorBuilder());

  const select = new StringSelectMenuBuilder()
    .setCustomId(`am_mod_select:${guildId}`)
    .setPlaceholder("Select a module to manage...")
    .addOptions(
      Object.entries(RULE_TYPES).map(([type, def]) => ({
        label: def.label,
        description: def.desc,
        value: type
      }))
    );

  container.addActionRowComponents(...navRow("modules"));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("[Zynrax Development](https://discord.gg/zynrax)")
  );

  return container;
}

export function buildConfigureContainer(manager, guildId, type) {
  const def = RULE_TYPES[type];
  if (!def) return buildModulesContainer(manager, guildId);

  const rules = manager.getRules(guildId);
  const rule = rules.get(type);
  const cfg = rule?.actionConfig || manager.defaultActionConfig();

  const container = baseContainer();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# Configure · ${def.label}\n${def.desc}\n\nSelect what this module should do with offending messages.`)
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  const mode = cfg.mode || "block";
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Action:** ${mode === "block" ? "Block message" : mode === "timeout" ? `Timeout (${cfg.timeoutSeconds || 600}s)` : "Alert only"}` +
        (cfg.customMessage ? `\n**Custom message:** ${cfg.customMessage}` : "")
    )
  );

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`am_cfg:${guildId}:${type}:mode:block`)
        .setLabel("Block")
        .setStyle(mode === "block" ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`am_cfg:${guildId}:${type}:mode:timeout`)
        .setLabel("Timeout")
        .setStyle(mode === "timeout" ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`am_cfg:${guildId}:${type}:mode:alert`)
        .setLabel("Alert Only")
        .setStyle(mode === "alert" ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`am_cfg:${guildId}:${type}:advanced`)
        .setLabel("Advanced")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`am_back:${guildId}`)
        .setLabel("Back")
        .setStyle(ButtonStyle.Primary)
    )
  );

  container.addActionRowComponents(...navRow("configure"));
  return container;
}

export function buildRulesContainer(manager, guildId) {
  const rules = manager.getRules(guildId);
  const container = baseContainer();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("**Created Rules**\nThese are the native Discord AutoMod rules Luna manages for this server.")
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  const lines = Object.entries(RULE_TYPES).map(([type, def]) => {
    const rule = rules.get(type);
    if (!rule) return `> \u274C **${def.label}** — not created`;
    const disc = rule.discordRuleId ? `\`${rule.discordRuleId}\`` : "not provisioned";
    return `> ${stateEmoji(rule.state)} **${def.label}**\nEnabled: ${rule.enabled ? "yes" : "no"} · State: **${rule.state}** · ID: ${disc}`;
  }).join("\n\n");

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
  container.addSeparatorComponents(new SeparatorBuilder());

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`am_sync:${guildId}`)
        .setLabel("Sync Rules to Discord")
        .setStyle(ButtonStyle.Primary)
    )
  );
  container.addActionRowComponents(...navRow("rules"));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("[Zynrax Development](https://discord.gg/zynrax)")
  );

  return container;
}

export function buildExclusionsContainer(manager, guildId, type) {
  const def = RULE_TYPES[type];
  const rules = manager.getRules(guildId);
  const rule = rules.get(type);
  const exemptRoles = rule?.exemptRoles || [];
  const exemptChannels = rule?.exemptChannels || [];

  const container = baseContainer();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# Exclusions · ${def ? def.label : "AutoMod"}\nRoles and channels that are **not** affected by this rule.`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Exempt Roles**\n${exemptRoles.length ? exemptRoles.map(id => `<@&${id}>`).join(", ") : "None"}`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Exempt Channels**\n${exemptChannels.length ? exemptChannels.map(id => `<#${id}>`).join(", ") : "None"}`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`am_excl:${guildId}:roles`)
        .setLabel("Set Exempt Roles")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`am_excl:${guildId}:channels`)
        .setLabel("Set Exempt Channels")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`am_back:${guildId}`)
        .setLabel("Back")
        .setStyle(ButtonStyle.Primary)
    )
  );

  container.addActionRowComponents(...navRow("exclusions"));
  return container;
}

export function buildStatisticsContainer(manager, guildId) {
  const stats7 = manager.getStats(guildId, 7);
  const stats30 = manager.getStats(guildId, 30);
  const violations = manager.getViolations(guildId, 10);

  const container = baseContainer();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("**AutoMod Statistics**\nEnforcement counters tracked by Luna.")
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Last 7 days**\nBlocked: **${stats7.blocked}** · Warnings: **${stats7.warnings}** · Timeouts: **${stats7.timeouts}** · Alerts: **${stats7.alerts}**\n\n**Last 30 days**\nBlocked: **${stats30.blocked}** · Warnings: **${stats30.warnings}** · Timeouts: **${stats30.timeouts}** · Alerts: **${stats30.alerts}**`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  const recent = violations.length
    ? violations.slice(0, 8).map(v => `> \u2022 <@${v.userId}> — ${v.ruleName} (${v.action})`).join("\n")
    : "> No recent violations";
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Recent Violations**\n${recent}`)
  );

  container.addActionRowComponents(...navRow("stats"));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("[Zynrax Development](https://discord.gg/zynrax)")
  );

  return container;
}

export function buildSettingsContainer(manager, guildId) {
  const cfg = manager.getGuildDB(guildId);
  const container = baseContainer();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Server Settings**\nLog channel: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : "not set"}\nNotifications: ${cfg.notificationsEnabled ? "on" : "off"} · DM offenders: ${cfg.dmEnabled ? "on" : "off"}\nEscalation: ${cfg.escalationEnabled ? "on" : "off"}`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`am_set:${guildId}:logchannel`)
        .setLabel("Set Log Channel")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`am_set:${guildId}:notify`)
        .setLabel(cfg.notificationsEnabled ? "Notifications: ON" : "Notifications: OFF")
        .setStyle(cfg.notificationsEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`am_set:${guildId}:dm`)
        .setLabel(cfg.dmEnabled ? "DM Offenders: ON" : "DM Offenders: OFF")
        .setStyle(cfg.dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`am_set:${guildId}:escalation`)
        .setLabel(cfg.escalationEnabled ? "Escalation: ON" : "Escalation: OFF")
        .setStyle(cfg.escalationEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
    )
  );

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`am_set:${guildId}:advanced`)
        .setLabel("Advanced")
        .setStyle(ButtonStyle.Secondary)
    )
  );
  container.addActionRowComponents(...navRow("settings"));
  return container;
}

export function buildLogsContainer(manager, guildId) {
  const violations = manager.getViolations(guildId, 20);
  const container = baseContainer();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("**Recent AutoMod Logs**\nThe latest enforcement events in this server.")
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  const lines = violations.length
    ? violations.map(v => `\u2022 <@${v.userId}> · **${v.ruleName}** · \`${v.action}\` · <t:${Math.floor(new Date(v.createdAt).getTime() / 1000)}:R>`).join("\n")
    : "> No logged violations yet.";

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
  container.addActionRowComponents(...navRow("logs"));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("[Zynrax Development](https://discord.gg/zynrax)")
  );

  return container;
}

export function buildAdvancedConfigModal(guildId, type) {
  const modules = [
    { label: "Keyword Filter", value: "keyword" },
    { label: "Mention Spam", value: "mention" },
    { label: "Profanity Preset", value: "preset" },
    { label: "Spam Protection", value: "spam" }
  ];

  return new ModalBuilder()
    .setCustomId(`am_cfg_modal:${guildId}:${type}`)
    .setTitle("AutoMod Configuration")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Configure AutoMod\nSet the action mode for this rule.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Action Mode")
        .setDescription("Choose what happens when a rule is triggered")
        .setRadioGroupComponent(
          new RadioGroupBuilder()
            .setCustomId("automod_mode")
            .addOptions(
              new RadioGroupOptionBuilder().setLabel("Block message").setValue("block").setDescription("Remove the offending message"),
              new RadioGroupOptionBuilder().setLabel("Timeout").setValue("timeout").setDescription("Apply a temporary timeout"),
              new RadioGroupOptionBuilder().setLabel("Alert only").setValue("alert").setDescription("Only notify moderators")
            )
        ),
      new LabelBuilder()
        .setLabel("Modules")
        .setDescription("Modules to enable")
        .setCheckboxGroupComponent(
          new CheckboxGroupBuilder()
            .setCustomId("automod_modules")
            .setMinValues(1)
            .addOptions(
              ...modules.map(m => new CheckboxGroupOptionBuilder().setLabel(m.label).setValue(m.value).setDefault(true))
            )
        )
    );
}

export function buildSettingsModal(guildId) {
  return new ModalBuilder()
    .setCustomId(`am_settings_modal:${guildId}`)
    .setTitle("AutoMod Settings")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Server Settings\nToggle optional AutoMod behaviors.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Notifications")
        .setDescription("Send an alert when a rule triggers")
        .setRadioGroupComponent(
          new RadioGroupBuilder()
            .setCustomId("automod_notify")
            .addOptions(
              new RadioGroupOptionBuilder().setLabel("Enabled").setValue("on"),
              new RadioGroupOptionBuilder().setLabel("Disabled").setValue("off")
            )
        ),
      new LabelBuilder()
        .setLabel("DM Offenders")
        .setDescription("Send the user a direct message")
        .setRadioGroupComponent(
          new RadioGroupBuilder()
            .setCustomId("automod_dm")
            .addOptions(
              new RadioGroupOptionBuilder().setLabel("Enabled").setValue("on"),
              new RadioGroupOptionBuilder().setLabel("Disabled").setValue("off")
            )
        ),
      new LabelBuilder()
        .setLabel("Escalation")
        .setDescription("Auto-timeout repeat offenders")
        .setRadioGroupComponent(
          new RadioGroupBuilder()
            .setCustomId("automod_esc")
            .addOptions(
              new RadioGroupOptionBuilder().setLabel("Enabled").setValue("on"),
              new RadioGroupOptionBuilder().setLabel("Disabled").setValue("off")
            )
        )
    );
}
