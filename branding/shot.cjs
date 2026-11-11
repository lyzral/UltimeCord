// node shot.cjs <svg-or-html file> <out.png> <w> <h>
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const [, , src, out, w, h] = process.argv;

(async () => {
    const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
    const page = await browser.newPage();
    await page.setViewport({ width: +w, height: +h });
    const body = fs.readFileSync(src, "utf8");
    await page.setContent(`<body style="margin:0;overflow:hidden;background:transparent">${body}`);
    await page.screenshot({ path: out, omitBackground: true });
    await browser.close();
    console.log("wrote", out);
})().catch(e => { console.error(e.message); process.exit(1); });
