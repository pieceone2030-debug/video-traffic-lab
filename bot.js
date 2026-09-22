/**
 * Social Traffic Lab v1.0 — X (Twitter) + Snapchat Embed
 * ─────────────────────────────────────────────────────────────
 * Opens a specific X post, clicks on it to activate the
 * embedded Snapchat content, and simulates human behavior.
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
    targetUrl:          process.env.TARGET_URL          || "https://x.com/MDL14037628/status/2102423596169634184",
    botId:              process.env.BOT_ID              || "1",
    maxDuration:        parseInt(process.env.MAX_DURATION_MINUTES || "8", 10),
    // X-specific settings
    clickOnPost:        true,          // click on the post to activate embed
    minInteractions:    2,              // minimum number of clicks/scrolls
    maxInteractions:    5,              // maximum number of clicks/scrolls
    minWaitAfterClick:  3000,           // ms
    maxWaitAfterClick:  8000,           // ms
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
   🧬  Fingerprint base (5 profiles)
   ═══════════════════════════════════════════════════════ */

const FINGERPRINTS = [
    { name: "Win-Intel-UHD630",   userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8,  memory: 8,  colorDepth: 24, dsf: 1, timezone: 'America/New_York',  locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Win-NVIDIA-RTX3060", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 1536, height: 864 },  screen: { width: 1536, height: 864 },  gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, memory: 16, colorDepth: 24, dsf: 1, timezone: 'America/Chicago',  locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Mac-M1",             userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",     platform: "MacIntel", viewport: { width: 1512, height: 945 },  screen: { width: 1512, height: 945 },  gpuVendor: "Google Inc. (Apple)",  gpuRenderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)", cores: 8,  memory: 8,  colorDepth: 30, dsf: 2, timezone: 'America/Los_Angeles', locale: 'en-US', languages: ['en-US', 'en'] },
    { name: "Win-Intel-Iris-Xe",  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", platform: "Win32",    viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 }, gpuVendor: "Google Inc. (Intel)",  gpuRenderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 16, memory: 32, colorDepth: 24, dsf: 1, timezone: 'Europe/London', locale: 'en-GB', languages: ['en-GB', 'en'] },
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

    async function scrollDown(page, dy) {
        const chunks = randInt(3, 6);
        for (let i = 0; i < chunks; i++) {
            await page.mouse.wheel(0, dy / chunks + (Math.random() - 0.5) * 30);
            await page.waitForTimeout(randInt(35, 110));
        }
    }

    return { moveMouse, microMoves, scrollDown, pause };
}

/* ═══════════════════════════════════════════════════════
   🎬  X (Twitter) Interaction Helpers
   ═══════════════════════════════════════════════════════ */

/**
 * Find and click the main post content to activate embed.
 * X posts often need a click on the media area to load embeds.
 */
async function clickOnPostContent(page, B, log) {
    log(`  🖱️  Looking for post content to click...`);

    // Try multiple selectors that X uses for post media/content
    const selectors = [
        '[data-testid="tweetPhoto"]',           // photo
        '[data-testid="videoPlayer"]',           // video
        'article[data-testid="tweet"]',          // main tweet
        '[role="article"]',                      // article role
        'div[data-testid="card.wrapper"]',       // card
        'div[data-testid="card.layoutLarge.media"]', // large media card
    ];

    for (const sel of selectors) {
        const element = await page.$(sel);
        if (element) {
            const box = await element.boundingBox();
            if (box && box.width > 100 && box.height > 100) {
                const cx = box.x + box.width * (0.3 + Math.random() * 0.4);
                const cy = box.y + box.height * (0.3 + Math.random() * 0.4);

                log(`  Found ${sel} at (${Math.round(cx)}, ${Math.round(cy)})`);

                // Human-like approach
                await B.moveMouse(page, cx, cy);
                await B.pause(page, 200, 500);
                await B.microMoves(page, randInt(1, 2));

                // Click
                await page.mouse.click(cx, cy);
                log(`  ✓ Clicked on post content`);

                // Wait for any embed to load
                await page.waitForTimeout(randInt(2000, 4000));
                return true;
            }
        }
    }

    log(`  ⚠️  No post content found`);
    return false;
}

/**
 * Wait for embedded Snapchat content to become visible.
 */
async function waitForEmbed(page, log, timeoutMs = 15000) {
    log(`  ⏳ Waiting for embedded content...`);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const hasEmbed = await page.evaluate(() => {
            // Snapchat embeds may appear as iframes, video, or specific containers
            const iframes = document.querySelectorAll('iframe');
            const videos = document.querySelectorAll('video');

            // Check for Snapchat-specific selectors
            const snapSelectors = [
                '[class*="snap"]',
                '[id*="snap"]',
                'iframe[src*="snapchat"]',
                'iframe[src*="snap"]'
            ];

            let hasSnap = false;
            for (const sel of snapSelectors) {
                if (document.querySelector(sel)) {
                    hasSnap = true;
                    break;
                }
            }

            return {
                iframes: iframes.length,
                videos: videos.length,
                hasSnap,
                url: location.href
            };
        });

        if (hasEmbed.hasSnap || hasEmbed.iframes > 0 || hasEmbed.videos > 0) {
            log(`  ✓ Embed detected: iframes=${hasEmbed.iframes}, videos=${hasEmbed.videos}, snap=${hasEmbed.hasSnap}`);
            return true;
        }

        await page.waitForTimeout(1000);
    }

    log(`  ⚠️  No embed detected within timeout`);
    return false;
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
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--no-first-run', '--no-zygote'
            ]
        });

        let page = context.pages()[0];
        if (!page) page = await context.newPage();

        // Navigate to the post
        log(`Navigating to X post...`);
        await page.goto(CFG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        log(`Loaded`);

        // Wait for page to settle
        await page.waitForTimeout(randInt(4000, 7000));

        // Diagnostics
        const diag = await page.evaluate(() => ({
            wd: navigator.webdriver,
            plugins: navigator.plugins.length,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            lang: navigator.language,
            url: location.href,
            title: document.title
        }));
        log(`CHECK: wd=${diag.wd}, plugins=${diag.plugins}, tz=${diag.tz}, lang=${diag.lang}`);
        log(`Title: ${diag.title.substring(0, 80)}`);

        // Human-like initial behavior
        await B.microMoves(page, randInt(2, 4));
        await B.pause(page, 1000, 2500);

        // Scroll slightly to mimic reading
        await B.scrollDown(page, randInt(100, 300));
        await B.pause(page, 500, 1500);

        // Click on the post to activate embed
        let clicked = false;
        if (CFG.clickOnPost) {
            clicked = await clickOnPostContent(page, B, log);
        }

        // Wait for embed to load
        if (clicked) {
            await waitForEmbed(page, log);
        }

        // Human-like interactions (scroll, pause, mouse moves)
        const interactions = randInt(CFG.minInteractions, CFG.maxInteractions);
        log(`  🎭 Performing ${interactions} human-like interactions...`);

        for (let i = 0; i < interactions; i++) {
            const action = pick(['scroll', 'mouse', 'pause']);

            if (action === 'scroll') {
                await B.scrollDown(page, randInt(150, 400));
                log(`  ⬇️  Scrolled`);
            } else if (action === 'mouse') {
                const x = randInt(200, fp.viewport.width - 200);
                const y = randInt(200, fp.viewport.height - 200);
                await B.moveMouse(page, x, y);
                log(`  🖱️  Mouse moved`);
            } else {
                log(`  ⏸️  Pausing...`);
            }

            await B.pause(page, 1000, 3000);
        }

        // Final wait before closing
        const finalWait = randInt(5000, 12000);
        log(`  ⏳ Final wait: ${(finalWait / 1000).toFixed(1)}s`);
        await page.waitForTimeout(finalWait);

        // Take a screenshot for verification (optional)
        const screenshotPath = path.join(process.cwd(), 'screenshots', `x-post-${RUN_ID}.png`);
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: false });
        log(`  📸 Screenshot saved: ${screenshotPath}`);

        const duration = Math.round((Date.now() - startTime) / 1000);
        log(`\n✅ Session done in ${duration}s`);

        return { status: 'ok', duration, clicked, interactions };

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
    console.log("║   SOCIAL TRAFFIC LAB v1.0 — X + Snapchat Embed    ║");
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
