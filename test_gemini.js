const fs = require('fs');
const dotenv = fs.readFileSync('c:/Users/user/Desktop/frontend_ontology/.env', 'utf8');
const key = dotenv.split('\n').find(l => l.startsWith('GEMINI_API_KEY')).split('=')[1].trim();

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'hi' }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json'
      }
    })
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
