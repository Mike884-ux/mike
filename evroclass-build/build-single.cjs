// Весь сайт одним файлом evroclass.html: открывается двойным щелчком, без интернета.
const fs = require("fs");
const path = require("path");
// Папка сайта и папка для готовых файлов — рядом с этим скриптом.
const SITE = path.join(__dirname, "..", "evroclass") + "/";
const DIST = path.join(__dirname, "dist");
require("fs").mkdirSync(DIST, { recursive: true });

const [dir, out] = [SITE, path.join(DIST, "evroclass.html")];
const read = (p) => fs.readFileSync(dir + p, "utf8");
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const inlineImages = (js) =>
  js.replace(/"(img\/[\w\/.-]+\.(png|jpe?g|webp))"/g, (m, p, ext) =>
    fs.existsSync(dir + p)
      ? '"data:' + MIME[ext] + ";base64," + fs.readFileSync(dir + p).toString("base64") + '"'
      : m);
let html = read("index.html");
const fav = "data:image/svg+xml;base64," + Buffer.from(read("favicon.svg")).toString("base64");
html = html.replace(/<link rel="icon" href="favicon\.svg"[^>]*>/, `<link rel="icon" href="${fav}" type="image/svg+xml" />`);
html = html.replace(/<link rel="apple-touch-icon" href="(img\/[\w.-]+\.png)" \/>/, (m, p) =>
  fs.existsSync(dir + p)
    ? '<link rel="apple-touch-icon" href="data:image/png;base64,' + fs.readFileSync(dir + p).toString("base64") + '" />'
    : "");
html = html.replace(/<link rel="stylesheet" href="(css\/[\w.-]+\.css)" \/>/g, (m, p) => "<style>\n" + read(p) + "\n</style>");
html = html.replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g, (m, p) => "<script>\n" + (p === "js/data.js" ? inlineImages(read(p)) : read(p)) + "\n</script>");
if (/href="css\/|src="js\/|favicon\.svg/.test(html)) throw new Error("не всё встроено");
fs.writeFileSync(out, html);
console.log(path.relative(process.cwd(), out), (html.length / 1024).toFixed(0) + " KB");
