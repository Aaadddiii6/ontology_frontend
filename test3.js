const r1 = await fetch('http://127.0.0.1:8000/geopolitics/network');
console.log('network:', await r1.json());
