const fs = require('fs');

const data = fs.readFileSync('new_seed.json', 'utf8');

async function upload() {
  try {
    const r = await fetch('http://127.0.0.1:3000/api/store', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'sst-auth=' + encodeURIComponent(JSON.stringify({role:'admin'}))
      },
      body: data
    });
    console.log('STATUS:', r.status);
    console.log('BODY:', await r.text());
  } catch (e) {
    console.error('ERROR:', e);
  }
}
upload();
