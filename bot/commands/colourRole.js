import { ApplicationCommandOptionType } from "discord.js";

export default {
  name: "changecolour",
  description: "Change the colour of your role using hex-code.",
  options: [
    {
      name: "colourcode",
      description: "Hex code of the colour (e.g., #F8FA70)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async execute(interaction, client) {
    let colour = interaction.options.get("colourcode").value;

    if(isHexColour(colour) === false) {
      return interaction.reply({
        content: "This is not a valid colour-code :(",
        ephemeral: true,
      });
    }

    if(colour === "#000000") colour = "#000001";

    const existingRole = interaction.guild.roles.cache.find(
      (role) => role.name === `${interaction.user.id}`
    );

    if (existingRole) {
      await existingRole.edit({ color: `${colour}` });

      return interaction.reply({
        content: `Your role colour has been changed to \`${colour}\``,
        ephemeral: true,
      });
    } else {
      const role = await interaction.guild.roles.create({
        name: `${interaction.user.id}`,
        color: `${colour}`,
        position: 8,
        hoist: false,
      });

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(role);

      return interaction.reply({
        content: `Your role colour has been changed to \`${colour}\``,
        ephemeral: true,
      });
    }
  },
};

function isHexColour(colour) {
    const re = /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/
    return re.test(colour)
}