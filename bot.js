/**
 * Video Traffic Lab v6.0 — Debug Edition
 * ─────────────────────────────────────────────────────────────
 * - NO proxies (uses GitHub Actions IPs directly)
 * - REAL video playback detection (monitors currentTime)
 * - Removes the pause-causing click
 * - Detailed debug logging every 5 seconds
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
    targetUrl:          process.env.TARGET_URL          || "https://www.youtube.com/watch?v=wktmRDfYc5k",
    botId:              process.env.BOT_ID              || "1",
    maxDuration:        parseInt(process.env.MAX_DURATION_MINUTES || "8", 10),
    targetWatchTime:    parseInt(process.env.TARGET_WATCH_TIME || "45", 10),
    minWatches:         parseInt(process.env.MIN_VIDEOS || "1", 10),
    maxWatches:         parseInt(process.env.MAX_VIDEOS || "3", 10),
    verifyIntervalMs:   5000,
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
   🧬  Fingerprint bases
   ═══════════════════════════════════════════════════════ */

const FINGERPRINTS = [
    { name: "Win-Intel-UHD630",   userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8,  memory: 8,  colorDepth: 24, dsf: 1, timezone: 'America/New_York',  locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Win-NVIDIA-RTX3060", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1536, height: 864 },  screen: { width: 1536, height: 864 },  gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, memory: 16, colorDepth: 24, dsf: 1, timezone: 'America/Chicago',  locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Mac-M1",             userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",     platform: "MacIntel", viewport: { width: 1512, height: 945 },  screen: { width: 1512, height: 945 },  gpuVendor: "Google Inc. (Apple)",  gpuRenderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)", cores: 8,  memory: 8,  colorDepth: 30, dsf: 2, timezone: 'America/Los_Angeles', locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Win-Intel-Iris-Xe",  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 16, memory: 32, colorDepth: 24, dsf: 1, timezone: 'Europe/London', locale: 'en-GB', languages: ['en-GB', 'en'] },
];

/* ═══════════════════════════════════════════════════════
   🎬  Video helpers
   ═══════════════════════════════════════════════════════ */

async function getVideoState(page) {
    return await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return { exists: false };

        // Pick the largest video (main player)
        let main = videos[0];
        let maxArea = 0;
        for (const v of videos) {
            const r = v.getBoundingClientRect();
            const area = r.width * r.height;
            if (area > maxArea) { maxArea = area; main = v; }
        }

        return {
            exists: true,
            count: videos.length,
            paused: main.paused,
            muted: main.muted,
            currentTime: main.currentTime,
            duration: isFinite(main.duration) ? main.duration : 0,
            readyState: main.readyState,
            ended: main.ended,
            playbackRate: main.playbackRate
        };
    });
}

async function forcePlayVideo(page) {
    return await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        let results = [];
        videos.forEach(v => {
            try {
                v.muted = true;
                v.playsInline = true;
                const p = v.play();
                if (p && p.catch) p.catch(e => results.push(e.message));
            } catch (e) { results.push(e.message); }
        });
        return { count: videos.length, errors: results };
    });
}

/* ═══════════════════════════════════════════════════════
   🎬  Real video watch (with verification)
   ═══════════════════════════════════════════════════════ */

async function watchVideo(page, log) {
    log(`  ▶ Starting watch...`);

    // Step 1: Force play
    const playResult = await forcePlayVideo(page);
    log(`  Force play: ${playResult.count} video(s), errors: ${playResult.errors.length}`);

    // Step 2: Wait a moment
    await page.waitForTimeout(2000);

    // Step 3: Verify video is playing
    let state = await getVideoState(page);
    log(`  Initial state: paused=${state.paused}, time=${state.currentTime?.toFixed(1)}s, readyState=${state.readyState}, muted=${state.muted}`);

    if (!state.exists) {
        log(`  ❌ No video element found`);
        return { success: false, reason: 'no_video' };
    }

    if (state.paused) {
        log(`  ⚠️  Video still paused, retrying play...`);
        await forcePlayVideo(page);
        await page.waitForTimeout(2000);
        state = await getVideoState(page);
        log(`  After retry: paused=${state.paused}, time=${state.currentTime?.toFixed(1)}s`);
    }

    if (state.paused) {
        log(`  ❌ Video won't play`);
        return { success: false, reason: 'cannot_play' };
    }

    // Step 4: Monitor video for target time — with REAL verification
    const startTime = Date.now();
    const startVideoTime = state.currentTime;
    const targetMs = CFG.targetWatchTime * 1000;
    let lastCheck = 0;
    let frozenCount = 0;

    log(`  👀 Monitoring for ${CFG.targetWatchTime}s (checking every ${CFG.verifyIntervalMs / 1000}s)...`);

    while (Date.now() - startTime < targetMs) {
        await page.waitForTimeout(CFG.verifyIntervalMs);

        const s = await getVideoState(page).catch(() => null);
        if (!s || !s.exists) {
            log(`  ⚠️  Video element disappeared`);
            frozenCount++;
            continue;
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const videoProgress = (s.currentTime - startVideoTime).toFixed(1);

        log(`     [${elapsed}s] currentTime=${s.currentTime.toFixed(1)}s (+${videoProgress}s), paused=${s.paused}, ended=${s.ended}`);

        // ⭐ Check if video is actually progressing
        if (s.paused || s.ended) {
            log(`     ⚠️  Video paused/ended at ${s.currentTime.toFixed(1)}s`);
            if (s.ended) break;
            // Try to resume
            await forcePlayVideo(page);
        }

        // Check if currentTime is stuck (frozen)
        if (s.currentTime === lastCheck && !s.paused) {
            frozenCount++;
            log(`     ⚠️  Frozen counter: ${frozenCount}`);
            if (frozenCount >= 3) {
                log(`     ❌ Video frozen, aborting`);
                return { success: false, reason: 'frozen', watched: s.currentTime - startVideoTime };
            }
        } else {
            frozenCount = 0;
        }
        lastCheck = s.currentTime;
    }

    const finalState = await getVideoState(page);
    const actualWatched = finalState.currentTime - startVideoTime;

    log(`  ✓ Watch phase done | actual video progress: ${actualWatched.toFixed(1)}s`);

    if (actualWatched < 5) {
        log(`  ⚠️  Video only progressed ${actualWatched.toFixed(1)}s — not enough`);
        return { success: false, reason: 'insufficient_playback', watched: actualWatched };
    }

    return {
        success: true,
        watched: actualWatched,
        duration: finalState.duration
    };
}

/* ═══════════════════════════════════════════════════════
   🎬  Session
   ═══════════════════════════════════════════════════════ */

async function runSession() {
    const startTime = Date.now();
    log(`Run ID: ${RUN_ID}`);
    log(`Target: ${CFG.targetUrl}`);

    const fp = pick(FINGERPRINTS);
    log(`Fingerprint: ${fp.name}`);
    log(`Timezone: ${fp.timezone} | Locale: ${fp.locale}`);

    const targetWatches = randInt(CFG.minWatches, CFG.maxWatches);
    log(`🎯 Target: ${targetWatches} reload(s) of the video`);

    const B = {
        microMoves: async (page, n) => {
            for (let i = 0; i < n; i++) {
                const x = randInt(200, 1500);
                const y = randInt(200, 800);
                await page.mouse.move(x, y);
                await page.waitForTimeout(randInt(100, 400));
            }
        }
    };

    let context;
    const sessionPath = path.join(process.cwd(), '.sessions', `bot-${CFG.botId}`);

    try {
        fs.mkdirSync(sessionPath, { recursive: true });

        log(`Launching browser (NO proxy)...`);

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
                '--autoplay-policy=no-user-gesture-required',
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--no-first-run', '--no-zygote'
            ]
        });

        let page = context.pages()[0];
        if (!page) page = await context.newPage();

        log(`Navigating...`);
        await page.goto(CFG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        log(`Loaded`);

        // Wait for video player to be ready
        await page.waitForTimeout(randInt(4000, 7000));

        // Diagnostics
        const diag = await page.evaluate(() => ({
            wd: navigator.webdriver,
            plugins: navigator.plugins.length,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            lang: navigator.language,
            videos: document.querySelectorAll('video').length,
            url: location.href
        }));
        log(`CHECK: wd=${diag.wd}, plugins=${diag.plugins}, tz=${diag.tz}, lang=${diag.lang}, videos=${diag.videos}`);

        let successCount = 0;

        for (let i = 1; i <= targetWatches; i++) {
            log(`\n═══ Watch ${i}/${targetWatches} ═══`);

            if (i > 1) {
                log(`  🔄 Reloading...`);
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(randInt(4000, 7000));
            }

            const result = await watchVideo(page, log);

            if (result.success) {
                successCount++;
                log(`  ✅ Watch ${i} succeeded (${result.watched.toFixed(1)}s)`);
            } else {
                log(`  ❌ Watch ${i} failed: ${result.reason}`);
            }

            // Delay before next
            if (i < targetWatches) {
                const delay = randInt(4000, 12000);
                log(`  💭 Delay: ${(delay / 1000).toFixed(1)}s`);
                await page.waitForTimeout(delay);
            }

            if (Date.now() - startTime > CFG.maxDuration * 60 * 1000 - 30000) {
                log(`  ⏰ Time limit`);
                break;
            }
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        log(`\n✅ Session done in ${duration}s | successes: ${successCount}/${targetWatches}`);

        return { status: 'ok', duration, successCount, targetWatches };

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
    console.log("║   VIDEO TRAFFIC LAB v6.0 — Debug Edition          ║");
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
