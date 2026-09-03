import { Container, TextDisplay, Separator, Section, Button, ActionRow, StringSelect } from 'discord.js';

export function buildConfigPanel(config) {
  const modules = [
    { id: 'antiBan', name: 'Anti Ban' },
    { id: 'antiKick', name: 'Anti Kick' },
    { id: 'antiChannelDelete', name: 'Anti Channel Delete' },
    { id: 'antiRoleDelete', name: 'Anti Role Delete' },
    { id: 'antiWebhookCreate', name: 'Anti Webhook Create' },
    { id: 'antiPrune', name: 'Anti Prune' },
    { id: 'antiMemberRoleUpdate', name: 'Anti Member Role Update' },
    { id: 'antiEveryoneMention', name: 'Anti Everyone Mention' },
  ];

  const severityActions = [
    { id: 'none', label: 'None' },
    { id: 'log', label: 'Log Only' },
    { id: 'warn', label: 'Warn User' },
    { id: 'kick', label: 'Kick' },
    { id: 'ban', label: 'Ban' },
    { id: 'lockdown', label: 'Lockdown Server' },
  ];

  const components = [
    new TextDisplay({
      content: '# Configuration',
    }),
    new Separator({ spacing: 2 }),
  ];

  for (const mod of modules) {
    const enabled = config?.modules?.[mod.id] ?? false;
    components.push(
      new Section({
        text: `**${mod.name}**: ${enabled ? 'Enabled' : 'Disabled'}`,
      }),
      new ActionRow({
        components: [
          new Button({
            custom_id: `config_toggle_${mod.id}`,
            label: enabled ? 'Disable' : 'Enable',
            style: enabled ? 4 : 3,
          }),
        ],
      }),
      new Separator({ spacing: 1 })
    );
  }

  components.push(
    new TextDisplay({
      content: '## Actions per Severity Level',
    }),
    new Separator({ spacing: 1 })
  );

  const severities = ['low', 'medium', 'high', 'critical'];
  for (const severity of severities) {
    const action = config?.actions?.[severity] ?? 'none';
    components.push(
      new Section({
        text: `**${severity.charAt(0).toUpperCase() + severity.slice(1)}**: ${action}`,
      }),
      new ActionRow({
        components: [
          new StringSelect({
            custom_id: `config_action_${severity}`,
            placeholder: `Select action for ${severity}`,
            options: severityActions.map((a) => ({
              label: a.label,
              value: a.id,
              default: a.id === action,
            })),
          }),
        ],
      }),
      new Separator({ spacing: 1 })
    );
  }

  return new Container({
    components,
  });
}
