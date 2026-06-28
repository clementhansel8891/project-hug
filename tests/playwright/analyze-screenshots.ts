/**
 * Color Contrast & Visual Analysis of Screenshots
 * Analyzes screenshots to find:
 * 1. Text colors that are too similar to background (low contrast)
 * 2. Elements that might be invisible (same color as bg)
 * 3. Charts with poor color differentiation
 * 4. Dark-on-dark or light-on-light issues
 * 
 * Run: npx tsx tests/playwright/analyze-screenshots.ts
 */
import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";

const SCREENSHOT_DIR = "tests/playwright/screenshots/audit";

interface PixelSample {
  r: number;
  g: number;
  b: number;
}

interface PageAnalysis {
  page: string;
  theme: string;
  dominantBg: PixelSample;
  avgLuminance: number;
  issues: string[];
  severity: "ok" | "warning" | "critical";
  darkRegionsPercent: number;
  lightRegionsPercent: number;
  midtonePercent: number;
  suspectedInvisibleText: boolean;
  lowContrastAreas: number;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rr, gg, bb] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}

function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function analyzePNG(filePath: string): { 
  dominantBg: PixelSample;
  avgLuminance: number;
  darkPercent: number;
  lightPercent: number;
  midPercent: number;
  lowContrastAreas: number;
  suspectedInvisibleText: boolean;
} {
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  const { width, height } = png;
  
  let darkPixels = 0;
  let lightPixels = 0;
  let midPixels = 0;
  let totalLuminance = 0;
  let sampleCount = 0;
  
  // Sample every 10th pixel for performance
  const step = 10;
  const bgSamples: Map<string, number> = new Map();
  
  // Track regions with potential low contrast
  let lowContrastRegions = 0;
  
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      
      const lum = getLuminance(r, g, b);
      totalLuminance += lum;
      sampleCount++;
      
      if (lum < 0.1) darkPixels++;
      else if (lum > 0.8) lightPixels++;
      else midPixels++;
      
      // Quantize to track dominant colors
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      bgSamples.set(key, (bgSamples.get(key) || 0) + 1);
    }
  }
  
  // Find dominant background color
  let maxCount = 0;
  let dominantKey = "255,255,255";
  for (const [key, count] of bgSamples) {
    if (count > maxCount) {
      maxCount = count;
      dominantKey = key;
    }
  }
  const [dr, dg, db] = dominantKey.split(",").map(Number);
  
  // Check for low-contrast patterns by comparing adjacent pixel blocks
  const blockSize = 20;
  for (let by = 0; by < height - blockSize; by += blockSize * 3) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize * 3) {
      const idx1 = (by * width + bx) * 4;
      const idx2 = ((by + blockSize) * width + bx) * 4;
      
      if (idx1 < png.data.length - 4 && idx2 < png.data.length - 4) {
        const l1 = getLuminance(png.data[idx1], png.data[idx1 + 1], png.data[idx1 + 2]);
        const l2 = getLuminance(png.data[idx2], png.data[idx2 + 1], png.data[idx2 + 2]);
        const contrast = getContrastRatio(l1, l2);
        
        // Text needs at least 4.5:1 contrast (WCAG AA)
        // If we see areas with 1.5-2.5 contrast, there might be text that's hard to read
        if (contrast > 1.1 && contrast < 2.5) {
          lowContrastRegions++;
        }
      }
    }
  }
  
  const totalPixels = sampleCount;
  const darkPercent = (darkPixels / totalPixels) * 100;
  const lightPercent = (lightPixels / totalPixels) * 100;
  const midPercent = (midPixels / totalPixels) * 100;
  
  // Suspected invisible text: dark theme with >85% dark pixels or light theme with >85% light pixels
  // combined with low contrast areas
  const suspectedInvisibleText = lowContrastRegions > 50;
  
  return {
    dominantBg: { r: dr, g: dg, b: db },
    avgLuminance: totalLuminance / sampleCount,
    darkPercent,
    lightPercent,
    midPercent,
    lowContrastAreas: lowContrastRegions,
    suspectedInvisibleText,
  };
}

function analyzeFile(filePath: string, pageName: string, theme: string): PageAnalysis {
  const analysis = analyzePNG(filePath);
  const issues: string[] = [];
  let severity: "ok" | "warning" | "critical" = "ok";
  
  // Check for theme-specific issues
  if (theme === "dark") {
    // In dark theme, if there are lots of very light regions, some text might be washed out
    if (analysis.lightPercent > 30) {
      issues.push(`High light-pixel ratio (${analysis.lightPercent.toFixed(1)}%) in dark mode — possible theme leak or unstyled section`);
      severity = "warning";
    }
    // Very low contrast in dark theme
    if (analysis.lowContrastAreas > 100) {
      issues.push(`High low-contrast area count (${analysis.lowContrastAreas}) — possible invisible text on dark background`);
      severity = "critical";
    }
  } else {
    // In light theme
    if (analysis.darkPercent > 40) {
      issues.push(`High dark-pixel ratio (${analysis.darkPercent.toFixed(1)}%) in light mode — possible dark text on dark background or incorrect theme`);
      severity = "warning";
    }
    if (analysis.lowContrastAreas > 100) {
      issues.push(`High low-contrast area count (${analysis.lowContrastAreas}) — possible invisible text on light background`);
      severity = "critical";
    }
  }
  
  // Check for overall low contrast
  if (analysis.midPercent > 70 && analysis.lowContrastAreas > 80) {
    issues.push(`Predominantly mid-tone page with many low-contrast transitions — text may be hard to read`);
    if (severity === "ok") severity = "warning";
  }
  
  // Check for potential mismatch (dark theme showing light content or vice versa)
  if (theme === "dark" && analysis.avgLuminance > 0.6) {
    issues.push(`Dark theme page has high average luminance (${analysis.avgLuminance.toFixed(2)}) — theme might not be applied correctly`);
    severity = "critical";
  }
  if (theme === "light" && analysis.avgLuminance < 0.2) {
    issues.push(`Light theme page has low average luminance (${analysis.avgLuminance.toFixed(2)}) — theme might not be applied correctly`);
    severity = "critical";
  }
  
  if (analysis.suspectedInvisibleText) {
    issues.push(`Suspected invisible or very low-contrast text detected`);
    if (severity === "ok") severity = "warning";
  }
  
  return {
    page: pageName,
    theme,
    dominantBg: analysis.dominantBg,
    avgLuminance: analysis.avgLuminance,
    issues,
    severity,
    darkRegionsPercent: analysis.darkPercent,
    lightRegionsPercent: analysis.lightPercent,
    midtonePercent: analysis.midPercent,
    suspectedInvisibleText: analysis.suspectedInvisibleText,
    lowContrastAreas: analysis.lowContrastAreas,
  };
}

async function main() {
  console.log("🔍 Analyzing screenshots for color contrast issues...\n");
  
  const results: PageAnalysis[] = [];
  
  for (const theme of ["light", "dark"]) {
    const dir = path.join(SCREENSHOT_DIR, theme);
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".png") && !f.includes("-error") && !f.includes("-timeout"));
    
    for (const file of files) {
      const pageName = file.replace(".png", "");
      const filePath = path.join(dir, file);
      
      try {
        const analysis = analyzeFile(filePath, pageName, theme);
        results.push(analysis);
      } catch (e: any) {
        console.log(`  ⚠️  Could not analyze ${theme}/${file}: ${e.message?.slice(0, 50)}`);
      }
    }
  }
  
  // Sort by severity
  const critical = results.filter(r => r.severity === "critical");
  const warning = results.filter(r => r.severity === "warning");
  const ok = results.filter(r => r.severity === "ok");
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VISUAL CONTRAST ANALYSIS REPORT");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  if (critical.length > 0) {
    console.log(`\n🔴 CRITICAL ISSUES (${critical.length} pages):`);
    console.log("─".repeat(60));
    for (const r of critical) {
      console.log(`\n  ${r.theme}/${r.page}`);
      console.log(`    Luminance: ${r.avgLuminance.toFixed(3)} | Low-contrast areas: ${r.lowContrastAreas}`);
      console.log(`    Dark: ${r.darkRegionsPercent.toFixed(1)}% | Light: ${r.lightRegionsPercent.toFixed(1)}% | Mid: ${r.midtonePercent.toFixed(1)}%`);
      for (const issue of r.issues) {
        console.log(`    ❗ ${issue}`);
      }
    }
  }
  
  if (warning.length > 0) {
    console.log(`\n🟡 WARNINGS (${warning.length} pages):`);
    console.log("─".repeat(60));
    for (const r of warning) {
      console.log(`\n  ${r.theme}/${r.page}`);
      console.log(`    Luminance: ${r.avgLuminance.toFixed(3)} | Low-contrast areas: ${r.lowContrastAreas}`);
      for (const issue of r.issues) {
        console.log(`    ⚠️  ${issue}`);
      }
    }
  }
  
  console.log(`\n✅ PASSING (${ok.length} pages) — No significant contrast issues detected\n`);
  
  // Summary stats
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  SUMMARY: ${results.length} pages analyzed`);
  console.log(`  🔴 Critical: ${critical.length}`);
  console.log(`  🟡 Warning:  ${warning.length}`);
  console.log(`  ✅ OK:       ${ok.length}`);
  console.log("═══════════════════════════════════════════════════════════\n");
  
  // Write detailed report
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, "contrast-analysis.json"),
    JSON.stringify({ critical, warning, okCount: ok.length, timestamp: new Date().toISOString() }, null, 2)
  );
  console.log(`📁 Full report: ${SCREENSHOT_DIR}/contrast-analysis.json`);
}

main().catch(console.error);
