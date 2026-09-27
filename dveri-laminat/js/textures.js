/*
 * Процедурные материалы: древесина, доски ламината, камень, шум.
 * Всё рисуется на canvas один раз и кешируется. Размеры задаются в миллиметрах,
 * ppm — сколько пикселей в миллиметре.
 */
(function () {
  "use strict";

  const cache = new Map();

  // Кеш с вытеснением старых записей, чтобы телефон не упирался в память.
  function memo(key, make) {
    if (cache.has(key)) {
      const v = cache.get(key);
      cache.delete(key);
      cache.set(key, v);
      return v;
    }
    const v = make();
    cache.set(key, v);
    if (cache.size > 90) cache.delete(cache.keys().next().value);
    return v;
  }

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hex(c) {
    let s = String(c || "#888888").replace("#", "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function css(c, a) {
    return (
      "rgba(" +
      Math.round(c[0]) +
      "," +
      Math.round(c[1]) +
      "," +
      Math.round(c[2]) +
      "," +
      (a === undefined ? 1 : a) +
      ")"
    );
  }

  const lighten = (c, t) => mix(c, [255, 255, 255], t);
  const darken = (c, t) => mix(c, [0, 0, 0], t);
  const luma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function ctx2d(c) {
    return c.getContext("2d", { willReadFrequently: true });
  }

  /* Шум: коррелированный вдоль x (волокна) или обычный. */
  function addNoise(ctx, w, h, amount, fibre, r) {
    if (amount <= 0) return;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      let n = 0;
      let i = y * w * 4;
      for (let x = 0; x < w; x++, i += 4) {
        n = fibre ? n * 0.86 + (r() - 0.5) * 0.5 : 0;
        const v = (n * 26 + (r() - 0.5) * 9) * amount;
        d[i] += v;
        d[i + 1] += v;
        d[i + 2] += v;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function rotate90(src) {
    const c = canvas(src.height, src.width);
    const g = c.getContext("2d");
    g.translate(c.width, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(src, 0, 0);
    return c;
  }

  /* ---------------------------------------------------------------- древесина */

  const FIGURES = {
    oak: { spacing: [1.1, 5.2], amp: [6, 1.8, 0.45], cathedral: 1.2, pores: 1, contrast: 1.05 },
    ash: { spacing: [1.4, 6.5], amp: [8, 2.4, 0.6], cathedral: 1.3, pores: 0.7, contrast: 1.3 },
    walnut: {
      spacing: [0.7, 3.6],
      amp: [12, 3.8, 0.9],
      cathedral: 0.8,
      pores: 0.35,
      contrast: 0.95,
    },
    pine: { spacing: [2.5, 10], amp: [7, 2, 0.4], cathedral: 1.1, pores: 0, contrast: 1.35 },
    linear: {
      spacing: [0.5, 2.6],
      amp: [1.2, 0.35, 0.1],
      cathedral: 0,
      pores: 0.25,
      contrast: 0.8,
    },
  };

  function strokeGrain(ctx, y0, from, to, step, disp) {
    ctx.beginPath();
    for (let x = from; x <= to + step; x += step) {
      const y = y0 + disp(x, y0);
      if (x === from) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /*
   * Доска с волокнами вдоль оси x. lenMM × widMM, look — цвета и рисунок.
   * Возвращает canvas (lenMM·ppm × widMM·ppm).
   */
  function woodBoard(lenMM, widMM, ppm, look, seed) {
    const w = Math.round(lenMM * ppm);
    const h = Math.round(widMM * ppm);
    const c = canvas(w, h);
    const ctx = ctx2d(c);
    const r = rng(seed);
    const fig = FIGURES[look.figure] || FIGURES.oak;
    const base = hex(look.base);
    const dark = look.dark ? hex(look.dark) : darken(base, 0.4);
    const light = look.light ? hex(look.light) : lighten(base, 0.2);
    const k = (look.contrast === undefined ? 1 : look.contrast) * fig.contrast;

    const jitter = (r() - 0.5) * 2 * (look.variation === undefined ? 0.05 : look.variation);
    const b0 = jitter > 0 ? lighten(base, jitter) : darken(base, -jitter);
    const warm = mix(b0, [214, 150, 80], 0.08);
    ctx.fillStyle = css(b0);
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(ppm, ppm);
    const W = lenMM;
    const H = widMM;

    // широкие полосы тона вдоль волокон
    const streaks = 5 + Math.round(H / 22);
    for (let i = 0; i < streaks; i++) {
      const y = r() * H;
      const bh = H * (0.05 + r() * 0.3);
      const col = r() < 0.55 ? dark : r() < 0.5 ? light : warm;
      const a = (0.03 + r() * 0.08) * k;
      const g = ctx.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
      g.addColorStop(0, css(col, 0));
      g.addColorStop(0.5, css(col, a));
      g.addColorStop(1, css(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - bh / 2, W, bh);
    }
    // пятна по длине
    for (let i = 0; i < 5; i++) {
      const x = r() * W;
      const bw = W * (0.08 + r() * 0.3);
      const col = r() < 0.5 ? dark : light;
      const a = (0.03 + r() * 0.07) * k;
      const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
      g.addColorStop(0, css(col, 0));
      g.addColorStop(0.5, css(col, a));
      g.addColorStop(1, css(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - bw / 2, 0, bw, H);
    }

    // сучки
    const knots = [];
    const expected = (look.knots || 0) * ((W * H) / 150000);
    const nk = Math.floor(expected + r());
    for (let i = 0; i < nk; i++) {
      knots.push({
        x: W * (0.08 + r() * 0.84),
        y: H * (0.2 + r() * 0.6),
        rx: 9 + r() * 15,
        ry: 5 + r() * 7,
      });
    }

    // поле смещения: соседние волокна изгибаются одинаково
    const waves = [
      {
        a: fig.amp[0] * (0.5 + r()),
        f: (2 * Math.PI) / (W * (0.35 + r() * 0.7)),
        p: r() * 7,
        k: 0.004 + r() * 0.008,
      },
      {
        a: fig.amp[1] * (0.5 + r()),
        f: (2 * Math.PI) / (70 + r() * 150),
        p: r() * 7,
        k: 0.012 + r() * 0.03,
      },
      {
        a: fig.amp[2] * (0.5 + r()),
        f: (2 * Math.PI) / (9 + r() * 22),
        p: r() * 7,
        k: 0.05 + r() * 0.2,
      },
    ];
    const disp = (x, y0) => {
      let d = 0;
      for (let i = 0; i < 3; i++) {
        const wv = waves[i];
        d += wv.a * Math.sin(x * wv.f + wv.p + y0 * wv.k);
      }
      for (let i = 0; i < knots.length; i++) {
        const kn = knots[i];
        const dx = (x - kn.x) / (kn.rx * 3);
        const dy = (y0 - kn.y) / (kn.ry * 3.4);
        const e = Math.exp(-dx * dx - dy * dy);
        if (e > 0.002) d += (y0 >= kn.y ? 1 : -1) * kn.ry * 2 * e;
      }
      return d;
    };

    // «соборы» — арочный рисунок тангентального распила
    const cats = [];
    if (fig.cathedral > 0) {
      const count = Math.floor((W / 800) * fig.cathedral * (0.5 + r()) + r() * 0.9);
      for (let i = 0; i < count; i++) {
        const hw = Math.min(H * (0.2 + r() * 0.25), 26 + r() * 50);
        cats.push({
          x: W * (0.05 + r() * 0.75),
          y: hw * 0.6 + r() * Math.max(1, H - hw * 1.2),
          len: 140 + r() * 420,
          hw,
          rings: 5 + Math.floor(r() * 6),
          dir: r() < 0.5 ? 1 : -1,
        });
      }
    }
    const archX = (cat, t, u) =>
      cat.x + cat.dir * cat.len * (0.3 + 0.7 * t) * (1 - Math.pow(Math.abs(u), 1.35));

    const step = Math.max(2, W / 420);

    // обычные волокна, кроме области «соборов»
    ctx.save();
    if (cats.length) {
      const clip = new Path2D();
      clip.rect(-10, -10, W + 20, H + 20);
      for (const cat of cats) {
        const edge = cat.dir > 0 ? -20 : W + 20;
        const xs = cat.dir > 0 ? 1 : -1;
        const top = cat.y - cat.hw - 0.6;
        const bot = cat.y + cat.hw + 0.6;
        clip.moveTo(edge, top + disp(edge, top));
        for (let x = edge; xs > 0 ? x <= cat.x : x >= cat.x; x += xs * step) {
          clip.lineTo(x, top + disp(x, top));
        }
        for (let u = -1; u <= 1.0001; u += 0.04) {
          const y = cat.y + u * (cat.hw + 0.6);
          const x = archX(cat, 1, u) + cat.dir * 1.5;
          clip.lineTo(x, y + disp(x, y));
        }
        for (let x = cat.x; xs > 0 ? x >= edge : x <= edge; x -= xs * step) {
          clip.lineTo(x, bot + disp(x, bot));
        }
        clip.closePath();
      }
      ctx.clip(clip, "evenodd");
    }
    ctx.lineCap = "round";
    const range = fig.amp[0] * 3 + 8;
    let y0 = -range;
    while (y0 < H + range) {
      y0 += fig.spacing[0] + r() * (fig.spacing[1] - fig.spacing[0]);
      const late = r() < 0.38;
      const a = Math.min(0.7, (late ? 0.2 + r() * 0.26 : 0.06 + r() * 0.1) * k);
      ctx.strokeStyle = css(late ? dark : mix(dark, b0, 0.45), a);
      ctx.lineWidth = late ? 0.45 + r() * 0.85 : 0.18 + r() * 0.4;
      strokeGrain(ctx, y0, -4, W + 4, step, disp);
      if (r() < 0.22) {
        // широкая мягкая полоса: видна даже в маленькой картинке
        ctx.strokeStyle = css(r() < 0.7 ? dark : light, (0.035 + r() * 0.05) * k);
        ctx.lineWidth = 1.6 + r() * 3.4;
        strokeGrain(ctx, y0 + 1.2, -4, W + 4, step, disp);
      }
      if (r() < 0.14) {
        ctx.strokeStyle = css(light, 0.14 * k);
        ctx.lineWidth = 0.6 + r() * 0.8;
        strokeGrain(ctx, y0 + 0.9, -4, W + 4, step, disp);
      }
    }
    ctx.restore();

    // «соборы»
    for (const cat of cats) {
      const edge = cat.dir > 0 ? -20 : W + 20;
      for (let j = cat.rings - 1; j >= 0; j--) {
        const t = (j + 1) / cat.rings;
        const hw = cat.hw * t;
        const path = new Path2D();
        const xs = cat.dir > 0 ? 1 : -1;
        path.moveTo(edge, cat.y - hw + disp(edge, cat.y - hw));
        for (let x = edge; xs > 0 ? x <= cat.x : x >= cat.x; x += xs * step) {
          path.lineTo(x, cat.y - hw + disp(x, cat.y - hw));
        }
        for (let u = -1; u <= 1.0001; u += 0.04) {
          const x = archX(cat, t, u);
          const y = cat.y + u * hw;
          path.lineTo(x, y + disp(x, y));
        }
        for (let x = cat.x; xs > 0 ? x >= edge : x <= edge; x -= xs * step) {
          path.lineTo(x, cat.y + hw + disp(x, cat.y + hw));
        }
        ctx.fillStyle = css(j % 2 ? dark : warm, 0.06 * k);
        ctx.fill(path);
        ctx.strokeStyle = css(dark, Math.min(0.6, (0.18 + r() * 0.22) * k));
        ctx.lineWidth = 0.45 + r() * 1.1;
        ctx.stroke(path);
      }
    }

    // поры
    if (fig.pores > 0) {
      const n = Math.round(W * H * 0.0035 * fig.pores);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = r() * W;
        const y = r() * H;
        const l = 1.2 + r() * 5;
        const yy = y + disp(x, y);
        ctx.moveTo(x, yy);
        ctx.lineTo(x + l, y + disp(x + l, y));
      }
      ctx.strokeStyle = css(dark, 0.16 * k);
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }

    // сучки
    for (const kn of knots) {
      ctx.save();
      ctx.translate(kn.x, kn.y);
      ctx.scale(1, kn.ry / kn.rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, kn.rx * 1.25);
      g.addColorStop(0, css(darken(dark, 0.35), 0.95));
      g.addColorStop(0.35, css(dark, 0.75));
      g.addColorStop(0.7, css(dark, 0.22));
      g.addColorStop(1, css(dark, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, kn.rx * 1.25, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, kn.rx * (0.35 + i * 0.22), 0, Math.PI * 2);
        ctx.strokeStyle = css(dark, 0.3 / i);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.restore();
      if (r() < 0.6) {
        ctx.beginPath();
        ctx.moveTo(kn.x - kn.rx * 0.2, kn.y);
        ctx.lineTo(kn.x + kn.rx * (1.2 + r()), kn.y + (r() - 0.5) * 2);
        ctx.strokeStyle = css(darken(dark, 0.5), 0.55);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
    ctx.restore();

    addNoise(ctx, w, h, 0.55 + (1 - luma(b0)) * 0.2, true, r);
    return c;
  }

  /* ---------------------------------------------------------------- камень */

  function stoneTile(lenMM, widMM, ppm, look, seed) {
    const w = Math.round(lenMM * ppm);
    const h = Math.round(widMM * ppm);
    const c = canvas(w, h);
    const ctx = ctx2d(c);
    const r = rng(seed);
    const base = hex(look.base);
    const dark = look.dark ? hex(look.dark) : darken(base, 0.3);
    const light = look.light ? hex(look.light) : lighten(base, 0.25);
    const jitter = (r() - 0.5) * 0.08;
    const b0 = jitter > 0 ? lighten(base, jitter) : darken(base, -jitter);
    ctx.fillStyle = css(b0);
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(ppm, ppm);
    for (let i = 0; i < 70; i++) {
      const x = r() * lenMM;
      const y = r() * widMM;
      const rad = 10 + r() * Math.min(lenMM, widMM) * 0.8;
      const col = r() < 0.5 ? dark : light;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.03 + r() * 0.08;
      g.addColorStop(0, css(col, a));
      g.addColorStop(1, css(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // поры бетона
    const pores = Math.round(lenMM * widMM * 0.0012);
    for (let i = 0; i < pores; i++) {
      const x = r() * lenMM;
      const y = r() * widMM;
      const rad = 0.3 + r() * r() * 1.6;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = css(darken(dark, 0.2), 0.25 + r() * 0.35);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + rad * 0.3, y + rad * 0.4, rad * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = css(light, 0.12);
      ctx.fill();
    }
    // следы затирки
    ctx.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const x = r() * lenMM;
      const y = r() * widMM;
      const len = 60 + r() * 260;
      const ang = (r() - 0.5) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + (len / 2) * Math.cos(ang),
        y + (r() - 0.5) * 30,
        x + len * Math.cos(ang),
        y + len * Math.sin(ang),
      );
      ctx.strokeStyle = css(r() < 0.5 ? light : dark, 0.05 + r() * 0.05);
      ctx.lineWidth = 4 + r() * 16;
      ctx.stroke();
    }
    ctx.restore();
    addNoise(ctx, w, h, 0.9, false, r);
    return c;
  }

  /* ------------------------------------------------------------- покрытие металла */

  function metalSkin(wMM, hMM, ppm, finish, seed) {
    const w = Math.round(wMM * ppm);
    const h = Math.round(hMM * ppm);
    const c = canvas(w, h);
    const ctx = ctx2d(c);
    const r = rng(seed);
    const base = hex(finish.color);
    const fleck = finish.fleck ? hex(finish.fleck) : lighten(base, 0.35);
    ctx.fillStyle = css(base);
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(ppm, ppm);
    const cells = Math.round(wMM * hMM * 0.0011);
    for (let i = 0; i < cells; i++) {
      const x = r() * wMM;
      const y = r() * hMM;
      const rad = 3 + r() * 9;
      const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
      g.addColorStop(0, css(fleck, finish.fleck ? 0.35 : 0.1));
      g.addColorStop(0.6, css(base, 0));
      g.addColorStop(1, css(darken(base, 0.4), finish.fleck ? 0.25 : 0.08));
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
    addNoise(ctx, w, h, finish.fleck ? 1.1 : 0.7, false, r);
    return c;
  }

  /* ------------------------------------------------------------- доски ламината */

  function lookOf(p) {
    return Object.assign({ figure: "oak" }, p.look || {});
  }

  function plankVariants(p, ppm) {
    const look = lookOf(p);
    const [L, Wd] = p.plank || [1380, 193];
    const n = p.pattern === "herringbone" ? 10 : look.figure === "stone" ? 5 : 7;
    const key = "v|" + p.id + "|" + JSON.stringify(look) + "|" + L + "x" + Wd + "|" + ppm;
    return memo(key, () => {
      const seed = hash(p.id);
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push(
          look.figure === "stone"
            ? stoneTile(L, Wd, ppm, look, seed + i * 7919)
            : woodBoard(L, Wd, ppm, look, seed + i * 7919),
        );
      }
      return out;
    });
  }

  /* Фаска и стыки поверх доски (координаты в пикселях). */
  function plankEdges(ctx, x, y, w, h, bevel, px, ends) {
    const b = Math.max(1, 2.6 * px);
    const line = Math.max(0.6, 0.35 * px);
    const long = bevel === "4V" || bevel === "2V";
    const short = bevel === "4V";
    if (long) {
      let g = ctx.createLinearGradient(0, y, 0, y + b);
      g.addColorStop(0, "rgba(0,0,0,0.34)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, b);
      g = ctx.createLinearGradient(0, y + h - b, 0, y + h);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.7, "rgba(255,255,255,0.1)");
      g.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y + h - b, w, b);
    }
    if (short && ends) {
      let g = ctx.createLinearGradient(x, 0, x + b, 0);
      g.addColorStop(0, "rgba(0,0,0,0.3)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, b, h);
      g = ctx.createLinearGradient(x + w - b, 0, x + w, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.26)");
      ctx.fillStyle = g;
      ctx.fillRect(x + w - b, y, b, h);
    }
    ctx.fillStyle = long ? "rgba(20,12,6,0.55)" : "rgba(20,12,6,0.32)";
    ctx.fillRect(x, y, w, line);
    if (ends) {
      ctx.fillStyle = short ? "rgba(20,12,6,0.5)" : "rgba(20,12,6,0.3)";
      ctx.fillRect(x, y, line, h);
    }
  }

  function drawPlank(ctx, img, x, y, w, h, flip, tone) {
    ctx.save();
    if (flip) {
      ctx.translate(x + w, y + h);
      ctx.scale(-1, -1);
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();
    if (tone) {
      ctx.fillStyle = tone > 0 ? "rgba(255,248,236," + tone + ")" : "rgba(20,10,4," + -tone + ")";
      ctx.fillRect(x, y, w, h);
    }
  }

  /*
   * Бесшовная плитка пола. dir: "h" — доски горизонтально, "v" — вертикально.
   * Возвращает { canvas, ppm, mmW, mmH }.
   */
  function floorTile(p, ppm, dir) {
    dir = dir || "h";
    const key = "f|" + p.id + "|" + JSON.stringify(p.look) + "|" + ppm + "|" + dir;
    return memo(key, () => {
      if (p.pattern === "herringbone") return herringbone(p, ppm);
      const t = straight(p, ppm);
      if (dir === "v") return { canvas: rotate90(t.canvas), ppm, mmW: t.mmH, mmH: t.mmW };
      return t;
    });
  }

  function straight(p, ppm, cols, rows) {
    const [L, Wd] = p.plank || [1380, 193];
    const variants = plankVariants(p, ppm);
    const r = rng(hash(p.id + "floor"));
    cols = cols || Math.max(2, Math.ceil(2800 / L));
    rows = rows || Math.max(6, Math.ceil(1500 / Wd));
    const pw = L * ppm;
    const ph = Wd * ppm;
    const c = canvas(cols * pw, rows * ph);
    const ctx = c.getContext("2d");
    const tile = p.pattern === "tile";
    let prev = 0;
    for (let row = 0; row < rows; row++) {
      let off;
      if (tile) off = row % 2 ? 0.5 : 0;
      else {
        do off = r();
        while (Math.abs(off - prev) < 0.22 || Math.abs(off - prev) > 0.78);
      }
      prev = off;
      const seq = [];
      for (let j = 0; j < cols; j++) {
        seq.push({
          v: Math.floor(r() * variants.length),
          flip: r() < 0.5,
          tone: (r() - 0.5) * 0.07,
        });
      }
      const y = row * ph;
      for (let j = -1; j <= cols; j++) {
        const x = (j - off) * pw;
        const s = seq[((j % cols) + cols) % cols];
        drawPlank(ctx, variants[s.v], x, y, pw, ph, s.flip, s.tone);
        plankEdges(ctx, x, y, pw, ph, p.bevel, ppm, true);
      }
    }
    return { canvas: c, ppm, mmW: cols * L, mmH: rows * Wd };
  }

  /* Ёлочка: решётка сдвигов (W, W) и (L, −L), затем поворот на 45°. */
  function herringbone(p, ppm, Pm, Pt) {
    const [L, Wd] = p.plank || [600, 100];
    const variants = plankVariants(p, ppm);
    const s2 = Math.SQRT2;
    Pm = Pm || 2;
    Pt = Pt || Math.max(8, Math.round(1100 / (Wd * s2)));
    const mmW = Pm * L * s2;
    const mmH = Pt * Wd * s2;
    const c = canvas(mmW * ppm, mmH * ppm);
    const ctx = c.getContext("2d");
    const k = ppm / s2;
    const seed = hash(p.id + "hb");
    const pick = (t, m, v) => {
      const tt = ((t % Pt) + Pt) % Pt;
      const mm = ((m % Pm) + Pm) % Pm;
      const r = rng(seed + tt * 131 + mm * 7907 + (v ? 3 : 0));
      return { v: Math.floor(r() * variants.length), flip: r() < 0.5, tone: (r() - 0.5) * 0.08 };
    };
    const tMax = Pt + Math.ceil(L / Wd) + 3;
    for (let m = -2; m <= Pm + 1; m++) {
      for (let t = -Math.ceil(L / Wd) - 3; t <= tMax; t++) {
        const x = t * Wd + m * L;
        const y = t * Wd - m * L;
        // горизонтальная планка
        ctx.setTransform(k, k, -k, k, 0, 0);
        let s = pick(t, m, false);
        drawPlank(ctx, variants[s.v], x, y, L, Wd, s.flip, s.tone);
        plankEdges(ctx, x, y, L, Wd, p.bevel, 1, true);
        // вертикальная планка
        const vx = x + L;
        const vy = y - L + Wd;
        s = pick(t, m, true);
        ctx.setTransform(k, k, -k, k, 0, 0);
        ctx.translate(vx + Wd, vy);
        ctx.rotate(Math.PI / 2);
        drawPlank(ctx, variants[s.v], 0, 0, L, Wd, s.flip, s.tone);
        plankEdges(ctx, 0, 0, L, Wd, p.bevel, 1, true);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas: c, ppm, mmW, mmH };
  }

  /* Участок пола mmW × mmH без повторов — для крупного плана. */
  function floorRegion(p, ppm, mmW, mmH) {
    const key =
      "r|" +
      p.id +
      "|" +
      JSON.stringify(p.look) +
      "|" +
      ppm +
      "|" +
      Math.round(mmW) +
      "x" +
      Math.round(mmH);
    return memo(key, () => {
      const [L, Wd] = p.plank || [1380, 193];
      if (p.pattern === "herringbone") {
        const s2 = Math.SQRT2;
        return herringbone(p, ppm, Math.ceil(mmW / (L * s2)), Math.ceil(mmH / (Wd * s2))).canvas;
      }
      return straight(p, ppm, Math.ceil(mmW / L) + 1, Math.ceil(mmH / Wd)).canvas;
    });
  }

  /* ------------------------------------------------------------- отделка двери */

  /* Текстура отделки на всё полотно (вертикальные волокна) или null для краски. */
  function finishTexture(finish, wMM, hMM, ppm, seed) {
    if (!finish || finish.type === "paint" || !finish.type) return null;
    const key =
      "d|" +
      finish.type +
      "|" +
      finish.color +
      "|" +
      finish.grain +
      "|" +
      finish.figure +
      "|" +
      finish.fleck +
      "|" +
      wMM +
      "x" +
      hMM +
      "|" +
      ppm +
      "|" +
      seed;
    return memo(key, () => {
      if (finish.type === "metal") return metalSkin(wMM, hMM, ppm, finish, seed);
      const look = {
        base: finish.color,
        dark: finish.grain,
        figure: finish.figure || "oak",
        variation: 0.02,
        contrast: 0.9,
      };
      return rotate90(woodBoard(hMM, wMM, ppm, look, seed));
    });
  }

  /* Отдельная текстура с горизонтальными волокнами (для поперечин). */
  function finishTextureH(finish, wMM, hMM, ppm, seed) {
    if (!finish || finish.type !== "wood") return null;
    const key =
      "dh|" +
      finish.color +
      "|" +
      finish.grain +
      "|" +
      finish.figure +
      "|" +
      wMM +
      "x" +
      hMM +
      "|" +
      ppm +
      "|" +
      seed;
    return memo(key, () =>
      woodBoard(
        wMM,
        hMM,
        ppm,
        {
          base: finish.color,
          dark: finish.grain,
          figure: finish.figure || "oak",
          variation: 0.02,
          contrast: 0.9,
        },
        seed,
      ),
    );
  }

  /* Мелкий шум для «стекла» и штукатурки. */
  function noiseTile(size, alpha) {
    return memo("n|" + size + "|" + alpha, () => {
      const c = canvas(size, size);
      const g = c.getContext("2d");
      const img = g.createImageData(size, size);
      const r = rng(7);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.round(r() * 255);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = Math.round(alpha * 255);
      }
      g.putImageData(img, 0, 0);
      return c;
    });
  }

  /* Маленький кружок-образец цвета, dataURL. */
  function swatchURL(finish, size) {
    size = size || 64;
    const key = "s|" + JSON.stringify(finish) + "|" + size;
    return memo(key, () => {
      const c = canvas(size, size);
      const g = c.getContext("2d");
      const tex = finishTexture(finish, 500, 500, 0.4, 11);
      if (tex) g.drawImage(tex, 0, 0, tex.width, tex.height, 0, 0, size, size);
      else {
        g.fillStyle = finish.color;
        g.fillRect(0, 0, size, size);
      }
      const hl = g.createLinearGradient(0, 0, size, size);
      hl.addColorStop(0, "rgba(255,255,255,0.28)");
      hl.addColorStop(0.5, "rgba(255,255,255,0)");
      hl.addColorStop(1, "rgba(0,0,0,0.18)");
      g.fillStyle = hl;
      g.fillRect(0, 0, size, size);
      return c.toDataURL("image/png");
    });
  }

  window.Textures = {
    rng,
    hash,
    hex,
    mix,
    css,
    lighten,
    darken,
    luma,
    canvas,
    memo,
    woodBoard,
    stoneTile,
    plankVariants,
    floorTile,
    finishTexture,
    finishTextureH,
    noiseTile,
    swatchURL,
    floorRegion,
  };
})();
