const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const filesToProcess = [
  path.join(__dirname, '../public/auth-redirect.html'),
];

const replacements = {
  '__VITE_FIREBASE_API_KEY__': process.env.VITE_FIREBASE_API_KEY || '',
  '__VITE_FIREBASE_AUTH_DOMAIN__': process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  '__VITE_FIREBASE_PROJECT_ID__': process.env.VITE_FIREBASE_PROJECT_ID || '',
  '__VITE_FIREBASE_APP_ID__': process.env.VITE_FIREBASE_APP_ID || '',
};

filesToProcess.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const regex = new RegExp(placeholder, 'g');
    content = content.replace(regex, value);
  });

  // Write to output directory (for production builds)
  const outputPath = filePath.replace('/public/', '/out/renderer/');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content);
  console.log(`✅ Injected env vars into: ${path.basename(filePath)}`);
});

console.log('🎉 Environment variable injection complete!');
