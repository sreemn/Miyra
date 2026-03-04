const BOT_TOKEN = "DISCORD_BOT_TOKEN";
const APP_ID = "DISCORD_APP_ID";

const commands = [
  {
    name: "help",
    description: "Show bot information"
  }
];

async function register() {

  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to register commands");
    console.error("Status:", response.status);
    console.error("Response:", error);
    return;
  }

  const data = await response.json();

  console.log("Commands registered successfully!");
  console.log("Status:", response.status);

  data.forEach(cmd => {
    console.log(`/${cmd.name}`);
  });
}

register().catch(err => {
  console.error("Unexpected error:");
  console.error(err);
});
