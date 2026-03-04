export const config = {
  api: {
    bodyParser: false
  }
};

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = "1478451760027799685";

async function postSushi() {

  const sushiImages = [
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c",
    "https://images.unsplash.com/photo-1553621042-f6e147245754",
    "https://images.unsplash.com/photo-1562158070-622a7c1c09f4",
    "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf"
  ];

  const randomImage =
    sushiImages[Math.floor(Math.random() * sushiImages.length)];

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
            image: {
              url: randomImage
            },
            color: 16711680
          }
        ]
      })
    }
  );

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
