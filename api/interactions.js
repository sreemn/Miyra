import nacl from "tweetnacl";
import { MongoClient } from "mongodb";

export const config = {
  api: {
    bodyParser: false
  }
};

const APP_ID = process.env.APP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_KEY = process.env.PUBLIC_KEY;
const MONGO_URI = process.env.MONGO_URI;

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

    const name = body.data.name;
    const userId = body.member.user.id;

    if (name === "help") {
      return res.status(200).json({
        type: 4,
        data: { content: "Commands: /daily /work /rob /coinflip /shop /inventory" }
      });
    }

    if (name === "status") {
      return res.status(200).json({
        type: 4,
        data: { content: "Bot is online." }
      });
    }

    if (name === "userinfo") {
      const uid = body.data.options[0].value;
      return res.status(200).json({
        type: 4,
        data: { content: `User: <@${uid}>` }
      });
    }

    if (name === "cowoncy") {

      const user = await getUser(userId);

      return res.status(200).json({
        type: 4,
        data: {
          content: `Coins: ${user.coins}\nBank: ${user.bank}`
        }
      });

    }

    if (name === "daily") {

      const user = await getUser(userId);
      const now = Date.now();

      if (now - user.lastDaily < 86400000) {
        return res.status(200).json({
          type: 4,
          data: { content: "Daily already claimed." }
        });
      }

      await updateUser(userId, {
        coins: user.coins + 500,
        lastDaily: now
      });

      return res.status(200).json({
        type: 4,
        data: { content: "You claimed 500 coins." }
      });

    }

    if (name === "work") {

      const user = await getUser(userId);
      const now = Date.now();

      if (now - user.lastWork < 3600000) {
        return res.status(200).json({
          type: 4,
          data: { content: "Work cooldown active." }
        });
      }

      const reward = Math.floor(Math.random() * 200) + 100;

      await updateUser(userId, {
        coins: user.coins + reward,
        lastWork: now
      });

      return res.status(200).json({
        type: 4,
        data: { content: `You earned ${reward} coins.` }
      });

    }

    if (name === "coinflip") {

      const bet = body.data.options[0].value;
      const user = await getUser(userId);

      if (user.coins < bet) {
        return res.status(200).json({
          type: 4,
          data: { content: "Not enough coins." }
        });
      }

      const win = Math.random() < 0.5;
      const coins = win ? user.coins + bet : user.coins - bet;

      await updateUser(userId, { coins });

      return res.status(200).json({
        type: 4,
        data: {
          content: win ? `You won ${bet}` : `You lost ${bet}`
        }
      });

    }

    if (name === "shop") {
      return res.status(200).json({
        type: 4,
        data: {
          content: "<a:Eagle:1480636722021924884> Shield — 2000 coins (6h protection)"
        }
      });
    }

    if (name === "buy") {

      const item = body.data.options[0].value.toLowerCase();

      if (item !== "shield") {
        return res.status(200).json({
          type: 4,
          data: { content: "Item not found." }
        });
      }

      const user = await getUser(userId);

      if (user.coins < 2000) {
        return res.status(200).json({
          type: 4,
          data: { content: "Not enough coins." }
        });
      }

      user.inventory.push("Shield");

      await updateUser(userId, {
        coins: user.coins - 2000,
        inventory: user.inventory
      });

      return res.status(200).json({
        type: 4,
        data: { content: "Shield purchased." }
      });

    }

    if (name === "inventory") {

      const user = await getUser(userId);

      if (!user.inventory.length) {
        return res.status(200).json({
          type: 4,
          data: { content: "Inventory empty." }
        });
      }

      const items = user.inventory.join("\n");

      return res.status(200).json({
        type: 4,
        data: { content: items }
      });

    }

    if (name === "useshield") {

      const user = await getUser(userId);
      const index = user.inventory.indexOf("Shield");

      if (index === -1) {
        return res.status(200).json({
          type: 4,
          data: { content: "No shield." }
        });
      }

      const now = Date.now();

      if (now - user.lastShieldUse < 86400000) {
        return res.status(200).json({
          type: 4,
          data: { content: "Shield usable once per 24h." }
        });
      }

      user.inventory.splice(index, 1);

      await updateUser(userId, {
        inventory: user.inventory,
        shieldUntil: now + 21600000,
        lastShieldUse: now
      });

      return res.status(200).json({
        type: 4,
        data: {
          content: "<a:Eagle:1480636722021924884> Shield activated for 6 hours."
        }
      });

    }

    if (name === "rob") {

      const target = body.data.options[0].value;

      if (target === OWNER_ID) {
        return res.status(200).json({
          type: 4,
          data: { content: "You cannot rob the bot owner." }
        });
      }

      const robber = await getUser(userId);
      const victim = await getUser(target);

      if (victim.shieldUntil > Date.now()) {
        return res.status(200).json({
          type: 4,
          data: { content: "<a:Eagle:1480636722021924884> Target protected." }
        });
      }

      const success = Math.random() < 0.5;

      if (success) {

        const steal = Math.floor(victim.coins * 0.25);

        await updateUser(userId, { coins: robber.coins + steal });
        await updateUser(target, { coins: victim.coins - steal });

        return res.status(200).json({
          type: 4,
          data: { content: `You stole ${steal} coins.` }
        });

      } else {

        const fine = Math.floor(robber.coins * 0.1);

        await updateUser(userId, { coins: robber.coins - fine });

        return res.status(200).json({
          type: 4,
          data: { content: `Rob failed. Lost ${fine}` }
        });

      }

    }

    if (name === "leaderboard") {

      const db = await getDB();
      const users = db.collection("users");

      const top = await users
        .find({})
        .sort({ coins: -1 })
        .limit(10)
        .toArray();

      let text = "";

      top.forEach((u, i) => {
        text += `#${i + 1} <@${u.userId}> — ${u.coins}\n`;
      });

      return res.status(200).json({
        type: 4,
        data: { content: text }
      });

    }

    if (name === "beone") {

      if (userId !== OWNER_ID) {
        return res.status(200).json({
          type: 4,
          data: { content: "Restricted." }
        });
      }

      await updateUser(userId, { coins: 999999999 });

      return res.status(200).json({
        type: 4,
        data: { content: "You are now #1." }
      });

    }

  }

  return res.status(200).json({
    type: 4,
    data: { content: "Unknown command." }
  });

}
