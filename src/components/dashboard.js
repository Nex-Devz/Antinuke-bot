import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildOverviewDashboard(guildState, client) {
  const modules = [
    { name: 'Anti Ban', enabled: guildState?.modules?.antiBan ?? false },
    { name: 'Anti Kick', enabled: guildState?.modules?.antiKick ?? false },
    { name: 'Anti Channel Delete', enabled: guildState?.modules?.antiChannelDelete ?? false },
    { name: 'Anti Role Delete', enabled: guildState?.modules?.antiRoleDelete ?? false },
    { name: 'Anti Webhook Create', enabled: guildState?.modules?.antiWebhookCreate ?? false },
    { name: 'Anti Prune', enabled: guildState?.modules?.antiPrune ?? false },
    { name: 'Anti Member Role Update', enabled: guildState?.modules?.antiMemberRoleUpdate ?? false },
    { name: 'Anti Everyone Mention', enabled: guildState?.modules?.antiEveryoneMention ?? false },
  ];

  const threatLevel = guildState?.threatLevel ?? 'none';
  const protectedRoles = guildState?.protectedRoles ?? 0;
  const protectedChannels = guildState?.protectedChannels ?? 0;
  const protectedWebhooks = guildState?.protectedWebhooks ?? 0;

  const container = new ContainerBuilder();

  const avatarUrl = client?.user?.displayAvatarURL({ size: 256 });
  if (avatarUrl) {
    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Luna Security\nServer protection dashboard')
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        );
      container.addSectionComponents(section);
    } catch {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# Luna Security\nServer protection dashboard')
      );
    }
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Luna Security\nServer protection dashboard')
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**Modules**\n' + modules.map(m => `${m.enabled ? '\u2705' : '\u274C'} ${m.name}`).join('\n')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Threat Level:** ${threatLevel}\n**Protected Roles:** ${protectedRoles} | **Channels:** ${protectedChannels} | **Webhooks:** ${protectedWebhooks}`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('config_open').setLabel('Configure').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('whitelist_open').setLabel('Whitelist').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('logs_open').setLabel('Logs').setStyle(ButtonStyle.Secondary)
  );

  return { container, row };
}
