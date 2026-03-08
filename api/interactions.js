import nacl from "tweetnacl";

export const config = {
  api: {
    bodyParser: false
  }
};

const APP_ID = process.env.APP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_KEY = process.env.PUBLIC_KEY;

const commands = [
  {
    name: "help",
    description: "Get information about sushi",
    type: 1
  },
  {
    name: "status",
    description: "View sushi bot status",
    type: 1
  },
  {
    name: "userinfo",
    description: "Show information about a user",
    type: 1,
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
    name: "Timeout",
    type: 2,
    default_member_permissions: "1099511627776"
  },
  {
    name: "Timeout",
    type: 3,
    default_member_permissions: "1099511627776"
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  const rawBody = await new Promise(resolve => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => resolve(data));
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

    const perms = BigInt(body.member.permissions);
    const MODERATE_MEMBERS = 1n << 40n;

    if (body.data.name === "Timeout" && !(perms & MODERATE_MEMBERS)) {
      return res.status(200).json({
        type: 4,
        data: {
          flags: 64,
          content: "You do not have permission to use this command."
        }
      });
    }

    const name = body.data.name;

    if (name === "help") {
      return res.status(200).json({
        type: 4,
        data: {
          flags: 64,
          embeds: [{
            color: 0xe7a67c,
            description: "Command list: https://sushibot.co/commands"
          }]
        }
      });
    }

    if (name === "status") {
      const interactionTime = Number((BigInt(body.id) >> 22n) + 1420070400000n);
      const latency = Date.now() - interactionTime;

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [{
            color: 0x8f95f5,
            description: `Latency: ${latency}ms`
          }]
        }
      });
    }

    if (name === "userinfo") {
      const userId = body.data.options[0].value;

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [{
            color: 0x8f95f5,
            description: `User: <@${userId}>`
          }]
        }
      });
    }

    if (name === "Timeout") {
      const guildId = body.guild_id;

      let targetUserId;

      if (body.data.target_id) {
        targetUserId = body.data.target_id;
      }

      if (body.data.resolved?.messages) {
        const message = body.data.resolved.messages[body.data.target_id];
        targetUserId = message.author.id;
      }

      const timeoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${targetUserId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          communication_disabled_until: timeoutUntil
        })
      });

      return res.status(200).json({
        type: 4,
        data: {
          flags: 64,
          content: `User <@${targetUserId}> has been timed out for 15 minutes`
        }
      });
    }
  }

  return res.status(200).json({
    type: 4,
    data: {
      content: "Unknown command",
      flags: 64
    }
  });
}
