/**
 * Video Traffic Lab v2.0 — TikTok-Style
 * ─────────────────────────────────────────────────────────────
 * Mimics TikTok/Snapchat viewing behavior:
 *   • Vertical full-screen video scroll
 *   • Auto-play videos (muted)
 *   • Watch video until it ends
 *   • Swipe/scroll to next video
 *   • Random exit after N videos (1-10)
 *   • Occasional like/rewatch behavior
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
    targetUrl:          process.env.TARGET_URL          || "https://www.tiktok.com/@candyblast44/video/7671386366139239687/",
    botId:              process.env.BOT_ID              || "1",
    maxDuration:        parseInt(process.env.MAX_DURATION_MINUTES || "8", 10),
    adBlockerRate:      parseFloat(process.env.ADBLOCKER_RATE || "0.20"),
    returningRate:      parseFloat(process.env.RETURNING_RATE || "0.30"),
    minVideos:          parseInt(process.env.MIN_VIDEOS || "1", 10),
    maxVideos:          parseInt(process.env.MAX_VIDEOS || "10", 10),
    videoWaitBuffer:    parseInt(process.env.VIDEO_WAIT_BUFFER || "3", 10),
    maxVideoDuration:   parseInt(process.env.MAX_VIDEO_DURATION || "90", 10)
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
   🧬  Fingerprints
   ═══════════════════════════════════════════════════════ */

const FINGERPRINTS = [
    { name: "Win-Intel-UHD630", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, gpuVendor: "Google Inc. (Intel)", gpuRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8, memory: 8, colorDepth: 24, dsf: 1 },
    { name: "Win-NVIDIA-RTX3060", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 1536, height: 864 }, screen: { width: 1536, height: 864 }, gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 12, memory: 16, colorDepth: 24, dsf: 1 },
    { name: "Mac-M1", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "MacIntel", viewport: { width: 1512, height: 945 }, screen: { width: 1512, height: 945 }, gpuVendor: "Google Inc. (Apple)", gpuRenderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)", cores: 8, memory: 8, colorDepth: 30, dsf: 2 },
    { name: "Win-Intel-Iris-Xe", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 }, gpuVendor: "Google Inc. (Intel)", gpuRenderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 16, memory: 32, colorDepth: 24, dsf: 1 },
    { name: "Win-AMD-RX6600", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 1366, height: 768 }, screen: { width: 1366, height: 768 }, gpuVendor: "Google Inc. (AMD)", gpuRenderer: "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 6, memory: 8, colorDepth: 24, dsf: 1 },
    { name: "Win-NVIDIA-GTX1650", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 1360, height: 768 }, screen: { width: 1360, height: 768 }, gpuVendor: "Google Inc. (NVIDIA)", gpuRenderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8, memory: 16, colorDepth: 24, dsf: 1 },
    { name: "Mac-Intel-Iris-Plus", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", platform: "MacIntel", viewport: { width: 1680, height: 1050 }, screen: { width: 1680, height: 1050 }, gpuVendor: "Google Inc. (Intel)", gpuRenderer: "ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)", cores: 4, memory: 8, colorDepth: 30, dsf: 2 },
    { name: "Win-AMD-Vega8", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", platform: "Win32", viewport: { width: 1600, height: 900 }, screen: { width: 1600, height: 900 }, gpuVendor: "Google Inc. (AMD)", gpuRenderer: "ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8, memory: 8, colorDepth: 24, dsf: 1 }
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
   🎬  TikTok-Style Video Helpers
   ═══════════════════════════════════════════════════════ */

/**
 * Force all videos to play (muted, to bypass autoplay policies)
 */
async function forcePlayVideos(page) {
    try {
        await page.evaluate(() => {
            const videos = Array.from(document.querySelectorAll('video'));
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

/**
 * Get info about the currently visible/active video
 */
async function getActiveVideoInfo(page) {
    return await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return { count: 0 };

        // Pick the most prominent (largest + most visible) video
        let target = null;
        let bestScore = 0;
        for (const v of videos) {
            const r = v.getBoundingClientRect();
            if (r.width < 100 || r.height < 100) continue;
            // Check if visible in viewport
            const visible = r.top < window.innerHeight && r.bottom > 0;
            if (!visible) continue;
            const score = r.width * r.height;
            if (score > bestScore) {
                bestScore = score;
                target = v;
            }
        }
        if (!target) target = videos[0];

        const r = target.getBoundingClientRect();
        return {
            count: videos.length,
            duration: isFinite(target.duration) ? target.duration : 0,
            currentTime: target.currentTime || 0,
            paused: target.paused,
            muted: target.muted,
            readyState: target.readyState,
            ended: target.ended,
            rect: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }
        };
    });
}

/**
 * Wait for the current video to finish (TikTok-style: watches until end)
 */
async function waitForVideoEnd(page, B, log) {
    log(`  ▶ Waiting for video...`);

    // Force play
    await forcePlayVideos(page);
    await page.waitForTimeout(1500);

    let info = await getActiveVideoInfo(page);
    log(`  Video: count=${info.count}, duration=${info.duration.toFixed(1)}s, paused=${info.paused}, readyState=${info.readyState}`);

    if (info.count === 0) {
        log(`  ! No video found, waiting 5s`);
        await page.waitForTimeout(5000);
        return { ended: false, reason: 'no_video' };
    }

    // If still paused, try clicking the video (like a user would tap)
    if (info.paused) {
        log(`  Video paused, clicking to play...`);
        const cx = info.rect.left + info.rect.w / 2;
        const cy = info.rect.top + info.rect.h / 2;
        try {
            await B.moveMouse(page, cx, cy);
            await page.mouse.click(cx, cy);
            await page.waitForTimeout(1500);
            await forcePlayVideos(page);
        } catch (e) {}
    }

    // Max wait time
    const videoDuration = info.duration > 0 ? info.duration : 15;
    const maxWait = Math.min(videoDuration * 1000, CFG.maxVideoDuration * 1000) + CFG.videoWaitBuffer * 1000;
    log(`  Max wait: ${(maxWait / 1000).toFixed(1)}s`);

    const startTime = Date.now();
    let lastReported = 0;
    let ended = false;

    while (Date.now() - startTime < maxWait) {
        // Human-like behavior while watching
        const behavior = Math.random();
        if (behavior < 0.1) {
            // Small mouse movement
            await B.microMoves(page, 1);
        } else if (behavior < 0.15) {
            // Brief pause/attention shift
            await page.waitForTimeout(randInt(300, 800));
        } else {
            await page.waitForTimeout(randInt(400, 1200));
        }

        // Check video status
        const status = await getActiveVideoInfo(page).catch(() => null);
        if (!status) continue;

        // Report progress every 5 seconds
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed > 0 && elapsed % 5 === 0 && elapsed !== lastReported) {
            log(`     Progress: ${status.currentTime.toFixed(1)}s / ${status.duration.toFixed(1)}s (${elapsed}s elapsed)`);
            lastReported = elapsed;
        }

        // Video ended?
        if (status.ended || (status.duration > 0 && status.currentTime >= status.duration - 0.3)) {
            ended = true;
            log(`  ✓ Video ended (${status.currentTime.toFixed(1)}s / ${status.duration.toFixed(1)}s)`);
            break;
        }

        // Video element changed (next video auto-loaded)
        if (status.duration === 0 && status.currentTime === 0 && elapsed > 3) {
            log(`  ⚡ New video detected`);
            ended = true;
            break;
        }
    }

    if (!ended) {
        log(`  ! Timeout reached (max ${(maxWait / 1000).toFixed(0)}s)`);
    }

    // Human reaction buffer
    await page.waitForTimeout(randInt(500, 1800));

    return { ended, duration: info.duration };
}

/**
 * Go to next video — TikTok style
 * Tries multiple methods: ArrowDown key, scroll, swipe gesture, or "next" button
 */
async function goToNextVideo(page, B, log) {
    // Weighted: ArrowDown is most common on TikTok
    const methods = ['keydown', 'keydown', 'keydown', 'scroll', 'swipe', 'button'];
    const method = pick(methods);

    log(`  ⏭️  Next video via: ${method}`);

    try {
        if (method === 'keydown') {
            // TikTok: ArrowDown moves to next video
            const key = pick(['ArrowDown', 'ArrowDown', 'ArrowDown', 'PageDown', 'j']);
            await page.keyboard.press(key);
            await page.waitForTimeout(randInt(1200, 2200));

        } else if (method === 'scroll') {
            // Scroll down by viewport height
            const vp = page.viewportSize();
            const scrollAmount = vp.height;

            await page.evaluate((amount) => {
                // Find the scrollable container
                const containers = [];
                const candidates = document.querySelectorAll('[class*="scroll"], [class*="feed"], main, #main, #app, body');
                for (const el of candidates) {
                    if (el.scrollHeight > el.clientHeight + 50) {
                        containers.push(el);
                    }
                }
                if (containers.length > 0) {
                    containers[0].scrollBy({ top: amount, behavior: 'smooth' });
                } else {
                    window.scrollBy({ top: amount, behavior: 'smooth' });
                }
            }, scrollAmount);

            await page.waitForTimeout(randInt(1500, 2500));

        } else if (method === 'swipe') {
            // Mobile-style swipe up
            const vp = page.viewportSize();
            const startX = vp.width / 2;
            const startY = vp.height * 0.75;
            const endY = vp.height * 0.25;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            const steps = 12;
            for (let i = 1; i <= steps; i++) {
                const y = startY + (endY - startY) * (i / steps);
                await page.mouse.move(startX, y);
                await page.waitForTimeout(randInt(15, 35));
            }
            await page.mouse.up();
            await page.waitForTimeout(randInt(1500, 2500));

        } else if (method === 'button') {
            // Look for "next" button
            const clicked = await page.evaluate(() => {
                const selectors = [
                    'button[data-e2e*="arrow-down"]',
                    'button[data-e2e*="next"]',
                    'button[aria-label*="next" i]',
                    'button[aria-label*="down" i]',
                    '[class*="ArrowDown"]',
                    '[class*="arrow-down"]',
                    '[class*="NextButton"]'
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetParent !== null) {
                        el.click();
                        return sel;
                    }
                }
                return null;
            });
            if (clicked) {
                log(`     Clicked: ${clicked}`);
            } else {
                log(`     No button found, using ArrowDown`);
                await page.keyboard.press('ArrowDown');
            }
            await page.waitForTimeout(randInt(1500, 2500));
        }

        // Wait for next video to settle
        await page.waitForTimeout(randInt(800, 1800));

        // Force play the new video
        await forcePlayVideos(page);

        return true;

    } catch (e) {
        log(`  ! Next video error: ${e.message}`);
        return false;
    }
}

/**
 * Optional: simulate a "like" occasionally
 */
async function maybeLike(page, B, log) {
    if (Math.random() > 0.15) return; // 15% chance
    try {
        const liked = await page.evaluate(() => {
            const selectors = [
                '[data-e2e*="like"]',
                'button[aria-label*="like" i]',
                '[class*="LikeButton"]',
                '[class*="like-button"]'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.top > 0 && r.top < window.innerHeight) {
                        el.click();
                        return true;
                    }
                }
            }
            return false;
        });
        if (liked) log(`  💗 Liked (random)`);
    } catch (e) {}
}

/* ═══════════════════════════════════════════════════════
   🎬  Session
   ═══════════════════════════════════════════════════════ */

async function runSession() {
    const startTime = Date.now();
    log(`Run ID: ${RUN_ID}`);
    log(`Target: ${CFG.targetUrl}`);

    // ⭐ Random target: watch N videos before exiting
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

        // ⭐ Navigate to site
        log(`Navigating...`);
        await page.goto(CFG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        log(`Loaded`);

        // ⭐ Verify environment
        const live = await page.evaluate(() => ({
            wd: navigator.webdriver,
            plugins: navigator.plugins.length,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookieLen: document.cookie.length,
            videos: document.querySelectorAll('video').length
        }));
        log(`CHECK: wd=${live.wd}, plugins=${live.plugins}, tz=${live.tz}, videos=${live.videos}`);

        // ⭐ Wait for initial page load / video autoplay
        const initialWait = isReturning ? randInt(1500, 3500) : randInt(2500, 6000);
        log(`Initial wait: ${(initialWait / 1000).toFixed(1)}s`);
        await B.microMoves(page, randInt(1, 3));
        await page.waitForTimeout(initialWait);

        // Force play first video
        await forcePlayVideos(page);

        // ⭐ Watch videos loop
        let watched = 0;
        let consecutiveFailures = 0;
        let noVideoCount = 0;

        while (watched < targetVideos) {
            log(`\n─── Video ${watched + 1}/${targetVideos} ───`);

            // Wait for current video to end
            const result = await waitForVideoEnd(page, B, log);

            if (result.ended) {
                watched++;
                consecutiveFailures = 0;
                log(`  📺 Watched ${watched}/${targetVideos}`);
            } else {
                consecutiveFailures++;
                log(`  ⚠️  Video didn't end (failures: ${consecutiveFailures})`);
                // Still count as "watched" if some time passed
                if (result.duration > 0 || result.reason !== 'no_video') {
                    watched++;
                }
                if (consecutiveFailures >= 3) {
                    log(`  Aborting due to repeated failures`);
                    break;
                }
            }

            // ⭐ Reached target? Exit.
            if (watched >= targetVideos) {
                log(`\n🎯 Target reached (${watched} videos). Exiting...`);
                break;
            }

            // ⭐ Optional like
            await maybeLike(page, B, log);

            // ⭐ Move to next video (TikTok-style)
            await goToNextVideo(page, B, log);

            // ⭐ Occasionally "hesitate" between videos (like a real user)
            if (Math.random() < 0.25) {
                const hesitation = randInt(2000, 6000);
                log(`  💭 Hesitation: ${(hesitation / 1000).toFixed(1)}s`);
                await page.waitForTimeout(hesitation);
            }

            // ⭐ Safety: check time
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
    console.log("║   VIDEO TRAFFIC LAB v2.0 — TikTok-Style          ║");
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
