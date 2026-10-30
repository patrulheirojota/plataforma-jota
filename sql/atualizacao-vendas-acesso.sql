-- =====================================================================
-- ATUALIZACAO (LOTE D): VENDAS E ACESSO
--   - compra aprovada na Kiwify libera o acesso sozinha
--   - Pix / Mercado Pago: aluno se cadastra e o mentor aprova com 1 clique
--   - reembolso / chargeback encerra o acesso (o historico do aluno fica guardado)
-- Seguro: so cria tabelas e funcoes NOVAS. Nao apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Produtos da Kiwify -> turma e prazo de acesso
create table if not exists public.produtos_acesso (
  produto_id text primary key,             -- id do produto na Kiwify
  produto_nome text,
  concurso_id text,                        -- turma que o aluno entra
  dias int not null default 365,           -- prazo de acesso
  ativo boolean not null default false,    -- so libera quando o mentor configurar
  criado_em timestamptz default now()
);

-- 2) Compras (Kiwify ou registradas pelo mentor)
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'kiwify',
  pedido_id text unique,
  email text not null,
  nome text,
  telefone text,
  produto_id text,
  produto_nome text,
  valor numeric,
  status text not null default 'aprovada',   -- 'aprovada' | 'reembolsada' | 'chargeback'
  aprovada_em timestamptz default now(),
  aluno_id uuid,                              -- preenchido quando o acesso e liberado
  aplicada_em timestamptz,
  expira_aplicada date,
  dias_aplicados int,
  observacao text,
  criado_em timestamptz default now()
);
create index if not exists idx_compras_email on public.compras(lower(email));
alter table public.compras add column if not exists dias_aplicados int;

-- 3) Pedidos de acesso (quem pagou por fora: Pix, Mercado Pago...)
create table if not exists public.pedidos_acesso (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null default auth.uid(),   -- o login que o aluno criou
  email text,
  nome text,
  telefone text,
  concurso_id text,
  forma_pagamento text,
  observacao text,
  tipo text not null default 'novo',            -- 'novo' | 'renovacao'
  status text not null default 'pendente',      -- 'pendente' | 'aprovado' | 'recusado'
  criado_em timestamptz default now(),
  decidido_em timestamptz
);
create index if not exists idx_pedidos_status on public.pedidos_acesso(status, criado_em);

-- 4) Registro de tudo que a Kiwify enviou (para conferir quando algo der errado)
create table if not exists public.kiwify_eventos (
  id uuid primary key default gen_random_uuid(),
  recebido_em timestamptz default now(),
  evento text,
  pedido_id text,
  email text,
  resultado text,
  payload jsonb
);

alter table public.produtos_acesso enable row level security;
alter table public.compras enable row level security;
alter table public.pedidos_acesso enable row level security;
alter table public.kiwify_eventos enable row level security;
grant select, insert, update, delete on public.produtos_acesso, public.compras, public.pedidos_acesso, public.kiwify_eventos to authenticated;

do $$
declare t text;
begin
  foreach t in array array['produtos_acesso','compras','pedidos_acesso','kiwify_eventos'] loop
    if not exists (select 1 from pg_policies where tablename=t and policyname='mentor acesso total') then
      execute format('create policy "mentor acesso total" on public.%I for all to authenticated using (public.eh_admin()) with check (public.eh_admin())', t);
    end if;
  end loop;
  if not exists (select 1 from pg_policies where tablename='pedidos_acesso' and policyname='aluno ve o proprio pedido') then
    create policy "aluno ve o proprio pedido" on public.pedidos_acesso for select to authenticated using (aluno_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- NUCLEO: libera (ou renova) o acesso de um login. Uso interno.
-- ---------------------------------------------------------------------
create or replace function public._liberar_acesso(p_user uuid, p_nome text, p_email text, p_telefone text, p_concurso text, p_dias int)
returns date language plpgsql security definer set search_path = public as $$
declare v_conc public.alunos.concurso_id%type; v_exp date; v_ja boolean;
begin
  v_conc := nullif(p_concurso, '');
  select true, data_expiracao into v_ja, v_exp from public.alunos where id = p_user;
  if coalesce(v_ja, false) then
    -- renovacao: soma o prazo a partir do vencimento atual (ou de hoje, se ja venceu)
    v_exp := greatest(coalesce(v_exp, current_date), current_date) + coalesce(p_dias, 365);
    update public.alunos set data_expiracao = v_exp,
      telefone = coalesce(telefone, nullif(p_telefone, '')),
      concurso_id = coalesce(concurso_id, v_conc)
    where id = p_user;
  else
    v_exp := current_date + coalesce(p_dias, 365);
    insert into public.alunos (id, nome, email, concurso_id, data_expiracao, telefone)
    values (p_user, coalesce(nullif(p_nome, ''), split_part(p_email, '@', 1)), lower(p_email), v_conc, v_exp, nullif(p_telefone, ''));
  end if;
  if v_conc is not null and not exists (select 1 from public.aluno_concursos where aluno_id = p_user and concurso_id = v_conc) then
    insert into public.aluno_concursos (aluno_id, concurso_id) values (p_user, v_conc);
  end if;
  -- pedidos pendentes deste login ficam resolvidos
  update public.pedidos_acesso set status = 'aprovado', decidido_em = now() where aluno_id = p_user and status = 'pendente';
  return v_exp;
end $$;
revoke all on function public._liberar_acesso(uuid, text, text, text, text, int) from public, anon, authenticated;

-- aplica uma compra aprovada: acha o login pelo e-mail e libera
create or replace function public._aplicar_compra(p_compra uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c public.compras; pr public.produtos_acesso; v_user uuid; v_nome text; v_tel text; v_exp date;
begin
  select * into c from public.compras where id = p_compra;
  if c.id is null then return 'compra nao encontrada'; end if;
  if c.status <> 'aprovada' then return 'compra ' || c.status; end if;
  if c.aluno_id is not null then return 'ja aplicada'; end if;
  select * into pr from public.produtos_acesso where produto_id = c.produto_id;
  if pr.produto_id is null then
    insert into public.produtos_acesso (produto_id, produto_nome, ativo) values (coalesce(c.produto_id, 'sem-id'), c.produto_nome, false)
    on conflict (produto_id) do nothing;
    return 'produto sem configuracao';
  end if;
  if not pr.ativo then return 'produto sem configuracao'; end if;
  select id into v_user from public.alunos where lower(email) = lower(c.email) limit 1;
  if v_user is null then select id into v_user from auth.users where lower(email) = lower(c.email) limit 1; end if;
  if v_user is null then return 'aguardando cadastro'; end if;
  select nome, telefone into v_nome, v_tel from public.pedidos_acesso where aluno_id = v_user order by criado_em desc limit 1;
  v_exp := public._liberar_acesso(v_user, coalesce(v_nome, c.nome), c.email, coalesce(v_tel, c.telefone), pr.concurso_id, pr.dias);
  update public.compras set aluno_id = v_user, aplicada_em = now(), expira_aplicada = v_exp, dias_aplicados = pr.dias where id = c.id;
  return 'liberado ate ' || to_char(v_exp, 'DD/MM/YYYY');
end $$;
revoke all on function public._aplicar_compra(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- KIWIFY: chamada pelo servidor (api/kiwify.js) a cada aviso da Kiwify
-- ---------------------------------------------------------------------
create or replace function public.kiwify_registrar(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_evento text; v_status text; v_pedido text; v_email text; v_nome text; v_tel text;
  v_prod text; v_prodnome text; v_valor numeric; v_tipo text; v_id uuid; v_res text; c public.compras;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.eh_admin() then raise exception 'sem permissao'; end if;
  v_evento := coalesce(p->>'webhook_event_type', p->>'event', p->>'trigger', p->>'type', '');
  v_status := lower(coalesce(p->>'order_status', p->>'status', ''));
  v_pedido := coalesce(p->>'order_id', p->>'order_ref', p->'order'->>'id', p->>'id');
  v_email  := lower(trim(coalesce(p->'Customer'->>'email', p->'customer'->>'email', p->'buyer'->>'email', p->>'email', '')));
  v_nome   := coalesce(p->'Customer'->>'full_name', p->'Customer'->>'name', p->'customer'->>'full_name', p->'customer'->>'name', p->'buyer'->>'name');
  v_tel    := coalesce(p->'Customer'->>'mobile', p->'customer'->>'mobile', p->'Customer'->>'phone', p->'customer'->>'phone');
  v_prod   := coalesce(p->'Product'->>'product_id', p->'product'->>'product_id', p->'Product'->>'id', p->'product'->>'id', p->>'product_id');
  v_prodnome := coalesce(p->'Product'->>'product_name', p->'product'->>'product_name', p->'Product'->>'name', p->'product'->>'name', p->>'product_name');
  begin
    v_valor := coalesce((p->'Commissions'->>'charge_amount')::numeric / 100, (p->>'charge_amount')::numeric / 100, (p->>'amount')::numeric);
  exception when others then v_valor := null; end;
  v_tipo := case
    when v_status in ('paid','approved','aprovada','completed') or v_evento ~* '(order_approved|compra_aprovada)' then 'aprovada'
    when v_status in ('refunded','reembolsada') or v_evento ~* '(refund|reembols)' then 'reembolsada'
    when v_status in ('chargedback','chargeback') or v_evento ~* 'chargeback' then 'chargeback'
    else 'outro' end;

  if v_tipo = 'aprovada' and v_email <> '' then
    insert into public.compras (origem, pedido_id, email, nome, telefone, produto_id, produto_nome, valor, status)
    values ('kiwify', v_pedido, v_email, v_nome, v_tel, v_prod, v_prodnome, v_valor, 'aprovada')
    on conflict (pedido_id) do update set status = 'aprovada'
    returning id into v_id;
    v_res := public._aplicar_compra(v_id);
  elsif v_tipo in ('reembolsada','chargeback') then
    update public.compras set status = v_tipo where pedido_id = v_pedido returning * into c;
    if c.id is null then v_res := 'compra nao encontrada';
    elsif c.aluno_id is not null then
      -- tira so os dias desta compra (se era renovacao, o prazo anterior continua).
      -- nada e apagado: o aluno volta se comprar de novo
      update public.alunos set data_expiracao = greatest(current_date - 1, coalesce(data_expiracao, current_date) - coalesce(c.dias_aplicados, 36500))
        where id = c.aluno_id;
      v_res := case when (select data_expiracao from public.alunos where id = c.aluno_id) >= current_date
                    then 'dias da compra retirados (' || v_tipo || ')' else 'acesso encerrado (' || v_tipo || ')' end;
    else v_res := v_tipo || ' antes de liberar';
    end if;
  else
    v_res := 'ignorado: ' || coalesce(nullif(v_evento, ''), v_status);
  end if;
  insert into public.kiwify_eventos (evento, pedido_id, email, resultado, payload)
  values (coalesce(nullif(v_evento, ''), v_status), v_pedido, v_email, v_res, p);
  return v_res;
end $$;
revoke all on function public.kiwify_registrar(jsonb) from public, anon;
grant execute on function public.kiwify_registrar(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- ALUNO (pagina "Primeiro acesso")
-- ---------------------------------------------------------------------
-- situacao do login atual
create or replace function public.meu_acesso()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; v_exp date; v_ped text; v_comp int;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'sem_login'); end if;
  select email into v_email from auth.users where id = auth.uid();
  select data_expiracao into v_exp from public.alunos where id = auth.uid();
  select status into v_ped from public.pedidos_acesso where aluno_id = auth.uid() and status = 'pendente' limit 1;
  select count(*) into v_comp from public.compras c left join public.produtos_acesso p on p.produto_id = c.produto_id
    where lower(c.email) = lower(v_email) and c.status = 'aprovada' and c.aluno_id is null and coalesce(p.ativo, false) = false;
  return jsonb_build_object(
    'status', case when v_exp is not null and v_exp >= current_date and v_ped is null then 'ativo'
                   when v_ped is not null then 'pendente'
                   when v_comp > 0 then 'configurando'
                   when v_exp is not null then 'vencido'
                   else 'novo' end,
    'email', v_email, 'expira', v_exp, 'eh_aluno', v_exp is not null or exists (select 1 from public.alunos where id = auth.uid()));
end $$;

-- procura uma compra da Kiwify com o e-mail do login e libera
create or replace function public.ativar_acesso(p_nome text default null, p_telefone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; r record; v_res text; v_ok int := 0;
begin
  if auth.uid() is null then raise exception 'faca login'; end if;
  select email into v_email from auth.users where id = auth.uid();
  -- guarda nome/telefone para a liberacao
  if coalesce(p_nome, '') <> '' and not exists (select 1 from public.alunos where id = auth.uid()) then
    insert into public.pedidos_acesso (aluno_id, email, nome, telefone, status, forma_pagamento, observacao)
    values (auth.uid(), v_email, p_nome, p_telefone, 'dados', 'kiwify', 'dados do primeiro acesso');
  end if;
  for r in select id from public.compras where lower(email) = lower(v_email) and status = 'aprovada' and aluno_id is null order by aprovada_em loop
    v_res := public._aplicar_compra(r.id);
    if v_res like 'liberado%' then v_ok := v_ok + 1; end if;
  end loop;
  return public.meu_acesso() || jsonb_build_object('liberadas', v_ok);
end $$;

-- quem pagou por fora: pede a liberacao ao mentor
create or replace function public.pedir_acesso(p_nome text, p_telefone text, p_concurso text, p_forma text, p_obs text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; v_tipo text;
begin
  if auth.uid() is null then raise exception 'faca login'; end if;
  select email into v_email from auth.users where id = auth.uid();
  v_tipo := case when exists (select 1 from public.alunos where id = auth.uid()) then 'renovacao' else 'novo' end;
  if exists (select 1 from public.pedidos_acesso where aluno_id = auth.uid() and status = 'pendente') then
    update public.pedidos_acesso set nome = p_nome, telefone = p_telefone, concurso_id = nullif(p_concurso, ''), forma_pagamento = p_forma,
      observacao = left(p_obs, 500), criado_em = now() where aluno_id = auth.uid() and status = 'pendente';
  else
    insert into public.pedidos_acesso (aluno_id, email, nome, telefone, concurso_id, forma_pagamento, observacao, tipo)
    values (auth.uid(), v_email, left(p_nome, 120), left(p_telefone, 30), nullif(p_concurso, ''), left(p_forma, 40), left(p_obs, 500), v_tipo);
  end if;
  return public.meu_acesso();
end $$;

-- ---------------------------------------------------------------------
-- MENTOR
-- ---------------------------------------------------------------------
create or replace function public.aprovar_pedido(p_pedido uuid, p_concurso text, p_dias int)
returns date language plpgsql security definer set search_path = public as $$
declare pd public.pedidos_acesso; v_email text; v_exp date;
begin
  if not public.eh_admin() then raise exception 'somente o mentor'; end if;
  select * into pd from public.pedidos_acesso where id = p_pedido;
  if pd.id is null then raise exception 'pedido nao encontrado'; end if;
  select email into v_email from auth.users where id = pd.aluno_id;
  v_exp := public._liberar_acesso(pd.aluno_id, pd.nome, coalesce(v_email, pd.email), pd.telefone, coalesce(nullif(p_concurso, ''), pd.concurso_id), p_dias);
  update public.pedidos_acesso set status = 'aprovado', decidido_em = now(), concurso_id = coalesce(nullif(p_concurso, ''), concurso_id) where id = p_pedido;
  insert into public.compras (origem, pedido_id, email, nome, telefone, status, aluno_id, aplicada_em, expira_aplicada, observacao)
  values ('manual', 'manual-' || p_pedido, coalesce(v_email, pd.email), pd.nome, pd.telefone, 'aprovada', pd.aluno_id, now(), v_exp, pd.forma_pagamento)
  on conflict (pedido_id) do nothing;
  return v_exp;
end $$;

-- mentor tenta de novo liberar uma compra (ex.: depois de configurar o produto)
create or replace function public.reaplicar_compra(p_compra uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'somente o mentor'; end if;
  return public._aplicar_compra(p_compra);
end $$;

-- ao configurar um produto: libera todas as compras que estavam esperando por ele
create or replace function public.reaplicar_produto(p_produto text)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not public.eh_admin() then raise exception 'somente o mentor'; end if;
  for r in select id from public.compras where produto_id = p_produto and status = 'aprovada' and aluno_id is null loop
    if public._aplicar_compra(r.id) like 'liberado%' then n := n + 1; end if;
  end loop;
  return n;
end $$;

revoke all on function public.meu_acesso(), public.ativar_acesso(text, text), public.pedir_acesso(text, text, text, text, text),
  public.aprovar_pedido(uuid, text, int), public.reaplicar_compra(uuid), public.reaplicar_produto(text) from public, anon;
grant execute on function public.meu_acesso(), public.ativar_acesso(text, text), public.pedir_acesso(text, text, text, text, text),
  public.aprovar_pedido(uuid, text, int), public.reaplicar_compra(uuid), public.reaplicar_produto(text) to authenticated;

-- Conferencia: devem aparecer as 4 tabelas
select tablename, count(*) as regras from pg_policies
where tablename in ('produtos_acesso','compras','pedidos_acesso','kiwify_eventos') group by tablename order by 1;
