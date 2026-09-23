/**
 * The HUD's icons: the supplied images where there is one (rebirth, pets,
 * backpack, trophy, shoe, shop, sound), and small inline SVGs for the rest -
 * the web, the swinging spider, the teleport swirl, the stats card, the
 * auto-click hand, the health cross, the check.
 */
const img = (src: string, alt: string): string => `<img class="sp-icon-img" src="${src}" alt="${alt}" draggable="false" />`;

/** A white spider web on a blue disc: Web Power, and every "+N" popup. */
const WEB_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#2a8ae8" stroke="#0d0f18" stroke-width="3.5"/>' +
  '<g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M32 6v52M6 32h52M13.6 13.6l36.8 36.8M50.4 13.6 13.6 50.4"/>' +
  '<path d="M32 14l7 4 5 6 3 8-3 8-5 6-7 4-7-4-5-6-3-8 3-8 5-6z"/><path d="M32 22l4 2 3 3 1 5-1 5-3 3-4 2-4-2-3-3-1-5 1-5 3-3z"/></g></svg>';

export const webIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(WEB_SVG)}`;

/**
 * A real cobweb: nine uneven spokes and five rings of thread that sag between
 * them, white over an ink outline so it reads on sky, street or red. Drawn
 * once here; the gain popups and the LEVEL UP banner wear it.
 */
const COBWEB_SVG = ((): string => {
  const c = 50;
  const spokes = [0, 38, 81, 122, 158, 200, 241, 283, 322].map((deg) => (deg * Math.PI) / 180);
  const at = (angle: number, r: number): string => `${(c + Math.cos(angle) * r).toFixed(1)} ${(c + Math.sin(angle) * r).toFixed(1)}`;
  let threads = spokes.map((angle) => `M${c} ${c}L${at(angle, 47)}`).join('');
  for (const r of [9, 17, 25, 33, 41]) {
    spokes.forEach((angle, i) => {
      const next = spokes[(i + 1) % spokes.length]! + (i === spokes.length - 1 ? Math.PI * 2 : 0);
      threads += `M${at(angle, r)}Q${at((angle + next) / 2, r * 0.8)} ${at(next, r)}`;
    });
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="none" stroke-linecap="round">` +
    `<path d="${threads}" stroke="#0d0f18" stroke-width="5.5" stroke-opacity=".85"/>` +
    `<path d="${threads}" stroke="#fff" stroke-width="2.4"/><circle cx="${c}" cy="${c}" r="3" fill="#fff" stroke="#0d0f18" stroke-width="1.6"/></g></svg>`
  );
})();

export const cobwebUrl = `data:image/svg+xml;utf8,${encodeURIComponent(COBWEB_SVG)}`;

export const ICON = {
  rebirth: img('/ui/rebirth.png', 'Rebirth'),
  pets: img('/ui/Pets.png', 'Pets'),
  backpack: img('/ui/inventory.png', 'Backpack'),
  trophy: img('/ui/trophy.png', 'Trophies'),
  shoe: img('/ui/shoe.png', 'Speed'),
  sound: img('/ui/Sound.png', 'Music'),
  web: WEB_SVG,
  webImg: `<img src="${webIconUrl}" alt="" draggable="false" />`,
  cobweb: `<img class="sp-cobweb" src="${cobwebUrl}" alt="" draggable="false" />`,
  swings:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M52 4 30 30" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="26" cy="30" r="9" fill="#d8202c" stroke="#0d0f18" stroke-width="3"/><path d="M20 28c2-3 4-3 6 0M26 28c2-3 4-3 6 0" stroke="#fff" stroke-width="2.4" fill="none"/>' +
    '<path d="M22 38l-4 14M30 38l8 12M18 36l-8 4M34 34l10-6" stroke="#1f4fd6" stroke-width="6" stroke-linecap="round"/></svg>',
  teleport:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#1a7ae0" stroke="#0d0f18" stroke-width="3.5"/>' +
    '<path d="M32 10a22 22 0 1 1-20 13" fill="none" stroke="#7af0ff" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M32 20a12 12 0 1 1-11 7" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#fff"/></svg>',
  stats:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="6" width="48" height="52" rx="8" fill="#1aa89a" stroke="#0d0f18" stroke-width="3.5"/>' +
    '<rect x="16" y="34" width="7" height="16" fill="#fff"/><rect x="28" y="24" width="7" height="26" fill="#ffe23a"/><rect x="40" y="14" width="7" height="36" fill="#ff5a5a"/></svg>',
  auto:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 8v28l-6-6c-3-3-8 1-5 5l14 17c3 4 7 6 12 6h4c8 0 13-6 13-14V28c0-4-6-4-6 0v-4c0-4-6-4-6 0v-2c0-4-6-4-6 0V8c0-5-8-5-8 0z" fill="#fff" stroke="#0d0f18" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M8 12a10 10 0 0 1 10-8M8 22a20 20 0 0 1 4-12" stroke="#ffe23a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  gear:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 16c6-8 30-8 36 0 4 8 2 22-6 30-6 6-18 6-24 0-8-8-10-22-6-30z" fill="#4fb84a" stroke="#0d0f18" stroke-width="3.5"/>' +
    '<path d="M20 28l10 4-10 4zM44 28l-10 4 10 4z" fill="#ffe23a" stroke="#0d0f18" stroke-width="2"/><path d="M24 44h16" stroke="#0d0f18" stroke-width="3"/>' +
    '<path d="M6 20l8-6M58 20l-8-6" stroke="#4fb84a" stroke-width="5" stroke-linecap="round"/></svg>',
  suit:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#e0202a" stroke="#0d0f18" stroke-width="3" d="M32 4C16 4 7 16 7 30c0 16 11 30 25 30s25-14 25-30C57 16 48 4 32 4z"/>' +
    '<g stroke="#3a0508" stroke-width="1.2" fill="none" opacity=".7"><path d="M32 4v56M7 30h50M12 14l40 36M52 14 12 50"/><circle cx="32" cy="30" r="12"/><circle cx="32" cy="30" r="22"/></g>' +
    '<path fill="#fff" stroke="#0d0f18" stroke-width="3" d="M14 26c4-4 12-4 15 4-4 6-12 6-15-4zM50 26c-4-4-12-4-15 4 4 6 12 6 15-4z"/></svg>',
  shooter:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="20" width="36" height="24" rx="6" fill="#3a4050" stroke="#0d0f18" stroke-width="3.5"/>' +
    '<rect x="22" y="14" width="20" height="10" rx="3" fill="#3f9dff" stroke="#0d0f18" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="#dfe6ee"/>' +
    '<path d="M50 32h10M54 26l6-4M54 38l6 4" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>',
  health:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 6h20v16h16v20H42v16H22V42H6V22h16z" fill="#4aff6a" stroke="#0d0f18" stroke-width="3.5" stroke-linejoin="round"/></svg>',
  /** The close X: a fat white cross with an ink outline, so it reads on any red. */
  close:
    '<svg class="sp-x" viewBox="0 0 32 32" aria-hidden="true"><g stroke-linecap="round"><path d="M9 9l14 14M23 9 9 23" stroke="#1a0508" stroke-width="9"/>' +
    '<path d="M9 9l14 14M23 9 9 23" stroke="#fff" stroke-width="5"/><path d="M9.6 8.4l3.2 3.2M22.4 8.4l-3.2 3.2" stroke="#ffe0e4" stroke-width="1.6" opacity=".9"/></g></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7"/></svg>',
  kills:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#e03a3a" stroke="#0d0f18" stroke-width="3.5"/>' +
    '<path stroke="#fff" stroke-width="6" stroke-linecap="round" d="M20 20l24 24M44 20 20 44"/></svg>',
} as const;
