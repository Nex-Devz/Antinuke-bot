export class IncidentEngine {
  constructor(database) {
    this.database = database;
  }

  async create(guildId, module, action, executorId, targetId, severity, risk, evidence, actionTaken) {
    const id = `${guildId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const incident = {
      id,
      guildId,
      module,
      action,
      executorId,
      targetId,
      severity,
      risk,
      evidence: JSON.stringify(evidence),
      actionTaken,
      createdAt: new Date().toISOString()
    };

    await this.database.incidents.insert(incident);

    if (severity === 'critical') {
      console.log(`[Security] Critical incident in ${module}: ${action} by ${executorId} in guild ${guildId}`);
    }

    return incident;
  }

  async getRecent(guildId, limit = 50) {
    return this.database.incidents.find({ guildId }).sort({ createdAt: -1 }).limit(limit);
  }

  async getByModule(guildId, module, limit = 50) {
    return this.database.incidents.find({ guildId, module }).sort({ createdAt: -1 }).limit(limit);
  }

  async getBySeverity(guildId, severity, limit = 50) {
    return this.database.incidents.find({ guildId, severity }).sort({ createdAt: -1 }).limit(limit);
  }

  async cleanup(guildId, olderThanDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    return this.database.incidents.deleteMany({ guildId, createdAt: { $lt: cutoff.toISOString() } });
  }
}
