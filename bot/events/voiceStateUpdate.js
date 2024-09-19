import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from '@discordjs/voice';
import fs from 'fs';
import path from 'path';
import { setTimeout } from 'timers/promises';
import emitter from "../../resources/emitters/sharedEmitter.js";

const SOUNDS_FOLDER = './resources/sounds';
const MIN_IDLE_TIME = 60000; // 1 min
const MAX_IDLE_TIME = 900000; // 15 mins
const DELAY_MIN = 1000; // 1 second
const DELAY_MAX = 30000; // 30 seconds

const activeConnections = new Map(); // tracks connection and their states
let playbackPaused = false; // flag to control playback pause state

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
            const isEmpty = newChannel.members.size === 1;

            // case when bot is in the channel and it's empty
            if (botInChannel && isEmpty) {
                const delay = Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
                console.log(`Waiting ${delay / 1000} seconds before joining the empty channel.`);
                await setTimeout(delay);

                // re-check if the bot is still in the empty channel after the delay
                if (newChannel.members.size === 1 && newChannel.members.has(botMember.id)) {
                    let connection = getVoiceConnection(newState.guild.id);

                    if (!connection) {
                        connection = joinVoiceChannel({
                            channelId: newChannel.id,
                            guildId: newState.guild.id,
                            adapterCreator: newState.guild.voiceAdapterCreator,
                        });
                        activeConnections.set(newState.guild.id, { connection, playing: false, channel: newChannel });
                    }

                    const state = activeConnections.get(newState.guild.id);
                    if (newChannel.members.size > 1 && !state.playing) {
                        state.playing = true;
                        await playSounds(connection, newChannel); // ensure playSounds is awaited
                    }
                }
            } 
            // case when a user joins an already full channel
            else if (!botInChannel && newChannel.members.size > 1) {
                let connection = getVoiceConnection(newState.guild.id);

                if (!connection) {
                    connection = joinVoiceChannel({
                        channelId: newChannel.id,
                        guildId: newState.guild.id,
                        adapterCreator: newState.guild.voiceAdapterCreator,
                    });
                    activeConnections.set(newState.guild.id, { connection, playing: false, channel: newChannel });
                }

                const state = activeConnections.get(newState.guild.id);
                if (!state.playing) {
                    state.playing = true;
                    await playSounds(connection, newChannel); // ensure playSounds is awaited
                }
            }
        }

        // handle case when there are no remaining users
        if (oldChannel && oldChannel.members.size === 1 && oldChannel.members.has(botMember.id)) {
            const connection = getVoiceConnection(oldState.guild.id);
            if (connection) {
                connection.destroy();
                activeConnections.delete(oldState.guild.id);
            }
        }
    },
};

// handles the playback and logs the remaining time
async function playSounds(connection, channel) {
    while (channel.members.size > 1) {
        if (playbackPaused) {
            // wait until playback is resumed
            await new Promise(resolve => {
                const onResume = () => {
                    emitter.off('musicStarted', onResume);
                    emitter.off('musicStopped', onResume);
                    resolve();
                };
                emitter.once('musicStarted', onResume);
                emitter.once('musicStopped', onResume);
            });
        }

        const idleTime = Math.floor(Math.random() * (MAX_IDLE_TIME - MIN_IDLE_TIME + 1) + MIN_IDLE_TIME);
        const minutes = Math.floor(idleTime / 60000);
        const seconds = Math.floor((idleTime % 60000) / 1000);
        const timeUntil = `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
        console.log(`Time until next sound: ${timeUntil}`);

        await setTimeout(idleTime);

        if (channel.members.size > 1) { // check so it doesn't play sounds when disconnected
            if (!playbackPaused) {
                await playRandomSound(connection); // ensure playRandomSound is awaited
            }
        } else {
            break;
        }
    }

    const state = activeConnections.get(channel.guild.id);
    if (state) {
        state.playing = false; // ensure that the playing state is set to false
    }
    connection.destroy();
    activeConnections.delete(channel.guild.id); // clean up the active connections map    
}

// plays a random sound from the SOUNDS_FOLDER
async function playRandomSound(connection) {
    const soundFiles = fs.readdirSync(SOUNDS_FOLDER).filter(file => file.endsWith('.mp3'));
    if (soundFiles.length === 0) {
        console.log('No sound files found.');
        return;
    }

    const soundFile = soundFiles[Math.floor(Math.random() * soundFiles.length)];
    console.log(`Playing sound: ${soundFile}`);
    
    const filePath = path.join(SOUNDS_FOLDER, soundFile);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const resource = createAudioResource(filePath);
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        player.stop();
    });

    player.on('error', (error) => {
        console.error('Error playing sound:', error);
        player.stop();
    });
}

// logs emitters
emitter.on('musicStarted', () => {
    console.log('Music started playing.');
    playbackPaused = true; // pause random sound playback
});

emitter.on('musicStopped', () => {
    console.log('Music stopped playing.');
    playbackPaused = false; // resume random sound playback
});
