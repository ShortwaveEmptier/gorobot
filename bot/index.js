import {
    REST,
    Routes,
    Client,
    Partials,
    GatewayIntentBits,
    PermissionsBitField, 
    Collection
} from "discord.js";

import dotenv from 'dotenv';
import fs from 'fs';
import sodium from 'libsodium-wrappers';

process.noDeprecation = true;
dotenv.config()

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction
    ],
    allowedMentions: {
        parse: ["users", "roles"]
    },
});

export default client;

const successEmoji = '✅';
const errorEmoji = '❌';
const loadingEmoji = '⏳';

client.commands = new Collection();
const commandFiles = fs.readdirSync('./bot/commands').filter(file => file.endsWith('.js'));

const registerSlashCommands = async (commands, applicationId, guildId) => {
    try {
        const commandData = commands.map(command => ({
            name: command.name,
            description: command.description,
            options: command.options || [],
            default_permission: command.default_permission ? command.default_permission : null,
            default_member_permissions: command.default_member_permissions ? PermissionsBitField.resolve(command.default_member_permissions).toString() : null
        }));

        const rest = new REST({
            version: '10'
        }).setToken(process.env.DISCORD_TOKEN);

        await rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
            body: commandData
        });

        console.log(`${successEmoji} Registered slash commands for guild ${guildId}: ${commandData.map(c => c.name).join(', ')}`);
    } catch (error) {
        console.error(`${errorEmoji} Failed to register slash commands for guild ${guildId}:`, error);
        throw error;
    }
};

const registerAllCommands = async (guildId) => {
    try {
        const applicationId = await getApplicationId();
        const commands = [];

        for (const file of commandFiles) {
            try {
                const commandModule = await import(`./bot/commands/${file}`);
                const command = commandModule.default;
                console.log(`${loadingEmoji} Loaded command: ${command.name}`);
                client.commands.set(command.name, command);
                commands.push(command);
            } catch (error) {
                console.error(`${errorEmoji} Failed to load command file ${file}:`, error);
                await Promise.resolve();
            }
        }

        await registerSlashCommands(commands, applicationId, guildId);
        console.log(`${successEmoji} All commands registered successfully for guild ${guildId}`);
        startBot();
    } catch (error) {
        console.error(`${errorEmoji} Failed to fetch application ID:`, error);
    }
};

const getApplicationId = async () => {
    try {
        const response = await fetch('https://discord.com/api/v9/applications/@me', {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            },
        });

        const data = await response.json();
        if (response.ok) {
            return data.id;
        } else {
            throw new Error(`Failed to fetch application ID: ${response.status} - ${data.message}`);
        }
    } catch (error) {
        throw new Error(`Failed to fetch application ID: ${error.message}`);
    }
};

const guildId = process.env.GUILD_ID;

console.log(`${loadingEmoji} Registering commands...`);
registerAllCommands(guildId)
    .then(() => {
        console.log(`${successEmoji} Commands registration completed.`);
    })
    .catch(error => {
        console.error(`${errorEmoji} Error registering commands:`, error);
    });

const eventFiles = fs.readdirSync('./bot/events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    import(`./bot/events/${file}`).then(eventModule => {
        const event = eventModule.default;

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }).catch(error => {
        console.error(`Failed to load event file ${file}:`, error);
    });
}

const startBot = () => {
    const handleCrash = (error) => {
        console.error(`⛔ Bot crashed:`, error);

        console.error(`Timestamp: ${new Date().toISOString()}`);
        console.error(`Error Stack Trace:`, error.stack || error.message || error);

        process.off('uncaughtException', handleCrash);
        process.off('unhandledRejection', handleRejection);

        setTimeout(() => {
            process.nextTick(startBot);
        }, 5000);
    };

    const handleRejection = (reason, promise) => {
        console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    };

    process.on('uncaughtException', handleCrash);
    process.on('unhandledRejection', handleRejection);

    client.login(process.env.DISCORD_TOKEN)
        .catch((error) => {
            console.error(`❌ Failed to log in:`, error);
            process.nextTick(startBot);
        });
};

(async () => {
    await sodium.ready;
    startBot();
})();
