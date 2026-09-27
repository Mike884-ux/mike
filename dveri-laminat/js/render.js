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
    const ppm = s > 0.8 ? 0.9 : s > 0.42 ? 0.6 : 0.32;
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
    const s = Math.min((cv.width * (1 - pad * 2)) / g.W, (cv.height * (1 - pad)) / g.H);
    const ox = (cv.width - g.W * s) / 2;
    const oy = cv.height - g.H * s - (opt.bottom || 0) * r;
    const f = p.finishes[fi || 0] || p.finishes[0];
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
    hero: { floor: 0.77, door: 0.69, eye: 1450, x: 0.5, open: 26 },
    product: { floor: 0.78, door: 0.7, eye: 1450, x: 0.5, open: 30 },
    "card-door": { floor: 0.845, door: 0.76, eye: 1350, x: 0.5, open: 18 },
    "card-floor": { floor: 0.4, door: 0.35, eye: 1650, x: 0.74, open: 20 },
    "lam-product": { floor: 0.5, door: 0.43, eye: 1600, x: 0.7, open: 26 },
  };

  const SCENE_HTML =
    '<div class="sc-wall"></div>' +
    '<div class="sc-floor"><div class="sc-plane"><canvas class="sc-floor-cv"></canvas><div class="sc-spill"></div></div><div class="sc-floor-light"></div></div>' +
    '<div class="sc-reflect"><canvas></canvas></div>' +
    '<div class="sc-base sc-base-l"></div><div class="sc-base sc-base-r"></div>' +
    '<div class="sc-contact"></div>' +
    '<div class="sc-door"><div class="sc-hole"><div class="sc-opening"></div><div class="sc-leaf"><canvas></canvas><i class="sc-leaf-shade"></i></div></div><canvas class="sc-frame"></canvas></div>' +
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
      let ctx = frame.getContext("2d");
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawFrame(ctx, door, f, { s, hinge: this.o.hinge });
      const leaf = this.q(".sc-leaf canvas");
      leaf.width = Math.max(1, Math.round(g.LW * s));
      leaf.height = Math.max(1, Math.round(g.LH * s));
      ctx = leaf.getContext("2d");
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawLeaf(ctx, door, f, { s, hinge: this.o.hinge });
      const refl = this.q(".sc-reflect canvas");
      refl.width = frame.width;
      refl.height = frame.height;
      ctx = refl.getContext("2d");
      ctx.drawImage(leaf, g.lx * s, g.ly * s, g.LW * s, g.LH * s);
      ctx.drawImage(frame, 0, 0);
      this.el.style.setProperty("--edge-color", f.color);
    }
    const gloss =
      this.o.floor && this.o.floor.look && this.o.floor.look.figure === "stone" ? 0.1 : 0.14;
    this.el.style.setProperty("--gloss", gloss);
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
    MODELS: Object.keys(MODELS),
  };
})();
