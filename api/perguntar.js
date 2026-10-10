// Funcao serverless da Vercel: POST /api/perguntar
const { perguntar } = require("../lib/ia");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST." });
  const { status, corpo } = await perguntar(req.body);
  res.status(status).json(corpo);
};
