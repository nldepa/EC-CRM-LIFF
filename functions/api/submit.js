export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    let backendUrl = env.BACKEND_URL || "http://localhost:3000";
    const liffBindSecret = env.LIFF_BIND_SECRET || "liff_bind_secret_key_2026_secure";
    const accessHeaders =
      env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET
        ? {
          "CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
          "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET,
        }
        : {};

    if (backendUrl.includes("://") && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      backendUrl = backendUrl.replace(/\/$/, "");
      if (!backendUrl.endsWith("/api")) {
        backendUrl = `${backendUrl}/api`;
      }
    } else {
      backendUrl = backendUrl.replace(/\/$/, "");
    }

    const { customer_name, email, line_uid, line_display_name, utm_source, utm_medium } = body;
    console.log("Pages Function submit.js received payload:", JSON.stringify(body));

    if (!customer_name || !customer_name.trim() || !email || !email.trim() || !line_uid || !line_uid.trim()) {
      console.warn("Pages Function validation failed: missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: customer_name, email, or line_uid." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const fetchUrl = `${backendUrl}/customers/public/liff-bind`;
    console.log("Pages Function forwarding payload to backend URL:", fetchUrl);
    console.log(
      "Pages Function runtime config:",
      JSON.stringify({
        backendHost: new URL(fetchUrl).host,
        backendPath: new URL(fetchUrl).pathname,
        hasLiffBindSecret: Boolean(liffBindSecret),
        hasAccessClientId: Boolean(env.CF_ACCESS_CLIENT_ID),
        hasAccessClientSecret: Boolean(env.CF_ACCESS_CLIENT_SECRET),
      }),
    );

    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-liff-bind-secret": liffBindSecret,
        ...accessHeaders,
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
    const contentType = response.headers.get("content-type") || "";
    console.log(`Pages Function received response from backend (Status: ${response.status}):`, rawData);

    let data = null;
    try {
      data = JSON.parse(rawData);
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error(`Pages Function forward request failed with status: ${response.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: data?.message || rawData || "Backend request failed.",
          backend_status: response.status,
          backend_content_type: contentType,
          backend_host: new URL(fetchUrl).host,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!data || data.success !== true) {
      const looksLikeAccessPage =
        contentType.includes("text/html") ||
        rawData.includes("Cloudflare Access") ||
        rawData.includes("/cdn-cgi/access/");

      console.error(
        "Pages Function expected backend JSON but received a different response.",
        JSON.stringify({ status: response.status, contentType, looksLikeAccessPage }),
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: looksLikeAccessPage
            ? "Backend is blocked by Cloudflare Access. Bypass /api/customers/public/liff-bind or use an Access service token."
            : "Backend did not return the expected LIFF binding JSON.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unexpected LIFF submit error." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
