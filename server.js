import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import { request } from "undici";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10kb" }));

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a,b] = parts;
  return a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

function isBlockedAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:");
  }
  return true;
}

async function validateTarget(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("That hostname is not allowed.");
  }

  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(x => isBlockedAddress(x.address))) {
    throw new Error("That destination is not allowed.");
  }

  return url;
}

app.post("/proxy", async (req, res) => {
  try {
    const url = await validateTarget(String(req.body?.url || "").trim());

    const response = await request(url, {
      method: "GET",
      maxRedirections: 3,
      headers: {
        "user-agent": "SimpleWebProxy/1.0"
      },
      headersTimeout: 10000,
      bodyTimeout: 15000
    });

    const contentType = response.headers["content-type"] || "text/plain";
    if (!String(contentType).includes("text/html")) {
      res.status(415).json({
        error: "This demo proxy only displays HTML pages."
      });
      response.body.resume();
      return;
    }

    const body = await response.body.text();

    // Keep the demo intentionally simple: return HTML as text so the browser
    // does not turn this endpoint into an unrestricted arbitrary-page proxy.
    res.json({
      status: response.statusCode,
      contentType,
      html: body.slice(0, 2_000_000)
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Proxy request failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy site running at http://localhost:${PORT}`);
});
