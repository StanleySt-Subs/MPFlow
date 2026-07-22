require('dotenv').config();
const { put } = require('@vercel/blob');
const fs = require('fs');

const data = fs.readFileSync('new_seed.json', 'utf8');

async function upload() {
  try {
    await put('sst-store.json', data, {
      access: 'public', 
      addRandomSuffix: false, 
      allowOverwrite: true, 
      contentType: 'application/json'
    });
    console.log('UPLOAD COMPLETE');
  } catch (e) {
    console.error('ERROR:', e);
  }
}
upload();
