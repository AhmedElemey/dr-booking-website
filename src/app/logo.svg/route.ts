import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import { clinicConfig } from "@/lib/clinic-config";

// The clinic logo (`logo` in clinic.config.json) is read at build time and
// served at /logo.svg, so no generated copy needs to be committed.
export const dynamic = "force-static";

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET() {
  const file = resolve(process.cwd(), clinicConfig.logo);
  return new Response(readFileSync(file), {
    headers: {
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "public, max-age=3600",
    },
  });
}
