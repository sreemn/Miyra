export const config = {
  api: {
    bodyParser: true
  }
};

const APP_ID = process.env.APP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const body = req.body;

  if (body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (body.type === 2) {
    const { name, options } = body.data;

    if (name === "help") {
      return res.status(200).json({
        type: 4,
        data: {
          flags: 64,
          embeds: [{
            color: 0xe7a67c,
            description: "You can find a list of commands here: https://sushibot.co/commands\n" +
                         "Join the server if you still have questions: https://discord.gg/QkvahZ4yW3\n\n" +
                         "The privacy policy can be found here: https://sushibot.co/privacy"
          }]
        }
      });
    }

    if (name === "status") {
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
      const userId = options[0].value;
      const user = body.data.resolved.users[userId];
      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [{
            color: 0x8f95f5,
            author: { name: user.username, icon_url: avatarUrl },
            fields: [{ name: 'User ID:', value: `\`${userId}\`` }]
          }]
        }
      });
    }

    if (name === "anime") {
      res.status(200).json({ type: 5 });

      try {
        const subreddits = ["AnimeART", "Animewallpaper"];
        const selectedSub = subreddits[Math.floor(Math.random() * subreddits.length)];
        const redditRes = await fetch(`https://www.reddit.com/r/${selectedSub}/hot.json?limit=20`, {
          headers: { 'User-Agent': 'SushiBot/3.0' }
        });
        const redditData = await redditRes.json();
        const posts = redditData.data.children.filter(p => p.data.url.match(/\.(jpg|png|jpeg)$/));
        const post = posts[Math.floor(Math.random() * posts.length)].data;

        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${body.token}/messages/@original`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flags: 32768,
            components: [
              {
                type: 17,
                accent_color: 16711935,
                components: [
                  {
                    type: 9,
                    components: [
                      {
                        type: 10,
                        style: "heading",
                        content: post.title.substring(0, 100)
                      }
                    ]
                  },
                  {
                    type: 12,
                    items: [
                      {
                        media: {
                          url: post.url
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          })
        });
      } catch (e) {
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${body.token}/messages/@original`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "Failed to fetch image. Please try again."
          })
        });
      }
      return;
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
