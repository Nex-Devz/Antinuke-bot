import { Container, TextDisplay, Separator, Section, Button, ActionRow } from 'discord.js';

export function buildIncidentPanel(incidents, page = 1) {
  const pageSize = 10;
  const allIncidents = incidents ?? [];
  const totalPages = Math.max(1, Math.ceil(allIncidents.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageIncidents = allIncidents.slice(startIdx, startIdx + pageSize);

  const severityStyles = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };

  const components = [
    new TextDisplay({
      content: '# Incident History',
    }),
    new TextDisplay({
      content: `Page ${currentPage}/${totalPages} - ${allIncidents.length} total incidents`,
    }),
    new Separator({ spacing: 2 }),
  ];

  if (pageIncidents.length === 0) {
    components.push(
      new TextDisplay({
        content: 'No incidents recorded.',
      })
    );
  } else {
    for (const incident of pageIncidents) {
      const timestamp = incident.timestamp
        ? new Date(incident.timestamp).toISOString()
        : 'Unknown';
      const severity = severityStyles[incident.severity] ?? incident.severity ?? 'Unknown';
      const action = incident.action ?? 'None';
      const user = incident.user ?? 'Unknown';
      const reason = incident.reason ?? 'No reason provided';

      components.push(
        new Section({
          text: `**${severity}** - ${timestamp}\nUser: ${user}\nAction: ${action}\nReason: ${reason}`,
        }),
        new Separator({ spacing: 1 })
      );
    }
  }

  if (totalPages > 1) {
    components.push(
      new ActionRow({
        components: [
          new Button({
            custom_id: `incident_page_${currentPage - 1}`,
            label: 'Previous',
            style: 2,
            disabled: currentPage <= 1,
          }),
          new Button({
            custom_id: `incident_page_${currentPage + 1}`,
            label: 'Next',
            style: 2,
            disabled: currentPage >= totalPages,
          }),
        ],
      })
    );
  }

  return new Container({
    components,
  });
}
