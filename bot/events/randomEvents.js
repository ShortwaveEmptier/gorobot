import fs from "fs";
import path from 'path';
const IMAGES_FOLDER = './resources/images';
const TITLE_TEXT_FILE = './resources/markov/titleText.txt';
const DESCRIPTION_TEXT_FILE = './resources/markov/descriptionText.txt';

export default {
    name: 'randomEventCreator',
    once: false,

    async execute() {
        // this generates a random weekday and a random time
        function getRandomWeekdayTime() {
            const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const randomDay = weekdays[Math.floor(Math.random() * weekdays.length)];
            const randomHour = Math.floor(Math.random() * 24);
            const randomMinute = Math.floor(Math.random() * 60);
            return { day: randomDay, time: `${randomHour}:${randomMinute < 10 ? '0' : ''}${randomMinute}` };
        }

        // grabs a random image for the banner
        function getRandomImage() {
            const imageFiles = fs.readdirSync(IMAGES_FOLDER);
            if (imageFiles.length === 0) {
                console.log('No image files found.');
                return null;
            }

            const randomFile = imageFiles[Math.floor(Math.random() * imageFiles.length)];
            const filePath = path.join(IMAGES_FOLDER, randomFile);
            return fs.existsSync(filePath) ? filePath : null;
        }

        // bigram chain for the title
        function generateMarkovTitle() {
            const text = fs.readFileSync(TITLE_TEXT_FILE, 'utf8');
            const words = text.split(/\s+/);
            const chain = {};
          
            // create bigrams
            for (let i = 0; i < words.length - 1; i++) {
              const currentWord = words[i];
              const nextWord = words[i + 1];
              if (!chain[currentWord]) {
                chain[currentWord] = [];
              }
              chain[currentWord].push(nextWord);
            }
          
            const keys = Object.keys(chain);
            let currentWord = keys[Math.floor(Math.random() * keys.length)];
            let result = [currentWord];
          
            for (let i = 0; i < 4; i++) {
              if (chain[currentWord] && chain[currentWord].length > 0) {
                currentWord = chain[currentWord][Math.floor(Math.random() * chain[currentWord].length)];
                result.push(currentWord);
              } else {
                break;
              }
            }
          
            const punctuation = ['!', '?', ''];
            result.push(punctuation[Math.floor(Math.random() * punctuation.length)]);
            return result.join(' ');
        }

        // trigram markov chain for the description
        function generateRandomDescription() {
            const text = fs.readFileSync(DESCRIPTION_TEXT_FILE, 'utf8');
            const words = text.split(/\s+/);
            const chain = {};
        
            // creates the trigram chain
            for (let i = 0; i < words.length - 2; i++) {
                const key = `${words[i]} ${words[i + 1]}`;
                if (!chain[key]) {
                    chain[key] = [];
                }
                chain[key].push(words[i + 2]);
            }
        
            const keys = Object.keys(chain);
            let currentKey = keys[Math.floor(Math.random() * keys.length)];
            let result = currentKey.split(' ');
            
            // randomizes the length of the description between 50 and 25 words
            const descriptionLength = Math.floor(Math.random() * (50 - 25 + 1)) + 25;
        
            for (let i = 0; i < descriptionLength; i++) {
                if (chain[currentKey] && chain[currentKey].length > 0) {
                    const nextWord = chain[currentKey][Math.floor(Math.random() * chain[currentKey].length)];
                    result.push(nextWord);
        
                    currentKey = `${result[result.length - 2]} ${result[result.length - 1]}`;
                } else {
                    currentKey = keys[Math.floor(Math.random() * keys.length)];
                    const randomStart = currentKey.split(' ');
                    result.push(randomStart[0], randomStart[1]);
                }
            }
        
            let description = result.join(' ');
            
            // "cleans up" the text by removing unneccessary spaces and gives it proper punctuation
            description = description.replace(/\s+/g, ' ').trim();
            description = description.charAt(0).toUpperCase() + description.slice(1);
            description = description.replace(/\s+([,!.?])/g, '$1');
        
            const punctuation = ['.', '!', '?'];
            if (!punctuation.includes(description[description.length - 1])) {
                description += punctuation[Math.floor(Math.random() * punctuation.length)];
            }
        
            return description;
        }

        // calculates the delay before the next event
        function getNextEventDelay(targetWeekday, targetHour) {
            const now = new Date();
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + ((7 + targetWeekday - now.getDay()) % 7 || 7));
            targetDate.setHours(targetHour, 0, 0, 0);
            const delay = targetDate - now;
            return delay > 0 ? delay : delay + 7 * 24 * 60 * 60 * 1000;
        }        

        async function createEventInChannel() {
            const voiceChannelIds = ['1265695483788001466', '1265700302276001845'];
            const voiceChannelId = voiceChannelIds[Math.floor(Math.random() * voiceChannelIds.length)]; // chooses between the two voicechats
            const { day, time } = getRandomWeekdayTime();
            const title = generateMarkovTitle();
            const description = generateRandomDescription();
            const image = getRandomImage();
        
            if (!image) { // image error handling
                console.error('Failed to find a suitable image for the event!');
                return;
            }
        
            const startDate = new Date();
            const targetDayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
            startDate.setDate(startDate.getDate() + ((7 + targetDayIndex - startDate.getDay()) % 7));
            startDate.setHours(...time.split(':').map(Number), 0, 0);
        
            try {   
                await interaction.guild.scheduledEvents.create({    // creates the actual event
                    name: title,
                    scheduledStartTime: startDate,
                    privacyLevel: 2,
                    entityType: 2,
                    channel: voiceChannelId,
                    description,
                    image: image
                }, image ? { files: [{ attachment: image, name: path.basename(image) }] } : {});
                console.log(`Event "${title}" created in voice channel "${voiceChannelId}" on ${startDate}`);
            } catch (error) {
                console.error('Failed to create event in voice channel:', error);
            }
        }

        // generate and log the next event creation date
        const eventToggle = true;
        if (eventToggle) {
            const targetWeekday = 1; // monday
            const targetHour = 18;   // 6 pm

            const initialDelay = getNextEventDelay(targetWeekday, targetHour);
            
            if (initialDelay <= 0) {
                console.warn('Initial delay is non-positive. Adjusting to a valid delay.');
            }
            
            const upcomingEventDate = new Date(Date.now() + initialDelay);
            console.log(`📅 Next event is scheduled for: ${upcomingEventDate.toLocaleString()}`);
            
            setTimeout(() => {
                console.log('Timeout reached, creating event.');
                createEventInChannel();
                setInterval(() => {
                    console.log('Interval reached, creating weekly event.');
                    createEventInChannel();
                }, 7 * 24 * 60 * 60 * 1000);
            }, initialDelay);                       
        }
    },
};
