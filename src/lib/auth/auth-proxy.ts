import type { OtpVerifyResult, TokenResponse } from "../api/types";
import {
  type BackendCall,
  type ProxyResult,
  type Tokens,
  refreshTokens,
  tokenUpdateFrom,
} from "./session";

// `app/api/auth/*`: proxies the OTP flow to the API and turns the returned token
// pair into httpOnly cookies. Tokens are stripped from the body sent to the browser.

export type AuthAction = "otp/request" | "otp/verify" | "logout";

const ACTIONS: readonly string[] = ["otp/request", "otp/verify", "logout"];

export function parseAuthAction(segments: string[]): AuthAction | null {
  const action = segments.join("/");
  return ACTIONS.includes(action) ? (action as AuthAction) : null;
}

type AuthRequest = {
  action: AuthAction;
  headers: Headers;
  body: string;
  tokens: Tokens;
  backend: BackendCall;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function forwardHeaders(headers: Headers, accessToken?: string): Headers {
  const out = new Headers({ "content-type": "application/json" });
  const language = headers.get("accept-language");
  if (language) out.set("accept-language", language);
  out.set("accept", "application/json");
  if (accessToken) out.set("authorization", `Bearer ${accessToken}`);
  return out;
}

function passthrough(upstream: Response): Response {
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function proxyAuth(req: AuthRequest): Promise<ProxyResult> {
  switch (req.action) {
    case "otp/request": {
      const upstream = await req.backend("/auth/otp/request", {
        method: "POST",
        headers: forwardHeaders(req.headers),
        body: req.body,
        cache: "no-store",
      });
      return { response: passthrough(upstream) };
    }

    case "otp/verify": {
      const upstream = await req.backend("/auth/otp/verify", {
        method: "POST",
        headers: forwardHeaders(req.headers),
        body: req.body,
        cache: "no-store",
      });
      if (!upstream.ok) return { response: passthrough(upstream) };

      const tokens = (await upstream.json()) as TokenResponse;
      const result: OtpVerifyResult = {
        isNewUser: Boolean(tokens.isNewUser),
        user: tokens.user as OtpVerifyResult["user"],
      };
      return { response: json(result), tokenUpdate: tokenUpdateFrom(tokens) };
    }

    case "logout": {
      let accessToken = req.tokens.accessToken;
      if (!accessToken && req.tokens.refreshToken) {
        accessToken = (await refreshTokens(req.tokens.refreshToken, req.backend))
          ?.accessToken;
      }
      if (accessToken) {
        try {
          await req.backend("/auth/logout", {
            method: "POST",
            headers: forwardHeaders(req.headers, accessToken),
            cache: "no-store",
          });
        } catch {
          // The session is cleared locally even if the API is unreachable.
        }
      }
      return { response: json({ ok: true }), tokenUpdate: { type: "clear" } };
    }
  }
}
