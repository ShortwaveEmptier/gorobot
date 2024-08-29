import { ApplicationCommandOptionType } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import { SoundCloud } from "scdl-core";

export default {
  name: "playsound", //KEINE CAPITAL LETTERS BEI COMMAND NAMES DU SCHEISS KANAKE
  description: "Plays sounds/music via direct link or via soundcloud.",
  devOnly: true,
  options: [
    {
      name: "link",
      description: "Enter a link to an audio file or song",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async execute(interaction) {
    const link = interaction.options.getString("link");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "You need to be in a voice channel to play audio/music !!",
        ephemeral: true,
      });
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    try {
      await SoundCloud.connect();
      const stream = await SoundCloud.download(link);
      const resource = createAudioResource(stream);

      const player = createAudioPlayer();
      player.play(resource);
      connection.subscribe(player);

      player.on(AudioPlayerStatus.Playing, () => {
        interaction.reply({ content: `Now playing: **${link}**` });
      });

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        connection.destroy();
      });

    } catch (error) {
      console.error(error);
      connection.destroy();
      return interaction.reply({
        content: "There was an error trying to play this track :(",
        ephemeral: true,
      });
    }
  },
};
