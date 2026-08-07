import { Hono } from "hono";
import { proxy } from "hono/proxy";
import { handle } from "hono/vercel";

export const config = { runtime: "edge" };

const app = new Hono();

app.all("/api/proxy", (c) => proxy(c.req.header("x-proxy-target") ?? "", { raw: c.req.raw }));

export default handle(app);
