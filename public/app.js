const conversa = document.getElementById("conversa");
const vazio = document.getElementById("vazio");
const form = document.getElementById("form");
const campo = document.getElementById("pergunta");
const botao = document.getElementById("enviar");
const arquivo = document.getElementById("arquivo");
const previa = document.getElementById("previa");
const previaImg = document.getElementById("previa-img");

const MAX_IMG = 4 * 1024 * 1024; // 4 MB
let imagem = null; // {tipo, dados}
let historico = [];

fetch("/api/materias")
  .then((r) => r.json())
  .then((lista) => {
    document.getElementById("materia").innerHTML = lista
      .map((m) => `<option>${m}</option>`)
      .join("");
  });

// ---------- Markdown minimo e seguro (escapa HTML antes) ----------
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// Rede de seguranca: se a IA escapar com LaTeX, vira texto legivel.
function limpaLatex(t) {
  const troca = [
    ["\\Rightarrow", "⇒"], ["\\rightarrow", "→"], ["\\times", "×"], ["\\cdot", "·"],
    ["\\div", "÷"], ["\\neq", "≠"], ["\\leq", "≤"], ["\\geq", "≥"], ["\\approx", "≈"],
    ["\\pi", "π"], ["\\quad", " "], ["\\,", " "],
  ];
  for (const [de, para] of troca) t = t.split(de).join(para);
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\\(?:boxed|text|mathrm)\{([^{}]*)\}/g, "$1")
         .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
         .replace(/\\sqrt\{([^{}]*)\}/g, "raiz($1)");
  }
  return t.replace(/\\[()[\]]/g, "").replace(/\$\$/g, "");
}

function markdown(texto) {
  const linhas = esc(limpaLatex(texto)).split("\n");
  let html = "";
  let lista = null; // "ol" | "ul"
  let codigo = false;

  const fechaLista = () => {
    if (lista) { html += `</${lista}>`; lista = null; }
  };

  for (const l of linhas) {
    if (l.trim().startsWith("```")) {
      fechaLista();
      html += codigo ? "</pre>" : "<pre>";
      codigo = !codigo;
      continue;
    }
    if (codigo) { html += l + "\n"; continue; }

    let m;
    if (/^\s*-{3,}\s*$/.test(l)) {
      fechaLista();
      html += "<hr>";
    } else if ((m = l.match(/^(#{1,3})\s+(.*)/))) {
      fechaLista();
      html += `<h3>${inline(m[2])}</h3>`;
    } else if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)/))) {
      // start=N mantem a numeracao quando a IA poe texto entre os itens
      if (lista !== "ol") { fechaLista(); html += `<ol start="${m[1]}">`; lista = "ol"; }
      html += `<li>${inline(m[2])}</li>`;
    } else if ((m = l.match(/^\s*[-*]\s+(.*)/))) {
      if (lista !== "ul") { fechaLista(); html += "<ul>"; lista = "ul"; }
      html += `<li>${inline(m[1])}</li>`;
    } else if (l.trim() === "") {
      fechaLista();
    } else {
      fechaLista();
      html += `<p>${inline(l)}</p>`;
    }
  }
  fechaLista();
  if (codigo) html += "</pre>";
  return html;
}

// ---------- UI ----------
const ICONE_IA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/></svg>';
const PONTINHOS = '<span class="digitando" aria-label="Pensando"><i></i><i></i><i></i></span>';

// Cria a linha da mensagem e devolve o balao (.msg)
function addMsg(autor, conteudoHtml) {
  vazio.hidden = true;
  const linha = document.createElement("div");
  linha.className = "linha " + autor;
  linha.innerHTML =
    (autor === "ia" ? `<div class="avatar">${ICONE_IA}</div>` : "") +
    `<div class="msg">${conteudoHtml}</div>`;
  conversa.appendChild(linha);
  linha.scrollIntoView({ behavior: "smooth", block: "end" });
  return linha.querySelector(".msg");
}

function ajustaAltura() {
  if (!campo.value) { campo.style.height = ""; return; } // volta a 1 linha
  campo.style.height = "auto";
  campo.style.height = Math.min(campo.scrollHeight, 180) + "px";
}
campo.addEventListener("input", ajustaAltura);

function limparImagem() {
  imagem = null;
  arquivo.value = "";
  previa.hidden = true;
}

arquivo.addEventListener("change", () => {
  const f = arquivo.files[0];
  if (!f) return;
  if (f.size > MAX_IMG) {
    alert("A foto passa de 4 MB. Tente uma menor.");
    limparImagem();
    return;
  }
  const leitor = new FileReader();
  leitor.onload = () => {
    previaImg.src = leitor.result;
    imagem = { tipo: f.type, dados: leitor.result.split(",")[1] };
    previa.hidden = false;
  };
  leitor.readAsDataURL(f);
});

document.getElementById("remover-img").addEventListener("click", limparImagem);

document.getElementById("limpar").addEventListener("click", () => {
  historico = [];
  conversa.querySelectorAll(".linha").forEach((n) => n.remove());
  vazio.hidden = false;
  limparImagem();
  campo.value = "";
  ajustaAltura();
});

// Cartoes de sugestao: preenchem a pergunta e a materia
document.querySelectorAll(".cartao-sug").forEach((b) =>
  b.addEventListener("click", () => {
    campo.value = b.dataset.texto;
    const sel = document.getElementById("materia");
    if ([...sel.options].some((o) => o.value === b.dataset.materia)) sel.value = b.dataset.materia;
    ajustaAltura();
    form.requestSubmit();
  })
);

campo.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pergunta = campo.value.trim();
  if (!pergunta && !imagem) return;
  if (botao.disabled) return;

  const enviada = imagem;
  addMsg("user", (enviada ? `<img src="${previaImg.src}" alt="Foto enviada">` : "") + esc(pergunta));
  const espera = addMsg("ia", PONTINHOS);

  campo.value = "";
  ajustaAltura();
  limparImagem();
  botao.disabled = true;

  try {
    const r = await fetch("/api/perguntar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pergunta,
        imagem: enviada,
        materia: document.getElementById("materia").value,
        nivel: document.getElementById("nivel").value,
        historico,
      }),
    });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro || "Erro inesperado.");

    espera.innerHTML = markdown(dados.resposta);
    historico.push({ papel: "user", texto: pergunta || "(foto)" });
    historico.push({ papel: "assistant", texto: dados.resposta });
  } catch (err) {
    espera.classList.add("erro");
    espera.textContent = err.message;
  } finally {
    botao.disabled = false;
    campo.focus();
    espera.scrollIntoView({ behavior: "smooth", block: "end" });
  }
});
