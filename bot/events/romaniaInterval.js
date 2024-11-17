import fs from "fs";
import dotenv from 'dotenv';
dotenv.config();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  name: "ready",
  once: false,

  async execute(client) {
    async function nameChanger() {
      const romanianTitles = JSON.parse(fs.readFileSync("./resources/romanianTitles.json", "utf-8"));
      const romanianNames = JSON.parse(fs.readFileSync("./resources/romanianNames.json", "utf-8"));
      const romanianLastNames = JSON.parse(fs.readFileSync("./resources/romanianLastNames.json", "utf-8"));
      console.log('⏳ Taking a 30-minute break before applying nicknames...\n');
      await delay(30 * 60 * 1000);

      try {
        const guildId = process.env.GUILD_ID;
        const guild = await client.guilds.fetch(`${guildId}`);
        const members = await guild.members.fetch();

        for (const member of members.values()) {
          if (member.id !== client.user.id && member.id !== "403258108140453890") {
            const randomIndex = Math.floor(Math.random() * 2);
            const randomLastName = romanianLastNames[Math.floor(Math.random() * romanianLastNames.length)];

            switch (randomIndex) {
              case 0:
                await member.setNickname(`${romanianTitles[Math.floor(Math.random() * romanianTitles.length)]} ${randomLastName}`).catch(console.error);
                break;
              case 1:
                await member.setNickname(`${romanianNames[Math.floor(Math.random() * romanianNames.length)]} ${randomLastName}`).catch(console.error);
                break;
            }
          }
        }
        
        console.log('✅ Nicknames changed !!');
      } catch (error) {
        console.error('❌ Error fetching members or updating nicknames: ', error);
      }
    }

    nameChanger();
    setInterval(nameChanger, 86_400_000); // 86,400,000 milliseconds = 24 hours
  },
};