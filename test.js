async function go() {
  try {
    const p1 = await fetch("http://127.0.0.1:8000/composite/coverage");
    const p2 = await fetch("http://127.0.0.1:8000/composite/rankings/global-risk");
    const p3 = await fetch("http://127.0.0.1:8000/economy/trade-pairs");
    console.log("coverage:", await p1.json());
    console.log("risk:", await p2.json());
    console.log("trade:", await p3.json());
  } catch(e) { console.error(e) }
}
go();
