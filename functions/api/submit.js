export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    // 1. Read configuration from environment variables
    let backendUrl = env.BACKEND_URL || "http://localhost:3000";
    const liffBindSecret = env.LIFF_BIND_SECRET || "liff_bind_secret_key_2026_secure";

    // Format backendUrl to route correctly through the Nginx / Vite proxy if it's a public domain
    if (backendUrl.includes("://") && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      // Remove trailing slash if present
      backendUrl = backendUrl.replace(/\/$/, "");
      // If the URL doesn't end with /api, append /api so that it routes correctly
      if (!backendUrl.endsWith("/api")) {
        backendUrl = backendUrl + "/api";
      }
    } else {
      // For local development on localhost:3000, remove trailing slash
      backendUrl = backendUrl.replace(/\/$/, "");
    }

    // 2. Extract and validate required fields
    const { customer_name, email, line_uid, line_display_name, utm_source, utm_medium } = body;
    if (!customer_name || !customer_name.trim() || !email || !email.trim() || !line_uid || !line_uid.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "姓名、Email 與 LINE UID 為必填欄位！" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Forward payload to backend Docker API
    const response = await fetch(`${backendUrl}/customers/public/liff-bind`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-liff-bind-secret": liffBindSecret,
      },
      body: JSON.stringify({
        customer_name: customer_name.trim(),
        email: email.trim(),
        line_uid: line_uid.trim(),
        line_display_name: line_display_name ? line_display_name.trim() : null,
        utm_source: utm_source ? utm_source.trim() : null,
        utm_medium: utm_medium ? utm_medium.trim() : null,
      }),
    });

    const rawData = await response.text();
    let data;
    try {
      data = JSON.parse(rawData);
    } catch {
      data = { message: rawData };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.message || "綁定後端資料庫失敗，請確認資料是否正確。" }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "系統處理錯誤，請稍後再試。" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
