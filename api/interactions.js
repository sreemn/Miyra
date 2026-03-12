import nacl from "tweetnacl";
import { MongoClient } from "mongodb";

export const config = { api: { bodyParser: false } };

const APP_ID = process.env.APP_ID;
const PUBLIC_KEY = process.env.PUBLIC_KEY;
const MONGODB_URI = process.env.sushi_MONGODB_URI;

let cachedClient = null;
let indexesEnsured = false;
const commandCooldown = new Map();

async function getDB() {
  if (cachedClient) return cachedClient.db("discordbot");
  const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();
  cachedClient = client;
  return client.db("discordbot");
}

async function ensureIndexes() {
  if (indexesEnsured) return;
  const db = await getDB();
  const users = db.collection("users");
  await users.createIndex({ userId: 1 }, { unique: true });
  await users.createIndex({ balance: -1 });
  indexesEnsured = true;
}

async function getUser(userId, username) {
  const db = await getDB();
  const users = db.collection("users");
  let user = await users.findOne({ userId });

  if (!user) {
    user = {
      userId,
      username,
      balance: 100,
      lastDaily: null,
      lastMine: null,
      transferToday: 0,
      transferDate: null,
      createdAt: new Date()
    };
    await users.insertOne(user);
  } else if (user.username !== username) {
    await users.updateOne({ userId }, { $set: { username } });
  }

  return user;
}

async function updateBalanceAtomic(userId, amount) {
  const db = await getDB();
  const users = db.collection("users");

  const result = await users.findOneAndUpdate(
    {
      userId,
      balance: { $gte: amount < 0 ? Math.abs(amount) : 0 }
    },
    { $inc: { balance: amount } },
    { returnDocument: "after" }
  );

  return result.value;
}

async function transferCoins(fromId, toId, amount) {
  const db = await getDB();
  const users = db.collection("users");
  const client = cachedClient;
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const sender = await users.findOne({ userId: fromId }, { session });

      if (!sender || sender.balance < amount) throw new Error("balance");

      await users.updateOne(
        { userId: fromId },
        { $inc: { balance: -amount } },
        { session }
      );

      await users.updateOne(
        { userId: toId },
        { $inc: { balance: amount } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}

function cooldownLeft(lastUsed, cooldownMs) {
  if (!lastUsed) return 0;
  const diff = cooldownMs - (Date.now() - new Date(lastUsed).getTime());
  return diff > 0 ? diff : 0;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function validateAmount(amount) {
  if (!Number.isInteger(amount)) return false;
  if (amount <= 0) return false;
  if (amount > 1000000) return false;
  return true;
}

function checkCooldown(userId, cmd, seconds) {
  const key = userId + ":" + cmd;
  const now = Date.now();

  if (commandCooldown.has(key)) {
    const diff = now - commandCooldown.get(key);
    if (diff < seconds * 1000) {
      return seconds - Math.floor(diff / 1000);
    }
  }

  commandCooldown.set(key, now);
  return 0;
}

const MINE_COOLDOWN = 15000;

const GEM_TABLE = [
  { name: "Stone", coins: 3, chance: 30 },
  { name: "Coal", coins: 8, chance: 25 },
  { name: "Iron", coins: 20, chance: 20 },
  { name: "Gold", coins: 50, chance: 13 },
  { name: "Diamond", coins: 120, chance: 8 },
  { name: "Stardust", coins: 300, chance: 4 }
];

function rollMine() {
  const roll = rand(1, 100);
  let cumulative = 0;
  for (const gem of GEM_TABLE) {
    cumulative += gem.chance;
    if (roll <= cumulative) return gem;
  }
  return GEM_TABLE[0];
}

function doGamble() {
  const roll = rand(1, 100);
  if (roll <= 10) return { result: "jackpot", multiplier: 5 };
  if (roll <= 45) return { result: "win", multiplier: 2 };
  return { result: "lose", multiplier: 0 };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  await ensureIndexes();

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  let rawBody = "";
  await new Promise(resolve => {
    req.on("data", chunk => rawBody += chunk);
    req.on("end", resolve);
  });

  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(PUBLIC_KEY, "hex")
  );

  if (!isVerified) return res.status(401).send("Invalid request signature");

  const body = JSON.parse(rawBody);

  if (body.type === 1) return res.status(200).json({ type: 1 });

  if (body.type === 2) {
    const name = body.data.name;
    const discordUser = body.member?.user || body.user;
    const userId = discordUser.id;
    const username = discordUser.username;

    if (name === "help") {
      return res.status(200).json({
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              color: 0x3a3b40,
              description:
                "If you're just looking for info about how the bot works, a command list or clarification about something — check the **/about** command.\n\n" +
                "If that's not enough, join our Discord server for announcements and support."
            }
          ]
        }
      });
    }

    if (name === "about") {
      return res.status(200).json({
        type: 4,
        data: {
          embeds: [
            {
              color: 0x3a3b40,
              title: "How to Play",
              description:
                "To start playing, use the commands below.\n\n" +
                "`/daily` — Claim daily coins\n" +
                "`/mine` — Mine random coins\n" +
                "`/gamble <amount>` — Gamble coins\n" +
                "`/give <user> <amount>` — Send coins\n" +
                "`/balance` — Check balance\n" +
                "`/leaderboard` — View richest players\n\n" +
                "[Get Support](https://discord.gg/4rv6P8xF8U) | " +
                "[Invite The Bot](https://discord.com/oauth2/authorize?client_id=1480495380041961483&permissions=8&integration_type=0&scope=bot+applications.commands) | " +
                "[Support us on ko-fi](https://ko-fi.com/sremn)",
              footer: { text: "This bot was made by sremn" }
            }
          ]
        }
      });
    }

    if (name === "balance") {
      const user = await getUser(userId, username);

      return res.status(200).json({
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              color: 0xac78f3,
              description: `${username}'s Balance: ${user.balance.toLocaleString()}`
            }
          ]
        }
      });
    }

    if (name === "daily") {
      const user = await getUser(userId, username);
      const cooldown = 86400000;

      if (user.lastDaily) {
        const diff = Date.now() - new Date(user.lastDaily).getTime();
        if (diff < cooldown) {
          const remaining = cooldown - diff;
          return res.status(200).json({
            type: 4,
            data: {
              flags: 64,
              embeds: [
                {
                  color: 0xff4444,
                  title: "Daily Already Claimed",
                  description: `Come back in **${formatTime(remaining)}**`
                }
              ]
            }
          });
        }
      }

      const reward = rand(150, 350);
      await updateBalanceAtomic(userId, reward);

      const db = await getDB();
      await db.collection("users").updateOne(
        { userId },
        { $set: { lastDaily: new Date() } }
      );

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [
            {
              color: 0x57f287,
              title: "Daily Reward",
              description: `You received **${reward}**`
            }
          ]
        }
      });
    }

    if (name === "mine") {
      const user = await getUser(userId, username);
      const left = cooldownLeft(user.lastMine, MINE_COOLDOWN);

      if (left > 0) {
        return res.status(200).json({
          type: 4,
          data: {
            flags: 64,
            embeds: [
              {
                color: 0xff4444,
                title: "Pickaxe cooling down",
                description: `Mine again in **${formatTime(left)}**`
              }
            ]
          }
        });
      }

      const gem = rollMine();
      await updateBalanceAtomic(userId, gem.coins);

      const db = await getDB();
      await db.collection("users").updateOne(
        { userId },
        { $set: { lastMine: new Date() } }
      );

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [
            {
              color: 0xfaa61a,
              title: "Mining Results",
              description: `You found **${gem.name}** worth **${gem.coins}**`
            }
          ]
        }
      });
    }

    if (name === "gamble") {
      const cd = checkCooldown(userId, "gamble", 5);

      if (cd > 0) {
        return res.status(200).json({
          type: 4,
          data: {
            flags: 64,
            embeds: [
              {
                color: 0xff4444,
                description: `Wait **${cd}s** before using this again`
              }
            ]
          }
        });
      }

      const user = await getUser(userId, username);
      const betOption = body.data.options?.find(o => o.name === "amount");
      const bet = betOption ? parseInt(betOption.value) : 0;

      if (!validateAmount(bet)) {
        return res.status(200).json({
          type: 4,
          data: { flags: 64, embeds: [{ color: 0xff4444, description: "Invalid bet amount" }] }
        });
      }

      if (bet > user.balance) {
        return res.status(200).json({
          type: 4,
          data: { flags: 64, embeds: [{ color: 0xff4444, description: "Not enough coins" }] }
        });
      }

      const { result, multiplier } = doGamble();
      const winnings = bet * multiplier;
      const net = winnings - bet;

      await updateBalanceAtomic(userId, net);

      let title, color, desc;

      if (result === "jackpot") {
        title = "JACKPOT";
        color = 0xffd700;
        desc = `You won **${winnings}**`;
      } else if (result === "win") {
        title = "You Won";
        color = 0x57f287;
        desc = `You doubled to **${winnings}**`;
      } else {
        title = "You Lost";
        color = 0xff4444;
        desc = `Lost **${bet}**`;
      }

      return res.status(200).json({
        type: 4,
        data: { embeds: [{ color, title, description: desc }] }
      });
    }

    if (name === "give") {
      const db = await getDB();
      const users = db.collection("users");

      const user = await getUser(userId, username);

      const targetOption = body.data.options?.find(o => o.name === "user");
      const amountOption = body.data.options?.find(o => o.name === "amount");

      const targetId = targetOption.value;
      const amount = parseInt(amountOption.value);

      if (!validateAmount(amount)) {
        return res.status(200).json({
          type: 4,
          data: { flags: 64, embeds: [{ color: 0xff4444, description: "Invalid amount" }] }
        });
      }

      const today = new Date().toDateString();

      if (user.transferDate !== today) {
        await users.updateOne(
          { userId },
          { $set: { transferToday: 0, transferDate: today } }
        );
        user.transferToday = 0;
      }

      if (user.transferToday + amount > 500000) {
        return res.status(200).json({
          type: 4,
          data: {
            flags: 64,
            embeds: [{ color: 0xff4444, description: "Daily transfer limit is **500000 coins**" }]
          }
        });
      }

      if (amount > user.balance) {
        return res.status(200).json({
          type: 4,
          data: { flags: 64, embeds: [{ color: 0xff4444, description: "Not enough coins" }] }
        });
      }

      await transferCoins(userId, targetId, amount);

      await users.updateOne(
        { userId },
        { $inc: { transferToday: amount } }
      );

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [
            {
              color: 0x57f287,
              title: "Coins Sent",
              description: `You gave **${amount.toLocaleString()}** to <@${targetId}>`
            }
          ]
        }
      });
    }

    if (name === "leaderboard") {
      const db = await getDB();
      const usersCollection = db.collection("users");

      const topUsers = await usersCollection
        .find({})
        .sort({ balance: -1 })
        .limit(10)
        .toArray();

      let rows = "";

      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        rows += `${i + 1}. <@${u.userId}> - Coins ${u.balance.toLocaleString()}\n`;
      }

      if (!rows) {
        return res.status(200).json({
          type: 4,
          data: {
            embeds: [
              {
                color: 0x3a3b40,
                title: "Leaderboard",
                description: "...",
                footer: { text: "No players yet." }
              }
            ]
          }
        });
      }

      const currentUser = await getUser(userId, username);

      const rank =
        (await usersCollection.countDocuments({
          balance: { $gt: currentUser.balance }
        })) + 1;

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [
            {
              color: 0x3a3b40,
              title: "Leaderboard",
              description:
                `${rows}\n-# Congratulations! You are currently ranked **#${rank}**!`
            }
          ]
        }
      });
    }

    return res.status(200).json({ type: 4, data: { content: "Unknown command" } });
  }
}
