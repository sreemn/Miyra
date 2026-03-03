import nacl from "tweetnacl";

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_KEY = process.env.PUBLIC_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const CHANNEL_ID = "1478451760027799685";

export const config = {
  api: {
    bodyParser: false
  }
};

function verifyDiscordRequest(req, body) {
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  if (!signature || !timestamp) return false;

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, "hex"),
    Buffer.from(PUBLIC_KEY, "hex")
  );
}

async function postSushi() {
  const sushiImages = [
    "https://source.unsplash.com/800x600/?sushi",
    "https://source.unsplash.com/800x600/?nigiri",
    "https://source.unsplash.com/800x600/?maki",
    "https://source.unsplash.com/800x600/?salmon-sushi"
  ];

  const randomImage =
    sushiImages[Math.floor(Math.random() * sushiImages.length)];

  await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      embeds: [
        {
          title: "🍣 Fresh Sushi Drop",
          image: { url: randomImage },
          color: 0xc2ceff
        }
      ]
    })
  });
}

export default async function handler(req, res) {
  const rawBody = await new Promise(resolve => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data));
  });

  if (req.headers["x-signature-ed25519"]) {
    if (!verifyDiscordRequest(req, rawBody)) {
      return res.status(401).send("Invalid signature");
    }

    const interaction = JSON.parse(rawBody);

    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    return res.status(200).json({ type: 4, data: { content: "OK" } });
  }

  if (req.headers.authorization === `Bearer ${CRON_SECRET}`) {
    await postSushi();
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: "Unauthorized" });
}
