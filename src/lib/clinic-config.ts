import raw from "../../clinic.config.json";

// Typed loader for clinic.config.json (the clinic's identity). It is imported
// at build time, validated on first import, and a bad file fails `next build`.

export type Localized = { ar: string; en: string };

export const FEATURE_KEYS = [
  "mobileApp",
  "website",
  "guestBrowsing",
  "patientSelfService",
  "pushReminders",
  "smsNotifications",
  "englishLanguage",
  "multiBranch",
  "videoConsultation",
  "waitingList",
  "familyAccounts",
  "whatsappReminders",
  "onlinePayments",
  "insurance",
  "holidayCalendar",
  "workingHoursTemplates",
  "patientRecords",
  "reviews",
  "promotions",
  "recallCampaigns",
  "reports",
] as const;

/** The 13 phase-2 features, all off by default; every one hides its screens when off. */
export const PHASE2_FEATURE_KEYS = [
  "videoConsultation",
  "waitingList",
  "familyAccounts",
  "whatsappReminders",
  "onlinePayments",
  "insurance",
  "holidayCalendar",
  "workingHoursTemplates",
  "patientRecords",
  "reviews",
  "promotions",
  "recallCampaigns",
  "reports",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type Features = Record<FeatureKey, boolean>;

export type ClinicConfig = {
  slug: string;
  name: Localized;
  tagline: Localized;
  colors: { primary: string; accent: string };
  logo: string;
  supportPhone: string;
  website: { domain: string };
  mobile: { androidApplicationId: string; iosBundleId: string };
  console: { url: string; clinicId: string };
  features: Features;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const PHONE = /^\+?[0-9 ()-]{6,20}$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates an unknown value as a clinic config; throws one error listing every problem. */
export function parseClinicConfig(value: unknown): ClinicConfig {
  const errors: string[] = [];
  const obj = (parent: unknown, key: string, path: string): Record<string, unknown> => {
    const v = isObject(parent) ? parent[key] : undefined;
    if (!isObject(v)) {
      errors.push(`${path} must be an object`);
      return {};
    }
    return v;
  };
  const str = (parent: Record<string, unknown>, key: string, path: string, re?: RegExp, max?: number) => {
    const v = parent[key];
    if (typeof v !== "string" || v.trim() === "") {
      errors.push(`${path} must be a non-empty string`);
      return "";
    }
    if (re && !re.test(v)) errors.push(`${path} has an invalid format: ${v}`);
    if (max && v.length > max) errors.push(`${path} is longer than ${max} characters`);
    return v;
  };
  const optStr = (parent: Record<string, unknown>, key: string, path: string) => {
    const v = parent[key];
    if (typeof v !== "string") {
      errors.push(`${path} must be a string`);
      return "";
    }
    return v;
  };
  const localized = (parent: Record<string, unknown>, key: string, path: string): Localized => {
    const o = obj(parent, key, path);
    return { ar: str(o, "ar", `${path}.ar`), en: str(o, "en", `${path}.en`) };
  };

  const root = isObject(value) ? value : {};
  if (!isObject(value)) errors.push("config must be an object");

  const colors = obj(root, "colors", "colors");
  const website = obj(root, "website", "website");
  const mobile = obj(root, "mobile", "mobile");
  const consoleObj = obj(root, "console", "console");
  const featuresObj = obj(root, "features", "features");

  const features = {} as Features;
  for (const key of FEATURE_KEYS) {
    const v = featuresObj[key];
    if (typeof v !== "boolean") errors.push(`features.${key} must be true or false`);
    features[key] = v === true;
  }

  const config: ClinicConfig = {
    slug: str(root, "slug", "slug", SLUG, 40),
    name: localized(root, "name", "name"),
    tagline: localized(root, "tagline", "tagline"),
    colors: {
      primary: str(colors, "primary", "colors.primary", HEX),
      accent: str(colors, "accent", "colors.accent", HEX),
    },
    logo: str(root, "logo", "logo"),
    supportPhone: str(root, "supportPhone", "supportPhone", PHONE),
    website: { domain: str(website, "domain", "website.domain") },
    mobile: {
      androidApplicationId: str(mobile, "androidApplicationId", "mobile.androidApplicationId"),
      iosBundleId: str(mobile, "iosBundleId", "mobile.iosBundleId"),
    },
    console: {
      url: optStr(consoleObj, "url", "console.url"),
      clinicId: optStr(consoleObj, "clinicId", "console.clinicId"),
    },
    features,
  };

  if (errors.length > 0) {
    throw new Error(`Invalid clinic.config.json:\n- ${errors.join("\n- ")}`);
  }
  return config;
}

export const clinicConfig: ClinicConfig = parseClinicConfig(raw);

type LocaleLike = string;
const pick = (value: Localized, locale: LocaleLike) => (locale === "en" ? value.en : value.ar);

export const brandName = (locale: LocaleLike) => pick(clinicConfig.name, locale);
export const brandTagline = (locale: LocaleLike) => pick(clinicConfig.tagline, locale);

/** Public path of the clinic logo, served from `branding/` by `src/app/logo.svg/route.ts` (no copy step). */
export function logoPublicPath(): string {
  return "/logo.svg";
}

/** Phone as dialled (digits and a leading +). */
export const dialablePhone = (phone: string = clinicConfig.supportPhone) =>
  phone.replace(/[^\d+]/g, "");

export const contactEmail = () => `hello@${clinicConfig.website.domain}`;

/**
 * Replaces `{brand}` and `{tagline}` placeholders in a message tree with the
 * clinic's name/tagline for the locale, so translations never hard-code a name.
 * Braces are ICU-escaped so unusual names cannot break message formatting.
 */
export function applyBrand<T>(messages: T, locale: LocaleLike): T {
  const escape = (s: string) => s.replace(/[{}]/g, "'$&'");
  const values = { "{brand}": escape(brandName(locale)), "{tagline}": escape(brandTagline(locale)) };
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      return node.replace(/\{brand\}|\{tagline\}/g, (m) => values[m as keyof typeof values]);
    }
    if (Array.isArray(node)) return node.map(walk);
    if (isObject(node)) return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    return node;
  };
  return walk(messages) as T;
}
