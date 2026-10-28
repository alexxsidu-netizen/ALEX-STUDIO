const VERSION = "3.2.0-pages";
const API = "https://apis.roblox.com/assets/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", ...CORS },
  });

const MIME = { mp3: "audio/mpeg", ogg: "audio/ogg", rbxm: "model/x-rbxm" };
const extOf = (n) => String(n || "").split(".").pop().toLowerCase();

const creatorOf = (fd) =>
  fd.get("creatorType") === "Group"
    ? { groupId: String(fd.get("creatorId")) }
    : { userId: String(fd.get("creatorId")) };

async function createAsset(key, fd, assetType, allowedExt) {
  const file = fd.get("file");
  if (!file || typeof file === "string")
    return json({ error: "Field 'file' tidak ada di request" }, 400);

  const ext = extOf(file.name);
  if (!allowedExt.includes(ext))
    return json({ error: "Format ." + ext + " tidak didukung untuk " + assetType + ". Pakai: " + allowedExt.join(", ") }, 400);

  const cid = String(fd.get("creatorId") || "");
  if (!/^\d+$/.test(cid)) return json({ error: "Creator ID tidak valid" }, 400);

  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength)
    return json({ error: "File terbaca 0 byte (masalah di sisi app)" }, 400);

  const meta = {
    assetType,
    displayName: String(fd.get("name") || assetType).slice(0, 50),
    description: String(fd.get("description") || "").slice(0, 1000),
    creationContext: { creator: creatorOf(fd) },
  };

  const out = new FormData();
  out.append("request", JSON.stringify(meta));
  out.append("fileContent", new Blob([bytes], { type: MIME[ext] }), file.name);

  const r = await fetch(API + "/assets", {
    method: "POST",
    headers: { "x-api-key": key },
    body: out,
  });
  const text = await r.text();
  let d = {};
  try { d = JSON.parse(text); } catch {}

  if (!r.ok) {
    const m = d.message || text.slice(0, 200) || "tanpa pesan";
    return json({ error: "Roblox menolak (" + r.status + "): " + m + " [" + bytes.byteLength + " byte]" }, r.status);
  }
  const opId = String(d.path || "").split("/").pop();
  if (!opId) return json({ error: "Roblox tidak mengembalikan operation id" }, 502);
  return json({ ok: true, operationId: opId });
}

async function handle(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const key = req.headers.get("x-api-key") || "";

  if (url.pathname === "/health") return json({ ok: true, version: VERSION });

  if (url.pathname === "/validate") {
    if (!key) return json({ ok: false, error: "API key kosong" }, 400);
    const r = await fetch(API + "/operations/validate-check", {
      headers: { "x-api-key": key },
    });
    if (r.status === 401) return json({ ok: false, error: "API key tidak valid" }, 401);
    if (r.status === 403)
      return json({ ok: false, error: "API key tidak punya permission Assets (Read & Write) atau IP ditolak" }, 403);
    return json({ ok: true });
  }

  if (url.pathname === "/upload" && req.method === "POST") {
    if (!key) return json({ error: "API key kosong" }, 400);
    return createAsset(key, await req.formData(), "Audio", ["mp3", "ogg"]);
  }

  if (url.pathname === "/upload-animation" && req.method === "POST") {
    if (!key) return json({ error: "API key kosong" }, 400);
    return createAsset(key, await req.formData(), "Animation", ["rbxm"]);
  }

  if (url.pathname === "/operation") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id kosong" }, 400);
    const r = await fetch(API + "/operations/" + encodeURIComponent(id), {
      headers: { "x-api-key": key },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: d.message || "Gagal cek operasi (" + r.status + ")" }, r.status);
    if (d.done && d.error) return json({ done: true, error: d.error.message || "Upload gagal" });
    return json({ done: !!d.done, assetId: d.response && d.response.assetId });
  }

  // selain API di atas: tampilkan file web (index.html)
  return env.ASSETS.fetch(req);
}

export default {
  async fetch(req, env) {
    try {
      return await handle(req, env);
    } catch (e) {
      return json({ error: "Worker error: " + ((e && e.message) || e) }, 500);
    }
  },
};
