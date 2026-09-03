import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder } from 'discord.js';

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

function buildStatusContainer(config, state, enabled) {
  const client = state?.client;
  const avatarUrl = client?.user?.displayAvatarURL({ size: 256 }) || '';

  const modules = config?.modules || {};
  const moduleList = Object.entries(modules)
    .map(([k, v]) => `${v ? '\u2705' : '\u274C'} ${k}`)
    .join('\n') || 'No modules configured';

  const container = new ContainerBuilder();

  if (avatarUrl) {
    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${enabled ? '**ACTIVE**' : '**DISABLED**'}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        );
      container.addSectionComponents(section);
    } catch {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${enabled ? '**ACTIVE**' : '**DISABLED**'}`)
      );
    }
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${enabled ? '**ACTIVE**' : '**DISABLED**'}`)
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
        `**Protected Roles:** ${state.protectedRoles.size} | **Protected Channels:** ${state.protectedChannels.size}\n**Whitelisted:** ${state.whitelist.size} | **Extra Owners:** ${state.extraOwners.size}\n**Lockdown:** ${config?.lockdown ? 'Active' : 'Inactive'}`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Last Scan:** <t:${Math.floor(Date.now() / 1000)}:R>\n[Zynrax Development](https://discord.gg/zynrax)`)
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
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Luna\nProtection **enabled** successfully.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
        );
      return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
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
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Luna\nProtection **disabled** successfully.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
        );
      return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
    }

    if (subcommand === 'status') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
      }
      const config = database.getGuildConfig(guildId);
      const state = cache.get(guildId);
      state.client = interaction.client;
      const enabled = config?.modules && Object.values(config.modules).some(v => v);
      const container = buildStatusContainer(config, state, enabled);
      const buttons = buildButtons(enabled);
      return interaction.reply({ components: [container, buttons], flags: 32768, ephemeral: true });
    }

    if (subcommand === 'whitelist') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      const action = interaction.options.getString('action', true);
      const userInput = interaction.options.getString('user', true);
      const userId = extractUserId(userInput, interaction.client);
      if (!userId) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# Luna\nInvalid user. Provide a user ID or @mention.')
          );
        return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
      }

      if (action === 'add') {
        await whitelistManager.add(guildId, userId, 'user', ['ALL'], interaction.user.id);
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# Luna\n<@${userId}> added to **whitelist**.`)
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
          );
        return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
      } else {
        await whitelistManager.remove(guildId, userId);
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# Luna\n<@${userId}> removed from **whitelist**.`)
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
          );
        return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
      }
    }

    if (subcommand === 'owner') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      const action = interaction.options.getString('action', true);
      const userInput = interaction.options.getString('user', true);
      const userId = extractUserId(userInput, interaction.client);
      if (!userId) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# Luna\nInvalid user. Provide a user ID or @mention.')
          );
        return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
      }

      if (action === 'add') {
        await ownerManager.add(guildId, userId, interaction.user.id);
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# Luna\n<@${userId}> added as **extra owner**.`)
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
          );
        return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
      } else {
        await ownerManager.remove(guildId, userId);
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# Luna\n<@${userId}> removed from **extra owners**.`)
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
          );
        return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
      }
    }

    if (subcommand === 'lockdown') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      database.setLockdown(guildId, true);
      const state = cache.get(guildId);
      if (state.config) state.config.lockdown = true;
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Luna\nLockdown **activated**.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('All modules have been disabled and server is on high alert.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
        );
      return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
    }

    if (subcommand === 'unlock') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }
      database.setLockdown(guildId, false);
      const state = cache.get(guildId);
      if (state.config) state.config.lockdown = false;
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Luna\nLockdown **deactivated**.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('Protection is back to normal operation.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
        );
      return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
    }

    return false;
  } catch (error) {
    console.error('[Luna] Command error:', error);
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# Luna\nAn error occurred.')
      );
    if (interaction.replied || interaction.deferred) return interaction.followUp({ components: [container], flags: 32768, ephemeral: true });
    return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
  }
}

export { commandDefinitions, handleCommand, buildStatusContainer, buildButtons };
