import { Container, TextDisplay, Separator, Section, Button, ActionRow } from 'discord.js';

export function buildWhitelistPanel(whitelist) {
  const entries = whitelist ?? [];
  const components = [
    new TextDisplay({
      content: '# Whitelist',
    }),
    new Separator({ spacing: 2 }),
  ];

  if (entries.length === 0) {
    components.push(
      new TextDisplay({
        content: 'No whitelisted entries.',
      })
    );
  } else {
    for (const entry of entries.slice(0, 25)) {
      const type = entry.type ?? 'user';
      const id = entry.id ?? 'unknown';
      const label = entry.label ?? id;

      components.push(
        new Section({
          text: `**${label}**\nID: ${id}\nType: ${type}`,
        }),
        new ActionRow({
          components: [
            new Button({
              custom_id: `whitelist_remove_${id}`,
              label: 'Remove',
              style: 4,
            }),
          ],
        }),
        new Separator({ spacing: 1 })
      );
    }
  }

  components.push(
    new Separator({ spacing: 2 }),
    new ActionRow({
      components: [
        new Button({
          custom_id: 'whitelist_add_user',
          label: 'Add User',
          style: 3,
        }),
        new Button({
          custom_id: 'whitelist_add_role',
          label: 'Add Role',
          style: 3,
        }),
        new Button({
          custom_id: 'whitelist_add_channel',
          label: 'Add Channel',
          style: 3,
        }),
      ],
    })
  );

  return new Container({
    components,
  });
}
