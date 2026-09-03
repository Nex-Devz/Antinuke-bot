import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder } from 'discord.js';
import { getEmoji } from '../utils/emoji.js';

const antinukeCommand = new SlashCommandBuilder()
  .setName('antinuke')
  .setDescription('Open Luna security panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const whitelistCommand = new SlashCommandBuilder()
  .setName('whitelist')
  .setDescription('Whitelist management')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Whitelist a user')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove user from whitelist')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Show whitelisted users'));

const coownerCommand = new SlashCommandBuilder()
  .setName('coowner')
  .setDescription('Extra owner management')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add extra owner')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove extra owner')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Show extra owners'));

const lockdownCommand = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription('Activate lockdown mode')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const unlockCommand = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Deactivate lockdown mode')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const commandDefinitions = [
  antinukeCommand.toJSON(),
  whitelistCommand.toJSON(),
  coownerCommand.toJSON(),
  lockdownCommand.toJSON(),
  unlockCommand.toJSON()
];

function formatModuleName(name) {
  return name
    .replace(/^anti/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function buildStatusContainer(config, state, enabled) {
  const client = state?.client;
  const avatarUrl = client?.user?.displayAvatarURL({ size: 256 }) || '';

  const tick = getEmoji('floovi_tick');
  const cross = getEmoji('floovi_cross');
  const moduleList = Object.entries(config || {})
    .filter(([k, v]) => typeof v === 'object' && v !== null && 'enabled' in v)
    .map(([k, v]) => `${v.enabled ? (tick || '\u2705') : (cross || '\u274C')} **${formatModuleName(k)}**`)
    .join('\n') || 'No modules configured';

  const hasResources = state.protectedRoles.size > 0 || state.protectedChannels.size > 0;
  const isFullyActive = enabled && hasResources;

  const container = new ContainerBuilder();

  if (avatarUrl) {
    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${isFullyActive ? '**ACTIVE**' : enabled ? '**PARTIAL**' : '**DISABLED**'}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        );
      container.addSectionComponents(section);
    } catch {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${isFullyActive ? '**ACTIVE**' : enabled ? '**PARTIAL**' : '**DISABLED**'}`)
      );
    }
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${isFullyActive ? '**ACTIVE**' : enabled ? '**PARTIAL**' : '**DISABLED**'}`)
    );
  }

  if (enabled && !hasResources) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('> Modules are enabled but no roles or channels are protected yet. Use `/antinuke` panel or add protected resources.')
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Modules**\n' + moduleList)
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Roles:** ${state.protectedRoles.size} | **Channels:** ${state.protectedChannels.size} | **Webhooks:** ${state.protectedWebhooks.size}\n**Whitelisted:** ${state.whitelist.size} | **Owners:** ${state.extraOwners.size}\n**Lockdown:** ${config?.lockdown ? 'Active' : 'Inactive'}`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Last Scan:** <t:${Math.floor(Date.now() / 1000)}:R>`)
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('antinuke_enable')
      .setLabel('Enable All')
      .setStyle(ButtonStyle.Success)
      .setDisabled(enabled),
    new ButtonBuilder()
      .setCustomId('antinuke_disable')
      .setLabel('Disable All')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!enabled),
    new ButtonBuilder()
      .setCustomId('antinuke_status')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary)
  );
  container.addActionRowComponents(row);

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
  );

  return container;
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

function successContainer(text) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Luna\n${text}`)
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
    );
}

function errorContainer(text) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Luna\n${text}`)
    );
}

async function handleCommand(interaction, context) {
  if (!interaction.isChatInputCommand()) return false;

  const { database, cache, whitelistManager, ownerManager } = context;
  const guildId = interaction.guildId;
  const commandName = interaction.commandName;

  try {
    if (commandName === 'antinuke') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ components: [errorContainer('Administrator permission required.')], flags: 32768, ephemeral: true });
      }
      const existing = database.getGuildConfig(guildId);
      if (!existing) await database.initGuildConfig(guildId);
      const config = database.getGuildConfig(guildId);
      const state = cache.get(guildId);
      state.client = interaction.client;
      const enabled = config && Object.values(config).some(v => typeof v === 'object' && v !== null && v.enabled === true);
      const container = buildStatusContainer(config, state, enabled);
      await interaction.reply({ components: [container], flags: 32768, ephemeral: true });
      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 60000 });
      collector.on('end', () => {
        const disabled = buildStatusContainer(config, state, enabled);
        interaction.editReply({ components: [disabled] }).catch(() => {});
      });
      return;
    }

    if (commandName === 'whitelist') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ components: [errorContainer('Administrator permission required.')], flags: 32768, ephemeral: true });
      }
      const sub = interaction.options.getSubcommand();

      if (sub === 'list') {
        const state = cache.get(guildId);
        const list = [...state.whitelist].map(id => `<@${id}>`).join('\n') || 'No users whitelisted';
        return interaction.reply({ components: [successContainer(`**Whitelisted Users**\n${list}`)], flags: 32768, ephemeral: true });
      }

      const userInput = interaction.options.getString('user', true);
      const userId = extractUserId(userInput, interaction.client);
      if (!userId) return interaction.reply({ components: [errorContainer('Invalid user. Provide a user ID or @mention.')], flags: 32768, ephemeral: true });

      if (sub === 'add') {
        await whitelistManager.add(guildId, userId, 'user', ['ALL'], interaction.user.id);
        return interaction.reply({ components: [successContainer(`<@${userId}> added to **whitelist**.`)], flags: 32768, ephemeral: true });
      }
      if (sub === 'remove') {
        await whitelistManager.remove(guildId, userId);
        return interaction.reply({ components: [successContainer(`<@${userId}> removed from **whitelist**.`)], flags: 32768, ephemeral: true });
      }
    }

    if (commandName === 'coowner') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ components: [errorContainer('Administrator permission required.')], flags: 32768, ephemeral: true });
      }
      const sub = interaction.options.getSubcommand();

      if (sub === 'list') {
        const state = cache.get(guildId);
        const list = [...state.extraOwners].map(id => `<@${id}>`).join('\n') || 'No extra owners';
        return interaction.reply({ components: [successContainer(`**Extra Owners**\n${list}`)], flags: 32768, ephemeral: true });
      }

      const userInput = interaction.options.getString('user', true);
      const userId = extractUserId(userInput, interaction.client);
      if (!userId) return interaction.reply({ components: [errorContainer('Invalid user. Provide a user ID or @mention.')], flags: 32768, ephemeral: true });

      if (sub === 'add') {
        await ownerManager.add(guildId, userId, interaction.user.id);
        return interaction.reply({ components: [successContainer(`<@${userId}> added as **extra owner**.`)], flags: 32768, ephemeral: true });
      }
      if (sub === 'remove') {
        await ownerManager.remove(guildId, userId);
        return interaction.reply({ components: [successContainer(`<@${userId}> removed from **extra owners**.`)], flags: 32768, ephemeral: true });
      }
    }

    if (commandName === 'lockdown') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ components: [errorContainer('Administrator permission required.')], flags: 32768, ephemeral: true });
      }
      database.setLockdown(guildId, true);
      const state = cache.get(guildId);
      if (state.config) state.config.lockdown = true;
      return interaction.reply({
        components: [successContainer('Lockdown **activated**.\nAll modules have been disabled and server is on high alert.')],
        flags: 32768,
        ephemeral: true
      });
    }

    if (commandName === 'unlock') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ components: [errorContainer('Administrator permission required.')], flags: 32768, ephemeral: true });
      }
      database.setLockdown(guildId, false);
      const state = cache.get(guildId);
      if (state.config) state.config.lockdown = false;
      return interaction.reply({
        components: [successContainer('Lockdown **deactivated**.\nProtection is back to normal operation.')],
        flags: 32768,
        ephemeral: true
      });
    }

    return false;
  } catch (error) {
    console.error('[Luna] Command error:', error);
    if (interaction.replied || interaction.deferred) return interaction.followUp({ components: [errorContainer('An error occurred.')], flags: 32768, ephemeral: true });
    return interaction.reply({ components: [errorContainer('An error occurred.')], flags: 32768, ephemeral: true });
  }
}

export { commandDefinitions, handleCommand, buildStatusContainer };
