import { Container, TextDisplay, Separator, Section, Button, ActionRow } from 'discord.js';

export function buildOverviewDashboard(guildState) {
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

  const components = [
    new TextDisplay({
      content: '# Elu Security',
    }),
    new TextDisplay({
      content: 'Server protection is active.',
    }),
    new Separator({ spacing: 2 }),
    new Section({
      text: `**Protection**\n${modules.map((m) => `${m.name}: ${m.enabled ? 'Enabled' : 'Disabled'}`).join('\n')}`,
    }),
    new Separator({ spacing: 2 }),
    new Section({
      text: `**Threat Level**\n${threatLevel}`,
    }),
    new Separator({ spacing: 2 }),
    new Section({
      text: `**Protected Resources**\nRoles: ${protectedRoles}\nChannels: ${protectedChannels}\nWebhooks: ${protectedWebhooks}`,
    }),
    new Separator({ spacing: 2 }),
    new ActionRow({
      components: [
        new Button({
          custom_id: 'config_open',
          label: 'Configure',
          style: 1,
        }),
        new Button({
          custom_id: 'whitelist_open',
          label: 'Whitelist',
          style: 2,
        }),
        new Button({
          custom_id: 'logs_open',
          label: 'Logs',
          style: 2,
        }),
      ],
    }),
  ];

  return new Container({
    components,
  });
}
