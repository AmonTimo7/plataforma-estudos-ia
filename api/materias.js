// Funcao serverless da Vercel: GET /api/materias
const { MATERIAS } = require("../lib/ia");

module.exports = (req, res) => res.status(200).json(MATERIAS);
