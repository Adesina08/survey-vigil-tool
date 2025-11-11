import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import { loadAppsScriptPayload, loadDashboardData } from "./dashboard";

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

const formatEnvValue = (value: string | undefined) => {
  if (!value) {
    return { present: false };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { present: true, empty: true };
  }

  const previewLength = 4;
  const prefix = trimmed.slice(0, previewLength);
  const suffix = trimmed.slice(-previewLength);
  return {
    present: true,
    length: trimmed.length,
    preview: `${prefix}…${suffix}`,
  };
};

const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
  const { method, url } = req;

  if (!url) {
    sendJson(res, 400, { error: "Invalid request" });
    return;
  }

  const parsedUrl = new URL(url, `http://${req.headers.host ?? "localhost"}`);

  if (method === "GET" && parsedUrl.pathname === "/api/dashboard") {
    try {
      const data = await loadDashboardData();
      sendJson(res, 200, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to load dashboard data:", error);
      sendJson(res, 500, { error: message });
    }
    return;
  }

  if (method === "GET" && parsedUrl.pathname === "/api/diag") {
    sendJson(res, 200, {
      env: {
        APPS_SCRIPT_URL: formatEnvValue(process.env.APPS_SCRIPT_URL),
        VITE_APPS_SCRIPT_URL: formatEnvValue(process.env.VITE_APPS_SCRIPT_URL),
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (method === "GET" && parsedUrl.pathname === "/api/apps-script") {
    try {
      const payload = await loadAppsScriptPayload();
      sendJson(res, 200, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to proxy Apps Script payload:", error);
      sendJson(res, 500, { error: message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
};

export const createServer = () => http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("Unhandled error while processing request:", error);
    sendJson(res, 500, { error: "Internal server error" });
  });
});

const port = Number.parseInt(process.env.PORT ?? "3001", 10);

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default createServer;
