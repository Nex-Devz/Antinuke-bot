import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  LabelBuilder,
  ModalBuilder
} from "discord.js";
import { RULE_TYPES } from "./AutoModManager.js";
import {
  buildOverviewContainer,
  buildModulesContainer,
  buildConfigureContainer,
  buildRulesContainer,
  buildExclusionsContainer,
  buildStatisticsContainer,
  buildSettingsContainer,
  buildLogsContainer,
  buildAdvancedConfigModal,
  buildSettingsModal
} from "./dashboard.js";

export const automodCommand = new SlashCommandBuilder()
  .setName("automod")
  .setDescription("Open the AutoMod dashboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName("overview")
    .setDescription("Show AutoMod overview"))
  .addSubcommand(sub => sub
    .setName("modules")
    .setDescription("Manage protection modules"))
  .addSubcommand(sub => sub
    .setName("rules")
    .setDescription("List created rules"))
  .addSubcommand(sub => sub
    .setName("stats")
    .setDescription("Show AutoMod statistics"))
  .addSubcommand(sub => sub
    .setName("logs")
    .setDescription("Show recent enforcement logs"));

function errorContainer(text) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Luna\n${text}`)
    );
}

export function pageForSubcommand(manager, guildId, sub) {
  switch (sub) {
    case "modules":
      return buildModulesContainer(manager, guildId);
    case "rules":
      return buildRulesContainer(manager, guildId);
    case "stats":
      return buildStatisticsContainer(manager, guildId);
    case "logs":
      return buildLogsContainer(manager, guildId);
    case "overview":
    default:
      return buildOverviewContainer(manager, guildId);
  }
}

export async function handleAutoModCommand(interaction, context) {
  const { automodManager } = context;
  if (!automodManager) return false;
  if (interaction.commandName !== "automod") return false;

  const guildId = interaction.guildId;
  if (!automodManager.hasPermission(interaction.member)) {
    return interaction.reply({
      components: [errorContainer("Administrator permission required.")],
      flags: 32768,
      ephemeral: true
    });
  }

  await automodManager.ensureRules(guildId);
  const sub = interaction.options.getSubcommand() || "overview";
  const container = pageForSubcommand(automodManager, guildId, sub);
  return interaction.reply({
    components: [container],
    flags: 32768,
    ephemeral: true
  });
}

export async function handleAutoModButton(interaction, context) {
  const { automodManager } = context;
  if (!automodManager) return false;
  if (!interaction.customId.startsWith("am_")) return false;

  const guildId = interaction.guildId;
  if (!automodManager.hasPermission(interaction.member)) {
    return interaction.reply({
      content: "Administrator permission required.",
      ephemeral: true
    });
  }

  const [prefix, ...rest] = interaction.customId.split(":");
  const id = interaction.customId;

  const ensure = async (sub) => {
    await automodManager.ensureRules(guildId);
    return pageForSubcommand(automodManager, guildId, sub);
  };

  if (prefix === "am_nav") {
    const page = rest[0];
    if (page === "configure") {
      return interaction.update({ components: [buildConfigureContainer(automodManager, guildId, "keyword")], flags: 32768 });
    }
    if (page === "exclusions") {
      return interaction.update({ components: [buildExclusionsContainer(automodManager, guildId, "keyword")], flags: 32768 });
    }
    return interaction.update({ components: [await ensure(page)], flags: 32768 });
  }

  if (prefix === "am_back") {
    return interaction.update({ components: [await ensure("overview")], flags: 32768 });
  }

  if (prefix === "am_toggle_all") {
    const cfg = automodManager.getGuildDB(guildId);
    cfg.enabled = !cfg.enabled;
    automodManager.saveGuildDB(guildId, cfg);
    return interaction.update({ components: [buildOverviewContainer(automodManager, guildId)], flags: 32768 });
  }

  if (prefix === "am_mod") {
    const [gid, type, action] = rest;
    if (gid !== guildId) return false;
    if (action === "on" || action === "off") {
      await automodManager.toggleRule(guildId, type, action === "on");
    } else if (action === "advanced") {
      return interaction.showModal(buildAdvancedConfigModal(guildId, type));
    }
    const rules = automodManager.getRules(guildId);
    return interaction.update({ components: [buildConfigureContainer(automodManager, guildId, type)], flags: 32768 });
  }

  if (prefix === "am_cfg") {
    const [gid, type, ...cmd] = rest;
    if (gid !== guildId) return false;
    if (cmd[0] === "advanced") {
      return interaction.showModal(buildAdvancedConfigModal(guildId, type));
    }
    if (cmd[0] === "mode") {
      await automodManager.updateRuleConfig(guildId, type, { mode: cmd[1] });
      return interaction.update({ components: [buildConfigureContainer(automodManager, guildId, type)], flags: 32768 });
    }
    if (cmd.length === 0) {
      return interaction.update({ components: [buildConfigureContainer(automodManager, guildId, type)], flags: 32768 });
    }
    return false;
  }

  if (prefix === "am_sync") {
    await automodManager.provision(guildId);
    return interaction.update({ components: [buildRulesContainer(automodManager, guildId)], flags: 32768 });
  }

  if (prefix === "am_set") {
    const [gid, key] = rest;
    if (gid !== guildId) return false;
    const cfg = automodManager.getGuildDB(guildId);
    if (key === "logchannel") {
      return interaction.showModal(modalForLogChannel(guildId));
    }
    if (key === "notify") cfg.notificationsEnabled = !cfg.notificationsEnabled;
    else if (key === "dm") cfg.dmEnabled = !cfg.dmEnabled;
    else if (key === "escalation") cfg.escalationEnabled = !cfg.escalationEnabled;
    else if (key === "advanced") return interaction.showModal(buildSettingsModal(guildId));
    automodManager.saveGuildDB(guildId, cfg);
    return interaction.update({ components: [buildSettingsContainer(automodManager, guildId)], flags: 32768 });
  }

  if (prefix === "am_excl") {
    const [gid, kind] = rest;
    if (gid !== guildId) return false;
    return interaction.showModal(modalForExclusions(guildId, kind));
  }

  if (id.startsWith("am_mod_select:")) return false;
  if (id.startsWith("am_excl_modal:")) return false;
  if (id.startsWith("am_set_modal:")) return false;

  return false;
}

export async function handleAutoModModal(interaction, context) {
  const { automodManager } = context;
  if (!automodManager) return false;

  const guildId = interaction.guildId;
  const modalId = interaction.customId;
  if (!modalId.startsWith("am_")) return false;

  if (!automodManager.hasPermission(interaction.member)) {
    return interaction.reply({
      content: "Administrator permission required.",
      ephemeral: true
    });
  }

  if (modalId.startsWith("am_cfg_modal:")) {
    const [, gid, type] = modalId.split(":");
    if (gid !== guildId) return false;
    let mode = "block";
    try {
      mode = interaction.fields.getRadioGroup("automod_mode", true);
    } catch {
      mode = "block";
    }
    await automodManager.updateRuleConfig(guildId, type, { mode });
    return interaction.reply({
      content: `AutoMod rule **${type}** configured with action: **${mode}**.`,
      components: [buildConfigureContainer(automodManager, guildId, type)],
      flags: 32768,
      ephemeral: true
    });
  }

  if (modalId.startsWith("am_settings_modal:")) {
    const [, gid] = modalId.split(":");
    if (gid !== guildId) return false;
    const read = (id, fallback) => {
      try {
        return interaction.fields.getRadioGroup(id, true) || fallback;
      } catch {
        return fallback;
      }
    };
    const cfg = automodManager.getGuildDB(guildId);
    cfg.notificationsEnabled = read("automod_notify", "on") === "on";
    cfg.dmEnabled = read("automod_dm", "off") === "on";
    cfg.escalationEnabled = read("automod_esc", "on") === "on";
    automodManager.saveGuildDB(guildId, cfg);
    return interaction.reply({
      content: "AutoMod settings updated.",
      components: [buildSettingsContainer(automodManager, guildId)],
      flags: 32768,
      ephemeral: true
    });
  }

  if (modalId.startsWith("am_excl_modal:")) {
    const [, gid, type, kind] = modalId.split(":");
    if (gid !== guildId) return false;
    try {
      if (kind === "roles") {
        const roles = interaction.fields.getSelectedRoles("am_excl_roles");
        await automodManager.setExemptRoles(guildId, type, roles.map(r => r.id));
      } else if (kind === "channels") {
        const channels = interaction.fields.getSelectedChannels("am_excl_channels");
        await automodManager.setExemptChannels(guildId, type, channels.map(c => c.id));
      }
    } catch (err) {
      console.error("[AutoMod] Exclusion modal error:", err.message);
    }
    return interaction.reply({
      content: "Exclusions updated.",
      components: [buildExclusionsContainer(automodManager, guildId, type)],
      flags: 32768,
      ephemeral: true
    });
  }

  if (modalId.startsWith("am_set_modal:")) {
    const [, gid, key] = modalId.split(":");
    if (gid !== guildId) return false;
    if (key === "logchannel") {
      try {
        const channels = interaction.fields.getSelectedChannels("am_log_channel");
        const channel = channels?.first?.();
        if (channel) {
          const cfg = automodManager.getGuildDB(guildId);
          cfg.logChannelId = channel.id;
          automodManager.saveGuildDB(guildId, cfg);
        }
      } catch (err) {
        console.error("[AutoMod] Log channel modal error:", err.message);
      }
    }
    return interaction.reply({
      content: "Settings updated.",
      components: [buildSettingsContainer(automodManager, guildId)],
      flags: 32768,
      ephemeral: true
    });
  }

  return false;
}

export async function handleAutoModSelect(interaction, context) {
  const { automodManager } = context;
  if (!automodManager) return false;

  const guildId = interaction.guildId;

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("am_mod_select:")) {
    const [, gid] = interaction.customId.split(":");
    if (gid !== guildId) return false;
    if (!automodManager.hasPermission(interaction.member)) {
      return interaction.reply({ content: "Administrator permission required.", ephemeral: true });
    }
    const type = interaction.values[0];
    return interaction.update({ components: [buildConfigureContainer(automodManager, guildId, type)], flags: 32768 });
  }

  return false;
}

function modalForLogChannel(guildId) {
  return new ModalBuilder()
    .setCustomId(`am_set_modal:${guildId}:logchannel`)
    .setTitle("Set Log Channel")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Log Channel")
        .setDescription("Channel where AutoMod alerts and logs are sent")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId("am_log_channel")
            .setPlaceholder("Select a channel...")
            .setMinValues(1)
            .setMaxValues(1)
        )
    );
}

function modalForExclusions(guildId, kind) {
  const type = "keyword";
  const isRoles = kind === "roles";
  const title = isRoles ? "Set Exempt Roles" : "Set Exempt Channels";
  const label = new LabelBuilder()
    .setLabel(isRoles ? "Exempt Roles" : "Exempt Channels")
    .setDescription(isRoles ? "Roles not affected by AutoMod" : "Channels not affected by AutoMod");
  if (isRoles) {
    label.setRoleSelectMenuComponent(
      new RoleSelectMenuBuilder()
        .setCustomId("am_excl_roles")
        .setPlaceholder("Select roles...")
        .setMinValues(0)
        .setMaxValues(25)
    );
  } else {
    label.setChannelSelectMenuComponent(
      new ChannelSelectMenuBuilder()
        .setCustomId("am_excl_channels")
        .setPlaceholder("Select channels...")
        .setMinValues(0)
        .setMaxValues(25)
    );
  }
  return new ModalBuilder()
    .setCustomId(`am_excl_modal:${guildId}:${type}:${kind}`)
    .setTitle(title)
    .addLabelComponents(label);
}
