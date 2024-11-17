import { ActivityType } from "discord.js";
import randomEventCreator from './randomEvents.js';

export default {
  name: "ready",
  once: true,

  execute(client) {
    console.log('✅ ${client.user.tag} is online.');
    const randomIndex = Math.floor(Math.random() * 5);
    randomEventCreator.execute();

    switch (randomIndex) {
      case 0:
        client.user.setActivity("🤙", {
          type: ActivityType.Custom});
        break;
      case 1:
        client.user.setActivity(":3", {
          type: ActivityType.Custom});
        break;       
      case 2:
        client.user.setActivity("Wasting bandwidth", {
          type: ActivityType.Custom});
        break;
      case 3:
        client.user.setActivity("Movie 📸", {
          type: ActivityType.Custom});
        break;
      case 4:
        client.user.setActivity("on camdudes.com", {
          type: ActivityType.Streaming,
          url: "https://www.twitch.tv/trymacs" 
      });
      default:
        break;
    }
  },
};