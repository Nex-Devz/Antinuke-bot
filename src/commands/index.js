import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, ModalBuilder, UserSelectMenuBuilder, LabelBuilder, RadioGroupBuilder, RadioGroupOptionBuilder, CheckboxGroupBuilder, CheckboxGroupOptionBuilder } from 'discord.js';
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
    .setDescription('Whitelist a user (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove user from whitelist (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Show whitelisted users'));

const wlCommand = new SlashCommandBuilder()
  .setName('wl')
  .setDescription('Whitelist management (alias)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Whitelist a user (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove user from whitelist (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Show whitelisted users'));

const trustCommand = new SlashCommandBuilder()
  .setName('trust')
  .setDescription('Whitelist management (alias)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Whitelist a user (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove user from whitelist (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Show whitelisted users'));

const coownerCommand = new SlashCommandBuilder()
  .setName('coowner')
  .setDescription('Extra owner management')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add extra owner (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove extra owner (opens a picker)')
    .addStringOption(opt => opt
      .setName('user')
      .setDescription('User ID or @mention (optional)')))
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
  wlCommand.toJSON(),
  trustCommand.toJSON(),
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

  const modules = Object.entries(config || {})
    .filter(([k, v]) => typeof v === 'object' && v !== null && 'enabled' in v);

  const moduleList = modules
    .map(([k, v]) => `> ${v.enabled ? (tick || '\u2705') : (cross || '\u274C')} **${formatModuleName(k)}**`)
    .join('\n') || '> No modules configured';

  const status = enabled ? '**ACTIVE**' : '**DISABLED**';

  const container = new ContainerBuilder();

  if (avatarUrl) {
    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${status}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        );
      container.addSectionComponents(section);
    } catch {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${status}`)
      );
    }
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Luna Security\nProtection is ${status}`)
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Modules**\n' + moduleList)
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Whitelisted:** ${state.whitelist.size} | **Owners:** ${state.extraOwners.size}`)
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
      .setCustomId('antinuke_setup')
      .setLabel('Setup Wizard')
      .setStyle(ButtonStyle.Secondary),
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

function userSelectLabel(customId, label, description) {
  return new LabelBuilder()
    .setLabel(label)
    .setDescription(description || 'Select a user')
    .setUserSelectMenuComponent(
      new UserSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder('Select a user...')
        .setMinValues(1)
        .setMaxValues(1)
    );
}

function buildWhitelistModal(action) {
  return new ModalBuilder()
    .setCustomId(action === 'add' ? 'wl_add_modal' : 'wl_remove_modal')
    .setTitle(action === 'add' ? 'Whitelist a User' : 'Unwhitelist a User')
    .addLabelComponents(
      userSelectLabel('wl_user', 'User', action === 'add' ? 'User to add to the whitelist' : 'User to remove from the whitelist')
    );
}

function buildCoownerModal(action) {
  return new ModalBuilder()
    .setCustomId(action === 'add' ? 'coowner_add_modal' : 'coowner_remove_modal')
    .setTitle(action === 'add' ? 'Add Extra Owner' : 'Remove Extra Owner')
    .addLabelComponents(
      userSelectLabel('coowner_user', 'User', action === 'add' ? 'User to grant owner permissions' : 'User to strip owner permissions')
    );
}

function buildAntinukeSetupModal() {
  const modules = [
    { label: 'Anti-Channel', value: 'antiChannel' },
    { label: 'Anti-Role', value: 'antiRole' },
    { label: 'Anti-Permission', value: 'antiPermission' },
    { label: 'Anti-Webhook', value: 'antiWebhook' },
    { label: 'Anti-Ban', value: 'antiBan' },
    { label: 'Anti-Kick', value: 'antiKick' },
    { label: 'Anti-Bot', value: 'antiBot' },
    { label: 'Anti-Raid', value: 'antiRaid' },
    { label: 'Anti-Mass Mention', value: 'antiMassMention' }
  ];

  return new ModalBuilder()
    .setCustomId('antinuke_setup_modal')
    .setTitle('Luna Setup Wizard')
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## Configure Luna\n\nPick a protection level and toggle the modules you want active.')
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Protection Level')
        .setDescription('How aggressive Luna should be')
        .setRadioGroupComponent(
          new RadioGroupBuilder()
            .setCustomId('level')
            .addOptions(
              new RadioGroupOptionBuilder().setLabel('Basic').setValue('basic').setDescription('Log & notify only'),
              new RadioGroupOptionBuilder().setLabel('Strict').setValue('strict').setDescription('Punish repeat offenders'),
              new RadioGroupOptionBuilder().setLabel('Maximum').setValue('maximum').setDescription('Aggressive full protection')
            )
        ),
      new LabelBuilder()
        .setLabel('Modules')
        .setDescription('Modules to enable')
        .setCheckboxGroupComponent(
          new CheckboxGroupBuilder()
            .setCustomId('modules')
            .setMinValues(1)
            .addOptions(
              ...modules.map(m => new CheckboxGroupOptionBuilder().setLabel(m.label).setValue(m.value).setDefault(true))
            )
        )
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

      const userInput = interaction.options.getString('user');
      if (userInput) {
        const userId = extractUserId(userInput, interaction.client);
        if (!userId) return interaction.reply({ components: [errorContainer('Invalid user. Provide a user ID or @mention.')], flags: 32768, ephemeral: true });
        if (sub === 'add') {
          await whitelistManager.add(guildId, userId, 'user', ['ALL'], interaction.user.id);
          cache.get(guildId).whitelist.add(userId);
          return interaction.reply({ components: [successContainer(`<@${userId}> added to **whitelist**.`)], flags: 32768, ephemeral: true });
        }
        await whitelistManager.remove(guildId, userId, 'user');
        cache.get(guildId).whitelist.delete(userId);
        return interaction.reply({ components: [successContainer(`<@${userId}> removed from **whitelist**.`)], flags: 32768, ephemeral: true });
      }

      return interaction.showModal(buildWhitelistModal(sub));
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

      const userInput = interaction.options.getString('user');
      if (userInput) {
        const userId = extractUserId(userInput, interaction.client);
        if (!userId) return interaction.reply({ components: [errorContainer('Invalid user. Provide a user ID or @mention.')], flags: 32768, ephemeral: true });
        if (sub === 'add') {
          await ownerManager.add(guildId, userId, interaction.user.id);
          cache.get(guildId).extraOwners.add(userId);
          return interaction.reply({ components: [successContainer(`<@${userId}> added as **extra owner**.`)], flags: 32768, ephemeral: true });
        }
        await ownerManager.remove(guildId, userId);
        cache.get(guildId).extraOwners.delete(userId);
        return interaction.reply({ components: [successContainer(`<@${userId}> removed from **extra owners**.`)], flags: 32768, ephemeral: true });
      }

      return interaction.showModal(buildCoownerModal(sub));
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

async function handleModalSubmit(interaction, context) {
  if (!interaction.isModalSubmit()) return false;

  const { database, cache, whitelistManager, ownerManager } = context;
  const guildId = interaction.guildId;
  const modalId = interaction.customId;

  try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ components: [errorContainer('Administrator permission required.')], flags: 32768, ephemeral: true });
    }

    if (modalId === 'wl_add_modal' || modalId === 'wl_remove_modal') {
      const users = interaction.fields.getSelectedUsers('wl_user', true);
      const user = users?.first();
      if (!user) return interaction.reply({ components: [errorContainer('No user selected.')], flags: 32768, ephemeral: true });
      const id = user.id;
      if (modalId === 'wl_add_modal') {
        await whitelistManager.add(guildId, id, 'user', ['ALL'], interaction.user.id);
        cache.get(guildId).whitelist.add(id);
        return interaction.reply({ components: [successContainer(`<@${id}> added to **whitelist**.`)], flags: 32768, ephemeral: true });
      }
      await whitelistManager.remove(guildId, id, 'user');
      cache.get(guildId).whitelist.delete(id);
      return interaction.reply({ components: [successContainer(`<@${id}> removed from **whitelist**.`)], flags: 32768, ephemeral: true });
    }

    if (modalId === 'coowner_add_modal' || modalId === 'coowner_remove_modal') {
      const users = interaction.fields.getSelectedUsers('coowner_user', true);
      const user = users?.first();
      if (!user) return interaction.reply({ components: [errorContainer('No user selected.')], flags: 32768, ephemeral: true });
      const id = user.id;
      if (modalId === 'coowner_add_modal') {
        await ownerManager.add(guildId, id, interaction.user.id);
        cache.get(guildId).extraOwners.add(id);
        return interaction.reply({ components: [successContainer(`<@${id}> added as **extra owner**.`)], flags: 32768, ephemeral: true });
      }
      await ownerManager.remove(guildId, id);
      cache.get(guildId).extraOwners.delete(id);
      return interaction.reply({ components: [successContainer(`<@${id}> removed from **extra owners**.`)], flags: 32768, ephemeral: true });
    }

    if (modalId === 'antinuke_setup_modal') {
      const level = interaction.fields.getRadioGroup('level', true);
      const selected = interaction.fields.getCheckboxGroup('modules') || [];

      let config = database.getGuildConfig(guildId);
      if (!config) {
        await database.initGuildConfig(guildId);
        config = database.getGuildConfig(guildId);
      }

      const wizardValues = ['antiChannel','antiRole','antiPermission','antiWebhook','antiBan','antiKick','antiBot','antiRaid','antiMassMention'];
      for (const k of wizardValues) {
        if (config[k] && typeof config[k] === 'object' && 'enabled' in config[k]) {
          config[k].enabled = selected.includes(k);
        }
      }

      const levelThresholds = {
        basic: { punishment: 'log', thresholdMult: 2 },
        strict: { punishment: 'kick', thresholdMult: 1 },
        maximum: { punishment: 'ban', thresholdMult: 0.5 }
      };
      const lv = levelThresholds[level] || levelThresholds.strict;

      database.upsertSecurityConfig(guildId, config, new Date().toISOString());
      cache.get(guildId).config = config;

      const state = cache.get(guildId);
      state.client = interaction.client;
      const container = buildStatusContainer(config, state, selected.length > 0);

      return interaction.reply({
        components: [container],
        flags: 32768,
        ephemeral: true
      });
    }

    return false;
  } catch (error) {
    console.error('[Luna] Modal error:', error);
    if (interaction.replied || interaction.deferred) return interaction.followUp({ components: [errorContainer('An error occurred.')], flags: 32768, ephemeral: true });
    return interaction.reply({ components: [errorContainer('An error occurred.')], flags: 32768, ephemeral: true });
  }
}

export { commandDefinitions, handleCommand, handleModalSubmit, buildStatusContainer, buildAntinukeSetupModal };
