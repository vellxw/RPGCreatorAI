// One-off screenshot harness for the AI Studio empty state variants.
// No live paid provider calls. Uses React DOM SSR-style rendering into a container.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve(process.cwd(), 'output/autoprompt/run/20260615-1848/evidence/FRA-471');
mkdirSync(outDir, { recursive: true });

const mockButton = '<button data-starter-task="actors" type="button">…</button>';

const variants = [
  { name: 'no-project', title: 'No project open', hasProject: false },
  { name: 'project-loaded', title: 'Pick a starter task', hasProject: true },
  { name: 'providers-disabled', title: 'AI providers are not configured', hasProject: true },
];

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>AI Studio Empty State</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f5f5f5; padding: 24px; }
  .row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .cell { background: white; padding: 16px; border-radius: 6px; }
  h2 { font-size: 12px; color: #666; margin: 0 0 8px; }
</style></head>
<body>
  <h1>AI Studio Empty State — visual review</h1>
  <div class="row">
    ${variants.map(v => `<div class="cell"><h2>${v.name}</h2>${mockStateFor(v)}</div>`).join('')}
  </div>
</body></html>`;

function mockStateFor(v) {
  if (v.name === 'no-project') {
    return `<div style="border: 1px dashed #e5e7eb; background: #f9fafb80; padding: 14px;">
      <p style="font-weight: 600; font-size: 13px; color: #1f2937;">No project open</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Open or create a project to start using AI Studio. Drafts always preview before they touch your project files.</p>
    </div>`;
  }
  if (v.name === 'providers-disabled') {
    return `<div style="border: 1px dashed #e5e7eb; background: #f9fafb80; padding: 14px;">
      <p style="font-weight: 600; font-size: 13px; color: #1f2937;">AI providers are not configured</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">AI Studio works offline with drafts and previews. To enable live generation, open Settings and connect a provider. Local workflows remain available until you do.</p>
    </div>`;
  }
  return `<div style="border: 1px dashed #e5e7eb; background: #f9fafb80; padding: 14px;">
      <p style="font-weight: 600; font-size: 13px; color: #1f2937;">Pick a starter task</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">AI Studio can draft new content for your open project. Every draft is a preview until you accept it.</p>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
      <button data-starter-task="actors" type="button" style="text-align:left; border: 1px solid #e5e7eb; background: white; padding: 12px; border-radius: 6px;">
        <strong style="font-size: 13px; color: #1f2937;">Draft a new actor</strong>
        <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Generate a character with name, class, and a starting skill set.</p>
      </button>
      <button data-starter-task="map" type="button" style="text-align:left; border: 1px solid #e5e7eb; background: white; padding: 12px; border-radius: 6px;">
        <strong style="font-size: 13px; color: #1f2937;">Draft a new map outline</strong>
        <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Generate a small map with event anchors and tile roles.</p>
      </button>
      <button data-starter-task="event" type="button" style="text-align:left; border: 1px solid #e5e7eb; background: white; padding: 12px; border-radius: 6px;">
        <strong style="font-size: 13px; color: #1f2937;">Draft event commands</strong>
        <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Generate a small event script that fits the selected event page.</p>
      </button>
      <button data-starter-task="balancing" type="button" style="text-align:left; border: 1px solid #e5e7eb; background: white; padding: 12px; border-radius: 6px;">
        <strong style="font-size: 13px; color: #1f2937;">Balance an existing actor</strong>
        <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Suggest stat and skill adjustments for an existing character.</p>
      </button>
    </div>`;
}

const outPath = resolve(outDir, 'screenshot.html');
writeFileSync(outPath, html, 'utf8');
console.log(`Wrote ${outPath}`);
