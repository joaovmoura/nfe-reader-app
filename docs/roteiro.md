# Roteiro de implementação

Uma etapa por sessão do Claude Code, na ordem. Em cada uma:

1. Faça antes o que estiver em **Você faz antes** (coisas que dependem da sua conta ou do celular).
2. Abra o Claude Code na raiz do repo e entre no modo de planejamento.
3. Cole o **Prompt**, revise o plano, ajuste o que quiser e só então aprove a implementação.
4. Confira o **Pronto quando** antes de commitar e seguir.

---

## Etapa 0 — Contas e acessos (só você)

- [ ] Criar um projeto no [Supabase](https://supabase.com) (região São Paulo) e anotar a URL e a publishable key.
- [ ] Gerar uma chave do Gemini no [Google AI Studio](https://aistudio.google.com).
- [ ] No GitHub, em *Settings → Pages*, escolher **GitHub Actions** como fonte.
- [ ] Instalar Node.js LTS e o [Supabase CLI](https://supabase.com/docs/guides/cli) na máquina.
- [ ] Instalar o Docker Desktop: o Supabase CLI precisa dele para rodar o banco local (`supabase start`, `supabase db reset`).

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

**Você faz antes**

- `npx supabase login`, `npx supabase init`, `npx supabase link --project-ref <id-do-projeto>`.
- Docker Desktop aberto e `npx supabase start` rodando (confira com `npx supabase status`).
- `git pull` para o Claude Code ler a versão atual do `CLAUDE.md` e deste roteiro.
- Os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` cadastrados no GitHub (já usados pelo deploy).

**Prompt**

```text
Leia o CLAUDE.md e o docs/requisitos.md inteiros, com atenção a "Regras de negócio e o cupom da PB" e aos requisitos RF02 a RF11. Esta é a etapa 2 do docs/roteiro.md: banco de dados e keep-alive. O Supabase local já está rodando (npx supabase start) e o projeto está linkado ao remoto.

Trabalhe em duas fases. Não crie nem edite nenhum arquivo na fase 1.

## Fase 1 — Proposta do schema (só plano, sem arquivos)

Me apresente:

1. Um diagrama ER em Mermaid e, para cada tabela: colunas, tipos, nulabilidade, chaves, constraints (unique, check, FKs com a regra de ON DELETE) e índices, com uma linha justificando cada decisão não óbvia.
2. O que o schema precisa cobrir:
   - Mercados: CNPJ completo (14 dígitos) identifica a filial; guardar também a raiz (8 primeiros dígitos) para agrupar a rede; razão social, endereço e apelido dado pelo usuário.
   - Compras: chave de acesso de 44 dígitos única, data/hora de emissão (timestamptz), mercado, total dos produtos, desconto geral, total pago e forma de pagamento.
   - Itens da compra: número da linha, código do item, descrição como veio na nota, quantidade, unidade original (UND, KG, PCT, BDJ, MCO, PTE...), valor unitário e valor total. O mesmo produto pode aparecer em mais de uma linha da mesma compra.
   - Classes de produto (ex.: arroz branco, arroz integral) ligadas a uma categoria ampla.
   - Categorias: exatamente estas 7 — Não perecíveis, Laticínios e frios, Carnes, Perecíveis, Hortifruti, Bebidas, Limpeza e higiene.
   - Memória de classificação (RF06): código do item + raiz do CNPJ → classe. Nunca o código sozinho, porque ele é interno da rede e pode vir truncado.
   - Tamanho de embalagem lembrado por produto (RF08), com unidade (g, kg, ml, l).
   - Configuração do limite de alta/baixa (RF10), padrão 20%.
   Avalie se a memória de classificação e o tamanho de embalagem cabem numa mesma tabela de produtos por (raiz do CNPJ, código) e diga o que prefere e por quê.
3. Onde o preço normalizado (por kg ou litro) é calculado: coluna gerada, view ou no front. Justifique.
4. Um rascunho do SQL das duas consultas que mais pesam, de preferência como views ou funções no banco:
   - Mediana do preço normalizado por classe nos últimos 3 meses, considerando todos os mercados (percentile_cont), e a marcação de alta/baixa segundo a regra do CLAUDE.md (menos de duas compras da classe → sem marcação).
   - Comparação entre dois mercados: classes compradas nos dois, preço de cada um e qual sai mais barato.
5. As policies de RLS de cada tabela.
6. Como o workflow de keep-alive vai funcionar.

Deixe espaço para os requisitos pós-MVP sem implementá-los: compras de entrada manual sem cupom (RF13) podem não ter chave de acesso nem CNPJ, e itens podem ganhar depois um preço com desconto vindo da notinha (RF12). Diga como o schema acomoda isso sem migração destrutiva no futuro.

Pare e espere minha aprovação.

## Fase 2 — Implementação (só depois de eu aprovar)

1. Crie as migrations com npx supabase migration new, em arquivos pequenos e com nomes descritivos, em supabase/migrations/.
2. As 7 categorias entram por migration, não pelo seed: o seed.sql só roda no banco local e elas precisam existir em produção também.
3. No supabase/seed.sql, coloque dados de exemplo só para desenvolvimento local: dois mercados, algumas compras em datas diferentes nos últimos meses e itens que exercitem as duas consultas (uma classe em alta, uma em baixa, uma com só uma compra, um item vendido por KG).
4. RLS ligado em todas as tabelas, com acesso só para usuários autenticados (role authenticated); o role anon não lê nem escreve nada. Toda view deve ser criada com security_invoker = true, senão ela ignora o RLS das tabelas.
5. Rode npx supabase db reset e confirme que sobe sem erro. Rode as consultas da fase 1 contra o seed e me mostre o resultado.
6. Gere os tipos TypeScript com npx supabase gen types typescript --local > src/types/database.ts.
7. Crie .github/workflows/keep-alive.yml: cron diário (horário fora de 00:00 UTC) e workflow_dispatch para disparo manual. Ele faz um GET em <VITE_SUPABASE_URL>/rest/v1/categories?select=id&limit=1 com os headers apikey e Authorization usando o secret VITE_SUPABASE_PUBLISHABLE_KEY. A resposta vem vazia por causa do RLS, e isso é esperado: a requisição já conta como atividade. O job falha só se o status HTTP não for 2xx.
8. Atualize a seção "Comandos" do CLAUDE.md com os comandos novos (gen types, db push).
9. Faça commits pequenos, no padrão do CLAUDE.md.

## O que NÃO fazer

- Não rode nada contra o projeto remoto: nem npx supabase db push, nem db reset --linked, nem migration repair. Ao terminar, me diga o comando para eu aplicar as migrations no remoto.
- Não use a secret key nem a service_role key em nenhum lugar: front, workflow, seed ou scripts.
- Não crie nem altere tabelas pelo Studio ou pelo painel; tudo por migration.
- Não use float, real ou double para dinheiro ou quantidade; use numeric com precisão justificada.
- Não crie coluna para CPF nem para dono/usuário da compra (a conta é única e compartilhada).
- Não crie telas nem componentes React nesta etapa; o único arquivo do front é o de tipos gerados.
- Não implemente RF12 a RF15; só não feche a porta para eles.

Ao terminar, me diga como verificar tudo no Studio local (http://localhost:54323) e como disparar o keep-alive manualmente no GitHub.
```

**Depois que ele terminar**

- Revise as migrations e rode `npx supabase db push` para aplicar no projeto remoto.
- No GitHub, em *Actions → keep-alive*, dispare o workflow manualmente uma vez.

**Pronto quando**

- `npx supabase db reset` sobe o banco local sem erro, com as 7 categorias e os dados de exemplo.
- As consultas de mediana e de comparação retornam o esperado com o seed.
- `src/types/database.ts` foi gerado.
- Depois do `db push`, as tabelas e as categorias aparecem no painel do projeto remoto.
- O keep-alive rodou com sucesso pelo menos uma vez.

> O GitHub desativa workflows agendados de repositórios sem nenhuma atividade por 60 dias. Se o projeto ficar parado por esse tempo, o keep-alive para e o GitHub avisa por e-mail; basta reativá-lo em *Actions*.

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

**Você faz antes:** `npx supabase secrets set GEMINI_API_KEY=...`. Separe o print do cupom com o CPF recortado para usar como teste.

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
