// Сайт «Евро Класс» для claude.ai: всё в одном файле, без <html>/<head>/<body>.
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

let demoData = inlineImages(read("js/data.js"));

body = body.replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g, (m, p) => {
  let src = p === "js/data.js" ? demoData : read(p);
  return "<script>\n" + src + "\n</script>";
});

const out =
  "<title>Евро Класс</title>\n" +
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

if (/src="js\/|href="css\//.test(out)) throw new Error("остались ссылки на файлы");
fs.writeFileSync(path.join(DIST, "evroclass-live.html"), out);
console.log("evroclass-build/dist/evroclass-live.html", (out.length / 1024).toFixed(0) + " KB");
