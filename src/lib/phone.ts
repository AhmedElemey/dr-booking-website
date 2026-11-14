const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Converts Arabic-Indic and Persian digits to ASCII. */
export function toAsciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(
      code >= EXTENDED_ARABIC_INDIC_ZERO
        ? code - EXTENDED_ARABIC_INDIC_ZERO
        : code - ARABIC_INDIC_ZERO,
    );
  });
}

/**
 * Normalizes an Egyptian mobile number to E.164 (`01012345678` becomes
 * `+201012345678`). Returns `null` when it is not a valid `+20 1[0125]x` number.
 */
export function normalizeEgyptPhone(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[\s\-().]/g, "");
  const match = /^(?:\+?20|0)?(1[0125]\d{8})$/.exec(digits);
  return match ? `+20${match[1]}` : null;
}

/** Display form of an E.164 Egyptian number: `+20 101 234 5678`. */
export function formatEgyptPhone(e164: string): string {
  const m = /^\+20(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+20 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Wraps an LTR token (phone number) in Unicode isolates so it renders intact inside RTL text. */
export function isolateLtr(value: string): string {
  return `⁦${value}⁩`;
}
