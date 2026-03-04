export const config = {
api: {
bodyParser: true
}
};

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_ID = process.env.APP_ID;

const COMMAND_CHANNEL = "1476997107885019218";
const LOG_CHANNEL = "1478827650410741850";

let CASE_ID = 0;

async function registerCommands() {

const commands = [

```
{
  name: "ban",
  description: "Ban a member",
  options: [
    {
      name: "user",
      type: 6,
      description: "User to ban",
      required: true
    },
    {
      name: "reason",
      type: 3,
      description: "Reason",
      required: true
    }
  ]
},

{
  name: "kick",
  description: "Kick a member",
  options: [
    {
      name: "user",
      type: 6,
      description: "User to kick",
      required: true
    },
    {
      name: "reason",
      type: 3,
      description: "Reason",
      required: true
    }
  ]
},

{
  name: "timeout",
  description: "Timeout a member",
  options: [
    {
      name: "user",
      type: 6,
      description: "User",
      required: true
    },
    {
      name: "reason",
      type: 3,
      description: "Reason",
      required: true
    }
  ]
},

{
  name: "warn",
  description: "Warn a user",
  options: [
    {
      name: "user",
      type: 6,
      description: "User",
      required: true
    },
    {
      name: "reason",
      type: 3,
      description: "Reason",
      required: true
    }
  ]
},

{ name: "history", description: "View moderation history" },
{ name: "lookup", description: "Lookup a case" },
{ name: "uncase", description: "Remove a case" },

{ name: "userinfo", description: "View user information" },
{ name: "avatar", description: "View avatar" },
{ name: "ping", description: "Check latency" },
{ name: "help", description: "Show command center" }
```

];

await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
method: "PUT",
headers: {
Authorization: `Bot ${BOT_TOKEN}`,
"Content-Type": "application/json"
},
body: JSON.stringify(commands)
});
}

async function sendCommandsPanel() {

const moderation = [
"<:sushiDot:1478821870999441489> `/warn`",
"<:sushiDot:1478821870999441489> `/kick`",
"<:sushiDot:1478821870999441489> `/ban`",
"<:sushiDot:1478821870999441489> `/timeout`",
"<:sushiDot:1478821870999441489> `/history`",
"<:sushiDot:1478821870999441489> `/lookup`",
"<:sushiDot:1478821870999441489> `/uncase`"
].join("\n");

const utility = [
"<:blueDot:1478822082061271131> `/userinfo`",
"<:blueDot:1478822082061271131> `/avatar`",
"<:blueDot:1478822082061271131> `/ping`",
"<:blueDot:1478822082061271131> `/help`"
].join("\n");

const response = await fetch(
`https://discord.com/api/v10/channels/${COMMAND_CHANNEL}/messages`,
{
method: "POST",
headers: {
Authorization: `Bot ${BOT_TOKEN}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
flags: 32768,
components: [
{
type: 17,
components: [
{ type: 10, content: "**Sushi Command Center**" },
{ type: 10, content: "Moderation" },
{ type: 10, content: moderation },
{ type: 10, content: "Utility" },
{ type: 10, content: utility }
]
}
]
})
}
);

return response.status;
}

async function sendLog(action, user, moderator, reason) {

CASE_ID++;

await fetch(
`https://discord.com/api/v10/channels/${LOG_CHANNEL}/messages`,
{
method: "POST",
headers: {
Authorization: `Bot ${BOT_TOKEN}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
embeds: [
{
title: `Case #${CASE_ID}`,
color: 15158332,
fields: [
{
name: "Action",
value: action,
inline: true
},
{
name: "User",
value: `<@${user}>`,
inline: true
},
{
name: "Moderator",
value: `<@${moderator}>`,
inline: true
},
{
name: "Reason",
value: reason
}
],
timestamp: new Date().toISOString()
}
]
})
}
);
}

async function executeModeration(guild, user, action, reason) {

if (action === "ban") {
await fetch(`https://discord.com/api/v10/guilds/${guild}/bans/${user}`, {
method: "PUT",
headers: { Authorization: `Bot ${BOT_TOKEN}` },
body: JSON.stringify({ reason })
});
}

if (action === "kick") {
await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${user}`, {
method: "DELETE",
headers: { Authorization: `Bot ${BOT_TOKEN}` }
});
}
}

export default async function handler(req, res) {

const body = req.body;

if (body.type === 1) {
return res.status(200).json({ type: 1 });
}

const command = body.data.name;
const guild = body.guild_id;
const moderator = body.member.user.id;

if (command === "ban" || command === "kick" || command === "timeout" || command === "warn") {

```
const user = body.data.options.find(o => o.name === "user").value;
const reason = body.data.options.find(o => o.name === "reason").value;

await executeModeration(guild, user, command, reason);
await sendLog(command, user, moderator, reason);

return res.json({
  type: 4,
  data: {
    content: `Action executed.\nUser: <@${user}>\nReason: ${reason}`
  }
});
```

}

if (command === "ping") {
return res.json({ type: 4, data: { content: "System online." } });
}

if (command === "help") {
return res.json({
type: 4,
data: { content: "Command panel available in the commands channel." }
});
}

return res.json({
type: 4,
data: { content: "Command received." }
});
}
