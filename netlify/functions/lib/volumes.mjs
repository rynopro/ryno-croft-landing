import { getStore } from "@netlify/blobs";

export const VOLUMES = {
  "2": { title: "Business Handbook – Volume 2", amount: 14900, file: "volume-2.pdf" },
  "3": { title: "Business Handbook – Volume 3", amount: 14900, file: "volume-3.pdf" },
};
export const MAX_DOWNLOADS = 5;
export const ACCESS_DAYS = 7;
export const ORDER_ID_RE = /^[0-9a-f-]{36}$/;
export const ordersStore = () => getStore({ name: "orders", consistency: "strong" });
