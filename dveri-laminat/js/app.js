/*
 * Сайт салона: страницы, каталог с фильтрами, карточка товара, заявка, поиск.
 * Товары и контакты берутся из js/data.js.
 */
(function () {
  "use strict";

  const T = window.Textures;
  const R = window.Render;

  /* ------------------------------------------------------------------ данные */

  const CFG = Object.assign(
    {
      name: "Салон",
      tagline: "Двери и ламинат",
      city: "",
      phone: "",
      whatsapp: "",
      telegram: "",
      instagram: "",
      address: "",
      mapUrl: "",
      hours: [],
      currency: "смн",
      about: "",
      services: [],
      doorKit: [],
      entranceKit: [],
      underlay: { name: "Подложка", price: 0 },
      plinth: { name: "Плинтус 2,5 м", price: 0 },
    },
    window.SHOP_CONFIG || {},
  );

  /* ------------------------------------------------------------------ справочники */

  const TONES = {
    white: { name: "Белые и светлые", color: "#EFEDE8" },
    "wood-light": { name: "Светлое дерево", color: "#D8C7A8" },
    wood: { name: "Дерево", color: "#A77B4F" },
    grey: { name: "Серые", color: "#9A9894" },
    dark: { name: "Тёмные", color: "#2E2A27" },
  };

  const TONE_L = {
    light: { name: "Светлый", color: "#DCCBAE" },
    natural: { name: "Натуральный", color: "#B98C5C" },
    dark: { name: "Тёмный", color: "#5A3E2B" },
    grey: { name: "Серый", color: "#A09D97" },
  };

  const GLASS = {
    frosted: "Матовое (сатинат)",
    clear: "Прозрачное",
    bronze: "Бронза, тонированное",
    black: "Чёрное (лакобель)",
    fluted: "Рифлёное",
  };

  const HANDLES = {
    chrome: "Хром",
    satin: "Матовый никель",
    black: "Чёрная матовая",
    gold: "Золото",
    bronze: "Бронза",
  };

  function toneOf(f) {
    const c = T.hex(f.color);
    const L = T.luma(c);
    const mx = Math.max(c[0], c[1], c[2]);
    const mn = Math.min(c[0], c[1], c[2]);
    const sat = mx ? (mx - mn) / mx : 0;
    if (L < 0.2) return "dark";
    if (f.type === "wood") return L > 0.55 ? "wood-light" : L > 0.3 ? "wood" : "dark";
    if (L > 0.72) return "white";
    if (sat < 0.14) return L < 0.3 ? "dark" : "grey";
    return L > 0.55 ? "white" : "wood";
  }

  function patternName(l) {
    return { herringbone: "ёлочка", tile: "плитка" }[l.pattern] || "доска";
  }

  function bevelName(b) {
    return { "4V": "фаска 4V", "2V": "фаска 2V" }[b] || "без фаски";
  }

  const AC = { 31: "AC3", 32: "AC4", 33: "AC5", 34: "AC6" };

  const round3 = (n) => Math.round(n * 1000) / 1000;

  const DOORS = (window.SHOP_DOORS || []).map((raw) => {
    const d = Object.assign(
      {
        kind: "interior",
        model: "flat",
        finishes: [{ name: "Белый", type: "paint", color: "#EEEDE9" }],
        sizes: ["800×2000"],
        sizeExtra: {},
        features: [],
        specs: [],
        photos: [],
        inStock: true,
        oldPrice: 0,
        badge: "",
        collection: "",
        style: "",
        cover: "",
        description: "",
      },
      raw,
    );
    d.cat = "door";
    d.kit = raw.kit || (d.kind === "entrance" ? CFG.entranceKit : CFG.doorKit) || [];
    d.typeName = d.kind === "entrance" ? "Входная дверь" : "Межкомнатная дверь";
    d.search = norm(
      [d.name, d.collection, d.style, d.cover, d.typeName, "дверь двери"]
        .concat(d.finishes.map((f) => f.name))
        .join(" "),
    );
    return d;
  });

  const LAMS = (window.SHOP_LAMINATE || []).map((raw) => {
    const l = Object.assign(
      {
        plank: [1380, 193],
        pack: { pcs: 8 },
        pattern: "plank",
        bevel: "none",
        tone: "natural",
        look: { base: "#C39A66", figure: "oak" },
        features: [],
        specs: [],
        photos: [],
        inStock: true,
        oldPrice: 0,
        badge: "",
        collection: "",
        description: "",
        class: 32,
        thickness: 8,
      },
      raw,
    );
    l.cat = "lam";
    l.pack = Object.assign({ pcs: 8 }, l.pack);
    l.packM2 = l.pack.m2 || round3((l.pack.pcs * l.plank[0] * l.plank[1]) / 1e6);
    l.packPrice = l.packM2 * l.price;
    l.search = norm(
      [
        l.name,
        l.collection,
        "ламинат пол",
        l.class + " класс",
        l.thickness + " мм",
        TONE_L[l.tone] && TONE_L[l.tone].name,
        patternName(l),
      ].join(" "),
    );
    return l;
  });

  const ALL = DOORS.concat(LAMS);
  const BY_ID = Object.create(null);
  for (const p of ALL) BY_ID[p.id] = p;
  const doorById = (id) => (BY_ID[id] && BY_ID[id].cat === "door" ? BY_ID[id] : DOORS[0]);
  const lamById = (id) => (BY_ID[id] && BY_ID[id].cat === "lam" ? BY_ID[id] : LAMS[0]);

  const WALLS = [
    { name: "Светлая", color: "#E6E1DA" },
    { name: "Тёплый беж", color: "#D5C4AF" },
    { name: "Шалфей", color: "#A7B2A1" },
    { name: "Графит", color: "#55585C" },
    { name: "Терракота", color: "#B67C60" },
  ];
  const CARD_WALL = "#D8D1C7";

  /* ------------------------------------------------------------------ помощники */

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е");
  }

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const app = $("#app");

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function num(n, d) {
    return Number(n).toLocaleString("ru-RU", { maximumFractionDigits: d === undefined ? 2 : d });
  }

  function money(n) {
    return num(Math.round(n), 0) + " " + CFG.currency;
  }

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  function parseNum(v) {
    const n = parseFloat(
      String(v || "")
        .replace(",", ".")
        .replace(/[^\d.]/g, ""),
    );
    return isFinite(n) ? n : 0;
  }

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* хранилище недоступно — работаем без него */
      }
    },
  };

  const digits = (s) => String(s || "").replace(/\D/g, "");
  const phoneHint = () =>
    String(CFG.phone || "+")
      .trim()
      .split(/\s+/)[0];
  const telHref = () => "tel:+" + digits(CFG.phone);

  function waHref(text) {
    const n = digits(CFG.whatsapp || CFG.phone);
    return "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    heart:
      '<path d="M12 20.3s-7.6-4.6-7.6-10.3A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.7c0 5.7-7.6 10.3-7.6 10.3z"/>',
    list: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 3.5V5.5h6V3.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    phone:
      '<path d="M6.6 3.5h3l1.6 4.2-2.1 1.4a10.6 10.6 0 0 0 5.8 5.8l1.4-2.1 4.2 1.6v3a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
    wa: '<path d="M4.4 19.6l1.2-3.7a8.1 8.1 0 1 1 3.1 2.8z"/><path d="M9.3 8.4c.2 3 3.2 6 6.3 6.3l1-1.5-2-1-1 .9a5 5 0 0 1-2.6-2.6l.9-1-1-2z"/>',
    tg: '<path d="M20.6 4.4 3.4 11.1l5.7 2 2 6 3.1-3.5 4.7 3.5z"/><path d="m9.1 13.1 8.3-6.2"/>',
    ig: '<rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.7"/><circle cx="16.9" cy="7.1" r=".6"/>',
    menu: '<path d="M4 7.5h16M4 12h16M4 16.5h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="m9.5 6 6 6-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.1M12 19.3v2.1M4.7 4.7l1.5 1.5M17.8 17.8l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.7 19.3l1.5-1.5M17.8 6.2l1.5-1.5"/>',
    moon: '<path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z"/>',
    ruler:
      '<path d="m3.6 16.4 12.8-12.8 4 4L7.6 20.4z"/><path d="m7.6 12.4 2 2M10.6 9.4l2 2M13.6 6.4l2 2"/>',
    truck:
      '<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    shield:
      '<path d="M12 3 5 6v5.5c0 4.6 3 8 7 9.5 4-1.5 7-4.9 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    pin: '<path d="M12 21s6.5-5.8 6.5-11.2a6.5 6.5 0 0 0-13 0C5.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    filter: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
    door: '<path d="M6.5 20.5v-16a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M4 20.5h16"/><circle cx="14.6" cy="12.5" r=".9"/>',
    open: '<path d="M3.5 20.5h17M6.5 20.5v-16h8"/><path d="M14.5 4.5 18.5 6v14.5l-4-1.5z"/><circle cx="16" cy="12.5" r=".5"/>',
    sofa: '<path d="M5 11V8.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V11"/><path d="M3 12a1.5 1.5 0 0 1 3 0v2h12v-2a1.5 1.5 0 0 1 3 0v5H3z"/><path d="M5 17v2M19 17v2"/>',
    palette:
      '<path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2-1.6 3.2-3.5 3.2h-2.2a1.8 1.8 0 0 0-1.3 3.1 1.3 1.3 0 0 1-1 2.2z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.3" r="1.1"/><circle cx="15" cy="7.8" r="1.1"/>',
    zoom: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4M11 8.2v5.6M8.2 11h5.6"/>',
    plank: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M3 11h18M9 8v3M15 11v5"/>',
    image:
      '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8 8.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13"/>',
    calc: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 7.5h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01"/>',
    drop: '<path d="M12 3.5s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z"/>',
  };

  function icon(name, cls) {
    return (
      '<svg class="i' +
      (cls ? " " + cls : "") +
      '" viewBox="0 0 24 24" aria-hidden="true">' +
      (ICONS[name] || "") +
      "</svg>"
    );
  }

  const LOGO =
    '<svg class="logo-mark" viewBox="0 0 34 34" aria-hidden="true"><rect x="0.75" y="0.75" width="32.5" height="32.5" rx="10" fill="none" stroke="currentColor" stroke-opacity=".35"/><path d="M11 26V8.6A1.6 1.6 0 0 1 12.6 7h8.8A1.6 1.6 0 0 1 23 8.6V26" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 26h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="19.6" cy="17" r="1.5" fill="currentColor"/></svg>';

  /* ------------------------------------------------------------------ состояние */

  const state = {
    fav: new Set(store.get("fav", [])),
    cart: store.get("cart", []).filter((it) => BY_ID[it.id]),
    form: store.get("orderForm", { name: "", phone: "", comment: "" }),
  };

  const vis = Object.assign(
    { door: CFG.cardDoor, finish: 0, floor: CFG.cardFloor, wall: 0, open: true, tab: "door" },
    store.get("vis", {}),
  );
  if (!BY_ID[vis.door] || BY_ID[vis.door].cat !== "door") vis.door = DOORS[0] && DOORS[0].id;
  if (!BY_ID[vis.floor] || BY_ID[vis.floor].cat !== "lam") vis.floor = LAMS[0] && LAMS[0].id;
  if (!WALLS[vis.wall]) vis.wall = 0;
  if (!doorById(vis.door).finishes[vis.finish]) vis.finish = 0;

  const F = {
    door: {
      kind: null,
      style: new Set(),
      cover: new Set(),
      tone: new Set(),
      glass: "all",
      min: "",
      max: "",
      stock: false,
    },
    lam: {
      cls: new Set(),
      thick: new Set(),
      tone: new Set(),
      pattern: new Set(),
      bevel: new Set(),
      water: false,
      min: "",
      max: "",
      stock: false,
    },
  };
  const SORT = { door: "popular", lam: "popular" };

  const calcState = {};
  let heroScene = null;
  let pageScene = null;
  let page = null;

  function saveCart() {
    store.set("cart", state.cart);
    updateCounts();
  }

  /* ------------------------------------------------------------------ картинки */

  const lazyIO =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              if (!en.isIntersecting) continue;
              lazyIO.unobserve(en.target);
              const fn = en.target.__draw;
              if (fn) R.enqueue(fn);
            }
          },
          { rootMargin: "300px" },
        )
      : null;

  function lazy(el, fn) {
    el.__draw = fn;
    if (lazyIO) lazyIO.observe(el);
    else R.enqueue(fn);
  }

  function hydrate(root) {
    for (const el of $$("[data-scene]", root)) {
      if (el.__scene) continue;
      const d = el.dataset;
      const sc = new R.Scene(el, {
        preset: d.scene,
        door: doorById(d.door),
        finish: +d.finish || 0,
        floor: lamById(d.floor),
        wall: d.wall || CARD_WALL,
        hinge: d.hinge || "left",
        onReady: d.open ? (s) => setTimeout(() => s.setOpen(true), 500) : null,
      });
      el.__scene = sc;
    }
    for (const cv of $$("canvas[data-door]", root)) {
      const p = doorById(cv.dataset.door);
      lazy(cv, () =>
        R.doorImage(cv, p, +cv.dataset.finish || 0, {
          pad: cv.dataset.pad ? +cv.dataset.pad : 0.04,
          hinge: cv.dataset.hinge,
        }),
      );
    }
    for (const cv of $$("canvas[data-floor]", root)) {
      const p = lamById(cv.dataset.floor);
      lazy(cv, () => R.floorImage(cv, p, { mm: +cv.dataset.mm || 900 }));
    }
    for (const cv of $$("canvas[data-plank]", root)) {
      const p = lamById(cv.dataset.plank);
      lazy(cv, () => drawPlank(cv, p));
    }
  }

  function drawPlank(cv, p) {
    const w = cv.clientWidth || 600;
    const ratio = p.plank[1] / p.plank[0];
    const h = Math.max(24, Math.round(w * ratio));
    const r = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * r);
    cv.height = Math.round(h * r);
    cv.style.height = h + "px";
    const need = (w * r) / p.plank[0];
    const img = T.plankVariants(p, need > 0.6 ? 1 : 0.5)[0];
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const b = Math.max(2, 3 * (cv.width / p.plank[0]));
    if (p.bevel !== "none") {
      let g = ctx.createLinearGradient(0, 0, 0, b);
      g.addColorStop(0, "rgba(0,0,0,.4)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cv.width, b);
      g = ctx.createLinearGradient(0, cv.height - b, 0, cv.height);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,.35)");
      ctx.fillStyle = g;
      ctx.fillRect(0, cv.height - b, cv.width, b);
    }
    if (p.bevel === "4V") {
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(0, 0, b, cv.height);
      ctx.fillRect(cv.width - b, 0, b, cv.height);
    }
  }

  /* ------------------------------------------------------------------ цены */

  function defaultSize(p) {
    return p.sizes.indexOf("800×2000") >= 0 ? "800×2000" : p.sizes[0];
  }

  function doorUnit(p, o) {
    let s = p.price + ((p.sizeExtra && p.sizeExtra[o.size]) || 0);
    for (const k of p.kit) if (o.kit.indexOf(k.id) >= 0) s += k.price;
    return s;
  }

  function itemPrice(it) {
    const p = BY_ID[it.id];
    if (!p) return 0;
    if (it.t === "door") return doorUnit(p, it) * it.qty;
    return (
      it.packs * p.packM2 * p.price +
      (it.underlay || 0) * CFG.underlay.price +
      (it.plinth || 0) * CFG.plinth.price
    );
  }

  function itemDesc(it) {
    const p = BY_ID[it.id];
    if (!p) return "";
    if (it.t === "door") {
      const f = p.finishes[it.finish] || p.finishes[0];
      const kit = p.kit.filter((k) => it.kit.indexOf(k.id) >= 0).map((k) => k.name.toLowerCase());
      return (
        f.name +
        ", " +
        it.size +
        " мм, петли " +
        (it.hinge === "right" ? "справа" : "слева") +
        (kit.length
          ? ". " + (p.kind === "entrance" ? "Дополнительно: " : "Комплект: ") + kit.join(", ")
          : "")
      );
    }
    let s = it.packs + " уп. = " + num(it.packs * p.packM2) + " м²";
    if (it.underlay) s += ", подложка " + it.underlay + " м²";
    if (it.plinth) s += ", плинтус " + it.plinth + " шт";
    return s;
  }

  function cartTotal() {
    return state.cart.reduce((s, it) => s + itemPrice(it), 0);
  }

  function addDoor(p, o, silent) {
    const it = {
      t: "door",
      id: p.id,
      finish: o.finish || 0,
      size: o.size || defaultSize(p),
      hinge: o.hinge || "left",
      kit: (o.kit || p.kit.filter((k) => k.default).map((k) => k.id)).slice().sort(),
      qty: o.qty || 1,
    };
    const key = JSON.stringify([it.id, it.finish, it.size, it.hinge, it.kit]);
    const same = state.cart.find(
      (x) => x.t === "door" && JSON.stringify([x.id, x.finish, x.size, x.hinge, x.kit]) === key,
    );
    if (same) same.qty += it.qty;
    else state.cart.push(it);
    saveCart();
    if (!silent) toastAdded(p.name);
  }

  function addLam(p, c) {
    const same = state.cart.find((x) => x.t === "lam" && x.id === p.id);
    if (same) {
      same.packs = c.packs;
      same.underlay = c.under;
      same.plinth = c.plinth;
      same.area = c.area;
    } else {
      state.cart.push({
        t: "lam",
        id: p.id,
        packs: c.packs,
        underlay: c.under,
        plinth: c.plinth,
        area: c.area,
      });
    }
    saveCart();
    toastAdded(p.name);
  }

  /* ------------------------------------------------------------------ оболочка */

  const NAV = [
    { id: "doors-interior", label: "Межкомнатные" },
    { id: "doors-entrance", label: "Входные" },
    { id: "laminate", label: "Ламинат" },
    { id: "contacts", label: "Контакты" },
  ];

  function hoursShort() {
    return (CFG.hours || []).map((h) => h[0] + " " + h[1]).join(", ");
  }

  function renderShell() {
    const demoHidden = store.get("demoHidden", false);
    $("#header").innerHTML =
      '<div class="wrap"><div class="header-bar glass veil">' +
      '<a class="logo" href="#" aria-label="' +
      esc(CFG.name) +
      ', на главную">' +
      LOGO +
      '<span><span class="logo-name">' +
      esc(CFG.name) +
      '</span><span class="logo-sub">' +
      esc(CFG.tagline) +
      "</span></span></a>" +
      '<nav class="nav" aria-label="Разделы">' +
      NAV.map((n) => '<a href="#' + n.id + '" data-nav="' + n.id + '">' + n.label + "</a>").join(
        "",
      ) +
      "</nav>" +
      '<div class="header-actions">' +
      (CFG.phone
        ? '<a class="header-phone" href="' +
          telHref() +
          '">' +
          esc(CFG.phone) +
          "<small>" +
          esc(hoursShort()) +
          "</small></a>"
        : "") +
      '<button class="icon-btn" data-act="search" aria-label="Поиск">' +
      icon("search") +
      "</button>" +
      '<button class="icon-btn hide-sm" data-act="theme" aria-label="Светлая или тёмная тема">' +
      icon("sun", "t-sun") +
      icon("moon", "t-moon") +
      "</button>" +
      '<a class="icon-btn hide-sm" href="#favorites" aria-label="Избранное">' +
      icon("heart") +
      '<span class="badge" data-count="fav" hidden></span></a>' +
      '<button class="icon-btn" data-act="cart" aria-label="Заявка">' +
      icon("list") +
      '<span class="badge" data-count="cart" hidden></span></button>' +
      '<button class="icon-btn menu-btn" data-act="menu" aria-label="Меню">' +
      icon("menu") +
      "</button>" +
      "</div></div></div>";
    $("#notice").innerHTML =
      CFG.demo && !demoHidden
        ? '<div class="wrap demo-note"><div class="glass-soft"><span><b>Демо-каталог.</b> Товары, цены и контакты — примеры. Свои данные впишите в файл <code>js/data.js</code>.</span><button class="btn btn-glass btn-sm" data-act="demo-hide">Понятно</button></div></div>'
        : "";

    renderMbar();

    const year = new Date().getFullYear();
    $("#footer").innerHTML =
      '<div class="wrap"><div class="footer-grid glass-soft">' +
      '<div class="footer-brand"><a class="logo" href="#">' +
      LOGO +
      '<span><span class="logo-name">' +
      esc(CFG.name) +
      '</span><span class="logo-sub">' +
      esc(CFG.tagline) +
      "</span></span></a><p>" +
      esc(CFG.about) +
      "</p></div>" +
      '<div><h4>Каталог</h4><a href="#doors-interior">Межкомнатные двери</a><a href="#doors-entrance">Входные двери</a><a href="#laminate">Ламинат</a><a href="#favorites">Избранное</a></div>' +
      "<div><h4>Салон</h4>" +
      (CFG.address ? '<span class="f-line">' + esc(CFG.address) + "</span>" : "") +
      (CFG.hours || [])
        .map((h) => '<span class="f-line">' + esc(h[0]) + ": " + esc(h[1]) + "</span>")
        .join("") +
      (CFG.mapUrl
        ? '<a href="' + esc(CFG.mapUrl) + '" target="_blank" rel="noopener">Как добраться →</a>'
        : "") +
      "</div>" +
      "<div><h4>Связаться</h4>" +
      (CFG.phone ? '<a href="' + telHref() + '">' + esc(CFG.phone) + "</a>" : "") +
      '<a href="' +
      waHref() +
      '" target="_blank" rel="noopener">WhatsApp</a>' +
      (CFG.telegram
        ? '<a href="https://t.me/' +
          esc(CFG.telegram) +
          '" target="_blank" rel="noopener">Telegram</a>'
        : "") +
      (CFG.instagram
        ? '<a href="https://instagram.com/' +
          esc(CFG.instagram) +
          '" target="_blank" rel="noopener">Instagram</a>'
        : "") +
      "</div></div>" +
      '<div class="footer-bottom"><span>© ' +
      year +
      " " +
      esc(CFG.name) +
      '. Цены на сайте не являются публичной офертой.</span><a href="#constructor">Конструктор карточек</a></div></div>';
    updateCounts();
  }

  /* Нижняя панель на телефоне. На странице двери главная кнопка добавляет её в заявку. */
  function renderMbar(price) {
    const main =
      price !== undefined
        ? '<button class="main" data-act="p-add">' +
          icon("plus") +
          '<span>В заявку · <span id="mbarPrice">' +
          money(price) +
          "</span></span></button>"
        : '<button class="main" data-act="cart">' +
          icon("list") +
          '<span>Заявка</span><span class="badge" data-count="cart" hidden></span></button>';
    $("#mbar").innerHTML =
      '<a href="' +
      telHref() +
      '">' +
      icon("phone") +
      "<span>Позвонить</span></a>" +
      (price !== undefined
        ? '<button data-act="cart">' +
          icon("list") +
          '<span>Заявка</span><span class="badge" data-count="cart" hidden></span></button>'
        : '<a href="' +
          waHref() +
          '" target="_blank" rel="noopener">' +
          icon("wa", "wa-ico") +
          "<span>WhatsApp</span></a>") +
      main;
    updateCounts();
  }

  function updateCounts() {
    const c = state.cart.length;
    const f = state.fav.size;
    for (const b of $$('[data-count="cart"]')) {
      b.textContent = c;
      b.hidden = !c;
    }
    for (const b of $$('[data-count="fav"]')) {
      b.textContent = f;
      b.hidden = !f;
    }
  }

  function markNav(id) {
    const p = BY_ID[id];
    if (p)
      id =
        p.cat === "lam" ? "laminate" : p.kind === "entrance" ? "doors-entrance" : "doors-interior";
    for (const a of $$(".nav a")) {
      const on = a.dataset.nav === id || (id && id.indexOf(a.dataset.nav) === 0);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }

  /* ------------------------------------------------------------------ карточка */

  function tagsHTML(p) {
    const t = [];
    if (p.badge === "Хит") t.push('<span class="tag tag-hit">Хит</span>');
    else if (p.badge === "Новинка") t.push('<span class="tag tag-new">Новинка</span>');
    else if (p.badge) t.push('<span class="tag">' + esc(p.badge) + "</span>");
    if (p.oldPrice > p.price)
      t.push(
        '<span class="tag tag-sale">−' + Math.round((1 - p.price / p.oldPrice) * 100) + "%</span>",
      );
    if (!p.inStock) t.push('<span class="tag">Под заказ</span>');
    if (p.cat === "lam" && p.water) t.push('<span class="tag tag-water">Влагостойкий</span>');
    return t.join("");
  }

  function card(p) {
    const isDoor = p.cat === "door";
    let media;
    if (p.photos && p.photos.length) {
      media = '<img src="' + esc(p.photos[0]) + '" alt="' + esc(p.name) + '" loading="lazy" />';
    } else if (isDoor) {
      media =
        '<div data-scene="card-door" data-door="' +
        p.id +
        '" data-floor="' +
        esc(CFG.cardFloor) +
        '" data-wall="' +
        CARD_WALL +
        '"></div>';
    } else {
      media =
        '<div data-scene="card-floor" data-door="' +
        esc(CFG.cardDoor) +
        '" data-floor="' +
        p.id +
        '" data-wall="' +
        CARD_WALL +
        '"></div><canvas class="loupe" data-floor="' +
        p.id +
        '" data-mm="420"></canvas>';
    }
    const meta = isDoor
      ? [p.cover, p.glass ? "стекло" : "", p.style].filter(Boolean).join(" · ")
      : p.class + " класс · " + p.thickness + " мм · " + bevelName(p.bevel);
    const sw = isDoor
      ? '<div class="swatch-row">' +
        p.finishes
          .slice(0, 5)
          .map((f) => '<img src="' + T.swatchURL(f, 32) + '" alt="" title="' + esc(f.name) + '" />')
          .join("") +
        "<span>" +
        p.finishes.length +
        " " +
        plural(p.finishes.length, "цвет", "цвета", "цветов") +
        "</span></div>"
      : '<div class="swatch-row"><span>' +
        esc(p.collection) +
        " · " +
        patternName(p) +
        "</span></div>";
    const price = isDoor
      ? "<b>" +
        money(p.price) +
        "</b>" +
        (p.oldPrice > p.price ? "<s>" + money(p.oldPrice) + "</s>" : "") +
        "<small>" +
        (p.kind === "entrance" ? "с коробкой" : "за полотно") +
        "</small>"
      : "<b>" + money(p.price) + "</b><small>за м² · упаковка " + money(p.packPrice) + "</small>";
    const btn = isDoor
      ? '<button class="add" data-act="quick-add" data-id="' +
        p.id +
        '" aria-label="Добавить «' +
        esc(p.name) +
        '» в заявку">' +
        icon("plus") +
        "</button>"
      : '<a class="add" href="#' +
        p.id +
        '" aria-label="Рассчитать «' +
        esc(p.name) +
        '»">' +
        icon("calc") +
        "</a>";
    return (
      '<article class="card glass-soft card-' +
      (isDoor ? "door ajar-on-hover" : "lam") +
      '">' +
      '<div class="card-media">' +
      media +
      "</div>" +
      '<div class="card-tags">' +
      tagsHTML(p) +
      "</div>" +
      '<button class="fav" data-act="fav" data-id="' +
      p.id +
      '" aria-pressed="' +
      state.fav.has(p.id) +
      '" aria-label="В избранное">' +
      icon("heart") +
      "</button>" +
      '<div class="card-body">' +
      sw +
      '<h3 class="card-title"><a href="#' +
      p.id +
      '">' +
      esc(p.name) +
      "</a></h3>" +
      '<p class="card-meta">' +
      esc(meta) +
      "</p>" +
      '<div class="card-foot"><div class="price">' +
      price +
      "</div>" +
      btn +
      "</div></div></article>"
    );
  }

  function popular(list) {
    const hit = list.filter((p) => p.badge === "Хит");
    const rest = list.filter((p) => p.badge !== "Хит");
    return hit.concat(rest);
  }

  /* ------------------------------------------------------------------ калькулятор */

  function calcDefaults(l) {
    return {
      lam: l.id,
      mode: "area",
      area: "18",
      len: "4,5",
      wid: "4",
      reserve: l.pattern === "herringbone" ? 10 : 5,
      underlay: true,
      plinth: true,
    };
  }

  function calc(l, st) {
    let area;
    let perim;
    if (st.mode === "dims") {
      const a = parseNum(st.len);
      const b = parseNum(st.wid);
      area = a * b;
      perim = 2 * (a + b);
    } else {
      area = parseNum(st.area);
      perim = 4 * Math.sqrt(area);
    }
    if (!(area > 0)) return null;
    const need = area * (1 + st.reserve / 100);
    const packs = Math.ceil(need / l.packM2 - 1e-9);
    const m2 = packs * l.packM2;
    const lamSum = m2 * l.price;
    const under = st.underlay ? Math.ceil(area) : 0;
    const plinth = st.plinth ? Math.ceil((perim * 1.05) / 2.5) : 0;
    return {
      area: Math.round(area * 100) / 100,
      need,
      packs,
      m2,
      lamSum,
      under,
      underSum: under * CFG.underlay.price,
      plinth,
      plinthSum: plinth * CFG.plinth.price,
      total: lamSum + under * CFG.underlay.price + plinth * CFG.plinth.price,
      estimated: st.mode !== "dims",
    };
  }

  function calcForm(key, st, withSelect) {
    const l = lamById(st.lam);
    return (
      '<div class="calc-form">' +
      (withSelect
        ? '<label class="label">Ламинат<select class="field" data-calc="' +
          key +
          '" data-k="lam">' +
          LAMS.map(
            (x) =>
              '<option value="' +
              x.id +
              '"' +
              (x.id === st.lam ? " selected" : "") +
              ">" +
              esc(x.name) +
              " — " +
              money(x.price) +
              "/м²</option>",
          ).join("") +
          "</select></label>"
        : "") +
      '<div class="seg" role="tablist" aria-label="Как считать">' +
      '<button role="tab" data-act="calc-mode" data-calc="' +
      key +
      '" data-v="area" aria-selected="' +
      (st.mode === "area") +
      '">Площадь, м²</button>' +
      '<button role="tab" data-act="calc-mode" data-calc="' +
      key +
      '" data-v="dims" aria-selected="' +
      (st.mode === "dims") +
      '">Длина × ширина, м</button></div>' +
      '<div class="calc-inputs">' +
      (st.mode === "area"
        ? '<label class="label">Площадь комнаты, м²<input class="field num" inputmode="decimal" autocomplete="off" id="' +
          key +
          '-area" data-calc="' +
          key +
          '" data-k="area" value="' +
          esc(st.area) +
          '" /></label>'
        : '<div class="two"><label class="label">Длина, м<input class="field num" inputmode="decimal" autocomplete="off" id="' +
          key +
          '-len" data-calc="' +
          key +
          '" data-k="len" value="' +
          esc(st.len) +
          '" /></label><label class="label">Ширина, м<input class="field num" inputmode="decimal" autocomplete="off" id="' +
          key +
          '-wid" data-calc="' +
          key +
          '" data-k="wid" value="' +
          esc(st.wid) +
          '" /></label></div>') +
      "</div>" +
      '<label class="label">Запас на подрезку<select class="field" data-calc="' +
      key +
      '" data-k="reserve">' +
      [
        [5, "5% — прямая укладка"],
        [10, "10% — по диагонали или ёлочкой"],
        [15, "15% — комната сложной формы"],
      ]
        .map(
          (o) =>
            '<option value="' +
            o[0] +
            '"' +
            (+st.reserve === o[0] ? " selected" : "") +
            ">" +
            o[1] +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      '<label class="check"><input type="checkbox" data-calc="' +
      key +
      '" data-k="underlay"' +
      (st.underlay ? " checked" : "") +
      " /><span>" +
      esc(CFG.underlay.name) +
      "<small>" +
      money(CFG.underlay.price) +
      " за м²</small></span></label>" +
      '<label class="check"><input type="checkbox" data-calc="' +
      key +
      '" data-k="plinth"' +
      (st.plinth ? " checked" : "") +
      " /><span>" +
      esc(CFG.plinth.name) +
      "<small>" +
      money(CFG.plinth.price) +
      " за штуку</small></span></label>" +
      '<p class="hint">Упаковка: ' +
      l.pack.pcs +
      " " +
      plural(l.pack.pcs, "доска", "доски", "досок") +
      ' · <span class="mono">' +
      num(l.packM2, 3) +
      " м²</span> · " +
      money(l.packPrice) +
      "</p></div>"
    );
  }

  function calcOut(key, st) {
    const l = lamById(st.lam);
    const c = calc(l, st);
    if (!c) {
      return '<p class="hint">Впишите площадь комнаты — посчитаем упаковки, подложку и плинтус.</p>';
    }
    const row = (a, b) => '<div class="calc-row"><span>' + a + "</span><b>" + b + "</b></div>";
    return (
      row("Площадь пола", num(c.area) + " м²") +
      row("С запасом " + st.reserve + "%", num(c.need) + " м²") +
      row("Упаковок ламината", c.packs + " уп. · " + num(c.m2) + " м²") +
      row("Ламинат", money(c.lamSum)) +
      (c.under ? row("Подложка, " + c.under + " м²", money(c.underSum)) : "") +
      (c.plinth
        ? row(
            "Плинтус, " + c.plinth + " шт" + (c.estimated ? " (примерно)" : ""),
            money(c.plinthSum),
          )
        : "") +
      '<div class="calc-total"><span>Итого</span><b>' +
      money(c.total) +
      "</b></div>" +
      '<button class="btn btn-primary btn-block" data-act="calc-add" data-calc="' +
      key +
      '">' +
      icon("list") +
      "Добавить в заявку</button>"
    );
  }

  function refreshCalc(key) {
    const out = $('[data-calc-out="' + key + '"]');
    if (out) out.innerHTML = calcOut(key, calcState[key]);
  }

  /* ------------------------------------------------------------------ главная */

  const FIT_TABS = [
    { id: "door", label: "Дверь" },
    { id: "finish", label: "Цвет двери" },
    { id: "floor", label: "Пол" },
    { id: "wall", label: "Стены" },
  ];

  function stageTag() {
    const d = doorById(vis.door);
    const f = d.finishes[vis.finish] || d.finishes[0];
    const l = lamById(vis.floor);
    return (
      '<a href="#' +
      d.id +
      '"><b>' +
      esc(d.name) +
      "</b> · " +
      esc(f.name) +
      " · от " +
      money(d.price) +
      "</a>" +
      '<a href="#' +
      l.id +
      '"><b>' +
      esc(l.name) +
      "</b> · " +
      money(l.price) +
      "/м²</a>"
    );
  }

  function fitStrip() {
    if (vis.tab === "door") {
      return DOORS.map(
        (d) =>
          '<button class="chip chip-door" data-act="vis-door" data-id="' +
          d.id +
          '" aria-pressed="' +
          (d.id === vis.door) +
          '"><canvas data-door="' +
          d.id +
          '" data-pad="0.02"></canvas><span>' +
          esc(d.name) +
          "</span></button>",
      ).join("");
    }
    if (vis.tab === "finish") {
      const d = doorById(vis.door);
      return d.finishes
        .map(
          (f, i) =>
            '<button class="chip" data-act="vis-finish" data-i="' +
            i +
            '" aria-pressed="' +
            (i === vis.finish) +
            '"><img src="' +
            T.swatchURL(f, 88) +
            '" alt="" /><span>' +
            esc(f.name) +
            "</span></button>",
        )
        .join("");
    }
    if (vis.tab === "floor") {
      return LAMS.map(
        (l) =>
          '<button class="chip" data-act="vis-floor" data-id="' +
          l.id +
          '" aria-pressed="' +
          (l.id === vis.floor) +
          '"><canvas class="round" data-floor="' +
          l.id +
          '" data-mm="700"></canvas><span>' +
          esc(l.name) +
          "</span></button>",
      ).join("");
    }
    return WALLS.map(
      (w, i) =>
        '<button class="chip" data-act="vis-wall" data-i="' +
        i +
        '" aria-pressed="' +
        (i === vis.wall) +
        '"><i style="background:' +
        w.color +
        '"></i><span>' +
        esc(w.name) +
        "</span></button>",
    ).join("");
  }

  function saveVis() {
    store.set("vis", vis);
  }

  function refreshFitting() {
    for (const b of $$('#fitting [data-act="fit-tab"]'))
      b.setAttribute("aria-selected", b.dataset.tab === vis.tab);
    const strip = $("#fitStrip");
    if (!strip) return;
    strip.innerHTML = fitStrip();
    hydrate(strip);
    const on = $('[aria-pressed="true"]', strip);
    if (on)
      strip.scrollLeft = Math.max(0, on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2);
    const tag = $("#stageTag");
    if (tag) tag.innerHTML = stageTag();
  }

  function catCard(href, title, list, sceneAttrs, note) {
    const min = list.length
      ? Math.min.apply(
          null,
          list.map((p) => p.price),
        )
      : 0;
    return (
      '<a class="cat glass-soft" href="#' +
      href +
      '"><div class="cat-media"><div ' +
      sceneAttrs +
      "></div></div>" +
      '<div class="cat-body"><div><h3>' +
      title +
      "</h3><p>" +
      list.length +
      " " +
      plural(list.length, "модель", "модели", "моделей") +
      " · от " +
      money(min) +
      (note || "") +
      '</p></div><span class="go">' +
      icon("arrow") +
      "</span></div></a>"
    );
  }

  function renderHome() {
    const interior = DOORS.filter((d) => d.kind === "interior");
    const entrance = DOORS.filter((d) => d.kind === "entrance");
    const finishes = new Set();
    for (const d of DOORS) for (const f of d.finishes) finishes.add(f.name);
    const d = doorById(vis.door);
    const l = lamById(vis.floor);
    const calcKey = "home";
    if (!calcState[calcKey]) calcState[calcKey] = calcDefaults(lamById(vis.floor));
    const hitDoors = popular(DOORS).slice(0, 4);
    const hitLams = popular(LAMS).slice(0, 4);
    const entranceDoor = entrance[0] || d;
    const steps = [
      ["Заявка", "Позвоните, напишите в WhatsApp или соберите заявку прямо на сайте."],
      ["Замер", "Мастер приезжает, измеряет проёмы и площадь комнат."],
      ["Подбор и расчёт", "Подбираем двери и ламинат, считаем комплект и итоговую сумму."],
      ["Доставка и монтаж", "Привозим, устанавливаем двери, укладываем пол и убираем мусор."],
    ];

    app.innerHTML =
      '<section class="wrap hero">' +
      '<div class="hero-copy">' +
      '<p class="eyebrow">' +
      esc([CFG.city, "салон дверей и ламината"].filter(Boolean).join(" · ")) +
      "</p>" +
      '<h1 class="display">' +
      esc(CFG.heroTitle || CFG.tagline) +
      (CFG.heroSubtitle ? " <span>" + esc(CFG.heroSubtitle) + "</span>" : "") +
      "</h1>" +
      (CFG.heroText ? '<p class="lead">' + esc(CFG.heroText) + "</p>" : "") +
      '<div class="hero-cta"><a class="btn btn-primary" href="#doors">Каталог дверей' +
      icon("arrow") +
      '</a><a class="btn btn-glass" href="#laminate">Ламинат</a></div>' +
      '<dl class="hero-facts">' +
      '<div><dt class="num">' +
      DOORS.length +
      "</dt><dd>" +
      plural(DOORS.length, "модель", "модели", "моделей") +
      " дверей</dd></div>" +
      '<div><dt class="num">' +
      LAMS.length +
      "</dt><dd>" +
      plural(LAMS.length, "вид", "вида", "видов") +
      " ламината</dd></div>" +
      '<div><dt class="num">' +
      finishes.size +
      "</dt><dd>" +
      plural(finishes.size, "цвет", "цвета", "цветов") +
      " отделки</dd></div>" +
      "</dl></div>" +
      '<div class="hero-stage">' +
      '<div class="stage"><div class="hero-scene" id="heroScene"></div>' +
      '<div class="stage-tag glass veil" id="stageTag">' +
      stageTag() +
      "</div>" +
      '<button class="btn btn-glass veil stage-open" data-act="vis-open" aria-pressed="' +
      vis.open +
      '">' +
      icon("open") +
      "<span>" +
      (vis.open ? "Закрыть дверь" : "Открыть дверь") +
      "</span></button></div>" +
      '<div class="fitting glass veil" id="fitting"><div class="seg" role="tablist" aria-label="Примерочная">' +
      FIT_TABS.map(
        (t) =>
          '<button role="tab" data-act="fit-tab" data-tab="' +
          t.id +
          '" aria-selected="' +
          (t.id === vis.tab) +
          '">' +
          t.label +
          "</button>",
      ).join("") +
      '</div><div class="strip" id="fitStrip">' +
      fitStrip() +
      "</div></div></div></section>" +
      // категории
      '<section class="wrap section"><div class="section-head"><div><p class="eyebrow">Каталог</p><h2 class="h2">Что есть в салоне</h2></div></div><div class="cats">' +
      catCard(
        "doors-interior",
        "Межкомнатные двери",
        interior,
        'data-scene="card-door" data-door="' +
          (interior[0] ? interior[0].id : d.id) +
          '" data-floor="' +
          l.id +
          '" data-wall="#D9CFC2" data-open="1"',
      ) +
      catCard(
        "doors-entrance",
        "Входные двери",
        entrance,
        'data-scene="card-door" data-door="' +
          entranceDoor.id +
          '" data-floor="lam-fog" data-wall="#C9C4BD"',
      ) +
      catCard(
        "laminate",
        "Ламинат",
        LAMS,
        'data-scene="card-floor" data-door="' +
          esc(CFG.cardDoor) +
          '" data-floor="' +
          (LAMS[6] || LAMS[0]).id +
          '" data-wall="#E2DCD3"',
        " за м²",
      ) +
      "</div></section>" +
      // популярные
      '<section class="wrap section"><div class="section-head"><div><p class="eyebrow">Двери</p><h2 class="h2">Популярные модели</h2></div><a class="link" href="#doors">Все двери' +
      icon("arrow") +
      '</a></div><div class="grid grid-4">' +
      hitDoors.map(card).join("") +
      "</div></section>" +
      '<section class="wrap section"><div class="section-head"><div><p class="eyebrow">Ламинат</p><h2 class="h2">Чаще всего берут</h2></div><a class="link" href="#laminate">Весь ламинат' +
      icon("arrow") +
      '</a></div><div class="grid grid-4">' +
      hitLams.map(card).join("") +
      "</div></section>" +
      // услуги
      '<section class="wrap section"><div class="section-head"><div><p class="eyebrow">Под ключ</p><h2 class="h2">Не только продаём</h2></div></div><div class="services">' +
      CFG.services
        .map(
          (s) =>
            '<div class="service glass-soft">' +
            icon(s.icon) +
            "<h3>" +
            esc(s.title) +
            "</h3><p>" +
            esc(s.text) +
            "</p></div>",
        )
        .join("") +
      "</div></section>" +
      // калькулятор
      '<section class="wrap section" id="calc"><div class="section-head"><div><p class="eyebrow">Калькулятор</p><h2 class="h2">Сколько нужно ламината</h2><p>Посчитаем упаковки с запасом на подрезку, подложку и плинтус. Цены — по каталогу.</p></div></div>' +
      '<div class="calc glass" data-calc-box="' +
      calcKey +
      '">' +
      calcForm(calcKey, calcState[calcKey], true) +
      '<div class="calc-out" data-calc-out="' +
      calcKey +
      '">' +
      calcOut(calcKey, calcState[calcKey]) +
      "</div></div></section>" +
      // шаги
      '<section class="wrap section"><div class="section-head"><div><p class="eyebrow">Порядок работы</p><h2 class="h2">Как мы работаем</h2></div></div><ol class="steps">' +
      steps
        .map((s) => '<li class="step glass-soft"><h3>' + s[0] + "</h3><p>" + s[1] + "</p></li>")
        .join("") +
      "</ol></section>" +
      visitBlock();

    hydrate(app);
    heroScene = new R.Scene($("#heroScene"), {
      preset: "hero",
      door: d,
      finish: vis.finish,
      floor: l,
      wall: WALLS[vis.wall].color,
      onReady: (s) => {
        if (vis.open) setTimeout(() => s.setOpen(true), 450);
      },
    });
    const on = $('#fitStrip [aria-pressed="true"]');
    if (on) $("#fitStrip").scrollLeft = Math.max(0, on.offsetLeft - 60);
    return { title: CFG.name + " — " + CFG.tagline + (CFG.city ? ", " + CFG.city : "") };
  }

  function contactList() {
    return (
      '<dl class="info-list">' +
      (CFG.address
        ? "<div>" +
          icon("pin") +
          "<span><dt>Адрес</dt><dd>" +
          esc(CFG.address) +
          "</dd></span></div>"
        : "") +
      (CFG.hours && CFG.hours.length
        ? "<div>" +
          icon("clock") +
          '<span><dt>Часы работы</dt><dd class="hours">' +
          CFG.hours
            .map((h) => "<span>" + esc(h[0]) + "</span><span>" + esc(h[1]) + "</span>")
            .join("") +
          "</dd></span></div>"
        : "") +
      (CFG.phone
        ? "<div>" +
          icon("phone") +
          '<span><dt>Телефон</dt><dd><a href="' +
          telHref() +
          '">' +
          esc(CFG.phone) +
          "</a></dd></span></div>"
        : "") +
      "</dl>"
    );
  }

  function contactButtons() {
    return (
      '<div class="actions">' +
      '<a class="btn btn-primary" href="' +
      waHref("Здравствуйте! Пишу с сайта «" + CFG.name + "».") +
      '" target="_blank" rel="noopener">' +
      icon("wa") +
      "Написать в WhatsApp</a>" +
      (CFG.telegram
        ? '<a class="btn btn-glass" href="https://t.me/' +
          esc(CFG.telegram) +
          '" target="_blank" rel="noopener">' +
          icon("tg") +
          "Telegram</a>"
        : "") +
      (CFG.instagram
        ? '<a class="btn btn-glass" href="https://instagram.com/' +
          esc(CFG.instagram) +
          '" target="_blank" rel="noopener">' +
          icon("ig") +
          "Instagram</a>"
        : "") +
      (CFG.mapUrl
        ? '<a class="btn btn-glass" href="' +
          esc(CFG.mapUrl) +
          '" target="_blank" rel="noopener">' +
          icon("pin") +
          "На карте</a>"
        : "") +
      "</div>"
    );
  }

  function visitBlock() {
    const door = doorById(CFG.cardDoor);
    return (
      '<section class="wrap section"><div class="visit glass">' +
      '<div class="visit-copy"><p class="eyebrow">Салон</p><h2 class="h2">Приезжайте посмотреть вживую</h2><p class="muted">' +
      esc(CFG.about) +
      "</p>" +
      contactList() +
      contactButtons() +
      "</div>" +
      '<div class="visit-scene"><div data-scene="product" data-door="' +
      door.id +
      '" data-floor="' +
      esc(CFG.cardFloor) +
      '" data-wall="#CDBFAE" data-open="1"></div></div>' +
      "</div></section>"
    );
  }

  /* ------------------------------------------------------------------ каталог */

  function countBy(list, fn) {
    const m = new Map();
    for (const p of list) {
      const v = fn(p);
      if (v === undefined || v === null || v === "") continue;
      m.set(v, (m.get(v) || 0) + 1);
    }
    return Array.from(m.entries());
  }

  function checks(cat, key, entries, labeler) {
    const set = F[cat][key];
    return entries
      .map(
        ([v, n]) =>
          '<label class="check"><input type="checkbox" data-f="' +
          key +
          '" data-cat="' +
          cat +
          '" value="' +
          esc(v) +
          '"' +
          (set.has(String(v)) ? " checked" : "") +
          " /><span>" +
          esc(labeler ? labeler(v) : v) +
          '</span><span class="cnt">' +
          n +
          "</span></label>",
      )
      .join("");
  }

  function doorFilters() {
    const f = F.door;
    const pool = f.kind ? DOORS.filter((d) => d.kind === f.kind) : DOORS;
    const prices = pool.map((p) => p.price);
    return (
      '<div class="filters-head"><h2>Фильтры</h2><button class="icon-btn" data-act="filters-close" aria-label="Закрыть фильтры">' +
      icon("close") +
      "</button></div>" +
      '<div class="f-group"><div class="f-title">Цвет</div><div class="tones">' +
      Object.keys(TONES)
        .filter((k) => pool.some((p) => p.finishes.some((x) => toneOf(x) === k)))
        .map(
          (k) =>
            '<button type="button" class="tone" data-act="tone" data-cat="door" data-v="' +
            k +
            '" aria-pressed="' +
            f.tone.has(k) +
            '"><i style="background:' +
            TONES[k].color +
            '"></i>' +
            TONES[k].name +
            "</button>",
        )
        .join("") +
      "</div></div>" +
      '<div class="f-group"><div class="f-title">Стиль</div>' +
      checks(
        "door",
        "style",
        countBy(pool, (p) => p.style),
      ) +
      "</div>" +
      '<div class="f-group"><div class="f-title">Покрытие</div>' +
      checks(
        "door",
        "cover",
        countBy(pool, (p) => p.cover),
      ) +
      "</div>" +
      '<div class="f-group"><div class="f-title">Стекло</div>' +
      [
        ["all", "Все"],
        ["yes", "Со стеклом"],
        ["no", "Глухие"],
      ]
        .map(
          (o) =>
            '<label class="check"><input type="radio" name="glass" data-f="glass" data-cat="door" value="' +
            o[0] +
            '"' +
            (f.glass === o[0] ? " checked" : "") +
            " /><span>" +
            o[1] +
            "</span></label>",
        )
        .join("") +
      "</div>" +
      priceFilter("door", prices) +
      '<div class="f-group"><label class="check"><input type="checkbox" data-f="stock" data-cat="door"' +
      (f.stock ? " checked" : "") +
      " /><span>Только в наличии</span></label></div>" +
      '<div class="f-group"><button class="btn btn-glass btn-sm" data-act="filters-reset" data-cat="door">Сбросить фильтры</button></div>' +
      '<div class="filters-foot"><button class="btn btn-primary btn-block" data-act="filters-close" id="fShow">Показать</button></div>'
    );
  }

  function priceFilter(cat, prices) {
    const f = F[cat];
    const mn = prices.length ? Math.min.apply(null, prices) : 0;
    const mx = prices.length ? Math.max.apply(null, prices) : 0;
    return (
      '<div class="f-group"><div class="f-title">Цена' +
      (cat === "lam" ? " за м²" : "") +
      ", " +
      esc(CFG.currency) +
      '</div><div class="range">' +
      '<input class="field num" inputmode="numeric" aria-label="Цена от" data-f="min" data-cat="' +
      cat +
      '" placeholder="от ' +
      mn +
      '" value="' +
      esc(f.min) +
      '" />' +
      '<input class="field num" inputmode="numeric" aria-label="Цена до" data-f="max" data-cat="' +
      cat +
      '" placeholder="до ' +
      mx +
      '" value="' +
      esc(f.max) +
      '" /></div></div>'
    );
  }

  function lamFilters() {
    const f = F.lam;
    return (
      '<div class="filters-head"><h2>Фильтры</h2><button class="icon-btn" data-act="filters-close" aria-label="Закрыть фильтры">' +
      icon("close") +
      "</button></div>" +
      '<div class="f-group"><div class="f-title">Тон</div><div class="tones">' +
      Object.keys(TONE_L)
        .filter((k) => LAMS.some((p) => p.tone === k))
        .map(
          (k) =>
            '<button type="button" class="tone" data-act="tone" data-cat="lam" data-v="' +
            k +
            '" aria-pressed="' +
            f.tone.has(k) +
            '"><i style="background:' +
            TONE_L[k].color +
            '"></i>' +
            TONE_L[k].name +
            "</button>",
        )
        .join("") +
      "</div></div>" +
      '<div class="f-group"><div class="f-title">Класс</div>' +
      checks(
        "lam",
        "cls",
        countBy(LAMS, (p) => String(p.class)).sort(),
        (v) => v + " класс (" + (AC[v] || "") + ")",
      ) +
      "</div>" +
      '<div class="f-group"><div class="f-title">Толщина</div>' +
      checks(
        "lam",
        "thick",
        countBy(LAMS, (p) => String(p.thickness)).sort((a, b) => a[0] - b[0]),
        (v) => v + " мм",
      ) +
      "</div>" +
      '<div class="f-group"><div class="f-title">Рисунок</div>' +
      checks(
        "lam",
        "pattern",
        countBy(LAMS, (p) => p.pattern),
        (v) => ({ plank: "Доска", herringbone: "Ёлочка", tile: "Плитка, камень" })[v] || v,
      ) +
      "</div>" +
      '<div class="f-group"><div class="f-title">Фаска</div>' +
      checks(
        "lam",
        "bevel",
        countBy(LAMS, (p) => p.bevel),
        (v) =>
          ({ "4V": "С четырёх сторон (4V)", "2V": "По длинным сторонам (2V)", none: "Без фаски" })[
            v
          ] || v,
      ) +
      "</div>" +
      priceFilter(
        "lam",
        LAMS.map((p) => p.price),
      ) +
      '<div class="f-group"><label class="check"><input type="checkbox" data-f="water" data-cat="lam"' +
      (f.water ? " checked" : "") +
      " /><span>Влагостойкий</span></label>" +
      '<label class="check"><input type="checkbox" data-f="stock" data-cat="lam"' +
      (f.stock ? " checked" : "") +
      " /><span>Только в наличии</span></label></div>" +
      '<div class="f-group"><button class="btn btn-glass btn-sm" data-act="filters-reset" data-cat="lam">Сбросить фильтры</button></div>' +
      '<div class="filters-foot"><button class="btn btn-primary btn-block" data-act="filters-close" id="fShow">Показать</button></div>'
    );
  }

  function filtered(cat) {
    const f = F[cat];
    const min = f.min === "" ? -Infinity : parseNum(f.min);
    const max = f.max === "" ? Infinity : parseNum(f.max) || Infinity;
    if (cat === "door") {
      return DOORS.filter(
        (p) =>
          (!f.kind || p.kind === f.kind) &&
          (!f.style.size || f.style.has(p.style)) &&
          (!f.cover.size || f.cover.has(p.cover)) &&
          (f.glass === "all" || (f.glass === "yes" ? !!p.glass : !p.glass)) &&
          (!f.tone.size || p.finishes.some((x) => f.tone.has(toneOf(x)))) &&
          p.price >= min &&
          p.price <= max &&
          (!f.stock || p.inStock),
      );
    }
    return LAMS.filter(
      (p) =>
        (!f.cls.size || f.cls.has(String(p.class))) &&
        (!f.thick.size || f.thick.has(String(p.thickness))) &&
        (!f.tone.size || f.tone.has(p.tone)) &&
        (!f.pattern.size || f.pattern.has(p.pattern)) &&
        (!f.bevel.size || f.bevel.has(p.bevel)) &&
        (!f.water || p.water) &&
        p.price >= min &&
        p.price <= max &&
        (!f.stock || p.inStock),
    );
  }

  function sorted(list, how) {
    const a = list.slice();
    if (how === "cheap") a.sort((x, y) => x.price - y.price);
    else if (how === "dear") a.sort((x, y) => y.price - x.price);
    else if (how === "new") a.sort((x, y) => (y.badge === "Новинка") - (x.badge === "Новинка"));
    else if (how === "sale") a.sort((x, y) => (y.oldPrice > y.price) - (x.oldPrice > x.price));
    else return popular(a);
    return a;
  }

  function activeFilters(cat) {
    const f = F[cat];
    let n = 0;
    for (const k in f) {
      const v = f[k];
      if (k === "kind") continue;
      if (v instanceof Set) n += v.size;
      else if (k === "glass") n += v !== "all" ? 1 : 0;
      else if (v) n += 1;
    }
    return n;
  }

  function updateGrid(cat) {
    const list = sorted(filtered(cat), SORT[cat]);
    const grid = $("#grid");
    if (!grid) return;
    const word =
      cat === "door"
        ? plural(list.length, "модель", "модели", "моделей")
        : plural(list.length, "вид", "вида", "видов");
    grid.innerHTML = list.length
      ? list.map(card).join("")
      : '<div class="empty glass-soft" style="grid-column: 1 / -1"><h3>Ничего не нашлось</h3><p>Попробуйте убрать часть фильтров.</p><button class="btn btn-glass" data-act="filters-reset" data-cat="' +
        cat +
        '">Сбросить фильтры</button></div>';
    $("#catCount").textContent = list.length + " " + word;
    const show = $("#fShow");
    if (show)
      show.textContent = list.length ? "Показать " + list.length + " " + word : "Ничего не найдено";
    const n = activeFilters(cat);
    const fc = $("#fCount");
    if (fc) fc.textContent = n ? "· " + n : "";
    hydrate(grid);
  }

  function renderCatalog(cat, kind) {
    const isDoor = cat === "door";
    if (isDoor) F.door.kind = kind || null;
    const title = isDoor
      ? kind === "interior"
        ? "Межкомнатные двери"
        : kind === "entrance"
          ? "Входные двери"
          : "Двери"
      : "Ламинат";
    const segs = isDoor
      ? '<div class="seg seg-links">' +
        [
          ["doors", "Все двери"],
          ["doors-interior", "Межкомнатные"],
          ["doors-entrance", "Входные"],
        ]
          .map(
            (s) =>
              '<a href="#' +
              s[0] +
              '"' +
              ((kind ? "doors-" + kind : "doors") === s[0] ? ' aria-current="page"' : "") +
              ">" +
              s[1] +
              "</a>",
          )
          .join("") +
        "</div>"
      : "";
    app.innerHTML =
      '<section class="wrap page-head"><nav class="crumbs" aria-label="Путь"><a href="#">Главная</a>' +
      icon("chev") +
      "<span>" +
      title +
      '</span></nav><div class="page-title"><h1>' +
      title +
      '</h1><span id="catCount"></span></div>' +
      segs +
      "</section>" +
      '<section class="wrap catalog"><aside class="filters glass" id="filters" aria-label="Фильтры">' +
      (isDoor ? doorFilters() : lamFilters()) +
      "</aside>" +
      '<div class="catalog-main"><div class="toolbar glass-soft">' +
      '<button class="btn btn-glass btn-sm filter-btn" data-act="filters-open">' +
      icon("filter") +
      'Фильтры <span id="fCount"></span></button>' +
      '<label class="sort">Сортировка<select class="field" id="sort" data-cat="' +
      cat +
      '">' +
      [
        ["popular", "Сначала популярные"],
        ["cheap", "Сначала дешевле"],
        ["dear", "Сначала дороже"],
        ["new", "Сначала новинки"],
        ["sale", "Сначала со скидкой"],
      ]
        .map(
          (o) =>
            '<option value="' +
            o[0] +
            '"' +
            (SORT[cat] === o[0] ? " selected" : "") +
            ">" +
            o[1] +
            "</option>",
        )
        .join("") +
      "</select></label></div>" +
      '<div class="grid" id="grid"></div></div></section>';
    updateGrid(cat);
    return {
      title: title + " — " + CFG.name,
      desc: isDoor
        ? "Каталог дверей с ценами: " +
          DOORS.length +
          " моделей, фильтры по цвету, стилю и покрытию."
        : "Ламинат с ценами за м²: " + LAMS.length + " видов, калькулятор упаковок.",
    };
  }

  /* ------------------------------------------------------------------ товар */

  function crumbs(parts) {
    return (
      '<nav class="crumbs" aria-label="Путь"><a href="#">Главная</a>' +
      parts
        .map(
          (p) =>
            icon("chev") +
            (p[1]
              ? '<a href="#' + p[1] + '">' + esc(p[0]) + "</a>"
              : "<span>" + esc(p[0]) + "</span>"),
        )
        .join("") +
      "</nav>"
    );
  }

  function specTable(rows) {
    return (
      '<dl class="spec">' +
      rows
        .filter((r) => r && r[1] !== undefined && r[1] !== "")
        .map((r) => "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>")
        .join("") +
      "</dl>"
    );
  }

  function parseSize(s) {
    const m = String(s).match(/(\d+)\D+(\d+)/);
    return m ? [+m[1], +m[2]] : [800, 2000];
  }

  function openingFor(p, s) {
    const [w, h] = parseSize(s);
    if (p.kind === "entrance") return w + 20 + "–" + (w + 40) + " × " + (h + 20) + "–" + (h + 40);
    return w + 70 + "–" + (w + 90) + " × " + (h + 60) + "–" + (h + 80);
  }

  function galleryTabs(tabs) {
    return (
      '<div class="g-tabs" role="tablist" aria-label="Виды">' +
      tabs
        .map(
          (t, i) =>
            '<button class="g-tab" role="tab" data-act="view" data-view="' +
            t.id +
            '" aria-selected="' +
            (i === 0) +
            '">' +
            t.thumb +
            t.label +
            "</button>",
        )
        .join("") +
      "</div>"
    );
  }

  function photoViews(p) {
    return (p.photos || [])
      .map(
        (src, i) =>
          '<div class="g-view" data-view="photo' +
          i +
          '"><img src="' +
          esc(src) +
          '" alt="' +
          esc(p.name) +
          ", фото " +
          (i + 1) +
          '" loading="lazy" /></div>',
      )
      .join("");
  }

  function photoTabs(p) {
    return (p.photos || []).map((src, i) => ({
      id: "photo" + i,
      label: "Фото " + (i + 1),
      thumb: '<img src="' + esc(src) + '" alt="" />',
    }));
  }

  function renderDoor(p) {
    const st = {
      finish: 0,
      size: defaultSize(p),
      hinge: "left",
      kit: p.kit.filter((k) => k.default).map((k) => k.id),
      qty: 1,
      floor: CFG.cardFloor,
    };
    page = { type: "door", p, st };
    const f = p.finishes[0];
    const kindHash = p.kind === "entrance" ? "doors-entrance" : "doors-interior";
    const kindName = p.kind === "entrance" ? "Входные" : "Межкомнатные";
    const tabs = [
      { id: "room", label: "В интерьере", thumb: icon("sofa") },
      { id: "leaf", label: "Полотно", thumb: icon("door") },
    ];
    if (p.finishes.length > 1)
      tabs.push({ id: "colors", label: "Все цвета", thumb: icon("palette") });
    const specs = [
      ["Тип", p.typeName],
      ["Стиль", p.style],
      ["Покрытие", p.cover],
      ["Размеры", p.sizes.join(", ") + " мм"],
      ["Остекление", p.glass ? GLASS[p.glass] || p.glass : "Глухая, без стекла"],
      ["Цвета", p.finishes.map((x) => x.name).join(", ")],
      ["Ручка на фото", HANDLES[p.handle] || ""],
    ].concat(p.specs || []);
    const lamPick = LAMS.slice(0, 8);

    app.innerHTML =
      '<div class="wrap product"><div class="page-head">' +
      crumbs([["Двери", "doors"], [kindName, kindHash], [p.name]]) +
      "</div>" +
      '<div class="product-top"><div class="gallery"><div class="g-stage" id="gStage">' +
      '<div class="g-view is-active" data-view="room"><div id="pScene"></div><button class="btn btn-glass veil stage-open" data-act="p-open" aria-pressed="true">' +
      icon("open") +
      "<span>Закрыть дверь</span></button></div>" +
      '<div class="g-view view-plain" data-view="leaf"><canvas id="pLeaf" data-door="' +
      p.id +
      '" data-finish="0" data-pad="0.05"></canvas></div>' +
      (p.finishes.length > 1
        ? '<div class="g-view view-colors" data-view="colors">' +
          p.finishes
            .map(
              (x, i) =>
                '<figure><canvas data-door="' +
                p.id +
                '" data-finish="' +
                i +
                '" data-pad="0"></canvas><figcaption>' +
                esc(x.name) +
                "</figcaption></figure>",
            )
            .join("") +
          "</div>"
        : "") +
      photoViews(p) +
      "</div>" +
      galleryTabs(tabs.concat(photoTabs(p))) +
      '<div class="opt picker"><div class="opt-head"><span>Пол в комнате</span><b id="pFloorName">' +
      esc(lamById(st.floor).name) +
      '</b></div><div class="strip">' +
      lamPick
        .map(
          (l) =>
            '<button class="chip" data-act="p-floor" data-id="' +
            l.id +
            '" aria-pressed="' +
            (l.id === st.floor) +
            '"><canvas class="round" data-floor="' +
            l.id +
            '" data-mm="700"></canvas><span>' +
            esc(l.name) +
            "</span></button>",
        )
        .join("") +
      "</div></div>" +
      descPanel(p) +
      openingPanel(p) +
      "</div>" +
      '<aside class="buy glass">' +
      '<div class="buy-head"><p class="eyebrow">' +
      esc(p.typeName) +
      (p.collection ? " · " + esc(p.collection) : "") +
      "</p><h1>" +
      esc(p.name) +
      '</h1><span class="stock' +
      (p.inStock ? "" : " wait") +
      '">' +
      (p.inStock ? "В наличии" : "Под заказ" + (p.leadTime ? ", " + esc(p.leadTime) : "")) +
      "</span></div>" +
      '<div class="buy-price"><b id="pPrice"></b>' +
      (p.oldPrice > p.price ? "<s>" + money(p.oldPrice) + "</s>" : "") +
      "<span>" +
      (p.kind === "entrance"
        ? "Цена двери с коробкой и замками"
        : "Цена полотна без коробки и фурнитуры") +
      "</span></div>" +
      '<div class="opt"><div class="opt-head"><span>Цвет</span><b id="pFinish">' +
      esc(f.name) +
      '</b></div><div class="swatches">' +
      p.finishes
        .map(
          (x, i) =>
            '<button class="sw" data-act="p-finish" data-i="' +
            i +
            '" aria-pressed="' +
            (i === 0) +
            '" title="' +
            esc(x.name) +
            '"><img src="' +
            T.swatchURL(x, 96) +
            '" alt="' +
            esc(x.name) +
            '" /></button>',
        )
        .join("") +
      "</div></div>" +
      '<div class="opt"><div class="opt-head"><span>' +
      (p.kind === "entrance" ? "Размер коробки" : "Размер полотна") +
      ', мм</span></div><div class="pills">' +
      p.sizes
        .map(
          (s) =>
            '<button class="pill" data-act="p-size" data-v="' +
            esc(s) +
            '" aria-pressed="' +
            (s === st.size) +
            '">' +
            esc(s) +
            (p.sizeExtra[s] ? " +" + num(p.sizeExtra[s], 0) : "") +
            "</button>",
        )
        .join("") +
      '</div><p class="hint" id="pOpening"></p></div>' +
      '<div class="opt"><div class="opt-head"><span>Петли</span></div><div class="pills">' +
      '<button class="pill txt" data-act="p-hinge" data-v="left" aria-pressed="true">Слева</button>' +
      '<button class="pill txt" data-act="p-hinge" data-v="right" aria-pressed="false">Справа</button></div></div>' +
      (p.kit.length
        ? '<div class="opt"><div class="opt-head"><span>' +
          (p.kind === "entrance" ? "Дополнительно" : "Комплект") +
          '</span><b id="pKit"></b></div><div class="kit">' +
          p.kit
            .map(
              (k) =>
                '<label class="check"><input type="checkbox" data-kit value="' +
                esc(k.id) +
                '"' +
                (k.default ? " checked" : "") +
                " /><span>" +
                esc(k.name) +
                (k.note ? "<small>" + esc(k.note) + "</small>" : "") +
                '</span><span class="mono">+' +
                money(k.price) +
                "</span></label>",
            )
            .join("") +
          "</div></div>"
        : "") +
      '<div class="buy-total"><span id="pTotalLabel">Итого</span><b id="pTotal"></b></div>' +
      '<div class="buy-row"><div class="qty"><button data-act="p-qty" data-d="-1" aria-label="Меньше">' +
      icon("minus") +
      '</button><output id="pQty">1</output><button data-act="p-qty" data-d="1" aria-label="Больше">' +
      icon("plus") +
      '</button></div><button class="btn btn-primary" data-act="p-add">' +
      icon("list") +
      "Добавить в заявку</button></div>" +
      '<a class="btn btn-glass btn-block" id="pAsk" target="_blank" rel="noopener">' +
      icon("wa", "wa-ico") +
      "Спросить в WhatsApp</a>" +
      perks() +
      "</aside></div>" +
      specsPanel(specs) +
      '<section class="related"><div class="section-head"><div><p class="eyebrow">Сочетание</p><h2 class="h2">Ламинат к этой двери</h2></div><a class="link" href="#laminate">Весь ламинат' +
      icon("arrow") +
      '</a></div><div class="grid grid-4">' +
      pairLams(p, f).map(card).join("") +
      "</div></section>" +
      '<section class="related"><div class="section-head"><div><p class="eyebrow">Похожие</p><h2 class="h2">Ещё двери</h2></div></div><div class="grid grid-4">' +
      similarDoors(p).map(card).join("") +
      "</div></section></div>";

    pageScene = new R.Scene($("#pScene"), {
      preset: "product",
      door: p,
      finish: 0,
      floor: lamById(st.floor),
      wall: "#D9D1C6",
      onReady: (s) => setTimeout(() => s.setOpen(true), 400),
    });
    hydrate(app);
    renderMbar(doorUnit(p, st));
    refreshDoorBuy();
    return {
      title: p.name + " — " + p.typeName.toLowerCase() + " — " + CFG.name,
      desc: p.description,
    };
  }

  function descPanel(p) {
    return (
      '<section class="panel glass-soft"><h2>Описание</h2><p class="panel-text">' +
      esc(p.description) +
      "</p>" +
      features(p) +
      "</section>"
    );
  }

  function openingPanel(p) {
    const head = p.kind === "entrance" ? "Коробка, мм" : "Полотно, мм";
    const what = p.kind === "entrance" ? "дверь с коробкой" : "полотно с коробкой";
    return (
      '<section class="panel glass-soft"><h2>Какой нужен проём</h2><p class="hint">Проём в стене под ' +
      what +
      '. Точный размер мастер скажет на замере.</p><table class="opening"><thead><tr><th>' +
      head +
      "</th><th>Проём, мм</th></tr></thead><tbody>" +
      p.sizes
        .map((s) => "<tr><td>" + esc(s) + "</td><td>" + openingFor(p, s) + "</td></tr>")
        .join("") +
      "</tbody></table></section>"
    );
  }

  function specsPanel(rows) {
    return (
      '<section class="panel glass-soft specs-panel"><h2>Характеристики</h2>' +
      specTable(rows).replace('<dl class="spec">', '<dl class="spec spec-2">') +
      "</section>"
    );
  }

  function perks() {
    const s = (CFG.services || []).slice(0, 3);
    if (!s.length) return "";
    return (
      '<div class="perks">' +
      s
        .map((x) => '<div class="perk">' + icon(x.icon) + "<span>" + esc(x.title) + "</span></div>")
        .join("") +
      "</div>"
    );
  }

  function features(p) {
    if (!p.features || !p.features.length) return "";
    return (
      '<ul class="features">' +
      p.features.map((x) => "<li>" + icon("check") + "<span>" + esc(x) + "</span></li>").join("") +
      "</ul>"
    );
  }

  function pairLams(p, f) {
    // к светлой двери — тёплый и тёмный пол, к тёмной — светлый
    const light = T.luma(T.hex(f.color)) > 0.55;
    const want = light
      ? ["natural", "dark", "grey", "light"]
      : ["light", "natural", "grey", "dark"];
    const out = [];
    for (const t of want) {
      const x = LAMS.find((l) => l.tone === t && out.indexOf(l) < 0);
      if (x) out.push(x);
    }
    return out.slice(0, 4);
  }

  function similarDoors(p) {
    const same = DOORS.filter(
      (d) => d !== p && d.kind === p.kind && (d.style === p.style || d.cover === p.cover),
    );
    const rest = DOORS.filter((d) => d !== p && d.kind === p.kind && same.indexOf(d) < 0);
    return same.concat(rest).slice(0, 4);
  }

  function refreshDoorBuy() {
    if (!page || page.type !== "door") return;
    const { p, st } = page;
    const unit = doorUnit(p, st);
    const leaf = p.price + ((p.sizeExtra && p.sizeExtra[st.size]) || 0);
    $("#pPrice").textContent = money(leaf);
    const kitSum = p.kit.filter((k) => st.kit.indexOf(k.id) >= 0).reduce((s, k) => s + k.price, 0);
    const kitEl = $("#pKit");
    if (kitEl) kitEl.textContent = kitSum ? "+" + money(kitSum) : "";
    $("#pTotal").textContent = money(unit * st.qty);
    const mp = $("#mbarPrice");
    if (mp) mp.textContent = money(unit * st.qty);
    $("#pTotalLabel").textContent = st.qty > 1 ? "Итого за " + st.qty + " шт." : "Итого за дверь";
    $("#pQty").textContent = st.qty;
    $("#pOpening").innerHTML =
      'Проём в стене: <span class="mono">' + openingFor(p, st.size) + " мм</span>";
    const f = p.finishes[st.finish] || p.finishes[0];
    $("#pFinish").textContent = f.name;
    $("#pAsk").href = waHref(
      "Здравствуйте! Интересует " +
        (p.kind === "entrance" ? "входная дверь" : "дверь") +
        " «" +
        p.name +
        "», " +
        f.name +
        ", " +
        st.size +
        " мм. Есть в наличии?",
    );
  }

  function renderLam(p) {
    const key = "p-" + p.id;
    if (!calcState[key]) calcState[key] = calcDefaults(p);
    calcState[key].lam = p.id;
    const st = { door: CFG.cardDoor };
    page = { type: "lam", p, st, key };
    const tabs = [
      { id: "room", label: "В интерьере", thumb: icon("sofa") },
      {
        id: "close",
        label: "Крупно",
        thumb: '<canvas data-floor="' + p.id + '" data-mm="500"></canvas>',
      },
      { id: "plank", label: "Доска и сечение", thumb: icon("plank") },
    ];
    const specs = [
      ["Класс", p.class + (AC[p.class] ? " (" + AC[p.class] + ")" : "")],
      ["Толщина", p.thickness + " мм"],
      ["Размер доски", p.plank[0] + " × " + p.plank[1] + " мм"],
      [
        "В упаковке",
        p.pack.pcs +
          " шт · " +
          num(p.packM2, 3) +
          " м²" +
          (p.pack.kg ? " · " + num(p.pack.kg, 1) + " кг" : ""),
      ],
      [
        "Фаска",
        { "4V": "С четырёх сторон (4V)", "2V": "По длинным сторонам (2V)" }[p.bevel] || "Нет",
      ],
      ["Влагостойкость", p.water ? "Да" : "Обычная"],
      ["Рисунок", patternName(p)],
      ["Цена упаковки", money(p.packPrice)],
    ].concat(p.specs || []);
    const doorPick = DOORS.filter((d) => d.kind === "interior").slice(0, 8);

    app.innerHTML =
      '<div class="wrap product"><div class="page-head">' +
      crumbs([["Ламинат", "laminate"], [p.name]]) +
      "</div>" +
      '<div class="product-top"><div class="gallery"><div class="g-stage" id="gStage">' +
      '<div class="g-view is-active" data-view="room"><div id="pScene"></div></div>' +
      '<div class="g-view view-plain" data-view="close"><canvas data-floor="' +
      p.id +
      '" data-mm="1100"></canvas></div>' +
      '<div class="g-view view-plank" data-view="plank"><div class="plank-top"><span class="dim-w">' +
      p.plank[0] +
      ' мм</span><canvas data-plank="' +
      p.id +
      '"></canvas><span class="dim-h">' +
      p.plank[1] +
      " мм</span></div>" +
      sectionSVG(p) +
      "</div>" +
      photoViews(p) +
      "</div>" +
      galleryTabs(tabs.concat(photoTabs(p))) +
      '<div class="opt picker"><div class="opt-head"><span>Дверь в комнате</span><b id="pDoorName">' +
      esc(doorById(st.door).name) +
      '</b></div><div class="strip">' +
      doorPick
        .map(
          (d) =>
            '<button class="chip chip-door" data-act="p-door" data-id="' +
            d.id +
            '" aria-pressed="' +
            (d.id === st.door) +
            '"><canvas data-door="' +
            d.id +
            '" data-pad="0.02"></canvas><span>' +
            esc(d.name) +
            "</span></button>",
        )
        .join("") +
      "</div></div>" +
      descPanel(p) +
      "</div>" +
      '<aside class="buy glass"><div class="buy-head"><p class="eyebrow">Ламинат' +
      (p.collection ? " · " + esc(p.collection) : "") +
      "</p><h1>" +
      esc(p.name) +
      '</h1><span class="stock' +
      (p.inStock ? "" : " wait") +
      '">' +
      (p.inStock ? "В наличии" : "Под заказ") +
      "</span></div>" +
      '<div class="buy-price"><b>' +
      money(p.price) +
      "</b>" +
      (p.oldPrice > p.price ? "<s>" + money(p.oldPrice) + "</s>" : "") +
      "<span>за м² · упаковка " +
      num(p.packM2, 3) +
      " м² — " +
      money(p.packPrice) +
      "</span></div>" +
      '<div class="chips-line"><span>' +
      p.class +
      " класс</span><span>" +
      p.thickness +
      " мм</span><span>" +
      p.plank[0] +
      "×" +
      p.plank[1] +
      "</span><span>" +
      bevelName(p.bevel) +
      "</span>" +
      (p.water ? "<span>влагостойкий</span>" : "") +
      "</div>" +
      '<div class="calc-inline" data-calc-box="' +
      key +
      '">' +
      calcForm(key, calcState[key], false) +
      '<div class="calc-out" style="margin-top:14px" data-calc-out="' +
      key +
      '">' +
      calcOut(key, calcState[key]) +
      "</div></div>" +
      '<a class="btn btn-glass btn-block" target="_blank" rel="noopener" href="' +
      waHref("Здравствуйте! Интересует ламинат «" + p.name + "». Есть в наличии?") +
      '">' +
      icon("wa", "wa-ico") +
      "Спросить в WhatsApp</a>" +
      perks() +
      "</aside></div>" +
      specsPanel(specs) +
      '<section class="related"><div class="section-head"><div><p class="eyebrow">Сочетание</p><h2 class="h2">Двери к этому полу</h2></div><a class="link" href="#doors">Все двери' +
      icon("arrow") +
      '</a></div><div class="grid grid-4">' +
      pairDoors(p).map(card).join("") +
      "</div></section>" +
      '<section class="related"><div class="section-head"><div><p class="eyebrow">Похожие</p><h2 class="h2">Ещё ламинат</h2></div></div><div class="grid grid-4">' +
      LAMS.filter((l) => l !== p)
        .sort((a, b) => (b.tone === p.tone) - (a.tone === p.tone))
        .slice(0, 4)
        .map(card)
        .join("") +
      "</div></section></div>";

    pageScene = new R.Scene($("#pScene"), {
      preset: "lam-product",
      door: doorById(st.door),
      finish: 0,
      floor: p,
      wall: "#DDD6CC",
    });
    hydrate(app);
    return {
      title: p.name + " — ламинат " + p.class + " класса — " + CFG.name,
      desc: p.description,
    };
  }

  function pairDoors(l) {
    const light = l.tone === "light" || l.tone === "grey";
    const doors = DOORS.filter((d) => d.kind === "interior");
    const score = (d) => {
      const lum = T.luma(T.hex(d.finishes[0].color));
      return light ? Math.abs(lum - 0.35) : Math.abs(lum - 0.9);
    };
    return doors
      .slice()
      .sort((a, b) => score(a) - score(b))
      .slice(0, 4);
  }

  /* Сечение доски: слои, фаска, замок. */
  function sectionSVG(p) {
    const t = p.thickness;
    const h = Math.round(t * 6.5);
    const x0 = 60;
    const x1 = 520;
    const y0 = 26;
    const y1 = y0 + h;
    const b = p.bevel === "none" ? 0 : 7;
    const q = (k) => y0 + h * k;
    const body = [
      "M" + x0 + " " + (y0 + b),
      "L" + (x0 + b) + " " + y0,
      "L" + (x1 - b) + " " + y0,
      "L" + x1 + " " + (y0 + b),
      "L" + x1 + " " + q(0.36),
      "L" + (x1 + 30) + " " + q(0.44),
      "L" + (x1 + 30) + " " + q(0.58),
      "L" + (x1 + 18) + " " + q(0.64),
      "L" + x1 + " " + q(0.66),
      "L" + x1 + " " + y1,
      "L" + (x0 - 34) + " " + y1,
      "L" + (x0 - 34) + " " + q(0.72),
      "L" + (x0 - 20) + " " + q(0.64),
      "L" + x0 + " " + q(0.66),
      "L" + (x0 + 22) + " " + q(0.62),
      "L" + (x0 + 30) + " " + q(0.44),
      "L" + x0 + " " + q(0.38),
      "Z",
    ].join(" ");
    const base = (p.look && p.look.base) || "#C39A66";
    return (
      '<svg class="section-svg" viewBox="0 0 640 ' +
      (y1 + 56) +
      '" role="img" aria-label="Сечение доски: толщина ' +
      t +
      ' мм">' +
      '<defs><clipPath id="sec-clip"><path d="' +
      body +
      '"/></clipPath></defs>' +
      '<path d="' +
      body +
      '" fill="#b89166"/>' +
      '<g clip-path="url(#sec-clip)"><rect x="0" y="' +
      y0 +
      '" width="640" height="4" fill="' +
      esc(base) +
      '"/><rect x="0" y="' +
      (y0 + 4) +
      '" width="640" height="1.2" fill="rgba(255,255,255,.55)"/>' +
      '<rect x="0" y="' +
      (y1 - 3) +
      '" width="640" height="3" fill="#3b2c22"/>' +
      Array.from(
        { length: 26 },
        (_, i) =>
          '<circle cx="' +
          (40 + i * 19) +
          '" cy="' +
          (y0 + 12 + ((i * 7) % (h - 20))) +
          '" r="1.1" fill="rgba(90,60,30,.35)"/>',
      ).join("") +
      "</g>" +
      '<path d="' +
      body +
      '" fill="none" stroke="rgba(40,26,14,.55)" stroke-width="1"/>' +
      '<g class="dim" fill="currentColor" stroke="currentColor">' +
      '<path d="M580 ' +
      y0 +
      "V" +
      y1 +
      "M574 " +
      y0 +
      "H586M574 " +
      y1 +
      'H586" stroke-width="1" fill="none"/>' +
      '<text x="592" y="' +
      (y0 + h / 2 + 4) +
      '" stroke="none">' +
      t +
      " мм</text>" +
      '<path d="M' +
      x0 +
      " " +
      (y1 + 22) +
      "H" +
      x1 +
      "M" +
      x0 +
      " " +
      (y1 + 16) +
      "V" +
      (y1 + 28) +
      "M" +
      x1 +
      " " +
      (y1 + 16) +
      "V" +
      (y1 + 28) +
      '" stroke-width="1" fill="none"/>' +
      '<text x="' +
      (x0 + x1) / 2 +
      '" y="' +
      (y1 + 42) +
      '" text-anchor="middle" stroke="none">' +
      p.plank[1] +
      " мм — ширина доски</text>" +
      (b
        ? '<text x="' +
          (x0 + 10) +
          '" y="' +
          (y0 - 8) +
          '" stroke="none">фаска ' +
          esc(p.bevel) +
          "</text>"
        : "") +
      '<text x="' +
      (x1 - 30) +
      '" y="' +
      (y0 - 8) +
      '" stroke="none" text-anchor="end">замок</text>' +
      "</g></svg>"
    );
  }

  /* ------------------------------------------------------------------ избранное, контакты */

  function renderFavorites() {
    const doors = DOORS.filter((p) => state.fav.has(p.id));
    const lams = LAMS.filter((p) => state.fav.has(p.id));
    const block = (title, list) =>
      list.length
        ? '<section class="section" style="padding-top:18px"><div class="section-head"><h2 class="h2">' +
          title +
          '</h2></div><div class="grid grid-4">' +
          list.map(card).join("") +
          "</div></section>"
        : "";
    app.innerHTML =
      '<section class="wrap page-head"><nav class="crumbs" aria-label="Путь"><a href="#">Главная</a>' +
      icon("chev") +
      '<span>Избранное</span></nav><div class="page-title"><h1>Избранное</h1><span>' +
      (doors.length + lams.length || "") +
      "</span></div></section>" +
      '<div class="wrap">' +
      (doors.length + lams.length
        ? block("Двери", doors) + block("Ламинат", lams)
        : '<div class="empty glass-soft">' +
          icon("heart") +
          "<h3>Здесь пока пусто</h3><p>Нажмите на сердечко у двери или ламината — они сохранятся здесь.</p>" +
          '<div class="actions" style="justify-content:center"><a class="btn btn-primary" href="#doors">Смотреть двери</a><a class="btn btn-glass" href="#laminate">Смотреть ламинат</a></div></div>') +
      "</div>";
    hydrate(app);
    return { title: "Избранное — " + CFG.name };
  }

  function renderContacts() {
    app.innerHTML =
      '<section class="wrap page-head"><nav class="crumbs" aria-label="Путь"><a href="#">Главная</a>' +
      icon("chev") +
      '<span>Контакты</span></nav><div class="page-title"><h1>Контакты</h1></div></section>' +
      '<section class="wrap contact-grid">' +
      '<div class="panel glass" style="display:grid;gap:18px;align-content:start"><p class="eyebrow">Позвоните или напишите</p>' +
      (CFG.phone
        ? '<div class="copy-line"><a class="big-phone" href="' +
          telHref() +
          '">' +
          esc(CFG.phone) +
          '</a><button class="btn btn-glass btn-sm" data-act="copy" data-text="' +
          esc(CFG.phone) +
          '">' +
          icon("copy") +
          "Скопировать</button></div>"
        : "") +
      contactButtons() +
      contactList() +
      "</div>" +
      '<form class="panel glass order-form" id="callForm" novalidate style="margin-top:0"><h2 style="margin:0">Перезвоним вам</h2><p class="hint">Оставьте имя и телефон — WhatsApp откроется с готовым сообщением, останется нажать «Отправить».</p>' +
      '<label class="label">Имя<input class="field" name="name" id="callName" autocomplete="name" /></label>' +
      '<label class="label">Телефон<input class="field" name="phone" id="callPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="' +
      esc(phoneHint()) +
      '" /></label>' +
      '<label class="label">Удобное время или вопрос<textarea class="field" name="comment" id="callNote" rows="3"></textarea></label>' +
      '<a class="btn btn-primary" id="callSend" target="_blank" rel="noopener" href="' +
      waHref() +
      '">' +
      icon("wa") +
      "Отправить в WhatsApp</a></form>" +
      "</section>" +
      visitBlock();
    hydrate(app);
    updateCallLink();
    return { title: "Контакты — " + CFG.name, desc: CFG.address };
  }

  function updateCallLink() {
    const a = $("#callSend");
    if (!a) return;
    const name = $("#callName").value.trim();
    const phone = $("#callPhone").value.trim();
    const note = $("#callNote").value.trim();
    a.href = waHref(
      "Здравствуйте! Прошу перезвонить." +
        (name ? "\nИмя: " + name : "") +
        (phone ? "\nТелефон: " + phone : "") +
        (note ? "\n" + note : ""),
    );
  }

  /* ------------------------------------------------------------------ конструктор карточек */

  const builder = {
    tab: "door",
    door: {
      name: "Новая дверь",
      kind: "interior",
      model: "grooves-h4",
      type: "paint",
      color: "#EEECE7",
      grain: "#A3845A",
      figure: "oak",
      glass: "",
      handle: "black",
      price: 1500,
    },
    lam: {
      name: "Новый ламинат",
      pattern: "plank",
      base: "#C9A676",
      dark: "#8E6A40",
      figure: "oak",
      knots: 0,
      len: 1380,
      wid: 193,
      bevel: "4V",
      price: 150,
    },
  };

  function slug(s) {
    const map = {
      а: "a",
      б: "b",
      в: "v",
      г: "g",
      д: "d",
      е: "e",
      ё: "e",
      ж: "zh",
      з: "z",
      и: "i",
      й: "y",
      к: "k",
      л: "l",
      м: "m",
      н: "n",
      о: "o",
      п: "p",
      р: "r",
      с: "s",
      т: "t",
      у: "u",
      ф: "f",
      х: "h",
      ц: "c",
      ч: "ch",
      ш: "sh",
      щ: "sch",
      ъ: "",
      ы: "y",
      ь: "",
      э: "e",
      ю: "yu",
      я: "ya",
    };
    return (
      norm(s)
        .split("")
        .map((c) => (map[c] !== undefined ? map[c] : c))
        .join("")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "tovar"
    );
  }

  function builderDoor() {
    const b = builder.door;
    const finish = { name: "Цвет 1", type: b.type, color: b.color.toUpperCase() };
    if (b.type === "wood") {
      finish.grain = b.grain.toUpperCase();
      finish.figure = b.figure;
    }
    return Object.assign(
      {},
      {
        id: "door-" + slug(b.name),
        name: b.name,
        kind: b.kind,
        model: b.model,
        glass: b.glass || null,
        handle: b.handle,
        finishes: [finish],
        price: +b.price || 0,
      },
    );
  }

  function builderLam() {
    const b = builder.lam;
    return {
      id: "lam-" + slug(b.name),
      name: b.name,
      pattern: b.pattern,
      plank: [+b.len || 1380, +b.wid || 193],
      bevel: b.bevel,
      price: +b.price || 0,
      look: {
        base: b.base.toUpperCase(),
        dark: b.dark.toUpperCase(),
        figure: b.pattern === "tile" ? "stone" : b.figure,
        knots: +b.knots || 0,
      },
    };
  }

  function codeDoor() {
    const d = builderDoor();
    const f = d.finishes[0];
    return (
      "  {\n" +
      '    id: "' +
      d.id +
      '",\n' +
      '    name: "' +
      d.name.replace(/"/g, "'") +
      '",\n' +
      '    kind: "' +
      d.kind +
      '",\n' +
      '    collection: "",\n' +
      '    style: "Современный",\n' +
      '    cover: "' +
      (f.type === "wood" ? "Экошпон" : f.type === "metal" ? "Порошковая покраска" : "Эмаль") +
      '",\n' +
      "    price: " +
      d.price +
      ",\n" +
      "    inStock: true,\n" +
      '    model: "' +
      d.model +
      '",\n' +
      "    glass: " +
      (d.glass ? '"' + d.glass + '"' : "null") +
      ",\n" +
      '    handle: "' +
      d.handle +
      '",\n' +
      "    finishes: [\n" +
      '      { name: "' +
      f.name +
      '", type: "' +
      f.type +
      '", color: "' +
      f.color +
      '"' +
      (f.grain ? ', grain: "' + f.grain + '", figure: "' + f.figure + '"' : "") +
      " },\n    ],\n" +
      (d.kind === "entrance"
        ? '    sizes: ["860×2050", "960×2050"],\n'
        : '    sizes: ["600×2000", "700×2000", "800×2000", "900×2000"],\n') +
      '    description: "Опишите дверь в двух-трёх предложениях.",\n' +
      '    features: ["Первая особенность", "Вторая особенность"],\n' +
      "    specs: [\n" +
      '      ["Толщина полотна", "40 мм"],\n' +
      '      ["Гарантия", "1 год"],\n' +
      "    ],\n" +
      "    photos: [],\n" +
      "  },"
    );
  }

  function codeLam() {
    const l = builderLam();
    return (
      "  {\n" +
      '    id: "' +
      l.id +
      '",\n' +
      '    name: "' +
      l.name.replace(/"/g, "'") +
      '",\n' +
      '    collection: "",\n' +
      "    price: " +
      l.price +
      ",\n" +
      "    inStock: true,\n" +
      "    class: 33,\n" +
      "    thickness: 12,\n" +
      '    bevel: "' +
      l.bevel +
      '",\n' +
      "    water: false,\n" +
      "    plank: [" +
      l.plank[0] +
      ", " +
      l.plank[1] +
      "],\n" +
      "    pack: { pcs: 7, kg: 15 },\n" +
      '    pattern: "' +
      l.pattern +
      '",\n' +
      '    tone: "natural",\n' +
      '    look: { base: "' +
      l.look.base +
      '", dark: "' +
      l.look.dark +
      '", figure: "' +
      l.look.figure +
      '"' +
      (l.look.knots ? ", knots: " + l.look.knots : "") +
      " },\n" +
      '    description: "Опишите ламинат в двух-трёх предложениях.",\n' +
      '    features: ["Первая особенность", "Вторая особенность"],\n' +
      "    specs: [\n" +
      '      ["Замок", "Click"],\n' +
      '      ["Гарантия", "20 лет"],\n' +
      "    ],\n" +
      "    photos: [],\n" +
      "  },"
    );
  }

  function pills(group, options, current) {
    return (
      '<div class="pills">' +
      options
        .map(
          (o) =>
            '<button class="pill txt" data-act="b-set" data-k="' +
            group +
            '" data-v="' +
            esc(o[0]) +
            '" aria-pressed="' +
            (String(current) === String(o[0])) +
            '">' +
            esc(o[1]) +
            "</button>",
        )
        .join("") +
      "</div>"
    );
  }

  function renderBuilder() {
    const isDoor = builder.tab === "door";
    const b = builder[builder.tab];
    let form;
    if (isDoor) {
      form =
        '<label class="label">Название<input class="field" data-b="name" value="' +
        esc(b.name) +
        '" /></label>' +
        '<div class="opt"><div class="opt-head"><span>Тип</span></div>' +
        pills(
          "kind",
          [
            ["interior", "Межкомнатная"],
            ["entrance", "Входная"],
          ],
          b.kind,
        ) +
        "</div>" +
        '<div class="opt"><div class="opt-head"><span>Рисунок полотна (model)</span><b>' +
        esc(b.model) +
        '</b></div><div class="models">' +
        R.MODELS.filter((m) => (b.kind === "entrance") === (m.indexOf("entrance") === 0))
          .map(
            (m) =>
              '<button data-act="b-set" data-k="model" data-v="' +
              m +
              '" aria-pressed="' +
              (m === b.model) +
              '"><canvas data-bmodel="' +
              m +
              '"></canvas>' +
              m +
              "</button>",
          )
          .join("") +
        "</div></div>" +
        '<div class="opt"><div class="opt-head"><span>Отделка (type)</span></div>' +
        pills(
          "type",
          [
            ["paint", "Эмаль, краска"],
            ["wood", "Под дерево"],
            ["metal", "Металл"],
          ],
          b.type,
        ) +
        "</div>" +
        '<div class="two"><label class="label">Цвет (color)<span class="color-in"><input type="color" data-b="color" value="' +
        esc(b.color) +
        '" /><span class="mono">' +
        esc(b.color.toUpperCase()) +
        "</span></span></label>" +
        (b.type === "wood"
          ? '<label class="label">Прожилки (grain)<span class="color-in"><input type="color" data-b="grain" value="' +
            esc(b.grain) +
            '" /><span class="mono">' +
            esc(b.grain.toUpperCase()) +
            "</span></span></label>"
          : "") +
        "</div>" +
        (b.type === "wood"
          ? '<div class="opt"><div class="opt-head"><span>Порода (figure)</span></div>' +
            pills(
              "figure",
              [
                ["oak", "Дуб"],
                ["ash", "Ясень"],
                ["walnut", "Орех"],
                ["pine", "Сосна"],
                ["linear", "Прямые линии"],
              ],
              b.figure,
            ) +
            "</div>"
          : "") +
        '<div class="opt"><div class="opt-head"><span>Стекло (glass)</span></div>' +
        pills(
          "glass",
          [
            ["", "Без стекла"],
            ["frosted", "Матовое"],
            ["clear", "Прозрачное"],
            ["bronze", "Бронза"],
            ["black", "Чёрное"],
            ["fluted", "Рифлёное"],
          ],
          b.glass,
        ) +
        '<p class="hint">Стекло видно на моделях glass-strip, glass-top, loft-4, loft-6.</p></div>' +
        '<div class="opt"><div class="opt-head"><span>Ручка (handle)</span></div>' +
        pills(
          "handle",
          Object.keys(HANDLES).map((k) => [k, HANDLES[k]]),
          b.handle,
        ) +
        "</div>" +
        '<label class="label">Цена полотна, ' +
        esc(CFG.currency) +
        '<input class="field num" inputmode="numeric" data-b="price" value="' +
        esc(b.price) +
        '" /></label>';
    } else {
      form =
        '<label class="label">Название<input class="field" data-b="name" value="' +
        esc(b.name) +
        '" /></label>' +
        '<div class="opt"><div class="opt-head"><span>Укладка (pattern)</span></div>' +
        pills(
          "pattern",
          [
            ["plank", "Доска"],
            ["herringbone", "Ёлочка"],
            ["tile", "Плитка, камень"],
          ],
          b.pattern,
        ) +
        "</div>" +
        '<div class="two"><label class="label">Основной цвет (base)<span class="color-in"><input type="color" data-b="base" value="' +
        esc(b.base) +
        '" /><span class="mono">' +
        esc(b.base.toUpperCase()) +
        "</span></span></label>" +
        '<label class="label">Прожилки (dark)<span class="color-in"><input type="color" data-b="dark" value="' +
        esc(b.dark) +
        '" /><span class="mono">' +
        esc(b.dark.toUpperCase()) +
        "</span></span></label></div>" +
        (b.pattern !== "tile"
          ? '<div class="opt"><div class="opt-head"><span>Порода (figure)</span></div>' +
            pills(
              "figure",
              [
                ["oak", "Дуб"],
                ["ash", "Ясень"],
                ["walnut", "Орех"],
                ["pine", "Сосна"],
                ["linear", "Прямые линии"],
              ],
              b.figure,
            ) +
            "</div>" +
            '<div class="opt"><div class="opt-head"><span>Сучки (knots)</span></div>' +
            pills(
              "knots",
              [
                ["0", "Нет"],
                ["0.4", "Немного"],
                ["0.9", "Много"],
              ],
              String(b.knots),
            ) +
            "</div>"
          : "") +
        '<div class="two"><label class="label">Длина доски, мм<input class="field num" inputmode="numeric" data-b="len" value="' +
        esc(b.len) +
        '" /></label>' +
        '<label class="label">Ширина доски, мм<input class="field num" inputmode="numeric" data-b="wid" value="' +
        esc(b.wid) +
        '" /></label></div>' +
        '<div class="opt"><div class="opt-head"><span>Фаска (bevel)</span></div>' +
        pills(
          "bevel",
          [
            ["none", "Без фаски"],
            ["2V", "2V"],
            ["4V", "4V"],
          ],
          b.bevel,
        ) +
        "</div>" +
        '<label class="label">Цена за м², ' +
        esc(CFG.currency) +
        '<input class="field num" inputmode="numeric" data-b="price" value="' +
        esc(b.price) +
        '" /></label>';
    }
    return (
      '<div class="builder"><div class="builder-form glass-soft">' +
      form +
      '</div><div class="builder-preview"><div id="bScene"></div>' +
      '<div class="panel glass-soft" style="display:grid;gap:12px"><div class="opt-head"><span>Код для файла js/data.js</span><button class="btn btn-glass btn-sm" data-act="copy-code">' +
      icon("copy") +
      'Скопировать</button></div><pre class="code" id="bCode"></pre><p class="hint">Вставьте код в список ' +
      (isDoor ? "SHOP_DOORS" : "SHOP_LAMINATE") +
      " в файле js/data.js, затем поправьте описание, характеристики и размеры.</p></div></div></div>"
    );
  }

  let builderScene = null;
  function mountBuilder() {
    const box = $("#builderBox");
    box.innerHTML = renderBuilder();
    for (const b of $$("[data-act=b-tab]"))
      b.setAttribute("aria-selected", b.dataset.v === builder.tab);
    const isDoor = builder.tab === "door";
    const door = isDoor ? builderDoor() : doorById(CFG.cardDoor);
    const floor = isDoor ? lamById(CFG.cardFloor) : builderLam();
    builderScene = new R.Scene($("#bScene"), {
      preset: isDoor ? "product" : "lam-product",
      door,
      floor,
      wall: "#DAD3C9",
    });
    for (const cv of $$("canvas[data-bmodel]", box)) {
      const m = cv.dataset.bmodel;
      lazy(cv, () =>
        R.doorImage(cv, Object.assign(builderDoor(), { model: m, id: "bm-" + m }), 0, {
          pad: 0.02,
        }),
      );
    }
    $("#bCode").textContent = isDoor ? codeDoor() : codeLam();
  }

  let builderTimer = 0;
  function builderChanged(full) {
    clearTimeout(builderTimer);
    builderTimer = setTimeout(() => {
      if (full) return mountBuilder();
      const isDoor = builder.tab === "door";
      if (builderScene)
        builderScene.update(isDoor ? { door: builderDoor(), finish: 0 } : { floor: builderLam() });
      $("#bCode").textContent = isDoor ? codeDoor() : codeLam();
    }, 180);
  }

  function renderConstructor() {
    app.innerHTML =
      '<section class="wrap page-head"><nav class="crumbs" aria-label="Путь"><a href="#">Главная</a>' +
      icon("chev") +
      '<span>Конструктор карточек</span></nav><div class="page-title"><h1>Конструктор карточек</h1></div>' +
      '<p class="lead">Страница для владельца сайта. Подберите, как нарисовать вашу дверь или ламинат, скопируйте готовый код и вставьте его в файл <span class="mono">js/data.js</span>. Когда появятся фотографии товара, добавьте их в поле <span class="mono">photos</span>.</p>' +
      '<div class="seg" role="tablist" style="max-width:420px"><button role="tab" data-act="b-tab" data-v="door" aria-selected="true">Дверь</button><button role="tab" data-act="b-tab" data-v="lam" aria-selected="false">Ламинат</button></div>' +
      '</section><section class="wrap" id="builderBox"></section>';
    mountBuilder();
    return { title: "Конструктор карточек — " + CFG.name };
  }

  /* ------------------------------------------------------------------ слои: заявка, поиск, меню */

  let lastFocus = null;

  function openLayer(html, onOpen) {
    const layer = $("#layer");
    lastFocus = document.activeElement;
    layer.innerHTML = html;
    document.documentElement.style.overflow = "hidden";
    if (onOpen) onOpen(layer);
  }

  function closeLayer() {
    const layer = $("#layer");
    if (!layer.innerHTML) return false;
    layer.innerHTML = "";
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    return true;
  }

  function sheet(kind, label, head, body, foot) {
    return (
      '<div class="sheet sheet-' +
      kind +
      '" role="dialog" aria-modal="true" aria-label="' +
      esc(label) +
      '"><div class="sheet-backdrop" data-act="close-layer"></div><div class="sheet-panel glass">' +
      head +
      '<div class="sheet-body">' +
      body +
      "</div>" +
      (foot ? '<div class="sheet-foot">' + foot + "</div>" : "") +
      "</div></div>"
    );
  }

  function orderText() {
    const lines = ["Здравствуйте! Заявка с сайта «" + CFG.name + "»:", ""];
    state.cart.forEach((it, i) => {
      const p = BY_ID[it.id];
      if (!p) return;
      const what = p.cat === "lam" ? "Ламинат" : p.kind === "entrance" ? "Входная дверь" : "Дверь";
      lines.push(
        i +
          1 +
          ". " +
          what +
          " «" +
          p.name +
          "»" +
          (it.t === "door" ? " — " + it.qty + " шт." : ""),
      );
      lines.push("   " + itemDesc(it));
      lines.push("   Сумма: " + money(itemPrice(it)));
    });
    lines.push("", "Итого: " + money(cartTotal()));
    const f = state.form;
    if (f.name) lines.push("Имя: " + f.name);
    if (f.phone) lines.push("Телефон: " + f.phone);
    if (f.comment) lines.push("Адрес, комментарий: " + f.comment);
    return lines.join("\n");
  }

  function cartBody() {
    if (!state.cart.length) {
      return (
        '<div class="cart-empty">' +
        icon("list") +
        "<h3>В заявке пока ничего нет</h3><p>Добавьте двери или рассчитайте ламинат — соберём всё в одно сообщение для менеджера.</p>" +
        '<div class="actions" style="justify-content:center"><a class="btn btn-primary" href="#doors" data-act="close-layer">Двери</a><a class="btn btn-glass" href="#laminate" data-act="close-layer">Ламинат</a></div></div>'
      );
    }
    return (
      '<div class="cart-items">' +
      state.cart
        .map((it, i) => {
          const p = BY_ID[it.id];
          const thumb =
            p.cat === "door"
              ? '<canvas class="cart-thumb" data-door="' +
                p.id +
                '" data-finish="' +
                it.finish +
                '" data-hinge="' +
                it.hinge +
                '" data-pad="0.03"></canvas>'
              : '<canvas class="cart-thumb round" data-floor="' +
                p.id +
                '" data-mm="600"></canvas>';
          const qty = it.t === "door" ? it.qty : it.packs;
          return (
            '<div class="cart-item">' +
            thumb +
            '<div><h3><a href="#' +
            p.id +
            '" data-act="close-layer">' +
            esc(p.name) +
            "</a></h3><p>" +
            esc(itemDesc(it)) +
            '</p><div class="cart-line"><div class="qty"><button data-act="cart-qty" data-i="' +
            i +
            '" data-d="-1" aria-label="Меньше">' +
            icon("minus") +
            "</button><output>" +
            qty +
            '</output><button data-act="cart-qty" data-i="' +
            i +
            '" data-d="1" aria-label="Больше">' +
            icon("plus") +
            "</button></div><b>" +
            money(itemPrice(it)) +
            '</b><button class="icon-btn cart-remove" data-act="cart-remove" data-i="' +
            i +
            '" aria-label="Убрать из заявки">' +
            icon("trash") +
            "</button></div></div></div>"
          );
        })
        .join("") +
      '</div><div class="cart-sum"><span>Итого по каталогу</span><b>' +
      money(cartTotal()) +
      "</b></div>" +
      '<p class="order-note">Точную сумму с доставкой и установкой назовём после замера.</p>' +
      '<form class="order-form" id="orderForm" novalidate><h3>Куда перезвонить</h3>' +
      '<label class="label">Имя<input class="field" id="oName" autocomplete="name" value="' +
      esc(state.form.name) +
      '" /></label>' +
      '<label class="label">Телефон<input class="field" id="oPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="' +
      esc(phoneHint()) +
      '" value="' +
      esc(state.form.phone) +
      '" /></label>' +
      '<label class="label">Адрес или комментарий<textarea class="field" id="oNote" rows="2">' +
      esc(state.form.comment) +
      "</textarea></label></form>" +
      '<textarea class="field" id="orderText" rows="8" readonly hidden></textarea>'
    );
  }

  function cartFoot() {
    if (!state.cart.length) return "";
    return (
      '<a class="btn btn-primary btn-block" id="sendWa" target="_blank" rel="noopener" href="' +
      waHref(orderText()) +
      '">' +
      icon("wa") +
      "Отправить в WhatsApp</a>" +
      '<p class="order-note" style="text-align:center">Откроется WhatsApp с готовым текстом заявки — останется нажать «Отправить».</p>' +
      '<div class="actions" style="justify-content:center">' +
      (CFG.telegram
        ? '<a class="btn btn-glass btn-sm" id="sendTg" data-act="tg-order" target="_blank" rel="noopener" href="https://t.me/' +
          esc(CFG.telegram) +
          '">' +
          icon("tg") +
          "Telegram</a>"
        : "") +
      '<button class="btn btn-glass btn-sm" data-act="copy-order">' +
      icon("copy") +
      'Скопировать текст</button><button class="btn btn-glass btn-sm" data-act="cart-clear">' +
      icon("trash") +
      "Очистить</button></div>"
    );
  }

  function openCart() {
    openLayer(
      sheet(
        "right sheet-cart",
        "Заявка",
        '<div class="sheet-head"><h2>Заявка</h2><button class="icon-btn" data-act="close-layer" aria-label="Закрыть">' +
          icon("close") +
          "</button></div>",
        cartBody(),
        cartFoot(),
      ),
      (layer) => {
        hydrate(layer);
        const first = $(".sheet-head .icon-btn", layer);
        if (first) first.focus({ preventScroll: true });
      },
    );
  }

  function refreshCart() {
    const body = $("#layer .sheet-cart .sheet-body");
    if (!body) return;
    const panel = body.parentElement;
    body.innerHTML = cartBody();
    let foot = $(".sheet-foot", panel);
    if (state.cart.length) {
      if (!foot) {
        foot = document.createElement("div");
        foot.className = "sheet-foot";
        panel.appendChild(foot);
      }
      foot.innerHTML = cartFoot();
    } else if (foot) foot.remove();
    hydrate(body);
  }

  function readOrderForm() {
    const n = $("#oName");
    if (!n) return;
    state.form = {
      name: n.value.trim(),
      phone: $("#oPhone").value.trim(),
      comment: $("#oNote").value.trim(),
    };
    store.set("orderForm", state.form);
    const wa = $("#sendWa");
    if (wa) wa.href = waHref(orderText());
  }

  function openSearch() {
    openLayer(
      sheet(
        "top",
        "Поиск",
        '<label class="search-field">' +
          icon("search") +
          '<input id="q" type="text" enterkeyhint="search" role="searchbox" placeholder="Название, цвет, коллекция…" autocomplete="off" aria-label="Поиск по каталогу" /><button class="icon-btn" data-act="close-layer" aria-label="Закрыть">' +
          icon("close") +
          "</button></label>",
        '<div class="results" id="results">' + searchResults("") + "</div>",
        "",
      ),
      (layer) => {
        hydrate(layer);
        $("#q", layer).focus();
      },
    );
  }

  function stem(t) {
    if (t.length >= 6) return t.slice(0, -2);
    if (t.length >= 4) return t.slice(0, -1);
    return t;
  }

  function searchResults(q) {
    const tokens = norm(q).split(/\s+/).filter(Boolean).map(stem);
    const list = tokens.length
      ? ALL.filter((p) => tokens.every((t) => p.search.indexOf(t) >= 0))
      : popular(DOORS).slice(0, 3).concat(popular(LAMS).slice(0, 3));
    if (!list.length)
      return '<p class="muted">Ничего не нашли. Попробуйте «белая», «дуб», «ёлочка» или «входная».</p>';
    return (
      (tokens.length ? "" : '<p class="muted" style="padding:6px 12px">Популярное</p>') +
      list
        .slice(0, 10)
        .map((p) => {
          const thumb =
            p.cat === "door"
              ? '<canvas data-door="' + p.id + '" data-pad="0.02"></canvas>'
              : '<canvas class="round" data-floor="' + p.id + '" data-mm="600"></canvas>';
          return (
            '<a class="result" href="#' +
            p.id +
            '" data-act="close-layer">' +
            thumb +
            "<span><b>" +
            esc(p.name) +
            "</b><small>" +
            esc(
              p.cat === "door"
                ? p.typeName + (p.collection ? " · " + p.collection : "")
                : "Ламинат · " + p.class + " класс · " + p.thickness + " мм",
            ) +
            '</small></span><span class="mono">' +
            money(p.price) +
            (p.cat === "lam" ? "/м²" : "") +
            "</span></a>"
          );
        })
        .join("")
    );
  }

  function openMenu() {
    openLayer(
      sheet(
        "right",
        "Меню",
        '<div class="sheet-head"><a class="logo" href="#" data-act="close-layer">' +
          LOGO +
          '<span><span class="logo-name">' +
          esc(CFG.name) +
          '</span><span class="logo-sub">' +
          esc(CFG.tagline) +
          '</span></span></a><button class="icon-btn" data-act="close-layer" aria-label="Закрыть">' +
          icon("close") +
          "</button></div>",
        '<nav class="menu-links" aria-label="Разделы">' +
          [
            ["doors-interior", "Межкомнатные двери"],
            ["doors-entrance", "Входные двери"],
            ["laminate", "Ламинат"],
            ["favorites", "Избранное" + (state.fav.size ? " · " + state.fav.size : "")],
            ["contacts", "Контакты"],
          ]
            .map(
              (l) =>
                '<a href="#' + l[0] + '" data-act="close-layer">' + l[1] + icon("chev") + "</a>",
            )
            .join("") +
          '</nav><div class="menu-contacts">' +
          '<button class="btn btn-glass" data-act="theme">' +
          icon("sun", "t-sun") +
          icon("moon", "t-moon") +
          "Светлая или тёмная тема</button>" +
          contactList() +
          contactButtons() +
          "</div>",
        "",
      ),
    );
  }

  /* ------------------------------------------------------------------ уведомления */

  let toastTimer = 0;
  function toast(msg, action) {
    const old = $(".toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.className = "toast glass";
    el.setAttribute("role", "status");
    el.innerHTML = icon("check") + "<span>" + esc(msg) + "</span>" + (action || "");
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3600);
  }

  function toastAdded(name) {
    toast("«" + name + "» в заявке", '<button data-act="cart">Открыть</button>');
  }

  async function copyText(text, ok) {
    try {
      await navigator.clipboard.writeText(text);
      toast(ok || "Скопировано");
      return true;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ тема */

  function isLight() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "light";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  function toggleTheme() {
    const next = isLight() ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* без хранилища тема просто не запомнится */
    }
  }

  /* ------------------------------------------------------------------ действия */

  function setView(btn) {
    const v = btn.dataset.view;
    for (const t of $$(".g-tab")) t.setAttribute("aria-selected", t === btn);
    for (const el of $$("#gStage .g-view")) el.classList.toggle("is-active", el.dataset.view === v);
  }

  function setPressed(sel, on) {
    for (const b of $$(sel)) b.setAttribute("aria-pressed", on(b));
  }

  const ACTIONS = {
    search: openSearch,
    menu: openMenu,
    cart: () => {
      const t = $(".toast");
      if (t) t.remove();
      openCart();
    },
    theme: toggleTheme,
    "close-layer": (el, e) => {
      if (el.tagName !== "A") e.preventDefault();
      closeLayer();
    },
    "demo-hide": () => {
      store.set("demoHidden", true);
      const n = $(".demo-note");
      if (n) n.remove();
    },
    fav: (el) => {
      const id = el.dataset.id;
      const on = !state.fav.has(id);
      if (on) state.fav.add(id);
      else state.fav.delete(id);
      store.set("fav", Array.from(state.fav));
      setPressed('.fav[data-id="' + id + '"]', () => on);
      updateCounts();
      toast(
        on ? "Добавлено в избранное" : "Убрано из избранного",
        on ? '<a href="#favorites">Открыть</a>' : "",
      );
    },
    "quick-add": (el) => {
      const p = BY_ID[el.dataset.id];
      if (!p) return;
      addDoor(p, {});
      el.classList.add("is-done");
      el.innerHTML = icon("check");
      setTimeout(() => {
        el.classList.remove("is-done");
        el.innerHTML = icon("plus");
      }, 1400);
    },
    "fit-tab": (el) => {
      vis.tab = el.dataset.tab;
      saveVis();
      refreshFitting();
    },
    "vis-door": (el) => {
      vis.door = el.dataset.id;
      vis.finish = 0;
      saveVis();
      if (heroScene) heroScene.update({ door: doorById(vis.door), finish: 0 });
      refreshFitting();
    },
    "vis-finish": (el) => {
      vis.finish = +el.dataset.i;
      saveVis();
      if (heroScene) heroScene.update({ finish: vis.finish });
      refreshFitting();
    },
    "vis-floor": (el) => {
      vis.floor = el.dataset.id;
      saveVis();
      if (heroScene) heroScene.update({ floor: lamById(vis.floor) });
      refreshFitting();
    },
    "vis-wall": (el) => {
      vis.wall = +el.dataset.i;
      saveVis();
      if (heroScene) heroScene.update({ wall: WALLS[vis.wall].color });
      refreshFitting();
    },
    "vis-open": (el) => {
      vis.open = !vis.open;
      saveVis();
      if (heroScene) heroScene.setOpen(vis.open);
      el.setAttribute("aria-pressed", vis.open);
      $("span", el).textContent = vis.open ? "Закрыть дверь" : "Открыть дверь";
    },
    tone: (el) => {
      const cat = el.dataset.cat;
      const set = F[cat].tone;
      const v = el.dataset.v;
      if (set.has(v)) set.delete(v);
      else set.add(v);
      el.setAttribute("aria-pressed", set.has(v));
      updateGrid(cat);
    },
    "filters-open": () => {
      const f = $("#filters");
      if (!f) return;
      f.classList.add("is-open");
      if (!$(".filters-scrim")) {
        const s = document.createElement("div");
        s.className = "filters-scrim";
        s.dataset.act = "filters-close";
        document.body.appendChild(s);
      }
    },
    "filters-close": () => {
      const f = $("#filters");
      if (f) f.classList.remove("is-open");
      const s = $(".filters-scrim");
      if (s) s.remove();
    },
    "filters-reset": (el) => {
      const cat = el.dataset.cat;
      const kind = F.door.kind;
      for (const k in F[cat]) {
        const v = F[cat][k];
        if (v instanceof Set) v.clear();
        else if (k === "glass") F[cat][k] = "all";
        else if (k !== "kind") F[cat][k] = typeof v === "boolean" ? false : "";
      }
      F.door.kind = kind;
      $("#filters").innerHTML = cat === "door" ? doorFilters() : lamFilters();
      updateGrid(cat);
    },
    view: setView,
    "p-open": (el) => {
      if (!pageScene) return;
      const open = el.getAttribute("aria-pressed") !== "true";
      pageScene.setOpen(open);
      el.setAttribute("aria-pressed", open);
      $("span", el).textContent = open ? "Закрыть дверь" : "Открыть дверь";
    },
    "p-finish": (el) => {
      const st = page.st;
      st.finish = +el.dataset.i;
      setPressed('[data-act="p-finish"]', (b) => +b.dataset.i === st.finish);
      pageScene.update({ finish: st.finish });
      const leaf = $("#pLeaf");
      leaf.dataset.finish = st.finish;
      R.enqueue(() => R.doorImage(leaf, page.p, st.finish, { pad: 0.05, hinge: st.hinge }));
      refreshDoorBuy();
    },
    "p-size": (el) => {
      page.st.size = el.dataset.v;
      setPressed('[data-act="p-size"]', (b) => b.dataset.v === page.st.size);
      refreshDoorBuy();
    },
    "p-hinge": (el) => {
      const st = page.st;
      st.hinge = el.dataset.v;
      setPressed('[data-act="p-hinge"]', (b) => b.dataset.v === st.hinge);
      pageScene.update({ hinge: st.hinge });
      const leaf = $("#pLeaf");
      R.enqueue(() => R.doorImage(leaf, page.p, st.finish, { pad: 0.05, hinge: st.hinge }));
    },
    "p-qty": (el) => {
      page.st.qty = Math.max(1, Math.min(99, page.st.qty + +el.dataset.d));
      refreshDoorBuy();
    },
    "p-add": () => {
      const { p, st } = page;
      addDoor(p, { finish: st.finish, size: st.size, hinge: st.hinge, kit: st.kit, qty: st.qty });
    },
    "p-floor": (el) => {
      page.st.floor = el.dataset.id;
      setPressed('[data-act="p-floor"]', (b) => b.dataset.id === page.st.floor);
      $("#pFloorName").textContent = lamById(page.st.floor).name;
      pageScene.update({ floor: lamById(page.st.floor) });
    },
    "p-door": (el) => {
      page.st.door = el.dataset.id;
      setPressed('[data-act="p-door"]', (b) => b.dataset.id === page.st.door);
      $("#pDoorName").textContent = doorById(page.st.door).name;
      pageScene.update({ door: doorById(page.st.door), finish: 0 });
    },
    "calc-mode": (el) => {
      const key = el.dataset.calc;
      const st = calcState[key];
      st.mode = el.dataset.v;
      const box = $('[data-calc-box="' + key + '"]');
      const form = $(".calc-form", box);
      form.outerHTML = calcForm(key, st, key === "home");
      refreshCalc(key);
    },
    "calc-add": (el) => {
      const st = calcState[el.dataset.calc];
      const l = lamById(st.lam);
      const c = calc(l, st);
      if (c) addLam(l, c);
    },
    "cart-qty": (el) => {
      const it = state.cart[+el.dataset.i];
      if (!it) return;
      const d = +el.dataset.d;
      if (it.t === "door") it.qty = Math.max(1, it.qty + d);
      else it.packs = Math.max(1, it.packs + d);
      saveCart();
      refreshCart();
    },
    "cart-remove": (el) => {
      state.cart.splice(+el.dataset.i, 1);
      saveCart();
      refreshCart();
    },
    "cart-clear": () => {
      state.cart = [];
      saveCart();
      refreshCart();
    },
    "copy-order": async () => {
      readOrderForm();
      const text = orderText();
      if (!(await copyText(text, "Текст заявки скопирован"))) {
        const ta = $("#orderText");
        if (ta) {
          ta.hidden = false;
          ta.value = text;
          ta.select();
          toast("Выделили текст — скопируйте его");
        }
      }
    },
    "tg-order": () => {
      readOrderForm();
      copyText(orderText(), "Текст скопирован — вставьте его в чат Telegram");
    },
    copy: (el) => copyText(el.dataset.text),
    "b-tab": (el) => {
      builder.tab = el.dataset.v;
      mountBuilder();
    },
    "b-set": (el) => {
      const b = builder[builder.tab];
      const k = el.dataset.k;
      b[k] = k === "knots" ? +el.dataset.v : el.dataset.v;
      if (k === "kind") b.model = b.kind === "entrance" ? "entrance-panel" : "grooves-h4";
      if (k === "kind" && b.kind === "entrance" && b.type === "paint") b.type = "metal";
      const full =
        ["kind", "type", "pattern", "model", "figure", "glass", "handle", "knots", "bevel"].indexOf(
          k,
        ) >= 0;
      if (full) mountBuilder();
      else builderChanged(false);
    },
    "copy-code": () => copyText($("#bCode").textContent, "Код скопирован"),
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    if (el.tagName === "BUTTON") e.preventDefault();
    if (el.id === "sendWa" || el.id === "sendTg") return;
    fn(el, e);
  });

  // проверка телефона перед отправкой заявки
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest("#sendWa, #sendTg");
      if (!a) return;
      readOrderForm();
      const phone = $("#oPhone");
      if (phone && digits(phone.value).length < 7) {
        e.preventDefault();
        phone.classList.add("is-bad");
        phone.focus();
        toast("Укажите телефон, чтобы мы могли перезвонить");
        return;
      }
      if (a.id === "sendTg")
        copyText(orderText(), "Текст скопирован — вставьте его в чат Telegram");
    },
    true,
  );

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.calc) {
      const st = calcState[t.dataset.calc];
      if (!st) return;
      const k = t.dataset.k;
      if (t.type === "checkbox") st[k] = t.checked;
      else st[k] = t.value;
      if (k === "lam") {
        st.reserve = lamById(t.value).pattern === "herringbone" ? 10 : st.reserve;
        const box = $('[data-calc-box="' + t.dataset.calc + '"]');
        $(".calc-form", box).outerHTML = calcForm(t.dataset.calc, st, true);
      }
      refreshCalc(t.dataset.calc);
      return;
    }
    if (t.dataset.f === "min" || t.dataset.f === "max") {
      F[t.dataset.cat][t.dataset.f] = t.value;
      clearTimeout(t.__tm);
      t.__tm = setTimeout(() => updateGrid(t.dataset.cat), 250);
      return;
    }
    if (t.id === "q") {
      const res = $("#results");
      res.innerHTML = searchResults(t.value);
      hydrate(res);
      return;
    }
    if (t.closest("#orderForm")) {
      t.classList.remove("is-bad");
      readOrderForm();
      return;
    }
    if (t.closest("#callForm")) {
      updateCallLink();
      return;
    }
    if (t.dataset.b) {
      const b = builder[builder.tab];
      b[t.dataset.b] = t.value;
      const lab = t.nextElementSibling;
      if (t.type === "color" && lab) lab.textContent = t.value.toUpperCase();
      builderChanged(false);
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.f && t.dataset.f !== "min" && t.dataset.f !== "max") {
      const f = F[t.dataset.cat];
      const k = t.dataset.f;
      if (f[k] instanceof Set) {
        if (t.checked) f[k].add(t.value);
        else f[k].delete(t.value);
      } else if (k === "glass") f.glass = t.value;
      else f[k] = t.checked;
      updateGrid(t.dataset.cat);
      return;
    }
    if (t.id === "sort") {
      SORT[t.dataset.cat] = t.value;
      updateGrid(t.dataset.cat);
      return;
    }
    if (t.hasAttribute("data-kit") && page && page.type === "door") {
      page.st.kit = $$("[data-kit]")
        .filter((x) => x.checked)
        .map((x) => x.value);
      refreshDoorBuy();
      return;
    }
    if (t.dataset.calc && t.tagName === "SELECT") {
      // select уже обработан событием input
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!closeLayer()) ACTIONS["filters-close"]();
    }
    if (e.key === "Enter" && e.target.id === "q") {
      const first = $("#results .result");
      if (first) {
        location.hash = first.getAttribute("href");
        closeLayer();
      }
    }
    if (
      e.key === "/" &&
      !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) &&
      !$("#layer").innerHTML
    ) {
      e.preventDefault();
      openSearch();
    }
  });

  /* ------------------------------------------------------------------ маршруты */

  const PAGES = {
    "": renderHome,
    home: renderHome,
    doors: () => renderCatalog("door"),
    "doors-interior": () => renderCatalog("door", "interior"),
    "doors-entrance": () => renderCatalog("door", "entrance"),
    laminate: () => renderCatalog("lam"),
    favorites: renderFavorites,
    contacts: renderContacts,
    constructor: renderConstructor,
  };

  const scrollMemo = {};
  let current = null;

  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (current !== null) scrollMemo[current] = window.scrollY;
    closeLayer();
    ACTIONS["filters-close"]();
    heroScene = null;
    pageScene = null;
    page = null;
    R.sweep();
    let meta;
    if (!BY_ID[id] || BY_ID[id].cat !== "door") renderMbar();
    if (Object.prototype.hasOwnProperty.call(PAGES, id)) meta = PAGES[id]();
    else if (BY_ID[id])
      meta = BY_ID[id].cat === "door" ? renderDoor(BY_ID[id]) : renderLam(BY_ID[id]);
    else {
      meta = renderHome();
      if (id) toast("Такой страницы нет — открыли главную");
    }
    const prev = current;
    current = id;
    document.title = meta.title;
    const md = $('meta[name="description"]');
    if (md && meta.desc) md.setAttribute("content", meta.desc);
    markNav(id);
    const back = prev && BY_ID[prev] && scrollMemo[id] !== undefined;
    window.scrollTo(0, back ? scrollMemo[id] : 0);
    app.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ запуск */

  try {
    const noise = T.noiseTile(180, 0.055);
    document.documentElement.style.setProperty(
      "--noise",
      "url(" + noise.toDataURL("image/png") + ")",
    );
  } catch {
    /* без шума стекло просто глаже */
  }

  renderShell();
  window.addEventListener("hashchange", route);
  route();
})();
