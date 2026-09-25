import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

const [
  endpoint =
    "http://127.0.0.1:9223",
  pageUrl =
    "http://localhost:3000",
  outputDirectory =
    ".artifacts",
] = process.argv.slice(2);

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds,
    );
  });

async function getPageTarget() {
  for (
    let attempt = 0;
    attempt < 80;
    attempt += 1
  ) {
    try {
      const targets =
        await fetch(
          `${endpoint}/json/list`,
        ).then((response) =>
          response.json(),
        );

      const target =
        targets.find(
          (candidate) =>
            candidate.type ===
              "page" &&
            candidate.url.startsWith(
              pageUrl,
            ),
        ) ??
        targets.find(
          (candidate) =>
            candidate.type ===
              "page" &&
            candidate.url !==
              "about:blank" &&
            !candidate.url.startsWith(
              "edge://",
            ),
        ) ??
        targets.find(
          (candidate) =>
            candidate.type ===
            "page",
        );

      if (target) {
        return target;
      }
    } catch {
      // Edge can take a moment to expose its debugging endpoint.
    }

    await wait(100);
  }

  throw new Error(
    "No page target was exposed by Edge.",
  );
}

const target =
  await getPageTarget();

const socket =
  new WebSocket(
    target.webSocketDebuggerUrl,
  );

const pending =
  new Map();

const exceptions = [];

const consoleMessages = [];

let commandId = 0;

socket.addEventListener(
  "message",
  (event) => {
    const message =
      JSON.parse(
        event.data,
      );

    if (
      message.method ===
      "Runtime.exceptionThrown"
    ) {
      exceptions.push(
        message.params
          .exceptionDetails
          .text,
      );
    }

    if (
      message.method ===
      "Runtime.consoleAPICalled"
    ) {
      consoleMessages.push(
        message.params.args
          .map(
            (argument) =>
              argument.value ??
              argument.description ??
              argument.type,
          )
          .join(" "),
      );
    }

    if (
      message.method ===
      "Log.entryAdded"
    ) {
      consoleMessages.push(
        message.params.entry.text,
      );
    }

    if (!message.id) {
      return;
    }

    const handlers =
      pending.get(
        message.id,
      );

    if (!handlers) {
      return;
    }

    pending.delete(
      message.id,
    );

    if (message.error) {
      handlers.reject(
        new Error(
          message.error.message,
        ),
      );

      return;
    }

    handlers.resolve(
      message.result,
    );
  },
);

await new Promise(
  (resolve, reject) => {
    socket.addEventListener(
      "open",
      resolve,
      {
        once: true,
      },
    );

    socket.addEventListener(
      "error",
      reject,
      {
        once: true,
      },
    );
  },
);

function call(
  method,
  params = {},
) {
  commandId += 1;

  return new Promise(
    (resolve, reject) => {
      pending.set(
        commandId,
        {
          resolve,
          reject,
        },
      );

      socket.send(
        JSON.stringify({
          id: commandId,
          method,
          params,
        }),
      );
    },
  );
}

async function evaluate(
  expression,
) {
  const result =
    await call(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
    );

  return result.result.value;
}

async function waitFor(
  expression,
  timeout = 12_000,
) {
  const startedAt =
    Date.now();

  while (
    Date.now() -
      startedAt <
    timeout
  ) {
    if (
      await evaluate(
        expression,
      )
    ) {
      return;
    }

    await wait(100);
  }

  throw new Error(
    `Timed out waiting for: ${expression}`,
  );
}

async function snapshot() {
  return evaluate(`(() => {
    const intro = document.querySelector('[data-intro-gate]');
    const dashboard = document.querySelector('[data-dashboard-content]');
    const frame = document.querySelector('[data-intro-portal-frame]');
    const matchStage = document.querySelector('[data-match-stage]');
    const toRect = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left * 10) / 10,
        top: Math.round(rect.top * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      };
    };
    return {
      introMounted: Boolean(intro),
      canvasCount: document.querySelectorAll('canvas').length,
      dashboardInert: dashboard?.hasAttribute('inert') ?? false,
      sessionSeen: sessionStorage.getItem('barca-entry-v4-seen'),
      portalRect: toRect(frame),
      matchStageRect: toRect(matchStage),
    };
  })()`);
}

async function capture(
  fileName,
) {
  const result =
    await call(
      "Page.captureScreenshot",
      {
        format: "png",
        captureBeyondViewport:
          false,
      },
    );

  await writeFile(
    path.join(
      outputDirectory,
      fileName,
    ),
    Buffer.from(
      result.data,
      "base64",
    ),
  );
}

await mkdir(
  outputDirectory,
  {
    recursive: true,
  },
);

await call(
  "Page.enable",
);

await call(
  "Runtime.enable",
);

await call(
  "Log.enable",
);

await call(
  "Emulation.setDeviceMetricsOverride",
  {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  },
);

await call(
  "Page.navigate",
  {
    url: pageUrl,
  },
);

await waitFor(
  "document.readyState === 'complete'",
);

await evaluate(
  "sessionStorage.removeItem('barca-entry-v4-seen'); window.location.reload(); true",
);

await wait(500);

await waitFor(
  "document.readyState === 'complete'",
);

await waitFor(
  "Boolean(document.querySelector('[data-intro-gate]'))",
);

const capabilities =
  await evaluate(`({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    compactViewport: matchMedia('(max-width: 639px)').matches,
    webgl2: Boolean(document.createElement('canvas').getContext('webgl2')),
    webgl: Boolean(document.createElement('canvas').getContext('webgl')),
    introStatus: document.querySelector('[data-intro-gate]')?.getAttribute('data-intro-status'),
    targetReady: document.querySelector('[data-intro-gate]')?.getAttribute('data-target-ready'),
  })`);

process.stdout.write(
  `${JSON.stringify({ capabilities })}\n`,
);

const introTimeline = [];

try {
  const timelineStartedAt =
    Date.now();

  let previousState =
    "";

  while (
    Date.now() -
      timelineStartedAt <
    12_000
  ) {
    const state =
      await evaluate(`(() => {
        const gate = document.querySelector('[data-intro-gate]');
        return {
          mounted: Boolean(gate),
          status: gate?.getAttribute('data-intro-status') ?? null,
          targetReady: gate?.getAttribute('data-target-ready') ?? null,
          canvas: Boolean(document.querySelector('[data-intro-canvas] canvas')),
        };
      })()`);

    const serialized =
      JSON.stringify(
        state,
      );

    if (
      serialized !==
      previousState
    ) {
      introTimeline.push({
        elapsed:
          Date.now() -
          timelineStartedAt,
        ...state,
      });

      previousState =
        serialized;
    }

    if (state.canvas) {
      break;
    }

    await wait(100);
  }

  if (
    !introTimeline.some(
      (state) =>
        state.canvas,
    )
  ) {
    throw new Error(
      "The intro Canvas did not mount.",
    );
  }
} catch (error) {
  const diagnostics =
    await snapshot();

  process.stdout.write(
    `${JSON.stringify(
      {
        diagnostics,
        introTimeline,
        exceptions,
        consoleMessages,
      },
      null,
      2,
    )}\n`,
  );

  socket.close();

  throw error;
}

await wait(1_200);

await waitFor(
  "Boolean(document.querySelector('[data-intro-ready=\"true\"]'))",
  10_000,
);

await wait(250);

const tunnel =
  await snapshot();

await capture(
  "threshold-tunnel.png",
);

await waitFor(
  `(() => {
    const frame = document.querySelector('[data-intro-portal-frame]');
    if (!frame) return false;
    const left = frame.getBoundingClientRect().left;
    return left > 160 && left < 195;
  })()`,
  8_000,
);

await capture(
  "threshold-stadium.png",
);

try {
  await waitFor(
    `(() => {
      const frame = document.querySelector('[data-intro-portal-frame]');
      const matchStage = document.querySelector('[data-match-stage]');
      if (!frame || !matchStage) {
        return !frame && sessionStorage.getItem('barca-entry-v4-seen') === '1';
      }
      const frameRect = frame.getBoundingClientRect();
      const matchRect = matchStage.getBoundingClientRect();
      return (
        Math.abs(frameRect.left - matchRect.left) < 0.6 &&
        Math.abs(frameRect.top - matchRect.top) < 0.6 &&
        Math.abs(frameRect.width - matchRect.width) < 0.6 &&
        Math.abs(frameRect.height - matchRect.height) < 0.6
      );
    })()`,
    12_000,
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify(
      {
        handoffFailure:
          await snapshot(),
        exceptions,
        consoleMessages,
      },
      null,
      2,
    )}\n`,
  );

  throw error;
}

const handoff =
  await snapshot();

await capture(
  "threshold-handoff.png",
);

await waitFor(
  "!document.querySelector('[data-intro-gate]')",
  8_000,
);

const completed =
  await snapshot();

await capture(
  "threshold-complete.png",
);

await call(
  "Page.reload",
  {
    ignoreCache: false,
  },
);

await wait(500);

await waitFor(
  "document.readyState === 'complete'",
);

await waitFor(
  "!document.querySelector('[data-intro-gate]')",
  5_000,
);

const oncePerSession =
  await snapshot();

const replayClicked =
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.textContent?.includes('Replay Tunnel'));
    button?.click();
    return Boolean(button);
  })()`);

await waitFor(
  "Boolean(document.querySelector('[data-intro-canvas] canvas'))",
);

const replayStarted =
  await snapshot();

const skipClicked =
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('[data-intro-gate] button')]
      .find((candidate) => candidate.textContent?.includes('Skip'));
    button?.click();
    return Boolean(button);
  })()`);

await waitFor(
  "!document.querySelector('[data-intro-gate]')",
);

const skipCompleted =
  await snapshot();

await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.includes('Replay Tunnel'));
  button?.click();
  return Boolean(button);
})()`);

await waitFor(
  "Boolean(document.querySelector('[data-intro-canvas] canvas'))",
);

await evaluate(
  "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true",
);

await waitFor(
  "!document.querySelector('[data-intro-gate]')",
);

const escapeCompleted =
  await snapshot();

await call(
  "Emulation.setEmulatedMedia",
  {
    features: [
      {
        name:
          "prefers-reduced-motion",
        value:
          "reduce",
      },
    ],
  },
);

await evaluate(
  "sessionStorage.removeItem('barca-entry-v4-seen'); true",
);

await call(
  "Page.reload",
  {
    ignoreCache: false,
  },
);

await wait(500);

await waitFor(
  "document.readyState === 'complete'",
);

await waitFor(
  "!document.querySelector('[data-intro-gate]')",
  5_000,
);

const reducedMotion =
  await snapshot();

socket.close();

process.stdout.write(
  `${JSON.stringify(
    {
      tunnel,
      handoff,
      completed,
      oncePerSession,
      replayClicked,
      replayStarted,
      skipClicked,
      skipCompleted,
      escapeCompleted,
      reducedMotion,
      exceptions,
      consoleMessages,
    },
    null,
    2,
  )}\n`,
);
