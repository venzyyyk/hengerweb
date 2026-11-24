// Build step: copy the static site into dist/ and take fresh screenshots of every project.
import { cp, mkdir, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const dist = path.join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "shots"), { recursive: true });
// Landing projects (separate Vercel projects from this repo) set LANDING=<folder> and ship only that landing.
if (process.env.LANDING) {
  await rm(path.join(dist, "shots"), { recursive: true, force: true });
  await cp(path.join(root, "landings", process.env.LANDING), dist, { recursive: true });
  console.log("[landing] built", process.env.LANDING);
  process.exit(0);
}
await cp(path.join(root, "index.html"), path.join(dist, "index.html"));

const local = (slug) => pathToFileURL(path.join(root, "landings", slug, "index.html")).href + "?shot=1";
const TARGETS = [
  ["ps5-club", local("ps5-club")],
  ["karting", local("karting")],
  ["dental", local("dental")],
  ["barber", local("barber")],
  ["coffee", local("coffee")],
];

let browser;
try {
  if (process.env.CHROME_PATH) {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
  } else {
    const chromium = (await import("@sparticuz/chromium")).default;
    browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
} catch (e) {
  console.warn("[shots] browser unavailable, site ships without screenshots:", e.message);
  process.exit(0);
}

for (const [name, url] of TARGETS) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1440, height: 945, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 5000)); // let intro loaders and reveal animations finish
    await page.screenshot({ path: path.join(dist, "shots", name + ".webp"), type: "webp", quality: 82 });
    console.log("[shots] ok", name);
  } catch (e) {
    console.warn("[shots] skip", name, e.message);
  } finally {
    await page.close();
  }
}
await browser.close();
