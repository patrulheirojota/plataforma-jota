-- =====================================================================
-- ATUALIZACAO: BANCO DE QUESTOES ABERTO + COBERTURA POR CONCURSO
-- 1) Todo aluno logado pode fazer as questoes de TODOS os concursos
--    (o aluno da PMBA tambem treina com as da PMPE, da PMAL...).
-- 2) Prioridade e meta de questoes por concurso, para a Central do dia
--    avisar quais concursos e disciplinas precisam de mais questoes.
-- Seguro: so ACRESCENTA colunas, permissoes de leitura e uma funcao.
-- Nao apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) leitura do banco inteiro para quem esta logado (so questoes ativas)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'questoes' and policyname = 'aluno le todo o banco') then
    create policy "aluno le todo o banco" on public.questoes
      for select to authenticated using (ativo is true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'questao_concursos' and policyname = 'aluno le os vinculos do banco') then
    create policy "aluno le os vinculos do banco" on public.questao_concursos
      for select to authenticated using (true);
  end if;
end $$;

-- 2) prioridade do concurso no banco de questoes e meta por disciplina
--    prio_banco: urgente (edital aberto) | alta | media | baixa | fora (nao acompanhar)
alter table public.concursos add column if not exists prio_banco text not null default 'media';
alter table public.concursos add column if not exists meta_questoes integer not null default 200;

-- 3) contagem do banco (so o mentor): por disciplina e assunto, por concurso e os editais
create or replace function public.banco_contagem()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.eh_admin() then
    raise exception 'apenas o mentor';
  end if;
  select jsonb_build_object(
    'total', (select count(*) from questoes where ativo is true),
    'banco', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'a', a, 'n', n)) from (
        select coalesce(disciplina, '') d, coalesce(assunto, '') a, count(*) n
          from questoes where ativo is true group by 1, 2) x), '[]'::jsonb),
    'vinc', coalesce((select jsonb_agg(jsonb_build_object('c', c, 'd', d, 'n', n)) from (
        select qc.concurso_id::text c, coalesce(q.disciplina, '') d, count(distinct q.id) n
          from questoes q join questao_concursos qc on qc.questao_id = q.id
         where q.ativo is true group by 1, 2) x), '[]'::jsonb),
    'edital', coalesce((select jsonb_agg(jsonb_build_object('c', c, 'd', d, 't', t)) from (
        select concurso_id::text c, disciplina d, topico t from edital_topicos order by concurso_id, disciplina, ordem) x), '[]'::jsonb),
    'concursos', coalesce((select jsonb_agg(jsonb_build_object('id', id::text, 'nome', nome, 'prio', prio_banco, 'meta', meta_questoes) order by nome) from concursos), '[]'::jsonb)
  ) into v;
  return v;
end $$;

revoke all on function public.banco_contagem() from public, anon;
grant execute on function public.banco_contagem() to authenticated;

-- Conferencia (as tres linhas devem mostrar 1 ou mais)
select 'banco aberto para os alunos' as item, count(*) as ok from pg_policies
 where schemaname = 'public' and policyname in ('aluno le todo o banco')
union all select 'prioridade dos concursos', count(*) from information_schema.columns
 where table_schema = 'public' and table_name = 'concursos' and column_name = 'prio_banco'
union all select 'funcao de contagem', count(*) from pg_proc where proname = 'banco_contagem';
