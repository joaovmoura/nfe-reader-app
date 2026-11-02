# NFe Reader — app de preços de mercado

PWA de uso doméstico que extrai os itens de cupons fiscais (NFC-e da Paraíba) a partir de imagens, guarda os preços e mostra quando um produto subiu, qual mercado compensa mais e como dois mercados se comparam.

- Requisitos completos: `docs/requisitos.md` (fonte da verdade; os IDs RF01–RF15 são referenciados aqui e nos commits).
- Roteiro de implementação por etapas: `docs/roteiro.md`. Trabalhe uma etapa por vez, na ordem.

## Sobre quem desenvolve

O dono do projeto é engenheiro backend experiente (Ruby on Rails, PostgreSQL, MongoDB), mas **não tem experiência com front-end**. Por isso:

- Explique as decisões de React/TypeScript/CSS quando introduzir um conceito novo (hooks, estado, roteamento, build), em poucas linhas.
- Prefira soluções simples e bibliotecas consolidadas. Não adicione dependência sem dizer para que serve.
- Ao terminar uma etapa, diga como testar manualmente no navegador e no celular.

## Stack

| Camada | Escolha |
| --- | --- |
| Front | React + Vite + TypeScript, PWA (`vite-plugin-pwa`) |
| Hospedagem do front | GitHub Pages, deploy via GitHub Actions |
| Banco e login | Supabase (Postgres + Auth), cliente `@supabase/supabase-js` |
| IA | Gemini Flash (plano gratuito), chamado **somente** por uma Supabase Edge Function |
| Keep-alive | GitHub Actions com cron diário consultando o banco (o Supabase gratuito pausa após 7 dias de pouca atividade) |

## Regras inegociáveis

- **A chave do Gemini nunca vai para o front nem para o repositório.** Ela fica nos secrets do Supabase (`npx supabase secrets set GEMINI_API_KEY=...`) e só a Edge Function a lê.
- A `publishable key` (antiga `anon key`) e a URL do Supabase podem ir no front (são públicas por design); a proteção dos dados vem do **RLS**, que deve estar ligado em todas as tabelas.
- `.env`, `.env.local` e similares ficam no `.gitignore`. Use `.env.example` para documentar as variáveis.
- **Não persistir CPF do consumidor**, mesmo que apareça na imagem ou na resposta da IA. O prompt da extração também deve instruir o modelo a não retorná-lo.
- Imagens de cupom usadas como fixture de teste devem estar com o CPF recortado.
- Uma única conta compartilhada pela casa; não é preciso registrar quem enviou cada cupom.

## Convenções

- Código, nomes de tabelas, colunas, funções e commits técnicos em **inglês**; textos da interface em **português (pt-BR)**.
- Valores monetários em centavos (`integer`) ou `numeric(12,2)` no banco — nunca `float`.
- Datas com fuso: armazenar `timestamptz`; exibir em `America/Sao_Paulo`.
- Mudanças de schema sempre por migration versionada em `supabase/migrations/`, nunca editando o banco pelo painel.
- Regras de domínio puras (normalização por kg/L, cálculo de alta/baixa, parsing de chave de acesso) em funções isoladas com testes em Vitest.
- Commits pequenos, mencionando o RF quando aplicável (ex.: `feat(RF03): reject duplicate access key`).

## GitHub Pages

- O site fica em `https://joaovmoura.github.io/nfe-reader-app/`, então o Vite precisa de `base: '/nfe-reader-app/'`.
- O Pages não tem fallback de rotas para SPA: use `HashRouter` (ou copie `index.html` para `404.html` no build).
- O manifest e o service worker do PWA também precisam respeitar esse `base`.

## Regras de domínio que afetam o código

- **Mercado = CNPJ completo** (cada filial é um mercado). O nome na nota é a razão social; o usuário dá um apelido na primeira compra (RF04).
- **Chave de acesso (44 dígitos) é única** por compra; um segundo envio da mesma nota é recusado (RF03).
- **Código do item é interno da rede e pode vir truncado no print.** Use-o só junto com o CNPJ/raiz do CNPJ para a memória de classificação (RF06); entre mercados, quem liga os produtos é a **classe**.
- **Classe** distingue tipo (arroz branco ≠ integral ≠ parboilizado). **Categorias amplas**: Não perecíveis, Laticínios e frios, Carnes, Perecíveis, Hortifruti, Bebidas, Limpeza e higiene.
- **Normalização (RF08):** itens em KG já vêm com preço/kg; itens por unidade só normalizam quando o tamanho da embalagem for informado (o app pergunta na primeira vez e lembra).
- **Alta/baixa (RF10):** referência = mediana do preço normalizado da classe nos últimos 3 meses, todos os mercados; alta ≥ +20%, baixa ≤ −20% (limite configurável); com menos de duas compras da classe, não marca nada.
- O preço comparado é o **valor unitário efetivamente pago**.

## Comandos

Atualize esta seção conforme os comandos forem criados.

- `npm run dev` — servidor local (http://localhost:5173/nfe-reader-app/)
- `npm run build` — build de produção (checa tipos com `tsc` e gera `dist/`)
- `npm run preview` — serve o `dist/` localmente, com service worker ativo
- `npm test` — testes (Vitest); `npm run test:watch` para modo contínuo
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- O Supabase CLI é dependência de dev do projeto: sempre rode como `npx supabase ...` (ambiente: WSL + Docker Desktop)
- `npx supabase start` / `npx supabase db reset` — banco local
- `npx supabase migration new <nome>` — nova migration
- `npx supabase db push` — aplica as migrations pendentes no projeto remoto (linkado)
- `npx supabase functions serve` / `npx supabase functions deploy <nome>` — Edge Functions
