// =====================================================
// Cloudflare Pages Function: /api/line-receiver
// FINAL PRODUCTION VERSION
// =====================================================

const ALLOWED_ORIGIN = "https://liff.nldepa.org.tw";

// -----------------------------------------------------
// CORS helper
// -----------------------------------------------------
function corsHeaders(req) {
  const origin = req?.headers?.get("Origin");
  if (origin !== ALLOWED_ORIGIN) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

function applyUtmMapping(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const map = {
    utm_source: "utm_source_code",
    utm_medium: "utm_medium_code",
    utm_campaign: "utm_campaign_code",
    utm_content: "utm_content_code",
    utm_term: "utm_term_code",
  };

  for (const [srcKey, dstKey] of Object.entries(map)) {
    const dstVal = payload[dstKey];
    if (dstVal == null || dstVal === "") {
      const srcVal = payload[srcKey];
      payload[dstKey] = srcVal == null ? "" : String(srcVal);
    }
  }

  // (optional) if you want to hide the original UTM keys from PHP, uncomment:
  // for (const srcKey of Object.keys(map)) delete payload[srcKey];

  return payload;
}

// -----------------------------------------------------
// JSON Response helper
// -----------------------------------------------------
function jsonResponse(obj, status = 200, req) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(req),
    },
  });
}

// =====================================================
// OPTIONS — CORS Preflight（瀏覽器一定會先打）
// =====================================================
export async function onRequestOptions(context) {
  const headers = corsHeaders(context.request);

  // 非允許來源，直接拒絕
  if (!headers["Access-Control-Allow-Origin"]) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

// =====================================================
// POST — 主流程
// =====================================================
export async function onRequestPost(context) {
  const { request, env } = context;
  let data;

  // ---------------------------------------------------
  // 1️⃣ Origin 驗證（只允許 LIFF 網域）
// ---------------------------------------------------
  const origin = request.headers.get("Origin");
  if (origin !== ALLOWED_ORIGIN) {
    return jsonResponse(
      { ok: false, error: "forbidden_origin" },
      403,
      request
    );
  }

  // ---------------------------------------------------
  // 2️⃣ Content-Type 驗證
  // ---------------------------------------------------
  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return jsonResponse(
      { ok: false, error: "invalid_content_type" },
      415,
      request
    );
  }

  // ---------------------------------------------------
  // 3️⃣ 解析 JSON
  // ---------------------------------------------------
  try {
    data = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "invalid_json_body" },
      400,
      request
    );
  }

  const id_token = data?.id_token;
  if (!id_token) {
    return jsonResponse(
      { ok: false, error: "missing_id_token" },
      400,
      request
    );
  }

  try {
    // =================================================
    // 4️⃣ 驗證 LINE id_token
    // =================================================
    const verifyResp = await fetch(
      "https://api.line.me/oauth2/v2.1/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          id_token,
          client_id: env.LINE_LOGIN_CHANNEL_ID,
        }),
      }
    );

    const verifyText = await verifyResp.text();
    let verifyJson;
    try {
      verifyJson = JSON.parse(verifyText);
    } catch {
      verifyJson = null;
    }

    if (!verifyResp.ok || !verifyJson?.sub) {
      console.warn("⚠️ LINE id_token 驗證失敗:", verifyText);
      return jsonResponse(
        {
          ok: false,
          error: "invalid_id_token",
          detail: verifyText,
        },
        401,
        request
      );
    }

    // =================================================
    // 5️⃣ 取得 LINE userId
    // =================================================
    const line_user_id = verifyJson.sub;

    console.log("✅ LINE verify success", {
      userId: line_user_id,
      aud: verifyJson.aud,
      exp: new Date(verifyJson.exp * 1000).toISOString(),
    });

    // =================================================
    // 6️⃣ 準備送給 PHP 的 payload
    // =================================================
    const payload = {
      ...data,
      line_user_id,
      activity: data.activity || "line_form",
    };
    applyUtmMapping(payload);

    // ❗安全：不轉發 id_token
    delete payload.id_token;

    // =================================================
    // 7️⃣ 組合後端 URL（已驗證存在）
    // =================================================
    const upstreamPath = (env.UPSTREAM_PATH || "/line-receiver.php").trim();
    const upstreamUrl = new URL(
      upstreamPath.startsWith("/") ? upstreamPath : `/${upstreamPath}`,
      env.TUNNEL_BASE
    ).toString();

    console.log("➡️ Forwarding to upstream:", upstreamUrl);

    // =================================================
    // 8️⃣ 組合 headers（給 PHP 驗證用）
    // =================================================
    const headers = {
      "Content-Type": "application/json",
    };

    if (env.CF_ACCESS_CLIENT_ID) {
      headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    }
    if (env.CF_ACCESS_CLIENT_SECRET) {
      headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
    }
    if (env.RECEIVER_LINE_API_KEY) {
      headers["X-API-Key"] = env.RECEIVER_LINE_API_KEY;
    }

    // =================================================
    // 9️⃣ 轉送到 PHP
    // =================================================
    const resp = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch {
      result = {
        ok: resp.ok,
        message: text || "no response body",
      };
    }

    return jsonResponse(
      result,
      resp.ok ? 200 : resp.status,
      request
    );
  } catch (err) {
    console.error("❌ line-receiver exception:", err);
    return jsonResponse(
      {
        ok: false,
        error: "internal_exception",
        detail: err.message,
      },
      500,
      request
    );
  }
}
