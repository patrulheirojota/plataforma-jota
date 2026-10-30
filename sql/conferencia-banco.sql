-- =====================================================================
-- CONFERENCIA DO BANCO (so LE, nao altera nada)
-- Rode no SQL Editor do Supabase. Toda linha deve mostrar "OK" (29 linhas).
-- Se aparecer "FALTA", rode de novo o arquivo indicado na coluna "arquivo".
-- =====================================================================
with itens(arquivo, item, ok) as (
  values
  -- lote 30 dias
  ('atualizacao-central-mentor.sql', 'tabela questao_reportes', to_regclass('public.questao_reportes') is not null),
  ('atualizacao-central-mentor.sql', 'tabela erros_site', to_regclass('public.erros_site') is not null),
  ('atualizacao-central-mentor.sql', 'coluna alunos.telefone', exists(select 1 from information_schema.columns where table_schema='public' and table_name='alunos' and column_name='telefone')),
  ('atualizacao-painel-rapido.sql', 'funcao resumo_alunos_painel', exists(select 1 from pg_proc where proname='resumo_alunos_painel')),
  -- lote A
  ('atualizacao-desempenho-turmas.sql', 'funcao desempenho_assuntos', exists(select 1 from pg_proc where proname='desempenho_assuntos')),
  ('atualizacao-desempenho-turmas.sql', 'funcao estatisticas_questoes', exists(select 1 from pg_proc where proname='estatisticas_questoes')),
  ('atualizacao-desempenho-turmas.sql', 'tabela relatorio_ciclo_visto', to_regclass('public.relatorio_ciclo_visto') is not null),
  -- lote B
  ('atualizacao-simulados-banca.sql', 'tabela sim_banca', to_regclass('public.sim_banca') is not null),
  ('atualizacao-simulados-banca.sql', 'tabela sim_itens', to_regclass('public.sim_itens') is not null),
  ('atualizacao-simulados-banca.sql', 'tabela sim_gabaritos', to_regclass('public.sim_gabaritos') is not null),
  ('atualizacao-simulados-banca.sql', 'tabela sim_respostas', to_regclass('public.sim_respostas') is not null),
  ('atualizacao-simulados-banca.sql', 'tabela sim_resultados', to_regclass('public.sim_resultados') is not null),
  ('atualizacao-simulados-banca.sql', 'funcoes do simulado (8)', (select count(distinct proname) from pg_proc where proname in ('sim_iniciar','sim_finalizar','sim_corrigir','sim_gabarito','sim_ranking','sim_estat_itens','sim_recalcular','sim_liberado')) = 8),
  ('atualizacao-simulados-banca.sql', 'gabarito protegido (aluno nao le)', not exists(select 1 from pg_policies where tablename='sim_gabaritos' and policyname <> 'mentor acesso total')),
  -- lote C
  ('atualizacao-lote-c.sql', 'caderno: agenda de revisao', exists(select 1 from information_schema.columns where table_schema='public' and table_name='caderno_erros' and column_name='revisar_em')),
  ('atualizacao-lote-c.sql', 'questoes: explicacao_url', exists(select 1 from information_schema.columns where table_schema='public' and table_name='questoes' and column_name='explicacao_url')),
  ('atualizacao-lote-c.sql', 'sim_itens: explicacao_url', exists(select 1 from information_schema.columns where table_schema='public' and table_name='sim_itens' and column_name='explicacao_url')),
  ('atualizacao-lote-c.sql', 'tabela leis', to_regclass('public.leis') is not null),
  ('atualizacao-lote-c.sql', 'tabela lei_leituras', to_regclass('public.lei_leituras') is not null),
  ('atualizacao-lote-c.sql', 'pasta de audios "explicacoes"', exists(select 1 from storage.buckets where id='explicacoes')),
  ('atualizacao-lote-c.sql', 'permissao de gravar audio (mentor)', exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='mentor envia explicacoes')),
  -- lote D: vendas e acesso
  ('atualizacao-vendas-acesso.sql', 'tabelas de vendas (4)', (select count(*) from pg_tables where schemaname='public' and tablename in ('compras','produtos_acesso','pedidos_acesso','kiwify_eventos')) = 4),
  ('atualizacao-vendas-acesso.sql', 'funcoes de acesso (Kiwify / Pix)', (select count(distinct proname) from pg_proc where proname in ('kiwify_registrar','ativar_acesso','pedir_acesso','aprovar_pedido','meu_acesso','reaplicar_produto')) = 6),
  ('atualizacao-vendas-acesso.sql', 'reembolso tira so os dias da compra', exists(select 1 from information_schema.columns where table_name='compras' and column_name='dias_aplicados')),
  -- lote E: velocidade
  ('atualizacao-base-tecnica.sql', 'indices de velocidade', (select count(*) from pg_indexes where schemaname='public' and indexname in ('idx_qr_aluno_data','idx_se_aluno_data','idx_ce_aluno')) = 3),
  -- lote F: LGPD e notificacoes
  ('atualizacao-lgpd-notificacoes.sql', 'tabela solicitacoes_lgpd', to_regclass('public.solicitacoes_lgpd') is not null),
  ('atualizacao-lgpd-notificacoes.sql', 'tabela push_inscricoes', to_regclass('public.push_inscricoes') is not null),
  ('atualizacao-lgpd-notificacoes.sql', 'funcoes anonimizar e lembretes', (select count(distinct proname) from pg_proc where proname in ('anonimizar_aluno','lembretes_do_dia')) = 2),
  -- seguranca: toda tabela nova com RLS ligado
  ('(seguranca)', 'RLS ligado nas tabelas novas', not exists(
     select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
       and c.relname in ('questao_reportes','erros_site','relatorio_ciclo_visto','sim_banca','sim_itens','sim_gabaritos','sim_respostas','sim_resultados','leis','lei_leituras','compras','produtos_acesso','pedidos_acesso','kiwify_eventos','solicitacoes_lgpd','push_inscricoes')))
)
select case when ok then 'OK' else 'FALTA' end as status, item, arquivo
from itens
order by ok, arquivo, item;
