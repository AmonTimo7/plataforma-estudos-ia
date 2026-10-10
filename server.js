// Servidor local, sem dependencias: node --env-file=.env server.js
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { perguntar, MATERIAS } = require("./lib/ia");

const PORTA = process.env.PORT || 5000;
const PUBLICO = path.join(__dirname, "public");
const MAX_CORPO = 8 * 1024 * 1024; // foto de ate 4 MB vira ~5,5 MB em base64

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function json(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on("data", (p) => {
      tamanho += p.length;
      if (tamanho > MAX_CORPO) { reject(new Error("grande")); req.destroy(); return; }
      partes.push(p);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(partes).toString() || "{}")); }
      catch { reject(new Error("json")); }
    });
    req.on("error", reject);
  });
}

const servidor = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  if (pathname === "/api/materias" && req.method === "GET") return json(res, 200, MATERIAS);

  if (pathname === "/api/perguntar" && req.method === "POST") {
    let dados;
    try { dados = await lerCorpo(req); }
    catch (e) {
      return json(res, e.message === "grande" ? 413 : 400,
        { erro: e.message === "grande" ? "Foto grande demais." : "Pedido inválido." });
    }
    const { status, corpo } = await perguntar(dados);
    return json(res, status, corpo);
  }

  if (req.method !== "GET") return json(res, 405, { erro: "Método não permitido." });

  // arquivos estaticos (sem sair da pasta public)
  const arquivo = path.normalize(path.join(PUBLICO, pathname === "/" ? "index.html" : pathname));
  if (!arquivo.startsWith(PUBLICO + path.sep)) return json(res, 403, { erro: "Proibido." });
  fs.readFile(arquivo, (err, conteudo) => {
    if (err) return json(res, 404, { erro: "Não encontrado." });
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream" });
    res.end(conteudo);
  });
});

servidor.listen(PORTA, () => console.log(`Rodando em http://localhost:${PORTA}`));
