import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B365D" />
      <stop offset="100%" stop-color="#0F2038" />
    </linearGradient>
    <linearGradient id="mintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C3F3DF" />
      <stop offset="100%" stop-color="#226E56" />
    </linearGradient>
    <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#99BFF9" />
      <stop offset="50%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#C3F3DF" />
    </linearGradient>
    <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Premium Squircle Background -->
  <rect x="24" y="24" width="464" height="464" rx="104" ry="104" fill="url(#bgGrad)" />
  <rect x="24" y="24" width="464" height="464" rx="104" ry="104" fill="none" stroke="#99BFF9" stroke-opacity="0.25" stroke-width="6" />

  <!-- Inner Editorial Frame -->
  <rect x="56" y="56" width="400" height="400" rx="76" ry="76" fill="none" stroke="#99BFF9" stroke-opacity="0.12" stroke-width="2" />

  <!-- Sophisticated Science of Gifts Monogram & Bow Mark -->
  <g filter="url(#subtleGlow)">
    <!-- Elegant Serif 'S' -->
    <path d="M 210,175 C 190,175 160,188 160,220 C 160,250 185,265 220,278 C 265,294 285,310 285,338 C 285,368 255,385 220,385 C 180,385 150,362 145,335 L 175,335 C 180,350 195,362 220,362 C 242,362 260,350 260,336 C 260,320 242,308 205,294 C 165,278 135,260 135,222 C 135,185 168,152 210,152 C 248,152 275,172 280,200 L 250,200 C 245,185 230,175 210,175 Z" fill="#FAF9F6" />

    <!-- Elegant Serif 'G' -->
    <path d="M 360,170 C 315,170 280,205 280,268 C 280,332 315,368 365,368 C 395,368 420,352 430,325 L 365,325 L 365,302 L 452,302 L 452,352 C 430,380 398,392 360,392 C 295,392 254,342 254,268 C 254,195 298,145 365,145 C 400,145 432,158 450,182 L 430,202 C 412,182 390,170 360,170 Z" fill="#FAF9F6" fill-opacity="0.9" />
    
    <!-- Central Signature Mint/Blue Ribbon Knot -->
    <!-- Horizontal Connecting Line -->
    <line x1="80" y1="256" x2="432" y2="256" stroke="url(#ribbonGrad)" stroke-width="4" stroke-linecap="round" />

    <!-- Ribbon Loop Left -->
    <path d="M 256,256 C 220,225 200,240 210,256 C 200,272 220,287 256,256 Z" fill="none" stroke="url(#ribbonGrad)" stroke-width="4" stroke-linejoin="round" />
    <!-- Ribbon Loop Right -->
    <path d="M 256,256 C 292,225 312,240 302,256 C 312,272 292,287 256,256 Z" fill="none" stroke="url(#ribbonGrad)" stroke-width="4" stroke-linejoin="round" />

    <!-- Ribbon Center Gem/Node -->
    <circle cx="256" cy="256" r="6" fill="#C3F3DF" />
  </g>
</svg>`;

async function generateIcons() {
  const outputDir = path.resolve('assets/icons');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save base SVG
  fs.writeFileSync(path.join(outputDir, 'science-of-gifts.svg'), iconSvg.trim());

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const pngBuf = await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer: pngBuf });
    fs.writeFileSync(path.join(outputDir, `icon-${size}x${size}.png`), pngBuf);
  }

  // Build Windows ICO file structure
  // Header: 6 bytes
  // Entries: sizes.length * 16 bytes
  const headerSize = 6;
  const entrySize = 16;
  const directorySize = headerSize + (sizes.length * entrySize);

  let currentOffset = directorySize;
  const entries = [];

  for (const item of pngBuffers) {
    const size = item.size;
    const buf = item.buffer;
    const bWidth = size >= 256 ? 0 : size;
    const bHeight = size >= 256 ? 0 : size;

    const entry = Buffer.alloc(16);
    entry.writeUInt8(bWidth, 0); // width
    entry.writeUInt8(bHeight, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit depth
    entry.writeUInt32LE(buf.length, 8); // image size
    entry.writeUInt32LE(currentOffset, 12); // image offset

    entries.push(entry);
    currentOffset += buf.length;
  }

  const iconDir = Buffer.alloc(headerSize);
  iconDir.writeUInt16LE(0, 0); // reserved
  iconDir.writeUInt16LE(1, 2); // type 1 = ICO
  iconDir.writeUInt16LE(sizes.length, 4); // number of images

  const icoBuffer = Buffer.concat([
    iconDir,
    ...entries,
    ...pngBuffers.map(p => p.buffer)
  ]);

  const icoPath = path.join(outputDir, 'science-of-gifts.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Successfully generated ${icoPath} with resolutions: ${sizes.join(', ')}`);
}

generateIcons().catch(console.error);
