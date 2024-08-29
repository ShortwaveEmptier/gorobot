import { ActivityType } from "discord.js";

export default {
  name: "ready",
  once: true,

  execute(client) {
    console.log(`✅ ${client.user.tag} is online.\n`);
    const randomIndex = Math.floor(Math.random() * 5);

    switch (randomIndex) {
      case 0:
        client.user.setActivity("🤙", {
          type: ActivityType.Custom});
        break;
      case 1:
        client.user.setActivity("https://youtu.be/tCng3Wu6Zo0", {
          type: ActivityType.Listening});
        break;        
      case 2:
        client.user.setActivity("http://gg.gg/camdudes-com", {
          type: ActivityType.Streaming});
        break;
      case 3:
        client.user.setActivity("https://youtu.be/RvgHv6PM61U", {
          type: ActivityType.Listening});
        break;
      case 4:
        client.user.setActivity("https://youtu.be/-bn9Pykr2BM", {
          type: ActivityType.Listening});
        break;
      default:
        break;
    }
  },
};