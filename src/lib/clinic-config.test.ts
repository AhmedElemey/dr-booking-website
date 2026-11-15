import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import {
  FEATURE_KEYS,
  PHASE2_FEATURE_KEYS,
  applyBrand,
  brandName,
  brandTagline,
  clinicConfig,
  contactEmail,
  dialablePhone,
  logoPublicPath,
  parseClinicConfig,
} from "./clinic-config";

const root = resolve(__dirname, "../..");
const readJson = (file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8"));
const rawConfig = () => structuredClone(readJson("clinic.config.json"));

// Minimal JSON Schema (draft 2020-12 subset used by clinic.config.schema.json) validator.
type Schema = {
  type?: string;
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  $ref?: string;
};
function validate(value: unknown, schema: Schema, defs: Record<string, Schema>, path = "$"): string[] {
  if (schema.$ref) return validate(value, defs[schema.$ref.replace("#/$defs/", "")], defs, path);
  const errors: string[] = [];
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path}: not an object`];
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in obj)) errors.push(`${path}.${key}: missing`);
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties?.[key];
      if (sub) errors.push(...validate(v, sub, defs, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: unexpected`);
    }
  } else if (schema.type === "string") {
    if (typeof value !== "string") return [`${path}: not a string`];
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: too long`);
  } else if (schema.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path}: not a boolean`);
  }
  return errors;
}

describe("clinic.config.json", () => {
  it("validates against clinic.config.schema.json", () => {
    const schema = readJson("clinic.config.schema.json");
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(validate(rawConfig(), schema, schema.$defs)).toEqual([]);
  });

  it("the schema rejects bad values", () => {
    const schema = readJson("clinic.config.schema.json");
    const bad = rawConfig();
    bad.slug = "Bad Slug";
    bad.colors.primary = "red";
    delete bad.features.website;
    expect(validate(bad, schema, schema.$defs)).toHaveLength(3);
  });

  it("keeps today's identity", () => {
    const raw = rawConfig();
    expect(clinicConfig.slug).toBe(raw.slug);
    expect(clinicConfig.name).toEqual(raw.name);
    expect(clinicConfig.colors).toEqual(raw.colors);
    expect(FEATURE_KEYS).toHaveLength(21);
  });

  it("ships the 13 phase-2 features, all off by default", () => {
    expect(PHASE2_FEATURE_KEYS).toHaveLength(13);
    for (const key of PHASE2_FEATURE_KEYS) {
      expect(FEATURE_KEYS).toContain(key);
      expect(clinicConfig.features[key]).toBe(false);
      expect(rawConfig().features[key]).toBe(false);
    }
  });

  it("lists every feature in the JSON schema", () => {
    const schema = readJson("clinic.config.schema.json") as { properties: { features: { required: string[]; properties: Record<string, unknown> } } };
    expect([...schema.properties.features.required].sort()).toEqual([...FEATURE_KEYS].sort());
    expect(Object.keys(schema.properties.features.properties).sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it("serves the configured logo from branding/ without a copy step", async () => {
    expect(logoPublicPath()).toBe("/logo.svg");
    const { GET } = await import("@/app/logo.svg/route");
    const res = await GET();
    expect(res.headers.get("content-type")).toMatch(/image\/svg\+xml/);
    expect(await res.text()).toBe(readFileSync(resolve(root, clinicConfig.logo), "utf8"));
  });

});

describe("parseClinicConfig", () => {
  it("accepts the shipped file", () => {
    expect(parseClinicConfig(rawConfig()).slug).toBe(rawConfig().slug);
  });

  it("reports every problem at once", () => {
    const bad = rawConfig();
    bad.slug = "x".repeat(41);
    bad.colors.accent = "#12345";
    bad.name.en = "";
    bad.features.guestBrowsing = "yes";
    delete bad.mobile;
    const message = (() => {
      try {
        parseClinicConfig(bad);
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    })();
    for (const part of ["slug", "colors.accent", "name.en", "features.guestBrowsing", "mobile"]) {
      expect(message).toContain(part);
    }
  });

  it("rejects non-objects and non-kebab slugs", () => {
    expect(() => parseClinicConfig(null)).toThrow(/config must be an object/);
    const bad = rawConfig();
    bad.slug = "Moon_Light";
    expect(() => parseClinicConfig(bad)).toThrow(/slug has an invalid format/);
  });
});

describe("brand helpers", () => {
  it("picks name and tagline per locale", () => {
    expect(brandName("en")).toBe(rawConfig().name.en);
    expect(brandName("ar")).toBe(clinicConfig.name.ar);
    expect(brandTagline("en")).toBe(clinicConfig.tagline.en);
  });

  it("derives phone and email", () => {
    expect(dialablePhone("+20 (100) 000-0000")).toBe("+201000000000");
    expect(contactEmail()).toBe(`hello@${rawConfig().website.domain}`);
  });

  it("interpolates the brand into messages and escapes ICU braces", () => {
    const out = applyBrand({ a: "Hi {brand}", b: ["{tagline}"], n: 3 }, "en");
    expect(out).toEqual({ a: `Hi ${clinicConfig.name.en}`, b: [clinicConfig.tagline.en], n: 3 });
    const original = clinicConfig.name.en;
    clinicConfig.name.en = "A{b}";
    expect(applyBrand("{brand}", "en")).toBe("A'{'b'}'");
    clinicConfig.name.en = original;
  });

  it("keeps the clinic name out of the translations", () => {
    const text = JSON.stringify([ar, en]);
    expect(text).not.toMatch(/moonlight/i);
    expect(text).not.toContain("مون لايت");
    expect(text).not.toContain(clinicConfig.name.ar);
    expect(JSON.stringify(en)).toContain("{brand}");
    expect(JSON.stringify(ar)).toContain("{brand}");
  });
});
