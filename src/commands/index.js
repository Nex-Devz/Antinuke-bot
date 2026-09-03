import { SlashCommandBuilder, ApplicationCommandOptionType, PermissionFlagsBits, ComponentType, TextInputStyle } from 'discord.js';

const MODULES = [
  'roleDelete', 'roleUpdate', 'roleMassCreate', 'roleMassDelete', 'roleMassUpdate',
  'channelDelete', 'channelUpdate', 'channelMassCreate', 'channelMassDelete',
  'botAdd', 'botKick', 'botBan', 'botOwnerRemove',
  'memberBan', 'memberKick', 'memberPrune', 'memberRoleAdd', 'memberRoleRemove',
  'webhookCreate', 'webhookDelete'
];

const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];
const PUNISHMENT_ACTIONS = ['none', 'warn', 'mute', 'kick', 'ban', 'quarantine'];

const securityCommand = new SlashCommandBuilder()
  .setName('security')
  .setDescription('AntiN8 security commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('setup').setDescription('Initialize security for the server'))
  .addSubcommand(sub =>
    sub.setName('status').setDescription('Show security status dashboard'))
  .addSubcommand(sub =>
    sub.setName('config').setDescription('View/edit configuration'))
  .addSubcommandGroup(group =>
    group
      .setName('whitelist')
      .setDescription('Whitelist management')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('Add to whitelist')
          .addOption(opt =>
            opt
              .setName('target')
              .setDescription('User or role to whitelist')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Mentionable))
          .addOption(opt =>
            opt
              .setName('actions')
              .setDescription('Comma-separated actions (e.g., roleDelete,channelDelete)')
              .setRequired(false)))
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription('Remove from whitelist')
          .addOption(opt =>
            opt
              .setName('target')
              .setDescription('User or role to remove')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Mentionable)))
      .addSubcommand(sub =>
        sub.setName('list').setDescription('Show whitelist entries')))
  .addSubcommandGroup(group =>
    group
      .setName('owner')
      .setDescription('Extra owner management')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('Add extra owner')
          .addOption(opt =>
            opt
              .setName('user')
              .setDescription('User to add as owner')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.User)))
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription('Remove extra owner')
          .addOption(opt =>
            opt
              .setName('user')
              .setDescription('User to remove from owners')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.User)))
      .addSubcommand(sub =>
        sub.setName('list').setDescription('Show extra owners')))
  .addSubcommandGroup(group =>
    group
      .setName('protection')
      .setDescription('Module protection settings')
      .addSubcommand(sub =>
        sub
          .setName('enable')
          .setDescription('Enable a protection module')
          .addOption(opt =>
            opt
              .setName('module')
              .setDescription('Module to enable')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.String)
              .addChoices(...MODULES.map(m => ({ name: m, value: m })))))
      .addSubcommand(sub =>
        sub
          .setName('disable')
          .setDescription('Disable a protection module')
          .addOption(opt =>
            opt
              .setName('module')
              .setDescription('Module to disable')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.String)
              .addChoices(...MODULES.map(m => ({ name: m, value: m })))))
      .addSubcommand(sub =>
        sub
          .setName('toggle')
          .setDescription('Toggle a protection module')
          .addOption(opt =>
            opt
              .setName('module')
              .setDescription('Module to toggle')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.String)
              .addChoices(...MODULES.map(m => ({ name: m, value: m }))))))
  .addSubcommandGroup(group =>
    group
      .setName('thresholds')
      .setDescription('Threshold settings')
      .addSubcommand(sub =>
        sub
          .setName('ban')
          .setDescription('Set ban thresholds')
          .addOption(opt =>
            opt
              .setName('timeframe')
              .setDescription('Time window in seconds')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(3600))
          .addOption(opt =>
            opt
              .setName('count')
              .setDescription('Action count threshold')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(50)))
      .addSubcommand(sub =>
        sub
          .setName('kick')
          .setDescription('Set kick thresholds')
          .addOption(opt =>
            opt
              .setName('timeframe')
              .setDescription('Time window in seconds')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(3600))
          .addOption(opt =>
            opt
              .setName('count')
              .setDescription('Action count threshold')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(50)))
      .addSubcommand(sub =>
        sub
          .setName('channel')
          .setDescription('Set channel thresholds')
          .addOption(opt =>
            opt
              .setName('timeframe')
              .setDescription('Time window in seconds')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(3600))
          .addOption(opt =>
            opt
              .setName('count')
              .setDescription('Action count threshold')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(50)))
      .addSubcommand(sub =>
        sub
          .setName('role')
          .setDescription('Set role thresholds')
          .addOption(opt =>
            opt
              .setName('timeframe')
              .setDescription('Time window in seconds')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(3600))
          .addOption(opt =>
            opt
              .setName('count')
              .setDescription('Action count threshold')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.Integer)
              .setMinValue(1)
              .setMaxValue(50))))
  .addSubcommandGroup(group =>
    group
      .setName('punishments')
      .setDescription('Punishment settings')
      .addSubcommand(sub =>
        sub
          .setName('set')
          .setDescription('Set punishment for severity')
          .addOption(opt =>
            opt
              .setName('severity')
              .setDescription('Severity level')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.String)
              .addChoices(...SEVERITY_LEVELS.map(s => ({ name: s, value: s }))))
          .addOption(opt =>
            opt
              .setName('action')
              .setDescription('Punishment action')
              .setRequired(true)
              .addApplicationCommandOptionType(ApplicationCommandOptionType.String)
              .addChoices(...PUNISHMENT_ACTIONS.map(a => ({ name: a, value: a })))))
      .addSubcommand(sub =>
        sub.setName('view').setDescription('View current punishments')))
  .addSubcommand(sub =>
    sub.setName('incidents').setDescription('View recent incidents'))
  .addSubcommand(sub =>
    sub.setName('logs').setDescription('View security logs'))
  .addSubcommand(sub =>
    sub.setName('lockdown').setDescription('Activate lockdown mode'))
  .addSubcommand(sub =>
    sub.setName('unlock').setDescription('Deactivate lockdown mode'))
  .addSubcommandGroup(group =>
    group
      .setName('protected')
      .setDescription('Protected resource management')
      .addSubcommandGroup(inner =>
        inner
          .setName('role')
          .setDescription('Manage protected roles')
          .addSubcommand(sub =>
            sub
              .setName('add')
              .setDescription('Add protected role')
              .addOption(opt =>
                opt
                  .setName('role')
                  .setDescription('Role to protect')
                  .setRequired(true)
                  .addApplicationCommandOptionType(ApplicationCommandOptionType.Role)))
          .addSubcommand(sub =>
            sub
              .setName('remove')
              .setDescription('Remove protected role')
              .addOption(opt =>
                opt
                  .setName('role')
                  .setDescription('Role to unprotect')
                  .setRequired(true)
                  .addApplicationCommandOptionType(ApplicationCommandOptionType.Role)))
          .addSubcommand(sub =>
            sub.setName('list').setDescription('List protected roles')))
      .addSubcommandGroup(inner =>
        inner
          .setName('channel')
          .setDescription('Manage protected channels')
          .addSubcommand(sub =>
            sub
              .setName('add')
              .setDescription('Add protected channel')
              .addOption(opt =>
                opt
                  .setName('channel')
                  .setDescription('Channel to protect')
                  .setRequired(true)
                  .addApplicationCommandOptionType(ApplicationCommandOptionType.Channel)))
          .addSubcommand(sub =>
            sub
              .setName('remove')
              .setDescription('Remove protected channel')
              .addOption(opt =>
                opt
                  .setName('channel')
                  .setDescription('Channel to unprotect')
                  .setRequired(true)
                  .addApplicationCommandOptionType(ApplicationCommandOptionType.Channel)))
          .addSubcommand(sub =>
            sub.setName('list').setDescription('List protected channels')))
      .addSubcommandGroup(inner =>
        inner
          .setName('webhook')
          .setDescription('Manage protected webhooks')
          .addSubcommand(sub =>
            sub
              .setName('add')
              .setDescription('Add protected webhook')
              .addOption(opt =>
                opt
                  .setName('webhook_id')
                  .setDescription('Webhook ID to protect')
                  .setRequired(true)
                  .addApplicationCommandOptionType(ApplicationCommandOptionType.String)))
          .addSubcommand(sub =>
            sub
              .setName('remove')
              .setDescription('Remove protected webhook')
              .addOption(opt =>
                opt
                  .setName('webhook_id')
                  .setDescription('Webhook ID to unprotect')
                  .setRequired(true)
                  .addApplicationCommandOptionType(ApplicationCommandOptionType.String)))
          .addSubcommand(sub =>
            sub.setName('list').setDescription('List protected webhooks'))));

const commandDefinitions = [securityCommand.toJSON()];

function buildStatusEmbed(config, enabledModules) {
  const enabled = MODULES.filter(m => enabledModules?.[m]);
  const disabled = MODULES.filter(m => !enabledModules?.[m]);
  return {
    title: 'Security Status',
    color: 0x5865f2,
    fields: [
      { name: 'Enabled Modules', value: enabled.length ? enabled.join(', ') : 'None', inline: false },
      { name: 'Disabled Modules', value: disabled.length ? disabled.join(', ') : 'None', inline: false },
      { name: 'Lockdown', value: config?.lockdown ? 'Active' : 'Inactive', inline: true },
      { name: 'Whitelisted', value: String(config?.whitelistCount ?? 0), inline: true },
      { name: 'Protected Roles', value: String(config?.protectedRoles ?? 0), inline: true },
      { name: 'Protected Channels', value: String(config?.protectedChannels ?? 0), inline: true }
    ]
  };
}

function buildWhitelistEmbed(entries) {
  if (!entries?.length) return { description: 'No whitelist entries.', color: 0xfee75c };
  return {
    title: 'Whitelist',
    color: 0x57f287,
    fields: entries.map(e => ({
      name: e.type === 'user' ? `<@${e.id}>` : e.type === 'role' ? `<@&${e.id}>` : `Bot: ${e.id}`,
      value: e.actions?.join(', ') || 'All actions',
      inline: true
    }))
  };
}

function buildOwnerEmbed(owners) {
  if (!owners?.length) return { description: 'No extra owners configured.', color: 0xfee75c };
  return {
    title: 'Extra Owners',
    color: 0x57f287,
    description: owners.map(id => `<@${id}>`).join('\n')
  };
}

function buildProtectedEmbed(items, label) {
  if (!items?.length) return { description: `No protected ${label}.`, color: 0xfee75c };
  return {
    title: `Protected ${label}`,
    color: 0x57f287,
    description: items.map(id => `<#${id}>`).join('\n')
  };
}

function buildIncidentsEmbed(incidents) {
  if (!incidents?.length) return { description: 'No recent incidents.', color: 0x57f287 };
  return {
    title: 'Recent Incidents',
    color: 0xed4245,
    fields: incidents.slice(0, 25).map(i => ({
      name: `${i.action} - ${new Date(i.timestamp).toLocaleString()}`,
      value: `By: <@${i.executorId}> | Severity: ${i.severity}`,
      inline: false
    }))
  };
}

function buildLogsEmbed(logs) {
  if (!logs?.length) return { description: 'No security logs.', color: 0x57f287 };
  return {
    title: 'Security Logs',
    color: 0x5865f2,
    fields: logs.slice(0, 25).map(l => ({
      name: l.action,
      value: `By: <@${l.executorId}> | ${new Date(l.timestamp).toLocaleString()}`,
      inline: true
    }))
  };
}

function buildPunishmentsEmbed(punishments) {
  if (!punishments || !Object.keys(punishments).length) {
    return { description: 'No punishments configured.', color: 0xfee75c };
  }
  return {
    title: 'Punishment Configuration',
    color: 0xed4245,
    fields: Object.entries(punishments).map(([severity, action]) => ({
      name: severity.charAt(0).toUpperCase() + severity.slice(1),
      value: action,
      inline: true
    }))
  };
}

function buildThresholdsEmbed(thresholds) {
  if (!thresholds) return { description: 'No thresholds configured.', color: 0xfee75c };
  return {
    title: 'Threshold Configuration',
    color: 0x5865f2,
    fields: Object.entries(thresholds).map(([type, t]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: `${t.count} actions / ${t.timeframe}s`,
      inline: true
    }))
  };
}

function buildConfigEmbed(config) {
  return {
    title: 'Server Configuration',
    color: 0x5865f2,
    fields: [
      { name: 'Lockdown', value: config?.lockdown ? 'Active' : 'Inactive', inline: true },
      { name: 'Log Channel', value: config?.logChannel ? `<#${config.logChannel}>` : 'Not set', inline: true },
      { name: 'Alert Channel', value: config?.alertChannel ? `<#${config.alertChannel}>` : 'Not set', inline: true }
    ]
  };
}

function isAdmin(interaction) {
  return interaction.member.permissions.has(PermissionFlagsBits.Administrator);
}

function hasManageGuild(interaction) {
  return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) || isAdmin(interaction);
}

async function handleSetup(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;

  const existing = await database.getGuildConfig(guildId);
  if (existing?.initialized) {
    return interaction.reply({ content: 'Security already initialized.', ephemeral: true });
  }

  await database.initGuildConfig(guildId);
  cache.set(`config:${guildId}`, await database.getGuildConfig(guildId));

  return interaction.reply({ content: 'Security initialized successfully.', ephemeral: true });
}

async function handleStatus(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;

  let config = cache.get(`config:${guildId}`);
  if (!config) {
    config = await database.getGuildConfig(guildId);
    if (config) cache.set(`config:${guildId}`, config);
  }

  const embed = buildStatusEmbed(config, config?.modules);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleConfig(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;

  let config = cache.get(`config:${guildId}`);
  if (!config) {
    config = await database.getGuildConfig(guildId);
    if (config) cache.set(`config:${guildId}`, config);
  }

  const embed = buildConfigEmbed(config);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleWhitelistAdd(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache, whitelistManager } = context;
  const guildId = interaction.guildId;
  const target = interaction.options.getMentionable('target', true);
  const actionsRaw = interaction.options.getString('actions');
  const actions = actionsRaw ? actionsRaw.split(',').map(a => a.trim()).filter(Boolean) : null;

  const targetType = target.bot ? 'bot' : target.type === 1 ? 'user' : 'role';
  await whitelistManager.add(guildId, target.id, targetType, actions);

  return interaction.reply({ content: `Added <@${target.id}> to whitelist.`, ephemeral: true });
}

async function handleWhitelistRemove(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { whitelistManager } = context;
  const guildId = interaction.guildId;
  const target = interaction.options.getMentionable('target', true);

  await whitelistManager.remove(guildId, target.id);
  return interaction.reply({ content: `Removed <@${target.id}> from whitelist.`, ephemeral: true });
}

async function handleWhitelistList(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const entries = await database.getWhitelist(guildId);

  const embed = buildWhitelistEmbed(entries);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleOwnerAdd(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { ownerManager } = context;
  const guildId = interaction.guildId;
  const user = interaction.options.getUser('user', true);

  await ownerManager.add(guildId, user.id);
  return interaction.reply({ content: `Added <@${user.id}> as extra owner.`, ephemeral: true });
}

async function handleOwnerRemove(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { ownerManager } = context;
  const guildId = interaction.guildId;
  const user = interaction.options.getUser('user', true);

  await ownerManager.remove(guildId, user.id);
  return interaction.reply({ content: `Removed <@${user.id}> from extra owners.`, ephemeral: true });
}

async function handleOwnerList(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const owners = await database.getOwners(guildId);

  const embed = buildOwnerEmbed(owners);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleProtectionEnable(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;
  const module = interaction.options.getString('module', true);

  await database.setModule(guildId, module, true);
  const config = cache.get(`config:${guildId}`);
  if (config?.modules) config.modules[module] = true;
  cache.set(`config:${guildId}`, config);

  return interaction.reply({ content: `Enabled module: ${module}`, ephemeral: true });
}

async function handleProtectionDisable(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;
  const module = interaction.options.getString('module', true);

  await database.setModule(guildId, module, false);
  const config = cache.get(`config:${guildId}`);
  if (config?.modules) config.modules[module] = false;
  cache.set(`config:${guildId}`, config);

  return interaction.reply({ content: `Disabled module: ${module}`, ephemeral: true });
}

async function handleProtectionToggle(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;
  const module = interaction.options.getString('module', true);

  const config = cache.get(`config:${guildId}`) || await database.getGuildConfig(guildId);
  const current = config?.modules?.[module] || false;
  const newState = !current;

  await database.setModule(guildId, module, newState);
  if (!config.modules) config.modules = {};
  config.modules[module] = newState;
  cache.set(`config:${guildId}`, config);

  return interaction.reply({
    content: `Module ${module} is now ${newState ? 'enabled' : 'disabled'}.`,
    ephemeral: true
  });
}

async function handleThresholds(interaction, context, type) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;
  const timeframe = interaction.options.getInteger('timeframe', true);
  const count = interaction.options.getInteger('count', true);

  await database.setThreshold(guildId, type, { timeframe, count });

  let config = cache.get(`config:${guildId}`);
  if (config) {
    if (!config.thresholds) config.thresholds = {};
    config.thresholds[type] = { timeframe, count };
    cache.set(`config:${guildId}`, config);
  }

  return interaction.reply({
    content: `Set ${type} threshold: ${count} actions / ${timeframe}s`,
    ephemeral: true
  });
}

async function handlePunishmentsSet(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;
  const severity = interaction.options.getString('severity', true);
  const action = interaction.options.getString('action', true);

  await database.setPunishment(guildId, severity, action);

  let config = cache.get(`config:${guildId}`);
  if (config) {
    if (!config.punishments) config.punishments = {};
    config.punishments[severity] = action;
    cache.set(`config:${guildId}`, config);
  }

  return interaction.reply({
    content: `Set ${severity} punishment to: ${action}`,
    ephemeral: true
  });
}

async function handlePunishmentsView(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const config = await database.getGuildConfig(guildId);

  const embed = buildPunishmentsEmbed(config?.punishments);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleIncidents(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const incidents = await database.getIncidents(guildId, 25);

  const embed = buildIncidentsEmbed(incidents);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLogs(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const logs = await database.getLogs(guildId, 25);

  const embed = buildLogsEmbed(logs);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLockdown(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;

  await database.setLockdown(guildId, true);
  let config = cache.get(`config:${guildId}`);
  if (config) {
    config.lockdown = true;
    cache.set(`config:${guildId}`, config);
  }

  return interaction.reply({ content: 'Lockdown mode activated.', ephemeral: true });
}

async function handleUnlock(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database, cache } = context;
  const guildId = interaction.guildId;

  await database.setLockdown(guildId, false);
  let config = cache.get(`config:${guildId}`);
  if (config) {
    config.lockdown = false;
    cache.set(`config:${guildId}`, config);
  }

  return interaction.reply({ content: 'Lockdown mode deactivated.', ephemeral: true });
}

async function handleProtectedRoleAdd(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const role = interaction.options.getRole('role', true);

  await database.addProtected(guildId, 'roles', role.id);
  return interaction.reply({ content: `Protected role: <@&${role.id}>`, ephemeral: true });
}

async function handleProtectedRoleRemove(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const role = interaction.options.getRole('role', true);

  await database.removeProtected(guildId, 'roles', role.id);
  return interaction.reply({ content: `Unprotected role: <@&${role.id}>`, ephemeral: true });
}

async function handleProtectedRoleList(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const roles = await database.getProtected(guildId, 'roles');

  const embed = buildProtectedEmbed(roles, 'Roles');
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleProtectedChannelAdd(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel('channel', true);

  await database.addProtected(guildId, 'channels', channel.id);
  return interaction.reply({ content: `Protected channel: <#${channel.id}>`, ephemeral: true });
}

async function handleProtectedChannelRemove(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel('channel', true);

  await database.removeProtected(guildId, 'channels', channel.id);
  return interaction.reply({ content: `Unprotected channel: <#${channel.id}>`, ephemeral: true });
}

async function handleProtectedChannelList(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const channels = await database.getProtected(guildId, 'channels');

  const embed = buildProtectedEmbed(channels, 'Channels');
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleProtectedWebhookAdd(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const webhookId = interaction.options.getString('webhook_id', true);

  if (!/^\d+$/.test(webhookId)) {
    return interaction.reply({ content: 'Invalid webhook ID.', ephemeral: true });
  }

  await database.addProtected(guildId, 'webhooks', webhookId);
  return interaction.reply({ content: `Protected webhook: ${webhookId}`, ephemeral: true });
}

async function handleProtectedWebhookRemove(interaction, context) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const webhookId = interaction.options.getString('webhook_id', true);

  await database.removeProtected(guildId, 'webhooks', webhookId);
  return interaction.reply({ content: `Unprotected webhook: ${webhookId}`, ephemeral: true });
}

async function handleProtectedWebhookList(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const webhooks = await database.getProtected(guildId, 'webhooks');

  if (!webhooks?.length) {
    return interaction.reply({ content: 'No protected webhooks.', ephemeral: true });
  }

  return interaction.reply({
    content: `Protected webhooks:\n${webhooks.map(id => `\`${id}\``).join('\n')}`,
    ephemeral: true
  });
}

async function handleThresholdsView(interaction, context) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
  }
  const { database } = context;
  const guildId = interaction.guildId;
  const config = await database.getGuildConfig(guildId);

  const embed = buildThresholdsEmbed(config?.thresholds);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCommand(interaction, context) {
  if (!interaction.isChatInputCommand()) return false;

  const { commandName, options } = interaction;

  if (commandName !== 'security') return false;

  const subcommand = options.getSubcommand(false);
  const subcommandGroup = options.getSubcommandGroup(false);

  try {
    if (!subcommandGroup && !subcommand) {
      return false;
    }

    if (!subcommandGroup) {
      switch (subcommand) {
        case 'setup': return handleSetup(interaction, context);
        case 'status': return handleStatus(interaction, context);
        case 'config': return handleConfig(interaction, context);
        case 'incidents': return handleIncidents(interaction, context);
        case 'logs': return handleLogs(interaction, context);
        case 'lockdown': return handleLockdown(interaction, context);
        case 'unlock': return handleUnlock(interaction, context);
        default: return false;
      }
    }

    switch (subcommandGroup) {
      case 'whitelist':
        switch (subcommand) {
          case 'add': return handleWhitelistAdd(interaction, context);
          case 'remove': return handleWhitelistRemove(interaction, context);
          case 'list': return handleWhitelistList(interaction, context);
          default: return false;
        }

      case 'owner':
        switch (subcommand) {
          case 'add': return handleOwnerAdd(interaction, context);
          case 'remove': return handleOwnerRemove(interaction, context);
          case 'list': return handleOwnerList(interaction, context);
          default: return false;
        }

      case 'protection':
        switch (subcommand) {
          case 'enable': return handleProtectionEnable(interaction, context);
          case 'disable': return handleProtectionDisable(interaction, context);
          case 'toggle': return handleProtectionToggle(interaction, context);
          default: return false;
        }

      case 'thresholds':
        switch (subcommand) {
          case 'ban': return handleThresholds(interaction, context, 'ban');
          case 'kick': return handleThresholds(interaction, context, 'kick');
          case 'channel': return handleThresholds(interaction, context, 'channel');
          case 'role': return handleThresholds(interaction, context, 'role');
          case 'view': return handleThresholdsView(interaction, context);
          default: return false;
        }

      case 'punishments':
        switch (subcommand) {
          case 'set': return handlePunishmentsSet(interaction, context);
          case 'view': return handlePunishmentsView(interaction, context);
          default: return false;
        }

      case 'protected': {
        const innerGroup = options.getSubcommandGroup(false, true);
        switch (innerGroup) {
          case 'role':
            switch (subcommand) {
              case 'add': return handleProtectedRoleAdd(interaction, context);
              case 'remove': return handleProtectedRoleRemove(interaction, context);
              case 'list': return handleProtectedRoleList(interaction, context);
              default: return false;
            }
          case 'channel':
            switch (subcommand) {
              case 'add': return handleProtectedChannelAdd(interaction, context);
              case 'remove': return handleProtectedChannelRemove(interaction, context);
              case 'list': return handleProtectedChannelList(interaction, context);
              default: return false;
            }
          case 'webhook':
            switch (subcommand) {
              case 'add': return handleProtectedWebhookAdd(interaction, context);
              case 'remove': return handleProtectedWebhookRemove(interaction, context);
              case 'list': return handleProtectedWebhookList(interaction, context);
              default: return false;
            }
          default: return false;
        }
      }

      default: return false;
    }
  } catch (error) {
    console.error('Command error:', error);
    const content = 'An error occurred while executing this command.';
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content, ephemeral: true });
    }
    return interaction.reply({ content, ephemeral: true });
  }
}

export { commandDefinitions, handleCommand };
