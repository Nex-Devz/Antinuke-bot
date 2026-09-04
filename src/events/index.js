import {
  handleChannelCreate,
  handleChannelDelete,
  handleChannelUpdate
} from "../modules/antichannel/index.js";
import {
  handleRoleCreate,
  handleRoleDelete,
  handleRoleUpdate as handleRoleUpdateAntiRole
} from "../modules/antirôle/index.js";
import { handleRoleUpdate as handleRoleUpdateAntiAdmin } from "../modules/antiadministrator/index.js";
import {
  handleMemberAdd as handleMemberAddAntiRaid,
} from "../modules/antiraid/index.js";
import {
  handleMemberAdd as handleMemberAddAntiMemberRole
} from "../modules/antimemberrole/index.js";
import { handleBotAdd } from "../modules/antibot/index.js";
import { handleKickRemove } from "../modules/antikick/index.js";
import {
  handleMemberUpdate as handleMemberUpdateAntiMemberRole
} from "../modules/antimemberrole/index.js";
import { handleMemberUpdate as handleMemberUpdateAntiAdmin } from "../modules/antiadministrator/index.js";
import { handleBanAdd } from "../modules/antiban/index.js";
import {
  handleInviteCreate,
  handleInviteDelete
} from "../modules/antiinvite/index.js";
import { handleInviteCreateRole } from "../modules/antiinvite-role/index.js";
import { handleWebhookUpdate } from "../modules/antiwebhook/index.js";
import {
  handleIntegrationUpdate
} from "../modules/antiintegration/index.js";
import {
  handleAutoModRuleCreate,
  handleAutoModRuleUpdate,
  handleAutoModRuleDelete
} from "../modules/antiautomod/index.js";
import {
  handleScheduledEventCreate,
  handleScheduledEventUpdate,
  handleScheduledEventDelete
} from "../modules/antischeduledevent/index.js";
import {
  handleEmojiCreate,
  handleEmojiDelete,
  handleEmojiUpdate
} from "../modules/antiemoji/index.js";
import {
  handleStickerCreate,
  handleStickerDelete,
  handleStickerUpdate
} from "../modules/antisticker/index.js";
import { handleMessageCreate } from "../modules/antimassmention/index.js";
import {
  handleRoleCreate as handleRoleCreateLinkedRole,
  handleRoleUpdate as handleRoleUpdateLinkedRole
} from "../modules/antilinked-role/index.js";

export function registerEvents(client, context) {
  client.on("channelCreate", async (channel) => {
    try {
      const event = { guild: channel.guild, executorId: null, channel };
      await handleChannelCreate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      const event = { guild: channel.guild, executorId: null, channel };
      await handleChannelDelete(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    try {
      const event = { guild: newChannel.guild, executorId: null, channel: newChannel, old: { channel: oldChannel } };
      await handleChannelUpdate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("roleCreate", async (role) => {
    try {
      const event = { guild: role.guild, executorId: null, role };
      await handleRoleCreate(event, context);
      await handleRoleCreateLinkedRole(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("roleDelete", async (role) => {
    try {
      const event = { guild: role.guild, executorId: null, role };
      await handleRoleDelete(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    try {
      const antiRoleEvent = { guild: newRole.guild, executorId: null, role: newRole, old: { role: oldRole } };
      const antiAdminEvent = { oldRole, newRole };
      const linkedRoleEvent = { guild: newRole.guild, role: newRole, oldRole };
      await handleRoleUpdateAntiRole(antiRoleEvent, context);
      await handleRoleUpdateAntiAdmin(antiAdminEvent, context);
      await handleRoleUpdateLinkedRole(linkedRoleEvent, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildMemberAdd", async (member) => {
    try {
      const raidEvent = { guild: member.guild, member };
      const memberRoleEvent = { guild: member.guild, member };
      await handleMemberAddAntiRaid(raidEvent, context);
      await handleMemberAddAntiMemberRole(memberRoleEvent, context);
      await handleBotAdd(member, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildMemberRemove", async (member) => {
    try {
      const event = { guild: member.guild, targetId: member.user.id, executorId: null };
      await handleKickRemove(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      const event = { oldMember, newMember };
      await handleMemberUpdateAntiMemberRole(event, context);
      await handleMemberUpdateAntiAdmin(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildBanAdd", async (ban) => {
    try {
      const event = { guild: ban.guild, ban, targetId: ban.user.id, executorId: null };
      await handleBanAdd(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("inviteCreate", async (invite) => {
    try {
      const event = { guild: invite.guild, invite };
      await handleInviteCreate(event, context);
      await handleInviteCreateRole(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("inviteDelete", async (invite) => {
    try {
      const event = { guild: invite.guild, invite, userId: null };
      await handleInviteDelete(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("webhooksUpdate", async (channel) => {
    try {
      const event = { guild: channel.guild, executorId: null };
      await handleWebhookUpdate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildUpdate", async (oldGuild, newGuild) => {
    try {
      if (
        oldGuild.name !== newGuild.name ||
        oldGuild.icon !== newGuild.icon ||
        oldGuild.ownerId !== newGuild.ownerId ||
        oldGuild.region !== newGuild.region
      ) {
        console.error("[Gateway] Guild settings changed", newGuild.id);
      }
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("integrationUpdate", async (integration) => {
    try {
      const event = { guild: integration.guild, integration };
      await handleIntegrationUpdate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("autoModerationRuleCreate", async (rule) => {
    try {
      await handleAutoModRuleCreate(rule, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("autoModerationRuleUpdate", async (oldRule, newRule) => {
    try {
      await handleAutoModRuleUpdate(oldRule, newRule, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("autoModerationRuleDelete", async (rule) => {
    try {
      await handleAutoModRuleDelete(rule, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("autoModerationActionExecution", async (execution) => {
    try {
      await context.automodManager?.handleExecution(execution, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildScheduledEventCreate", async (event) => {
    try {
      const wrapped = { guild: event.guild, scheduledEvent: event, executorId: null };
      await handleScheduledEventCreate(wrapped, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildScheduledEventUpdate", async (oldEvent, newEvent) => {
    try {
      const wrapped = { guild: newEvent.guild, scheduledEvent: newEvent, oldScheduledEvent: oldEvent, executorId: null };
      await handleScheduledEventUpdate(wrapped, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildScheduledEventDelete", async (event) => {
    try {
      const wrapped = { guild: event.guild, scheduledEvent: event, executorId: null };
      await handleScheduledEventDelete(wrapped, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("emojiCreate", async (emoji) => {
    try {
      const event = { guild: emoji.guild, emoji, executorId: null };
      await handleEmojiCreate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("emojiDelete", async (emoji) => {
    try {
      const event = { guild: emoji.guild, emojiId: emoji.id, emoji, executorId: null };
      await handleEmojiDelete(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
    try {
      const event = { guild: newEmoji.guild, emoji: newEmoji, old: { emoji: oldEmoji }, executorId: null };
      await handleEmojiUpdate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("stickerCreate", async (sticker) => {
    try {
      const event = { guild: sticker.guild, sticker, executorId: null };
      await handleStickerCreate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("stickerDelete", async (sticker) => {
    try {
      const event = { guild: sticker.guild, stickerId: sticker.id, sticker, executorId: null };
      await handleStickerDelete(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("stickerUpdate", async (oldSticker, newSticker) => {
    try {
      const event = { guild: newSticker.guild, sticker: newSticker, old: { sticker: oldSticker }, executorId: null };
      await handleStickerUpdate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("messageCreate", async (message) => {
    try {
      await handleMessageCreate(message, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });
}
