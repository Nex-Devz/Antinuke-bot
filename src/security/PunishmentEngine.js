export class PunishmentEngine {
  constructor(client, cache) {
    this.client = client;
    this.cache = cache;
  }

  async #canAct(guild, executorId, member) {
    const botMember = guild.members.me;
    const guildOwner = guild.ownerId;

    if (executorId === guildOwner) {
      return { allowed: false, error: 'Target is the guild owner' };
    }

    if (member && member.id === this.client.user.id) {
      return { allowed: false, error: 'Cannot punish the bot itself' };
    }

    if (member && botMember.roles.highest.position <= member.roles.highest.position) {
      return { allowed: false, error: 'Role hierarchy prevents this action' };
    }

    return { allowed: true, error: null };
  }

  async #fetchGuildAndMember(guildId, executorId) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return { guild: null, member: null, error: 'Guild not found' };

    const id = String(executorId || '');
    if (!id || id === 'unknown' || id === '[object Object]') return { guild, member: null };

    let member = null;
    try {
      member = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
    } catch {
      member = null;
    }

    return { guild, member };
  }

  async punish(guildId, executorId, action, reason) {
    try {
      const { guild, member } = await this.#fetchGuildAndMember(guildId, executorId);
      if (!guild) return { success: false, error: 'Guild not found' };

      const check = await this.#canAct(guild, executorId, member);
      if (!check.allowed) {
        console.log(`[Security] Punishment blocked: ${check.error}`);
        return { success: false, error: check.error };
      }

      const act = String(action).toUpperCase().replace(/ /g, '_');
      switch (act) {
        case 'BAN':
          return await this.#ban(guild, member, reason);
        case 'KICK':
          return await this.#kick(guild, member, reason);
        case 'TIMEOUT':
          return await this.#timeout(guild, member, reason);
        case 'STRIP_ROLES':
          return await this.#stripRoles(guild, member);
        case 'REMOVE_DANGEROUS_ROLE':
          return await this.#removeDangerousRoles(guild, member);
        case 'QUARANTINE':
          return await this.#quarantine(guild, member);
        case 'NONE':
          return { success: true, error: null };
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (err) {
      console.error(`[Security] Punishment error for ${executorId}:`, err.message);
      return this.#handleDiscordError(err);
    }
  }

  async #ban(guild, member, reason) {
    if (!member) {
      // Try banning by ID directly (faster, no member fetch needed)
      try {
        await guild.members.ban(reason ? `${reason}` : 'Luna: Unauthorized action', { deleteMessageSeconds: 0 });
        console.log(`[Security] Banned user by ID`);
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Member not found' };
      }
    }
    try {
      await guild.members.ban(member, { reason });
      console.log(`[Security] Banned ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  async #kick(guild, member, reason) {
    if (!member) return { success: false, error: 'Member not found' };
    try {
      await member.kick(reason);
      console.log(`[Security] Kicked ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  async #timeout(guild, member, reason) {
    if (!member) return { success: false, error: 'Member not found' };
    try {
      const duration = 600000;
      await member.timeout(duration, reason);
      console.log(`[Security] Timed out ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  async #stripRoles(guild, member) {
    try {
      const botMember = guild.members.me;
      const removableRoles = member.roles.cache.filter(
        r => r.id !== guild.id && botMember.roles.highest.position > r.position
      );

      if (removableRoles.size === 0) {
        return { success: true, error: null };
      }

      await member.roles.remove(removableRoles, 'Luna: Role strip');
      console.log(`[Security] Stripped ${removableRoles.size} roles from ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  async #removeDangerousRoles(guild, member) {
    const dangerousPerms = [
      'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels',
      'ManageWebhooks', 'BanMembers', 'KickMembers', 'MentionEveryone',
      'ManageMessages', 'ManageNicknames', 'ManageGuildExpressions',
      'ManageThreads', 'CreatePublicThreads', 'CreatePrivateThreads',
      'SendMessagesInThreads', 'ModerateMembers'
    ];

    try {
      const botMember = guild.members.me;
      const rolesToRemove = member.roles.cache.filter(r => {
        if (r.id === guild.id) return false;
        if (botMember.roles.highest.position <= r.position) return false;
        return r.permissions.toArray().some(p => dangerousPerms.includes(p));
      });

      if (rolesToRemove.size === 0) {
        return { success: true, error: null };
      }

      await member.roles.remove(rolesToRemove, 'Luna: Dangerous role removal');
      console.log(`[Security] Removed ${rolesToRemove.size} dangerous roles from ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  async #quarantine(guild, member) {
    try {
      const quarantineChannel = guild.channels.cache.find(
        c => c.name === 'quarantine' || c.name === 'anti-nuke-quarantine'
      );

      if (!quarantineChannel) {
        return { success: false, error: 'No quarantine channel found' };
      }

      await member.roles.set([], 'Luna: Quarantine');
      await member.voice.disconnect('Luna: Quarantine').catch(() => {});
      console.log(`[Security] Quarantined ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  #handleDiscordError(err) {
    if (err.httpStatus === 403 || err.code === 50013) {
      return { success: false, error: 'Missing permissions' };
    }
    if (err.httpStatus === 404 || err.code === 10007 || err.code === 10009) {
      return { success: false, error: 'User not found' };
    }
    if (err.code === 40002) {
      return { success: false, error: 'Cannot act on guild owner' };
    }
    console.error(`[Security] Discord API error:`, err.message);
    return { success: false, error: err.message };
  }
}
