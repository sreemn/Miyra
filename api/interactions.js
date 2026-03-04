export const config = {
  api: {
    bodyParser: false
  }
};

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = "1478451760027799685";

async function getSushiImage() {
  const queries = ["sushi", "nigiri", "maki", "salmon-sushi"];

  const randomQuery = queries[Math.floor(Math.random() * queries.length)];

  const res = await fetch(
    `https://source.unsplash.com/800x600/?${randomQuery}`,
    { redirect: "follow" }
  );

  return res.url; // final direct image URL
}

async function postSushi() {
  const imageUrl = await getSushiImage();

  const messageRes = await fetch(
    `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [
          {
            title: "🍣 Fresh Sushi Drop",
            image: { url: imageUrl },
            color: 0xff4d4d
          }
        ]
      })
    }
  );

  if (!messageRes.ok) {
    const errorText = await messageRes.text();
    throw new Error(errorText);
  }

  const messageData = await messageRes.json();
  const messageId = messageData.id;

  await fetch(
    `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${messageId}/reactions/%F0%9F%8D%A3/@me`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    }
  );
}

export default async function handler(req, res) {
  try {
    await postSushi();
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
