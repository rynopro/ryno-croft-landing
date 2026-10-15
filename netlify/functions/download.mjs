import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_DOWNLOADS, ORDER_ID_RE, VOLUMES, ordersStore } from "./lib/volumes.mjs";

async function loadPdf(file) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const roots = [process.env.LAMBDA_TASK_ROOT, process.cwd(), here, path.join(here, ".."), path.join(here, "../..")].filter(Boolean);
  for (const root of roots) {
    try { return await readFile(path.join(root, "protected", file)); } catch {}
  }
  return null;
}

export default async (req) => {
  const id = new URL(req.url).searchParams.get("order") || "";
  if (!ORDER_ID_RE.test(id)) return new Response("Not found", { status: 404 });

  const orders = ordersStore();
  const order = await orders.get(`order-${id}`, { type: "json" });
  if (!order || order.status !== "paid") return new Response("Payment not confirmed", { status: 403 });
  if (Date.now() > order.expiresAt) return new Response("This download link has expired", { status: 410 });
  if (order.downloads >= MAX_DOWNLOADS) return new Response("Download limit reached", { status: 403 });

  const product = VOLUMES[order.volume];
  const pdf = product && (await loadPdf(product.file));
  if (!pdf) {
    console.error("PDF not found in function bundle", product?.file);
    return new Response("File unavailable, please contact us", { status: 500 });
  }

  order.downloads += 1;
  await orders.setJSON(`order-${id}`, order);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${product.file}"`,
      "Cache-Control": "no-store",
    },
  });
};

export const config = { path: "/api/download" };
