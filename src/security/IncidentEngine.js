export class IncidentEngine {
  constructor(database) {
    this.database = database;
  }

  async create(guildId, module, action, executorId, targetId, severity, risk, evidence, actionTaken) {
    const executor = String(executorId || 'unknown');
    const target = String(targetId || 'unknown');
    const createdAt = new Date().toISOString();

    try {
      this.database.addIncident(guildId, module, action, executor, target, severity, risk, evidence, actionTaken, createdAt);
    } catch (err) {
      console.error(`[Security] Failed to log incident: ${err.message}`);
    }

    if (severity === 'critical') {
      console.log(`[Security] Critical incident in ${module}: ${action} by ${executor} in guild ${guildId}`);
    }

    return { guildId, module, action, executorId: executor, targetId: target, severity, risk, actionTaken };
  }
}
