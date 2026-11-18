-- =====================================================================
-- ATUALIZACAO: ROTINA INDIVIDUAL DO ALUNO ("Mapa da Jornada")
-- O mentor monta, para cada aluno, a rotina da semana (horarios de
-- trabalho, treino, refeicoes e os blocos de estudo). O aluno ve a
-- rotina dele quando o mentor publica.
-- Seguro: so CRIA duas tabelas e as permissoes. Nao apaga nada.
-- Pode rodar mais de uma vez.
-- =====================================================================

-- 1) rotina que o aluno ve (uma por aluno)
create table if not exists public.rotinas (
  aluno_id uuid primary key references public.alunos(id) on delete cascade,
  blocos jsonb not null default '[]'::jsonb,
  recomendacoes text,
  publicada boolean not null default false,
  publicada_em timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.rotinas add column if not exists recomendacoes text;
alter table public.rotinas add column if not exists publicada boolean not null default false;
alter table public.rotinas add column if not exists publicada_em timestamptz;
alter table public.rotinas add column if not exists atualizado_em timestamptz not null default now();
alter table public.rotinas enable row level security;

-- 2) respostas do formulario de ingresso (so o mentor ve)
create table if not exists public.rotina_formulario (
  aluno_id uuid primary key references public.alunos(id) on delete cascade,
  texto text,
  respostas jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.rotina_formulario enable row level security;

grant select, insert, update, delete on public.rotinas to authenticated;
grant select, insert, update, delete on public.rotina_formulario to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rotinas' and policyname = 'mentor acesso total rotinas') then
    create policy "mentor acesso total rotinas" on public.rotinas
      for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rotinas' and policyname = 'aluno ve a propria rotina publicada') then
    create policy "aluno ve a propria rotina publicada" on public.rotinas
      for select to authenticated using (aluno_id = auth.uid() and publicada is true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rotina_formulario' and policyname = 'mentor acesso total formulario') then
    create policy "mentor acesso total formulario" on public.rotina_formulario
      for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
  end if;
end $$;

-- Conferencia (as tres linhas devem mostrar 1 ou mais)
select 'tabela de rotinas' as item, count(*) as ok from information_schema.tables
 where table_schema = 'public' and table_name = 'rotinas'
union all select 'tabela do formulario (so mentor)', count(*) from information_schema.tables
 where table_schema = 'public' and table_name = 'rotina_formulario'
union all select 'permissoes', count(*) from pg_policies
 where schemaname = 'public' and tablename in ('rotinas', 'rotina_formulario');
