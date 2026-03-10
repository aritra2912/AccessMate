const fs = require('fs');
const path = require('path');

// Configuration
const ICONS_DIR = path.join(__dirname, 'icons');
const ICON_FILES = ['icon16.png', 'icon48.png', 'icon128.png'];

// Base64 for a 128x128 solid blue (#2563eb) PNG
const BASE64_PNG = "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAZQTFRFJWPrAAAAUy0h1QAAAEJJREFUeJztwTEBAAAAwqD1T20JT6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACN4AAxQAAfC25D0AAAAASUVORK5CYII=";

function generateIcons() {
  // 1. Create directory if it doesn't exist
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR);
    console.log(`Created directory: ${ICONS_DIR}`);
  }

  // 2. Write files
  const buffer = Buffer.from(BASE64_PNG, 'base64');
  
  ICON_FILES.forEach(filename => {
    const filePath = path.join(ICONS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`Generated: ${filePath}`);
  });
  
  console.log('\nSuccess! Icons created. Reload the extension in Chrome.');
}

generateIcons();