import { SlashCommandBuilder, ApplicationCommandOptionType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const antinukeCommand = new SlashCommandBuilder()
  .setName('antinuke')
  .setDescription('Luna anti-nuke security commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('enable')
    .setDescription('Enable anti-nuke protection'))
  .addSubcommand(sub => sub
    .setName('disable')
    .setDescription('Disable anti-nuke protection'))
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('Show security status'))
  .addSubcommand(sub => sub
    .setName('whitelist')
    .setDescription('Whitelist management')
    .addStringOption(opt => opt
      .setName('action')
      .setDescription('add or remove')
      .setRequired(true)
      .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }))
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('owner')
    .setDescription('Extra owner management')
    .addStringOption(opt => opt
      .setName('action')
      .setDescription('add or remove')
      .setRequired(true)
      .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }))
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('lockdown')
    .setDescription('Activate lockdown mode'))
  .addSubcommand(sub => sub
    .setName('unlock')
    .setDescription('Deactivate lockdown mode'));

const commandDefinitions = [antinukeCommand.toJSON()];

function buildStatusEmbed(config, state, enabled) {
  const modules = config?.modules || {};
  const moduleList = Object.entries(modules)
    .map(([k, v]) => `${k}: ${v ? 'ON' : 'OFF'}`)
    .join('\n') || 'No modules configured';

  return {
    title: 'Luna Security Status',
    description: enabled ? 'Protection is **ACTIVE**' : 'Protection is **DISABLED**',
    color: enabled ? 0x3BA55C : 0xED4245,
    fields: [
      { name: 'Modules', value: `\`\`\`\n${moduleList}\n\`\`\``, inline: false },
      { name: 'Protected Roles', value: String(state.protectedRoles.size), inline: true },
      { name: 'Protected Channels', value: String(state.protectedChannels.size), inline: true },
      { name: 'Whitelisted', value: String(state.whitelist.size), inline: true },
      { name: 'Extra Owners', value: String(state.extraOwners.size), inline: true },
      { name: 'Lockdown', value: config?.lockdown ? 'Active' : 'Inactive', inline: true }
    ],
    footer: { text: 'Zynrax Development' },
    timestamp: new Date().toISOString()
  };
}

function buildButtons(enabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('antinuke_enable')
      .setLabel('Enable')
      .setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(enabled),
    new ButtonBuilder()
      .setCustomId('antinuke_disable')
      .setLabel('Disable')
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(!enabled),
    new ButtonBuilder()
      .setCustomId('antinuke_status')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary)
  );
}

function extractUserId(input, client) {
  const mention = input.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(input)) return input;
  return null;
}

async function handleCommand(interaction, context) {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName !== 'antinuke') return false;

  const subcommand = interaction.options.getSubcommand();
  const { database, cache, whitelistManager, ownerManager } = context;
  const guildId = interaction.guildId;

  try {
    if (subcommand === 'enable') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      const existing = database.getGuildConfig(guildId);
      if (!existing) await database.initGuildConfig(guildId);
      const config = database.getGuildConfig(guildId);
      if (!config.modules) config.modules = {};
      Object.keys(config.modules).forEach(k => config.modules[k] = true);
      database.upsertSecurityConfig(guildId, config, new Date().toISOString());
      const state = cache.get(guildId);
      state.config = config;
      return interaction.reply({ content: 'Anti-nuke protection enabled.', ephemeral: true });
    }

    if (subcommand === 'disable') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      const config = database.getGuildConfig(guildId);
      if (config?.modules) Object.keys(config.modules).forEach(k => config.modules[k] = false);
      if (config) database.upsertSecurityConfig(guildId, config, new Date().toISOString());
      const state = cache.get(guildId);
      state.config = config;
      return interaction.reply({ content: 'Anti-nuke protection disabled.', ephemeral: true });
    }

    if (subcommand === 'status') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
      }
      const config = database.getGuildConfig(guildId);
      const state = cache.get(guildId);
      const enabled = config?.modules && Object.values(config.modules).some(v => v);
      const embed = buildStatusEmbed(config, state, enabled);
      const buttons = buildButtons(enabled);
      return interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    }

    if (subcommand === 'whitelist') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      const action = interaction.options.getString('action', true);
      const userInput = interaction.options.getString('user', true);
      const userId = extractUserId(userInput, interaction.client);
      if (!userId) return interaction.reply({ content: 'Invalid user. Provide a user ID or @mention.', ephemeral: true });

      if (action === 'add') {
        await whitelistManager.add(guildId, userId, 'user', ['ALL'], interaction.user.id);
        return interaction.reply({ content: `<@${userId}> added to whitelist.`, ephemeral: true });
      } else {
        await whitelistManager.remove(guildId, userId);
        return interaction.reply({ content: `<@${userId}> removed from whitelist.`, ephemeral: true });
      }
    }

    if (subcommand === 'owner') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      const action = interaction.options.getString('action', true);
      const userInput = interaction.options.getString('user', true);
      const userId = extractUserId(userInput, interaction.client);
      if (!userId) return interaction.reply({ content: 'Invalid user. Provide a user ID or @mention.', ephemeral: true });

      if (action === 'add') {
        await ownerManager.add(guildId, userId, interaction.user.id);
        return interaction.reply({ content: `<@${userId}> added as extra owner.`, ephemeral: true });
      } else {
        await ownerManager.remove(guildId, userId);
        return interaction.reply({ content: `<@${userId}> removed from extra owners.`, ephemeral: true });
      }
    }

    if (subcommand === 'lockdown') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      database.setLockdown(guildId, true);
      const state = cache.get(guildId);
      if (state.config) state.config.lockdown = true;
      return interaction.reply({ content: 'Lockdown mode activated.', ephemeral: true });
    }

    if (subcommand === 'unlock') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      database.setLockdown(guildId, false);
      const state = cache.get(guildId);
      if (state.config) state.config.lockdown = false;
      return interaction.reply({ content: 'Lockdown mode deactivated.', ephemeral: true });
    }

    return false;
  } catch (error) {
    console.error('[Luna] Command error:', error);
    if (interaction.replied || interaction.deferred) return interaction.followUp({ content: 'An error occurred.', ephemeral: true });
    return interaction.reply({ content: 'An error occurred.', ephemeral: true });
  }
}

export { commandDefinitions, handleCommand, buildStatusEmbed, buildButtons };
