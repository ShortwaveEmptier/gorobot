import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from '@discordjs/voice';
import fs from 'fs';
import path from 'path';
import { setTimeout } from 'timers/promises';

const SOUNDS_FOLDER = './resources/sounds';
const MIN_IDLE_TIME = 60000;
const MAX_IDLE_TIME = 900000;

export default {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState, newState) {
        const channel = newState.channel;
        
        // checks if the person who joined the channel isnt Goro itself
        if (channel && !newState.member.user.bot) {
            let connection = getVoiceConnection(newState.guild.id);
            
            // connects to a VC
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: newState.guild.id,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                }); 
            }

            // start playing sounds only if there are more than one user in the channel
            if (!connection.playing && channel.members.size > 1) {
                connection.playing = true;
                playSounds(connection, channel);
            }
        }

        // makes the bot leave
        if (oldState.channel && oldState.channel.members.size === 1 && oldState.channel.members.has(newState.guild.members.me.id)) {
            const connection = getVoiceConnection(oldState.guild.id);
            if (connection) {
                connection.destroy();
            }
        }
    },
};

// does the time calculation and puts the time left in the log
async function playSounds(connection, channel) {
    while (channel.members.size > 1) {
        const idleTime = Math.floor(Math.random() * (MAX_IDLE_TIME - MIN_IDLE_TIME + 1) + MIN_IDLE_TIME);
        const minutes = Math.floor(idleTime / 60000);
        const seconds = Math.floor((idleTime % 60000) / 1000);
        const timeUntil = `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
        console.log(`Time until next sound: ${timeUntil}`);

        await new Promise(resolve => setTimeout(resolve, idleTime));

        if (channel.members.size > 1) { // check so he doesnt play sounds when disconnected, hopefully prevents cluttered logs
            playRandomSound(connection);
        }
    }

    connection.playing = false;
    connection.destroy();
}

// won't bother adding any other support because mp3 superiority 
function playRandomSound(connection) {
    const soundFiles = fs.readdirSync(SOUNDS_FOLDER).filter(file => file.endsWith('.mp3'));
    if (soundFiles.length === 0) {
        console.log('No sound files found.');
        return;
    }

    // selects a random sound and plays it
    const soundFile = soundFiles[Math.floor(Math.random() * soundFiles.length)];
    console.log(`Playing sound: ${soundFile}`);
    const resource = createAudioResource(path.join(SOUNDS_FOLDER, soundFile));
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        console.log('Playback finished.');
        player.stop();
    });

    player.on('error', (error) => {
        console.error('Error playing sound:', error);
        player.stop();
    });
}
