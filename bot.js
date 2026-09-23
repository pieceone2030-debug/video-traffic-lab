/**
 * Blog Traffic Lab v2.0 — Embedded Video Watcher
 * Target: https://anime-tv-plus.blogspot.com/2026/09/snap.html
 *
 * Behavior:
 *   • Opens the page
 *   • Watches embedded video for 3-4 minutes
 *   • Simulates human mouse/scroll activity
 *   • Uses stealth + fingerprint randomization
 */
'use strict';

const { chromium } = require("patchright");
const { addExtra } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AnonymizeUA = require("@zorilla/puppeteer-extra-plugin-anonymize-ua").default;
const path = require("path");
const fs = require("fs");

const chromiumExtra = addExtra(chromium);
chromiumExtra.use(StealthPlugin());
chromiumExtra.use(AnonymizeUA());

/* ═══════════════════════════════════════════════════════
   ⚙️  Config
   ═══════════════════════════════════════════════════════ */

const CFG = {
    targetUrl:        process.env.TARGET_URL        || "https://anime-tv-plus.blogspot.com/2026/09/snap.html",
    botId:            process.env.BOT_ID            || "1",
    maxDuration:      parseInt(process.env.MAX_DURATION_MINUTES || "10", 10), // 10 min total
    minWatchTime:     parseInt(process.env.MIN_WATCH_TIME || "180", 10),   // 3 minutes
    maxWatchTime:     parseInt(process.env.MAX_WATCH_TIME || "240", 10),   // 4 minutes
};

const RUN_ID = Math.random().toString(36).substring(2, 10);

/* ═══════════════════════════════════════════════════════
   🎲  Utilities
   ═══════════════════════════════════════════════════════ */

const rand    = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick    = arr => arr[Math.floor(Math.random() * arr.length)];
const sleep   = ms => new Promise(r => setTimeout(r, ms));

function log(m) {
    console.log(`[${new Date().toISOString().substring(11, 19)}] [BOT-${CFG.botId}] ${m}`);
}

/* ═══════════════════════════════════════════════════════
   🧬  Fingerprints (5 profiles)
   ═══════════════════════════════════════════════════════ */

const FINGERPRINTS = [
    { name: "Win-Intel-UHD630",   userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8,  memory: 8,  colorDepth: 24, dsf: 1, timezone: 'America/New_York',  locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Win-NVIDIA-RTX3060", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1536, height: 864 },  screen: { width: 1536, height: 864 },  gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, memory: 16, colorDepth: 24, dsf: 1, timezone: 'America/Chicago',  locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Mac-M1",             userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",     platform: "MacIntel", viewport: { width: 1512, height: 945 },  screen: { width: 1512, height: 945 },  gpuVendor: "Google Inc. (Apple)",  gpuRenderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)", cores: 8,  memory: 8,  colorDepth: 30, dsf: 2, timezone: 'America/Los_Angeles', locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Win-Intel-Iris-Xe",  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 16, memory: 32, colorDepth: 24, dsf: 1, timezone: 'Europe/London', locale: 'en-GB', languages: ['en-GB', 'en'] },
    { name: "Win-AMD-RX6600",     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1366, height: 768 },  screen: { width: 1366, height: 768 },  gpuVendor: "Google Inc. (AMD)",    gpuRenderer: "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 6,  memory: 8,  colorDepth: 24, dsf: 1, timezone: 'Europe/Paris',  locale: 'fr-FR', languages: ['fr-FR', 'fr', 'en'] },
];

/* ═══════════════════════════════════════════════════════
   🎭  Behavior Engine
   ═══════════════════════════════════════════════════════ */

function makeBehaviorEngine() {
    let mouseX = randInt(300, 1200), mouseY = randInt(200, 800);
    const pause = (page, a, b) => page.waitForTimeout(randInt(a, b));

    async function moveMouse(page, tx, ty) {
        const sx = mouseX, sy = mouseY;
        const dist = Math.hypot(tx - sx, ty - sy);
        if (dist < 2) return;

        const cX = (sx + tx) / 2 + (Math.random() - 0.5) * Math.min(dist * 0.4, 150);
        const cY = (sy + ty) / 2 + (Math.random() - 0.5) * Math.min(dist * 0.4, 150);
        const steps = Math.max(5, Math.min(35, Math.round(dist / 15) + randInt(2, 6)));

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cX + t * t * tx;
            const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cY + t * t * ty;
            await page.mouse.move(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3);
            await page.waitForTimeout(randInt(4, 18));
        }
        mouseX = tx; mouseY = ty;
    }

    async function microMoves(page, n) {
        for (let i = 0; i < n; i++) {
            await moveMouse(page, mouseX + (Math.random() - 0.5) * 80, mouseY + (Math.random() - 0.5) * 50);
            await pause(page, 80, 280);
        }
    }

    async function scrollDown(page, dy) {
        const chunks = randInt(3, 6);
        for (let i = 0; i < chunks; i++) {
            await page.mouse.wheel(0, dy / chunks + (Math.random() - 0.5) * 30);
            await page.waitForTimeout(randInt(40, 120));
        }
    }

    async function randomPause(page, minMs, maxMs) {
        const wait = randInt(minMs, maxMs);
        const action = Math.random();

        if (action < 0.4) {
            await page.waitForTimeout(wait);
        } else if (action < 0.75) {
            const start = Date.now();
            while (Date.now() - start < wait) {
                await microMoves(page, 1);
                await page.waitForTimeout(randInt(150, 450));
            }
        } else {
            const vp = page.viewportSize();
            await moveMouse(page, randInt(100, vp.width - 100), randInt(100, vp.height - 100));
            await page.waitForTimeout(wait * 0.6);
        }
    }

    return { moveMouse, microMoves, scrollDown, randomPause, pause };
}

/* ═══════════════════════════════════════════════════════
   🎬  Session
   ═══════════════════════════════════════════════════════ */

async function runSession() {
    const startTime = Date.now();
    log(`Run ID: ${RUN_ID}`);
    log(`Target: ${CFG.targetUrl}`);
    log(`Watch time: ${CFG.minWatchTime}-${CFG.maxWatchTime}s`);

    const fp = pick(FINGERPRINTS);
    log(`Fingerprint: ${fp.name} | TZ: ${fp.timezone} | Locale: ${fp.locale}`);

    const B = makeBehaviorEngine();
    let context;
    const sessionPath = path.join(process.cwd(), '.sessions', `bot-${CFG.botId}`);

    try {
        fs.mkdirSync(sessionPath, { recursive: true });

        log(`Launching browser...`);
        context = await chromiumExtra.launchPersistentContext(sessionPath, {
            headless: true,
            viewport: fp.viewport,
            screen: { width: fp.screen.width, height: fp.screen.height },
            userAgent: fp.userAgent,
            locale: fp.locale,
            timezoneId: fp.timezone,
            deviceScaleFactor: fp.dsf,
            colorScheme: 'light',
            args: [
                `--user-agent=${fp.userAgent}`,
                `--lang=${fp.languages[0]}`,
                '--disable-blink-features=AutomationControlled',
                '--autoplay-policy=no-user-gesture-required', // allow autoplay
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--no-first-run', '--no-zygote'
            ]
        });

        let page = context.pages()[0];
        if (!page) page = await context.newPage();

        log(`Navigating...`);
        await page.goto(CFG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        log(`Loaded`);

        // Wait for initial render
        await page.waitForTimeout(randInt(3000, 6000));

        // Diagnostics
        const diag = await page.evaluate(() => ({
            wd: navigator.webdriver,
            plugins: navigator.plugins.length,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            videos: document.querySelectorAll('video').length,
            iframes: document.querySelectorAll('iframe').length,
            title: document.title.substring(0, 80)
        }));
        log(`CHECK: wd=${diag.wd}, plugins=${diag.plugins}, tz=${diag.tz}, videos=${diag.videos}, iframes=${diag.iframes}`);
        log(`Title: ${diag.title}`);

        // Try to force play any video
        await page.evaluate(() => {
            document.querySelectorAll('video').forEach(v => {
                try { v.muted = true; v.play().catch(() => {}); } catch (e) {}
            });
        }).catch(() => {});

        // ⭐ Watch loop: stay for min-watch-time with human-like activity
        const targetWatch = randInt(CFG.minWatchTime, CFG.maxWatchTime);
        log(`👀 Will watch for ${(targetWatch / 1000).toFixed(1)}s...`);

        const watchStart = Date.now();
        while (Date.now() - watchStart < targetWatch * 1000) {
            const action = Math.random();

            if (action < 0.3) {
                await B.randomPause(page, 1000, 3000);
            } else if (action < 0.55) {
                await B.microMoves(page, randInt(1, 3));
            } else if (action < 0.75) {
                await B.scrollDown(page, randInt(100, 400));
            } else if (action < 0.9) {
                await B.randomPause(page, 500, 1500);
            } else {
                const vp = page.viewportSize();
                await B.moveMouse(page, randInt(100, vp.width - 100), randInt(100, vp.height - 100));
            }
        }

        log(`✅ Watch time completed.`);
        const duration = Math.round((Date.now() - startTime) / 1000);
        log(`\n✅ Session done in ${duration}s`);

        return { status: 'ok', duration, watched: targetWatch };

    } catch (e) {
        log(`❌ Error: ${e.message}`);
        return { status: 'error', error: e.message };
    } finally {
        if (context) await context.close().catch(() => {});
    }
}

/* ═══════════════════════════════════════════════════════
   🚀  Main
   ═══════════════════════════════════════════════════════ */

async function main() {
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║   BLOG TRAFFIC LAB v2.0 — Video Watcher            ║");
    console.log("╚═══════════════════════════════════════════════════╝");

    const timeout = setTimeout(() => {
        console.error("⚠️ MAX_DURATION reached");
        process.exit(0);
    }, CFG.maxDuration * 60 * 1000);
    timeout.unref();

    try {
        const result = await runSession();
        console.log(JSON.stringify(result));
    } catch (e) {
        console.error("Fatal:", e.message);
        process.exitCode = 1;
    }

    clearTimeout(timeout);
    await sleep(500);
    process.exit(process.exitCode || 0);
}

main();
