import { ApplicationCommandOptionType } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } from "@discordjs/voice";
import { SoundCloud } from "scdl-core";
import ytdl from "@distube/ytdl-core";
import fetch from "node-fetch";
import fs from "fs";
import emitter from '../../resources/emitters/sharedEmitter.js';
import path from 'path';

export const queue = new Map(); // creates and exports a map to store queue in case i want to use this bot on multiple guilds

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
    const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8')); // load cookies from JSON file
    const agent = ytdl.createAgent(cookies); // create an agent with cookies
    const link = interaction.options.getString("link");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "You need to be in a voice channel to play audio/music !!",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      let stream, songInfo;

      if (link.includes('soundcloud.com')) {
        // SoundCloud link handling
        await SoundCloud.connect();
        stream = await SoundCloud.download(link);
        songInfo = { title: 'SoundCloud Track', duration: 'Unknown', requestedBy: interaction.user.tag };
      } else if (link.includes('youtube.com') || link.includes('youtu.be')) {
        // YouTube link handling
        let retries = 3;
        let format;
        while (retries > 0) {
          try {
            // fetch video info
            const info = await ytdl.getInfo(link, { agent });
            songInfo = {
              title: info.videoDetails.title,
              duration: formatDuration(info.videoDetails.lengthSeconds), // format duration as needed
              requestedBy: interaction.user.tag, // capture who requested the song
            };
            // choose the best audio format
            const formats = info.formats.filter(f => f.audioCodec);
            if (formats.length === 0) {
              throw new Error('No suitable audio format found.');
            }
            format = formats.reduce((best, current) => (current.audioBitrate > best.audioBitrate) ? current : best);
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
        songInfo = {
          title: path.basename(link), // use the filename as title
          duration: 'Unknown', // duration unknown for direct links
          requestedBy: interaction.user.tag, // saves the user who requested the song
        };
      } else {
        await interaction.editReply({ content: "The provided link is not supported.", ephemeral: true });
        return; // exit early as the link is invalid
      }

      // add song info to the first item in the queue
      let guildQueue = queue.get(interaction.guild.id);
      if (!guildQueue) {
        guildQueue = [];
        queue.set(interaction.guild.id, guildQueue);
      }
      guildQueue.push({ ...songInfo, link });

      if (guildQueue.length === 1) {
        playNext(interaction, voiceChannel, guildQueue, agent);
      } else {
        await interaction.editReply({ content: `Added to the queue: **${link}**` });
      }

    } catch (error) {
      console.error('Audio playback error:', error);
      await interaction.editReply({ content: "There was an error trying to play this track.", ephemeral: true });
    }
  },
};

// plays the next song in the queue
export async function playNext(interaction, voiceChannel, guildQueue, agent) {
  if (guildQueue.length === 0) return;

  const link = guildQueue[0];
  const connection = getVoiceConnection(interaction.guild.id) || joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: interaction.guild.id,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  try {
    let stream = link.link;

    if (link.link.includes('soundcloud.com')) {
      stream = await SoundCloud.download(link.link);
    } else if (link.link.includes('youtube.com') || link.link.includes('youtu.be')) {
      const info = await ytdl.getInfo(link.link, { agent });
      const format = info.formats.find(f => f.audioCodec);
      stream = ytdl.downloadFromInfo(info, { format, agent });
    } else {
      const response = await fetch(link.link);
      if (!response.ok) throw new Error(`Failed to fetch audio file: ${response.statusText}`);
      stream = response.body;
    }

    const resource = createAudioResource(stream);
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    await interaction.editReply({ content: `Now playing: **${link.title}**` });

    // handle player events
    player.on(AudioPlayerStatus.Idle, () => {
      guildQueue.shift(); // remove the played song from the queue
      playNext(interaction, voiceChannel, guildQueue, agent); // plays the next song
    });
    player.on('error', error => {
      console.error('Audio playback error:', error);
      guildQueue.shift(); // remove the failed song from the queue
      playNext(interaction, voiceChannel, guildQueue, agent); // plays the next song
    });

    // handle connection events
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      emitter.emit('musicStopped'); // signal that music has stopped
      queue.delete(interaction.guild.id); // clear the queue if disconnected
    });

  } catch (error) {
    console.error('Audio playback error:', error);
    emitter.emit('musicStopped'); // signal that music has stopped on error
    getVoiceConnection(interaction.guild.id)?.destroy();
    guildQueue.shift(); // remove the problematic song
    playNext(interaction, voiceChannel, guildQueue, agent); // tries to play the next song

    await interaction.editReply({ content: "There was an error trying to play this track.", ephemeral: true });
  }
}

// formats duration
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
