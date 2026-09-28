/*
 * Отрисовка дверей и сцен «дверь + пол + стена».
 * Дверь рисуется в миллиметрах: полотно, наличники, фурнитура, стекло.
 * Пол — плоскость с текстурой ламината в CSS-перспективе.
 */
(function () {
  "use strict";

  const T = window.Textures;

  /* ------------------------------------------------------------------ геометрия */

  const GEO = {
    interior: { LW: 800, LH: 2000, C: 70, R: 12 },
    entrance: { LW: 880, LH: 2050, C: 56, R: 8 },
  };

  function geo(p) {
    const g = GEO[p && p.kind === "entrance" ? "entrance" : "interior"];
    return {
      LW: g.LW,
      LH: g.LH,
      C: g.C,
      R: g.R,
      W: g.LW + 2 * (g.C + g.R),
      H: g.LH + g.C + g.R,
      lx: g.C + g.R,
      ly: g.C + g.R,
    };
  }

  /* ------------------------------------------------------------------ помощники */

  const METALS = {
    chrome: ["#fbfcfd", "#c7cdd2", "#7b848b", "#e1e5e8", "#8e979d"],
    satin: ["#eceeef", "#c6cacd", "#9aa0a4", "#d3d7d9", "#a2a7aa"],
    black: ["#5d5f63", "#2c2d30", "#121314", "#323336", "#1b1c1e"],
    gold: ["#fff0c0", "#e0b862", "#a5762b", "#f0d489", "#98692a"],
    bronze: ["#d9b690", "#9c7353", "#5a3d27", "#b28c66", "#5e412b"],
  };

  function metalGrad(ctx, name, x0, y0, x1, y1) {
    const c = METALS[name] || METALS.chrome;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c[0]);
    g.addColorStop(0.28, c[1]);
    g.addColorStop(0.52, c[2]);
    g.addColorStop(0.74, c[3]);
    g.addColorStop(1, c[4]);
    return g;
  }

  function poly(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function rrPath(x, y, w, h, r) {
    const p = new Path2D();
    r = Math.min(r, w / 2, h / 2);
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.arcTo(x + w, y, x + w, y + r, r);
    p.lineTo(x + w, y + h - r);
    p.arcTo(x + w, y + h, x + w - r, y + h, r);
    p.lineTo(x + r, y + h);
    p.arcTo(x, y + h, x, y + h - r, r);
    p.lineTo(x, y + r);
    p.arcTo(x, y, x + r, y, r);
    p.closePath();
    return p;
  }

  function shadow(ctx, s, dx, dy, blur, a) {
    ctx.shadowColor = "rgba(0,0,0," + a + ")";
    ctx.shadowOffsetX = dx * s;
    ctx.shadowOffsetY = dy * s;
    ctx.shadowBlur = blur * s;
  }

  const W = (a) => "rgba(255,255,255," + a.toFixed(3) + ")";
  const K = (a) => "rgba(0,0,0," + a.toFixed(3) + ")";

  /* ------------------------------------------------------------------ окружение */

  function env(p, f, s, hinge) {
    const g = geo(p);
    const lum = T.luma(T.hex(f.color));
    const ppm = s > 0.8 ? 0.9 : s > 0.42 ? 0.6 : s > 0.14 ? 0.32 : 0.14;
    const seed = T.hash(p.id + "|" + f.name);
    const e = {
      p,
      f,
      g,
      LW: g.LW,
      LH: g.LH,
      s,
      lum,
      hi: 0.16 + 0.24 * (1 - lum),
      lo: 0.12 + 0.2 * lum,
      hingeLeft: hinge !== "right",
      glass: p.glass || "frosted",
      metal: p.handle || "chrome",
      tex: T.finishTexture(f, g.LW + 400, g.LH + 200, ppm, seed),
      texH: f.type === "wood" ? T.finishTextureH(f, g.LW + 400, 420, ppm, seed + 17) : null,
    };
    e.mx = (x, w) => (e.hingeLeft ? x : e.LW - x - (w || 0));
    return e;
  }

  /* Закрасить область отделкой. shift — сдвиг рисунка, horizontal — волокна поперёк. */
  function paint(ctx, e, x, y, w, h, shift, horizontal) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (horizontal && e.texH) {
      ctx.drawImage(e.texH, -(shift % 380), y - (420 - h) / 2, e.LW + 400, 420);
    } else if (e.tex) {
      ctx.drawImage(e.tex, -(shift % 380), -((shift * 0.37) % 180), e.LW + 400, e.LH + 200);
    } else {
      ctx.fillStyle = e.f.color;
      ctx.fillRect(x, y, w, h);
      const n = T.noiseTile(96, 0.5);
      const pat = ctx.createPattern(n, "repeat");
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / Math.max(0.2, e.s)));
      ctx.globalAlpha = 0.05;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = pat;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ рельеф */

  function bevel4(ctx, e, x, y, w, h, b) {
    poly(
      ctx,
      [
        [x, y],
        [x + w, y],
        [x + w - b, y + b],
        [x + b, y + b],
      ],
      W(e.hi * 1.05),
    );
    poly(
      ctx,
      [
        [x, y],
        [x + b, y + b],
        [x + b, y + h - b],
        [x, y + h],
      ],
      W(e.hi * 0.5),
    );
    poly(
      ctx,
      [
        [x, y + h],
        [x + b, y + h - b],
        [x + w - b, y + h - b],
        [x + w, y + h],
      ],
      K(e.lo * 1.15),
    );
    poly(
      ctx,
      [
        [x + w, y],
        [x + w, y + h],
        [x + w - b, y + h - b],
        [x + w - b, y + b],
      ],
      K(e.lo * 0.6),
    );
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + b, y + b);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w - b, y + b);
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + b, y + h - b);
    ctx.moveTo(x + w, y + h);
    ctx.lineTo(x + w - b, y + h - b);
    ctx.strokeStyle = K(e.lo * 0.4);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.strokeStyle = K(e.lo * 0.5);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + b, y + b, w - 2 * b, h - 2 * b);
  }

  function sunken(ctx, e, x, y, w, h, d) {
    poly(
      ctx,
      [
        [x, y],
        [x + w, y],
        [x + w - d, y + d],
        [x + d, y + d],
      ],
      K(e.lo * 1.3),
    );
    poly(
      ctx,
      [
        [x, y],
        [x + d, y + d],
        [x + d, y + h - d],
        [x, y + h],
      ],
      K(e.lo * 0.95),
    );
    poly(
      ctx,
      [
        [x, y + h],
        [x + d, y + h - d],
        [x + w - d, y + h - d],
        [x + w, y + h],
      ],
      W(e.hi * 1.1),
    );
    poly(
      ctx,
      [
        [x + w, y],
        [x + w, y + h],
        [x + w - d, y + h - d],
        [x + w - d, y + d],
      ],
      W(e.hi * 0.55),
    );
  }

  function innerShade(ctx, e, x, y, w, h, d) {
    let g = ctx.createLinearGradient(0, y, 0, y + d);
    g.addColorStop(0, K(e.lo * 0.9));
    g.addColorStop(1, K(0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, d);
    g = ctx.createLinearGradient(x, 0, x + d * 0.7, 0);
    g.addColorStop(0, K(e.lo * 0.6));
    g.addColorStop(1, K(0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, d * 0.7, h);
  }

  function grooveH(ctx, e, x1, x2, y, w) {
    ctx.fillStyle = K(0.2 + e.lo * 1.2);
    ctx.fillRect(x1, y - w / 2, x2 - x1, w * 0.55);
    ctx.fillStyle = K(0.08 + e.lo * 0.3);
    ctx.fillRect(x1, y + w * 0.05, x2 - x1, w * 0.2);
    ctx.fillStyle = W(e.hi * 1.2);
    ctx.fillRect(x1, y + w * 0.25, x2 - x1, w * 0.3);
  }

  function grooveV(ctx, e, x, y1, y2, w) {
    ctx.fillStyle = K(0.16 + e.lo * 1.05);
    ctx.fillRect(x - w / 2, y1, w * 0.55, y2 - y1);
    ctx.fillStyle = W(e.hi * 1.1);
    ctx.fillRect(x + w * 0.2, y1, w * 0.3, y2 - y1);
  }

  function groovePath(ctx, e, path, w) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.translate(-w * 0.16, -w * 0.16);
    ctx.strokeStyle = K(0.22 + e.lo * 1.1);
    ctx.lineWidth = w;
    ctx.stroke(path);
    ctx.translate(w * 0.34, w * 0.34);
    ctx.strokeStyle = W(e.hi * 1.1);
    ctx.lineWidth = w * 0.4;
    ctx.stroke(path);
    ctx.restore();
  }

  function molding(ctx, e, x, y, w, h, m) {
    ctx.fillStyle = K(e.lo * 0.55);
    ctx.fillRect(x + 3, y + h, w - 1, 3.5);
    ctx.fillRect(x + w, y + 3, 3.5, h - 1);
    const strips = [
      [
        [
          [x, y],
          [x + w, y],
          [x + w - m, y + m],
          [x + m, y + m],
        ],
        [0, y, 0, y + m],
      ],
      [
        [
          [x, y + h],
          [x + m, y + h - m],
          [x + w - m, y + h - m],
          [x + w, y + h],
        ],
        [0, y + h - m, 0, y + h],
      ],
      [
        [
          [x, y],
          [x + m, y + m],
          [x + m, y + h - m],
          [x, y + h],
        ],
        [x, 0, x + m, 0],
      ],
      [
        [
          [x + w, y],
          [x + w, y + h],
          [x + w - m, y + h - m],
          [x + w - m, y + m],
        ],
        [x + w - m, 0, x + w, 0],
      ],
    ];
    for (const [pts, gd] of strips) {
      const g = ctx.createLinearGradient(gd[0], gd[1], gd[2], gd[3]);
      g.addColorStop(0, W(e.hi * 1.25));
      g.addColorStop(0.35, W(e.hi * 0.35));
      g.addColorStop(0.62, K(e.lo * 0.25));
      g.addColorStop(1, K(e.lo * 1.1));
      poly(ctx, pts, g);
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + m, y + m);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w - m, y + m);
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + m, y + h - m);
    ctx.moveTo(x + w, y + h);
    ctx.lineTo(x + w - m, y + h - m);
    ctx.strokeStyle = K(e.lo * 0.5);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  function softRaised(ctx, e, x, y, w, h, b, r) {
    const outer = rrPath(x, y, w, h, r);
    const inner = rrPath(x + b, y + b, w - 2 * b, h - 2 * b, r * 0.5);
    const ring = new Path2D();
    ring.addPath(outer);
    ring.addPath(inner);
    const g = ctx.createLinearGradient(x, y, x + w * 0.35, y + h);
    g.addColorStop(0, W(e.hi * 1.2));
    g.addColorStop(0.5, W(0));
    g.addColorStop(0.5, K(0));
    g.addColorStop(1, K(e.lo * 1.3));
    ctx.fillStyle = g;
    ctx.fill(ring, "evenodd");
    ctx.strokeStyle = K(e.lo * 0.6);
    ctx.lineWidth = 1;
    ctx.stroke(outer);
    ctx.strokeStyle = W(e.hi * 0.6);
    ctx.stroke(inner);
  }

  /* ------------------------------------------------------------------ стекло */

  function glassPane(ctx, e, x, y, w, h) {
    const type = e.glass;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    let g;
    if (type === "clear" || type === "bronze" || type === "black") {
      const cols = {
        clear: ["#5b6c6e", "#35423f", "#1c2423"],
        bronze: ["#90704c", "#5a4128", "#2e2014"],
        black: ["#34363a", "#1b1c1f", "#0d0e0f"],
      }[type];
      g = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
      g.addColorStop(0, cols[0]);
      g.addColorStop(0.55, cols[1]);
      g.addColorStop(1, cols[2]);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      if (type !== "black") {
        const r = Math.max(w, h) * 0.55;
        const rg = ctx.createRadialGradient(
          x + w * 0.55,
          y + h * 0.28,
          0,
          x + w * 0.55,
          y + h * 0.28,
          r,
        );
        rg.addColorStop(0, "rgba(255,214,160,0.34)");
        rg.addColorStop(1, "rgba(255,214,160,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(x, y, w, h);
      }
    } else {
      g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#f4f4f0");
      g.addColorStop(1, "#d9ddda");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      const r = Math.max(w, h) * 0.6;
      const rg = ctx.createRadialGradient(
        x + w * 0.5,
        y + h * 0.35,
        0,
        x + w * 0.5,
        y + h * 0.35,
        r,
      );
      rg.addColorStop(0, "rgba(255,226,182,0.55)");
      rg.addColorStop(1, "rgba(255,226,182,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x, y, w, h);
      if (type === "fluted") {
        for (let xx = x; xx < x + w; xx += 12) {
          const fg = ctx.createLinearGradient(xx, 0, xx + 12, 0);
          fg.addColorStop(0, "rgba(255,255,255,0.45)");
          fg.addColorStop(0.45, "rgba(120,110,95,0.16)");
          fg.addColorStop(0.8, "rgba(255,255,255,0.1)");
          fg.addColorStop(1, "rgba(255,255,255,0.4)");
          ctx.fillStyle = fg;
          ctx.fillRect(xx, y, 12, h);
        }
      }
      const n = T.noiseTile(96, 0.5);
      const pat = ctx.createPattern(n, "repeat");
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / Math.max(0.2, e.s)));
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = pat;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }
    // отражения
    const strong = type === "clear" || type === "black" || type === "bronze";
    poly(
      ctx,
      [
        [x + w * 0.05, y + h],
        [x + w * 0.42, y + h],
        [x + w * 1.2, y],
        [x + w * 0.83, y],
      ],
      W(strong ? 0.09 : 0.1),
    );
    poly(
      ctx,
      [
        [x + w * 0.5, y + h],
        [x + w * 0.58, y + h],
        [x + w * 1.36, y],
        [x + w * 1.28, y],
      ],
      W(strong ? 0.07 : 0.08),
    );
    // тень от штапика
    let sg = ctx.createLinearGradient(0, y, 0, y + 14);
    sg.addColorStop(0, "rgba(0,0,0,0.3)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, w, 14);
    sg = ctx.createLinearGradient(x, 0, x + 10, 0);
    sg.addColorStop(0, "rgba(0,0,0,0.22)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, 10, h);
    ctx.restore();
  }

  function aluFrame(ctx, e, x, y, w, h, t, metal) {
    ctx.save();
    ctx.lineWidth = t;
    ctx.strokeStyle = metalGrad(ctx, metal || "satin", x, y, x + w, y + h);
    ctx.strokeRect(x - t / 2, y - t / 2, w + t, h + t);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ модели */

  function woodRails(ctx, e, st, rails) {
    if (!e.texH) return;
    for (const [y0, y1] of rails)
      paint(ctx, e, st, y0, e.LW - 2 * st, y1 - y0, 90 + y0 * 0.41, true);
  }

  function joints(ctx, e, st, rails) {
    if (e.f.type !== "wood") return;
    ctx.fillStyle = K(0.22);
    for (const [y0, y1] of rails) {
      if (y0 > 0) ctx.fillRect(st, y0 - 0.4, e.LW - 2 * st, 0.8);
      if (y1 < e.LH) ctx.fillRect(st, y1 - 0.4, e.LW - 2 * st, 0.8);
      ctx.fillRect(st - 0.4, y0, 0.8, y1 - y0);
      ctx.fillRect(e.LW - st - 0.4, y0, 0.8, y1 - y0);
    }
  }

  function raisedPanel(ctx, e, x, y, w, h, b) {
    paint(ctx, e, x, y, w, h, 170 + y * 0.29, false);
    sunken(ctx, e, x, y, w, h, 7);
    bevel4(ctx, e, x + 7, y + 7, w - 14, h - 14, b);
  }

  function archPath(x, y, w, h, rise, inset) {
    const p = new Path2D();
    const i = inset;
    p.moveTo(x + i, y + h - i);
    p.lineTo(x + i, y + rise + i * 0.5);
    p.quadraticCurveTo(x + w / 2, y - rise + i * 2, x + w - i, y + rise + i * 0.5);
    p.lineTo(x + w - i, y + h - i);
    p.closePath();
    return p;
  }

  /* Филёнка с аркой: уступ 7 мм и фаска b, свет сверху слева. */
  function archPanel(ctx, e, x, y, w, h, rise, b) {
    const outer = archPath(x, y, w, h, rise, 0);
    const step = archPath(x, y, w, h, rise, 7);
    const inner = archPath(x, y, w, h, rise, 7 + b);
    ctx.save();
    ctx.clip(outer);
    paint(ctx, e, x, y - rise, w, h + rise, 170 + y * 0.29, false);
    ctx.restore();
    const ringFill = (a, bPath, regions) => {
      const ring = new Path2D();
      ring.addPath(a);
      ring.addPath(bPath);
      ctx.save();
      ctx.clip(ring, "evenodd");
      for (const [pts, fill] of regions) poly(ctx, pts, fill);
      ctx.restore();
    };
    const spring = y + rise;
    const X2 = x + w;
    const Y2 = y + h;
    const topFill = (hi, lo) => {
      const g = ctx.createLinearGradient(x, 0, X2, 0);
      g.addColorStop(0, hi);
      g.addColorStop(1, lo);
      return g;
    };
    const regions = (d, top, left, bottom, right) => [
      [
        [
          [x - 2, y - rise - 2],
          [X2 + 2, y - rise - 2],
          [X2 + 2, spring],
          [x - 2, spring],
        ],
        top,
      ],
      [
        [
          [x - 2, spring],
          [x + d, spring],
          [x + d, Y2 - d],
          [x - 2, Y2 + 2],
        ],
        left,
      ],
      [
        [
          [x - 2, Y2 + 2],
          [x + d, Y2 - d],
          [X2 - d, Y2 - d],
          [X2 + 2, Y2 + 2],
        ],
        bottom,
      ],
      [
        [
          [X2 + 2, spring],
          [X2 + 2, Y2 + 2],
          [X2 - d, Y2 - d],
          [X2 - d, spring],
        ],
        right,
      ],
    ];
    ringFill(outer, step, regions(7, K(e.lo * 1.2), K(e.lo * 0.95), W(e.hi * 1.1), W(e.hi * 0.55)));
    ringFill(
      step,
      inner,
      regions(
        7 + b,
        topFill(W(e.hi * 1.05), W(e.hi * 0.35)),
        W(e.hi * 0.5),
        K(e.lo * 1.15),
        K(e.lo * 0.6),
      ),
    );
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = K(e.lo * 0.5);
    ctx.stroke(inner);
  }

  function glassUnit(ctx, e, x, y, w, h, bead) {
    glassPane(ctx, e, x, y, w, h);
    if (bead === "alu") aluFrame(ctx, e, x, y, w, h, 4, e.metal === "black" ? "black" : "satin");
    else if (bead === "none") {
      ctx.strokeStyle = K(0.35);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, w, h);
    } else molding(ctx, e, x - 14, y - 14, w + 28, h + 28, 14);
  }

  function loft(ctx, e, cols, rows) {
    const fr = 70;
    const bar = 26;
    const x0 = fr;
    const y0 = fr;
    const gw = e.LW - 2 * fr;
    const gh = e.LH - 2 * fr;
    const cw = (gw - bar * (cols - 1)) / cols;
    const ch = (gh - bar * (rows - 1)) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = x0 + c * (cw + bar);
        const y = y0 + r * (ch + bar);
        glassPane(ctx, e, x, y, cw, ch);
        sunken(ctx, e, x - 5, y - 5, cw + 10, ch + 10, 5);
      }
    }
    ctx.strokeStyle = K(0.3);
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 5, y0 - 5, gw + 10, gh + 10);
  }

  const MODELS = {
    flat(ctx, e) {
      if (e.p.edge === "alu") {
        ctx.fillStyle = metalGrad(ctx, "satin", 0, 0, 6, 0);
        ctx.fillRect(0, 0, 3, e.LH);
        ctx.fillRect(e.LW - 3, 0, 3, e.LH);
      }
    },
    "grooves-h4"(ctx, e) {
      for (const t of [0.2, 0.4, 0.6, 0.8]) grooveH(ctx, e, 0, e.LW, e.LH * t, 5);
    },
    "grooves-v3"(ctx, e) {
      for (const t of [0.25, 0.5, 0.75]) grooveV(ctx, e, e.LW * t, 0, e.LH, 5);
    },
    "lines-l"(ctx, e) {
      const x = e.mx(175);
      grooveV(ctx, e, x, 0, e.LH, 5);
      const a = e.hingeLeft ? x : 0;
      const b = e.hingeLeft ? e.LW : x;
      grooveH(ctx, e, a, b, 560, 5);
      grooveH(ctx, e, a, b, 1480, 5);
    },
    "glass-strip"(ctx, e) {
      const w = 110;
      glassUnit(ctx, e, e.mx(150, w), 170, w, e.LH - 340, "alu");
    },
    "glass-top"(ctx, e) {
      const st = 130;
      const rails = [
        [0, 130],
        [1070, 1230],
        [1860, e.LH],
      ];
      woodRails(ctx, e, st, rails);
      raisedPanel(ctx, e, st, 1230, e.LW - 2 * st, 630, 40);
      glassUnit(ctx, e, st + 14, 130 + 14, e.LW - 2 * st - 28, 940 - 28, "bead");
      joints(ctx, e, st, rails);
    },
    "panels-2"(ctx, e) {
      const st = 130;
      const rails = [
        [0, 130],
        [880, 1120],
        [1850, e.LH],
      ];
      woodRails(ctx, e, st, rails);
      raisedPanel(ctx, e, st, 130, e.LW - 2 * st, 750, 42);
      raisedPanel(ctx, e, st, 1120, e.LW - 2 * st, 730, 42);
      joints(ctx, e, st, rails);
    },
    "panels-arch"(ctx, e) {
      const st = 130;
      const rails = [
        [0, 300],
        [880, 1120],
        [1850, e.LH],
      ];
      woodRails(ctx, e, st, rails);
      archPanel(ctx, e, st, 150, e.LW - 2 * st, 730, 150, 42);
      raisedPanel(ctx, e, st, 1120, e.LW - 2 * st, 730, 42);
    },
    "shaker-3"(ctx, e) {
      const st = 120;
      const rails = [
        [0, 120],
        [653, 733],
        [1266, 1346],
        [1880, e.LH],
      ];
      woodRails(ctx, e, st, rails);
      const panels = [
        [120, 533],
        [733, 533],
        [1346, 534],
      ];
      for (const [y, h] of panels) {
        paint(ctx, e, st, y, e.LW - 2 * st, h, 150 + y * 0.31, false);
        innerShade(ctx, e, st, y, e.LW - 2 * st, h, 26);
        sunken(ctx, e, st, y, e.LW - 2 * st, h, 6);
      }
      joints(ctx, e, st, rails);
    },
    "molding-2"(ctx, e) {
      molding(ctx, e, 110, 150, e.LW - 220, 760, 22);
      molding(ctx, e, 110, 1100, e.LW - 220, 750, 22);
    },
    "loft-4"(ctx, e) {
      loft(ctx, e, 1, 4);
    },
    "loft-6"(ctx, e) {
      loft(ctx, e, 2, 3);
    },
    "entrance-panel"(ctx, e) {
      const L = e.LW;
      const H = e.LH;
      groovePath(ctx, e, rrPath(80, 100, L - 160, H - 200, 18), 9);
      groovePath(ctx, e, rrPath(165, 250, L - 330, 640, 46), 9);
      groovePath(ctx, e, rrPath(165, 1110, L - 330, H - 1110 - 250, 46), 9);
      groovePath(ctx, e, rrPath(225, 320, L - 450, 500, 30), 6);
      groovePath(ctx, e, rrPath(225, 1180, L - 450, H - 1180 - 320, 30), 6);
    },
    "entrance-lines"(ctx, e) {
      for (let i = 0; i < 5; i++) grooveV(ctx, e, e.mx(120 + i * 62), 140, e.LH - 140, 6);
      const x = e.mx(e.LW - 250, 14);
      ctx.save();
      shadow(ctx, e.s, 1.5, 2, 3, 0.35);
      ctx.fillStyle = metalGrad(ctx, "chrome", x, 0, x + 14, 0);
      ctx.fillRect(x, 140, 14, e.LH - 280);
      ctx.restore();
    },
    "entrance-metal"(ctx, e) {
      softRaised(ctx, e, 110, 150, e.LW - 220, 720, 34, 26);
      softRaised(ctx, e, 110, 1010, e.LW - 220, e.LH - 1010 - 150, 34, 26);
    },
  };

  /* ------------------------------------------------------------------ фурнитура */

  function hinge(ctx, e, y, big) {
    const w = big ? 16 : 12;
    const h = big ? 130 : 105;
    const x = e.hingeLeft ? -2 : e.LW - w + 2;
    ctx.save();
    shadow(ctx, e.s, 1.5, 2, 3, 0.3);
    ctx.fillStyle = metalGrad(ctx, e.metal, x, 0, x + w, 0);
    ctx.fill(rrPath(x, y, w, h, w / 2));
    ctx.restore();
    ctx.fillStyle = K(0.25);
    ctx.fillRect(x + 1, y + h * 0.5 - 0.6, w - 2, 1.2);
  }

  function rosette(ctx, e, x, y, r) {
    ctx.save();
    shadow(ctx, e.s, 2, 3, 4, 0.35);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = metalGrad(ctx, e.metal, x - r, y - r, x + r * 0.6, y + r);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, r - 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = W(0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function lever(ctx, e, x, y, dir) {
    rosette(ctx, e, x, y, 27);
    const len = 138;
    const t = 17;
    const x0 = dir < 0 ? x - len : x - 8;
    ctx.save();
    shadow(ctx, e.s, 3, 8, 8, 0.38);
    ctx.fillStyle = metalGrad(ctx, e.metal, 0, y - t / 2, 0, y + t / 2);
    ctx.fill(rrPath(x0, y - t / 2, len + 8, t, t / 2));
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = metalGrad(ctx, e.metal, x - 11, y - 11, x + 11, y + 11);
    ctx.fill();
  }

  function cylinder(ctx, e, x, y) {
    rosette(ctx, e, x, y, 21);
    ctx.fillStyle = "#15130f";
    ctx.fill(rrPath(x - 3.5, y - 9, 7, 18, 3));
  }

  function wcTurn(ctx, e, x, y) {
    rosette(ctx, e, x, y, 21);
    ctx.save();
    shadow(ctx, e.s, 1, 2, 2, 0.3);
    ctx.fillStyle = metalGrad(ctx, e.metal, x - 5, y - 13, x + 5, y + 13);
    ctx.fill(rrPath(x - 5, y - 13, 10, 26, 5));
    ctx.restore();
  }

  function plate(ctx, e, x, y, dir) {
    ctx.save();
    shadow(ctx, e.s, 2, 4, 6, 0.4);
    ctx.fillStyle = metalGrad(ctx, e.metal, x - 30, y - 70, x + 30, y + 220);
    ctx.fill(rrPath(x - 30, y - 70, 60, 290, 14));
    ctx.restore();
    ctx.strokeStyle = W(0.3);
    ctx.lineWidth = 1;
    ctx.stroke(rrPath(x - 27, y - 67, 54, 284, 12));
    const len = 150;
    const t = 20;
    const x0 = dir < 0 ? x - len : x - 10;
    ctx.save();
    shadow(ctx, e.s, 3, 9, 9, 0.4);
    ctx.fillStyle = metalGrad(ctx, e.metal, 0, y - t / 2, 0, y + t / 2);
    ctx.fill(rrPath(x0, y - t / 2, len + 10, t, t / 2));
    ctx.restore();
    ctx.fillStyle = "#15130f";
    ctx.fill(rrPath(x - 4, y + 130, 8, 22, 3.5));
    ctx.beginPath();
    ctx.arc(x, y + 128, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function bar(ctx, e, x, y, len) {
    const t = 32;
    ctx.save();
    shadow(ctx, e.s, 8, 12, 12, 0.42);
    ctx.fillStyle = metalGrad(ctx, e.metal, x - t / 2, 0, x + t / 2, 0);
    ctx.fill(rrPath(x - t / 2, y - len / 2, t, len, t / 2));
    ctx.restore();
    for (const yy of [y - len / 2 + 60, y + len / 2 - 60]) {
      ctx.fillStyle = metalGrad(ctx, e.metal, x - 22, yy - 10, x + 22, yy + 10);
      ctx.fill(rrPath(x - 22, yy - 10, 44, 20, 6));
    }
  }

  function peephole(ctx, e, x, y) {
    rosette(ctx, e, x, y, 17);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#0e1417";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 2.5, y - 2.5, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = W(0.6);
    ctx.fill();
  }

  function hardware(ctx, e) {
    const dir = e.hingeLeft ? -1 : 1;
    if (e.p.kind === "entrance") {
      const hx = e.hingeLeft ? e.LW - 90 : 90;
      const hy = e.LH - 1050;
      if (e.p.model !== "entrance-lines") {
        hinge(ctx, e, 260, true);
        hinge(ctx, e, e.LH - 390, true);
        plate(ctx, e, hx, hy, dir);
      } else {
        bar(ctx, e, e.hingeLeft ? e.LW - 130 : 130, hy - 20, 820);
        cylinder(ctx, e, e.hingeLeft ? e.LW - 58 : 58, hy - 170);
        cylinder(ctx, e, e.hingeLeft ? e.LW - 58 : 58, hy + 150);
      }
      if (e.p.model !== "entrance-lines") cylinder(ctx, e, hx, hy - 340);
      peephole(ctx, e, e.LW / 2, e.LH - 1520);
      return;
    }
    if (e.p.edge !== "alu") {
      hinge(ctx, e, 230);
      hinge(ctx, e, e.LH - 335);
    }
    const hx = e.hingeLeft ? e.LW - 72 : 72;
    const hy = e.LH - 1000;
    lever(ctx, e, hx, hy, dir);
    if (e.p.edge === "alu") return;
    wcTurn(ctx, e, hx, hy + 96);
  }

  function lighting(ctx, e) {
    const { LW, LH } = e;
    let g = ctx.createLinearGradient(0, 0, LW, 0);
    g.addColorStop(0, W(0.1));
    g.addColorStop(0.45, W(0));
    g.addColorStop(1, K(0.13));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);
    g = ctx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, W(0.05));
    g.addColorStop(0.6, K(0));
    g.addColorStop(1, K(0.16));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    g = ctx.createLinearGradient(0, LH * 0.1, LW, LH * 0.45);
    g.addColorStop(0.3, W(0));
    g.addColorStop(0.42, W(0.05 + 0.04 * (1 - e.lum)));
    g.addColorStop(0.55, W(0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);
    ctx.restore();
  }

  function edges(ctx, e) {
    ctx.strokeStyle = K(0.3);
    ctx.lineWidth = 2.4;
    ctx.strokeRect(1.2, 1.2, e.LW - 2.4, e.LH - 2.4);
    ctx.strokeStyle = W(0.12);
    ctx.lineWidth = 1;
    ctx.strokeRect(3.2, 3.2, e.LW - 6.4, e.LH - 6.4);
  }

  /* Полотно. ctx уже в миллиметрах, начало — левый верхний угол полотна. */
  function drawLeaf(ctx, p, f, opt) {
    const e = env(p, f, opt.s, opt.hinge);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, e.LW, e.LH);
    ctx.clip();
    paint(ctx, e, 0, 0, e.LW, e.LH, 0, false);
    (MODELS[p.model] || MODELS.flat)(ctx, e);
    lighting(ctx, e);
    hardware(ctx, e);
    edges(ctx, e);
    ctx.restore();
  }

  /* Коробка и наличники. Начало — левый верхний угол наличника. */
  function drawFrame(ctx, p, f, opt) {
    const g = geo(p);
    if (p.edge === "alu") {
      // скрытая дверь: наличников нет, видна только теневая щель
      ctx.strokeStyle = "rgba(20,14,8,0.8)";
      ctx.lineWidth = 3;
      ctx.strokeRect(g.lx - 1.5, g.ly - 1.5, g.LW + 3, g.LH + 1.5);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(g.lx - 4, g.ly - 4, g.LW + 8, g.LH + 4);
      return;
    }
    const entrance = p.kind === "entrance";
    const ff =
      entrance && f.type !== "metal" ? { name: "frame", type: "metal", color: "#2e2f31" } : f;
    const e = env(p, ff, opt.s, opt.hinge);
    const { W: BW, H: BH, C, R } = g;
    const strips = [
      {
        pts: [
          [0, 0],
          [C, C],
          [C, BH],
          [0, BH],
        ],
        grad: [0, 0, C, 0],
        hor: false,
        shift: 40,
      },
      {
        pts: [
          [BW, 0],
          [BW, BH],
          [BW - C, BH],
          [BW - C, C],
        ],
        grad: [BW, 0, BW - C, 0],
        hor: false,
        shift: 260,
      },
      {
        pts: [
          [0, 0],
          [BW, 0],
          [BW - C, C],
          [C, C],
        ],
        grad: [0, 0, 0, C],
        hor: true,
        shift: 120,
      },
    ];
    strips.forEach((s, i) => {
      ctx.save();
      const path = new Path2D();
      path.moveTo(s.pts[0][0], s.pts[0][1]);
      for (const pt of s.pts.slice(1)) path.lineTo(pt[0], pt[1]);
      path.closePath();
      ctx.clip(path);
      if (s.hor && e.texH) {
        ctx.drawImage(e.texH, -s.shift, -((420 - C) / 2), BW + 400, 420);
      } else if (e.tex) {
        ctx.drawImage(e.tex, -s.shift, 0, g.LW + 400, g.LH + 200);
      } else {
        paint(ctx, e, 0, 0, BW, BH, 0, false);
      }
      const gr = ctx.createLinearGradient(s.grad[0], s.grad[1], s.grad[2], s.grad[3]);
      const side = i === 1 ? 1.35 : 1;
      if (entrance) {
        gr.addColorStop(0, K(0.35 * side));
        gr.addColorStop(0.15, W(0.1));
        gr.addColorStop(0.5, W(0.03));
        gr.addColorStop(0.85, K(0.12 * side));
        gr.addColorStop(1, K(0.3));
      } else {
        gr.addColorStop(0, K(0.32 * side));
        gr.addColorStop(0.07, K(0.06 * side));
        gr.addColorStop(0.12, W(0.13));
        gr.addColorStop(0.24, W(0.04));
        gr.addColorStop(0.84, K(0.02 * side));
        gr.addColorStop(0.88, K(0.14 * side));
        gr.addColorStop(0.92, W(0.18));
        gr.addColorStop(1, K(0.1));
      }
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, BW, BH);
      if (i === 1) {
        ctx.fillStyle = K(0.06);
        ctx.fillRect(0, 0, BW, BH);
      }
      ctx.restore();
    });
    // стыки наличников под 45°
    ctx.beginPath();
    ctx.moveTo(0.5, 0.5);
    ctx.lineTo(C, C);
    ctx.moveTo(BW - 0.5, 0.5);
    ctx.lineTo(BW - C, C);
    ctx.strokeStyle = K(0.35);
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // коробка (видимая часть между наличником и полотном)
    const ox = C;
    const oy = C;
    const ow = BW - 2 * C;
    const oh = BH - C;
    ctx.save();
    const ring = new Path2D();
    ring.rect(ox, oy, ow, oh);
    ring.rect(g.lx, g.ly, g.LW, g.LH);
    ctx.clip(ring, "evenodd");
    if (e.tex) ctx.drawImage(e.tex, -200, 0, g.LW + 400, g.LH + 200);
    else {
      ctx.fillStyle = ff.color;
      ctx.fillRect(ox, oy, ow, oh);
    }
    ctx.fillStyle = K(0.22);
    ctx.fillRect(ox, oy, ow, oh);
    let sg = ctx.createLinearGradient(0, oy, 0, oy + R);
    sg.addColorStop(0, K(0.35));
    sg.addColorStop(1, K(0.1));
    ctx.fillStyle = sg;
    ctx.fillRect(ox, oy, ow, R);
    sg = ctx.createLinearGradient(ox, 0, ox + R, 0);
    sg.addColorStop(0, K(0.3));
    sg.addColorStop(1, K(0.05));
    ctx.fillStyle = sg;
    ctx.fillRect(ox, oy, R, oh);
    ctx.restore();
    // зазор вокруг полотна
    ctx.strokeStyle = "rgba(10,6,3,0.75)";
    ctx.lineWidth = 2.4;
    ctx.strokeRect(g.lx - 1.2, g.ly - 1.2, g.LW + 2.4, g.LH + 2.4);
  }

  /* ------------------------------------------------------------------ интерьер */

  /*
   * Мебель и декор рядом с дверью: дубовая консоль с вазой и книгами, картина
   * и растение в горшке. Координаты в миллиметрах: X — от центра двери вправо,
   * Y — высота от пола, Z — от стены к зрителю. Перспектива та же, что у пола,
   * поэтому предметы стоят на ламинате и отражаются в нём.
   */

  const DECOR_OAK = {
    name: "decor",
    type: "wood",
    color: "#B88C5E",
    grain: "#7A532F",
    figure: "oak",
  };
  const HALF_DOOR = 510;

  function projector(L, mirror) {
    return (X, Y, Z) => {
      const k = L.P / (L.P - Z * L.ppmm);
      const y = (mirror ? -Y : Y) * L.ppmm;
      return [L.cx + X * L.ppmm * k, L.floorY - L.eye + (L.eye - y) * k];
    };
  }

  function poly3(D, pts) {
    const p = new Path2D();
    for (let i = 0; i < pts.length; i++) {
      const s = D.pr(pts[i][0], pts[i][1], pts[i][2]);
      if (i) p.lineTo(s[0], s[1]);
      else p.moveTo(s[0], s[1]);
    }
    p.closePath();
    return p;
  }

  function bounds(sp) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of sp) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* Мягкая тень без ctx.filter: фигура рисуется за краем холста, в кадр попадает только тень. */
  function soft(D, blurMM, color, draw) {
    if (D.mirror) return;
    const BIG = 20000;
    const ctx = D.ctx;
    ctx.save();
    ctx.translate(-BIG, 0);
    ctx.shadowOffsetX = BIG * D.r;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = Math.max(1, blurMM * D.s * D.r);
    ctx.shadowColor = color;
    ctx.fillStyle = "#000";
    draw(ctx);
    ctx.restore();
  }

  /* Прямоугольный ящик. Видимые грани: перед, верх (если ниже глаз), бок, обращённый к центру. */
  function box3(D, b, paint) {
    const { x0, x1, y0, y1, z0, z1 } = b;
    const faces = [];
    if (x1 < 0)
      faces.push([
        "side",
        [
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x1, y0, z1],
        ],
      ]);
    else if (x0 > 0)
      faces.push([
        "side",
        [
          [x0, y0, z0],
          [x0, y1, z0],
          [x0, y1, z1],
          [x0, y0, z1],
        ],
      ]);
    if (!D.mirror && y1 < D.eyeMM)
      faces.push([
        "top",
        [
          [x0, y1, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
      ]);
    faces.push([
      "front",
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    ]);
    for (const [name, pts] of faces) {
      const f = paint[name];
      if (!f) continue;
      const path = poly3(D, pts);
      if (typeof f === "function")
        f(
          path,
          pts.map((q) => D.pr(q[0], q[1], q[2])),
        );
      else {
        D.ctx.fillStyle = f;
        D.ctx.fill(path);
      }
    }
  }

  function oakTexture(D) {
    const ppm = D.s * D.r > 0.34 ? 0.6 : 0.3;
    return { c: T.finishTextureH(DECOR_OAK, 1400, 420, ppm, 5171), ppm };
  }

  /* Натянуть участок текстуры (в мм) на грань. Для узких граней аффинного растяжения хватает. */
  function texFace(D, tex, path, sp, src, shade) {
    const ctx = D.ctx;
    const b = bounds(sp);
    ctx.save();
    ctx.clip(path);
    ctx.drawImage(
      tex.c,
      src[0] * tex.ppm,
      src[1] * tex.ppm,
      src[2] * tex.ppm,
      src[3] * tex.ppm,
      b.x,
      b.y,
      Math.max(1, b.w),
      Math.max(1, b.h),
    );
    if (shade) {
      ctx.fillStyle = shade;
      ctx.fill(path);
    }
    ctx.restore();
  }

  function metalLeg(D) {
    return {
      front: (path, sp) => {
        const b = bounds(sp);
        const g = D.ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
        g.addColorStop(0, "#2c2926");
        g.addColorStop(0.3, "#57514b");
        g.addColorStop(0.55, "#221f1d");
        g.addColorStop(1, "#121110");
        D.ctx.fillStyle = g;
        D.ctx.fill(path);
      },
      side: "#171513",
      top: "#3b3632",
    };
  }

  function drawConsole(D, c) {
    const ctx = D.ctx;
    const H = 780;
    const T2 = 34;
    const zb = 30;
    const zf = 400;
    const leg = 26;
    const { x0, x1 } = c;
    const cw = x1 - x0;
    const tex = oakTexture(D);

    // тень на стене под столешницей и тень на полу под консолью
    soft(D, 60, "rgba(38,24,12,0.34)", (g) =>
      g.fill(
        poly3(D, [
          [x0 + 40, H - T2, 0],
          [x1 - 10, H - T2, 0],
          [x1 + 30, H - T2 - 190, 0],
          [x0 + 80, H - T2 - 190, 0],
        ]),
      ),
    );
    soft(D, 70, "rgba(30,18,8,0.42)", (g) =>
      g.fill(
        poly3(D, [
          [x0 + 30, 0, zb],
          [x1 - 30, 0, zb],
          [x1 - 30, 0, zf - 30],
          [x0 + 30, 0, zf - 30],
        ]),
      ),
    );
    const legs = [x0 + 44, x1 - 44 - leg];
    // контактные тени ножек
    for (const z of [zb + 26, zf - 26 - leg])
      for (const x of legs)
        soft(D, 14, "rgba(10,6,2,0.55)", (g) =>
          g.fill(
            poly3(D, [
              [x - 8, 0, z - 8],
              [x + leg + 8, 0, z - 8],
              [x + leg + 8, 0, z + leg + 8],
              [x - 8, 0, z + leg + 8],
            ]),
          ),
        );

    const legPaint = metalLeg(D);
    // задние ножки
    for (const x of legs)
      box3(D, { x0: x, x1: x + leg, y0: 0, y1: H - T2, z0: zb + 26, z1: zb + 26 + leg }, legPaint);

    // нижняя полка с корзиной
    const sy = 150;
    box3(
      D,
      { x0: x0 + 44, x1: x1 - 44, y0: sy, y1: sy + 22, z0: zb + 26, z1: zf - 26 },
      {
        top: (path, sp) =>
          texFace(D, tex, path, sp, [60, 20, cw - 88, 344], "rgba(255,240,220,0.08)"),
        front: (path, sp) => texFace(D, tex, path, sp, [60, 380, cw - 88, 22], "rgba(0,0,0,0.12)"),
        side: (path, sp) => texFace(D, tex, path, sp, [1000, 120, 344, 22], "rgba(0,0,0,0.3)"),
      },
    );
    if (cw > 760) drawBasket(D, x0 + cw * 0.5 - 170, x0 + cw * 0.5 + 170, sy + 22, 150, 340);

    // передние ножки
    for (const x of legs)
      box3(D, { x0: x, x1: x + leg, y0: 0, y1: H - T2, z0: zf - 26 - leg, z1: zf - 26 }, legPaint);

    // столешница
    box3(
      D,
      { x0, x1, y0: H - T2, y1: H, z0: zb, z1: zf },
      {
        top: (path, sp) => {
          texFace(D, tex, path, sp, [20, 30, cw, 370], "rgba(255,244,228,0.1)");
          if (D.mirror) return;
          const b = bounds(sp);
          const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
          g.addColorStop(0, "rgba(255,250,240,0.14)");
          g.addColorStop(0.6, "rgba(255,250,240,0)");
          g.addColorStop(1, "rgba(0,0,0,0.08)");
          ctx.fillStyle = g;
          ctx.fill(path);
        },
        front: (path, sp) => {
          texFace(D, tex, path, sp, [20, 386, cw, T2], "rgba(40,20,6,0.12)");
          const b = bounds(sp);
          ctx.fillStyle = "rgba(255,248,236,0.35)";
          ctx.fillRect(b.x, b.y, b.w, Math.max(0.6, b.h * 0.08));
          ctx.fillStyle = "rgba(20,10,4,0.35)";
          ctx.fillRect(b.x, b.y + b.h - Math.max(0.6, b.h * 0.1), b.w, Math.max(0.6, b.h * 0.1));
        },
        side: (path, sp) => texFace(D, tex, path, sp, [1000, 30, 370, T2], "rgba(0,0,0,0.28)"),
      },
    );

    // книги и ваза на столешнице
    const books = [
      { w: 250, d: 185, t: 34, c: "#2E3A33", top: "#3a4a41" },
      { w: 232, d: 172, t: 26, c: "#C7B596", top: "#d6c6aa" },
      { w: 214, d: 160, t: 38, c: "#8C4A33", top: "#9d5a41" },
    ];
    let by = H;
    const bx = x0 + Math.min(150, cw * 0.14);
    books.forEach((bk, i) => {
      const bx0 = bx + (i === 1 ? 14 : i === 2 ? 4 : 0);
      const zc = (zb + zf) / 2 + (i === 1 ? 8 : 0);
      box3(
        D,
        { x0: bx0, x1: bx0 + bk.w, y0: by, y1: by + bk.t, z0: zc - bk.d / 2, z1: zc + bk.d / 2 },
        {
          top: bk.top,
          front: (path, sp) => {
            ctx.fillStyle = bk.c;
            ctx.fill(path);
            const b = bounds(sp);
            ctx.fillStyle = "rgba(255,236,196,0.55)";
            ctx.fillRect(b.x + b.w * 0.12, b.y + b.h * 0.42, b.w * 0.3, Math.max(0.5, b.h * 0.16));
          },
          side: "#EFE7D6",
        },
      );
      by += bk.t;
    });
    const vx = x1 - Math.min(250, cw * 0.24);
    drawVase(D, vx, (zb + zf) / 2, H, 330, 88, "#3E3531");
  }

  /* Плетёная корзина на нижней полке. */
  function drawBasket(D, x0, x1, y0, h, depth) {
    const ctx = D.ctx;
    const z0 = 140;
    const z1 = z0 + depth * 0.62;
    box3(
      D,
      { x0, x1, y0, y1: y0 + h, z0, z1 },
      {
        top: (path) => {
          ctx.fillStyle = "#6b5236";
          ctx.fill(path);
        },
        front: (path, sp) => {
          const b = bounds(sp);
          ctx.save();
          ctx.clip(path);
          const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
          g.addColorStop(0, "#b39466");
          g.addColorStop(0.35, "#c9ab7c");
          g.addColorStop(1, "#8d7049");
          ctx.fillStyle = g;
          ctx.fillRect(b.x, b.y, b.w, b.h);
          const rows = 7;
          ctx.lineWidth = Math.max(0.5, b.h / rows / 3.2);
          for (let i = 1; i < rows; i++) {
            const y = b.y + (b.h * i) / rows;
            ctx.strokeStyle = "rgba(70,48,24,0.4)";
            ctx.beginPath();
            ctx.moveTo(b.x, y);
            ctx.lineTo(b.x + b.w, y);
            ctx.stroke();
          }
          const cols = Math.max(6, Math.round(b.w / Math.max(2, b.h / rows)));
          ctx.strokeStyle = "rgba(255,240,210,0.18)";
          for (let i = 0; i < cols; i++) {
            const x = b.x + (b.w * (i + 0.5)) / cols;
            ctx.beginPath();
            ctx.moveTo(x, b.y);
            ctx.lineTo(x, b.y + b.h);
            ctx.stroke();
          }
          ctx.restore();
        },
        side: "#7f6441",
      },
    );
  }

  const VASE = [
    [0, 0.6],
    [0.07, 0.8],
    [0.3, 1],
    [0.56, 0.9],
    [0.78, 0.48],
    [0.9, 0.34],
    [0.97, 0.38],
    [1, 0.41],
  ];

  function vaseR(t) {
    for (let i = 1; i < VASE.length; i++) {
      if (t <= VASE[i][0]) {
        const a = VASE[i - 1];
        const b = VASE[i];
        const u = (t - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * u * u * (3 - 2 * u);
      }
    }
    return VASE[VASE.length - 1][1];
  }

  function drawVase(D, vx, vz, y0, hv, R, color) {
    const ctx = D.ctx;
    const left = [];
    const right = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const r = vaseR(t) * R;
      left.push([vx - r, y0 + t * hv, vz]);
      right.push([vx + r, y0 + t * hv, vz]);
    }
    const path = poly3(D, left.concat(right.reverse()));
    const a = D.pr(vx - R, y0, vz);
    const b = D.pr(vx + R, y0, vz);
    const base = T.hex(color);
    soft(D, 22, "rgba(20,10,4,0.5)", (g) =>
      g.fill(
        poly3(D, [
          [vx - R * 0.62, y0, vz - R * 0.4],
          [vx + R * 0.9, y0, vz - R * 0.4],
          [vx + R * 0.9, y0, vz + R * 0.55],
          [vx - R * 0.62, y0, vz + R * 0.55],
        ]),
      ),
    );
    const g = ctx.createLinearGradient(a[0], 0, b[0], 0);
    g.addColorStop(0, T.css(T.darken(base, 0.2)));
    g.addColorStop(0.27, T.css(T.lighten(base, 0.2)));
    g.addColorStop(0.5, T.css(base));
    g.addColorStop(1, T.css(T.darken(base, 0.5)));
    ctx.fillStyle = g;
    ctx.fill(path);
    if (D.mirror) return;
    // блик глазури
    ctx.save();
    ctx.clip(path);
    const top = D.pr(vx, y0 + hv, vz);
    const hl = ctx.createLinearGradient(a[0], 0, b[0], 0);
    hl.addColorStop(0.2, "rgba(255,244,228,0)");
    hl.addColorStop(0.3, "rgba(255,244,228,0.22)");
    hl.addColorStop(0.38, "rgba(255,244,228,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(a[0], top[1], b[0] - a[0], a[1] - top[1]);
    ctx.restore();
    // горлышко
    const rt = vaseR(1) * R;
    const c0 = D.pr(vx, y0 + hv, vz - rt);
    const c1 = D.pr(vx, y0 + hv, vz + rt);
    const l = D.pr(vx - rt, y0 + hv, vz);
    const ex = (c0[0] + c1[0]) / 2;
    const ey = (c0[1] + c1[1]) / 2;
    ctx.beginPath();
    ctx.ellipse(
      ex,
      ey,
      Math.abs(ex - l[0]),
      Math.max(0.4, Math.abs(c1[1] - c0[1]) / 2),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "#17110d";
    ctx.fill();
    drawBranches(D, vx, vz, y0 + hv - 12);
  }

  /* Ветки оливы в вазе. */
  function drawBranches(D, vx, vz, y0) {
    const ctx = D.ctx;
    const rnd = T.rng(9127);
    const shades = ["#7F8F6E", "#8E9C7C", "#6D7C5E", "#A3AE92", "#77866A"];
    const stems = [-46, -26, -8, 10, 30, 48];
    for (const deg of stems) {
      const a = ((deg + (rnd() - 0.5) * 10) * Math.PI) / 180;
      const len = 360 + rnd() * 240 - Math.abs(deg) * 1.6;
      const bend = Math.sign(deg || 1) * (50 + rnd() * 90);
      const z = vz + (rnd() - 0.5) * 70;
      const pt = (t) => [
        vx + Math.sin(a) * len * t + bend * t * t,
        y0 + Math.cos(a) * len * t - Math.abs(bend) * 0.35 * t * t,
        z,
      ];
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const q = pt(i / 18);
        const s = D.pr(q[0], q[1], q[2]);
        if (i) ctx.lineTo(s[0], s[1]);
        else ctx.moveTo(s[0], s[1]);
      }
      ctx.strokeStyle = "#57513f";
      ctx.lineWidth = Math.max(0.5, 3.2 * D.s);
      ctx.lineCap = "round";
      ctx.stroke();
      let side = rnd() < 0.5 ? 1 : -1;
      for (let t = 0.2; t < 0.98; t += 0.06 + rnd() * 0.035) {
        const q = pt(t);
        const q2 = pt(t + 0.02);
        const dir = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
        oliveLeaf(
          D,
          q,
          dir + side * (0.5 + rnd() * 0.4),
          46 + rnd() * 20,
          10 + rnd() * 4,
          shades[Math.floor(rnd() * shades.length)],
        );
        side = -side;
      }
      const e = pt(1);
      const e2 = pt(0.97);
      oliveLeaf(D, e, Math.atan2(e[1] - e2[1], e[0] - e2[0]), 52, 11, shades[0]);
    }
  }

  function oliveLeaf(D, q, ang, len, wid, color) {
    const ctx = D.ctx;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const mx = q[0] + ca * len * 0.5;
    const my = q[1] + sa * len * 0.5;
    const s0 = D.pr(q[0], q[1], q[2]);
    const s1 = D.pr(q[0] + ca * len, q[1] + sa * len, q[2]);
    const c1 = D.pr(mx - sa * wid, my + ca * wid, q[2]);
    const c2 = D.pr(mx + sa * wid, my - ca * wid, q[2]);
    ctx.beginPath();
    ctx.moveTo(s0[0], s0[1]);
    ctx.quadraticCurveTo(c1[0], c1[1], s1[0], s1[1]);
    ctx.quadraticCurveTo(c2[0], c2[1], s0[0], s0[1]);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* Картина в раме с паспарту. */
  function drawArt(D, a) {
    if (D.mirror) return;
    const ctx = D.ctx;
    const z = 24;
    soft(D, 36, "rgba(34,22,12,0.42)", (g) =>
      g.fill(
        poly3(D, [
          [a.x0 + 22, a.y0 - 30, 0],
          [a.x1 + 22, a.y0 - 30, 0],
          [a.x1 + 22, a.y1 - 26, 0],
          [a.x0 + 22, a.y1 - 26, 0],
        ]),
      ),
    );
    box3(
      D,
      { x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y1, z0: 0, z1: z },
      {
        side: "#110e0c",
        front: (path, sp) => {
          const b = bounds(sp);
          ctx.fillStyle = "#231e1a";
          ctx.fill(path);
          const k = b.w / (a.x1 - a.x0);
          const fr = 26 * k;
          const mat = Math.min(b.w, b.h) * 0.13;
          // фаска рамы
          ctx.fillStyle = "rgba(255,240,220,0.16)";
          ctx.fillRect(b.x, b.y, b.w, Math.max(0.5, fr * 0.22));
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(b.x, b.y + b.h - fr * 0.25, b.w, fr * 0.25);
          // паспарту
          const mx = b.x + fr;
          const my = b.y + fr;
          const mw = b.w - 2 * fr;
          const mh = b.h - 2 * fr;
          ctx.fillStyle = "#F2EDE4";
          ctx.fillRect(mx, my, mw, mh);
          const sh = ctx.createLinearGradient(0, my, 0, my + fr * 0.8);
          sh.addColorStop(0, "rgba(0,0,0,0.18)");
          sh.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = sh;
          ctx.fillRect(mx, my, mw, fr * 0.8);
          // сама картина
          const ax = mx + mat;
          const ay = my + mat;
          const aw = mw - 2 * mat;
          const ah = mh - 2 * mat;
          ctx.save();
          ctx.beginPath();
          ctx.rect(ax, ay, aw, ah);
          ctx.clip();
          ctx.fillStyle = "#E6DAC6";
          ctx.fillRect(ax, ay, aw, ah);
          const archW = aw * 0.58;
          const archX = ax + aw * 0.09;
          const archTop = ay + ah * 0.34;
          ctx.beginPath();
          ctx.moveTo(archX, ay + ah);
          ctx.lineTo(archX, archTop + archW / 2);
          ctx.arc(archX + archW / 2, archTop + archW / 2, archW / 2, Math.PI, 0);
          ctx.lineTo(archX + archW, ay + ah);
          ctx.closePath();
          ctx.fillStyle = "#B4623D";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ax + aw * 0.72, ay + ah * 0.24, aw * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = "#D5A04F";
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(ax + aw * 0.5, ay + ah);
          ctx.arc(ax + aw * 0.86, ay + ah, aw * 0.36, Math.PI, Math.PI * 1.5);
          ctx.lineTo(ax + aw * 0.86, ay + ah);
          ctx.closePath();
          ctx.fillStyle = "#8A9A7E";
          ctx.fill();
          ctx.fillStyle = "#2A2420";
          ctx.fillRect(ax + aw * 0.06, ay + ah * 0.71, aw * 0.88, Math.max(0.5, ah * 0.008));
          ctx.restore();
          // внутренний срез паспарту
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = Math.max(0.5, fr * 0.08);
          ctx.strokeRect(ax, ay, aw, ah);
          // отражение в стекле
          const gl = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
          gl.addColorStop(0, "rgba(255,255,255,0.16)");
          gl.addColorStop(0.38, "rgba(255,255,255,0.03)");
          gl.addColorStop(0.39, "rgba(255,255,255,0)");
          gl.addColorStop(0.55, "rgba(255,255,255,0)");
          gl.addColorStop(0.56, "rgba(255,255,255,0.06)");
          gl.addColorStop(0.7, "rgba(255,255,255,0)");
          ctx.fillStyle = gl;
          ctx.fillRect(mx, my, mw, mh);
        },
      },
    );
  }

  /* Сансевиерия в рифлёном горшке. */
  function drawPlant(D, p) {
    const ctx = D.ctx;
    const { x, z, R, H } = p;
    const Rb = R * 0.84;
    const rnd = T.rng(4441);
    const leaves = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      leaves.push({
        bx: x + u * R * 0.52 + (rnd() - 0.5) * 36,
        bz: z + (rnd() - 0.5) * R * 0.9,
        h: 520 + (1 - Math.abs(u)) * 460 + rnd() * 170,
        w: 50 + rnd() * 30,
        lean: u * 0.2 + (rnd() - 0.5) * 0.16,
        curl: (rnd() - 0.5) * 0.5,
        tone: rnd(),
        bands: rnd() * 1000,
      });
    }
    leaves.sort((a, b) => a.bz - b.bz);
    const yb = H - 40;

    const leafPts = (lf, dx, dz) => {
      const tipX = lf.bx + dx + Math.sin(lf.lean) * lf.h;
      const tipY = yb + Math.cos(lf.lean) * lf.h;
      const midX = lf.bx + dx + Math.sin(lf.lean) * lf.h * 0.42 + lf.curl * 60;
      const midY = yb + lf.h * 0.42;
      return {
        bl: [lf.bx + dx - lf.w * 0.32, yb, lf.bz + dz],
        br: [lf.bx + dx + lf.w * 0.32, yb, lf.bz + dz],
        cl: [midX - lf.w * 0.95, midY, lf.bz + dz],
        cr: [midX + lf.w * 0.95, midY, lf.bz + dz],
        tip: [tipX, tipY, lf.bz + dz],
      };
    };
    const leafPath = (q) => {
      const s = (v) => D.pr(v[0], v[1], v[2]);
      const bl = s(q.bl);
      const br = s(q.br);
      const cl = s(q.cl);
      const cr = s(q.cr);
      const tp = s(q.tip);
      const path = new Path2D();
      path.moveTo(bl[0], bl[1]);
      path.quadraticCurveTo(cl[0], cl[1], tp[0], tp[1]);
      path.quadraticCurveTo(cr[0], cr[1], br[0], br[1]);
      path.closePath();
      return path;
    };

    // тень на стене: свет слева, тень ложится правее и ниже
    soft(D, 55, "rgba(30,20,10,0.22)", (g) => {
      for (const lf of leaves) {
        const q = leafPts(lf, 0, 0);
        for (const k of ["bl", "br", "cl", "cr", "tip"]) {
          q[k] = [q[k][0] + 240 + (q[k][1] - yb) * 0.12, q[k][1] - 50, 0];
        }
        g.fill(leafPath(q));
      }
      g.fill(
        poly3(D, [
          [x - R + 240, H - 50, 0],
          [x + R + 240, H - 50, 0],
          [x + Rb + 240, 0, 0],
          [x - Rb + 240, 0, 0],
        ]),
      );
    });
    // тень на полу
    soft(D, 60, "rgba(24,14,6,0.5)", (g) => {
      g.beginPath();
      const c = D.pr(x + 30, 0, z);
      const f = D.pr(x + 30, 0, z + Rb * 1.1);
      const l = D.pr(x - Rb * 1.05 + 30, 0, z);
      g.ellipse(
        c[0],
        c[1],
        Math.abs(c[0] - l[0]),
        Math.max(1, Math.abs(f[1] - c[1])),
        0,
        0,
        Math.PI * 2,
      );
      g.fill();
    });

    const ring = (rr, yy, from, to, steps) => {
      const out = [];
      for (let i = 0; i <= steps; i++) {
        const t = from + ((to - from) * i) / steps;
        out.push([x + rr * Math.cos(t), yy, z + rr * Math.sin(t)]);
      }
      return out;
    };
    const ellipseAt = (rr, yy) => {
      const c0 = D.pr(x, yy, z - rr);
      const c1 = D.pr(x, yy, z + rr);
      const l = D.pr(x - rr, yy, z);
      const ex = (c0[0] + c1[0]) / 2;
      const ey = (c0[1] + c1[1]) / 2;
      return [ex, ey, Math.abs(ex - l[0]), Math.max(0.4, Math.abs(c1[1] - c0[1]) / 2)];
    };
    const potColor = T.hex("#B97A5C");
    const pa = D.pr(x - R, H, z);
    const pb = D.pr(x + R, H, z);

    if (!D.mirror) {
      // внутренняя стенка и земля
      let e = ellipseAt(R - 10, H);
      ctx.beginPath();
      ctx.ellipse(e[0], e[1], e[2], e[3], 0, 0, Math.PI * 2);
      ctx.fillStyle = "#7c4b35";
      ctx.fill();
      e = ellipseAt(R - 16, H - 36);
      ctx.beginPath();
      ctx.ellipse(e[0], e[1], e[2], e[3], 0, 0, Math.PI * 2);
      ctx.fillStyle = "#2a1f17";
      ctx.fill();
    }

    // листья
    for (const lf of leaves) {
      const q = leafPts(lf, 0, 0);
      const path = leafPath(q);
      const l = D.pr(q.cl[0], q.cl[1], q.cl[2]);
      const r2 = D.pr(q.cr[0], q.cr[1], q.cr[2]);
      const dark = T.mix(T.hex("#223D29"), T.hex("#34583B"), lf.tone);
      const g = ctx.createLinearGradient(l[0], 0, r2[0], 0);
      g.addColorStop(0, T.css(T.lighten(dark, 0.12)));
      g.addColorStop(0.45, T.css(T.lighten(dark, 0.22)));
      g.addColorStop(1, T.css(T.darken(dark, 0.25)));
      ctx.fillStyle = g;
      ctx.fill(path);
      if (D.mirror) continue;
      // поперечные полосы
      ctx.save();
      ctx.clip(path);
      const tp = D.pr(q.tip[0], q.tip[1], q.tip[2]);
      const bs = D.pr(lf.bx, yb, lf.bz);
      const x0 = Math.min(l[0], r2[0]) - 4;
      const x1 = Math.max(l[0], r2[0]) + 4;
      ctx.strokeStyle = "rgba(176,204,160,0.3)";
      ctx.lineWidth = Math.max(0.5, 5 * D.s);
      const bandsN = 9;
      for (let i = 1; i < bandsN; i++) {
        const y = bs[1] + ((tp[1] - bs[1]) * (i + ((lf.bands * i) % 7) / 14)) / bandsN;
        ctx.beginPath();
        const seg = 5;
        for (let j = 0; j <= seg; j++) {
          const xx = x0 + ((x1 - x0) * j) / seg;
          const yy = y + (j % 2 ? 1 : -1) * Math.max(0.5, 7 * D.s);
          if (j) ctx.lineTo(xx, yy);
          else ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
      // жёлтая кромка
      ctx.strokeStyle = "rgba(214,196,116,0.9)";
      ctx.lineWidth = Math.max(0.45, 3.2 * D.s);
      ctx.stroke(path);
    }

    // горшок
    const body = ring(R, H, Math.PI, 0, 1)
      .slice(0, 1)
      .concat(ring(Rb, 0, Math.PI, 0, 20))
      .concat(ring(R, H, 0, Math.PI, 24));
    const bodyPath = poly3(D, body);
    const g = ctx.createLinearGradient(pa[0], 0, pb[0], 0);
    g.addColorStop(0, T.css(T.darken(potColor, 0.12)));
    g.addColorStop(0.3, T.css(T.lighten(potColor, 0.1)));
    g.addColorStop(0.62, T.css(potColor));
    g.addColorStop(1, T.css(T.darken(potColor, 0.42)));
    ctx.fillStyle = g;
    ctx.fill(bodyPath);
    // рифление
    ctx.save();
    ctx.clip(bodyPath);
    const ribs = 18;
    for (let i = 1; i < ribs; i++) {
      const t = Math.PI - (Math.PI * i) / ribs;
      const a = D.pr(x + R * Math.cos(t), H - 24, z + R * Math.sin(t));
      const b = D.pr(x + Rb * Math.cos(t), 10, z + Rb * Math.sin(t));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = "rgba(70,30,14,0.16)";
      ctx.lineWidth = Math.max(0.5, 5 * D.s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a[0] - Math.max(0.6, 6 * D.s), a[1]);
      ctx.lineTo(b[0] - Math.max(0.6, 5 * D.s), b[1]);
      ctx.strokeStyle = "rgba(255,226,200,0.12)";
      ctx.lineWidth = Math.max(0.4, 3 * D.s);
      ctx.stroke();
    }
    // поясок под венчиком
    const band = ring(R, H - 24, Math.PI, 0, 24).concat(ring(R * 0.995, H - 40, 0, Math.PI, 24));
    ctx.fillStyle = "rgba(60,24,10,0.18)";
    ctx.fill(poly3(D, band));
    // затенение к низу
    const bottom = D.pr(x, 0, z + Rb);
    const vg = ctx.createLinearGradient(0, pa[1], 0, bottom[1]);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.7, "rgba(0,0,0,0.04)");
    vg.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = vg;
    ctx.fill(bodyPath);
    ctx.restore();
    if (D.mirror) return;
    // передний край венчика поверх листьев
    const rim = ring(R, H, Math.PI, 0, 24).concat(ring(R - 10, H, 0, Math.PI, 24));
    ctx.fillStyle = T.css(T.lighten(potColor, 0.16));
    ctx.fill(poly3(D, rim));
  }

  function decorPlan(L) {
    if (!L.pr.decor || L.w < 260) return null;
    const s = L.ppmm;
    const leftSpace = L.cx / s - HALF_DOOR;
    const rightSpace = (L.w - L.cx) / s - HALF_DOOR;
    const plan = {};
    if (leftSpace > 1050) {
      const cw = Math.min(1100, leftSpace - 400);
      const x1 = -(HALF_DOOR + Math.min(1100, Math.max(210, (leftSpace - cw) * 0.35)));
      plan.console = { x0: x1 - cw, x1 };
      const aw = Math.min(620, cw * 0.62);
      const ac = x1 - cw / 2;
      const room = L.floorY / s - 120;
      const ah = Math.min(aw * 1.3, room - 1010);
      if (ah > 380) plan.art = { x0: ac - aw / 2, x1: ac + aw / 2, y0: 1010, y1: 1010 + ah };
    }
    if (rightSpace > 780) plan.plant = { x: HALF_DOOR + 170 + 175, z: 300, R: 175, H: 430 };
    return plan.console || plan.plant ? plan : null;
  }

  function decorPass(D, plan) {
    if (plan.art) drawArt(D, plan.art);
    if (plan.console) drawConsole(D, plan.console);
    if (plan.plant) drawPlant(D, plan.plant);
  }

  function makeD(ctx, L, r, mirror) {
    return { ctx, L, r, s: L.ppmm, eyeMM: L.pr.eye, mirror, pr: projector(L, mirror) };
  }

  /* Нарисовать декор. Возвращает false, если для этой сцены он не нужен. */
  function drawDecor(cv, L, r, gloss) {
    const plan = decorPlan(L);
    if (!plan) {
      cv.width = 1;
      cv.height = 1;
      return false;
    }
    cv.width = Math.max(1, Math.round(L.w * r));
    cv.height = Math.max(1, Math.round(L.h * r));
    const ctx = cv.getContext("2d");
    if (gloss > 0) {
      const m = T.canvas(cv.width, cv.height);
      const mc = m.getContext("2d");
      mc.setTransform(r, 0, 0, r, 0, 0);
      decorPass(makeD(mc, L, r, true), plan);
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.globalCompositeOperation = "destination-in";
      const fy = L.floorY * r;
      const fade = mc.createLinearGradient(0, fy, 0, fy + 650 * L.ppmm * r);
      fade.addColorStop(0, "rgba(0,0,0,0.9)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      mc.fillStyle = fade;
      mc.fillRect(0, fy, m.width, m.height - fy);
      ctx.save();
      ctx.globalAlpha = gloss;
      ctx.filter = "blur(" + Math.max(0.6, 1.4 * r) + "px)";
      ctx.drawImage(m, 0, 0);
      ctx.restore();
    }
    ctx.setTransform(r, 0, 0, r, 0, 0);
    decorPass(makeD(ctx, L, r, false), plan);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return true;
  }

  /* ------------------------------------------------------------------ картинки */

  function dpr() {
    return Math.min(2, window.devicePixelRatio || 1);
  }

  function sizeCanvas(cv, w, h) {
    const r = dpr();
    const W2 = Math.max(1, Math.round(w * r));
    const H2 = Math.max(1, Math.round(h * r));
    if (cv.width !== W2) cv.width = W2;
    if (cv.height !== H2) cv.height = H2;
    return r;
  }

  /* ------------------------------------------------------------------ фото дверей */

  /*
   * Дверь может быть не нарисованной, а настоящей: фото двери с наличниками,
   * вырезанное из фона (PNG с прозрачностью). Путь — в поле cutout у двери или у цвета.
   * photoHinge — с какой стороны петли на фото; если выбрана другая сторона, фото отзеркаливается.
   */
  const photos = new Map();

  function cutoutOf(p, f) {
    return (f && f.cutout) || p.cutout || "";
  }

  function hasPhoto(p) {
    return !!(p.cutout || (p.finishes || []).some((f) => f.cutout));
  }

  function photo(url, onload) {
    let im = photos.get(url);
    if (!im) {
      im = new Image();
      im.decoding = "async";
      im.src = url;
      photos.set(url, im);
    }
    if (im.complete && im.naturalWidth) return im;
    im.addEventListener("load", onload, { once: true });
    return null;
  }

  function photoFlip(p, f, hinge) {
    return (hinge || "left") !== ((f && f.photoHinge) || p.photoHinge || "left");
  }

  /* Вписать фото в прямоугольник W×H: по центру и по низу, при необходимости зеркально. */
  function drawPhoto(ctx, im, W, H, flip, light) {
    const k = Math.min(W / im.naturalWidth, H / im.naturalHeight);
    const w = im.naturalWidth * k;
    const h = im.naturalHeight * k;
    const x = (W - w) / 2;
    const y = H - h;
    ctx.save();
    ctx.imageSmoothingQuality = "high";
    if (flip) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(im, x, y, w, h);
    ctx.restore();
    if (!light) return;
    // свет комнаты: слева чуть теплее, книзу чуть темнее — фото не выглядит вклеенным
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    let g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(255,244,228,0.07)");
    g.addColorStop(1, "rgba(20,10,4,0.08)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0.55, "rgba(20,10,4,0)");
    g.addColorStop(1, "rgba(20,10,4,0.12)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /* Дверь целиком (наличники + полотно) в canvas по размеру элемента. */
  function doorImage(cv, p, fi, opt) {
    opt = opt || {};
    const g = geo(p);
    const w = opt.w || cv.clientWidth || 120;
    const h = opt.h || cv.clientHeight || 240;
    const r = sizeCanvas(cv, w, h);
    const ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const pad = opt.pad === undefined ? 0.04 : opt.pad;
    const f = p.finishes[fi || 0] || p.finishes[0];
    const cut = cutoutOf(p, f);
    if (cut) {
      const im = photo(cut, () => enqueue(() => doorImage(cv, p, fi, opt)));
      if (!im) return;
      const bw = cv.width * (1 - pad * 2);
      const bh = cv.height * (1 - pad) - (opt.bottom || 0) * r;
      ctx.translate((cv.width - bw) / 2, cv.height - bh - (opt.bottom || 0) * r);
      drawPhoto(ctx, im, bw, bh, photoFlip(p, f, opt.hinge), false);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    const s = Math.min((cv.width * (1 - pad * 2)) / g.W, (cv.height * (1 - pad)) / g.H);
    const ox = (cv.width - g.W * s) / 2;
    const oy = cv.height - g.H * s - (opt.bottom || 0) * r;
    ctx.setTransform(s, 0, 0, s, ox + g.lx * s, oy + g.ly * s);
    drawLeaf(ctx, p, f, { s, hinge: opt.hinge });
    ctx.setTransform(s, 0, 0, s, ox, oy);
    drawFrame(ctx, p, f, { s, hinge: opt.hinge });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* Вид сверху на ламинат. mm — сколько миллиметров по ширине показать. */
  function floorImage(cv, p, opt) {
    opt = opt || {};
    const w = opt.w || cv.clientWidth || 200;
    const h = opt.h || cv.clientHeight || 150;
    const r = sizeCanvas(cv, w, h);
    const mm = opt.mm || 1600;
    const need = (w * r) / mm;
    const ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (need > 0.55) {
      // крупный план: отдельный участок пола в хорошем разрешении
      const ppm = need > 0.8 ? 1 : 0.7;
      const mmH = (mm * h) / w;
      const reg = T.floorRegion(p, ppm, mm, mmH);
      ctx.drawImage(reg, 0, 0, mm * ppm, mmH * ppm, 0, 0, cv.width, cv.height);
    } else {
      const ppm = need > 0.26 ? 0.5 : 0.25;
      const t = T.floorTile(p, ppm, "h");
      const pat = ctx.createPattern(t.canvas, "repeat");
      const sc = need / ppm;
      pat.setTransform(new DOMMatrix().scale(sc));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    if (opt.light !== false) {
      const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
      g.addColorStop(0, "rgba(255,255,255,0.1)");
      g.addColorStop(0.5, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
  }

  /* ------------------------------------------------------------------ сцена */

  const PRESETS = {
    hero: { floor: 0.74, door: 0.64, eye: 1450, x: 0.5, open: 26, decor: true },
    product: { floor: 0.78, door: 0.68, eye: 1450, x: 0.5, open: 30, decor: true },
    "card-door": { floor: 0.845, door: 0.76, eye: 1350, x: 0.5, open: 18 },
    "card-floor": { floor: 0.4, door: 0.35, eye: 1650, x: 0.74, open: 20 },
    "lam-product": { floor: 0.5, door: 0.43, eye: 1600, x: 0.7, open: 26, decor: true },
  };

  const SCENE_HTML =
    '<div class="sc-wall"></div>' +
    '<div class="sc-floor"><div class="sc-plane"><canvas class="sc-floor-cv"></canvas><div class="sc-spill"></div></div><div class="sc-floor-light"></div></div>' +
    '<div class="sc-reflect"><canvas></canvas></div>' +
    '<div class="sc-base sc-base-l"></div><div class="sc-base sc-base-r"></div>' +
    '<div class="sc-contact"></div>' +
    '<div class="sc-door"><div class="sc-hole"><div class="sc-opening"></div><div class="sc-leaf"><canvas></canvas><i class="sc-leaf-shade"></i></div></div><canvas class="sc-frame"></canvas></div>' +
    '<canvas class="sc-decor"></canvas>' +
    '<div class="sc-tint"></div>';

  const queue = [];
  let busy = false;
  function enqueue(fn) {
    queue.push(fn);
    if (!busy) {
      busy = true;
      requestAnimationFrame(runQueue);
    }
  }
  function runQueue() {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 14) {
      const fn = queue.shift();
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    }
    if (queue.length) requestAnimationFrame(runQueue);
    else busy = false;
  }

  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              if (!en.isIntersecting) continue;
              io.unobserve(en.target);
              const sc = en.target.__scene;
              if (sc) enqueue(() => sc.render());
            }
          },
          { rootMargin: "400px 0px" },
        )
      : null;

  const ro =
    "ResizeObserver" in window
      ? new ResizeObserver((entries) => {
          for (const en of entries) {
            const sc = en.target.__scene;
            if (!sc || !sc.rendered) continue;
            const w = Math.round(en.contentRect.width);
            const h = Math.round(en.contentRect.height);
            if (Math.abs(w - sc.w) < 2 && Math.abs(h - sc.h) < 2) continue;
            clearTimeout(sc.rt);
            sc.rt = setTimeout(() => enqueue(() => sc.render()), 120);
          }
        })
      : null;

  function px(v) {
    return Math.round(v * 100) / 100 + "px";
  }

  const live = new Set();

  /* Отключить сцены, которых уже нет на странице. */
  function sweep() {
    for (const sc of live) {
      if (!sc.el.isConnected) {
        sc.destroy();
        live.delete(sc);
      }
    }
  }

  function Scene(el, o) {
    live.add(this);
    this.el = el;
    this.o = Object.assign({ preset: "hero", finish: 0, hinge: "left", wall: "#DCD6CE" }, o);
    this.rendered = false;
    el.classList.add("scene");
    el.innerHTML = SCENE_HTML;
    el.__scene = this;
    this.q = (s) => el.querySelector(s);
    el.style.setProperty("--wall", this.o.wall);
    if (io) io.observe(el);
    else enqueue(() => this.render());
    if (ro) ro.observe(el);
  }

  Scene.prototype.update = function (o) {
    const prev = this.o;
    this.o = Object.assign({}, prev, o);
    this.el.style.setProperty("--wall", this.o.wall);
    if (!this.rendered) return;
    const doorChanged = o.door !== undefined || o.finish !== undefined || o.hinge !== undefined;
    const floorChanged = o.floor !== undefined;
    const el = this.el;
    if (doorChanged) el.classList.add("is-swapping-door");
    if (floorChanged) el.classList.add("is-swapping-floor");
    clearTimeout(this.st);
    this.st = setTimeout(() => {
      enqueue(() => {
        this.render({ door: doorChanged, floor: floorChanged });
        requestAnimationFrame(() => el.classList.remove("is-swapping-door", "is-swapping-floor"));
      });
    }, 160);
  };

  Scene.prototype.setOpen = function (v) {
    this.el.classList.toggle("is-open", !!v);
  };

  Scene.prototype.layout = function () {
    const el = this.el;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return null;
    const pr = PRESETS[this.o.preset] || PRESETS.hero;
    const door = this.o.door;
    const g = geo(door);
    const floorY = h * pr.floor;
    const ppmm = (h * pr.door) / g.H;
    const bw = g.W * ppmm;
    const bh = g.H * ppmm;
    const cx = w * pr.x;
    const left = cx - bw / 2;
    const top = floorY - bh;
    const eye = pr.eye * ppmm;
    const P = Math.max(w, h) * 1.25;
    const F = h - floorY;
    const depth = Math.min(P * 0.96, ((P * F) / (F + eye)) * 1.06 + 6);
    const L = { w, h, g, floorY, ppmm, bw, bh, cx, left, top, eye, P, F, depth, pr };
    const set = (sel, css) => Object.assign(this.q(sel).style, css);
    const hingeLeft = this.o.hinge !== "right";
    el.style.setProperty("--open", (hingeLeft ? 1 : -1) * pr.open + "deg");
    el.style.setProperty("--ajar", (hingeLeft ? 1 : -1) * Math.round(pr.open * 0.6) + "deg");
    el.style.setProperty("--edge", px((door.kind === "entrance" ? 80 : 40) * ppmm));
    el.classList.toggle("hinge-right", !hingeLeft);
    set(".sc-wall", { height: px(floorY) });
    set(".sc-floor", {
      top: px(floorY),
      height: px(F),
      perspective: px(P),
      perspectiveOrigin: px(cx) + " " + px(-eye),
    });
    set(".sc-plane", { left: px(-20), width: px(w + 40), height: px(depth) });
    set(".sc-spill", {
      left: px(cx + 20 - g.LW * ppmm * 0.55),
      width: px(g.LW * ppmm * 1.1),
      height: px(depth * 0.9),
    });
    const baseH = Math.max(3, 80 * ppmm);
    set(".sc-base-l", {
      top: px(floorY - baseH),
      height: px(baseH),
      left: "0px",
      width: px(Math.max(0, left)),
    });
    set(".sc-base-r", {
      top: px(floorY - baseH),
      height: px(baseH),
      left: px(left + bw),
      width: px(Math.max(0, w - left - bw)),
    });
    set(".sc-contact", {
      left: px(left - bw * 0.04),
      width: px(bw * 1.08),
      top: px(floorY - 6),
      height: "12px",
    });
    set(".sc-door", { left: px(left), top: px(top), width: px(bw), height: px(bh) });
    const holeX = g.lx * ppmm;
    const holeY = g.ly * ppmm;
    set(".sc-hole", {
      left: px(holeX),
      top: px(holeY),
      width: px(g.LW * ppmm),
      height: px(g.LH * ppmm),
      perspective: px(P),
      perspectiveOrigin: px(bw / 2 - holeX) + " " + px(bh - eye - holeY),
    });
    set(".sc-reflect", { left: px(left), top: px(floorY), width: px(bw), height: px(bh) });
    this.w = w;
    this.h = h;
    return L;
  };

  Scene.prototype.render = function (what) {
    const L = this.layout();
    if (!L) return;
    const all = !what || !this.rendered;
    const r = dpr();
    const door = this.o.door;
    const f = door.finishes[this.o.finish] || door.finishes[0];
    const g = L.g;
    if (all || what.floor) this.drawFloor(L, r);
    if (all || what.door) {
      const s = L.ppmm * r;
      const frame = this.q(".sc-frame");
      frame.width = Math.max(1, Math.round(g.W * s));
      frame.height = Math.max(1, Math.round(g.H * s));
      const refl = this.q(".sc-reflect canvas");
      refl.width = frame.width;
      refl.height = frame.height;
      const cut = cutoutOf(door, f);
      this.el.classList.toggle("is-photo", !!cut);
      if (cut) {
        // настоящее фото двери вместо рисунка; дверь на фото закрыта
        const im = photo(cut, () => enqueue(() => this.render({ door: true })));
        if (im) {
          drawPhoto(
            frame.getContext("2d"),
            im,
            frame.width,
            frame.height,
            photoFlip(door, f, this.o.hinge),
            true,
          );
          refl.getContext("2d").drawImage(frame, 0, 0);
        }
      } else {
        let ctx = frame.getContext("2d");
        ctx.setTransform(s, 0, 0, s, 0, 0);
        drawFrame(ctx, door, f, { s, hinge: this.o.hinge });
        const leaf = this.q(".sc-leaf canvas");
        leaf.width = Math.max(1, Math.round(g.LW * s));
        leaf.height = Math.max(1, Math.round(g.LH * s));
        ctx = leaf.getContext("2d");
        ctx.setTransform(s, 0, 0, s, 0, 0);
        drawLeaf(ctx, door, f, { s, hinge: this.o.hinge });
        ctx = refl.getContext("2d");
        ctx.drawImage(leaf, g.lx * s, g.ly * s, g.LW * s, g.LH * s);
        ctx.drawImage(frame, 0, 0);
      }
      this.el.style.setProperty("--edge-color", f.color);
    }
    const gloss =
      this.o.floor && this.o.floor.look && this.o.floor.look.figure === "stone" ? 0.1 : 0.14;
    this.el.style.setProperty("--gloss", gloss);
    if (all || what.door || what.floor) {
      const has = drawDecor(this.q(".sc-decor"), L, r, gloss);
      this.el.classList.toggle("has-decor", has);
    }
    this.rendered = true;
    this.el.classList.add("is-ready");
    if (!this.readyFired && this.o.onReady) {
      this.readyFired = true;
      this.o.onReady(this);
    }
  };

  Scene.prototype.destroy = function () {
    if (io) io.unobserve(this.el);
    if (ro) ro.unobserve(this.el);
    this.el.__scene = null;
  };

  Scene.prototype.drawFloor = function (L, r) {
    const lam = this.o.floor;
    const cv = this.q(".sc-floor-cv");
    const cw = L.w + 40;
    const ch = L.depth;
    const cap = 4096;
    const rr = Math.min(r, cap / cw, cap / Math.max(1, ch));
    cv.width = Math.max(1, Math.round(cw * rr));
    cv.height = Math.max(1, Math.round(ch * rr));
    const ctx = cv.getContext("2d");
    if (!lam) {
      ctx.fillStyle = "#8b7156";
      ctx.fillRect(0, 0, cv.width, cv.height);
      return;
    }
    const ppm = L.ppmm * rr > 0.2 ? 0.5 : 0.25;
    const t = T.floorTile(lam, ppm, "v");
    const pat = ctx.createPattern(t.canvas, "repeat");
    const sc = (L.ppmm * rr) / ppm;
    const originX = (L.cx + 20) * rr;
    pat.setTransform(new DOMMatrix().translate(originX, 0).scale(sc));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, cv.width, cv.height);
    // свет от стены и окна
    let gr = ctx.createLinearGradient(0, 0, 0, cv.height);
    gr.addColorStop(0, "rgba(255,245,230,0.12)");
    gr.addColorStop(0.5, "rgba(255,245,230,0)");
    gr.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cv.width, cv.height);
    gr = ctx.createRadialGradient(originX, 0, 0, originX, 0, cv.width * 0.6);
    gr.addColorStop(0, "rgba(255,240,220,0.14)");
    gr.addColorStop(1, "rgba(255,240,220,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cv.width, cv.height);
  };

  window.Render = {
    geo,
    drawLeaf,
    drawFrame,
    doorImage,
    floorImage,
    Scene,
    sweep,
    enqueue,
    hasPhoto,
    MODELS: Object.keys(MODELS),
  };
})();
