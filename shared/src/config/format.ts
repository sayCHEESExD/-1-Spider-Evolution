/**
 * Number formatting shared by the HUD, the world signs and the boards, so a
 * figure reads the same everywhere it appears.
 */

/** One suffix per power of a thousand: K (1e3) through Ce (1e303). */
const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod',
  'Vg', 'Uvg', 'Dvg', 'Tvg', 'Qavg', 'Qivg', 'Sxvg', 'Spvg', 'Ocvg', 'Novg',
  'Tg', 'Utg', 'Dtg', 'Ttg', 'Qatg', 'Qitg', 'Sxtg', 'Sptg', 'Octg', 'Notg',
  'Qag', 'Uqag', 'Dqag', 'Tqag', 'Qaqag', 'Qiqag', 'Sxqag', 'Spqag', 'Ocqag', 'Noqag',
  'Qig', 'Uqig', 'Dqig', 'Tqig', 'Qaqig', 'Qiqig', 'Sxqig', 'Spqig', 'Ocqig', 'Noqig',
  'Sxg', 'Usxg', 'Dsxg', 'Tsxg', 'Qasxg', 'Qisxg', 'Sxsxg', 'Spsxg', 'Ocsxg', 'Nosxg',
  'Spg', 'Uspg', 'Dspg', 'Tspg', 'Qaspg', 'Qispg', 'Sxspg', 'Spspg', 'Ocspg', 'Nospg',
  'Ocg', 'Uocg', 'Docg', 'Tocg', 'Qaocg', 'Qiocg', 'Sxocg', 'Spocg', 'Ococg', 'Noocg',
  'Nog', 'Unog', 'Dnog', 'Tnog', 'Qanog', 'Qinog', 'Sxnog', 'Spnog', 'Ocnog', 'Nonog',
  'Ce',
] as const;

/**
 * Compact display: 940, 1.4K, 13.2K, 453K, 3.1M, 2.5B, 4T, 7.2Qa, 1.1Qi, 5Sx ...
 * a suffix for every power of a thousand a float64 can hold, so no figure the
 * game produces ever prints as a wall of digits (or "Infinity").
 */
export const formatAmount = (value: number): string => {
  if (value === Number.POSITIVE_INFINITY) return '∞';
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (amount < 1_000) return Math.floor(amount).toString();
  let tier = Math.min(Math.floor(Math.log10(amount) / 3), SUFFIXES.length - 1);
  // log10 can land a hair under an exact power of a thousand.
  if (amount / 1000 ** (tier + 1) >= 1 && tier + 1 < SUFFIXES.length) tier += 1;
  const scaled = amount / 1000 ** tier;
  // Truncated, never rounded up: 1,999 is "1.9K", not a "2K" the player does not have.
  const text = scaled >= 100 ? Math.floor(scaled).toString() : (Math.floor(scaled * 10) / 10).toString();
  return `${text}${SUFFIXES[tier]}`;
};

/** A count (rebirths, levels) as the menus print it: exact under a hundred thousand, compact past it. */
export const formatCount = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return amount < 100_000 ? amount.toLocaleString('en-US') : formatAmount(amount);
};

/** Wins as the HUD prints them: exact under ten thousand, compact past it. */
export const formatWins = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return amount < 10_000 ? amount.toLocaleString('en-US') : formatAmount(amount);
};

/** A multiplier as the menus print it: x1, x2, x2.5. */
export const formatMultiplier = (value: number): string => {
  if (value >= 10_000) return 'x' + formatAmount(value);
  const rounded = Math.round(value * 100) / 100;
  return `x${Number.isInteger(rounded) ? rounded.toString() : rounded.toString()}`;
};

/** A percentage bonus: +7%, +22.4%. */
export const formatPercent = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return `+${rounded}%`;
};

/** mm:ss for a countdown. */
export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, '0')}m ${(s % 60).toString().padStart(2, '0')}s`;
};

/** Time played, as a board prints it: 45s, 12m, 3h 20m, 2d 4h. */
export const formatPlayTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};
