export const config = {
  api: {
    bodyParser: true
  }
};

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_ID = process.env.APP_ID;
const LOG_CHANNEL = "1478827650410741850";

const MOD_ROLES = [
  "1476989406337564795",
  "1476988637190033571",
  "1478804423554764952",
  "1476988708979740844"
];

let CASE_ID = 0;

const commands = [
  {
    name: "ban",
    description: "Ban a member",
    options: [
      { name: "user", type: 6, description: "User", required: true },
      { name: "reason", type: 3, description: "Reason", required: true }
    ]
  },
  {
    name: "kick",
    description: "Kick a member",
    options: [
      { name: "user", type: 6, description: "User", required: true },
      { name: "reason", type: 3, description: "Reason", required: true }
    ]
  },
  {
    name: "timeout",
    description: "Timeout a member",
    options: [
      { name: "user", type: 6, description: "User", required: true },
      { name: "reason", type: 3, description: "Reason", required: true },
      { name: "duration", type: 4, description: "Duration in minutes", required: false }
    ]
  },
  {
    name: "warn",
    description: "Warn a member",
    options: [
      { name: "user", type: 6, description: "User", required: true },
      { name: "reason", type: 3, description: "Reason", required: true }
    ]
  },
  { name: "history", description: "View moderation history" },
  { name: "lookup", description: "Lookup a case" },
  { name: "uncase", description: "Remove a case" },
  { name: "userinfo", description: "View user information" },
  { name: "avatar", description: "View user avatar" },
  { name: "ping", description: "Check bot latency" },
  { name: "help", description: "Show help panel" }
];

async function registerCommands() {
  await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  });
}

function isModerator(memberRoles) {
  return memberRoles.some(r => MOD_ROLES.includes(r));
}

async function logCase(action, userId, moderatorId, reason) {
  CASE_ID++;
  await fetch(`https://discord.com/api/v10/channels/${LOG_CHANNEL}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      embeds: [{
        title: `Case #${CASE_ID}`,
        color: 15158332,
        fields: [
          { name: "Action", value: action, inline: true },
          { name: "User", value: `<@${userId}>`, inline: true },
          { name: "Moderator", value: `<@${moderatorId}>`, inline: true },
          { name: "Reason", value: reason || "No reason provided" }
        ],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

async function banUser(guildId, userId, reason) {
  await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reason })
  });
}

async function kickUser(guildId, userId) {
  await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`
    }
  });
}

export default async function handler(req, res) {
  const body = req.body;

  if (body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (!body.data || !body.data.name) {
    return res.status(400).json({ error: "Invalid interaction" });
  }

  const command = body.data.name;
  const guildId = body.guild_id;
  const member = body.member;
  const moderatorId = member.user.id;

  if (["ban", "kick", "timeout", "warn"].includes(command)) {
    if (!isModerator(member.roles)) {
      return res.json({
        type: 4,
        data: { content: "You don't have permission to use this command." }
      });
    }

    const userId = body.data.options.find(o => o.name === "user")?.value;
    const reasonObj = body.data.options.find(o => o.name === "reason");
    const reason = reasonObj ? reasonObj.value : "No reason provided";

    if (!userId) {
      return res.json({
        type: 4,
        data: { content: "Missing target user." }
      });
    }

    if (command === "ban") {
      await banUser(guildId, userId, reason);
    }

    if (command === "kick") {
      await kickUser(guildId, userId);
    }

    // timeout would need additional duration handling here

    await logCase(command.toUpperCase(), userId, moderatorId, reason);

    return res.json({
      type: 4,
      data: {
        content: `**${command}** applied successfully\nUser: <@${userId}>\nReason: ${reason}`
      }
    });
  }

  if (command === "ping") {
    return res.json({
      type: 4,
      data: { content: "Pong!" }
    });
  }

  if (command === "userinfo") {
    const target = body.data.options?.[0]?.value ? 
      { id: body.data.options[0].value } : 
      member.user;

    return res.json({
      type: 4,
      data: {
        content: `**User Info**\nUsername: ${target.username}\nID: ${target.id}`
      }
    });
  }

  if (command === "avatar") {
    const target = body.data.options?.[0]?.value ? 
      { id: body.data.options[0].value, avatar: null } : 
      member.user;

    const avatarUrl = target.avatar
      ? `https://cdn.discordapp.com/avatars/${target.id}/${target.avatar}.png?size=1024`
      : `https://cdn.discordapp.com/embed/avatars/${Number(target.discriminator) % 5}.png`;

    return res.json({
      type: 4,
      data: { content: avatarUrl }
    });
  }

  if (command === "help") {
    return res.json({
      type: 4,
      data: {
        content:
`Sushi Command Center

**Moderation**
/warn
/kick
/ban
/timeout
/history
/lookup
/uncase

**Utility**
/userinfo
/avatar
/ping
/help`
      }
    });
  }

  return res.json({
    type: 4,
    data: { content: "Unknown command." }
  });
}
