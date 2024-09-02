import { ApplicationCommandOptionType } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } from "@discordjs/voice";
import { SoundCloud } from "scdl-core";
import ytdl from "@distube/ytdl-core";
import fetch from "node-fetch";
import fs from "fs";
import emitter from "../../resources/emitters/sharedEmitter.js";

export default {
  name: "playsound",
  description: "Plays sounds/music via direct link, SoundCloud, or YouTube.",
  options: [
    {
      name: "link",
      description: "Enter a link to an audio file or song",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async execute(interaction) {
    const cookiesFilePath = './resources/ytcookies.json';
    const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8')); // Load cookies from JSON file
    const agent = ytdl.createAgent(cookies); // Create an agent with cookies
    const link = interaction.options.getString("link");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "You need to be in a voice channel to play audio/music!",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    try {
      let stream;

      if (link.includes('soundcloud.com')) {
        // SoundCloud link handling
        await SoundCloud.connect();
        stream = await SoundCloud.download(link);
      } else if (link.includes('youtube.com') || link.includes('youtu.be')) {
        // YouTube link handling with DisTube ytdl-core
        let retries = 3;
        let format;
        while (retries > 0) {
          try {
            // fetch video info
            const info = await ytdl.getInfo(link, { agent });

            // choose the best audio format
            const formats = info.formats.filter(f => f.audioCodec);
            if (formats.length === 0) {
              throw new Error('No suitable audio format found.');
            }

            format = formats.reduce((best, current) => {
              return (current.audioBitrate > best.audioBitrate) ? current : best;
            });

            stream = ytdl.downloadFromInfo(info, { format, agent });
            break; // exit loop if successful
          } catch (error) {
            console.error(`Attempt failed with error: ${error.message}`);
            retries--;
            if (retries === 0) throw error; // rethrow error if out of retries
            console.log('Retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait before retrying
          }
        }
      } else if (link.endsWith('.mp3') || link.endsWith('.wav') || link.endsWith('.ogg') || link.endsWith('.flac') || link.endsWith('.mp4') || link.endsWith('.webm')) {
        // direct link handling with various formats
        const response = await fetch(link);
        if (!response.ok) throw new Error(`Failed to fetch audio file: ${response.statusText}`);
        stream = response.body;
      } else {
        return interaction.editReply({
          content: "The provided link is not supported.",
          ephemeral: true,
        });
      }

      emitter.emit('musicStarted'); // signal that music has started
      const resource = createAudioResource(stream);
      const player = createAudioPlayer();

      player.play(resource);
      connection.subscribe(player);

      await interaction.editReply({ content: `Now playing: **${link}**` });

      // handle player events
      player.once(AudioPlayerStatus.Idle, () => {
        emitter.emit('musicStopped'); // signal that music has stopped
      });

      // handle connection events
      connection.once(VoiceConnectionStatus.Disconnected, () => {
        emitter.emit('musicStopped'); // signal that music has stopped
      });

    } catch (error) {
      console.error('Audio playback error:', error);
      emitter.emit('musicStopped'); // signal that music has stopped on error

      return interaction.editReply({
        content: "There was an error trying to play this track.",
        ephemeral: true,
      });
    }
  },
};
