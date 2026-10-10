# Tira-Dúvidas IA

Plataforma que resolve questões escolares com IA (Claude). Flask + HTML/CSS/JS puro.

## Rodar

IA gratuita: Groq (plano grátis oficial, aceita foto da questão).
Crie a chave em https://console.groq.com/keys e cole em `GROQ_API_KEY` no `.env`.

```
python -m pip install -r requirements.txt
python app.py
```

Abra http://localhost:5000

## Estrutura

- `app.py` — servidor Flask, rota `/api/perguntar` (texto + foto + histórico)
- `static/` — `index.html`, `style.css`, `app.js`
