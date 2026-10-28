const VERSION = "3.4.0-pages";
const API = "https://apis.roblox.com/assets/v1";
const MAX_BYTES = 20 * 1024 * 1024;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type, x-report-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-filename, content-type",
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

/* ---------- upload asset ---------- */
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

/* ---------- ambil audio dari link (fallback) ---------- */
const BLOCKED = /(^|\.)(youtube\.com|youtu\.be|spotify\.com|soundcloud\.com|music\.apple\.com|tiktok\.com)$/i;

function badHost(h) {
  h = String(h || "").toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.startsWith("[") || h.includes(":")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

async function proxyAudio(url) {
  const target = url.searchParams.get("url") || "";
  let u;
  try { u = new URL(target); } catch { return json({ error: "Link tidak valid" }, 400); }
  if (u.protocol !== "https:") return json({ error: "Link harus diawali https://" }, 400);
  if (badHost(u.hostname)) return json({ error: "Alamat link tidak diizinkan" }, 400);
  if (BLOCKED.test(u.hostname))
    return json({ error: "Link YouTube/Spotify/SoundCloud tidak didukung. Pakai link langsung ke file audio milikmu." }, 400);

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  let r;
  try {
    r = await fetch(u.toString(), {
      signal: ctl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (ALEX-STUDIO)" },
    });
  } catch (e) {
    clearTimeout(t);
    return json({ error: "Gagal mengunduh dari link (timeout atau diblokir server asal)" }, 502);
  }
  clearTimeout(t);

  if (!r.ok) return json({ error: "Server asal membalas " + r.status }, 502);

  const len = +(r.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return json({ error: "File terlalu besar (maks 20 MB)" }, 413);

  const ct = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (ct.startsWith("text/") || ct === "application/json")
    return json({ error: "Link bukan file audio langsung (isinya halaman web)" }, 400);

  const buf = await r.arrayBuffer();
  if (!buf.byteLength) return json({ error: "File dari link kosong" }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "File terlalu besar (maks 20 MB)" }, 413);

  let name = "audio";
  try { name = decodeURIComponent(u.pathname.split("/").pop() || "audio"); } catch {}
  return new Response(buf, {
    headers: {
      "content-type": ct || "application/octet-stream",
      "x-filename": encodeURIComponent(name.slice(0, 80)),
      ...CORS,
    },
  });
}

/* ---------- cek asset ---------- */
async function assetInfo(key, id) {
  if (!key) return json({ error: "API key kosong" }, 400);
  if (!/^\d{1,20}$/.test(id || "")) return json({ error: "Asset ID harus berupa angka" }, 400);

  const mask = "assetType,assetId,displayName,description,state,moderationResult,creationContext,revisionId";
  let r = await fetch(API + "/assets/" + id + "?readMask=" + encodeURIComponent(mask), {
    headers: { "x-api-key": key },
  });
  if (r.status === 400) r = await fetch(API + "/assets/" + id, { headers: { "x-api-key": key } });

  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    let extra = "";
    if (r.status === 404) extra = " (asset tidak ditemukan atau bukan milik akun key ini)";
    if (r.status === 403) extra = " (key tidak punya izin membaca asset ini)";
    return json({ error: (d.message || "Roblox membalas " + r.status) + extra }, r.status);
  }
  return json({ ok: true, asset: d });
}

/* ---------- router ---------- */
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

  if (url.pathname === "/fetch" && req.method === "GET") return proxyAudio(url);

  if (url.pathname === "/asset" && req.method === "GET")
    return assetInfo(key, url.searchParams.get("id"));

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

  /* ---------- Cloud PC (AnyDesk) ---------- */
  if (url.pathname === "/cloudpc/report" && req.method === "POST") {
    if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
    const tok = req.headers.get("x-report-token") || "";
    if (!env.CLOUDPC_TOKEN || tok !== env.CLOUDPC_TOKEN)
      return json({ error: "Token salah" }, 401);
    const b = await req.json().catch(() => ({}));
    const id = String(b.id || "").replace(/\s/g, "");
    if (!/^\d{6,12}$/.test(id)) return json({ error: "ID tidak valid" }, 400);
    await env.CLOUDPC.put("anydesk", JSON.stringify({ id, at: Date.now() }), { expirationTtl: 21600 });
    return json({ ok: true });
  }

  if (url.pathname === "/cloudpc" && req.method === "GET") {
    if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
    const v = await env.CLOUDPC.get("anydesk");
    return json(v ? { ok: true, ...JSON.parse(v) } : { ok: true, id: null });
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
