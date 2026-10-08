#!/usr/bin/env node
// Optional browser audit against a running local app and Edge/Chrome CDP.
// node tools/qa-club-browser.mjs http://localhost:3100 http://127.0.0.1:9224
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.argv[2] ?? "http://localhost:3000";
const debuggerOrigin = process.argv[3] ?? "http://127.0.0.1:9224";
const localModelPreview = await fetch(`${origin}/models/club/champions-league-proof.png`).then((response) => response.ok);
const targets = await fetch(`${debuggerOrigin}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No browser page target.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(selector) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return;
    await wait(300);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}
await send("Page.enable");
await send("Runtime.enable");
await send("Page.bringToFront");
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: `${origin}/club` });
await wait(1500);
await waitFor("#honours");
const mobile = await evaluate("({viewport:innerWidth, documentWidth:document.documentElement.scrollWidth, hero:document.querySelector('main h2')?.innerText, firstCard:document.querySelector('.club-season-card strong')?.innerText, firstSummary:document.querySelector('.club-season-card')?.innerText, categoryButtons:document.querySelectorAll('#honours button[aria-controls=\"club-cabinet-detail\"]').length, hasEraCarousel:!!document.querySelector('[aria-label=\"Next era\"]')})");
await mkdir(".artifacts", { recursive: true });
await evaluate("document.querySelector('#honours').scrollIntoView()");
await wait(200);
const mobileCabinetScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-cabinet-mobile-cdp.png", Buffer.from(mobileCabinetScreenshot.data, "base64"));
await evaluate("[...document.querySelectorAll('#honours button')].find(button=>button.textContent?.includes('Explore in 3D')).click()");
await wait(1800);
const mobile3D = await evaluate("({canvas:!!document.querySelector('#club-cabinet-detail canvas'), fallback:document.querySelector('#club-cabinet-detail [role=status]')?.textContent, documentWidth:document.documentElement.scrollWidth})");
const mobileModelScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-model-mobile-cdp.png", Buffer.from(mobileModelScreenshot.data, "base64"));
await evaluate("document.querySelector('#identity').scrollIntoView()");
await wait(200);
const mobileIdentityScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-identity-mobile-cdp.png", Buffer.from(mobileIdentityScreenshot.data, "base64"));
await evaluate("[...document.querySelectorAll('nav[aria-label=\"Season decades\"] button')].find(b=>b.textContent==='1960s').click()");
await wait(150);
const pointerSelection = await evaluate("document.querySelector('.club-season-card strong')?.innerText");
await evaluate("[...document.querySelectorAll('nav[aria-label=\"Season decades\"] button')].find(b=>b.textContent==='2020s').focus()");
await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await wait(150);
const keyboardSelection = await evaluate("document.querySelector('.club-season-card strong')?.innerText");
const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-stage1-mobile-cdp.png", Buffer.from(screenshot.data, "base64"));
const themes = [];
const expectedSurface = { home: "rgb(13, 27, 46)", away: "rgb(18, 14, 22)", third: "rgb(13, 41, 42)" };
for (const kit of ["home", "away", "third"]) {
  await evaluate(`localStorage.setItem('barca-dashboard-kit', '${kit}'); location.reload()`);
  await wait(2000);
  await waitFor("#honours");
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await evaluate("getComputedStyle(document.querySelector('#honours')).backgroundColor") === expectedSurface[kit]) break;
    await wait(300);
  }
  themes.push({ kit, background: await evaluate("getComputedStyle(document.querySelector('#honours')).backgroundColor"), stored: await evaluate("localStorage.getItem('barca-dashboard-kit')") });
}
await evaluate("localStorage.setItem('barca-dashboard-kit', 'home')");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${origin}/club` });
await wait(1500);
await waitFor("#honours");
const desktop = await evaluate("({viewport:innerWidth, documentWidth:document.documentElement.scrollWidth})");
const desktopScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-stage1-desktop-cdp.png", Buffer.from(desktopScreenshot.data, "base64"));
await evaluate("document.querySelector('#honours').scrollIntoView()");
await wait(200);
const featuredScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-featured-desktop-cdp.png", Buffer.from(featuredScreenshot.data, "base64"));
await evaluate("document.querySelector('#club-cabinet-detail').scrollIntoView()");
for (let attempt = 0; attempt < 20; attempt++) {
  if (await evaluate("document.querySelector('#club-cabinet-detail img')?.naturalWidth > 0")) break;
  await wait(300);
}
const cabinetBefore = await evaluate("({title:document.querySelector('#club-cabinet-detail h3')?.textContent, canvas:!!document.querySelector('#club-cabinet-detail canvas'), preview:document.querySelector('#club-cabinet-detail img')?.naturalWidth, featuredPhoto:decodeURIComponent(document.querySelector('.club-featured-scene > img')?.currentSrc ?? '').includes('/barca-ucl-user.png') && document.querySelector('.club-featured-scene > img')?.naturalWidth > 0, yearLinks:document.querySelectorAll('#club-cabinet-detail a[href^=\"/club/seasons/\"]').length})");
await evaluate("[...document.querySelectorAll('#honours button[aria-controls=\"club-cabinet-detail\"]')].find(button=>button.textContent?.includes('Copa del Rey')).click()");
await wait(250);
const cabinetSelected = await evaluate("({title:document.querySelector('#club-cabinet-detail h3')?.textContent, yearLinks:document.querySelectorAll('#club-cabinet-detail a[href^=\"/club/seasons/\"]').length})");
await evaluate("[...document.querySelectorAll('#honours button')].find(button=>button.textContent?.includes('Explore in 3D')).click()");
await wait(2000);
const sculpture = await evaluate("({modelId:document.querySelector('#club-cabinet-detail [data-model-id]')?.getAttribute('data-model-id'), preview:document.querySelector('#club-cabinet-detail img')?.naturalWidth, columns:getComputedStyle(document.querySelector('#club-cabinet-detail')).gridTemplateColumns, documentWidth:document.documentElement.scrollWidth})");
const cabinetScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-cabinet-desktop-cdp.png", Buffer.from(cabinetScreenshot.data, "base64"));
await evaluate("document.querySelector('#identity-tab-colours').click()");
await wait(150);
const identityPointer = await evaluate("document.querySelector('#identity-panel h3')?.textContent");
const coloursVisual = await evaluate("({background:getComputedStyle(document.querySelector('.club-identity-colours')).backgroundImage, height:document.querySelector('.club-identity-colours')?.getBoundingClientRect().height, columns:getComputedStyle(document.querySelector('.club-identity-layout')).gridTemplateColumns})");
await evaluate("document.querySelector('#identity-tab-colours').focus()");
await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await wait(150);
const identityKeyboard = await evaluate("document.querySelector('#identity-panel h3')?.textContent");
const masiaVisual = await evaluate("({width:document.querySelector('#identity-panel img')?.naturalWidth, height:document.querySelector('#identity-panel img')?.getBoundingClientRect().height, suppliedPhoto:decodeURIComponent(document.querySelector('#identity-panel img')?.currentSrc ?? '').includes('/la-masia-user.png')})");
await evaluate("document.querySelector('#identity').scrollIntoView()");
await wait(200);
const masiaScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-la-masia-desktop-cdp.png", Buffer.from(masiaScreenshot.data, "base64"));
await evaluate("document.querySelector('#identity-tab-more').click()");
await wait(300);
const moreVisual = await evaluate("({title:document.querySelector('#identity-panel h3')?.textContent, image:document.querySelector('#identity-panel img')?.naturalWidth, translation:document.querySelector('#identity-panel')?.innerText.includes('More than a club')})");
await evaluate("document.querySelector('#identity').scrollIntoView()");
await wait(200);
const identityScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-identity-desktop-cdp.png", Buffer.from(identityScreenshot.data, "base64"));
await send("Page.navigate", { url: `${origin}/club/seasons/2024-25` });
await wait(1200);
const detailScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(".artifacts/club-season-desktop-cdp.png", Buffer.from(detailScreenshot.data, "base64"));
const detail = await evaluate("({title:document.querySelector('[id=titles-heading]')?.textContent, names:[...document.querySelectorAll('[aria-labelledby=titles-heading] li')].map(li=>li.innerText), visibleMarks:[...document.querySelectorAll('[aria-labelledby=titles-heading] li')].filter(li=>{const mark=li.firstElementChild; const img=mark?.querySelector('img'); return (img && img.naturalWidth>0) || !!mark?.innerText.trim()}).length, navBeforeTitles:document.querySelector('nav[aria-label=\"Adjacent seasons\"]')?.compareDocumentPosition(document.querySelector('[id=titles-heading]'))===4, sourceDisclosure:!!document.querySelector('details.club-sources')})");
await send("Page.navigate", { url: `${origin}/club/seasons/2021-22` });
await wait(700);
const pastUntitled = await evaluate("document.querySelector('[aria-labelledby=titles-heading]')?.innerText");
await send("Page.navigate", { url: `${origin}/club/seasons/2026-27` });
await wait(700);
const currentUntitled = await evaluate("document.querySelector('[aria-labelledby=titles-heading]')?.innerText");
const result = { localModelPreview, mobile, mobile3D, desktop, pointerSelection, keyboardSelection, themes, cabinetBefore, cabinetSelected, sculpture, identityPointer, coloursVisual, identityKeyboard, masiaVisual, moreVisual, detail, pastUntitled, currentUntitled };
console.log(JSON.stringify(result, null, 2));
socket.close();
if (!localModelPreview || mobile.documentWidth > mobile.viewport + 1 || mobile3D.documentWidth > mobile.viewport + 1 || desktop.documentWidth > desktop.viewport + 1 || sculpture.documentWidth > desktop.viewport + 1 || mobile.hasEraCarousel || !mobile.firstSummary.includes("1 title") || mobile.categoryButtons !== 21 || (!mobile3D.canvas && !mobile3D.fallback?.includes("unavailable")) || pointerSelection !== "1960/61" || keyboardSelection !== "2020/21" || themes.some((item) => item.background !== expectedSurface[item.kit]) || cabinetBefore.canvas || !cabinetBefore.featuredPhoto || cabinetBefore.yearLinks !== 5 || cabinetSelected.title !== "Copa del Rey" || cabinetSelected.yearLinks !== 32 || sculpture.modelId !== "6d6d9f2985bd4e77ad34df2c5c857a41" || !sculpture.preview || sculpture.columns.split(" ").length < 2 || identityPointer !== "Blue beside garnet" || !coloursVisual.background.includes("repeating-linear-gradient") || coloursVisual.height < 200 || coloursVisual.columns.split(" ").length < 2 || identityKeyboard !== "A school for life" || !masiaVisual.width || !masiaVisual.suppliedPhoto || masiaVisual.height < 200 || moreVisual.title !== "More than a club" || !moreVisual.image || !moreVisual.translation || detail.title !== "Titles won" || !detail.names.some((name) => name.includes("La Liga")) || detail.visibleMarks < 3 || !detail.navBeforeTitles || !detail.sourceDisclosure || !pastUntitled.includes("No titles were won") || !currentUntitled.includes("still in progress")) process.exit(1);
process.exit(0);
