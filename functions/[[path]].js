// ==========================================
// functions/_middleware.js
// 攔截所有請求並動態插入 LIFF_ID
// ==========================================

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();

  // ✅ 靜態或 API 放行
  if (path.startsWith("/api/")) return next();
  if (path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/i)) return next();

  try {
    const isLogPage = path.includes("log") || path === "/log";
    const liffId = isLogPage ? env.LIFF_ID_LOG : env.LIFF_ID_MAIN;
    const htmlFileName = isLogPage ? "line-log.html" : "index.html";

    console.log("🔧 Path:", path, "| LIFF ID:", liffId);

    const assetUrl = new URL(`/${htmlFileName}`, url.origin);
    const assetResponse = await env.ASSETS.fetch(assetUrl);

    if (!assetResponse.ok) {
      return new Response(`檔案不存在: ${htmlFileName}`, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const contentType = assetResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return assetResponse;

    let html = await assetResponse.text();
    html = html.replace(/\{\{LIFF_ID\}\}/g, liffId || "(未設定 LIFF_ID)");

    console.log("✅ HTML 替換完成:", htmlFileName);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    console.error("❌ Middleware 錯誤:", err);
    return new Response(
      `<!doctype html><html><body><h1>伺服器錯誤</h1><pre>${err}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
