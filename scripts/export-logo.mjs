// Exports the ExplainCanvas mark and wordmark as PNGs into public/. Run: pnpm logo:export
import sharp from "sharp";
import fs from "node:fs";
const mark = fs.readFileSync("src/app/icon.svg");
await sharp(mark, { density: 384 }).resize(512, 512).png().toFile("public/logo.png");
await sharp(mark, { density: 768 }).resize(1024, 1024).png().toFile("public/logo-1024.png");
await sharp(mark, { density: 192 }).resize(192, 192).png().toFile("public/logo-192.png");
// Wordmark: mark + text on transparent background
const word = `<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="260" viewBox="0 0 1560 260">
  
  <g transform="translate(20,20) scale(3.4375)">
    <rect x="6" y="6" width="52" height="52" rx="14" fill="#0a0a0a"/>
    <path d="M19 41 C 25 24, 31 24, 35 33 C 38 40, 42 36, 45 24" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="45" cy="42" r="3.6" fill="#fff"/>
  </g>
  <text x="270" y="172" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="150" letter-spacing="-5" fill="#0a0a0a" font-weight="600">Explain<tspan fill="#6b6b6b" font-weight="400">Canvas</tspan></text>
</svg>`;
await sharp(Buffer.from(word), { density: 300 }).png().toFile("public/logo-wordmark.png");
const wordDark = word.replace('fill="#0a0a0a"', 'fill="#ffffff"');
await sharp(Buffer.from(wordDark), { density: 300 }).png().toFile("public/logo-wordmark-dark.png");
console.log(fs.readdirSync("public").filter(f => f.startsWith("logo")).map(f => `${f} ${fs.statSync("public/"+f).size}B`).join("\n"));
