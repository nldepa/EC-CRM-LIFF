export async function onRequest(context) {
  const req = context.request;
  const url = new URL(req.url);

  return new Response(
    JSON.stringify({
      ok: true,
      hit: "/api/_which",
      method: req.method,
      path: url.pathname,
      headers: Object.fromEntries(req.headers),
      cf: context.cf || null
    }, null, 2),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Route": "pages-functions"
      }
    }
  );
}
