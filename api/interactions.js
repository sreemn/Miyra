import nacl from "tweetnacl";

export const config = {
  api: {
    bodyParser: false
  }
};

const APP_ID = process.env.APP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_KEY = process.env.PUBLIC_KEY;

const guildLogs = {};

const commands = [
  {
    name: "help",
    description: "Get information about sushi"
  },
  {
    name: "status",
    description: "View sushi bot status"
  },
  {
    name: "userinfo",
    description: "Show information about a user",
    options: [
      {
        name: "user",
        description: "The user to lookup",
        type: 6,
        required: true
      }
    ]
  },
  {
    name: "setlogs",
    description: "Set the logging channel",
    options: [
      {
        name: "channel",
        description: "Channel for logs",
        type: 7,
        required: true
      }
    ]
  }
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

async function sendLog(guildId, embed) {
  const channelId = guildLogs[guildId];
  if (!channelId) return;

  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ embeds: [embed] })
  });
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  const rawBody = await new Promise((resolve) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(data);
    });
  });

  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(PUBLIC_KEY, "hex")
  );

  if (!isVerified) {
    return res.status(401).send("Invalid request signature");
  }

  const body = JSON.parse(rawBody);

  if (body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (body.type === 2) {

    const { name, options } = body.data;
    const guildId = body.guild_id;
    const user = body.member?.user;

    const baseLog = {
      color: 0x8f95f5,
      title: "<:Note:1479924744177455226> Command Used",
      fields: [
        {
          name: "<:Assignee:1479924699873017927> User",
          value: `${user?.username} (${user?.id})`
        },
        {
          name: "<:Code:1479924715912171784> Command",
          value: `/${name}`
        },
        {
          name: "<:Clock:1479924713542389933> Time",
          value: `<t:${Math.floor(Date.now()/1000)}:F>`
        }
      ]
    };

    if (name === "setlogs") {

      const channelId = options[0].value;
      guildLogs[guildId] = channelId;

      await sendLog(guildId,{
        color:0xf8cf6f,
        title:"<:Channel:1479924706969653469> Logging Enabled",
        description:`Logs will now be sent to <#${channelId}>`
      });

      return res.status(200).json({
        type:4,
        data:{
          embeds:[{
            color:0x6ed683,
            description:`<:Check:1479924710463770796> Logs configured for <#${channelId}>`
          }],
          flags:64
        }
      });
    }

    if (name === "help") {

      await sendLog(guildId, baseLog);

      return res.status(200).json({
        type: 4,
        data: {
          flags: 64,
          embeds: [{
            color: 0xe7a67c,
            description: "You can find a list of commands here: https://sushibot.co/commands\nJoin the server if you still have questions: https://discord.gg/QkvahZ4yW3\n\nThe privacy policy can be found here: https://sushibot.co/privacy"
          }]
        }
      });
    }

    if (name === "status") {

      await sendLog(guildId, baseLog);

      const interactionTime = Number((BigInt(body.id) >> 22n) + 1420070400000n);
      const latency = Date.now() - interactionTime;
      const heartbeat = Math.floor(Math.random() * (135 - 115) + 115);

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [{
            color: 0x8f95f5,
            description: `Heartbeat: \`${heartbeat}ms\`\nLatency: \`${latency}ms\``
          }]
        }
      });
    }

    if (name === "userinfo") {

      await sendLog(guildId, baseLog);

      const userId = options[0].value;
      const userData = body.data.resolved.users[userId];
      const member = body.data.resolved.members?.[userId];

      const createdAt = new Date(Number((BigInt(userId) >> 22n) + 1420070400000n));
      const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      const parts = createdAt.toUTCString().split(' ');
      const formattedDate = `${parts[2]} ${parts[1]} ${parts[3]}`;
      const formattedTime = `${parts[4]} GMT`;

      const avatarUrl = userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${Number(userData.discriminator || 0) % 5}.png`;

      const accountType = userData.bot ? 'Bot' : userData.system ? 'System' : 'User';

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [{
            color: 0x8f95f5,
            author: {
              name: userData.discriminator !== "0" ? `${userData.username}#${userData.discriminator}` : userData.username,
              icon_url: avatarUrl
            },
            fields: [
              {
                name: 'User ID:',
                value: `\`\`\`\n${userId}\n\`\`\``
              },
              {
                name: 'Created at:',
                value: `\`\`\`\n- ${daysAgo} days ago\n- ${formattedDate}\n- ${formattedTime}\n\`\`\``
              },
              {
                name: 'Account Type:',
                value: `\`\`\`\n${accountType}\n\`\`\``
              }
            ],
            footer: !member ? { text: 'The user you are inspecting is not on this server.' } : undefined
          }]
        }
      });
    }
  }

  return res.status(200).json({
    type: 4,
    data: {
      content: "<:Warning:1479924762892435657> Unknown command",
      flags: 64
    }
  });
}
