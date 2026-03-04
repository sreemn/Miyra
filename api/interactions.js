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

async function registerCommands() {

const commands = [

```
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
    { name: "reason", type: 3, description: "Reason", required: true }
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

function isModerator(memberRoles) {
return memberRoles.some(r => MOD_ROLES.includes(r));
}

async function logCase(action, user, moderator, reason) {

CASE_ID++;

await fetch(`https://discord.com/api/v10/channels/${LOG_CHANNEL}/messages`, {
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
{ name: "Action", value: action, inline: true },
{ name: "User", value: `<@${user}>`, inline: true },
{ name: "Moderator", value: `<@${moderator}>`, inline: true },
{ name: "Reason", value: reason }
],
timestamp: new Date().toISOString()
}
]
})
});
}

async function banUser(guild, user, reason) {
await fetch(`https://discord.com/api/v10/guilds/${guild}/bans/${user}`, {
method: "PUT",
headers: {
Authorization: `Bot ${BOT_TOKEN}`,
"Content-Type": "application/json"
},
body: JSON.stringify({ reason })
});
}

async function kickUser(guild, user) {
await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${user}`, {
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

const command = body.data.name;
const guild = body.guild_id;
const member = body.member;
const roles = member.roles;
const moderator = member.user.id;

if (["ban","kick","timeout","warn"].includes(command)) {

```
if (!isModerator(roles)) {
  return res.json({
    type: 4,
    data: { content: "You don't have permission to use this command." }
  });
}

const user = body.data.options.find(o => o.name === "user").value;
const reason = body.data.options.find(o => o.name === "reason").value;

if (command === "ban") await banUser(guild, user, reason);
if (command === "kick") await kickUser(guild, user);

await logCase(command, user, moderator, reason);

return res.json({
  type: 4,
  data: {
    content: `Action complete.\nUser: <@${user}>\nReason: ${reason}`
  }
});
```

}

if (command === "ping") {
return res.json({
type: 4,
data: { content: "System operational." }
});
}

if (command === "userinfo") {

```
const user = body.member.user;

return res.json({
  type: 4,
  data: {
    content: `User\n${user.username}\nID\n${user.id}`
  }
});
```

}

if (command === "avatar") {

```
const user = body.member.user;

const avatar =
  `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

return res.json({
  type: 4,
  data: { content: avatar }
});
```

}

if (command === "help") {
return res.json({
type: 4,
data: {
content:
`Sushi Command Center

Moderation
/warn
/kick
/ban
/timeout
/history
/lookup
/uncase

Utility
/userinfo
/avatar
/ping
/help`
}
});
}

return res.json({
type: 4,
data: { content: "Command received." }
});
}
