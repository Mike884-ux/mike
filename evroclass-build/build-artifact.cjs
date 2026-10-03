// Демо-страница для claude.ai: всё в одном файле, без <html>/<head>/<body>,
// с учебным названием «Порог» вместо настоящего магазина.
const fs = require("fs");
const path = require("path");
// Папка сайта и папка для готовых файлов — рядом с этим скриптом.
const SITE = path.join(__dirname, "..", "evroclass") + "/";
const DIST = path.join(__dirname, "dist");
require("fs").mkdirSync(DIST, { recursive: true });

const dir = SITE;
const read = (p) => fs.readFileSync(dir + p, "utf8");
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const inlineImages = (js) =>
  js.replace(/"(img\/[\w\/.-]+\.(png|jpe?g|webp))"/g, (m, p, ext) =>
    fs.existsSync(dir + p)
      ? '"data:' + MIME[ext] + ";base64," + fs.readFileSync(dir + p).toString("base64") + '"'
      : m);
const FONT =
  "https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600&family=Onest:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

const index = read("index.html");
let body = index.slice(index.indexOf("<body>") + 6, index.indexOf("</body>"));

// Учебный салон: без настоящего названия, логотипа, телефонов и Instagram.
const swap = (src, from, to) => {
  if (!from.test(src)) throw new Error("не нашёл в data.js: " + from);
  return src.replace(from, to);
};
let demoData = read("js/data.js");
demoData = swap(demoData, /name: "Евро Класс"/, 'name: "ПОРОГ"');
demoData = swap(demoData, /logo: "img\/logo\.webp"/, 'logo: ""');
demoData = swap(demoData, /euroLogo: true/, "euroLogo: false");
demoData = swap(
  demoData,
  /phones: \[[\s\S]*?\n  \],/,
  'phones: [\n    { role: "Салон", phone: "+992 00 000 00 00", whatsapp: true },\n    { role: "Менеджер", phone: "+992 00 000 00 01", whatsapp: true },\n  ],',
);
demoData = swap(demoData, /whatsapp: "\d+"/, 'whatsapp: "992000000000"');
demoData = swap(demoData, /instagram: "evroclass_tj"/, 'instagram: ""');
demoData = swap(demoData, /mapQuery: "Евро Класс, Душанбе"/, 'mapQuery: ""');
demoData = swap(demoData, /instagramPosts: \[[^\]]*\]/, "instagramPosts: []");
demoData = inlineImages(demoData);

body = body.replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g, (m, p) => {
  let src = p === "js/data.js" ? demoData : read(p);
  if (p === "js/i18n.js") src = src.replace(/^\s*\["Евро Класс".*\],\n/m, "");
  // учебное название тоже переводится: POROG по-английски
  if (p === "js/i18n.js") src += '\nwindow.SHOP_I18N.strings.push(["ПОРОГ", "POROG", "ПОРОГ"]);';
  return "<script>\n" + src + "\n</script>";
});

const out =
  "<title>Салон «Порог»</title>\n" +
  '<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
  "<style>\n" +
  read("css/style.css") +
  "\n</style>\n<style>\n" +
  read("css/scene.css") +
  "\n</style>\n" +
  "<script>\n" +
  "  try {\n" +
  '    var t = localStorage.getItem("theme");\n' +
  '    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);\n' +
  "  } catch (e) {}\n" +
  '  window.addEventListener("load", function () {\n' +
  '    var l = document.createElement("link");\n' +
  '    l.rel = "stylesheet";\n' +
  '    l.href = "' +
  FONT +
  '";\n' +
  "    document.head.appendChild(l);\n" +
  "  });\n" +
  "</script>\n" +
  body.trim() +
  "\n";

if (/src="js\/|href="css\/|EVRO|evroclass|Евро|797 77|777 71|720 19|logo\.webp/i.test(out))
  throw new Error("остались ссылки на файлы или настоящий бренд");
fs.writeFileSync(path.join(DIST, "salon-porog.html"), out);
console.log("evroclass-build/dist/salon-porog.html", (out.length / 1024).toFixed(0) + " KB");
