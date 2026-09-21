/**
 * Video Traffic Lab v4.0 — Proxy + Geo-Matched Edition
 * ─────────────────────────────────────────────────────────────
 * Each session uses a proxy with a matching timezone/locale
 * to avoid IP/TZ mismatch detection.
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
    targetUrl:          process.env.TARGET_URL          || "https://www.youtube.com/",
    botId:              process.env.BOT_ID              || "1",
    maxDuration:        parseInt(process.env.MAX_DURATION_MINUTES || "8", 10),
    adBlockerRate:      parseFloat(process.env.ADBLOCKER_RATE || "0.20"),
    returningRate:      parseFloat(process.env.RETURNING_RATE || "0.30"),
    minWatchTime:       parseInt(process.env.MIN_WATCH_TIME || "15", 10),
    maxWatchTime:       parseInt(process.env.MAX_WATCH_TIME || "45", 10),
    maxVideoDuration:   parseInt(process.env.MAX_VIDEO_DURATION || "90", 10),
    minVideos:          parseInt(process.env.MIN_VIDEOS || "1", 10),
    maxVideos:          parseInt(process.env.MAX_VIDEOS || "8", 10),
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
   🌐  PROXIES — with matched geo data
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

const TZ_OFFSETS = {
    'Europe/Amsterdam':  -60,
    'Europe/Berlin':     -60,
    'Europe/Paris':      -60,
    'Europe/London':       0,
    'America/New_York':  300,
    'America/Chicago':   360,
    'America/Denver':    420,
    'America/Phoenix':   420,
    'America/Los_Angeles':480,
    'America/Toronto':   300,
    'America/Sao_Paulo': 180,
};

/* ═══════════════════════════════════════════════════════
   🧬  Fingerprint base (لا يحتوي timezone/locale — يأتي من البروكسي)
   ═══════════════════════════════════════════════════════ */

const FINGERPRINT_BASES = [
    { name: "Win-Intel-UHD630",   userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8,  memory: 8,  colorDepth: 24, dsf: 1 },
    { name: "Win-NVIDIA-RTX3060", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1536, height: 864 },  screen: { width: 1536, height: 864 },  gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, memory: 16, colorDepth: 24, dsf: 1 },
    { name: "Mac-M1",             userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",     platform: "MacIntel", viewport: { width: 1512, height: 945 },  screen: { width: 1512, height: 945 },  gpuVendor: "Google Inc. (Apple)",  gpuRenderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)", cores: 8,  memory: 8,  colorDepth: 30, dsf: 2 },
    { name: "Win-Intel-Iris-Xe",  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 16, memory: 32, colorDepth: 24, dsf: 1 },
    { name: "Win-AMD-RX6600",     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1366, height: 768 },  screen: { width: 1366, height: 768 },  gpuVendor: "Google Inc. (AMD)",    gpuRenderer: "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 6,  memory: 8,  colorDepth: 24, dsf: 1 },
];

/* ═══════════════════════════════════════════════════════
   🛡️  Stealth Script
   ═══════════════════════════════════════════════════════ */

function buildStealthScript(fp) {
    const cfg = JSON.stringify({
        ua: fp.userAgent, platform: fp.platform, languages: fp.languages,
        cores: fp.cores, memory: fp.memory, screen: fp.screen,
        colorDepth: fp.colorDepth, gpuVendor: fp.gpuVendor, gpuRenderer: fp.gpuRenderer,
        timezone: fp.timezone, tzOffset: TZ_OFFSETS[fp.timezone] || 0
    });

    return `
    (function () {
        'use strict';
        const FP = ${cfg};
        const navProto = Navigator.prototype;
        const defProp = (obj, prop, getter) => { try { Object.defineProperty(obj, prop, { get: getter, configurable: true }); } catch (e) {} };
        defProp(navProto, 'userAgent', () => FP.ua);
        defProp(navProto, 'appVersion', () => FP.ua.replace('Mozilla/', ''));
        defProp(navProto, 'platform', () => FP.platform);
        defProp(navProto, 'vendor', () => 'Google Inc.');
        defProp(navProto, 'language', () => FP.languages[0]);
        defProp(navProto, 'languages', () => Object.freeze([...FP.languages]));
        defProp(navProto, 'hardwareConcurrency', () => FP.cores);
        defProp(navProto, 'deviceMemory', () => FP.memory);
        defProp(navProto, 'maxTouchPoints', () => 0);
        defProp(navProto, 'webdriver', () => undefined);

        try {
            const mkMime = (t, s, d) => { const m = Object.create(MimeType.prototype); Object.defineProperty(m, 'type', { value: t }); Object.defineProperty(m, 'suffixes', { value: s }); Object.defineProperty(m, 'description', { value: d }); Object.defineProperty(m, 'enabledPlugin', { value: null }); return m; };
            const mkPlugin = (n, f, d, ms) => { const p = Object.create(Plugin.prototype); Object.defineProperty(p, 'name', { value: n }); Object.defineProperty(p, 'filename', { value: f }); Object.defineProperty(p, 'description', { value: d }); Object.defineProperty(p, 'length', { value: ms.length }); ms.forEach((m, i) => Object.defineProperty(p, i, { value: m })); return p; };
            const pdf1 = mkMime('application/pdf', 'pdf', 'PDF');
            const pdf2 = mkMime('text/pdf', 'pdf', 'PDF');
            const plugins = [
                mkPlugin('PDF Viewer', 'internal-pdf-viewer', 'PDF', [pdf1, pdf2]),
                mkPlugin('Chrome PDF Viewer', 'internal-pdf-viewer', 'PDF', [pdf1, pdf2]),
                mkPlugin('Chromium PDF Viewer', 'internal-pdf-viewer', 'PDF', [pdf1, pdf2]),
                mkPlugin('Microsoft Edge PDF Viewer', 'internal-pdf-viewer', 'PDF', [pdf1, pdf2]),
                mkPlugin('WebKit built-in PDF', 'internal-pdf-viewer', 'PDF', [pdf1, pdf2]),
                mkPlugin('Native Client', 'internal-nacl-plugin', '', [])
            ];
            const arr = Object.create(PluginArray.prototype);
            plugins.forEach((p, i) => Object.defineProperty(arr, i, { value: p }));
            Object.defineProperty(arr, 'length', { value: plugins.length });
            Object.defineProperty(arr, 'item', { value: i => plugins[i] || null });
            Object.defineProperty(arr, 'namedItem', { value: n => plugins.find(p => p.name === n) || null });
            defProp(navProto, 'plugins', () => arr);
        } catch (e) {}

        try {
            const sp = Screen.prototype;
            defProp(sp, 'width', () => FP.screen.width);
            defProp(sp, 'height', () => FP.screen.height);
            defProp(sp, 'availWidth', () => FP.screen.width);
            defProp(sp, 'availHeight', () => FP.screen.height - 40);
            defProp(sp, 'colorDepth', () => FP.colorDepth);
            defProp(sp, 'pixelDepth', () => FP.colorDepth);
        } catch (e) {}

        try {
            const patchCtx = (ctx) => {
                if (!ctx) return ctx;
                try {
                    const gp = ctx.getParameter.bind(ctx);
                    Object.defineProperty(ctx, 'getParameter', {
                        value: function (p) {
                            if (p === 37445) return FP.gpuVendor;
                            if (p === 37446) return FP.gpuRenderer;
                            if (p === 7936) return 'WebKit';
                            if (p === 7937) return 'WebKit WebGL';
                            return gp(p);
                        }, writable: false, configurable: false
                    });
                } catch (e) {}
                return ctx;
            };
            const origGC = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, attrs) {
                const ctx = origGC.call(this, type, attrs);
                if (ctx && (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2')) return patchCtx(ctx);
                return ctx;
            };
        } catch (e) {}

        try {
            const origResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
            Intl.DateTimeFormat.prototype.resolvedOptions = function () {
                const r = origResolved.call(this);
                if (r.timeZone) r.timeZone = FP.timezone;
                return r;
            };
            Date.prototype.getTimezoneOffset = function () { return FP.tzOffset; };
        } catch (e) {}

        try {
            if (navigator.permissions && navigator.permissions.query) {
                const oq = navigator.permissions.query.bind(navigator.permissions);
                navigator.permissions.query = function (d) {
                    if (d && d.name === 'notifications') return Promise.resolve({ state: 'default', onchange: null });
                    return oq(d);
                };
            }
        } catch (e) {}

        try {
            window.chrome = window.chrome || {};
            window.chrome.runtime = window.chrome.runtime || {};
            window.chrome.app = window.chrome.app || { isInstalled: false };
            window.chrome.csi = () => ({ onloadT: Date.now(), startE: Date.now(), pageT: 0, tran: 15 });
            window.chrome.loadTimes = () => ({ commitLoadTime: Date.now()/1000, finishLoadTime: Date.now()/1000, navigationType: 'Other' });
        } catch (e) {}

        try {
            const oRTC = window.RTCPeerConnection;
            window.RTCPeerConnection = function (cfg) {
                if (cfg && cfg.iceServers) cfg.iceServers = [];
                return new oRTC(cfg || { iceServers: [] });
            };
        } catch (e) {}
    })();
    `;
}

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

async function forcePlayVideos(page) {
    try {
        await page.evaluate(() => {
            document.querySelectorAll('video').forEach(v => {
                try {
                    v.muted = true;
                    v.playsInline = true;
                    if (v.paused) v.play().catch(() => {});
                } catch (e) {}
            });
        });
    } catch (e) {}
}

async function waitForVideoEnd(page, B, log) {
    log(`  ▶ Watching video...`);
    await forcePlayVideos(page);
    await page.waitForTimeout(1500);

    const watchTime = randInt(CFG.minWatchTime, CFG.maxWatchTime);
    log(`  👀 Will watch for ${watchTime} seconds...`);

    const startTime = Date.now();
    while (Date.now() - startTime < watchTime * 1000) {
        const behavior = Math.random();
        if (behavior < 0.2) {
            await B.microMoves(page, 1);
        } else if (behavior < 0.3) {
            await page.waitForTimeout(randInt(200, 600));
        } else {
            await page.waitForTimeout(randInt(500, 1500));
        }
    }

    log(`  ✓ Watch time completed.`);
    await page.waitForTimeout(randInt(500, 2000));
    return { ended: true, duration: watchTime };
}

async function goToNextVideo(page, B, log) {
    const methods = ['keydown', 'keydown', 'keydown', 'scroll', 'swipe'];
    const method = pick(methods);
    log(`  ⏭️  Next video via: ${method}`);

    try {
        if (method === 'keydown') {
            const key = pick(['ArrowDown', 'ArrowDown', 'PageDown']);
            await page.keyboard.press(key);
            await page.waitForTimeout(randInt(1200, 2200));

        } else if (method === 'scroll') {
            const vp = page.viewportSize();
            await page.evaluate((amount) => {
                const containers = [];
                const candidates = document.querySelectorAll('[class*="scroll"], [class*="feed"], main, #main, #app, body');
                for (const el of candidates) {
                    if (el.scrollHeight > el.clientHeight + 50) containers.push(el);
                }
                if (containers.length > 0) containers[0].scrollBy({ top: amount, behavior: 'smooth' });
                else window.scrollBy({ top: amount, behavior: 'smooth' });
            }, vp.height);
            await page.waitForTimeout(randInt(1500, 2500));

        } else if (method === 'swipe') {
            const vp = page.viewportSize();
            const startX = vp.width / 2;
            const startY = vp.height * 0.75;
            const endY = vp.height * 0.25;
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            for (let i = 1; i <= 12; i++) {
                const y = startY + (endY - startY) * (i / 12);
                await page.mouse.move(startX, y);
                await page.waitForTimeout(randInt(15, 35));
            }
            await page.mouse.up();
            await page.waitForTimeout(randInt(1500, 2500));
        }

        await page.waitForTimeout(randInt(800, 1800));
        await forcePlayVideos(page);
        return true;
    } catch (e) {
        log(`  ! Next video error: ${e.message}`);
        return false;
    }
}

/* ═══════════════════════════════════════════════════════
   🎬  Session
   ═══════════════════════════════════════════════════════ */

async function runSession() {
    const startTime = Date.now();
    log(`Run ID: ${RUN_ID}`);
    log(`Target: ${CFG.targetUrl}`);

    // ⭐ Pick a proxy (with matched geo)
    const proxyEntry = pick(PROXIES);
    const proxyUrl = new URL(proxyEntry.url);
    const proxyConfig = {
        server: `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,
        username: decodeURIComponent(proxyUrl.username),
        password: decodeURIComponent(proxyUrl.password)
    };

    log(`🌐 Proxy: ${proxyConfig.server} | Country: ${proxyEntry.country} | TZ: ${proxyEntry.timezone}`);

    // ⭐ Pick a fingerprint base
    const fpBase = pick(FINGERPRINT_BASES);

    // ⭐ Merge fingerprint + geo data (from proxy)
    const fp = {
        ...fpBase,
        timezone: proxyEntry.timezone,
        locale: proxyEntry.locale,
        languages: [...proxyEntry.languages]
    };

    log(`Fingerprint: ${fp.name}`);
    log(`Timezone: ${fp.timezone} | Locale: ${fp.locale} | Languages: ${fp.languages.join(',')}`);

    const targetVideos = randInt(CFG.minVideos, CFG.maxVideos);
    log(`🎯 Target: watch ${targetVideos} video(s)`);

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
                '--disable-features=IsolateOrigins,site-per-process',
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

        await context.addInitScript(buildStealthScript(fp));

        let page = context.pages()[0];
        if (!page) page = await context.newPage();
        await page.addInitScript(buildStealthScript(fp));

        page.on("framenavigated", f => {
            if (f === page.mainFrame()) log(`[NAV] ${f.url().substring(0, 80)}`);
        });

        log(`Navigating...`);
        await page.goto(CFG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        log(`Loaded`);

        const live = await page.evaluate(() => ({
            wd: navigator.webdriver,
            plugins: navigator.plugins.length,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            lang: navigator.language,
            videos: document.querySelectorAll('video').length
        }));
        log(`CHECK: wd=${live.wd}, plugins=${live.plugins}, tz=${live.tz}, lang=${live.lang}, videos=${live.videos}`);

        const initialWait = isReturning ? randInt(1500, 3500) : randInt(2500, 6000);
        log(`Initial wait: ${(initialWait / 1000).toFixed(1)}s`);
        await B.microMoves(page, randInt(1, 3));
        await page.waitForTimeout(initialWait);

        await forcePlayVideos(page);

        let watched = 0;
        let consecutiveFailures = 0;

        while (watched < targetVideos) {
            log(`\n─── Video ${watched + 1}/${targetVideos} ───`);

            const result = await waitForVideoEnd(page, B, log);

            if (result.ended) {
                watched++;
                consecutiveFailures = 0;
                log(`  📺 Watched ${watched}/${targetVideos}`);
            } else {
                consecutiveFailures++;
                if (consecutiveFailures >= 3) {
                    log(`  Aborting due to repeated failures`);
                    break;
                }
            }

            if (watched >= targetVideos) {
                log(`\n🎯 Target reached. Exiting...`);
                break;
            }

            if (Math.random() < 0.35) {
                const hesitation = randInt(2000, 6000);
                log(`  💭 Hesitation: ${(hesitation / 1000).toFixed(1)}s`);
                await page.waitForTimeout(hesitation);
            }

            await goToNextVideo(page, B, log);

            if (Date.now() - startTime > CFG.maxDuration * 60 * 1000 - 30000) {
                log(`  ⏰ Time limit approaching`);
                break;
            }
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        log(`\n✅ Done in ${duration}s | watched ${watched}/${targetVideos}`);

        return { status: 'ok', duration, watched, targetVideos };

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
    console.log("║   VIDEO TRAFFIC LAB v4.0 — Proxy + Geo-Matched    ║");
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
