/*
 * ДАННЫЕ САЙТА — единственный файл, который нужно редактировать.
 *
 * 1. SHOP_CONFIG — название, телефоны, адрес, валюта, услуги.
 * 2. SHOP_DOORS — двери (межкомнатные и входные).
 * 3. SHOP_LAMINATE — ламинат.
 *
 * Товары ниже — двери и ламинат из салона, с фотографий владельца.
 * price: 0 — цена не указана, на сайте пишется «Цена по запросу».
 * Подробная инструкция с описанием каждого поля — в файле README.md.
 */

window.SHOP_CONFIG = {
  demo: false,

  name: "Евро Класс",
  tagline: "Двери и ламинат",
  city: "Душанбе",

  // ДИЗАЙН: "blue" — белый с синей шапкой, "premium" — слоновая кость, тёмно-синий и золото,
  // "light" — белый и строгий, с белой шапкой. Тёмная тема включается кнопкой с луной в любом.
  design: "blue",

  // Логотип: круглая картинка (в подвале, в контактах, в блоке Instagram).
  logo: "img/logo.webp",
  // true — первая буква названия в шапке рисуется красным «€», как на вывеске: €ВРО КЛАСС.
  euroLogo: true,

  // ТЕЛЕФОНЫ. Первый номер — главный: он стоит в шапке сайта.
  // role — подпись над номером. whatsapp: true — у номера есть кнопка WhatsApp
  // (если на номере нет WhatsApp, поставьте false).
  phones: [
    { role: "Директор", phone: "+992 90 797 77 84", whatsapp: true },
    { role: "Менеджер", phone: "+992 55 777 71 17", whatsapp: true },
    { role: "Менеджер", phone: "+992 90 797 77 83", whatsapp: true },
    { role: "Менеджер", phone: "+992 90 720 19 86", whatsapp: true },
  ],
  // Номер, на который приходят заявки из корзины в WhatsApp:
  // только цифры, с кодом страны, без плюса.
  whatsapp: "992907977784",
  // Ник в Telegram без @ (оставьте пустым, если не нужен).
  telegram: "",
  // Ник в Instagram без @ (оставьте пустым, если не нужен).
  instagram: "evroclass_tj",

  // ВИДЕО НА ГЛАВНОЙ
  // Ролики из Instagram: в приложении откройте ролик, нажмите ⋯ → «Копировать ссылку»
  // и вставьте ссылку сюда в кавычках. Сайт покажет ролик прямо на главной.
  // Пример: ["https://www.instagram.com/reel/ABC123/", "https://www.instagram.com/p/XYZ789/"]
  instagramPosts: ["https://www.instagram.com/evroclass_tj/reel/Dc5jb9nMENO/"],
  // Свои видеофайлы: положите .mp4 в папку video/ и перечислите их здесь.
  // Пример: { src: "video/reklama-1.mp4", title: "Входная дверь с терморазрывом" }
  // poster — картинка до запуска видео (необязательно): poster: "video/reklama-1.jpg"
  videos: [],

  address: "г. Душанбе, укажите адрес салона",
  // КАРТА. Кнопка «Как добраться» сама открывает карту телефона: на iPhone — Apple Карты,
  // на Android — выбор приложения (Google Maps, Яндекс Карты, 2ГИС), на компьютере — Google Maps.
  // map — точка салона [широта, долгота]: откройте салон в Google Maps, нажмите на точку
  // и скопируйте два числа, например map: [38.5598, 68.787]. С точкой карта сразу строит маршрут.
  // Пока точки нет, карта ищет салон по названию из mapQuery.
  map: null,
  mapQuery: "Евро Класс, Душанбе",
  hours: [
    ["Пн–Сб", "9:00–19:00"],
    ["Вс", "10:00–16:00"],
  ],

  currency: "смн",

  // Заголовок и текст на главной странице.
  heroTitle: "Двери и ламинат",
  heroSubtitle: "для вашего дома",
  heroText:
    "Межкомнатные двери и ламинат. Соберите сочетание в примерочной: выберите дверь, её цвет, пол и стены — картинка сразу обновится.",

  about:
    "Продаём межкомнатные двери и ламинат. В салоне можно потрогать покрытия, посмотреть образцы ламината при дневном свете и сразу рассчитать заказ вместе с коробкой, наличниками и подложкой.",

  services: [
    {
      icon: "ruler",
      title: "Замер",
      text: "Мастер измерит проёмы и площадь комнат, подскажет размер коробки и нужны ли доборы.",
      // action: "measure" — под услугой кнопка «Вызвать замерщика» (WhatsApp с готовым текстом)
      action: "measure",
    },
    {
      icon: "truck",
      title: "Доставка",
      text: "Привезём двери и ламинат по городу и поднимем на этаж.",
    },
    {
      icon: "tool",
      title: "Установка",
      text: "Установим двери и уложим ламинат, после работы уберём мусор.",
    },
    {
      icon: "shield",
      title: "Гарантия",
      text: "На товары — гарантия производителя, на установку — наша.",
    },
  ],

  // Комплектующие для межкомнатных дверей. Цены — за комплект на одну дверь,
  // 0 — «по запросу». default: true — пункт отмечен сразу.
  doorKit: [
    { id: "frame", name: "Коробка", note: "2,5 стойки", price: 0, default: true },
    { id: "casing", name: "Наличники", note: "с двух сторон, 5 шт", price: 0, default: true },
    { id: "hinges", name: "Петли", note: "2 шт", price: 0, default: true },
    { id: "lock", name: "Замок-защёлка", price: 0, default: true },
    { id: "handle", name: "Ручка", price: 0, default: true },
    { id: "extension", name: "Доборы", note: "если стена толще 7 см", price: 0, default: false },
    { id: "install", name: "Установка", note: "одной двери", price: 0, default: false },
  ],

  // Опции для входных дверей (коробка и замки уже входят в цену двери).
  entranceKit: [
    { id: "slopes", name: "Отделка откосов", note: "МДФ в цвет двери", price: 0, default: false },
    { id: "install", name: "Установка", note: "с демонтажем старой", price: 0, default: false },
  ],

  // Для калькулятора ламината.
  underlay: { name: "Подложка 3 мм", price: 0 }, // за м², 0 — по запросу
  plinth: { name: "Плинтус 2,5 м", price: 0 }, // за штуку, 0 — по запросу

  // Какой ламинат лежит на полу в карточках дверей и какая дверь стоит в карточках ламината.
  cardFloor: "lam-1045",
  cardDoor: "door-classic",
};

/*
 * ДВЕРИ
 * kind: "interior" — межкомнатная, "entrance" — входная.
 * model: рисунок полотна для картинки. Все варианты показаны на странице #constructor.
 * glass: null | "frosted" | "clear" | "bronze" | "black" | "fluted".
 * handle: "chrome" | "satin" | "black" | "gold" | "bronze".
 * finishes: цвета. type: "paint" (эмаль, краска), "wood" (древесный рисунок),
 *           "metal" (порошковая покраска для входных).
 * photos: фотографии для галереи, например ["img/doors/milano-1.jpg"].
 * cutout у цвета — фото полотна с наличниками: с ним дверь в комнате настоящая,
 *         без него сайт рисует дверь по model.
 * price: 0 — «Цена по запросу».
 */
window.SHOP_DOORS = [
  {
    id: "door-classic",
    name: "Классика",
    kind: "interior",
    collection: "Новые двери 2026",
    style: "Неоклассика",
    price: 0,
    badge: "Новинка",
    inStock: true,
    model: "molding-2",
    glass: null,
    handle: "gold",
    // cutout — фото полотна из салона, выпрямленное и с наличниками: так дверь стоит в комнате.
    finishes: [
      {
        name: "Слоновая кость",
        type: "paint",
        color: "#E8E2D2",
        cutout: "img/doors/classic-cream.webp",
      },
      { name: "Белый", type: "paint", color: "#F0F0EE", cutout: "img/doors/classic-white.webp" },
    ],
    sizes: ["600×2000", "700×2000", "800×2000", "900×2000"],
    description:
      "Две филёнки в рамке из трёх рельефных линий. Спокойная неоклассика без лишних деталей — подойдёт и к светлому, и к тёмному полу.",
    features: ["Две филёнки", "Рамка из трёх рельефных линий", "Цвета: слоновая кость и белый"],
    specs: [],
    photos: ["img/doors/photo-classic.webp"],
  },
  {
    id: "door-gold",
    name: "Классика Голд",
    kind: "interior",
    collection: "Новые двери 2026",
    style: "Неоклассика",
    price: 0,
    badge: "Новинка",
    inStock: true,
    model: "molding-2",
    glass: null,
    handle: "gold",
    finishes: [
      { name: "Слоновая кость", type: "paint", color: "#E8E2D2", cutout: "img/doors/gold-cream.webp" },
      { name: "Белый", type: "paint", color: "#F0F0EE", cutout: "img/doors/gold-white.webp" },
    ],
    sizes: ["600×2000", "700×2000", "800×2000", "900×2000"],
    description:
      "Две филёнки, обрамлённые золотыми зеркальными вставками. Золото подчёркивает рисунок двери и хорошо смотрится с золотой фурнитурой.",
    features: ["Две филёнки", "Золотые зеркальные вставки по контуру", "Цвета: слоновая кость и белый"],
    specs: [],
    photos: ["img/doors/photo-gold-cream.webp", "img/doors/photo-gold-white.webp"],
  },
  {
    id: "door-diagonal",
    name: "Диагональ",
    kind: "interior",
    collection: "Новые двери 2026",
    style: "Современный",
    price: 0,
    badge: "Новинка",
    inStock: true,
    model: "lines-l",
    glass: null,
    handle: "gold",
    finishes: [
      {
        name: "Слоновая кость",
        type: "paint",
        color: "#E8E2D2",
        cutout: "img/doors/diag-cream.webp",
        // на этом фото золотая полоса справа, на белой двери — слева
        photoHinge: "right",
      },
      { name: "Белый", type: "paint", color: "#F0F0EE", cutout: "img/doors/diag-white.webp" },
    ],
    sizes: ["600×2000", "700×2000", "800×2000", "900×2000"],
    description:
      "Современная дверь: рельефные диагональные линии в трёх направлениях и вертикальная золотая полоса вдоль полотна.",
    features: ["Рельефные диагональные линии", "Вертикальная золотая полоса", "Цвета: слоновая кость и белый"],
    specs: [],
    photos: ["img/doors/photo-diag-cream.webp", "img/doors/photo-diag-white.webp"],
  },
  {
    id: "door-venzel",
    name: "Вензель",
    kind: "interior",
    collection: "Новые двери 2026",
    style: "Неоклассика",
    price: 0,
    badge: "Новинка",
    inStock: true,
    model: "molding-2",
    glass: null,
    handle: "gold",
    finishes: [
      {
        name: "Слоновая кость, патина золото",
        type: "paint",
        color: "#E8E2D2",
        cutout: "img/doors/ornament-cream.webp",
      },
      {
        name: "Белый, патина серебро",
        type: "paint",
        color: "#F0F0EE",
        cutout: "img/doors/ornament-white.webp",
      },
    ],
    sizes: ["600×2000", "700×2000", "800×2000", "900×2000"],
    description:
      "Две филёнки с тонкой рамкой и вензелем в углах. На двери цвета слоновой кости вензель с золотой патиной, на белой — с серебряной.",
    features: ["Вензель в углах филёнок", "Патина: золото или серебро", "Цвета: слоновая кость и белый"],
    specs: [],
    photos: ["img/doors/photo-ornament-cream.webp", "img/doors/photo-ornament-white.webp"],
  },
];

/*
 * ЛАМИНАТ
 * price — цена за м², 0 — «Цена по запросу».
 * pack: { pcs — досок в упаковке, m2 — м² в упаковке (с этикетки) }.
 *       Если m2 не указан, он считается сам: pcs × длина × ширина.
 * plank: [длина, ширина] доски в мм (необязательно).
 * class — класс износостойкости; если на этикетке нет, не пишите.
 * bevel: "4V" | "2V" | "v" (фаска есть, вид не указан) | "none".
 * pattern: "plank" — доска, "herringbone" — ёлочка, "tile" — плитка (камень, бетон).
 * tone: "light" | "natural" | "dark" | "grey" — для фильтра по цвету.
 * look: как рисовать доску. base — основной цвет, dark — цвет прожилок,
 *       figure: "oak" | "ash" | "walnut" | "pine" | "linear" | "stone",
 *       knots — сучки (0…1).
 * water: true — влагостойкий, false — нет. Не знаете — не пишите.
 */
window.SHOP_LAMINATE = [
  {
    id: "lam-1200",
    name: "Ламинат 1200",
    collection: "Laminate Flooring",
    price: 0,
    inStock: true,
    class: 34,
    thickness: 12,
    bevel: "v",
    // с этикетки: 10 досок, 2,44 м² — уточните, на фото цифры видны плохо
    pack: { pcs: 10, m2: 2.44 },
    pattern: "plank",
    tone: "light",
    look: { base: "#E3E2DC", dark: "#A9A79E", figure: "oak", variation: 0.04 },
    description:
      "Светлый, почти белый ламинат толщиной 12 мм, 34 класс. Доски с фаской, поверхность масленая. Светлый пол делает комнату просторнее.",
    features: ["12 мм, 34 класс", "С фаской", "Масленая поверхность"],
    specs: [["Поверхность", "Масленая"]],
    photos: ["img/laminate/1200.webp", "img/laminate/stand.webp"],
  },
  {
    id: "lam-1040",
    name: "Ламинат 1040",
    collection: "Laminate Flooring",
    price: 0,
    inStock: true,
    class: 34,
    thickness: 12,
    bevel: "v",
    pack: { pcs: 10, m2: 2.928 },
    pattern: "plank",
    tone: "light",
    look: { base: "#E9DBAE", dark: "#C7B382", figure: "oak", variation: 0.05 },
    description:
      "Светлый тёплый ламинат с мягким древесным рисунком, 12 мм, 34 класс. Доски с фаской, поверхность масленая.",
    features: ["12 мм, 34 класс", "С фаской", "Масленая поверхность"],
    specs: [["Поверхность", "Масленая"]],
    photos: ["img/laminate/1040.webp", "img/laminate/stand.webp"],
  },
  {
    id: "lam-1045",
    name: "Ламинат 1045",
    collection: "Laminate Flooring",
    price: 0,
    inStock: true,
    class: 34,
    thickness: 12,
    bevel: "v",
    pack: { pcs: 10, m2: 2.928 },
    pattern: "plank",
    tone: "grey",
    look: { base: "#D6D5C8", dark: "#A8A698", figure: "oak", variation: 0.06 },
    description:
      "Светлый серо-бежевый ламинат с рисунком дерева, 12 мм, 34 класс. Доски с фаской, поверхность масленая.",
    features: ["12 мм, 34 класс", "С фаской", "Масленая поверхность"],
    specs: [["Поверхность", "Масленая"]],
    photos: ["img/laminate/1045.webp", "img/laminate/stand.webp"],
  },
  {
    id: "lam-muh-024",
    name: "Ёлочка MUH-024",
    collection: "Forest",
    price: 0,
    inStock: true,
    // класс на этикетке не указан
    thickness: 12,
    bevel: "none",
    pack: { pcs: 6, m2: 2.972 },
    pattern: "herringbone",
    tone: "natural",
    look: { base: "#958676", dark: "#66574A", figure: "oak", variation: 0.1 },
    description:
      "Рисунок ёлочкой, как у паркета, в тёплом коричневом цвете. Толщина 12 мм, поверхность масленая.",
    features: ["Рисунок ёлочкой", "12 мм", "Масленая поверхность"],
    specs: [["Поверхность", "Масленая"]],
    photos: ["img/laminate/muh-024.webp", "img/laminate/stand.webp"],
  },
];
