export async function onRequestGet({ env }) {
  const required = [
    "LIFF_ID_MAIN",
    "LIFF_ID_LOG",
    "LINE_LOGIN_CHANNEL_ID",
    "TUNNEL_BASE",
    "CF_ACCESS_CLIENT_ID",
    "CF_ACCESS_CLIENT_SECRET",
  ];

  const provided = {};
  const missing = [];

  for (const key of required) {
    const value = env[key];
    if (value && value.trim() !== "") {
      provided[key] = key.includes("SECRET") ? "(set)" : value;
    } else {
      provided[key] = null;
      missing.push(key);
    }
  }

  const result = {
    ok: missing.length === 0,
    env: provided,
    missing,
    branch: env.CF_PAGES_BRANCH || "unknown",
    hint:
      missing.length > 0
        ? `請到 Pages → Settings → Environment variables 補上缺少項目 (${missing.join(", ")})`
        : "All good 🎉",
  };

  return new Response(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
