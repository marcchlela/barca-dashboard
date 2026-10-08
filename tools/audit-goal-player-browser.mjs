#!/usr/bin/env node
// Read-only inspection of a publisher's isolated LaLiga player frame in an
// already-open local debugging browser. No video bytes are downloaded.
const targets = await fetch("http://127.0.0.1:9224/json").then((res) => res.json());
const frames = targets.filter((target) => target.type === "iframe" && target.url.startsWith("https://playerclips.laliga.com/embed/"));
if (!frames.length) throw new Error("Open a LaLiga player page in the debugging browser first.");
for (const frame of frames) {
  const socket = new WebSocket(frame.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  if (process.argv.includes("--play")) {
    socket.send(JSON.stringify({ id: 2, method: "Input.dispatchMouseEvent", params: { type: "mousePressed", x: 370, y: 208, button: "left", clickCount: 1 } }));
    socket.send(JSON.stringify({ id: 3, method: "Input.dispatchMouseEvent", params: { type: "mouseReleased", x: 370, y: 208, button: "left", clickCount: 1 } }));
    await new Promise((resolve) => setTimeout(resolve, 3500));
  }
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CDP response timed out")), 10000);
    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.id !== 1) return;
      clearTimeout(timeout);
      resolve(data.result?.result?.value ?? data.error);
    });
    socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: {
      expression: `({ title: document.title, text: document.body?.innerText?.slice(0, 1000),
        videos: [...document.querySelectorAll('video')].map(v => ({duration:v.duration, currentTime:v.currentTime, paused:v.paused, readyState:v.readyState, networkState:v.networkState, error:v.error?.message, src:v.currentSrc, width:v.videoWidth, height:v.videoHeight})),
        images: [...document.images].map(i => ({alt:i.alt,src:i.currentSrc})).slice(0,5),
        controls: [...document.querySelectorAll('button,[role=button]')].map(b => ({text:b.textContent?.trim().slice(0,80),label:b.getAttribute('aria-label'),html:b.outerHTML.slice(0,300)})).slice(0,15),
        playRect: (() => { const r = document.querySelector('.vjs-big-play-button,.video-player-overlay')?.getBoundingClientRect(); return r && {x:r.x,y:r.y,width:r.width,height:r.height}; })(),
        html: document.body?.innerHTML?.slice(0,1200) })`,
      returnByValue: true,
    } }));
  });
  console.log(JSON.stringify({ url: frame.url, player: result }, null, 2));
  socket.close();
}
