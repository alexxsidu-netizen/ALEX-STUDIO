const VERSION = "5.0.0-pages";
const API = "https://apis.roblox.com/assets/v1";
const MAX_BYTES = 20 * 1024 * 1024;
const GH_REPO = "alexxsidu-netizen/ALEX-STUDIO";
const GH_WF = "cloudpc.yml";

const GUEST_LIMIT = 5;
const USER_LIMIT = 10;
const CHAT_LIMIT = 15;
// model utama + cadangan; kalau satu dihentikan Cloudflare, otomatis coba berikutnya
const CHAT_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
];
const DAY_MS = 86400000;
const RESET_SHIFT = 10 * 3600000; // 17:00 WIB = 10:00 UTC
const SESSION_TTL = 30 * 86400;

const WA_NUMBER = "6283841104725";
const WA_DISPLAY = "083841104725";

// sampul/latar belakang global (disimpan di KV, batas KV 25 MB per nilai)
const BG_DATA = "bg:data";
const BG_META = "bg:meta";
const BG_MAX = { image: 10 * 1024 * 1024, video: 20 * 1024 * 1024 };
const BG_TYPES = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};
const BG_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type, x-report-token, authorization, range",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-filename, content-type, content-range, accept-ranges",
};
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", ...CORS },
  });

const MIME = {
  mp3: "audio/mpeg", ogg: "audio/ogg", rbxm: "model/x-rbxm",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  bmp: "image/bmp", tga: "image/tga",
  mp4: "video/mp4", mov: "video/mov",
  fbx: "model/fbx", glb: "model/gltf-binary", gltf: "model/gltf+json",
};

// path: [assetType Roblox, ekstensi yang boleh, nama gate (null = bebas, tanpa kode akses)]
const UPLOADS = {
  "/upload-image":    ["Decal", ["png", "jpg", "jpeg", "bmp", "tga"], null],
  "/upload-sticker":  ["Decal", ["png", "jpg", "jpeg"], null],
  "/upload-video":    ["Video", ["mp4", "mov"], "video"],
  "/upload-mesh":     ["Model", ["fbx", "glb", "gltf"], "mesh"],
  "/upload-meshpart": ["Model", ["fbx", "glb", "gltf"], "meshpart"],
  "/upload-plugin":   ["Plugin", ["rbxm"], "plugin"],
};

const PROMO_KEY = "promo:list";

const extOf = (n) => String(n || "").split(".").pop().toLowerCase();

const creatorOf = (fd) =>
  fd.get("creatorType") === "Group"
    ? { groupId: String(fd.get("creatorId")) }
    : { userId: String(fd.get("creatorId")) };

/* ---------- KV, hash, util ---------- */
const kvGet = async (env, k) => {
  const v = await env.CLOUDPC.get(k);
  return v ? JSON.parse(v) : null;
};
const kvPut = (env, k, o, ttl) =>
  env.CLOUDPC.put(k, JSON.stringify(o), ttl ? { expirationTtl: Math.max(60, ttl) } : undefined);

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => new Uint8Array((s.match(/../g) || []).map((h) => parseInt(h, 16)));
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function hashPw(pw, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: unhex(saltHex), iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  return hex(bits);
}

function eq(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const clean = (v) => String(v == null ? "" : v).trim();

const ipOf = (req) => req.headers.get("cf-connecting-ip") || "0";
const rlBlocked = async (env, k, max) => ((await kvGet(env, k)) || { n: 0 }).n >= max;
const rlAdd = async (env, k, ttl) => {
  const o = (await kvGet(env, k)) || { n: 0 };
  o.n++;
  await kvPut(env, k, o, ttl);
};

/* ---------- akun, sesi, role, limit ---------- */
const dayId = (t = Date.now()) => Math.floor((t - RESET_SHIFT) / DAY_MS);
const nextReset = () => (dayId() + 1) * DAY_MS + RESET_SHIFT;

function roleOf(u) {
  if (!u) return "guest";
  if (u.owner) return "owner";
  if (u.vip) return "vip";
  if (u.vipUntil && u.vipUntil > Date.now()) return "vip7";
  return "user";
}

const canPremium = (u) =>
  !!u && !!(u.owner || u.vip || (u.vipUntil && u.vipUntil > Date.now()) || u.unlocked);

function accessMsg(q, what) {
  return (
    "Upload " + what + " butuh kode akses. Chat WhatsApp " + WA_DISPLAY +
    " untuk mendapatkan kodenya, lalu " +
    (q.auth ? "masukkan di kolom Pakai kode di Home." : "login dan masukkan di kolom Pakai kode di Home.")
  );
}

async function getAuth(req, env) {
  if (!env.CLOUDPC) return null;
  const m = (req.headers.get("authorization") || "").match(/^Bearer ([a-f0-9]{64})$/i);
  if (!m) return null;
  const token = m[1].toLowerCase();
  const s = await kvGet(env, "sess:" + token);
  if (!s) return null;
  const user = await kvGet(env, "user:" + s.u);
  if (!user) return null;
  return { token, lower: s.u, user };
}

async function newSession(env, lower) {
  const token = randHex(32);
  await kvPut(env, "sess:" + token, { u: lower }, SESSION_TTL);
  return token;
}

async function quota(env, req) {
  const auth = await getAuth(req, env);
  const role = auth ? roleOf(auth.user) : "guest";
  const limit = role === "guest" ? GUEST_LIMIT : role === "user" ? USER_LIMIT : null;
  const day = dayId();
  const k = auth ? "lim:u:" + auth.lower + ":" + day : "lim:ip:" + ipOf(req) + ":" + day;
  const o = (await kvGet(env, k)) || { n: 0 };
  return { auth, role, limit, used: o.n, k, resetAt: nextReset() };
}
const consume = (env, q) => kvPut(env, q.k, { n: q.used + 1 }, 172800);

function meOf(q) {
  const u = q.auth && q.auth.user;
  return {
    ok: true,
    loggedIn: !!u,
    name: u ? u.name : null,
    role: q.role,
    limit: q.limit,
    used: q.used,
    left: q.limit === null ? null : Math.max(0, q.limit - q.used),
    resetAt: q.resetAt,
    vipUntil: u && q.role === "vip7" ? u.vipUntil : null,
    unlocked: canPremium(u),
    wa: WA_DISPLAY,
  };
}

function limitMsg(q) {
  const base = "Batas upload harian habis (" + q.used + "/" + q.limit + "). Reset otomatis jam 17:00 WIB.";
  return q.role === "guest"
    ? base + " Login untuk dapat 10 upload per hari, atau pakai kode VIP untuk unlimited."
    : base + " Pakai kode VIP untuk unlimited.";
}

async function authRoute(path, req, env) {
  if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
  const ip = ipOf(req);

  if (path === "/auth/me" && req.method === "GET") return json(meOf(await quota(env, req)));

  if (path === "/auth/logout" && req.method === "POST") {
    const a = await getAuth(req, env);
    if (a) await env.CLOUDPC.delete("sess:" + a.token);
    return json({ ok: true });
  }

  if (req.method !== "POST") return json({ error: "Method tidak didukung" }, 405);
  const b = await req.json().catch(() => ({}));

  if (path === "/auth/register") {
    const name = String(b.username || "").trim();
    const pw = String(b.password || "");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name))
      return json({ error: "Username 3-20 karakter: huruf, angka, atau garis bawah" }, 400);
    if (pw.length < 6 || pw.length > 100) return json({ error: "Password minimal 6 karakter" }, 400);
    if (await rlBlocked(env, "rl:reg:" + ip, 5)) return json({ error: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti." }, 429);
    const lower = name.toLowerCase();
    if (await kvGet(env, "user:" + lower)) return json({ error: "Username sudah dipakai" }, 409);
    const salt = randHex(16);
    const user = { name, salt, hash: await hashPw(pw, salt), created: Date.now(), owner: false, vip: false, vipUntil: 0, unlocked: false, redeemed: [] };
    await kvPut(env, "user:" + lower, user);
    await rlAdd(env, "rl:reg:" + ip, 3600);
    const token = await newSession(env, lower);
    const q = await quota(env, new Request(req.url, { headers: { authorization: "Bearer " + token, "cf-connecting-ip": ip } }));
    return json({ ok: true, token, me: meOf(q) });
  }

  if (path === "/auth/login") {
    const lower = String(b.username || "").trim().toLowerCase();
    const pw = String(b.password || "");
    if (await rlBlocked(env, "rl:login:" + ip, 8)) return json({ error: "Terlalu banyak percobaan login. Coba lagi 10 menit lagi." }, 429);
    const user = lower ? await kvGet(env, "user:" + lower) : null;
    const ok = user && eq(await hashPw(pw, user.salt), user.hash);
    if (!ok) {
      await rlAdd(env, "rl:login:" + ip, 600);
      return json({ error: "Username atau password salah" }, 401);
    }
    const token = await newSession(env, lower);
    const q = await quota(env, new Request(req.url, { headers: { authorization: "Bearer " + token, "cf-connecting-ip": ip } }));
    return json({ ok: true, token, me: meOf(q) });
  }

  if (path === "/auth/redeem") {
    const auth = await getAuth(req, env);
    if (!auth) return json({ error: "Login dulu untuk memakai kode" }, 401);
    if (await rlBlocked(env, "rl:redeem:" + ip, 10)) return json({ error: "Terlalu banyak percobaan kode. Coba lagi 10 menit lagi." }, 429);
    const code = clean(b.code);
    if (!code) return json({ error: "Isi kodenya dulu" }, 400);
    const same = (secret) => {
      const s = clean(secret);
      return !!s && eq(code, s);
    };
    const u = auth.user;
    let label = "";
    if (same(env.OWNER_CODE)) {
      u.owner = true;
      label = "Owner aktif. Semua fitur unlimited.";
    } else if (same(env.VIP_CODE)) {
      u.vip = true;
      label = "VIP aktif. Upload unlimited.";
    } else if (same(env.VIP_WEEK_CODE)) {
      u.redeemed = u.redeemed || [];
      if (u.redeemed.includes(code)) return json({ error: "Kode ini sudah pernah dipakai di akunmu" }, 409);
      u.redeemed.push(code);
      u.vipUntil = Math.max(Date.now(), u.vipUntil || 0) + 7 * DAY_MS;
      label = "VIP 7 hari aktif. Upload unlimited.";
    } else if (same(env.ACCESS_CODE)) {
      u.unlocked = true;
      label = "Akses upload aktif. Upload animasi, model, video, mesh, dan plugin sudah terbuka.";
    } else {
      await rlAdd(env, "rl:redeem:" + ip, 600);
      // diagnosa sementara: hapus 2 baris di bawah kalau semua kode sudah jalan
      const unset = ["OWNER_CODE", "VIP_CODE", "VIP_WEEK_CODE", "ACCESS_CODE"].filter((n) => !clean(env[n]));
      return json({ error: "Kode tidak valid" + (unset.length ? " (di server belum diisi: " + unset.join(", ") + ")" : "") }, 400);
    }
    await kvPut(env, "user:" + auth.lower, u);
    const q = await quota(env, req);
    return json({ ok: true, message: label, me: meOf(q) });
  }

  return json({ error: "Endpoint tidak ditemukan" }, 404);
}

/* ---------- Chat AI (Cloudflare Workers AI) ---------- */
async function chatRoute(req, env) {
  if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
  if (req.method !== "POST") return json({ error: "Method tidak didukung" }, 405);
  const auth = await getAuth(req, env);
  if (!auth) return json({ error: "Login dulu untuk memakai Chat AI" }, 401);
  if (!env.AI)
    return json({ error: "Workers AI belum dipasang. Di Cloudflare: Settings, Bindings, Add, Workers AI, nama variabel AI, lalu Retry deployment." }, 500);

  const role = roleOf(auth.user);
  const limit = role === "user" ? CHAT_LIMIT : null;
  const k = "chat:u:" + auth.lower + ":" + dayId();
  const used = ((await kvGet(env, k)) || { n: 0 }).n;
  if (limit !== null && used >= limit)
    return json({ error: "Batas Chat AI hari ini habis (" + used + "/" + limit + "). Reset jam 17:00 WIB. VIP unlimited.", code: "LIMIT" }, 429);

  const b = await req.json().catch(() => ({}));
  const list = Array.isArray(b.messages) ? b.messages.slice(-10) : [];
  const msgs = list
    .map((m) => ({
      role: m && m.role === "assistant" ? "assistant" : "user",
      content: clean(m && m.content).slice(0, 1500),
    }))
    .filter((m) => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "Pesan kosong" }, 400);

  const sys = {
    role: "system",
    content:
      "Kamu asisten ALEX STUDIO, workspace untuk creator Roblox. Jawab dalam bahasa Indonesia, singkat dan jelas. " +
      "Kamu membantu soal upload audio, animasi, model, gambar, video, mesh, dan plugin ke Roblox, Roblox Studio, Luau scripting, serta cara pakai ALEX STUDIO. " +
      "Jangan membantu mengunduh audio dari YouTube atau mengunggah musik berhak cipta tanpa izin pemiliknya.",
  };

  let out, lastErr;
  for (const model of CHAT_MODELS) {
    try {
      out = await env.AI.run(model, { messages: [sys, ...msgs], max_tokens: 600 });
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!out) return json({ error: "Chat AI gagal: " + ((lastErr && lastErr.message) || lastErr) }, 502);

  const reply = clean(out && (out.response || (out.result && out.result.response)));
  if (!reply) return json({ error: "Chat AI tidak memberi jawaban. Coba lagi." }, 502);

  await kvPut(env, k, { n: used + 1 }, 172800);
  return json({ ok: true, reply, limit, left: limit === null ? null : Math.max(0, limit - used - 1) });
}

/* ---------- promosi & announce ---------- */
async function promoRoute(path, req, env) {
  if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);

  // publik: semua pengunjung bisa melihat
  if (path === "/promo" && req.method === "GET")
    return json({ ok: true, items: (await kvGet(env, PROMO_KEY)) || [] });

  // hanya owner yang bisa menambah, mengubah, pin, dan menghapus
  if (path === "/promo/save" && req.method === "POST") {
    if (!(await isOwner(req, env)))
      return json({ error: "Hanya owner yang bisa mengubah promosi." }, 403);
    const b = await req.json().catch(() => ({}));
    const src = Array.isArray(b.items) ? b.items.slice(0, 20) : [];
    const items = src
      .map((x) => {
        let link = clean(x && x.link).slice(0, 300);
        if (link && !/^https:\/\//i.test(link)) link = "";
        return {
          id: clean(x && x.id).slice(0, 20) || randHex(4),
          title: clean(x && x.title).slice(0, 80),
          text: clean(x && x.text).slice(0, 1000),
          link,
          label: clean(x && x.label).slice(0, 30),
          pin: !!(x && x.pin),
          at: +(x && x.at) || Date.now(),
        };
      })
      .filter((x) => x.title || x.text);
    await kvPut(env, PROMO_KEY, items);
    return json({ ok: true, items });
  }
  return json({ error: "Endpoint tidak ditemukan" }, 404);
}

/* ---------- sampul / latar belakang global ---------- */
async function bgInfo(env) {
  const m = await kvGet(env, BG_META);
  return m ? { ok: true, has: true, ...m } : { ok: true, has: false };
}

// publik: semua pengunjung bisa melihat. Mendukung Range supaya video lancar di HP.
async function bgServe(req, env) {
  const { value, metadata } = await env.CLOUDPC.getWithMetadata(BG_DATA, "arrayBuffer");
  if (!value) return json({ error: "Belum ada latar" }, 404);
  const type = (metadata && metadata.type) || "application/octet-stream";
  const total = value.byteLength;
  const h = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
    ...CORS,
  };
  const m = String(req.headers.get("range") || "").match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let s, e;
    if (m[1] === "") {
      s = Math.max(0, total - parseInt(m[2], 10));
      e = total - 1;
    } else {
      s = parseInt(m[1], 10);
      e = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
    }
    if (s >= total || s > e)
      return new Response(null, { status: 416, headers: { ...h, "content-range": "bytes */" + total } });
    return new Response(value.slice(s, e + 1), {
      status: 206,
      headers: { ...h, "content-range": "bytes " + s + "-" + e + "/" + total, "content-length": String(e - s + 1) },
    });
  }
  return new Response(value, { headers: { ...h, "content-length": String(total) } });
}

const ownerOnlyBg = () => json({ error: "Hanya owner yang bisa mengubah latar belakang." }, 403);

async function bgSet(req, env) {
  if (!(await isOwner(req, env))) return ownerOnlyBg();
  const fd = await req.formData().catch(() => null);
  const file = fd && fd.get("file");
  if (!file || typeof file === "string") return json({ error: "File tidak ada di request" }, 400);

  let type = String(file.type || "").split(";")[0].toLowerCase();
  if (!BG_TYPES[type]) type = BG_EXT[extOf(file.name)] || "";
  const kind = BG_TYPES[type];
  if (!kind) return json({ error: "Format tidak didukung. Pakai JPG, PNG, WEBP, GIF, MP4, WEBM, atau MOV." }, 400);

  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength) return json({ error: "File terbaca 0 byte" }, 400);
  if (bytes.byteLength > BG_MAX[kind])
    return json({ error: "Terlalu besar. Maksimal " + BG_MAX[kind] / 1048576 + " MB untuk " + (kind === "video" ? "video" : "foto") + "." }, 413);

  const old = await kvGet(env, BG_META);
  const meta = {
    kind,
    type,
    name: String(file.name || "latar").slice(0, 100),
    size: bytes.byteLength,
    at: Date.now(),
    dim: old && old.dim != null ? old.dim : 55,
    blur: old && old.blur != null ? old.blur : 0,
  };
  await env.CLOUDPC.put(BG_DATA, bytes, { metadata: { type, name: meta.name } });
  await kvPut(env, BG_META, meta);
  return json({ ok: true, bg: { has: true, ...meta } });
}

async function bgLook(req, env) {
  if (!(await isOwner(req, env))) return ownerOnlyBg();
  const old = await kvGet(env, BG_META);
  if (!old) return json({ error: "Pasang latar dulu." }, 400);
  const b = await req.json().catch(() => ({}));
  const dim = Math.min(90, Math.max(0, Math.round(+b.dim)));
  const blur = Math.min(20, Math.max(0, Math.round(+b.blur)));
  if (!isFinite(dim) || !isFinite(blur)) return json({ error: "Nilai tidak valid" }, 400);
  old.dim = dim;
  old.blur = blur;
  await kvPut(env, BG_META, old);
  return json({ ok: true, bg: { has: true, ...old } });
}

async function bgDelete(req, env) {
  if (!(await isOwner(req, env))) return ownerOnlyBg();
  await env.CLOUDPC.delete(BG_DATA);
  await env.CLOUDPC.delete(BG_META);
  return json({ ok: true, bg: { has: false } });
}

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
  out.append("fileContent", new Blob([bytes], { type: MIME[ext] || "application/octet-stream" }), file.name);

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

// gate = nama fitur yang butuh kode akses (mis. "animasi"), atau null kalau bebas
async function gatedUpload(req, env, key, assetType, exts, gate) {
  if (!key) return json({ error: "API key kosong" }, 400);
  if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
  const q = await quota(env, req);
  if (gate && !canPremium(q.auth && q.auth.user))
    return json({ error: accessMsg(q, gate), code: "NEED_CODE", wa: WA_DISPLAY }, 403);
  if (q.limit !== null && q.used >= q.limit) return json({ error: limitMsg(q), code: "LIMIT", me: meOf(q) }, 429);
  const res = await createAsset(key, await req.formData(), assetType, exts);
  if (res.ok) await consume(env, q);
  return res;
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

/* ---------- preview audio dari asset ID ---------- */
async function assetAudio(key, id) {
  if (!key) return json({ error: "API key kosong" }, 400);
  if (!/^\d{1,20}$/.test(id || "")) return json({ error: "Asset ID harus berupa angka" }, 400);

  const r = await fetch("https://apis.roblox.com/asset-delivery-api/v1/assetId/" + id, {
    headers: { "x-api-key": key },
  });
  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    let extra = "";
    if (r.status === 401) extra = " (API key tidak valid)";
    if (r.status === 403) extra = " (key belum punya izin Asset Delivery, atau audio ini bukan milikmu / tidak publik)";
    if (r.status === 404) extra = " (asset tidak ditemukan)";
    return json({ error: (d.message || "Roblox membalas " + r.status) + extra }, r.status);
  }

  const loc = d.location || (d.locations && d.locations[0] && d.locations[0].location);
  if (!loc) return json({ error: "Roblox tidak memberi link audio untuk asset ini" }, 502);
  return json({ ok: true, url: loc });
}

/* ---------- Cloud PC: helper GitHub ---------- */
async function isOwner(req, env) {
  const a = await getAuth(req, env);
  return !!(a && roleOf(a.user) === "owner");
}
const ownerOnly = () => json({ error: "Cloud PC hanya untuk owner. Login lalu masukkan kode owner." }, 403);

const gh = (env, path, init = {}) =>
  fetch("https://api.github.com/repos/" + GH_REPO + path, {
    ...init,
    headers: {
      authorization: "Bearer " + env.GH_PAT,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "ALEX-STUDIO",
      ...(init.headers || {}),
    },
  });

function ghErr(status, d) {
  if (status === 401) return "GH_PAT tidak valid atau sudah kedaluwarsa";
  if (status === 403) return "GH_PAT tidak punya izin Actions (Read and write)";
  if (status === 404) return "Workflow " + GH_WF + " tidak ditemukan di repo, atau token tidak punya akses";
  if (status === 422) return "Workflow belum punya trigger workflow_dispatch";
  return (d && d.message) || ("GitHub membalas " + status);
}

async function pcRuns(env) {
  const r = await gh(env, "/actions/workflows/" + GH_WF + "/runs?per_page=5");
  if (!r.ok) return { err: r.status, runs: [] };
  const d = await r.json().catch(() => ({}));
  const live = ["queued", "in_progress", "waiting", "pending", "requested"];
  return { runs: (d.workflow_runs || []).filter((x) => live.includes(x.status)) };
}

/* ---------- router ---------- */
async function handle(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const key = req.headers.get("x-api-key") || "";

  if (url.pathname === "/health") return json({ ok: true, version: VERSION });

  if (url.pathname.startsWith("/auth/")) return authRoute(url.pathname, req, env);

  if (url.pathname === "/chat") return chatRoute(req, env);

  if (url.pathname.startsWith("/promo")) return promoRoute(url.pathname, req, env);

  /* ---------- sampul / latar belakang global ---------- */
  if (url.pathname.startsWith("/bg")) {
    if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
    if (url.pathname === "/bg" && req.method === "GET") return bgServe(req, env);
    if (url.pathname === "/bg/info" && req.method === "GET") return json(await bgInfo(env));
    if (url.pathname === "/bg/set" && req.method === "POST") return bgSet(req, env);
    if (url.pathname === "/bg/look" && req.method === "POST") return bgLook(req, env);
    if (url.pathname === "/bg/delete" && req.method === "POST") return bgDelete(req, env);
    return json({ error: "Endpoint tidak ditemukan" }, 404);
  }

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

  if (url.pathname === "/asset-audio" && req.method === "GET")
    return assetAudio(key, url.searchParams.get("id"));

  if (url.pathname === "/upload" && req.method === "POST")
    return gatedUpload(req, env, key, "Audio", ["mp3", "ogg"], null);

  if (url.pathname === "/upload-animation" && req.method === "POST")
    return gatedUpload(req, env, key, "Animation", ["rbxm"], "animasi");

  if (url.pathname === "/upload-model" && req.method === "POST")
    return gatedUpload(req, env, key, "Model", ["rbxm"], "model");

  // gambar, stiker, video, mesh, meshpart, plugin
  if (UPLOADS[url.pathname] && req.method === "POST") {
    const [type, exts, gate] = UPLOADS[url.pathname];
    return gatedUpload(req, env, key, type, exts, gate);
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

  /* ---------- Cloud PC (AnyDesk), khusus owner ---------- */

  // dipanggil oleh workflow setelah ID AnyDesk didapat
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
    if (!(await isOwner(req, env))) return ownerOnly();
    let state = "unknown";
    if (env.GH_PAT) {
      const s = await pcRuns(env);
      if (!s.err) state = s.runs.length ? "on" : "off";
    }
    const v = await env.CLOUDPC.get("anydesk");
    const o = v ? JSON.parse(v) : {};
    const id = state === "off" ? null : (o.id || null);
    return json({
      ok: true,
      state,
      id,
      at: id ? o.at : null,
      password: id ? (env.CLOUDPC_PASSWORD || null) : null,
    });
  }

  if (url.pathname === "/cloudpc/start" && req.method === "POST") {
    if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
    if (!(await isOwner(req, env))) return ownerOnly();
    if (!env.GH_PAT) return json({ error: "Secret GH_PAT belum diisi" }, 500);
    const cur = await pcRuns(env);
    if (cur.err) return json({ error: ghErr(cur.err, {}) }, 502);
    if (cur.runs.length) return json({ ok: true, already: true });
    await env.CLOUDPC.delete("anydesk");
    const r = await gh(env, "/actions/workflows/" + GH_WF + "/dispatches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref: "main" }),
    });
    if (r.status !== 204) {
      const d = await r.json().catch(() => ({}));
      return json({ error: ghErr(r.status, d) }, 502);
    }
    return json({ ok: true });
  }

  if (url.pathname === "/cloudpc/stop" && req.method === "POST") {
    if (!env.CLOUDPC) return json({ error: "KV CLOUDPC belum di-bind" }, 500);
    if (!(await isOwner(req, env))) return ownerOnly();
    if (!env.GH_PAT) return json({ error: "Secret GH_PAT belum diisi" }, 500);
    const cur = await pcRuns(env);
    if (cur.err) return json({ error: ghErr(cur.err, {}) }, 502);
    let n = 0;
    for (const run of cur.runs) {
      const r = await gh(env, "/actions/runs/" + run.id + "/cancel", { method: "POST" });
      if (r.status === 202) n++;
    }
    await env.CLOUDPC.delete("anydesk");
    return json({ ok: true, cancelled: n });
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
