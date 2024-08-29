export default {
  name: "ping",
  description: "Pong!",
  //   devOnly: true,
  //   default_member_permissions: 'Administrator',

  async execute(interaction, client) {
    interaction.reply({
        content: `Latency: ${Date.now() - interaction.createdTimestamp}ms.\nAPI Latency: ${Math.round(client.ws.ping)}ms`
    });
  },
};
