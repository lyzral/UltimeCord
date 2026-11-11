// node render.cjs <frames dir> [fps] [only these seconds, comma separated]   (NODE_PATH = desktop/node_modules)
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const [, , out, fpsArg = "30", only] = process.argv;
const FPS = +fpsArg;

(async () => {
    const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto("file:///" + path.join(__dirname, "promo.html").replace(/\\/g, "/"));
    const duration = await page.evaluate("DURATION");
    fs.mkdirSync(out, { recursive: true });

    const times = only ? only.split(",").map(Number) : Array.from({ length: Math.round(duration * FPS) }, (_, i) => i / FPS);
    for (const [i, t] of times.entries()) {
        await page.evaluate(`seek(${t})`);
        const name = only ? `t${String(t).replace(".", "_")}.jpg` : `f${String(i).padStart(5, "0")}.jpg`;
        await page.screenshot({ path: path.join(out, name), type: "jpeg", quality: only ? 80 : 96 });
        if (!only && i % 90 === 0) console.log(`${i}/${times.length}`);
    }
    await browser.close();
    console.log("done", times.length);
})().catch(e => { console.error(e.message); process.exit(1); });
