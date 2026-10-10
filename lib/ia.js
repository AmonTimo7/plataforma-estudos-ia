// Logica da plataforma, independente de servidor (usada pelo server.js e pela Vercel).

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELO_TEXTO = () => process.env.GROQ_MODELO || "openai/gpt-oss-120b";
const MODELO_VISAO = () => process.env.GROQ_MODELO_VISAO || "qwen/qwen3.8-27b";

const MATERIAS = [
  "Matemática", "Português", "Física", "Química", "Biologia",
  "História", "Geografia", "Inglês", "Redação", "Outra",
];

const SISTEMA = `Você é um tutor escolar paciente e claro, para estudantes brasileiros.
Responda sempre em português do Brasil.

Ao resolver uma questão:
1. Diga em uma frase o que a questão pede.
2. Resolva passo a passo, explicando o raciocínio de cada passo.
3. Termine com a **Resposta final** destacada (e a alternativa, se for múltipla escolha).
4. Se útil, acrescente uma dica curta para lembrar do conceito.

Use Markdown. NUNCA use LaTeX nem barras invertidas. Escreva fórmulas em texto simples (ex.: x^2, raiz(x), a/b, 2x = 8).
Se a pergunta for ambígua ou faltar dado, diga o que falta em vez de inventar.
O objetivo é o estudante aprender o método, então explique sempre.`;

const NIVEIS = {
  fundamental: "Explique de forma simples, para o Ensino Fundamental.",
  medio: "Explique no nível do Ensino Médio.",
  vestibular: "Explique no nível de vestibular/ENEM, citando atalhos e pegadinhas comuns.",
};

const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];

const erro = (status, mensagem) => ({ status, corpo: { erro: mensagem } });

// Recebe o JSON do navegador e devolve { status, corpo }.
async function perguntar(dados = {}) {
  const chave = (process.env.GROQ_API_KEY || "").trim();
  const pergunta = String(dados.pergunta || "").trim();
  const imagem = dados.imagem || null; // { tipo, dados (base64) }

  if (!pergunta && !imagem) return erro(400, "Escreva uma pergunta ou envie uma foto.");
  if (pergunta.length > 3000) return erro(400, "Pergunta muito longa (máx. 3000 caracteres).");
  if (imagem && !TIPOS_IMAGEM.includes(imagem.tipo)) {
    return erro(400, "Formato de imagem não suportado.");
  }
  if (!chave) {
    return erro(503, "Falta a chave gratuita da Groq. Crie em console.groq.com/keys " +
      "e coloque em GROQ_API_KEY no arquivo .env.");
  }

  const materia = MATERIAS.includes(dados.materia) ? dados.materia : "Outra";
  const nivel = NIVEIS[dados.nivel] || NIVEIS.medio;
  const texto = `Matéria: ${materia}\n\n${pergunta || "Resolva a questão da imagem."}`;

  const historico = (Array.isArray(dados.historico) ? dados.historico : [])
    .slice(-10)
    .filter((m) => ["user", "assistant"].includes(m?.papel) && typeof m.texto === "string")
    .map((m) => ({ role: m.papel, content: m.texto }));

  const conteudo = imagem
    ? [
        { type: "text", text: texto },
        { type: "image_url", image_url: { url: `data:${imagem.tipo};base64,${imagem.dados}` } },
      ]
    : texto;

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: imagem ? MODELO_VISAO() : MODELO_TEXTO(),
        temperature: 0.3,
        max_tokens: 4000,
        messages: [
          { role: "system", content: `${SISTEMA}\n\n${nivel}` },
          ...historico,
          { role: "user", content: conteudo },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) {
      console.error("Groq respondeu", r.status, (await r.text()).slice(0, 300));
      return erro(502, "A IA não respondeu agora. Tente de novo em instantes.");
    }
    const json = await r.json();
    const resposta = String(json.choices?.[0]?.message?.content || "")
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim();
    if (!resposta) return erro(502, "A IA devolveu uma resposta vazia. Tente de novo.");
    return { status: 200, corpo: { resposta } };
  } catch (e) {
    console.error("Erro na IA:", e.message);
    return erro(502, "A IA não respondeu agora. Tente de novo em instantes.");
  }
}

module.exports = { perguntar, MATERIAS };
