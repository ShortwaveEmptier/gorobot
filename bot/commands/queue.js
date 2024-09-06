import { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { queue as globalQueue, playNext } from './playMusic.js';
import emitter from '../../resources/emitters/sharedEmitter.js';

export default {
  name: 'queue',
  description: 'Displays the current queue with control buttons.',
  options: [],

  async execute(interaction) {
    // fetch the queue for the guild
    const guildQueue = globalQueue.get(interaction.guild.id); // using guildQueue to avoid conflict

    if (!guildQueue || guildQueue.length === 0) {
      return interaction.reply({
        content: 'The queue is currently empty !!',
        ephemeral: true,
      });
    }

    // embed builder to display queue information
    const embed = new EmbedBuilder()
      .setTitle("Current Queue")
      .setColor("#ffffff"); // default color if no role found (it doesn't work, will fix later)

    // iterating over the queue to add songs with user-specific colors
    guildQueue.forEach((song, index) => {
      // fetch member and their top role color
      const member = interaction.guild.members.cache.get(song.requestedBy); // `song.requestedBy` should be the user ID
      const topRole = member?.roles.highest; // fetch the highest role by position
      const roleColor = topRole?.color || "#ffffff"; // use the role color, default to white if none

      embed.addFields({
        name: `#${index + 1} - ${song.title}`,
        value: `Duration: ${song.duration}\nRequested by: <@${song.requestedBy}>`,
        inline: false,
      });

      // apply color based on the user's colour role
      embed.setColor(roleColor);
    });

    // creates control buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pause')
          .setLabel('Pause')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('play')
          .setLabel('Play')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('skip')
          .setLabel('Skip')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stop')
          .setLabel('Stop')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('shuffle')
          .setLabel('Shuffle')
          .setStyle(ButtonStyle.Success),
      );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    // interaction collectors for the buttons
    const filter = (i) => i.customId === 'pause' || i.customId === 'play' || i.customId === 'skip' || i.customId === 'stop' || i.customId === 'shuffle';
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i) => {
      const connection = getVoiceConnection(interaction.guild.id);
      if (!connection) {
        return i.reply({ content: 'I am not connected to a voice channel !!', ephemeral: true });
      }

      switch (i.customId) {
        case 'pause':
          connection.state.subscription.player.pause();
          await i.update({ content: 'Playback paused.', components: [row] });
          break;

        case 'play':
          connection.state.subscription.player.unpause();
          await i.update({ content: 'Playback resumed.', components: [row] });
          break;

        case 'skip':
          guildQueue.shift();
          playNext(interaction, interaction.member.voice.channel, guildQueue);
          await i.update({ content: 'Skipped to the next song.', components: [row] });
          break;
        
        case 'stop':
          globalQueue.delete(interaction.guild.id);
          await i.update({ content: 'Playback stopped and the queue has been cleared.', components: [row] });
          emitter.emit('musicStopped');
          break;

        case 'shuffle':
          shuffleQueue(guildQueue);
          await i.update({ content: 'The queue has been shuffled.', embeds: [embed], components: [row] });
          break;

        default:
          break;
      }
    });

    collector.on('end', collected => {
      if (!collected.size) {
        interaction.editReply({ content: 'Queue control buttons expired.', components: [] });
      }
    });
  },
};

// shuffles the queue
function shuffleQueue(queue) {
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
}
