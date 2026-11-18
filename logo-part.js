/* ALEX STUDIO PLUS: Logo ke Part 3D (RBXM) */
(function () {
  "use strict";
  function Q(s) { return document.querySelector(s); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function setMsg(n, t, ok) { if (n) { n.textContent = t; n.className = "msg " + (ok ? "ok" : "err"); } }
  function at(k) { for (var i = 0; i < NAV.length; i++) if (NAV[i][0] === k) return i; return -1; }

  var pos = at("logo3d");
  if (pos < 0) pos = at("meshpart");
  NAV.splice(pos + 1, 0, ["logopart", "🧱", "Logo ke Part 3D"]);
  buildNav(Q("#navSide")); buildNav(Q("#navDr"));
  var rows = document.querySelectorAll("#p-home > .row"), lastRow = rows[rows.length - 1];
  if (lastRow) { var rr = el("div", "row"); rr.innerHTML = '<button class="btn ghost" data-go="logopart">🧱 Logo ke Part 3D</button>'; lastRow.after(rr); }

  var sec = el("section", "page"); sec.id = "p-logopart";
  sec.innerHTML =
    '<div class="eyebrow">Tools / 3D</div><h1>Logo ke Part 3D</h1>' +
    '<p class="sub">Pilih logo, latarnya dihapus otomatis, lalu diubah jadi Model berisi Part berwarna (file RBXM). Bisa diunduh atau langsung diupload ke Roblox. Diproses di HP-mu.</p>' +
    '<div class="lock">🔒 Upload Model butuh kode akses. <a href="https://wa.me/6283841104725" target="_blank" rel="noopener">Chat WhatsApp 083841104725</a>. Unduh RBXM tidak butuh kode.</div>' +
    '<div class="card"><h2>1. Gambar</h2>' +
    '<input type="file" id="ptFile" accept="image/*" hidden>' +
    '<button class="btn" id="ptPick">🖼 Pilih logo / foto</button>' +
    '<canvas id="ptSrc" width="1" height="1" style="max-width:100%;max-height:340px;display:block;margin:12px auto 0;border-radius:14px;border:1px solid var(--line);background:conic-gradient(#1b1f1b 25%,#2a2f2a 0 50%,#1b1f1b 0 75%,#2a2f2a 0) 0 0/20px 20px"></canvas>' +
    '<div class="hint" id="ptInfo">Belum ada gambar.</div>' +
    '<label>Cara hapus latar</label><select id="ptMode"><option value="flood">Dari tepi gambar (disarankan)</option><option value="global">Semua warna yang mirip latar</option><option value="none">Jangan hapus (sudah transparan)</option></select>' +
    '<label>Toleransi warna latar</label><div class="pitch"><input type="range" id="ptTol" min="5" max="100" value="35"><div class="pv" id="ptTolV">35</div></div>' +
    '<label>Kikis tepi</label><select id="ptEr"><option value="0">0 (tidak)</option><option value="1">1 piksel</option><option value="2">2 piksel</option></select></div>' +
    '<div class="card"><h2>2. Bentuk Model</h2>' +
    '<label style="margin-top:0">Nama model</label><input type="text" id="ptName" value="Logo3D" maxlength="40">' +
    '<div class="tr2"><div><label>Sisi terpanjang (studs)</label><input type="number" id="ptSize" value="20" min="1" max="200" step="1"></div>' +
    '<div><label>Ketebalan (%)</label><input type="number" id="ptDep" value="8" min="1" max="60" step="1"></div></div>' +
    '<div class="tr2"><div><label>Detail</label><select id="ptRes"><option value="100">Tinggi</option><option value="70" selected>Sedang</option><option value="45">Rendah</option></select></div>' +
    '<div><label>Jumlah warna</label><select id="ptCol"><option value="3">Sedikit</option><option value="5" selected>Sedang</option><option value="8">Banyak</option></select></div></div>' +
    '<label>Batas jumlah Part</label><select id="ptMax"><option value="1500">1.500</option><option value="3000" selected>3.000</option><option value="6000">6.000</option></select>' +
    '<button class="btn" id="ptMk">🧱 Buat Model Part</button><div class="msg" id="ptM"></div></div>' +
    '<div class="card" id="ptOut" style="display:none"><h2>3. Hasil</h2>' +
    '<canvas id="ptC3" width="640" height="440" style="width:100%;display:block;border-radius:14px;border:1px solid var(--line);background:#050705;touch-action:none"></canvas>' +
    '<div class="hint">Geser untuk memutar. Preview hanya gambaran; hasil di Studio berupa Part Anchored.</div>' +
    '<button class="btn ghost" id="ptSpin">⏸ Putar otomatis: nyala</button>' +
    '<div class="row"><button class="btn ghost" id="ptDl">⬇ Unduh RBXM</button><button class="btn" id="ptUp">⇧ Upload Model ke Roblox</button></div>' +
    '<div class="msg" id="ptO"></div><pre id="ptLuau" style="display:none"></pre>' +
    '<div class="hint">Logo terbaca benar dari sisi +Z. Kalau di Studio terlihat terbalik, putar model 180° pada sumbu Y.</div></div>';
  Q("main").appendChild(sec);

  Q("#ptTol").oninput = function (e) { Q("#ptTolV").textContent = e.target.value; };

  /* ---------- gambar ---------- */
  var srcC = null;
  Q("#ptPick").onclick = function () { Q("#ptFile").click(); };
  Q("#ptFile").onchange = function () {
    var f = Q("#ptFile").files[0]; Q("#ptFile").value = "";
    if (!f) return;
    var im = new Image();
    im.onload = function () {
      var sc = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight));
      var w = Math.max(2, Math.round(im.naturalWidth * sc)), h = Math.max(2, Math.round(im.naturalHeight * sc));
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(im, 0, 0, w, h);
      srcC = c;
      var pv = Q("#ptSrc"); pv.width = w; pv.height = h; pv.getContext("2d").drawImage(c, 0, 0);
      Q("#ptInfo").textContent = "Gambar dimuat: " + w + " × " + h + " px.";
      Q("#ptName").value = safeName(f.name.replace(/\.[^.]+$/, "")).slice(0, 40) || "Logo3D";
      URL.revokeObjectURL(im.src);
    };
    im.onerror = function () { Q("#ptInfo").textContent = "Gambar tidak bisa dibaca."; };
    im.src = URL.createObjectURL(f);
  };

  /* ---------- hapus latar ---------- */
  function cutout(src, mode, tolPct, er) {
    var w = src.width, h = src.height, n = w * h;
    var d = src.getContext("2d").getImageData(0, 0, w, h).data;
    var bg = new Uint8Array(n), i, x, y;
    for (i = 0; i < n; i++) if (d[i * 4 + 3] < 40) bg[i] = 1;
    if (mode !== "none") {
      var cnt = {}, best = null, bc = 0;
      var samp = function (px, py) {
        var k = (py * w + px) * 4; if (d[k + 3] < 40) return;
        var key = (d[k] >> 5) + "," + (d[k + 1] >> 5) + "," + (d[k + 2] >> 5);
        var o = cnt[key] || (cnt[key] = { n: 0, r: 0, g: 0, b: 0 });
        o.n++; o.r += d[k]; o.g += d[k + 1]; o.b += d[k + 2];
        if (o.n > bc) { bc = o.n; best = o; }
      };
      for (x = 0; x < w; x++) { samp(x, 0); samp(x, h - 1); }
      for (y = 0; y < h; y++) { samp(0, y); samp(w - 1, y); }
      if (best) {
        var R = best.r / best.n, G = best.g / best.n, B = best.b / best.n, tol = tolPct * 2.2;
        var near = function (p) {
          var dr = d[p * 4] - R, dg = d[p * 4 + 1] - G, db = d[p * 4 + 2] - B;
          return Math.sqrt(dr * dr + dg * dg + db * db) <= tol;
        };
        if (mode === "global") {
          for (i = 0; i < n; i++) if (near(i)) bg[i] = 1;
        } else {
          var st = new Int32Array(n), sp = 0;
          var push = function (p) { if (!bg[p] && near(p)) { bg[p] = 1; st[sp++] = p; } };
          for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
          for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
          while (sp) {
            var p = st[--sp], px = p % w, py = (p / w) | 0;
            if (px > 0) push(p - 1);
            if (px < w - 1) push(p + 1);
            if (py > 0) push(p - w);
            if (py < h - 1) push(p + w);
          }
        }
      }
    }
    for (var it = 0; it < er; it++) {
      var nb = bg.slice();
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        var q = y * w + x; if (bg[q]) continue;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || bg[q - 1] || bg[q + 1] || bg[q - w] || bg[q + w]) nb[q] = 1;
      }
      bg = nb;
    }
    var x0 = w, y0 = h, x1 = -1, y1 = -1, solid = 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (!bg[y * w + x]) {
      solid++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (!solid) throw new Error("Semua piksel terhapus. Turunkan toleransi atau ganti cara hapus latar.");
    var cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = new Uint8ClampedArray(cw * ch * 4);
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      var s = (y + y0) * w + (x + x0), t = (y * cw + x) * 4;
      if (!bg[s]) { out[t] = d[s * 4]; out[t + 1] = d[s * 4 + 1]; out[t + 2] = d[s * 4 + 2]; out[t + 3] = 255; }
    }
    return { w: cw, h: ch, data: out };
  }

  /* ---------- gambar jadi blok (greedy) ---------- */
  function grid(data, W, H, res, lv) {
    res = Math.max(8, Math.min(res, Math.max(W, H)));
    var aspect = W / H;
    var gw = aspect >= 1 ? res : Math.max(2, Math.round(res * aspect));
    var gh = aspect >= 1 ? Math.max(2, Math.round(res / aspect)) : res;
    var keys = new Int32Array(gw * gh).fill(-1), step = 255 / (lv - 1);
    var gx, gy, x, y;
    for (gy = 0; gy < gh; gy++) for (gx = 0; gx < gw; gx++) {
      var xa = Math.floor(gx * W / gw), xb = Math.max(xa + 1, Math.floor((gx + 1) * W / gw));
      var ya = Math.floor(gy * H / gh), yb = Math.max(ya + 1, Math.floor((gy + 1) * H / gh));
      var c = 0, r = 0, g = 0, b = 0;
      for (y = ya; y < yb; y++) for (x = xa; x < xb; x++) {
        var k = (y * W + x) * 4;
        if (data[k + 3] >= 128) { c++; r += data[k]; g += data[k + 1]; b += data[k + 2]; }
      }
      if (c * 2 > (xb - xa) * (yb - ya)) {
        var qr = Math.round(Math.round(r / c / step) * step);
        var qg = Math.round(Math.round(g / c / step) * step);
        var qb = Math.round(Math.round(b / c / step) * step);
        keys[gy * gw + gx] = (qr << 16) | (qg << 8) | qb;
      }
    }
    var seen = new Uint8Array(gw * gh), rects = [];
    for (var y0 = 0; y0 < gh; y0++) for (var x0 = 0; x0 < gw; x0++) {
      var i0 = y0 * gw + x0;
      if (seen[i0] || keys[i0] < 0) continue;
      var key = keys[i0], rw = 1, rh = 1;
      while (x0 + rw < gw && !seen[y0 * gw + x0 + rw] && keys[y0 * gw + x0 + rw] === key) rw++;
      for (;;) {
        if (y0 + rh >= gh) break;
        var ok = true;
        for (var xx = 0; xx < rw; xx++) {
          var q = (y0 + rh) * gw + x0 + xx;
          if (seen[q] || keys[q] !== key) { ok = false; break; }
        }
        if (!ok) break;
        rh++;
      }
      for (var yy = 0; yy < rh; yy++) for (var x2 = 0; x2 < rw; x2++) seen[(y0 + yy) * gw + x0 + x2] = 1;
      rects.push({ x: x0, y: y0, w: rw, h: rh, key: key });
    }
    return { gw: gw, gh: gh, rects: rects };
  }

  /* ---------- penulis RBXM biner ---------- */
  function cat(list) {
    var n = 0, i;
    for (i = 0; i < list.length; i++) n += list[i].length;
    var o = new Uint8Array(n), p = 0;
    for (i = 0; i < list.length; i++) { o.set(list[i], p); p += list[i].length; }
    return o;
  }
  function u32(n) { var b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; }
  function i32(n) { var b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n | 0, true); return b; }
  function str(s) { var e = new TextEncoder().encode(s); return cat([u32(e.length), e]); }
  function inter(vals) {
    var n = vals.length, o = new Uint8Array(n * 4);
    for (var i = 0; i < n; i++) {
      var v = vals[i] >>> 0;
      o[i] = v >>> 24; o[n + i] = (v >>> 16) & 255; o[2 * n + i] = (v >>> 8) & 255; o[3 * n + i] = v & 255;
    }
    return o;
  }
  function zig(n) { return ((n << 1) ^ (n >> 31)) >>> 0; }
  function refs(arr) {
    var p = 0;
    return inter(arr.map(function (v) { var d = v - p; p = v; return zig(d); }));
  }
  var fv = new DataView(new ArrayBuffer(4));
  function rotf(f) { fv.setFloat32(0, f, true); var b = fv.getUint32(0, true); return ((b << 1) | (b >>> 31)) >>> 0; }
  function floats(arr) { return inter(arr.map(rotf)); }
  function fillB(n, v) { var b = new Uint8Array(n); b.fill(v); return b; }
  function chunk(name, data) {
    var nm = new Uint8Array(4);
    for (var i = 0; i < 4; i++) nm[i] = name.charCodeAt(i) || 0;
    return cat([nm, u32(0), u32(data.length), u32(0), data]);
  }
  function prop(cls, name, type, data) {
    return chunk("PROP", cat([i32(cls), str(name), new Uint8Array([type]), data]));
  }
  function buildRbxm(P, modelName) {
    var N = P.length, i, out = [], ids = [];
    for (i = 0; i < N; i++) ids.push(i + 1);
    out.push(chunk("INST", cat([i32(0), str("Model"), new Uint8Array([0]), i32(1), refs([0])])));
    out.push(chunk("INST", cat([i32(1), str("Part"), new Uint8Array([0]), i32(N), refs(ids)])));
    out.push(prop(0, "Name", 0x01, str(modelName)));
    out.push(prop(1, "Name", 0x01, cat(P.map(function () { return str("Pixel"); }))));
    var sd = cat([floats(P.map(function (p) { return p.w; })), floats(P.map(function (p) { return p.h; })), floats(P.map(function (p) { return p.d; }))]);
    out.push(prop(1, "size", 0x0E, sd));
    out.push(prop(1, "Size", 0x0E, sd));
    out.push(prop(1, "CFrame", 0x10, cat([fillB(N, 0x02),
      floats(P.map(function (p) { return p.x; })), floats(P.map(function (p) { return p.y; })), floats(P.map(function (p) { return p.z; }))])));
    var R = new Uint8Array(N), G = new Uint8Array(N), B = new Uint8Array(N);
    for (i = 0; i < N; i++) { R[i] = P[i].r; G[i] = P[i].g; B[i] = P[i].b; }
    out.push(prop(1, "Color3uint8", 0x1A, cat([R, G, B])));
    out.push(prop(1, "Anchored", 0x02, fillB(N, 1)));
    out.push(prop(1, "Material", 0x12, inter(P.map(function () { return 272; }))));
    out.push(prop(1, "TopSurface", 0x12, inter(P.map(function () { return 0; }))));
    out.push(prop(1, "BottomSurface", 0x12, inter(P.map(function () { return 0; }))));
    var kids = [0].concat(ids), pars = [-1];
    for (i = 0; i < N; i++) pars.push(0);
    out.push(chunk("PRNT", cat([new Uint8Array([0]), i32(N + 1), refs(kids), refs(pars)])));
    out.push(chunk("END", new TextEncoder().encode("</roblox>")));
    var head = cat([
      new TextEncoder().encode("<roblox!"),
      new Uint8Array([0x89, 0xFF, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0]),
      i32(2), i32(N + 1), new Uint8Array(8)
    ]);
    return new Blob([head].concat(out), { type: "model/x-rbxm" });
  }

  /* ---------- preview 3D ---------- */
  var boxes = [], span = 20, yaw = 0.6, pitch = 0.3, spin = true, drag = null, raf = 0;
  var cv3 = Q("#ptC3"), cx = cv3.getContext("2d");
  var FACES = [
    { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
  ];
  function pageOn() { return sec.classList.contains("on"); }
  function draw() {
    raf = 0;
    if (!boxes.length || !pageOn()) return;
    if (spin && !drag) yaw += 0.012;
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var rot = function (x, y, z) {
      var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    };
    var W = cv3.width, H = cv3.height, k = Math.min(W, H) * 0.45 / (span * 0.75);
    cx.clearRect(0, 0, W, H);
    var vis = FACES.map(function (f) { var n = rot(f.n[0], f.n[1], f.n[2]); return n[2] > 0.01 ? n[2] : 0; });
    var order = boxes.map(function (b, i) { return [rot(b.x, b.y, b.z)[2], i]; });
    order.sort(function (a, b) { return a[0] - b[0]; });
    for (var oi = 0; oi < order.length; oi++) {
      var b = boxes[order[oi][1]], hx = b.w / 2, hy = b.h / 2, hz = b.d / 2;
      for (var fi = 0; fi < 6; fi++) {
        if (!vis[fi]) continue;
        var f = FACES[fi], sh = 0.5 + 0.5 * vis[fi];
        cx.beginPath();
        for (var ci = 0; ci < 4; ci++) {
          var c = f.c[ci], p = rot(b.x + c[0] * hx, b.y + c[1] * hy, b.z + c[2] * hz);
          var sx = W / 2 + p[0] * k, syy = H / 2 - p[1] * k;
          if (ci === 0) cx.moveTo(sx, syy); else cx.lineTo(sx, syy);
        }
        cx.closePath();
        cx.fillStyle = "rgb(" + Math.round(b.r * sh) + "," + Math.round(b.g * sh) + "," + Math.round(b.b * sh) + ")";
        cx.fill();
        cx.strokeStyle = cx.fillStyle; cx.lineWidth = 0.6; cx.stroke();
      }
    }
    if (!document.hidden && (spin || drag)) raf = requestAnimationFrame(draw);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(draw); }
  cv3.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; cv3.setPointerCapture(e.pointerId); kick(); });
  cv3.addEventListener("pointermove", function (e) {
    if (!drag) return;
    yaw += (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - drag.y) * 0.01));
    drag = { x: e.clientX, y: e.clientY }; kick();
  });
  ["pointerup", "pointercancel"].forEach(function (ev) { cv3.addEventListener(ev, function () { drag = null; kick(); }); });
  Q("#ptSpin").onclick = function () {
    spin = !spin;
    Q("#ptSpin").textContent = spin ? "⏸ Putar otomatis: nyala" : "▶ Putar otomatis: mati";
    kick();
  };
  document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
  var _gP = window.go;
  window.go = function (p) { _gP(p); if (p === "logopart") kick(); };

  /* ---------- buat model ---------- */
  var last = { blob: null, name: "Logo3D" };
  Q("#ptMk").onclick = async function () {
    var m = Q("#ptM");
    if (!srcC) return setMsg(m, "Pilih gambar dulu.", false);
    var size = +Q("#ptSize").value, depPct = +Q("#ptDep").value;
    if (!(size > 0)) return setMsg(m, "Isi ukuran dengan benar.", false);
    if (!(depPct > 0)) return setMsg(m, "Isi ketebalan dengan benar.", false);
    var maxParts = +Q("#ptMax").value, lv = +Q("#ptCol").value, res = +Q("#ptRes").value;
    var btn = Q("#ptMk"); btn.disabled = true; setMsg(m, "Memproses...", true);
    await sleep(30);
    try {
      var cut = cutout(srcC, Q("#ptMode").value, +Q("#ptTol").value, +Q("#ptEr").value);
      var pv = Q("#ptSrc"); pv.width = cut.w; pv.height = cut.h;
      pv.getContext("2d").putImageData(new ImageData(cut.data, cut.w, cut.h), 0, 0);
      var g = grid(cut.data, cut.w, cut.h, res, lv);
      while (g.rects.length > maxParts && res > 16) { res = Math.floor(res * 0.85); g = grid(cut.data, cut.w, cut.h, res, lv); }
      if (!g.rects.length) throw new Error("Tidak ada bagian padat. Cek pengaturan hapus latar.");
      var s = size / Math.max(g.gw, g.gh), depth = Math.max(0.05, size * depPct / 100);
      var P = g.rects.map(function (r) {
        return {
          w: Math.max(0.05, r.w * s), h: Math.max(0.05, r.h * s), d: depth,
          x: (r.x + r.w / 2 - g.gw / 2) * s, y: (g.gh / 2 - (r.y + r.h / 2)) * s, z: 0,
          r: (r.key >> 16) & 255, g: (r.key >> 8) & 255, b: r.key & 255
        };
      });
      var nm = (Q("#ptName").value.trim() || "Logo3D").slice(0, 40);
      var blob = buildRbxm(P, nm);
      if (blob.size > 20 * 1048576) throw new Error("File terlalu besar. Pilih detail lebih rendah.");
      last.blob = blob; last.name = nm;
      boxes = P; span = size;
      Q("#ptOut").style.display = "block";
      setMsg(m, "✓ Selesai. " + P.length.toLocaleString("id-ID") + " Part, grid " + g.gw + "×" + g.gh + ", file " + (blob.size / 1024).toFixed(1) + " KB.", true);
      setMsg(Q("#ptO"), "", true); Q("#ptLuau").style.display = "none";
      kick();
      Q("#ptOut").scrollIntoView({ behavior: "smooth" });
    } catch (e) { last.blob = null; setMsg(m, "✗ " + e.message, false); }
    btn.disabled = false;
  };

  Q("#ptDl").onclick = function () {
    if (!last.blob) return setMsg(Q("#ptO"), "Buat model dulu.", false);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(last.blob); a.download = safeName(last.name) + ".rbxm";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  };

  Q("#ptUp").onclick = async function () {
    var m = Q("#ptO");
    if (!last.blob) return setMsg(m, "Buat model dulu.", false);
    var need = needSettings();
    if (need) return setMsg(m, "✗ " + need, false);
    var b = Q("#ptUp"); b.disabled = true;
    try {
      var fd = new FormData();
      fd.append("file", last.blob, safeName(last.name) + ".rbxm");
      fd.append("name", last.name);
      fd.append("description", "Model Part 3D via ALEX STUDIO");
      fd.append("creatorType", LS.get("ctype", "User"));
      fd.append("creatorId", LS.get("cid"));
      setMsg(m, "Mengupload ke Roblox (" + (last.blob.size / 1024).toFixed(1) + " KB)...", true);
      var j = await api("/upload-model", { method: "POST", body: fd });
      setMsg(m, "Menunggu proses Roblox...", true);
      var id = await waitOp(j.operationId);
      bump(true);
      pushHist({ name: last.name, type: "Model", id: String(id), size: last.blob.size, at: new Date().toLocaleString() });
      setMsg(m, "✓ Berhasil! Model ID: " + id, true);
      copyBtn(m, String(id), "Salin ID");
      var pr = Q("#ptLuau");
      pr.style.display = "block";
      pr.textContent = 'local m = game:GetService("InsertService"):LoadAsset(' + id + ')\nm.Parent = workspace';
    } catch (e) {
      bump(false); setMsg(m, "✗ " + e.message, false);
      pushFail(last.name, "Model", last.blob.size, e.message);
    }
    b.disabled = false;
    refreshMe();
  };
})();
