/**
 * Video Traffic Lab v5.0 — Single Video + Fixed Plugins
 * ─────────────────────────────────────────────────────────────
 * - Watches a single YouTube video repeatedly (reload each time)
 * - Fixes plugins=0 by relying on StealthPlugin
 * - Proxy + geo-matched timezone/locale
 */
'use strict';

const { chromium } = require("patchright");
const { addExtra } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AnonymizeUA = require("@zorilla/puppeteer-extra-plugin-anonymize-ua").default;
const { PlaywrightBlocker } = require("@ghostery/adblocker-playwright");
const path = require("path");
const fs = require("fs");

const chromiumExtra = addExtra(chromium);
chromiumExtra.use(StealthPlugin());
chromiumExtra.use(AnonymizeUA());

/* ═══════════════════════════════════════════════════════
   ⚙️  Config
   ═══════════════════════════════════════════════════════ */

const CFG = {
    targetUrl:          process.env.TARGET_URL          || "https://www.youtube.com/watch?v=wktmRDfYc5k",
    botId:              process.env.BOT_ID              || "1",
    maxDuration:        parseInt(process.env.MAX_DURATION_MINUTES || "8", 10),
    adBlockerRate:      parseFloat(process.env.ADBLOCKER_RATE || "0.20"),
    returningRate:      parseFloat(process.env.RETURNING_RATE || "0.30"),
    minWatchTime:       parseInt(process.env.MIN_WATCH_TIME || "20", 10),
    maxWatchTime:       parseInt(process.env.MAX_WATCH_TIME || "50", 10),
    minWatches:         parseInt(process.env.MIN_VIDEOS || "1", 10),
    maxWatches:         parseInt(process.env.MAX_VIDEOS || "5", 10),
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
   🌐  PROXIES — Geo-matched
   ═══════════════════════════════════════════════════════ */

const PROXIES = [
    { url: 'http://slpetayk:y22swbhyqimx@31.59.20.176:6754/',    country: 'NL', timezone: 'Europe/Amsterdam',    locale: 'nl-NL', languages: ['nl-NL', 'nl', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@45.38.107.97:6014/',    country: 'US', timezone: 'America/New_York',    locale: 'en-US', languages: ['en-US', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@198.105.121.200:6462/', country: 'US', timezone: 'America/Chicago',     locale: 'en-US', languages: ['en-US', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@64.137.96.74:6641/',    country: 'CA', timezone: 'America/Toronto',     locale: 'en-CA', languages: ['en-CA', 'en', 'fr'] },
    { url: 'http://slpetayk:y22swbhyqimx@198.23.243.226:6361/',  country: 'US', timezone: 'America/Los_Angeles', locale: 'en-US', languages: ['en-US', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@38.154.185.97:6370/',   country: 'US', timezone: 'America/Denver',      locale: 'en-US', languages: ['en-US', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@84.247.60.125:6095/',   country: 'DE', timezone: 'Europe/Berlin',       locale: 'de-DE', languages: ['de-DE', 'de', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@142.111.67.146:5611/',  country: 'US', timezone: 'America/Phoenix',     locale: 'en-US', languages: ['en-US', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@191.96.254.138:6185/',  country: 'BR', timezone: 'America/Sao_Paulo',   locale: 'pt-BR', languages: ['pt-BR', 'pt', 'en'] },
    { url: 'http://slpetayk:y22swbhyqimx@31.58.9.4:6077/',       country: 'NL', timezone: 'Europe/Amsterdam',    locale: 'nl-NL', languages: ['nl-NL', 'nl', 'en'] },
];

/* ═══════════════════════════════════════════════════════
   🧬  Fingerprint base (بدون timezone — يأتي من البروكسي)
   ═══════════════════════════════════════════════════════ */

const FINGERPRINT_BASES = [
    { name: "Win-Intel-UHD630",   userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8,  memory: 8,  colorDepth: 24, dsf: 1 },
    { name: "Win-NVIDIA-RTX3060", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1536, height: 864 },  screen: { width: 1536, height: 864 },  gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, memory: 16, colorDepth: 24, dsf: 1 },
    { name: "Mac-M1",             userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",     platform: "MacIntel", viewport: { width: 1512, height: 945 },  screen: { width: 1512, height: 945 },  gpuVendor: "Google Inc. (Apple)",  gpuRenderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)", cores: 8,  memory: 8,  colorDepth: 30, dsf: 2 },
    { name: "Win-Intel-Iris-Xe",  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 16, memory: 32, colorDepth: 24, dsf: 1 },
    { name: "Win-AMD-RX6600",     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1366, height: 768 },  screen: { width: 1366, height: 768 },  gpuVendor: "Google Inc. (AMD)",    gpuRenderer: "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 6,  memory: 8,  colorDepth: 24, dsf: 1 },
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
            await page.mouse.move(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2);
            await page.waitForTimeout(randInt(4, 16));
        }
        mouseX = tx; mouseY = ty;
    }

    async function microMoves(page, n) {
        for (let i = 0; i < n; i++) {
            await moveMouse(page, mouseX + (Math.random() - 0.5) * 60, mouseY + (Math.random() - 0.5) * 35);
            await pause(page, 80, 260);
        }
    }

    return { moveMouse, microMoves, pause };
}

/* ═══════════════════════════════════════════════════════
   🎬  Video Helpers
   ═══════════════════════════════════════════════════════ */

async function forcePlayVideo(page) {
    try {
        await page.evaluate(() => {
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                try {
                    v.muted = true;
                    v.playsInline = true;
                    if (v.paused) v.play().catch(() => {});
                } catch (e) {}
            });
        });
    } catch (e) {}
}

async function watchVideo(page, B, log) {
    log(`  ▶ Watching video...`);
    await forcePlayVideo(page);
    await page.waitForTimeout(2000);

    // Click on the video area to simulate user interaction
    try {
        const vp = page.viewportSize();
        await B.moveMouse(page, vp.width / 2, vp.height / 2);
        await page.mouse.click(vp.width / 2, vp.height / 2);
        await page.waitForTimeout(1500);
    } catch (e) {}

    const watchTime = randInt(CFG.minWatchTime, CFG.maxWatchTime);
    log(`  👀 Will watch for ${watchTime} seconds...`);

    const startTime = Date.now();
    while (Date.now() - startTime < watchTime * 1000) {
        const behavior = Math.random();
        if (behavior < 0.2) {
            await B.microMoves(page, 1);
        } else if (behavior < 0.35) {
            await page.waitForTimeout(randInt(300, 800));
        } else {
            await page.waitForTimeout(randInt(500, 1500));
        }
    }

    log(`  ✓ Watch time completed.`);
    await page.waitForTimeout(randInt(500, 2000));
    return watchTime;
}

/* ═══════════════════════════════════════════════════════
   🎬  Session
   ═══════════════════════════════════════════════════════ */

async function runSession() {
    const startTime = Date.now();
    log(`Run ID: ${RUN_ID}`);
    log(`Target: ${CFG.targetUrl}`);

    const proxyEntry = pick(PROXIES);
    const proxyUrl = new URL(proxyEntry.url);
    const proxyConfig = {
        server: `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,
        username: decodeURIComponent(proxyUrl.username),
        password: decodeURIComponent(proxyUrl.password)
    };

    log(`🌐 Proxy: ${proxyConfig.server} | Country: ${proxyEntry.country} | TZ: ${proxyEntry.timezone}`);

    const fpBase = pick(FINGERPRINT_BASES);
    const fp = {
        ...fpBase,
        timezone: proxyEntry.timezone,
        locale: proxyEntry.locale,
        languages: [...proxyEntry.languages]
    };

    log(`Fingerprint: ${fp.name}`);
    log(`Timezone: ${fp.timezone} | Locale: ${fp.locale}`);

    // ⭐ عدد مرات المشاهدة (كل مرة = إعادة تحميل + مشاهدة)
    const targetWatches = randInt(CFG.minWatches, CFG.maxWatches);
    log(`🎯 Target: watch video ${targetWatches} time(s) (reload each time)`);

    const useAdBlocker = Math.random() < CFG.adBlockerRate;
    const isReturning  = Math.random() < CFG.returningRate;

    log(`Ad-Blocker: ${useAdBlocker ? '✅' : '❌'}`);
    log(`Visitor: ${isReturning ? '🔁 RETURNING' : '🆕 NEW'}`);

    const B = makeBehaviorEngine();
    let context;
    const sessionPath = path.join(process.cwd(), '.sessions', `bot-${CFG.botId}`);

    try {
        if (!isReturning) {
            try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) {}
        }
        fs.mkdirSync(sessionPath, { recursive: true });

        context = await chromiumExtra.launchPersistentContext(sessionPath, {
            headless: true,
            viewport: fp.viewport,
            screen: { width: fp.screen.width, height: fp.screen.height },
            userAgent: fp.userAgent,
            locale: fp.locale,
            timezoneId: fp.timezone,
            deviceScaleFactor: fp.dsf,
            colorScheme: 'light',
            proxy: proxyConfig,
            args: [
                `--user-agent=${fp.userAgent}`,
                `--lang=${fp.languages[0]}`,
                '--disable-blink-features=AutomationControlled',
                '--autoplay-policy=no-user-gesture-required',
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--no-first-run', '--no-zygote'
            ]
        });

        if (useAdBlocker) {
            try {
                log(`Loading ad-blocker...`);
                const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
                await blocker.enableBlockingInContext(context);
                log(`Ad-blocker ready`);
            } catch (e) {
                log(`Ad-blocker failed: ${e.message}`);
            }
        }

        let page = context.pages()[0];
        if (!page) page = await context.newPage();

        // ⭐ تحقق من البصمة (بدون addInitScript المخصص)
        log(`Navigating...`);
        await page.goto(CFG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        log(`Loaded`);

        // ⭐ انتظار الفيديو يحمّل
        await page.waitForTimeout(randInt(3000, 6000));

        // ⭐ تحقق من البصمة (plugins يجب أن تكون > 0)
        const live = await page.evaluate(() => ({
            wd: navigator.webdriver,
            plugins: navigator.plugins.length,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            lang: navigator.language,
            videos: document.querySelectorAll('video').length
        }));
        log(`CHECK: wd=${live.wd}, plugins=${live.plugins}, tz=${live.tz}, lang=${live.lang}, videos=${live.videos}`);

        // ⭐ حلقة المشاهدة المتكررة (إعادة تحميل نفس الفيديو)
        let watched = 0;

        for (let i = 1; i <= targetWatches; i++) {
            log(`\n─── Watch ${i}/${targetWatches} ───`);

            if (i > 1) {
                // إعادة تحميل الفيديو
                log(`  🔄 Reloading video...`);
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(randInt(3000, 6000));
            }

            const watchTime = await watchVideo(page, B, log);
            watched++;
            log(`  📺 Watched ${watched}/${targetWatches} (${watchTime}s)`);

            // ⭐ تأخير عشوائي بين المشاهدات (محاكاة مستخدم حقيقي)
            if (i < targetWatches) {
                const delay = randInt(3000, 10000);
                log(`  💭 Delay before next watch: ${(delay / 1000).toFixed(1)}s`);
                await page.waitForTimeout(delay);
            }

            if (Date.now() - startTime > CFG.maxDuration * 60 * 1000 - 30000) {
                log(`  ⏰ Time limit approaching`);
                break;
            }
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        log(`\n✅ Done in ${duration}s | watched ${watched}/${targetWatches}`);

        return { status: 'ok', duration, watched, targetWatches };

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
    console.log("║   VIDEO TRAFFIC LAB v5.0 — Single Video + Fixed   ║");
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
