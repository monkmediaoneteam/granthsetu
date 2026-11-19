/**
 * Dynamic Image Placeholders System for Inventayu Books (Pustiq)
 * Provides brand-consistent, book-focused, responsive SVG placeholders
 * for Hero banners, Side promo cards, Category tiles, Book covers, and Authors.
 */

// Brand colour palette
export const PALETTE = {
  forest: "#0b2416",
  forest2: "#123a24",
  forestLine: "#1e4d33",
  brand: "#2f7a4d",
  brandDeep: "#1f5a3a",
  brandGlow: "#5bc58a",
  gold: "#b9852e",
  goldLight: "#e9d8ae",
  cream: "#f4f1e6",
  bg: "#ffffff",
  bg2: "#fafaf7",
  bg3: "#efede5",
  ink: "#0a0e0c",
  inkSoft: "#4a524f",
  inkMute: "#3f4743",
  line: "#e8e6dd",
};

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

/**
 * Generates an ultra-clean, modern, botanical bookstore Hero Banner.
 * Left half is deliberately subtle/clean so HTML text and buttons remain 100% legible.
 * Right half features elegant botanical folios, book geometry, and research motifs.
 */
export function generateHeroBannerSvg({ mobile = false }: { mobile?: boolean } = {}): string {
  if (mobile) {
    // Mobile dimensions: 800 x 1000 (4:5 vertical)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="mob-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#fafaf7"/>
      <stop offset="100%" stop-color="#f4f1e6"/>
    </linearGradient>
    <linearGradient id="mob-green-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${PALETTE.brandGlow}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${PALETTE.brand}" stop-opacity="0.06"/>
    </linearGradient>
    <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${PALETTE.gold}"/>
      <stop offset="100%" stop-color="#7a5a1e"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="1000" fill="url(#mob-bg)"/>

  <!-- Organic ambient aura in top-right -->
  <circle cx="700" cy="200" r="320" fill="url(#mob-green-grad)"/>
  <circle cx="650" cy="750" r="260" fill="${PALETTE.gold}" fill-opacity="0.04"/>

  <!-- Subtle grid lines (scientific research feel) -->
  <line x1="100" y1="0" x2="100" y2="1000" stroke="${PALETTE.line}" stroke-width="1" stroke-dasharray="4 8"/>
  <line x1="700" y1="0" x2="700" y2="1000" stroke="${PALETTE.line}" stroke-width="1" stroke-dasharray="4 8"/>
  <line x1="0" y1="600" x2="800" y2="600" stroke="${PALETTE.line}" stroke-width="1" stroke-dasharray="4 8"/>

  <!-- Modern Botanical & Book Motif (Bottom Right) -->
  <g transform="translate(480, 640)">
    <!-- Open Book Stack Outline -->
    <rect x="-80" y="-20" width="260" height="180" rx="8" fill="#ffffff" stroke="${PALETTE.line}" stroke-width="2"/>
    <rect x="-60" y="-40" width="260" height="180" rx="8" fill="#ffffff" stroke="${PALETTE.forestLine}" stroke-width="2" stroke-opacity="0.4"/>
    <rect x="-40" y="-60" width="260" height="180" rx="8" fill="#ffffff" stroke="${PALETTE.gold}" stroke-width="2" stroke-opacity="0.6"/>
    
    <!-- Gold foil line details on top book -->
    <line x1="-10" y1="-30" x2="180" y2="-30" stroke="${PALETTE.gold}" stroke-width="1.5"/>
    <line x1="-10" y1="-10" x2="140" y2="-10" stroke="${PALETTE.gold}" stroke-width="1" stroke-opacity="0.6"/>

    <!-- Botanical Leaf Line Art -->
    <path d="M 60,-120 C 120,-160 160,-100 140,-50 C 120,0 70,-40 60,-120 Z" fill="none" stroke="${PALETTE.brand}" stroke-width="2.5"/>
    <path d="M 60,-120 C 100,-70 120,-30 140,-50" fill="none" stroke="${PALETTE.brand}" stroke-width="1.5" stroke-dasharray="3 3"/>
    
    <!-- Secondary delicate leaf branch -->
    <path d="M 20,-140 Q 60,-180 100,-160" fill="none" stroke="${PALETTE.brandGlow}" stroke-width="2"/>
    <circle cx="100" cy="-160" r="5" fill="${PALETTE.brandGlow}"/>
    <circle cx="50" cy="-165" r="4" fill="${PALETTE.gold}"/>
  </g>

  <!-- Editorial watermark / brand seal at top right -->
  <g transform="translate(680, 80)">
    <circle cx="0" cy="0" r="32" fill="none" stroke="${PALETTE.gold}" stroke-width="1.5" stroke-opacity="0.5"/>
    <circle cx="0" cy="0" r="28" fill="none" stroke="${PALETTE.forestLine}" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="0" y="4" text-anchor="middle" font-family="'Geist', 'Segoe UI', sans-serif" font-size="9" font-weight="600" letter-spacing="1.5" fill="${PALETTE.gold}">EST. 2026</text>
  </g>
</svg>`;
  }

  // Desktop dimensions: 1600 x 700 (~2.3:1 panoramic)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700" width="1600" height="700">
  <defs>
    <!-- Seamless background gradient -->
    <linearGradient id="hero-bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#ffffff"/>
      <stop offset="75%" stop-color="#fafaf7"/>
      <stop offset="100%" stop-color="#f4f1e6"/>
    </linearGradient>

    <!-- Emerald botanical wash -->
    <radialGradient id="emerald-glow" cx="80%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${PALETTE.brandGlow}" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="${PALETTE.brand}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>

    <!-- Warm golden accent wash -->
    <radialGradient id="amber-glow" cx="92%" cy="75%" r="40%">
      <stop offset="0%" stop-color="${PALETTE.gold}" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="${PALETTE.gold}" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Base canvas -->
  <rect width="1600" height="700" fill="url(#hero-bg)"/>

  <!-- Atmospheric glows positioned on the right half -->
  <rect width="1600" height="700" fill="url(#emerald-glow)"/>
  <rect width="1600" height="700" fill="url(#amber-glow)"/>

  <!-- Left side subtle architectural grid (remains behind text without distraction) -->
  <g stroke="${PALETTE.line}" stroke-width="1" stroke-dasharray="3 6" opacity="0.6">
    <line x1="120" y1="0" x2="120" y2="700"/>
    <line x1="480" y1="0" x2="480" y2="700"/>
    <line x1="0" y1="580" x2="600" y2="580"/>
  </g>

  <!-- Right side creative reading & botanical sanctuary illustration -->
  <g id="sanctuary-artwork" transform="translate(1050, 320)">
    <!-- Architectural window arch / reading alcove silhouette -->
    <path d="M 0,-240 C 200,-240 380,-100 380,120 L 380,340 L -60,340 L -60,120 C -60,-100 0,-240 0,-240 Z"
          fill="#ffffff" fill-opacity="0.55" stroke="${PALETTE.line}" stroke-width="1.5"/>

    <!-- Gilded geometry circles (scientific astrolabe / botanical taxonomy motif) -->
    <circle cx="200" cy="60" r="190" fill="none" stroke="${PALETTE.forestLine}" stroke-width="1" stroke-opacity="0.3"/>
    <circle cx="200" cy="60" r="160" fill="none" stroke="${PALETTE.gold}" stroke-width="1.5" stroke-opacity="0.45" stroke-dasharray="8 6"/>
    <circle cx="200" cy="60" r="110" fill="none" stroke="${PALETTE.brand}" stroke-width="1" stroke-opacity="0.35"/>

    <!-- Stack of Scholarly Folios & Books (Perspective 3D outlines) -->
    <g transform="translate(40, 100)">
      <!-- Bottom heavy volume -->
      <path d="M 0,110 L 220,70 L 340,95 L 120,135 Z" fill="#ffffff" stroke="${PALETTE.forest}" stroke-width="2"/>
      <path d="M 0,110 L 0,135 L 120,160 L 120,135 Z" fill="${PALETTE.forest2}" stroke="${PALETTE.forest}" stroke-width="2"/>
      <path d="M 120,135 L 340,95 L 340,120 L 120,160 Z" fill="${PALETTE.cream}" stroke="${PALETTE.forest}" stroke-width="1.5"/>

      <!-- Middle volume (Forest Green spine) -->
      <path d="M 20,70 L 230,30 L 330,55 L 120,95 Z" fill="#ffffff" stroke="${PALETTE.brandDeep}" stroke-width="2"/>
      <path d="M 20,70 L 20,92 L 120,117 L 120,95 Z" fill="${PALETTE.brand}" stroke="${PALETTE.brandDeep}" stroke-width="2"/>
      <path d="M 120,95 L 330,55 L 330,77 L 120,117 Z" fill="${PALETTE.cream}" stroke="${PALETTE.brandDeep}" stroke-width="1.5"/>
      <!-- Gold ribbing on spine -->
      <line x1="30" y1="74" x2="30" y2="94" stroke="${PALETTE.gold}" stroke-width="1.5"/>
      <line x1="110" y1="92" x2="110" y2="112" stroke="${PALETTE.gold}" stroke-width="1.5"/>

      <!-- Top Volume (Open Folio / Manuscript) -->
      <path d="M 50,25 L 210,-10 L 300,12 L 140,47 Z" fill="#ffffff" stroke="${PALETTE.gold}" stroke-width="2"/>
      <line x1="70" y1="23" x2="190" y2="-3" stroke="${PALETTE.gold}" stroke-width="1.5"/>
      <line x1="70" y1="31" x2="160" y2="12" stroke="${PALETTE.gold}" stroke-width="1" stroke-opacity="0.6"/>
    </g>

    <!-- Elegant Ayurvedic Botanical Herbs Lineage (Tulsi, Ashwagandha, Neem Leaves) -->
    <g transform="translate(60, -30)">
      <!-- Main stem curving gracefully upward -->
      <path d="M 80,180 C 110,60 90,-40 180,-140" fill="none" stroke="${PALETTE.brand}" stroke-width="3" stroke-linecap="round"/>
      <path d="M 180,-140 C 210,-170 230,-150 210,-110 C 190,-70 170,-100 180,-140 Z" fill="${PALETTE.brand}" fill-opacity="0.15" stroke="${PALETTE.brand}" stroke-width="2"/>
      
      <!-- Branch 1 (left leaf) -->
      <path d="M 98,100 C 60,60 30,75 40,110 C 50,140 85,120 98,100 Z" fill="${PALETTE.brandGlow}" fill-opacity="0.2" stroke="${PALETTE.brand}" stroke-width="2"/>
      <line x1="98" y1="100" x2="45" y2="92" stroke="${PALETTE.brand}" stroke-width="1"/>

      <!-- Branch 2 (right leaf) -->
      <path d="M 108,40 C 150,0 180,15 170,50 C 160,80 120,60 108,40 Z" fill="${PALETTE.gold}" fill-opacity="0.18" stroke="${PALETTE.gold}" stroke-width="2"/>
      <line x1="108" y1="40" x2="160" y2="30" stroke="${PALETTE.gold}" stroke-width="1"/>

      <!-- Delicate medicinal berries / seeds -->
      <circle cx="215" cy="-80" r="5" fill="${PALETTE.gold}"/>
      <circle cx="230" cy="-65" r="4" fill="${PALETTE.brandGlow}"/>
      <circle cx="205" cy="-55" r="4.5" fill="${PALETTE.brand}"/>
    </g>

    <!-- Apothecary Glassware Outline (Clean Phytopharmaceutical Research) -->
    <g transform="translate(340, 160)">
      <!-- Conical flask / beaker -->
      <path d="M 20,-70 L 35,-70 L 35,-40 L 70,30 C 75,40 70,50 55,50 L 0,50 C -15,50 -20,40 -15,30 L 20,-40 Z"
            fill="#ffffff" fill-opacity="0.75" stroke="${PALETTE.forestLine}" stroke-width="2"/>
      <!-- Liquid level line (Emerald tincture) -->
      <path d="M -8,18 Q 28,12 62,18" fill="none" stroke="${PALETTE.brandGlow}" stroke-width="2"/>
      <path d="M -8,18 L -14,32 C -18,40 -12,48 2,48 L 52,48 C 66,48 72,40 68,32 L 62,18 Z"
            fill="${PALETTE.brandGlow}" fill-opacity="0.12"/>
    </g>
  </g>

  <!-- Top Right Brand Editorial Stamp -->
  <g transform="translate(1480, 80)">
    <circle cx="0" cy="0" r="36" fill="#ffffff" stroke="${PALETTE.gold}" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(185,133,46,0.15))"/>
    <circle cx="0" cy="0" r="31" fill="none" stroke="${PALETTE.forestLine}" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="0" y="-3" text-anchor="middle" font-family="'Geist', 'Segoe UI', sans-serif" font-size="8" font-weight="700" letter-spacing="2" fill="${PALETTE.forest}">INVENTAYU</text>
    <text x="0" y="10" text-anchor="middle" font-family="'Geist', 'Segoe UI', sans-serif" font-size="7" font-weight="500" letter-spacing="1.5" fill="${PALETTE.gold}">DIGITAL</text>
  </g>
</svg>`;
}

/**
 * Generates Side Promo Banner Placeholders (Deal of the Day / New Arrival / Reading Room)
 * Dimensions: 800 x 600 (Desktop) or 640 x 400 (Mobile)
 */
export function generateSideBannerSvg({ slot = 1, mobile = false }: { slot?: number | string; mobile?: boolean } = {}): string {
  const width = mobile ? 640 : 800;
  const height = mobile ? 400 : 600;

  if (slot === 2 || slot === "side-2") {
    // Slot 2: Deep Forest Green reading room / library theme
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="side2-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${PALETTE.forest2}"/>
      <stop offset="100%" stop-color="${PALETTE.forest}"/>
    </linearGradient>
    <radialGradient id="side2-radial" cx="90%" cy="10%" r="80%">
      <stop offset="0%" stop-color="${PALETTE.brandGlow}" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="${PALETTE.brand}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#side2-bg)"/>
  <rect width="${width}" height="${height}" fill="url(#side2-radial)"/>

  <!-- Delicate gold border accent -->
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="16" fill="none" stroke="${PALETTE.forestLine}" stroke-width="1.5"/>

  <!-- Scholarly Library Book Stack Illustration -->
  <g transform="translate(${width * 0.7}, ${height * 0.5})">
    <!-- Geometric book array -->
    <rect x="-60" y="-80" width="130" height="170" rx="4" fill="#ffffff" fill-opacity="0.08" stroke="${PALETTE.gold}" stroke-width="1.5"/>
    <rect x="-40" y="-100" width="130" height="170" rx="4" fill="#ffffff" fill-opacity="0.12" stroke="${PALETTE.brandGlow}" stroke-width="1.5"/>
    <line x1="-30" y1="-80" x2="60" y2="-80" stroke="${PALETTE.gold}" stroke-width="1.5"/>
    <line x1="-30" y1="-60" x2="40" y2="-60" stroke="${PALETTE.goldLight}" stroke-width="1"/>
    
    <!-- Plant leaf emerging from book -->
    <path d="M 25,-100 Q 50,-150 90,-140 Q 60,-115 25,-100 Z" fill="${PALETTE.brandGlow}" fill-opacity="0.4" stroke="${PALETTE.brandGlow}" stroke-width="1.5"/>
  </g>

  <!-- Clean category badge in corner -->
  <g transform="translate(36, 48)">
    <rect width="130" height="28" rx="14" fill="${PALETTE.forestLine}"/>
    <text x="65" y="18" text-anchor="middle" font-family="'Geist', sans-serif" font-size="11" font-weight="600" letter-spacing="1.5" fill="${PALETTE.goldLight}">DIGITAL LIBRARY</text>
  </g>
</svg>`;
  }

  // Slot 1: Warm Amber Gold / Deal theme
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="side1-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffaf0"/>
      <stop offset="60%" stop-color="#f6ecd9"/>
      <stop offset="100%" stop-color="#ebd8b5"/>
    </linearGradient>
    <radialGradient id="side1-radial" cx="85%" cy="85%" r="75%">
      <stop offset="0%" stop-color="${PALETTE.gold}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#side1-bg)"/>
  <rect width="${width}" height="${height}" fill="url(#side1-radial)"/>

  <!-- Border -->
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="16" fill="none" stroke="#ecdcb8" stroke-width="1.5"/>

  <!-- Botanical & Star geometry -->
  <g transform="translate(${width * 0.72}, ${height * 0.5})">
    <circle cx="0" cy="0" r="85" fill="#ffffff" fill-opacity="0.6" stroke="${PALETTE.gold}" stroke-width="1.5"/>
    <circle cx="0" cy="0" r="72" fill="none" stroke="${PALETTE.gold}" stroke-width="1" stroke-dasharray="4 4" stroke-opacity="0.5"/>
    
    <!-- Sunburst / Star of Excellence -->
    <path d="M 0,-45 L 8,-12 L 40,-8 L 14,8 L 22,40 L 0,18 L -22,40 L -14,8 L -40,-8 L -8,-12 Z" fill="${PALETTE.gold}" fill-opacity="0.85"/>
  </g>

  <!-- Tag -->
  <g transform="translate(36, 48)">
    <rect width="115" height="28" rx="14" fill="#edd9b0"/>
    <text x="57" y="18" text-anchor="middle" font-family="'Geist', sans-serif" font-size="11" font-weight="600" letter-spacing="1.5" fill="#7a5a1e">SPECIAL OFFER</text>
  </g>
</svg>`;
}

/**
 * Generates Category Tile Images (800 x 450, 16:9 widescreen)
 * Customized by subject: Ayurveda, Phytopharmaceuticals, Research, Natural Products, etc.
 */
export function generateCategorySvg({ slug = "ayurveda", name = "Ayurveda" }: { slug?: string; name?: string }): string {
  const safeName = escapeXml(name.toUpperCase());
  
  // Choose thematic colors and icon based on category
  let bgGrad1 = PALETTE.forest;
  let bgGrad2 = PALETTE.forest2;
  let accentColor = PALETTE.brandGlow;
  let iconPath = "";

  if (slug.includes("phytopharm") || slug.includes("chem")) {
    bgGrad1 = "#0c2830";
    bgGrad2 = "#164450";
    accentColor = "#38bdf8";
    // Laboratory flask + molecular node
    iconPath = `<path d="M 0,-40 L 15,-40 L 15,-15 L 45,35 C 50,45 42,55 30,55 L -30,55 C -42,55 -50,45 -45,35 L -15,-15 L -15,-40 Z" fill="none" stroke="${accentColor}" stroke-width="2.5"/>
                <circle cx="20" cy="25" r="4" fill="${PALETTE.gold}"/>
                <circle cx="-10" cy="35" r="5" fill="${accentColor}"/>
                <circle cx="0" cy="20" r="3" fill="#ffffff"/>`;
  } else if (slug.includes("research") || slug.includes("method")) {
    bgGrad1 = "#1a162b";
    bgGrad2 = "#292342";
    accentColor = "#a78bfa";
    // Research compass / magnifying folio
    iconPath = `<circle cx="0" cy="0" r="42" fill="none" stroke="${accentColor}" stroke-width="2.5"/>
                <line x1="30" y1="30" x2="65" y2="65" stroke="${accentColor}" stroke-width="4" stroke-linecap="round"/>
                <line x1="-20" y1="-10" x2="20" y2="-10" stroke="${PALETTE.gold}" stroke-width="2"/>
                <line x1="-20" y1="5" x2="10" y2="5" stroke="${PALETTE.gold}" stroke-width="2"/>
                <line x1="-20" y1="20" x2="15" y2="20" stroke="${PALETTE.goldLight}" stroke-width="1.5"/>`;
  } else if (slug.includes("natural") || slug.includes("herb")) {
    bgGrad1 = "#0f2c1a";
    bgGrad2 = "#1c482c";
    accentColor = "#4ade80";
    // Sacred leaf pair
    iconPath = `<path d="M 0,40 C 40,20 60,-20 30,-50 C 0,-40 -20,0 0,40 Z" fill="${accentColor}" fill-opacity="0.25" stroke="${accentColor}" stroke-width="2.5"/>
                <path d="M 0,40 C -30,10 -50,-20 -20,-45 C 5,-35 15,0 0,40 Z" fill="${PALETTE.gold}" fill-opacity="0.2" stroke="${PALETTE.gold}" stroke-width="2"/>
                <line x1="0" y1="40" x2="10" y2="-40" stroke="${accentColor}" stroke-width="2"/>`;
  } else {
    // Default Ayurveda (Mortar & pestle + sacred lotus/leaf)
    bgGrad1 = PALETTE.forest;
    bgGrad2 = PALETTE.forest2;
    accentColor = PALETTE.brandGlow;
    iconPath = `<path d="M -50,-10 C -50,30 50,30 50,-10 L 45,-25 L -45,-25 Z" fill="none" stroke="${accentColor}" stroke-width="2.5"/>
                <rect x="-30" y="30" width="60" height="8" rx="2" fill="${PALETTE.gold}"/>
                <line x1="15" y1="-45" x2="-25" y2="15" stroke="${PALETTE.goldLight}" stroke-width="4" stroke-linecap="round"/>
                <circle cx="0" cy="-35" r="8" fill="${accentColor}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <defs>
    <linearGradient id="cat-bg-${slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGrad2}"/>
      <stop offset="100%" stop-color="${bgGrad1}"/>
    </linearGradient>
    <radialGradient id="cat-glow-${slug}" cx="75%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <rect width="800" height="450" fill="url(#cat-bg-${slug})"/>
  <rect width="800" height="450" fill="url(#cat-glow-${slug})"/>

  <!-- Frame border -->
  <rect x="20" y="20" width="760" height="410" rx="14" fill="none" stroke="${PALETTE.forestLine}" stroke-width="1.5"/>

  <!-- Centered Icon Illustration -->
  <g transform="translate(400, 190)">
    <circle cx="0" cy="0" r="78" fill="#ffffff" fill-opacity="0.04" stroke="${accentColor}" stroke-opacity="0.3" stroke-width="1"/>
    <circle cx="0" cy="0" r="64" fill="none" stroke="${PALETTE.gold}" stroke-opacity="0.4" stroke-dasharray="4 4" stroke-width="1"/>
    ${iconPath}
  </g>

  <!-- Subject Name Badge -->
  <g transform="translate(400, 340)">
    <rect x="-140" y="-18" width="280" height="36" rx="18" fill="#ffffff" fill-opacity="0.08" stroke="${PALETTE.forestLine}" stroke-width="1"/>
    <text x="0" y="6" text-anchor="middle" font-family="'Geist', 'Segoe UI', sans-serif" font-size="13" font-weight="600" letter-spacing="2" fill="${PALETTE.cream}">${safeName}</text>
  </g>
</svg>`;
}
