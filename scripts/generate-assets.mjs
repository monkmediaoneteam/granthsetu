import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Import placeholder generators
const { generateHeroBannerSvg, generateSideBannerSvg, generateCategorySvg } = await import("../src/lib/placeholders.js").catch(async () => {
  // If importing .ts directly fails in Node without tsx, import from compiled or use typescript transpiler
  return await import("../src/lib/placeholders.ts");
});

async function main() {
  const publicDir = path.join(root, "public", "assets");
  
  // 1. Hero Banners
  await writeFile(path.join(publicDir, "banners", "hero-botanical-desktop.svg"), generateHeroBannerSvg({ mobile: false }), "utf8");
  await writeFile(path.join(publicDir, "banners", "hero-botanical-mobile.svg"), generateHeroBannerSvg({ mobile: true }), "utf8");
  console.log("Hero banners generated.");

  // 2. Side Banners
  await writeFile(path.join(publicDir, "banners", "side-deal-desktop.svg"), generateSideBannerSvg({ slot: 1, mobile: false }), "utf8");
  await writeFile(path.join(publicDir, "banners", "side-deal-mobile.svg"), generateSideBannerSvg({ slot: 1, mobile: true }), "utf8");
  await writeFile(path.join(publicDir, "banners", "side-library-desktop.svg"), generateSideBannerSvg({ slot: 2, mobile: false }), "utf8");
  await writeFile(path.join(publicDir, "banners", "side-library-mobile.svg"), generateSideBannerSvg({ slot: 2, mobile: true }), "utf8");
  console.log("Side banners generated.");

  // 3. Category Tiles
  const categories = [
    { slug: "ayurveda", name: "Ayurveda" },
    { slug: "phytopharmaceuticals", name: "Phytopharmaceuticals" },
    { slug: "research", name: "Research Methodology" },
    { slug: "natural-products", name: "Natural Products" },
    { slug: "health-wellness", name: "Health & Wellness" },
    { slug: "science", name: "Science & Botanical Chemistry" },
  ];

  for (const cat of categories) {
    await writeFile(path.join(publicDir, "categories", `${cat.slug}.svg`), generateCategorySvg(cat), "utf8");
  }
  console.log("Category SVGs generated.");
}

main().catch(console.error);
