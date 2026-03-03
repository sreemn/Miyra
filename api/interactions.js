import nacl from "tweetnacl";

export const config = {
  api: {
    bodyParser: false
  }
};

const PUBLIC_KEY = process.env.PUBLIC_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;
const CHANNEL_ID = "1478451760027799685";

function verifySignature(signature, timestamp, body) {
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
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  // 🔹 Discord interaction verification
  if (signature && timestamp) {
    const isValid = verifySignature(signature, timestamp, rawBody);

    if (!isValid) {
      return res.status(401).send("Invalid request signature");
    }

    const interaction = JSON.parse(rawBody);

    // Required for verification
    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    return res.status(200).json({ type: 4, data: { content: "OK" } });
  }

  // 🔹 Vercel Cron
  if (req.headers.authorization === `Bearer ${CRON_SECRET}`) {
    await postSushi();
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: "Unauthorized" });
}
