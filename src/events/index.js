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
  handleIntegrationCreate,
  handleIntegrationUpdate,
  handleIntegrationDelete
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
  handlePermissionOverwriteCreate,
  handlePermissionOverwriteDelete,
  handlePermissionOverwriteUpdate
} from "../modules/antipermission/index.js";
import {
  handleRoleCreate as handleRoleCreateLinkedRole,
  handleRoleUpdate as handleRoleUpdateLinkedRole
} from "../modules/antilinked-role/index.js";
import { handleLockdownEvent } from "../modules/emergencylockdown/index.js";

export function registerEvents(client, context) {
  client.on("channelCreate", async (channel) => {
    try {
      await handleChannelCreate(channel, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      await handleChannelDelete(channel, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    try {
      await handleChannelUpdate(oldChannel, newChannel, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("roleCreate", async (role) => {
    try {
      await handleRoleCreate(role, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("roleDelete", async (role) => {
    try {
      await handleRoleDelete(role, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    try {
      await handleRoleUpdateAntiRole(oldRole, newRole, context);
      await handleRoleUpdateAntiAdmin(oldRole, newRole, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildMemberAdd", async (member) => {
    try {
      await handleMemberAddAntiRaid(member, context);
      await handleMemberAddAntiMemberRole(member, context);
      await handleBotAdd(member, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildMemberRemove", async (member) => {
    try {
      await handleKickRemove(member, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      await handleMemberUpdateAntiMemberRole(oldMember, newMember, context);
      await handleMemberUpdateAntiAdmin(oldMember, newMember, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildBanAdd", async (ban) => {
    try {
      await handleBanAdd(ban, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("inviteCreate", async (invite) => {
    try {
      await handleInviteCreate(invite, context);
      await handleInviteCreateRole(invite, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("inviteDelete", async (invite) => {
    try {
      await handleInviteDelete(invite, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("webhooksUpdate", async (channel) => {
    try {
      await handleWebhookUpdate(channel, context);
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

  client.on("integrationCreate", async (integration) => {
    try {
      await handleIntegrationCreate(integration, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("integrationUpdate", async (integration) => {
    try {
      await handleIntegrationUpdate(integration, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("integrationDelete", async (integration) => {
    try {
      await handleIntegrationDelete(integration, context);
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

  client.on("guildScheduledEventCreate", async (event) => {
    try {
      await handleScheduledEventCreate(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildScheduledEventUpdate", async (oldEvent, newEvent) => {
    try {
      await handleScheduledEventUpdate(oldEvent, newEvent, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("guildScheduledEventDelete", async (event) => {
    try {
      await handleScheduledEventDelete(event, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("emojiCreate", async (emoji) => {
    try {
      await handleEmojiCreate(emoji, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("emojiDelete", async (emoji) => {
    try {
      await handleEmojiDelete(emoji, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
    try {
      await handleEmojiUpdate(oldEmoji, newEmoji, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("stickerCreate", async (sticker) => {
    try {
      await handleStickerCreate(sticker, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("stickerDelete", async (sticker) => {
    try {
      await handleStickerDelete(sticker, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("stickerUpdate", async (oldSticker, newSticker) => {
    try {
      await handleStickerUpdate(oldSticker, newSticker, context);
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

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    try {
      const oldOverwrites = oldChannel.permissionOverwrites?.cache || new Map();
      const newOverwrites = newChannel.permissionOverwrites?.cache || new Map();
      if (oldOverwrites.size !== newOverwrites.size) {
        await handlePermissionOverwriteCreate(newChannel, context);
      }
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    try {
      await handleRoleUpdateLinkedRole(oldRole, newRole, context);
    } catch (err) {
      console.error("[Gateway]", err);
    }
  });
}
