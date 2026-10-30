-- =====================================================================
-- ATUALIZACAO (LOTE F): LGPD + NOTIFICACOES NO CELULAR
-- Seguro: so cria tabelas e funcoes novas. Pode rodar mais de uma vez.
-- (A funcao de anonimizar so roda quando o MENTOR clica, a pedido do aluno.)
-- =====================================================================

-- 1) Pedidos do aluno sobre os proprios dados (LGPD, art. 18)
create table if not exists public.solicitacoes_lgpd (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null default auth.uid(),
  tipo text not null,                 -- 'exclusao' | 'correcao' | 'copia' | 'outro'
  mensagem text,
  status text not null default 'aberta',   -- 'aberta' | 'concluida'
  criado_em timestamptz default now(),
  concluido_em timestamptz,
  constraint solicitacoes_lgpd_msg check (char_length(coalesce(mensagem, '')) <= 1000)
);
alter table public.solicitacoes_lgpd enable row level security;
grant select, insert, update, delete on public.solicitacoes_lgpd to authenticated;

-- 2) Celulares inscritos para receber avisos
create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{"diario": true, "avisos": true, "vencimento": true}',
  aparelho text,
  ativo boolean not null default true,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
alter table public.push_inscricoes enable row level security;
grant select, insert, update, delete on public.push_inscricoes to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='solicitacoes_lgpd' and policyname='mentor acesso total') then
    create policy "mentor acesso total" on public.solicitacoes_lgpd for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='solicitacoes_lgpd' and policyname='aluno ve os proprios pedidos') then
    create policy "aluno ve os proprios pedidos" on public.solicitacoes_lgpd for select to authenticated using (aluno_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='solicitacoes_lgpd' and policyname='aluno faz pedido') then
    create policy "aluno faz pedido" on public.solicitacoes_lgpd for insert to authenticated with check (aluno_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='push_inscricoes' and policyname='mentor ve inscricoes') then
    create policy "mentor ve inscricoes" on public.push_inscricoes for select to authenticated using (public.eh_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='push_inscricoes' and policyname='aluno cuida do proprio celular') then
    create policy "aluno cuida do proprio celular" on public.push_inscricoes for all to authenticated
      using (aluno_id = auth.uid()) with check (aluno_id = auth.uid());
  end if;
end $$;

-- 3) Anonimizar um aluno (pedido de exclusao). So o mentor.
--    Apaga o que identifica a pessoa e os textos pessoais. Mantem os numeros (sem nome)
--    e os registros de compra (obrigacao legal/fiscal).
create or replace function public.anonimizar_aluno(p_aluno uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_novo text;
begin
  if not public.eh_admin() then raise exception 'somente o mentor'; end if;
  if not exists (select 1 from public.alunos where id = p_aluno) then raise exception 'aluno nao encontrado'; end if;
  v_novo := 'removido-' || left(p_aluno::text, 8) || '@removido.invalid';
  update public.alunos set nome = 'Aluno removido (LGPD)', email = v_novo, telefone = null,
    data_expiracao = least(coalesce(data_expiracao, current_date), current_date - 1)
  where id = p_aluno;
  if to_regclass('public.questao_comentarios') is not null then
    update public.questao_comentarios set texto = '(comentario removido a pedido do autor)' where aluno_id = p_aluno;
  end if;
  if to_regclass('public.caderno_erros') is not null then
    update public.caderno_erros set titulo = '(removido)', conteudo = null where aluno_id = p_aluno;
  end if;
  if to_regclass('public.anotacoes_aluno') is not null and exists (select 1 from information_schema.columns where table_name='anotacoes_aluno' and column_name='texto') then
    execute 'update public.anotacoes_aluno set texto = ''(removido)'' where aluno_id = $1' using p_aluno;
  end if;
  if to_regclass('public.relatorios_aluno') is not null and exists (select 1 from information_schema.columns where table_name='relatorios_aluno' and column_name='analise') then
    execute 'update public.relatorios_aluno set analise = null where aluno_id = $1' using p_aluno;
  end if;
  if to_regclass('public.pedidos_acesso') is not null then
    update public.pedidos_acesso set nome = 'Aluno removido', telefone = null, observacao = null where aluno_id = p_aluno;
  end if;
  update public.push_inscricoes set ativo = false where aluno_id = p_aluno;
  -- bloqueia o login (sem apagar: apagar o login poderia levar junto os dados em cascata)
  if exists (select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='banned_until') then
    execute 'update auth.users set banned_until = ''infinity'' where id = $1' using p_aluno;
  end if;
  update public.solicitacoes_lgpd set status = 'concluida', concluido_em = now() where aluno_id = p_aluno and status = 'aberta';
  return 'anonimizado';
end $$;
revoke all on function public.anonimizar_aluno(uuid) from public, anon;
grant execute on function public.anonimizar_aluno(uuid) to authenticated;

-- 4) Lembretes do dia (chamado pelo servidor uma vez por dia, as 18h)
--    No maximo 1 por aluno: vencimento do acesso tem prioridade; depois a Missao de hoje.
create or replace function public.lembretes_do_dia()
returns table(aluno_id uuid, titulo text, corpo text, url text)
language sql security definer set search_path = public stable as $$
  with insc as (
    select distinct on (p.aluno_id) p.aluno_id, p.prefs from public.push_inscricoes p where p.ativo order by p.aluno_id, p.atualizado_em desc
  ),
  base as (
    select a.id, split_part(trim(coalesce(a.nome, '')), ' ', 1) as nome, a.data_expiracao, i.prefs
    from public.alunos a join insc i on i.aluno_id = a.id
    where coalesce(a.bloqueado_inatividade, false) = false and (a.data_expiracao is null or a.data_expiracao >= current_date)
  ),
  venc as (
    select id, 1 as ordem, '⏳ Seu acesso vence em ' || (data_expiracao - current_date) || ' dia(s)' as titulo,
      nome || ', renove para nao perder o ritmo. Seu progresso fica guardado.' as corpo, '/cronograma.html' as url
    from base where coalesce((prefs->>'vencimento')::boolean, true) and data_expiracao - current_date in (7, 3, 1)
  ),
  hoje as (
    select s.aluno_id, count(*) filter (where not s.concluida) as falta, count(*) filter (where s.concluida) as feitas
    from public.sessoes_estudo s where s.data = current_date group by s.aluno_id
  ),
  missao as (
    select b.id, 2 as ordem, '🎯 Sua missao de hoje te espera' as titulo,
      b.nome || ', faltam ' || h.falta || ' sessao(oes) no cronograma. Celular no Nao perturbe e bora!' as corpo, '/cronograma.html' as url
    from base b join hoje h on h.aluno_id = b.id
    where coalesce((b.prefs->>'diario')::boolean, true) and h.falta > 0 and h.feitas = 0
  )
  select distinct on (x.id) x.id, x.titulo, x.corpo, x.url
  from (select * from venc union all select * from missao) x
  where coalesce(auth.role(), '') = 'service_role'
  order by x.id, x.ordem
$$;
revoke all on function public.lembretes_do_dia() from public, anon, authenticated;
grant execute on function public.lembretes_do_dia() to service_role;

-- Conferencia
select 'tabela solicitacoes_lgpd' as item, count(*) as ok from pg_tables where tablename='solicitacoes_lgpd'
union all select 'tabela push_inscricoes', count(*) from pg_tables where tablename='push_inscricoes'
union all select 'funcao anonimizar_aluno', count(*) from pg_proc where proname='anonimizar_aluno'
union all select 'funcao lembretes_do_dia', count(*) from pg_proc where proname='lembretes_do_dia';
