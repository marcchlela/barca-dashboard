#!/usr/bin/env node
// Read-only UI audit: node tools/qa-media-browser.mjs http://127.0.0.1:3000 http://127.0.0.1:9224
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.argv[2] ?? "http://127.0.0.1:3000";
const debuggerOrigin = process.argv[3] ?? "http://127.0.0.1:9224";
const target = await fetch(`${debuggerOrigin}/json/new?${encodeURIComponent(`${origin}/media`)}`, { method: "PUT" }).then((response) => response.json());
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
  const { resolve, reject } = pending.get(reply.id);
  pending.delete(reply.id);
  if (reply.error) reject(new Error(reply.error.message));
  else resolve(reply.result);
});
function send(method, params = {}) { const current = ++id; return new Promise((resolve, reject) => { pending.set(current, { resolve, reject }); socket.send(JSON.stringify({ id: current, method, params })); }); }
async function evaluate(expression) { const reply = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text); return reply.result.value; }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(selector) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return;
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${selector}: ${await evaluate("document.body?.innerText.slice(0,500)")}`);
}
async function shot(name) { const reply = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(`.artifacts/${name}.png`, Buffer.from(reply.data, "base64")); }

try {
  await mkdir(".artifacts", { recursive: true });
  await send("Page.enable"); await send("Runtime.enable");
  const results = { desktop: {}, mobile: {}, themes: [], errors };
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${origin}/media` }); await waitFor("#matchdays"); await wait(1700);
  results.desktop = await evaluate(`(() => { const timeline=document.querySelector('.media-match-timeline'); return {title:document.title, width:innerWidth, documentWidth:document.documentElement.scrollWidth, timelineHeight:timeline?.clientHeight, timelineScrollHeight:timeline?.scrollHeight, matchRows:document.querySelectorAll('.media-match-stop').length, competitionMarks:document.querySelectorAll('.media-match-competition img').length, teamMarks:document.querySelectorAll('.media-match-identity img').length, playHereTags:[...document.querySelectorAll('.media-card-art small')].filter(el=>getComputedStyle(el).display!=='none').length, brokenImages:[...document.querySelectorAll('.media-room img')].filter(img=>img.complete&&!img.naturalWidth).map(img=>img.currentSrc)}; })()`);
  if (!results.desktop.matchRows) throw new Error(JSON.stringify({ desktop: results.desktop, body: await evaluate("document.body.innerText.slice(0,500)") }));
  await evaluate("document.querySelector('#matchdays').scrollIntoView()"); await wait(250); await shot("media-matchdays-desktop");
  await evaluate("document.querySelector('#stories').scrollIntoView()"); await wait(250); await shot("media-stories-desktop");
  results.desktop.storyBefore = await evaluate("({match:document.querySelector('.media-story-match[aria-pressed=true] strong')?.textContent, cards:document.querySelectorAll('.media-story-grid .media-card').length})");
  results.desktop.storyClickTarget = await evaluate("(() => { const button=[...document.querySelectorAll('.media-story-match')].find(button=>button.textContent?.includes('Feyenoord')); button?.click(); return button?.textContent ?? null; })()"); await wait(500);
  results.desktop.storyFeyenoord = await evaluate("({match:document.querySelector('.media-story-match[aria-pressed=true] strong')?.textContent, cards:document.querySelectorAll('.media-story-grid .media-card').length})");
  await evaluate("document.querySelector('#archive').scrollIntoView()"); await wait(250); await shot("media-archive-desktop");
  results.desktop.archiveBefore = await evaluate("({chapter:document.querySelector('.media-archive-chapters button[aria-pressed=true] span')?.textContent,cards:document.querySelectorAll('#archive .media-card').length})");
  await evaluate("[...document.querySelectorAll('.media-archive-chapters button')].find(button=>button.textContent?.includes('Berlin'))?.click()"); await wait(350);
  results.desktop.archiveBerlin = await evaluate("({chapter:document.querySelector('.media-archive-chapters button[aria-pressed=true] span')?.textContent,cards:document.querySelectorAll('#archive .media-card').length})");
  await evaluate("document.querySelector('#library').scrollIntoView()"); await wait(250);
  results.desktop.competitionFilter = await evaluate("({trigger:[...document.querySelectorAll('#library summary')].find(el=>el.getAttribute('aria-label')?.startsWith('Competition'))?.textContent, mark:!![...document.querySelectorAll('#library summary')].find(el=>el.getAttribute('aria-label')?.startsWith('Competition'))?.querySelector('svg,img')})");
  await shot("media-library-desktop");
  for (const kit of ["home", "away", "third"]) {
    await evaluate(`localStorage.setItem('barca-dashboard-kit','${kit}'); location.reload()`); await waitFor("#matchdays"); await wait(1700);
    results.themes.push(await evaluate(`({kit:'${kit}',accent:getComputedStyle(document.querySelector('.media-room')).getPropertyValue('--media-accent').trim(),documentWidth:document.documentElement.scrollWidth})`));
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: `${origin}/media` }); await waitFor("#matchdays"); await wait(1700);
  results.mobile = await evaluate("({width:innerWidth,documentWidth:document.documentElement.scrollWidth,timelineHeight:document.querySelector('.media-match-timeline')?.clientHeight,timelineScrollHeight:document.querySelector('.media-match-timeline')?.scrollHeight,storyCards:document.querySelectorAll('.media-story-grid .media-card').length})");
  await evaluate("document.querySelector('#matchdays').scrollIntoView()"); await wait(250); await shot("media-matchdays-mobile");
  await evaluate("document.querySelector('#stories').scrollIntoView()"); await wait(250); await shot("media-stories-mobile");
  console.log(JSON.stringify(results, null, 2));
  if (results.desktop.documentWidth > 1440 || results.mobile.documentWidth > 390 || errors.length || results.desktop.playHereTags || results.desktop.matchRows < 1 || !results.desktop.storyFeyenoord.match?.includes("Feyenoord") || !results.desktop.archiveBerlin.chapter?.includes("Berlin")) process.exitCode = 1;
} finally {
  socket.close();
  await fetch(`${debuggerOrigin}/json/close/${target.id}`).catch(() => {});
}
