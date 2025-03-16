import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Simple script to parse the details.text file and generate structured JSON data
 * 
 * Usage:
 * 1. Save the audio guide text data to a file named 'details.text'
 * 2. Run this script: node scripts/parseData.js
 * 3. The output will be saved to exhibits.json
 */

// Get current file path (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to parse the exhibit data from the text file
function parseExhibitData(rawText, language = 'en') {
  const exhibits = [];
  
  // Create a regex pattern that matches each exhibit block
  const exhibitPattern = /ID-(\d+)\s+(.*?)(?:\r?\n|\r)(?:[\r\n]*)Audio-Track-(\d+)(?:\r?\n|\r)ID-\d+-thumbnail(?:\r?\n|\r)ID-\d+-main-image(?:\r?\n|\r)([\s\S]*?)(?=ID-\d+|$)/g;
  
  // Match all exhibits
  let match;
  while ((match = exhibitPattern.exec(rawText)) !== null) {
    const id = match[1];
    const title = match[2].trim();
    const audioTrack = match[3];
    const description = match[4].trim();
    
    // Create the audio URL
    const audioUrl = `/assets/audio/${language}/Audio-Track-${audioTrack}.mp3`;
    
    // Create image URLs
    const thumbImage = `/assets/images/${language}/ID-${id}-thumbnail.jpg`;
    const mainImage = `/assets/images/${language}/ID-${id}-main-image.jpg`;
    
    // Create the exhibit object
    const exhibit = {
      id: `exhibit-${id}`,
      title,
      description,
      images: {
        thumb: thumbImage,
        main: mainImage
      },
      audioUrl
    };
    
    exhibits.push(exhibit);
  }
  
  return exhibits;
}

// Main execution
try {
  // Try to read the details.text file
  const inputPath = path.join(__dirname, '..', 'details.text');
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'exhibits.json');
  
  if (fs.existsSync(inputPath)) {
    const rawText = fs.readFileSync(inputPath, 'utf8');
    const exhibits = parseExhibitData(rawText);
    
    // Write the parsed data to a JSON file
    fs.writeFileSync(outputPath, JSON.stringify(exhibits, null, 2));
    
    console.log(`Successfully parsed ${exhibits.length} exhibits from details.text`);
    console.log(`Data saved to ${outputPath}`);
  } else {
    console.error(`Error: Could not find details.text file at ${inputPath}`);
    console.log(`Please create a file named 'details.text' with the exhibit data in the root directory.`);
  }
} catch (error) {
  console.error(`Error parsing data: ${error.message}`);
} 