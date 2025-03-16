const fs = require('fs');
const path = require('path');
const https = require('https');

// Create directories if they don't exist
const createDirIfNotExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
};

// Download an image from a URL to a file path
const downloadImage = (url, filePath) => {
  return new Promise((resolve, reject) => {
    // Skip if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`File already exists: ${filePath}`);
      return resolve();
    }

    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${filePath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete the file if there was an error
      reject(err);
    });
  });
};

// Main function to download sample images
const downloadSampleImages = async () => {
  // Create necessary directories
  const baseDir = path.join(__dirname, '..', 'public', 'assets', 'images', 'en');
  createDirIfNotExists(baseDir);

  // Read the exhibits.json file
  const exhibitsPath = path.join(__dirname, '..', 'src', 'data', 'exhibits.json');
  const exhibits = JSON.parse(fs.readFileSync(exhibitsPath, 'utf8'));

  // Categories for placeholder images
  const categories = {
    introduction: { start: 1, end: 10, color: 'e3f2fd/1565c0', text: 'Gallery+Introduction' },
    michelangelo: { start: 11, end: 21, color: 'fce4ec/c2185b', text: 'Michelangelo+Sculptures' },
    nineteenth: { start: 22, end: 27, color: 'f3e5f5/7b1fa2', text: '19th+Century+Hall' },
    medieval: { start: 28, end: 36, color: 'e8f5e9/2e7d32', text: 'Medieval+Paintings' }
  };

  // Process each exhibit
  for (const exhibit of exhibits) {
    const id = exhibit.id;
    const idNumber = parseInt(id.replace('exhibit-', ''), 10);
    
    // Determine category
    let category;
    for (const [key, range] of Object.entries(categories)) {
      if (idNumber >= range.start && idNumber <= range.end) {
        category = range;
        break;
      }
    }
    
    if (!category) {
      category = categories.introduction; // Default category
    }

    // Create placeholder image URLs
    const thumbUrl = `https://via.placeholder.com/300x200/${category.color}?text=${category.text}`;
    const mainUrl = `https://via.placeholder.com/800x600/${category.color}?text=${category.text}`;
    
    // Extract file paths from exhibit data
    const thumbPath = path.join(baseDir, `ID-${idNumber}-thumbnail.jpg`);
    const mainPath = path.join(baseDir, `ID-${idNumber}-main-image.jpg`);
    
    // Download images
    try {
      await downloadImage(thumbUrl, thumbPath);
      await downloadImage(mainUrl, mainPath);
    } catch (error) {
      console.error(`Error downloading images for exhibit ${id}:`, error);
    }
  }

  console.log('Sample image download complete!');
};

// Run the script
downloadSampleImages().catch(console.error); 