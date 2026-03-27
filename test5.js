(async () => {
  const r1 = await fetch('http://127.0.0.1:8000/defense/spending/top?limit=2');
  const t1 = await r1.text();
  require('fs').writeFileSync('def5.json', t1);

  const r2 = await fetch('http://127.0.0.1:8000/defense/arms/top?limit=2');
  const t2 = await r2.text();
  require('fs').writeFileSync('arms5.json', t2);
})();
