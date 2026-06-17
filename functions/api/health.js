export async function onRequest() {
  return new Response(
    JSON.stringify({ ok: true, source: "pages-functions" }),
    { headers: { "Content-Type": "application/json" } }
  );
}
