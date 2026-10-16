// Offline: preview demo covers use only the theme palette.
import assert from 'node:assert/strict';
import { demoCover } from '../src/lib/demo-catalogue.mjs';

const PALETTE = ['#0b2416', '#123a24', '#1f5a3a', '#2f7a4d', '#1b201e', '#3f4743', '#7a5a1e', '#b9852e', '#f4f1e6', '#e9d8ae'];
for (let seed = 0; seed < 12; seed++) {
  const svg = decodeURIComponent(demoCover('A Monsoon Ledger of Small Things', 'Ananya Rao', seed).replace('data:image/svg+xml;utf8,', ''));
  for (const colour of svg.match(/#[0-9a-fA-F]{6}/g) ?? []) assert.ok(PALETTE.includes(colour.toLowerCase()), `demo cover colour ${colour} is off-palette`);
}
console.log('Demo covers use only the theme palette.');
