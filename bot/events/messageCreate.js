import ollama from 'ollama';
export default {
    name: 'messageCreate',
    once: false,

    async execute(message, client) {
        if (message.author.id === client.user.id) return;

        if (message.mentions.has(client.user.id)) {
            if (message.content === "<@1108870774066004028>") {
                message.reply({
                    content: randomMedia()
                });
            } else {
                message.reply({
                    content: "Im temporarily not available :("
                });
            }
        }
    }
};

function randomMedia() {
    const chance = Math.floor(Math.random() * 3);
    switch (chance) {
        case 0:
          return "https://media.discordapp.net/attachments/1268959975342870610/1269091020205986025/caption.gif?ex=66aecc9d&is=66ad7b1d&hm=5711d1e9cbb2950ab296981089c5b0ba62a8c6df228f289390a50d9abed92005&=&width=581&height=655"
        case 1:
          return "https://cdn.discordapp.com/attachments/1268959975342870610/1269091020608503920/snapchat.gif?ex=66aecc9d&is=66ad7b1d&hm=7e2761fb70f6b248eac70cca5d09f1dd1bd29184fd1f10382054166c64a6afce&"
        case 2:
          return "https://media.discordapp.net/attachments/969679824337666061/1286382331099353129/sabyMce.png?ex=66edb467&is=66ec62e7&hm=7241c04dd7bf4fe20474c15aec067aceeee0a7b72f3bc58866f70681eebc2fdf&=&format=webp&quality=lossless"
        default:
          return "ne"
    }   
}
