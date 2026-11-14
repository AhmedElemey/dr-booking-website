// Brand colour helpers: derive the full CSS token set from the two hex colours
// in clinic.config.json (primary and accent).

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Invalid hex colour: ${hex}`);
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Linear mix: `amount` 0 returns `from`, 1 returns `to`. */
export function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  return toHex(a.map((c, i) => c + (b[i] - c) * amount) as Rgb);
}

const BLACK = "#000000";
const WHITE = "#ffffff";
const NIGHT = "#0d0f24";

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string): string {
  const l = luminance(background);
  const contrast = (other: string) => {
    const o = luminance(other);
    return (Math.max(l, o) + 0.05) / (Math.min(l, o) + 0.05);
  };
  return contrast(WHITE) >= contrast(NIGHT) ? WHITE : NIGHT;
}

export type BrandTokens = {
  "--primary": string;
  "--primary-hover": string;
  "--primary-foreground": string;
  "--accent": string;
  "--accent-soft": string;
};

/** Light-theme tokens. For the default colours this lands within a few units of the original palette. */
export function lightTokens(primary: string, accent: string): BrandTokens {
  return {
    "--primary": primary.toLowerCase(),
    "--primary-hover": mix(primary, BLACK, 0.17),
    "--primary-foreground": readableOn(primary),
    "--accent": accent.toLowerCase(),
    "--accent-soft": mix(accent, WHITE, 0.87),
  };
}

/** Dark-theme tokens: lighter brand colours that keep contrast on the dark background. */
export function darkTokens(primary: string, accent: string): BrandTokens {
  const dark = readableOn(primary) === WHITE ? mix(primary, WHITE, 0.4) : primary.toLowerCase();
  return {
    "--primary": dark,
    "--primary-hover": mix(dark, WHITE, 0.2),
    "--primary-foreground": readableOn(dark),
    "--accent": mix(accent, WHITE, 0.35),
    "--accent-soft": mix(accent, NIGHT, 0.7),
  };
}

function block(tokens: BrandTokens): string {
  return Object.entries(tokens)
    .map(([name, value]) => `${name}:${value};`)
    .join("");
}

/** CSS that defines the brand tokens for light and dark colour schemes. */
export function brandCss(primary: string, accent: string): string {
  return (
    `:root{${block(lightTokens(primary, accent))}}` +
    `@media (prefers-color-scheme: dark){:root{${block(darkTokens(primary, accent))}}}`
  );
}
