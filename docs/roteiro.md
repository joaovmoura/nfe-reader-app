# Roteiro de implementação

Uma etapa por sessão do Claude Code, na ordem. Em cada uma:

1. Faça antes o que estiver em **Você faz antes** (coisas que dependem da sua conta ou do celular).
2. Abra o Claude Code na raiz do repo e entre no modo de planejamento.
3. Cole o **Prompt**, revise o plano, ajuste o que quiser e só então aprove a implementação.
4. Confira o **Pronto quando** antes de commitar e seguir.

---

## Etapa 0 — Contas e acessos (só você)

- [ ] Criar um projeto no [Supabase](https://supabase.com) (região São Paulo) e anotar a URL e a `anon key`.
- [ ] Gerar uma chave do Gemini no [Google AI Studio](https://aistudio.google.com).
- [ ] No GitHub, em *Settings → Pages*, escolher **GitHub Actions** como fonte.
- [ ] Instalar Node.js LTS e o [Supabase CLI](https://supabase.com/docs/guides/cli) na máquina.

---

## Etapa 1 — Esqueleto do projeto e deploy

**Prompt**

> Leia `CLAUDE.md` e `docs/requisitos.md`. Crie o esqueleto do app com React + Vite + TypeScript, configurado como PWA instalável (`vite-plugin-pwa`), com `base` correto para o GitHub Pages e `HashRouter`. Inclua ESLint, Prettier, Vitest, `.gitignore`, `.env.example` e um workflow do GitHub Actions que faz build e publica no Pages a cada push na `main`. A tela inicial pode ser só um "Olá" em português. Me explique a estrutura de pastas que você escolheu.

**Pronto quando**

- `npm run dev` abre o app localmente.
- O push na `main` publica em `https://joaovmoura.github.io/nfe-reader-app/`.
- No celular, o navegador oferece "Adicionar à tela inicial".

---

## Etapa 2 — Banco de dados e keep-alive

**Você faz antes:** `supabase login` e `supabase link` com o projeto da etapa 0.

**Prompt**

> Leia `CLAUDE.md` e `docs/requisitos.md`, especialmente "Regras de negócio". Proponha o schema do Postgres para o MVP antes de escrever qualquer migration. Ele precisa cobrir: mercados (por CNPJ, com apelido), compras (chave de acesso única, data, totais, desconto geral, forma de pagamento), itens da compra (código, descrição, quantidade, unidade, valor unitário, valor total), classes e categorias, memória de classificação (código do item + CNPJ/raiz → classe), tamanho de embalagem lembrado por produto, e a configuração do limite de alta/baixa. Pense em como as consultas de histórico (mediana de 3 meses por classe) e de comparação entre mercados vão ficar. Depois de eu aprovar, crie as migrations com RLS em todas as tabelas, um seed com as 7 categorias, e um workflow do GitHub Actions com cron diário que faz uma consulta leve ao banco para evitar a pausa do plano gratuito.

**Pronto quando**

- `supabase db reset` sobe o banco local sem erro e com as categorias.
- As migrations foram aplicadas no projeto remoto.
- O workflow de keep-alive rodou com sucesso pelo menos uma vez (dá para disparar manualmente).

---

## Etapa 3 — Login com a conta compartilhada

**Você faz antes:** criar o usuário da casa em *Authentication → Users* no painel do Supabase e desligar o cadastro público.

**Prompt**

> Implemente login por e-mail e senha com o Supabase Auth para a conta única da casa. Sem tela de cadastro. Rotas internas só acessíveis logado; sessão persistida entre aberturas do PWA. Ajuste as policies de RLS para permitir acesso apenas a usuários autenticados.

**Pronto quando**

- Sem login, nada além da tela de entrada é acessível.
- Fechar e reabrir o PWA mantém a sessão.

---

## Etapa 4 — Envio do cupom e extração por IA (RF01–RF03)

**Você faz antes:** `supabase secrets set GEMINI_API_KEY=...`. Separe o print do cupom com o CPF recortado para usar como teste.

**Prompt**

> Implemente RF01 a RF03. No front: escolher imagem da galeria ou câmera, passo de recorte (biblioteca pronta) e envio. No backend: uma Edge Function que recebe a imagem, chama o Gemini Flash pedindo saída em JSON estruturado com um schema explícito (mercado, CNPJ, endereço, data/hora, chave de acesso, itens, totais, desconto, forma de pagamento; sem CPF), valida a resposta e grava compra e itens. Recuse com mensagem clara uma chave de acesso já existente. Crie testes para a validação do JSON e para o parsing da chave de acesso. Use a imagem em `fixtures/` (com CPF recortado) para um teste manual de ponta a ponta.

**Pronto quando**

- O cupom de exemplo vira uma compra com os 58 itens e o total de R$ 813,15.
- Reenviar o mesmo cupom mostra o aviso de duplicidade.
- A chave do Gemini não aparece em nenhum arquivo do front nem no repo.

---

## Etapa 5 — Mercados e classificação (RF04–RF07)

**Prompt**

> Implemente RF04 a RF07. Na primeira compra de um CNPJ, pedir o apelido do mercado. Na extração, a IA também sugere classe e categoria de cada item; antes de chamar a IA, consulte a memória de classificação (código + CNPJ/raiz) e use a classe lembrada quando houver. Crie uma tela de detalhe da compra onde dá para editar descrição, quantidade, preço, classe e categoria de qualquer item; ao corrigir a classe, salve na memória.

**Pronto quando**

- Um segundo cupom do mesmo mercado reaproveita as classes corrigidas.
- É possível renomear um mercado e corrigir um item depois de salvo.

---

## Etapa 6 — Normalização e tabela de preços (RF08–RF09)

**Prompt**

> Implemente RF08 e RF09. Itens em KG usam o próprio valor unitário como preço/kg. Para itens por unidade sem tamanho conhecido, pergunte o tamanho da embalagem (g, kg, ml, l) e lembre por produto; sem essa informação, não normalize. Crie a tabela de preços com filtros por item ou classe, mercado e período, mostrando preço pago e preço normalizado. Coloque a lógica de normalização em funções puras com testes.

**Pronto quando**

- Extrato de tomate e molhos aparecem com preço/kg depois de informado o tamanho.
- Os filtros combinam entre si.

---

## Etapa 7 — Histórico e comparação (RF10–RF11)

**Prompt**

> Implemente RF10 e RF11 seguindo exatamente a regra de alta/baixa descrita no `CLAUDE.md`. Histórico: gráfico da evolução do preço normalizado por classe e por produto, com o destaque de alta ou baixa no preço mais recente e o limite configurável numa tela de ajustes. Comparação: escolher dois mercados e ver, lado a lado, as classes compradas nos dois e qual sai mais barato, além de um resumo de qual mercado compensa mais no período. Teste a função de alta/baixa com casos de borda (menos de duas compras, exatamente 20%, promoção isolada).

**Pronto quando**

- Uma classe com preço 20% acima da mediana aparece como "em alta".
- A comparação entre dois mercados mostra só as classes em comum.

---

## Depois do MVP

Na ordem sugerida: RF13 (entrada manual, também para lançar os últimos 3 meses), RF12 (notinha de descontos), RF14 (resumo de gastos), RF15 (leitura pela URL do QR).
