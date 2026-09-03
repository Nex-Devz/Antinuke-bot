export default {
  name: "001_initial",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS guilds (
        guildId TEXT PRIMARY KEY,
        ownerId TEXT,
        name TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS security_config (
        guildId TEXT PRIMARY KEY,
        config TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        targetId TEXT,
        targetType TEXT,
        actions TEXT,
        addedBy TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS extra_owners (
        guildId TEXT,
        userId TEXT,
        addedBy TEXT,
        createdAt TEXT,
        PRIMARY KEY (guildId, userId)
      );

      CREATE TABLE IF NOT EXISTS protected_roles (
        guildId TEXT,
        roleId TEXT,
        addedBy TEXT,
        createdAt TEXT,
        PRIMARY KEY (guildId, roleId)
      );

      CREATE TABLE IF NOT EXISTS protected_channels (
        guildId TEXT,
        channelId TEXT,
        addedBy TEXT,
        createdAt TEXT,
        PRIMARY KEY (guildId, channelId)
      );

      CREATE TABLE IF NOT EXISTS protected_webhooks (
        guildId TEXT,
        webhookId TEXT,
        webhookUrl TEXT,
        addedBy TEXT,
        createdAt TEXT,
        PRIMARY KEY (guildId, webhookId)
      );

      CREATE TABLE IF NOT EXISTS trusted_bots (
        guildId TEXT,
        botId TEXT,
        addedBy TEXT,
        createdAt TEXT,
        PRIMARY KEY (guildId, botId)
      );

      CREATE TABLE IF NOT EXISTS security_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        module TEXT,
        action TEXT,
        executorId TEXT,
        targetId TEXT,
        severity TEXT,
        risk INTEGER,
        evidence TEXT,
        actionTaken TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS security_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        resourceType TEXT,
        resourceId TEXT,
        snapshot TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS punishment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        executorId TEXT,
        action TEXT,
        reason TEXT,
        moderator TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS invite_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        code TEXT,
        inviterId TEXT,
        channelId TEXT,
        uses INTEGER,
        maxUses INTEGER,
        maxAge INTEGER,
        createdAt TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_whitelist_guildId ON whitelist (guildId);
      CREATE INDEX IF NOT EXISTS idx_extra_owners_guildId ON extra_owners (guildId);
      CREATE INDEX IF NOT EXISTS idx_protected_roles_guildId ON protected_roles (guildId);
      CREATE INDEX IF NOT EXISTS idx_protected_channels_guildId ON protected_channels (guildId);
      CREATE INDEX IF NOT EXISTS idx_protected_webhooks_guildId ON protected_webhooks (guildId);
      CREATE INDEX IF NOT EXISTS idx_trusted_bots_guildId ON trusted_bots (guildId);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_guildId ON security_incidents (guildId);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_module ON security_incidents (module);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_createdAt ON security_incidents (createdAt);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_guild_module_date ON security_incidents (guildId, module, createdAt);
      CREATE INDEX IF NOT EXISTS idx_security_snapshots_guildId ON security_snapshots (guildId);
      CREATE INDEX IF NOT EXISTS idx_punishment_history_guildId ON punishment_history (guildId);
      CREATE INDEX IF NOT EXISTS idx_invite_history_guildId ON invite_history (guildId);
    `);
  }
};
