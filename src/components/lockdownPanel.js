import { Container, TextDisplay, Separator, Section, Button, ActionRow } from 'discord.js';

export function buildLockdownPanel(isLocked, guildId) {
  const status = isLocked ? 'Locked' : 'Unlocked';

  const components = [
    new TextDisplay({
      content: '# Lockdown Control',
    }),
    new Separator({ spacing: 2 }),
    new Section({
      text: `**Server Lockdown Status**: ${status}`,
    }),
    new Separator({ spacing: 2 }),
    new ActionRow({
      components: [
        new Button({
          custom_id: `lockdown_lock_${guildId}`,
          label: 'Lock Server',
          style: 4,
          disabled: isLocked,
        }),
        new Button({
          custom_id: `lockdown_unlock_${guildId}`,
          label: 'Unlock Server',
          style: 3,
          disabled: !isLocked,
        }),
      ],
    }),
  ];

  return new Container({
    components,
  });
}
