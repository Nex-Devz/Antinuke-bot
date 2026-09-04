export default {
  name: "002_automod",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS guild_automod (
        guildId TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        logChannelId TEXT,
        notificationsEnabled INTEGER DEFAULT 1,
        notificationDuration INTEGER DEFAULT 5000,
        dmEnabled INTEGER DEFAULT 0,
        escalationEnabled INTEGER DEFAULT 1,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS automod_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        discordRuleId TEXT,
        type TEXT,
        name TEXT,
        enabled INTEGER DEFAULT 1,
        state TEXT DEFAULT 'PENDING',
        actionConfig TEXT,
        exemptRoles TEXT,
        exemptChannels TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS automod_violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        userId TEXT,
        ruleId TEXT,
        ruleName TEXT,
        channelId TEXT,
        action TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS automod_stats (
        guildId TEXT,
        date TEXT,
        blocked INTEGER DEFAULT 0,
        warnings INTEGER DEFAULT 0,
        timeouts INTEGER DEFAULT 0,
        alerts INTEGER DEFAULT 0,
        PRIMARY KEY (guildId, date)
      );

      CREATE INDEX IF NOT EXISTS idx_automod_rules_guildId ON automod_rules (guildId);
      CREATE INDEX IF NOT EXISTS idx_automod_rules_discordId ON automod_rules (discordRuleId);
      CREATE INDEX IF NOT EXISTS idx_automod_violations_guildId ON automod_violations (guildId);
      CREATE INDEX IF NOT EXISTS idx_automod_violations_user ON automod_violations (userId);
      CREATE INDEX IF NOT EXISTS idx_automod_violations_createdAt ON automod_violations (createdAt);
      CREATE INDEX IF NOT EXISTS idx_automod_stats_guild_date ON automod_stats (guildId, date);
    `);
  }
};
