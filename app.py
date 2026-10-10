import json
import os
import re
import urllib.error
import urllib.request

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

load_dotenv()

app = Flask(__name__, static_folder="static", static_url_path="")

# Provedor de IA gratuito: Groq (plano gratis oficial, aceita foto).
# Chave gratis em https://console.groq.com/keys -> GROQ_API_KEY no .env
GROQ_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELO = os.getenv("GROQ_MODELO", "openai/gpt-oss-120b")
GROQ_MODELO_VISAO = os.getenv("GROQ_MODELO_VISAO", "qwen/qwen3.8-27b")

MATERIAS = [
    "Matemática", "Português", "Física", "Química", "Biologia",
    "História", "Geografia", "Inglês", "Redação", "Outra",
]

SISTEMA = """Você é um tutor escolar paciente e claro, para estudantes brasileiros.
Responda sempre em português do Brasil.

Ao resolver uma questão:
1. Diga em uma frase o que a questão pede.
2. Resolva passo a passo, explicando o raciocínio de cada passo.
3. Termine com a **Resposta final** destacada (e a alternativa, se for múltipla escolha).
4. Se útil, acrescente uma dica curta para lembrar do conceito.

Use Markdown. NUNCA use LaTeX nem barras invertidas. Escreva fórmulas em texto simples (ex.: x^2, raiz(x), a/b, 2x = 8).
Se a pergunta for ambígua ou faltar dado, diga o que falta em vez de inventar.
O objetivo é o estudante aprender o método, então explique sempre."""

NIVEIS = {
    "fundamental": "Explique de forma simples, para o Ensino Fundamental.",
    "medio": "Explique no nível do Ensino Médio.",
    "vestibular": "Explique no nível de vestibular/ENEM, citando atalhos e pegadinhas comuns.",
}


class ErroIA(Exception):
    pass


def chamar_groq(system, historico, pergunta, imagem):
    if imagem:
        conteudo = [
            {"type": "text", "text": pergunta},
            {"type": "image_url",
             "image_url": {"url": f"data:{imagem['tipo']};base64,{imagem['dados']}"}},
        ]
        modelo = GROQ_MODELO_VISAO
    else:
        conteudo, modelo = pergunta, GROQ_MODELO

    corpo = {
        "model": modelo,
        "temperature": 0.3,
        "max_tokens": 4000,
        "messages": [{"role": "system", "content": system}, *historico,
                     {"role": "user", "content": conteudo}],
    }
    req = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(corpo).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_KEY}", "User-Agent": "Mozilla/5.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            texto = json.load(r)["choices"][0]["message"]["content"] or ""
            return re.sub(r"<think>.*?</think>", "", texto, flags=re.S).strip()
    except urllib.error.HTTPError as e:
        raise ErroIA(f"Groq respondeu {e.code}") from e
    except (urllib.error.URLError, KeyError, ValueError, TimeoutError) as e:
        raise ErroIA(str(e)) from e


@app.get("/")
def index():
    return send_from_directory("static", "index.html")


@app.get("/api/materias")
def materias():
    return jsonify(MATERIAS)


@app.post("/api/perguntar")
def perguntar():
    dados = request.get_json(silent=True) or {}
    pergunta = (dados.get("pergunta") or "").strip()
    imagem = dados.get("imagem")  # {"tipo": "image/png", "dados": "<base64>"}
    if not pergunta and not imagem:
        return jsonify(erro="Escreva uma pergunta ou envie uma foto."), 400
    if len(pergunta) > 3000:
        return jsonify(erro="Pergunta muito longa (máx. 3000 caracteres)."), 400
    if imagem:
        if imagem.get("tipo") not in ("image/png", "image/jpeg", "image/webp"):
            return jsonify(erro="Formato de imagem não suportado."), 400

    if not GROQ_KEY:
        return jsonify(erro="Falta a chave gratuita da Groq. Crie em console.groq.com/keys "
                            "e coloque em GROQ_API_KEY no arquivo .env."), 503

    materia = dados.get("materia") if dados.get("materia") in MATERIAS else "Outra"
    nivel = NIVEIS.get(dados.get("nivel"), NIVEIS["medio"])
    system = f"{SISTEMA}\n\n{nivel}"
    texto_pergunta = f"Matéria: {materia}\n\n{pergunta or 'Resolva a questão da imagem.'}"

    historico = [
        {"role": m["papel"], "content": m["texto"]}
        for m in (dados.get("historico") or [])[-10:]
        if m.get("papel") in ("user", "assistant") and isinstance(m.get("texto"), str)
    ]

    try:
        resposta = chamar_groq(system, historico, texto_pergunta, imagem)
    except ErroIA:
        app.logger.exception("Erro na IA")
        return jsonify(erro="A IA não respondeu agora. Tente de novo em instantes."), 502

    return jsonify(resposta=resposta)


if __name__ == "__main__":
    app.run(debug=True, port=5000)

