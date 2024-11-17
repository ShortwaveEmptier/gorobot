import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = resolve(__dirname, '../../resources/messages.db');
let db;

// initialize the database
async function initDB() {
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // set UTF-8 encoding for the database
    await db.run("PRAGMA encoding = 'UTF-8';");

    // create the table if it doesn't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            content TEXT NOT NULL,
            isLink BOOLEAN NOT NULL 
        )
    `);

    console.log("✅ Database initialized successfully");
}

// Remove user and role mentions from content
function removeMentions(content) {
    return content.replace(/<@!?(\d+)>|<@&(\d+)>/g, '');
}

// log and save messages to the database
async function logMessage(userId, content) {
    if (!db) {
        console.error("❌ Database not initialized yet");
        return;
    }

    // remove mentions
    const cleanedContent = removeMentions(content);

    // check if the cleaned content contains a link
    const isLink = cleanedContent.includes("https://");

    await db.run(
        'INSERT INTO messages (userId, content, isLink) VALUES (?, ?, ?)',
        [userId, cleanedContent, isLink]
    );
}


// fetch messages for the Markov model
async function fetchMessages() {
    if (!db) {
        console.error("❌ Database not initialized yet");
        return [];
    }
    const rows = await db.all('SELECT content FROM messages WHERE isLink = 0');
    return rows.map(row => row.content);
}

// tokenize text into words
function tokenize(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const tokens = [];
    
    lines.forEach(line => {
        // match and extract full custom emojis (e.g., <:emoji_name:emoji_id>)
        const customEmojiPattern = /<:\w+:\d+>/g; 
        // match and extract standalone Unicode emojis (e.g., :emoji_name:)
        const unicodeEmojiPattern = /(?<!<):\w+:(?!\d+>)/g;

        // extract emojis
        const customEmojiMatches = Array.from(line.matchAll(customEmojiPattern)).map(match => match[0]);
        const unicodeEmojiMatches = Array.from(line.matchAll(unicodeEmojiPattern)).map(match => match[0]);

        // remove emojis from the line for tokenizing the text
        const cleanLine = line
            .replace(customEmojiPattern, '')
            .replace(unicodeEmojiPattern, '');

        const words = cleanLine
            .replace(/[^a-zA-Z0-9äöüÄÖÜß.,!?;:\-\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 0);

        // combine tokens with preserved emojis
        tokens.push(...words, ...customEmojiMatches, ...unicodeEmojiMatches);
    });
    
    return tokens;
}

// build the trigram Markov chain
function buildTrigramModel(sentences) {
    const model = {};

    sentences.forEach(sentence => {
        const sentenceList = sentence.split(/[.!?]\s*/);  // split into sentences
        sentenceList.forEach(sentence => {
            const words = tokenize(sentence);
            words.push("<END>"); // end marker
            words.unshift("<START>", "<START>"); // start marker

            for (let i = 0; i < words.length - 2; i++) {
                const key = `${words[i]} ${words[i + 1]}`;
                const next = words[i + 2];

                if (!model[key]) model[key] = {};
                model[key][next] = (model[key][next] || 0) + 1; // increment frequency
            }
        });
    });

    // normalize probabilities (smoothing)
    for (const key in model) {
        const total = Object.values(model[key]).reduce((sum, freq) => sum + freq, 0);
        for (const next in model[key]) {
            model[key][next] /= total; // convert counts to probabilities
        }
    }

    return model;
}

// generate a sentence from the Markov model with punctuation
function generateSentence(model) {
    const sentence = [];
    let current = "<START> <START>";
    const punctuations = ['.', '!', '?'];

    while (true) {
        const [prev1, prev2] = current.split(" ");
        const nextWords = model[current];
        if (!nextWords || sentence.length > 15) break; // length cap

        // weighted random choice
        const rand = Math.random();
        let cumulative = 0;
        let nextWord = null;

        for (const word in nextWords) {
            cumulative += nextWords[word];
            if (rand < cumulative) {
                nextWord = word;
                break;
            }
        }

        if (nextWord === "<END>") break;
        sentence.push(nextWord);
        current = `${prev2} ${nextWord}`;

        // randomly add punctuation after 5+ words
        if (sentence.length > 5 && Math.random() < 0.2) {
            sentence[sentence.length - 1] += punctuations[Math.floor(Math.random() * punctuations.length)];
        }
    }

    // ensure the first word is capitalized
    if (sentence.length > 0) {
        sentence[0] = sentence[0][0].toUpperCase() + sentence[0].slice(1);
    }

    // end the sentence with punctuation
    if (sentence.length > 3) {
        sentence[sentence.length - 1] += punctuations[Math.floor(Math.random() * punctuations.length)];
    }

    return sentence.join(" ");
}

async function getRandomLink() {
    if (!db) {
        console.error("❌ Database not initialized yet");
        return randomMedia();  // fallback to randomMedia in case of DB failure
    }
    const rows = await db.all('SELECT content FROM messages WHERE isLink = 1');
    const randomRow = rows[Math.floor(Math.random() * rows.length)];
    return randomRow ? randomRow.content : randomMedia(); // fallback if no links are found
}

export default {
    name: 'messageCreate',
    once: false,

    async execute(message, client) {
        if (message.author.id === client.user.id) return; // skip bot messages
        await logMessage(message.author.id, message.content); // log message

        if (message.mentions.has(client.user.id)) {
            if (message.content === `<@${client.user.id}>`) {
                message.reply({
                    content: randomMedia()
                });
            } else {
                // fetch messages and build the Markov model
                const messages = await fetchMessages();
                const trigramModel = buildTrigramModel(messages);
                const response = generateSentence(trigramModel);
                
                message.reply({
                    content: response || await getRandomLink()
                });
            }
        }
    }
};

function randomMedia() {
    const chance = Math.floor(Math.random() * 3);
    switch (chance) {
        case 0:
            return "https://media.discordapp.net/attachments/1268959975342870610/1269091020205986025/caption.gif";
        case 1:
            return "https://cdn.discordapp.com/attachments/1268959975342870610/1269091020608503920/snapchat.gif";
        case 2:
            return "https://media.discordapp.net/attachments/969679824337666061/1286382331099353129/sabyMce.png";
        default:
            return "ne";
    }
}

// initialize the database
initDB().catch(console.error);