# Tira-Dúvidas IA

Plataforma que resolve questões escolares com IA gratuita (Groq). 100% JavaScript, sem dependências.

## Rodar no seu computador

Precisa do Node 20 ou mais novo. Crie o arquivo `.env` com a chave gratuita da Groq
(https://console.groq.com/keys):

```
GROQ_API_KEY=cole-sua-chave-aqui
```

```
npm start
```

Abra http://localhost:5000

## Colocar online (Vercel, grátis)

1. Em https://vercel.com, importe este repositório do GitHub.
2. Em *Settings > Environment Variables*, crie `GROQ_API_KEY` com a sua chave.
3. Deploy. A Vercel serve `public/` e transforma `api/*.js` em funções.

## Estrutura

- `public/` — tela (HTML, CSS e JS do navegador)
- `lib/ia.js` — lógica: validação, prompt do tutor e chamada à Groq
- `server.js` — servidor local (sem dependências)
- `api/` — as mesmas rotas como funções da Vercel
