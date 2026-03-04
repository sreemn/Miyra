export const config = {
  api: {
    bodyParser: true
  }
};

const APP_ID = process.env.APP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

const commands = [
  {
    name: "help",
    description: "Show bot information"
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
  const body = req.body;

  if (body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (body.type === 2 && body.data.name === "help") {
    return res.status(200).json({
      type: 4,
      data: {
        embeds: [
          {
            color: 0xc2ceff,
            description:
              "**Overview**\n\n" +
              "Discord server: https://discord.gg/QkvahZ4yW3\n" +
              "Website: https://sushi.bot/\n" +
              "Dashboard: https://dash.sushi.bot/"
          }
        ]
      }
    });
  }

  return res.status(200).end();
}
