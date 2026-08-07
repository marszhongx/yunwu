import { afterEach, describe, expect, test, vi } from "vitest";
import handler from "./proxy";

type SeenRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: string;
};

function stubUpstream(seen: { value?: SeenRequest } | null, respond?: () => Response) {
  vi.stubGlobal(
    "fetch",
    async (input: unknown) => {
      const request = input as Request;
      if (seen) {
        seen.value = {
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body ? await request.text() : "",
        };
      }
      return (
        respond?.() ??
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    },
  );
}

function post(target: string | undefined, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (target !== undefined) headers.set("x-proxy-target", target);
  return handler(
    new Request("http://localhost/api/proxy", { method: "POST", body: "x", ...init, headers }),
  );
}

describe("proxy edge function", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("forwards method/body/headers to x-proxy-target", async () => {
    const seen: { value?: SeenRequest } = {};
    stubUpstream(seen);

    const res = await post("https://api.example.com/v1/chat/completions", {
      headers: { authorization: "Bearer key", "content-type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(seen.value?.url).toBe("https://api.example.com/v1/chat/completions");
    expect(seen.value?.method).toBe("POST");
    expect(seen.value?.body).toBe(JSON.stringify({ messages: [] }));
    expect(seen.value?.headers.get("authorization")).toBe("Bearer key");
    // 不做任何过滤,控制头本身也原样透传(内容就是上游自己的地址)
    expect(seen.value?.headers.get("x-proxy-target")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  test("passes through everything else blindly (any method, any target)", async () => {
    const seen: { value?: SeenRequest } = {};
    stubUpstream(seen);

    const res = await handler(
      new Request("http://localhost/api/proxy", {
        method: "PUT",
        headers: {
          "x-proxy-target": "http://internal.anything.local/path",
          cookie: "session=1",
          "x-forwarded-for": "203.0.113.1",
        },
        body: "raw",
      }),
    );

    expect(res.status).toBe(200);
    expect(seen.value?.url).toBe("http://internal.anything.local/path");
    expect(seen.value?.method).toBe("PUT");
    expect(seen.value?.headers.get("cookie")).toBe("session=1");
    expect(seen.value?.headers.get("x-forwarded-for")).toBe("203.0.113.1");
  });

  test("hop-by-hop headers do not reach upstream", async () => {
    const seen: { value?: SeenRequest } = {};
    stubUpstream(seen);

    await post("https://api.example.com/", {
      headers: {
        connection: "close",
        "transfer-encoding": "chunked",
        "keep-alive": "timeout=5",
        te: "trailers",
        upgrade: "websocket",
      },
    });

    expect(seen.value?.headers.get("connection")).toBeNull();
    expect(seen.value?.headers.get("transfer-encoding")).toBeNull();
    expect(seen.value?.headers.get("keep-alive")).toBeNull();
    expect(seen.value?.headers.get("te")).toBeNull();
    expect(seen.value?.headers.get("upgrade")).toBeNull();
  });

  test("passes through upstream status, headers and streamed body", async () => {
    stubUpstream(null, () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("data: 1\n\n"));
            controller.enqueue(new TextEncoder().encode("data: 2\n\n"));
            controller.close();
          },
        }),
        {
          status: 429,
          headers: { "content-type": "text/event-stream", "x-request-id": "req-1" },
        },
      ),
    );

    const res = await post("https://api.example.com/");

    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(await res.text()).toBe("data: 1\n\ndata: 2\n\n");
  });

  test("upstream fetch failure falls through to hono's default 500", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("boom");
    });

    const res = await post("https://api.example.com/");

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Internal Server Error");
  });
});
