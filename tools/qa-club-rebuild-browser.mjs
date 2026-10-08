#!/usr/bin/env node
// node tools/qa-club-rebuild-browser.mjs http://localhost:3100 http://127.0.0.1:9224
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.argv[2] ?? "http://localhost:3100";
const debuggerOrigin = process.argv[3] ?? "http://127.0.0.1:9224";
const targets = await fetch(`${debuggerOrigin}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No browser page target");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const reply = JSON.parse(event.data);
  if (!reply.id || !pending.has(reply.id)) return;
  const { resolve, reject } = pending.get(reply.id);
  pending.delete(reply.id);
  reply.error ? reject(new Error(reply.error.message)) : resolve(reply.result);
});
function send(method, params = {}) {
  const current = ++id;
  return new Promise((resolve, reject) => { pending.set(current, { resolve, reject }); socket.send(JSON.stringify({ id: current, method, params })); });
}
async function evaluate(expression) {
  const reply = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text);
  return reply.result.value;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function visit(path) {
  await send("Page.navigate", { url: `${origin}${path}` });
  await wait(2200);
  return evaluate("({title:document.title, heading:document.querySelector('h1')?.innerText, width:innerWidth, documentWidth:document.documentElement.scrollWidth, brokenImages:[...document.images].filter(img=>img.complete&&!img.naturalWidth).map(img=>img.currentSrc), body:document.body.innerText.slice(0,180)})");
}
async function screenshot(name) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`.artifacts/${name}.png`, Buffer.from(shot.data, "base64"));
}
await mkdir(".artifacts", { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
const errors = [];
socket.addEventListener("message", (event) => {
  const reply = JSON.parse(event.data);
  if (reply.method === "Runtime.exceptionThrown") errors.push(reply.params.exceptionDetails.text);
});
const result = { desktop: {}, mobile: {}, themes: [], errors };
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
for (const path of ["/club", "/club/trophies", "/club/seasons", "/club/seasons/2024-25", "/club/identity", "/"]) {
  result.desktop[path] = await visit(path);
  if (path === "/club" || path === "/club/trophies") await screenshot(`club-rebuild-${path.replaceAll("/", "-") || "home"}-desktop`);
}
await visit("/club/identity");
const initialIdentity = await evaluate("({tabs:document.querySelectorAll('[role=tab]').length, selected:document.querySelector('[role=tab][aria-selected=true]')?.textContent, panels:document.querySelectorAll('[role=tabpanel]').length})");
await evaluate("document.querySelectorAll('[role=tab]')[1].click(); document.querySelectorAll('[role=tab]')[1].focus()");
const blaugrana = await evaluate("({selected:document.querySelector('[role=tab][aria-selected=true]')?.textContent, fabric:!!document.querySelector('.club-colour-fabric'), lettering:document.querySelector('.club-colour-fabric')?.textContent})");
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
const keyboardIdentity = await evaluate("({selected:document.querySelector('[role=tab][aria-selected=true]')?.textContent, image:document.querySelector('[role=tabpanel] img')?.getAttribute('src')})");
result.identity = { initial: initialIdentity, blaugrana, keyboard: keyboardIdentity };
await screenshot("club-rebuild-identity-tabs-desktop");
await visit("/club/trophies");
await evaluate("document.querySelector('#trophy-walk').scrollIntoView()");
await wait(900);
await screenshot("club-rebuild-walk-first-desktop");
const stops = await evaluate("document.querySelectorAll('.club-stop-rail button').length");
await evaluate("document.querySelectorAll('.club-stop-rail button')[1].click()");
for (let attempt = 0; attempt < 20; attempt++) {
  if (await evaluate("document.querySelector('.club-walk-photo-case img')?.naturalWidth > 0")) break;
  await wait(200);
}
const photoCase = await evaluate("({visible:!!document.querySelector('.club-walk-photo-case'), loaded:document.querySelector('.club-walk-photo-case img')?.naturalWidth > 0, src:document.querySelector('.club-walk-photo-case img')?.getAttribute('src')})");
await screenshot("club-rebuild-walk-laliga-desktop");
await evaluate("document.querySelectorAll('.club-stop-rail button')[2].click()");
await wait(1200);
await screenshot("club-rebuild-walk-third-desktop");
const thirdStop = await evaluate("document.querySelector('.club-walk-info h2')?.innerText");
await evaluate("document.querySelector('.club-walk-info button')?.click()");
await wait(250);
const dialog = await evaluate("({open:document.querySelector('dialog')?.open, years:document.querySelectorAll('.club-case-years a').length})");
await evaluate("document.querySelector('.club-case-close')?.click()");
const closed = await evaluate("!document.querySelector('dialog')?.open");
result.trophyInteraction = { stops, photoCase, thirdStop, dialog, closed };
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
for (const path of ["/club", "/club/trophies", "/club/seasons", "/club/seasons/1899-00", "/club/identity"]) {
  result.mobile[path] = await visit(path);
  if (path === "/club/trophies" || path === "/club/seasons") await screenshot(`club-rebuild-${path.replaceAll("/", "-")}-mobile`);
}
await visit("/club/identity");
result.identity.mobile = await evaluate("({tabsScrollable:document.querySelector('.club-identity-tabs').scrollWidth > document.querySelector('.club-identity-tabs').clientWidth, documentWidth:document.documentElement.scrollWidth, width:innerWidth})");
await screenshot("club-rebuild-identity-tabs-mobile");
await visit("/club/seasons");
result.seasons = await evaluate("({decades:document.querySelectorAll('.club-decade-rail button').length, visible:document.querySelectorAll('.club-index-card').length})");
await evaluate("(()=>{const input=document.querySelector('.club-index-search input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'1899');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
await wait(200);
result.seasons.search = await evaluate("document.querySelectorAll('.club-index-card').length");
for (const kit of ["home", "away", "third"]) {
  await evaluate(`localStorage.setItem('barca-dashboard-kit', '${kit}'); location.reload()`);
  await wait(1200);
  result.themes.push(await evaluate("({kit:localStorage.getItem('barca-dashboard-kit'), accent:getComputedStyle(document.querySelector('.club-new')).getPropertyValue('--club-accent').trim()})"));
}
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await visit("/club/trophies");
result.reducedMotion = await evaluate("({canvas:!!document.querySelector('.club-walk-visual canvas'), image:!!document.querySelector('.club-walk-visual img'), stops:document.querySelectorAll('.club-stop-rail button').length})");
await send("Emulation.setEmulatedMedia", { features: [] });
socket.close();
if (Object.values(result.desktop).some((item) => item.documentWidth > item.width + 2) || Object.values(result.mobile).some((item) => item.documentWidth > item.width + 2)) throw new Error(JSON.stringify(result));
if (stops !== 5 || !photoCase.visible || !photoCase.loaded || !dialog.open || !closed || result.seasons.decades !== 14 || result.seasons.search !== 1 || result.identity.initial.tabs !== 4 || result.identity.initial.panels !== 1 || !result.identity.blaugrana.fabric || result.identity.blaugrana.lettering || !result.identity.keyboard.selected?.includes("La Masia") || !result.identity.mobile.tabsScrollable || result.identity.mobile.documentWidth > result.identity.mobile.width + 2 || result.reducedMotion.canvas || !result.reducedMotion.image || errors.length) throw new Error(JSON.stringify(result));
console.log(JSON.stringify(result, null, 2));
