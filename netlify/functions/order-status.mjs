import { MAX_DOWNLOADS, ORDER_ID_RE, VOLUMES, ordersStore } from "./lib/volumes.mjs";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("order") || "";
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (!ORDER_ID_RE.test(id)) return new Response(JSON.stringify({ status: "unknown" }), { headers });

  const order = await ordersStore().get(`order-${id}`, { type: "json" });
  if (!order) return new Response(JSON.stringify({ status: "unknown" }), { headers });

  let status = order.status;
  if (status === "paid" && Date.now() > order.expiresAt) status = "expired";
  return new Response(
    JSON.stringify({
      status,
      title: VOLUMES[order.volume]?.title,
      downloadsLeft: Math.max(0, MAX_DOWNLOADS - order.downloads),
      expiresAt: order.expiresAt || null,
    }),
    { headers }
  );
};

export const config = { path: "/api/order-status" };
