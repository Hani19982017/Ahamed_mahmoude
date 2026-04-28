import puppeteer from "puppeteer-core";
import { existsSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * PDF generator using puppeteer-core.
 *
 * puppeteer-core does NOT bundle a Chromium binary, so we have to point it
 * at one. We try (in order):
 *
 *   1. CHROMIUM_PATH environment variable, if set
 *   2. On Linux ONLY: @sparticuz/chromium (already in package.json) —
 *      a serverless-friendly Chromium binary. Works on Render, Railway,
 *      AWS Lambda, etc. Skipped on Windows/macOS because that package
 *      is Linux-only and gives a fake path elsewhere.
 *   3. Common system Chrome / Chromium / Edge locations for the host OS
 *
 * If none of these resolves, throws a clear error.
 */

function isExecutableFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

async function resolveExecutablePath(): Promise<string> {
  // 1. Explicit override from the environment
  const envPath = process.env.CHROMIUM_PATH;
  if (envPath && isExecutableFile(envPath)) {
    return envPath;
  }

  const os = platform();

  // 2. @sparticuz/chromium is a Linux-only package. Only try it on Linux.
  if (os === "linux") {
    try {
      const sparticuz = await import("@sparticuz/chromium");
      const chromium = (sparticuz as any).default ?? sparticuz;
      if (typeof chromium.executablePath === "function") {
        const path = await chromium.executablePath();
        if (path && isExecutableFile(path)) {
          return path;
        }
      }
    } catch {
      // Module not installed or failed to load — fall through.
    }
  }

  // 3. Common system locations per OS
  const candidates: string[] = [];

  if (os === "win32") {
    const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
    const programFilesX86 =
      process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    const localAppData =
      process.env["LOCALAPPDATA"] ?? join(homedir(), "AppData", "Local");

    candidates.push(
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(programFiles, "Chromium", "Application", "chrome.exe"),
    );
  } else if (os === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    // Linux fallbacks (when @sparticuz/chromium is unavailable)
    candidates.push(
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/snap/bin/chromium",
    );
  }

  for (const path of candidates) {
    if (isExecutableFile(path)) {
      return path;
    }
  }

  throw new Error(
    `PDF generator could not find a Chromium binary on ${os}. ` +
    "Install Google Chrome or Microsoft Edge, or set the CHROMIUM_PATH " +
    "environment variable to a Chromium/Chrome executable. " +
    "On Windows, the typical path is " +
    "'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe'.",
  );
}

export interface PDFGenerationOptions {
  format?: "A4" | "Letter";
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  preferCSSPageSize?: boolean;
}

export async function generatePDF(
  html: string,
  options: PDFGenerationOptions = {},
): Promise<Buffer> {
  const executablePath = await resolveExecutablePath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: options.format ?? "A4",
      printBackground: true,
      preferCSSPageSize: options.preferCSSPageSize ?? false,
      margin: {
        top: options.margin?.top ?? "20mm",
        right: options.margin?.right ?? "15mm",
        bottom: options.margin?.bottom ?? "20mm",
        left: options.margin?.left ?? "15mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
