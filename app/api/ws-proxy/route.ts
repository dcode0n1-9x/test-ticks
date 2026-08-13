import { NextRequest } from "next/server";
import WebSocket from "ws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing 'url' query parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Set up Server-Sent Events (SSE) stream over HTTPS
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let targetWs: WebSocket | null = null;

      const sendEvent = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          // Controller closed
        }
      };

      try {
        targetWs = new WebSocket(targetUrl);

        targetWs.on("open", () => {
          sendEvent("status", JSON.stringify({ status: "CONNECTED", message: `Proxied to ${targetUrl}` }));
        });

        targetWs.on("message", (data: WebSocket.Data) => {
          const raw = data.toString();
          sendEvent("tick", raw);
        });

        targetWs.on("error", (err: Error) => {
          sendEvent("status", JSON.stringify({ status: "ERROR", message: err.message || "Proxy WebSocket error" }));
        });

        targetWs.on("close", (code: number, reason: Buffer) => {
          sendEvent("status", JSON.stringify({ status: "DISCONNECTED", code, reason: reason.toString() }));
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      } catch (err: any) {
        sendEvent("status", JSON.stringify({ status: "ERROR", message: err.message || "Failed to create proxy socket" }));
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }

      // Cleanup when browser closes request
      req.signal.addEventListener("abort", () => {
        if (targetWs) {
          try {
            targetWs.close();
          } catch {
            // ignore
          }
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
