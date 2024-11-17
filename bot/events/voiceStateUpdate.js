import fs from 'fs';
import path from 'path';
import { setTimeout } from 'timers/promises';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from '@discordjs/voice';

const SOUNDS_FOLDER = './resources/sounds';
const MIN_IDLE_TIME = 300000;   // 5 minutes
const MAX_IDLE_TIME = 2700000;  // 45 minutes
const DELAY_MIN = 1000;         // 1 second
const DELAY_MAX = 30000;        // 30 seconds

// tracks active voice connections and their states
const activeConnections = new Map();

export default {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState, newState) {
        const oldChannel = oldState.channel;
        const newChannel = newState.channel;
        const botMember = newState.guild.members.me;

        // when someone joins a voice channel
        if (newChannel && !newState.member.user.bot) {
            const botInChannel = newChannel.members.has(botMember.id);

            // waits a bit before joining
            if (!botInChannel && newChannel.members.size === 1) {
                const delay = Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
                await setTimeout(delay);

                // re-check if the channel is still empty
                if (newChannel.members.size === 1) {
                    await joinChannelAndPlay(newChannel);
                }
            } 
            // joins when there are already users in the channel
            else if (!botInChannel && newChannel.members.size > 1) {
                await joinChannelAndPlay(newChannel);
            }
        }

        // leaves the channel if there are no more users
        if (oldChannel && oldChannel.members.size === 1 && oldChannel.members.has(botMember.id)) {
            const connection = getVoiceConnection(oldState.guild.id);
            if (connection) {
                connection.destroy();
                activeConnections.delete(oldState.guild.id);
            }
        }
    },
};

// function for joining and starting sound playback
async function joinChannelAndPlay(channel) {
    if (activeConnections.has(channel.guild.id)) return;
    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        connection.on('stateChange', (oldState, newState) => {
            if (newState.status === 'disconnected') {
                connection.destroy();
                activeConnections.delete(channel.guild.id);
            }
        });

        activeConnections.set(channel.guild.id, { connection, channel });
        await setTimeout(500); // 500ms to allow the bot to fully join and members to update
        await playSounds(connection, channel);
    } catch (error) {
        console.error('❌ Failed to join channel:', error); 
    }
}

// handles the playback and logs the remaining time
async function playSounds(connection, channel) {
    while (channel.members.size > 1) {
        // check if there are non-bot members
        const nonBotMembers = channel.members.filter(member => !member.user.bot);
        if (nonBotMembers.size === 0) {
            break;
        }

        const idleTime = Math.floor(Math.random() * (MAX_IDLE_TIME - MIN_IDLE_TIME + 1)) + MIN_IDLE_TIME;
        const minutes = Math.floor(idleTime / 60000);
        const seconds = Math.floor((idleTime % 60000) / 1000);
        console.log('⏳ Time until next sound: ${minutes}m ${seconds}s');

        await setTimeout(idleTime);

        if (channel.members.size > 1) {
            await playRandomSound(connection);
        } else {
            break;
        }
    }

    connection.destroy();
    activeConnections.delete(channel.guild.id); // clean up active connections
}

// plays a random sound from the SOUNDS_FOLDER
async function playRandomSound(connection) {
    const soundFiles = fs.readdirSync(SOUNDS_FOLDER).filter(file => file.endsWith('.mp3'));
    if (soundFiles.length === 0) {
        console.log('❌ No sound files found.');
        return;
    }

    const soundFile = soundFiles[Math.floor(Math.random() * soundFiles.length)];
    const filePath = path.join(SOUNDS_FOLDER, soundFile);
    
    const resource = createAudioResource(filePath);
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => player.stop());
    player.on('error', (error) => console.error('❌ Error playing sound:', error));
}