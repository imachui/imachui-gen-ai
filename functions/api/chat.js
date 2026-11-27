export async function onRequest(context) {
  return new Response("TEST SUCCESS! Nakarating ang message sa Cloudflare backend.", {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
