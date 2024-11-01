const fs = require('fs');
const path = require('path');

// Copy to both dist and src directories
const directories = [
  path.join(__dirname, '../dist/node_modules/essentia.js/dist'),
  path.join(__dirname, '../public/node_modules/essentia.js/dist')
];

// Source files
const sourceDir = path.join(__dirname, '../node_modules/essentia.js/dist');
const files = ['essentia.js-core.umd.js', 'essentia-wasm.umd.js'];

// Copy files to each directory
directories.forEach(destDir => {
  fs.mkdirSync(destDir, { recursive: true });
  
  files.forEach(file => {
    fs.copyFileSync(
      path.join(sourceDir, file),
      path.join(destDir, file)
    );
  });
}); 