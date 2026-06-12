import crypto from "crypto";

export type CardmarketOAuthMode = "compat" | "strict";

export type CardmarketAttempt = {
  mode: CardmarketOAuthMode;
  realm: boolean;
};

export type CardmarketTextResponse = {
  url: string;
  text: string;
  contentType: string;
  attempt: CardmarketAttempt;
};

function mustEnv(name: string) {
  const value = (process.env[name] ?? "").trim();

  if (!value && name !== "CM_ACCESS_TOKEN" && name !== "CM_ACCESS_SECRET") {
    throw new Error(`Missing env ${name}`);
  }

  return value;
}

function enc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildOAuthHeader(input: {
  method: "GET" | "POST";
  url: string;
  mode: CardmarketOAuthMode;
  withRealm: boolean;
}) {
  const appToken = mustEnv("CM_APP_TOKEN");
  const appSecret = mustEnv("CM_APP_SECRET");
  const accessToken = (process.env.CM_ACCESS_TOKEN ?? "").trim();
  const accessSecret = (process.env.CM_ACCESS_SECRET ?? "").trim();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const parsedUrl = new URL(input.url);

  const oauth: Record<string, string> = {
    oauth_consumer_key: appToken,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: "1.0",
  };

  const baseParams: Record<string, string> = { ...oauth };

  if (input.mode === "strict") {
    parsedUrl.searchParams.forEach((value, key) => {
      baseParams[key] = value;
    });
  }

  const baseParamsString = Object.keys(baseParams)
    .sort()
    .map((key) => `${enc3986(key)}=${enc3986(baseParams[key])}`)
    .join("&");

  const baseString = [
    input.method,
    enc3986(parsedUrl.origin + parsedUrl.pathname),
    enc3986(baseParamsString),
  ].join("&");

  const signingKey = `${enc3986(appSecret)}&${enc3986(accessSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const headerParams: Record<string, string> = {
    ...oauth,
    oauth_signature: signature,
  };

  const authCore =
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((key) => `${key}="${enc3986(headerParams[key])}"`)
      .join(", ");

  const authHeader = input.withRealm
    ? `${authCore}, realm="${enc3986(input.url)}"`
    : authCore;

  return {
    Authorization: authHeader,
    Accept: "application/json",
    "User-Agent": "CardHousePokemonBuylist/1.0",
  };
}

function buildCardmarketUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `https://apiv2.cardmarket.com/ws/v2.0/output.json${cleanPath}`;
}

export async function cardmarketGetText(pathOrUrl: string): Promise<CardmarketTextResponse> {
  const url = buildCardmarketUrl(pathOrUrl);
  const attempts: CardmarketAttempt[] = [
    { mode: "strict", realm: true },
    { mode: "strict", realm: false },
    { mode: "compat", realm: true },
    { mode: "compat", realm: false },
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    const headers = buildOAuthHeader({
      method: "GET",
      url,
      mode: attempt.mode,
      withRealm: attempt.realm,
    });

    const response = await fetch(url, {
      headers,
      cache: "no-store",
    });

    const text = await response.text().catch(() => "");
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      errors.push(
        `[${response.status}] ${attempt.mode}/${attempt.realm} @ ${url}: ${text.slice(0, 350)}`
      );
      continue;
    }

    return {
      url,
      text,
      contentType,
      attempt,
    };
  }

  throw new Error(`Cardmarket request failed:\n${errors.join("\n")}`);
}

export async function cardmarketGetJson<T = unknown>(pathOrUrl: string): Promise<{
  data: T;
  response: CardmarketTextResponse;
}> {
  const response = await cardmarketGetText(pathOrUrl);

  try {
    return {
      data: JSON.parse(response.text) as T,
      response,
    };
  } catch (error: any) {
    throw new Error(
      `Cardmarket returned invalid JSON for ${response.url}: ${error?.message ?? "parse error"}`
    );
  }
}
