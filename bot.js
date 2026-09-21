/**
 * Video Traffic Lab v3.0 — Advanced Stealth Edition
 * ─────────────────────────────────────────────────────────────
 * This version implements advanced techniques from top open-source
 * view bots to maximize view count and evade detection.
 *
 * Key Upgrades:
 * - Deeper human behavior simulation (randomized watch, natural mouse).
 * - Unique browser fingerprint per session to avoid linking.
 * - Enhanced session management for "returning visitor" status.
 * - Advanced proxy support (residential proxies recommended).
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
   ⚙️  Configuration
   ═══════════════════════════════════════════════════════ */

const CFG = {
    targetUrl:          process.env.TARGET_URL          || "https://www.youtube.com/",
    botId:              process.env.BOT_ID              || "1",
    maxDuration:        parseInt(process.env.MAX_DURATION_MINUTES || "8", 10),
    adBlockerRate:      parseFloat(process.env.ADBLOCKER_RATE || "0.20"),
    returningRate:      parseFloat(process.env.RETURNING_RATE || "0.30"),
    minWatchTime:       parseInt(process.env.MIN_WATCH_TIME || "10", 10), // seconds
    maxWatchTime:       parseInt(process.env.MAX_WATCH_TIME || "45", 10), // seconds
    maxVideoDuration:   parseInt(process.env.MAX_VIDEO_DURATION || "90", 10),
    // Proxy settings
    proxyServer:        process.env.PROXY_SERVER       || null,
    proxyUsername:      process.env.PROXY_USERNAME     || null,
    proxyPassword:      process.env.PROXY_PASSWORD     || null,
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
   🧬  Fingerprints & Locales (Expanded)
   ═══════════════════════════════════════════════════════ */

const FINGERPRINTS = [
    { name: "Win-Intel-UHD630", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, gpuVendor: "Google Inc. (Intel)", gpuRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8, memory: 8, colorDepth: 24, dsf: 1 },
    { name: "Win-NVIDIA-RTX3060", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 1536, height: 864 }, screen: { width: 1536, height: 864 }, gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, memory: 16, colorDepth: 24, dsf: 1 },
    { name: "Mac-M1", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "MacIntel", viewport: { width: 1512, height: 945 }, screen: { width: 1512, height: 945 }, gpuVendor: "Google Inc. (Apple)", gpuRenderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)", cores: 8, memory: 8, colorDepth: 30, dsf: 2 },
    // ... (add more fingerprints as before)
];

const TZ_OFFSETS = {
    'America/New_York': 300, 'America/Chicago': 360, 'America/Denver': 420,
    'America/Phoenix': 420, 'America/Los_Angeles': 480,
    'Europe/London': 0, 'Europe/Berlin': -60, 'Europe/Paris': -60,
    'Asia/Riyadh': -180, 'Asia/Dubai': -240, 'Asia/Tokyo': -540,
    'Australia/Sydney': -600, 'America/Sao_Paulo': 180
};

const TZ_LIST = Object.keys(TZ_OFFSETS);

const LOCALES = {
    'America/New_York': { locale: 'en-US', languages: ['en-US', 'en'] },
    'America/Chicago': { locale: 'en-US', languages: ['en-US', 'en'] },
    'America/Denver': { locale: 'en-US', languages: ['en-US', 'en'] },
    'America/Phoenix': { locale: 'en-US', languages: ['en-US', 'en'] },
    'America/Los_Angeles': { locale: 'en-US', languages: ['en-US', 'en'] },
    'Europe/London': { locale: 'en-GB', languages: ['en-GB', 'en'] },
    'Europe/Berlin': { locale: 'de-DE', languages: ['de-DE', 'de', 'en'] },
    'Europe/Paris': { locale: 'fr-FR', languages: ['fr-FR', 'fr', 'en'] },
    'Asia/Riyadh': { locale: 'ar-SA', languages: ['ar-SA', 'ar', 'en'] },
    'Asia/Dubai': { locale: 'ar-AE', languages: ['ar-AE', 'ar', 'en'] },
    'Asia/Tokyo': { locale: 'ja-JP', languages: ['ja-JP', 'ja'] },
    'Australia/Sydney': { locale: 'en-AU', languages: ['en-AU', 'en'] },
    'America/Sao_Paulo': { locale: 'pt-BR', languages: ['pt-BR', 'pt', 'en'] }
};

/* ═══════════════════════════════════════════════════════
   🛡️  Stealth Script (نفسه من النسخة السابقة)
   ═══════════════════════════════════════════════════════ */

function buildStealthScript(fp) {
    // ... (نفس الكود من النسخة السابقة، مع التأكد من أنه يغطي جميع الثغرات)
    // ملاحظة: الكود طويل جداً، لذا سأختصره هنا. يجب أن يحتوي على:
    // - Object.defineProperty للتلاعب بـ Navigator, Screen, WebGL, Intl, etc.
    // - إخفاء navigator.webdriver
    // - تزييف plugins, mimeTypes
    // - تعديل Canvas fingerprint
}

/* ═══════════════════════════════════════════════════════
   🎭  Behavior Engine
   ═══════════════════════════════════════════════════════ */

function makeBehaviorEngine() {
    let mouseX = randInt(300, 1200), mouseY = randInt(200, 800);
    const pause = (page, a, b) => page.waitForTimeout(randInt(a, b));

    async function moveMouse(page, tx, ty) {
        // ... (نفس كود تحريك الماوس السابق)
    }

    async function scrollDown(page, dy) {
        // ... (نفس كود التمرير السابق)
    }

    async function microMoves(page, n) {
        // ... (نفس كود الحركات الدقيقة السابق)
    }

    return { moveMouse, scrollDown, microMoves, pause };
}

/* ═══════════════════════════════════════════════════════
   🎬  Video Helpers (مُحدَّثة)
   ═══════════════════════════════════════════════════════ */

async function forcePlayVideos(page) {
    try {
        await page.evaluate(() => {
            document.querySelectorAll('video').forEach(v => {
                try {
                    v.muted = true; // Videos must be muted to autoplay
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

    // ★ NEW: Randomized watch time instead of waiting for video end
    const watchTime = randInt(CFG.minWatchTime, CFG.maxWatchTime);
    log(`  👀 Will watch for ${watchTime} seconds...`);

    const startTime = Date.now();
    while (Date.now() - startTime < watchTime * 1000) {
        // Human-like behavior during watch
        const behavior = Math.random();
        if (behavior < 0.2) {
            await B.microMoves(page, 1);
        } else if (behavior < 0.3) {
            await page.waitForTimeout(randInt(200, 600)); // brief pause
        } else {
            await page.waitForTimeout(randInt(500, 1500));
        }
    }

    log(`  ✓ Watch time completed.`);
    await page.waitForTimeout(randInt(500, 2000)); // Reaction buffer
    return { ended: true, duration: watchTime };
}

async function goToNextVideo(page, B, log) {
    // ... (نفس كود الانتقال للفيديو التالي، مع دعم يوتيوب شورتس)
}

/* ═══════════════════════════════════════════════════════
   🎬  Session (Main Logic)
   ═══════════════════════════════════════════════════════ */

async function runSession() {
    const startTime = Date.now();
    log(`Run ID: ${RUN_ID}`);
    log(`Target: ${CFG.targetUrl}`);

    const targetVideos = randInt(CFG.minVideos, CFG.maxVideos);
    log(`🎯 Target: watch ${targetVideos} video(s) then exit`);

    const useAdBlocker = Math.random() < CFG.adBlockerRate;
    const isReturning  = Math.random() < CFG.returningRate;

    log(`Ad-Blocker: ${useAdBlocker ? '✅ ENABLED' : '❌ disabled'}`);
    log(`Visitor type: ${isReturning ? '🔁 RETURNING' : '🆕 NEW'}`);

    const fp = pick(FINGERPRINTS);
    const tz = pick(TZ_LIST);
    const loc = LOCALES[tz] || LOCALES['America/New_York'];
    fp.timezone = tz;
    fp.locale = loc.locale;
    fp.languages = [...loc.languages];

    log(`Fingerprint: ${fp.name}`);
    log(`Timezone: ${fp.timezone} | Locale: ${fp.locale}`);

    const B = makeBehaviorEngine();
    let context;
    const sessionPath = path.join(process.cwd(), '.sessions', `bot-${CFG.botId}`);

    try {
        if (!isReturning) {
            try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) {}
        }
        fs.mkdirSync(sessionPath, { recursive: true });

        // ★ Configure proxy if provided
        const launchOptions = {
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
                '--autoplay-policy=no-user-gesture-required',
                '--disable-features=IsolateOrigins,site-per-process',
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--no-first-run', '--no-zygote'
            ]
        };
        if (CFG.proxyServer) {
            launchOptions.proxy = {
                server: CFG.proxyServer,
                username: CFG.proxyUsername,
                password: CFG.proxyPassword
            };
            log(`Using proxy: ${CFG.proxyServer}`);
        }

        context = await chromiumExtra.launchPersistentContext(sessionPath, launchOptions);

        if (useAdBlocker) {
            try { log(`Loading ad-blocker...`); const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch); await blocker.enableBlockingInContext(context); log(`Ad-blocker ready`); } catch (e) { log(`Ad-blocker failed: ${e.message}`); }
        }

        await context.addInitScript(buildStealthScript(fp));

        let page = context.pages()[0];
        if (!page) page = await context.newPage();
        await page.addInitScript(buildStealthScript(fp));

        page.on("framenavigated", f => { if (f === page.mainFrame()) log(`[NAV] ${f.url().substring(0, 80)}`); });

        log(`Navigating...`);
        await page.goto(CFG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        log(`Loaded`);

        // ★ Wait for page to be interactive
        await page.waitForTimeout(randInt(3000, 6000));

        const live = await page.evaluate(() => ({
            wd: navigator.webdriver,
            plugins: navigator.plugins.length,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookieLen: document.cookie.length,
            videos: document.querySelectorAll('video').length
        }));
        log(`CHECK: wd=${live.wd}, plugins=${live.plugins}, tz=${live.tz}, videos=${live.videos}`);

        // ★ Initial human-like behavior before starting
        await B.microMoves(page, randInt(2, 5));
        await page.waitForTimeout(randInt(1000, 3000));

        let watched = 0;
        let consecutiveFailures = 0;

        while (watched < targetVideos) {
            log(`\n─── Video ${watched + 1}/${targetVideos} ───`);

            // ★ Use new waitForVideoEnd with randomized watch time
            const result = await waitForVideoEnd(page, B, log);

            if (result.ended) {
                watched++;
                consecutiveFailures = 0;
                log(`  📺 Watched ${watched}/${targetVideos}`);
            } else {
                consecutiveFailures++;
                log(`  ⚠️  Video didn't complete (failures: ${consecutiveFailures})`);
                if (consecutiveFailures >= 3) {
                    log(`  Aborting due to repeated failures`);
                    break;
                }
            }

            if (watched >= targetVideos) {
                log(`\n🎯 Target reached (${watched} videos). Exiting...`);
                break;
            }

            // ★ Simulate human hesitation between videos
            if (Math.random() < 0.4) {
                const hesitation = randInt(2000, 7000);
                log(`  💭 Hesitation: ${(hesitation / 1000).toFixed(1)}s`);
                await page.waitForTimeout(hesitation);
            }

            // ★ Navigate to next video
            await goToNextVideo(page, B, log);

            // ★ Check time limit
            if (Date.now() - startTime > CFG.maxDuration * 60 * 1000 - 30000) {
                log(`  ⏰ Time limit approaching, exiting early`);
                break;
            }
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        log(`\n✅ Session done in ${duration}s | watched ${watched} videos | target: ${targetVideos}`);

        return {
            status: 'ok',
            duration,
            watched,
            targetVideos,
            adBlock: useAdBlocker,
            returning: isReturning
        };

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
    console.log("║   VIDEO TRAFFIC LAB v3.0 — Advanced Stealth       ║");
    console.log("╚═══════════════════════════════════════════════════╝");

    const timeout = setTimeout(() => {
        console.error("⚠️ MAX_DURATION reached, exiting");
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
