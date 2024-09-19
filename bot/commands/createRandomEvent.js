import fs from "fs";
import path from 'path';
const IMAGES_FOLDER = './resources/images';
const TITLE_TEXT_FILE = './resources/markov/titleText.txt';
const DESCRIPTION_TEXT_FILE = './resources/markov/descriptionText.txt';

// the same as randomEventCreator just as a command to test it out

export default {
  name: 'createevent',
  description: 'Creates a random event in a voice channel.',
  options: [],
  devOnly: true,

  async execute(interaction) {

    function getRandomWeekdayTime() {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const randomDay = weekdays[Math.floor(Math.random() * weekdays.length)];
      const randomHour = Math.floor(Math.random() * 24);
      const randomMinute = Math.floor(Math.random() * 60);
      return { day: randomDay, time: `${randomHour}:${randomMinute < 10 ? '0' : ''}${randomMinute}` };
    }

    function getRandomImage() {
      const imageFiles = fs.readdirSync(IMAGES_FOLDER);
      if (imageFiles.length === 0) {
        console.log('No image files found.');
        return null;
      }

      const randomFile = imageFiles[Math.floor(Math.random() * imageFiles.length)];
      const filePath = path.join(IMAGES_FOLDER, randomFile);
      return `./${filePath}`;
    }

    function generateMarkovTitle() {
      const text = fs.readFileSync(TITLE_TEXT_FILE, 'utf8');
      const words = text.split(/\s+/);
      const chain = {};
    
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
    

    function generateRandomDescription() {
      const text = fs.readFileSync(DESCRIPTION_TEXT_FILE, 'utf8');
      const words = text.split(/\s+/);
      const chain = {};
  
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
      description = description.replace(/\s+/g, ' ').trim();
      description = description.charAt(0).toUpperCase() + description.slice(1);
      description = description.replace(/\s+([,!.?])/g, '$1');
  
      const punctuation = ['.', '!', '?'];
      if (!punctuation.includes(description[description.length - 1])) {
          description += punctuation[Math.floor(Math.random() * punctuation.length)];
      }
  
      return description;
  }

  
  async function createEventInChannel() {
      const voiceChannelIds = ['1265695483788001466', '1265700302276001845'];
      const voiceChannelId = voiceChannelIds[Math.floor(Math.random() * voiceChannelIds.length)];
      const { day, time } = getRandomWeekdayTime();
      const title = generateMarkovTitle();
      const description = generateRandomDescription();
      const image = getRandomImage();
  
      if (!image) {
          console.error('Failed to find a suitable image for the event!');
          return;
      }
  
      const startDate = new Date();
      const targetDayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
      startDate.setDate(startDate.getDate() + ((7 + targetDayIndex - startDate.getDay()) % 7));
      startDate.setHours(...time.split(':').map(Number), 0, 0);
  
      try {
          await interaction.guild.scheduledEvents.create({
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
    await createEventInChannel();
    await interaction.reply({ content: 'A random event has been created!', ephemeral: true });
  },
};
