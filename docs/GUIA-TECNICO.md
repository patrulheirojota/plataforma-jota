# Guia técnico da plataforma Patrulheiros de Elite

Este guia explica as 3 proteções da plataforma: **testes automáticos**, **ambiente de teste** e **backup semanal**.

---

## 1. Testes automáticos (já funcionam sozinhos)

Toda vez que um arquivo é enviado ao GitHub, um robô confere a plataforma:

- se algum arquivo tem erro de escrita;
- se alguma página carrega um arquivo que não existe (ex.: `pomodoro.js` faltando);
- se um arquivo foi trocado por engano (ex.: `menu-admin.js` com o conteúdo do `comum.js`);
- se uma chave secreta do Supabase foi parar no GitHub;
- se os menus do aluno têm os mesmos itens em todas as páginas;
- se os leitores de simulado e de lei seca continuam funcionando;
- se a função da Kiwify recusa senha errada;
- e abre **todas as páginas** num navegador de verdade (com banco falso) para ver se alguma dá erro.

**Onde ver o resultado:** no GitHub, aba **Actions**. ✅ verde = tudo certo. ❌ vermelho = clique para ver qual arquivo e qual problema. O GitHub também manda um e-mail quando falha.

> Os testes **avisam**, mas não impedem a Vercel de publicar. Se ficar vermelho, corrija (ou me mande o print) antes de avisar os alunos.

---

## 2. Ambiente de teste (para testar antes dos alunos verem)

A Vercel cria um **link de teste** para qualquer "branch" (cópia paralela) do GitHub que não seja a principal.

### Uma vez só
1. **Banco de teste (recomendado):** no Supabase, crie um **segundo projeto** (o plano gratuito permite 2). Rode nele **todos os arquivos SQL** que você já rodou no principal. Copie a URL e a chave *publishable* (Project Settings → API Keys) e cole em `config.js`, no bloco `BANCO_TESTE`.
   - Sem banco de teste, o link de teste usa o banco **real** e mostra uma faixa vermelha avisando.
2. **Crie a branch:** no GitHub, clique no botão de branch (onde está escrito `main`) → digite `teste` → *Create branch: teste from main*.

### A cada atualização
1. No GitHub, troque para a branch **teste** e suba os arquivos novos **nela**.
2. Na Vercel → **Deployments**, aparece um deploy de *Preview* com um link `...vercel.app`. Abra e teste (aparece uma faixa amarela "AMBIENTE DE TESTE").
3. Ficou bom? No GitHub: **Pull requests → New pull request** → de `teste` para `main` → **Create** → **Merge**. A Vercel publica no site oficial.

---

## 3. Backup semanal do banco

Todo **domingo às 03:17** um robô faz uma cópia completa do banco (dados dos alunos e logins), **criptografada com a sua senha**, e guarda por **90 dias** na aba **Actions** do GitHub.

### Configurar (uma vez)
1. No Supabase: botão **Connect** (no topo) → aba **Session pooler** → copie a linha que começa com `postgresql://`. Troque `[YOUR-PASSWORD]` pela senha do banco (se não lembrar: Project Settings → Database → *Reset database password*).
2. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - Nome `SUPABASE_DB_URL` → cole a linha do passo 1.
   - Nome `BACKUP_SENHA` → invente uma senha forte e **guarde num lugar seguro**. Sem ela, o backup não abre.
3. Teste agora: aba **Actions → Backup semanal do banco → Run workflow**. Em ~2 minutos deve ficar verde.

### Recuperar um backup (se um dia precisar)
Na aba Actions, abra o backup desejado e baixe o arquivo. Para abrir:
```
gpg -d backup-AAAA-MM-DD.dump.gpg > banco.dump          (pede a BACKUP_SENHA)
pg_restore --no-owner -d "URL_DO_BANCO_NOVO" banco.dump
```
Não faça isso sozinho no banco principal: chame o suporte técnico (ou o Claude) para restaurar com segurança, de preferência primeiro num projeto novo.

> Observações:
> - Os áudios das explicações ficam no *Storage* do Supabase e não entram nesse backup.
> - O GitHub pausa robôs agendados se o repositório ficar **60 dias sem nenhuma alteração**. Se isso acontecer, a aba Actions mostra um botão para reativar.

---

## Regras de segurança (nunca quebrar)
- A chave **secret / service_role** do Supabase só pode ficar na **Vercel** (variáveis de ambiente). Nunca em arquivo do GitHub.
- O repositório do GitHub é **público**: qualquer pessoa pode ler o código. Por isso nada de senhas, planilhas de alunos ou material de venda dentro dele.
- Arquivos `.sql` são rodados no Supabase (SQL Editor), não precisam ir para o GitHub.
