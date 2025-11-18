import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import { loadAppsScriptPayload, loadDashboardData } from "./dashboard";
import {
  generateAnalysisSchema,
  generateAnalysisTable,
} from "./analysis";

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

  if (method === "GET" && parsedUrl.pathname === "/api/analysis/schema") {
    try {
      const schema = await generateAnalysisSchema();
      sendJson(res, 200, schema);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to build analysis schema:", error);
      sendJson(res, 500, { error: message });
    }
    return;
  }

  const readTopbreaks = (params: URLSearchParams): string[] => {
    const candidateKeys = new Set(["topbreak", "topbreaks", "topbreak[]", "topBreak", "topBreaks"]);

    for (const key of params.keys()) {
      if (/topbreak/i.test(key)) {
        candidateKeys.add(key);
      }
    }

    const rawValues = Array.from(candidateKeys).flatMap((key) => params.getAll(key));

    const splitValues = rawValues.flatMap((value) => {
      if (!value) {
        return [] as string[];
      }
      return value
        .split(",")
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));
    });

    return Array.from(new Set(splitValues));
  };

  if (method === "GET" && parsedUrl.pathname === "/api/analysis/table") {
    try {
      const topbreaks = readTopbreaks(parsedUrl.searchParams);
      const params = Object.fromEntries(parsedUrl.searchParams.entries());
      const table = await generateAnalysisTable({
        topbreaks: topbreaks.length > 0 ? topbreaks : params.topbreak ? [params.topbreak] : null,
        variable: params.variable ?? null,
        stat: params.stat ?? null,
        limitCategories: params.limit_categories ?? null,
      });
      sendJson(res, 200, table);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to build analysis table:", error);
      const isClientError =
        typeof message === "string" &&
        (message.toLowerCase().includes("required") || message.toLowerCase().includes("no data"));
      sendJson(res, isClientError ? 400 : 500, { error: message });
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
