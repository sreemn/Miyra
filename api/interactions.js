import nacl from "tweetnacl";
import { MongoClient } from "mongodb";
import fetch from "node-fetch";

export const config = { api: { bodyParser: false } };

const APP_ID = process.env.APP_ID;
const PUBLIC_KEY = process.env.PUBLIC_KEY;
const MONGO_URI = process.env.sushi_MONGODB_URI;

const OWNER_ID = "783891446905438260";

let client;
let db;

async function getDB() {
  if (!db) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db("economy");
  }
  return db;
}

async function getUser(userId) {
  const db = await getDB();
  const users = db.collection("users");

  let user = await users.findOne({ userId });

  if (!user) {
    user = {
      userId,
      coins: 0,
      bank: 0,
      inventory: [],
      lastDaily: 0,
      lastWork: 0,
      lastRob: 0,
      shieldUntil: 0,
      lastShieldUse: 0
    };

    await users.insertOne(user);
  }

  return user;
}

async function updateUser(userId, data) {
  const db = await getDB();
  const users = db.collection("users");

  await users.updateOne(
    { userId },
    { $set: data }
  );
}

async function reply(interaction, data) {
  const url =
    `https://discord.com/api/v10/webhooks/${APP_ID}/${interaction.token}`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

export default async function handler(req, res) {

  if (req.method !== "POST")
    return res.status(405).end();

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  const rawBody = await new Promise(resolve => {
    let data = "";
    req.on("data", c => data += c);
    req.on("end", () => resolve(data));
  });

  const verified = nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(PUBLIC_KEY, "hex")
  );

  if (!verified)
    return res.status(401).end("bad signature");

  const body = JSON.parse(rawBody);

  if (body.type === 1)
    return res.status(200).json({ type: 1 });

  if (body.type === 2) {

    const name = body.data.name;
    const userId = body.member.user.id;

    /* instant ACK */
    res.status(200).json({ type: 5 });

    try {

      /* HELP */

      if (name === "help") {

        await reply(body, {
          flags: 64,
          embeds: [{
            color: 0xe7a67c,
            description:
              "You can find a list of commands here: https://sushibot.co/commands\n" +
              "Join the server if you still have questions: https://discord.gg/QkvahZ4yW3\n\n" +
              "The privacy policy can be found here: https://sushibot.co/privacy"
          }]
        });

        return;
      }

      /* STATUS */

      if (name === "status") {

        await reply(body, {
          content: "Bot is online."
        });

        return;
      }

      /* USERINFO */

      if (name === "userinfo") {

        const uid = body.data.options?.[0]?.value;

        await reply(body, {
          content: `User: <@${uid}>`
        });

        return;
      }

      /* BALANCE */

      if (name === "cowoncy") {

        const user = await getUser(userId);

        await reply(body, {
          content: `Coins: ${user.coins}\nBank: ${user.bank}`
        });

        return;
      }

      /* DAILY */

      if (name === "daily") {

        const user = await getUser(userId);
        const now = Date.now();

        if (now - user.lastDaily < 86400000) {

          await reply(body, { content: "Daily already claimed." });
          return;
        }

        await updateUser(userId, {
          coins: user.coins + 500,
          lastDaily: now
        });

        await reply(body, { content: "You claimed 500 coins." });

        return;
      }

      /* WORK */

      if (name === "work") {

        const user = await getUser(userId);
        const now = Date.now();

        if (now - user.lastWork < 3600000) {

          await reply(body, { content: "Work cooldown active." });
          return;
        }

        const reward =
          Math.floor(Math.random() * 200) + 100;

        await updateUser(userId, {
          coins: user.coins + reward,
          lastWork: now
        });

        await reply(body, {
          content: `You earned ${reward} coins.`
        });

        return;
      }

      /* COINFLIP */

      if (name === "coinflip") {

        const bet = body.data.options?.[0]?.value;
        const user = await getUser(userId);

        if (user.coins < bet) {

          await reply(body, { content: "Not enough coins." });
          return;
        }

        const win = Math.random() < 0.5;

        const coins =
          win ? user.coins + bet : user.coins - bet;

        await updateUser(userId, { coins });

        await reply(body, {
          content:
            win ? `You won ${bet}` : `You lost ${bet}`
        });

        return;
      }

      /* SHOP */

      if (name === "shop") {

        await reply(body, {
          content:
            "<a:Eagle:1480636722021924884> Shield — 2000 coins (6h protection)"
        });

        return;
      }

      /* BUY */

      if (name === "buy") {

        const item =
          body.data.options?.[0]?.value?.toLowerCase();

        const user = await getUser(userId);

        if (item !== "shield") {

          await reply(body, { content: "Item not found." });
          return;
        }

        if (user.coins < 2000) {

          await reply(body, { content: "Not enough coins." });
          return;
        }

        user.inventory.push("Shield");

        await updateUser(userId, {
          coins: user.coins - 2000,
          inventory: user.inventory
        });

        await reply(body, { content: "Shield purchased." });

        return;
      }

      /* INVENTORY */

      if (name === "inventory") {

        const user = await getUser(userId);

        if (!user.inventory.length) {

          await reply(body, { content: "Inventory empty." });
          return;
        }

        await reply(body, {
          content: user.inventory.join("\n")
        });

        return;
      }

      /* USE SHIELD */

      if (name === "useshield") {

        if (userId === OWNER_ID) {

          await reply(body, {
            content:
              "You already have shield activated for ♾️ days"
          });

          return;
        }

        const user = await getUser(userId);
        const index = user.inventory.indexOf("Shield");

        if (index === -1) {

          await reply(body, { content: "No shield." });
          return;
        }

        const now = Date.now();

        if (now - user.lastShieldUse < 86400000) {

          await reply(body, {
            content: "Shield usable once per 24h."
          });

          return;
        }

        user.inventory.splice(index, 1);

        await updateUser(userId, {
          inventory: user.inventory,
          shieldUntil: now + 21600000,
          lastShieldUse: now
        });

        await reply(body, {
          content:
            "<a:Eagle:1480636722021924884> Shield activated for 6 hours."
        });

        return;
      }

      /* ROB */

      if (name === "rob") {

        const target = body.data.options?.[0]?.value;

        const robber = await getUser(userId);
        const victim = await getUser(target);

        if (victim.shieldUntil > Date.now()) {

          await reply(body, {
            content:
              "<a:Eagle:1480636722021924884> Target protected."
          });

          return;
        }

        const success = Math.random() < 0.5;

        if (success) {

          const steal =
            Math.floor(victim.coins * 0.25);

          await updateUser(userId, {
            coins: robber.coins + steal
          });

          await updateUser(target, {
            coins: victim.coins - steal
          });

          await reply(body, {
            content: `You stole ${steal} coins.`
          });

        } else {

          const fine =
            Math.floor(robber.coins * 0.1);

          await updateUser(userId, {
            coins: robber.coins - fine
          });

          await reply(body, {
            content: `Rob failed. Lost ${fine}`
          });

        }

        return;
      }

      /* LEADERBOARD */

      if (name === "leaderboard") {

        const db = await getDB();
        const users = db.collection("users");

        const top =
          await users
            .find({})
            .sort({ coins: -1 })
            .limit(10)
            .toArray();

        let text = "";

        top.forEach((u, i) => {
          text += `#${i + 1} <@${u.userId}> — ${u.coins}\n`;
        });

        await reply(body, {
          content: text || "No players yet."
        });

        return;
      }

      /* OWNER COMMAND */

      if (name === "beone") {

        if (userId !== OWNER_ID) {

          await reply(body, { content: "Restricted." });
          return;
        }

        await updateUser(userId, {
          coins: 999999999
        });

        await reply(body, {
          content: "You are now #1."
        });

      }

    } catch (err) {

      console.error(err);

      await reply(body, {
        content: "Command error."
      });

    }

  }

}
