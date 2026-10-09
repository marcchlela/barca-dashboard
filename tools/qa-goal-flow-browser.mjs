#!/usr/bin/env node
// Read-only Match Flow audit. Requires a local app and Chrome DevTools endpoint.
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.argv[2] ?? "http://127.0.0.1:3000";
const debuggerOrigin = process.argv[3] ?? "http://127.0.0.1:9228";
const fixtures = [
  { name: "Feyenoord", id: "8c40e8f4-84c2-4da7-a04c-88280c29753b", expected: 6 },
  { name: "Sevilla", id: "dc0f3ba4-90ae-439d-b839-f15e15854fd4", expected: 4 },
  { name: "Athletic", id: "7e9e585f-8207-4194-b41b-8fbb0bc4528c", expected: 0 },
];
const target = await fetch(`${debuggerOrigin}/json/new?${encodeURIComponent(`${origin}/matches/${fixtures[0].id}`)}`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const reply = JSON.parse(event.data);
  if (reply.method === "Runtime.exceptionThrown") errors.push(reply.params.exceptionDetails.text);
  if (reply.method === "Runtime.consoleAPICalled" && reply.params.type === "error") errors.push(reply.params.args.map((arg) => arg.value ?? arg.description ?? "console error").join(" "));
  if (!reply.id || !pending.has(reply.id)) return;
  const { resolve, reject } = pending.get(reply.id); pending.delete(reply.id);
  if (reply.error) reject(new Error(reply.error.message)); else resolve(reply.result);
});
function send(method, params = {}) { const current = ++id; return new Promise((resolve, reject) => { pending.set(current, { resolve, reject }); socket.send(JSON.stringify({ id: current, method, params })); }); }
async function evaluate(expression) { const reply = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text); return reply.result.value; }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression) { for (let attempt = 0; attempt < 60; attempt++) { if (await evaluate(expression)) return; await wait(200); } throw new Error(`Timed out waiting for ${expression}`); }

try {
  await mkdir(".artifacts", { recursive: true });
  await send("Page.enable"); await send("Runtime.enable"); await send("Page.bringToFront");
  const results = { fixtures: [], themes: [], mobile: null, errors };
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const fixture of fixtures) {
    await send("Page.navigate", { url: `${origin}/matches/${fixture.id}` });
    await waitFor("document.querySelector('[aria-label^=\"Watch goal:\"]') || document.body?.textContent?.includes('Match Timeline')");
    await wait(1500);
    const count = await evaluate("document.querySelectorAll('[aria-label^=\"Watch goal:\"]').length");
    const seeGoals = await evaluate("document.body.textContent.includes('See the goals')");
    results.fixtures.push({ name: fixture.name, count, expected: fixture.expected, seeGoals });
    if (count !== fixture.expected || seeGoals) throw new Error(`${fixture.name}: expected ${fixture.expected} playable goals, found ${count}; old popup=${seeGoals}`);
    if (!count) continue;
    await evaluate("document.querySelector('[aria-label^=\"Watch goal:\"]').focus()");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await waitFor("document.querySelector('dialog')?.open && !!document.querySelector('dialog iframe')");
    const starts = [];
    for (let goalIndex = 0; goalIndex < count; goalIndex++) {
      await evaluate(`document.querySelectorAll('dialog button')[${goalIndex + 1}]?.click()`);
      await wait(150);
      starts.push(await evaluate("new URL(document.querySelector('dialog iframe').src).searchParams.get('start')"));
    }
    if (new Set(starts).size !== count) throw new Error(`${fixture.name}: goal buttons did not select distinct stored starts`);
    await evaluate("document.querySelector('[aria-label=\"Close goal video\"]').click()");
    await waitFor("!document.querySelector('dialog')?.open && !document.querySelector('dialog iframe')");
    await evaluate("document.querySelector('[aria-label^=\"Watch goal:\"]').click()");
    await waitFor("document.querySelector('dialog')?.open");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor("!document.querySelector('dialog')?.open && !document.querySelector('dialog iframe')");
    results.fixtures.at(-1).starts = starts;
  }
  await send("Page.navigate", { url: `${origin}/matches/${fixtures[0].id}` });
  await waitFor("document.querySelectorAll('[aria-label^=\"Watch goal:\"]').length === 6");
  for (const kit of ["home", "away", "third"]) {
    await evaluate(`localStorage.setItem('barca-dashboard-kit','${kit}'); location.reload()`);
    await waitFor("document.querySelectorAll('[aria-label^=\"Watch goal:\"]').length === 6");
    await wait(550);
    results.themes.push(await evaluate(`({kit:'${kit}',width:innerWidth,documentWidth:document.documentElement.scrollWidth,accent:document.querySelector('[aria-label^="Watch goal:"]')?.style.outlineColor ?? null})`));
    await evaluate("document.querySelector('[aria-label^=\"Watch goal:\"]').click()");
    await waitFor("document.querySelector('dialog')?.open && !!document.querySelector('dialog iframe')");
    await evaluate("document.querySelector('[aria-label=\"Close goal video\"]').click()");
    await waitFor("!document.querySelector('dialog')?.open && !document.querySelector('dialog iframe')");
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: `${origin}/matches/${fixtures[0].id}` });
  await waitFor("document.querySelectorAll('[aria-label^=\"Watch goal:\"]').length === 6");
  await wait(750);
  await evaluate("document.querySelector('[aria-label^=\"Watch goal:\"]').click()");
  await waitFor("document.querySelector('dialog')?.open && !!document.querySelector('dialog iframe')");
  results.mobile = await evaluate("({width:innerWidth,documentWidth:document.documentElement.scrollWidth,dialogWidth:Math.round(document.querySelector('dialog').getBoundingClientRect().width),iframe:document.querySelector('dialog iframe').src})");
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(".artifacts/goal-flow-mobile.png", Buffer.from(shot.data, "base64"));
  console.log(JSON.stringify(results, null, 2));
  if (results.mobile.documentWidth > results.mobile.width || results.mobile.dialogWidth > results.mobile.width || errors.length) process.exitCode = 1;
} finally {
  socket.close();
  await fetch(`${debuggerOrigin}/json/close/${target.id}`).catch(() => {});
}
