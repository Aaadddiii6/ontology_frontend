import fs from 'fs';
async function test() {
  try {
    const r1 = await fetch('http://127.0.0.1:8000/defense/spending/top?limit=261');
    const d1 = await r1.json();
    fs.writeFileSync('out1.json', JSON.stringify(d1, null, 2));

    const r2 = await fetch('http://127.0.0.1:8000/geopolitics/network');
    const d2 = await r2.json();
    fs.writeFileSync('out2.json', JSON.stringify(d2, null, 2));

    const r3 = await fetch('http://127.0.0.1:8000/geopolitics/rankings/centrality');
    const d3 = await r3.json();
    fs.writeFileSync('out3.json', JSON.stringify(d3, null, 2));
    
    console.log("Wrote out.json");
  } catch(e) {
    console.error(e);
  }
}
test();
