export class PunishmentEngine {
  constructor(client, cache) {
    this.client = client;
    this.cache = cache;
  }

  async #canAct(guild, executorId, targetMember) {
    const botMember = guild.members.me;
    const guildOwner = guild.ownerId;

    if (executorId === guildOwner) {
      return { allowed: false, error: 'Target is the guild owner' };
    }

    if (targetMember && targetMember.id === this.client.user.id) {
      return { allowed: false, error: 'Cannot punish the bot itself' };
    }

    if (targetMember && botMember.roles.highest.position <= targetMember.roles.highest.position) {
      return { allowed: false, error: 'Role hierarchy prevents this action' };
    }

    return { allowed: true, error: null };
  }

  async #fetchGuildAndMember(guildId, executorId) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return { error: 'Guild not found' };

    let member = null;
    try {
      member = await guild.members.fetch(executorId).catch(() => null);
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

      switch (action) {
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
          console.log(`[Security] No action taken for ${executorId}: NONE selected`);
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
    try {
      await guild.members.ban(member, { reason });
      console.log(`[Security] Banned ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  async #kick(guild, member, reason) {
    try {
      await member.kick(reason);
      console.log(`[Security] Kicked ${member.user?.tag || member.id}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  async #timeout(guild, member, reason) {
    try {
      const duration = this.cache?.get?.(`${guild.id}:timeout_duration`) ?? 600000;
      const until = new Date(Date.now() + duration);
      await member.timeout(duration, reason);
      console.log(`[Security] Timed out ${member.user?.tag || member.id} until ${until.toISOString()}`);
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
        console.log(`[Security] No removable roles for ${member.user?.tag || member.id}`);
        return { success: true, error: null };
      }

      await member.roles.remove(removableRoles, 'Elu: Role strip');
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
        console.log(`[Security] No dangerous roles to remove for ${member.user?.tag || member.id}`);
        return { success: true, error: null };
      }

      await member.roles.remove(rolesToRemove, 'Elu: Dangerous role removal');
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
        console.log(`[Security] No quarantine channel found in ${guild.name}`);
        return { success: false, error: 'No quarantine channel found' };
      }

      await member.roles.set([], 'Elu: Quarantine');
      await member.voice.disconnect('Elu: Quarantine').catch(() => {});
      console.log(`[Security] Quarantined ${member.user?.tag || member.id} in ${quarantineChannel.name}`);
      return { success: true, error: null };
    } catch (err) {
      return this.#handleDiscordError(err);
    }
  }

  #handleDiscordError(err) {
    if (err.httpStatus === 403 || err.code === 50013) {
      console.log(`[Security] Missing permissions: ${err.message}`);
      return { success: false, error: 'Missing permissions' };
    }
    if (err.httpStatus === 404 || err.code === 10007 || err.code === 10009) {
      console.log(`[Security] Resource not found: ${err.message}`);
      return { success: false, error: 'User or resource not found' };
    }
    if (err.code === 40002) {
      console.log(`[Security] Cannot act on guild owner: ${err.message}`);
      return { success: false, error: 'Cannot act on guild owner' };
    }
    console.error(`[Security] Discord API error:`, err.message);
    return { success: false, error: err.message };
  }
}
