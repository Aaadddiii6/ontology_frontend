const fs = require('fs');
const http = require('http');

http.get('http://127.0.0.1:8000/defense/spending/top?limit=1', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => fs.writeFileSync('out_def.json', data));
});
http.get('http://127.0.0.1:8000/defense/arms/top?limit=1', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => fs.writeFileSync('out_arms.json', data));
});
http.get('http://127.0.0.1:8000/geopolitics/rankings/centrality', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => fs.writeFileSync('out_cen.json', data));
});
