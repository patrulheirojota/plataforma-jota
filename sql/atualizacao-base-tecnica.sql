-- =====================================================================
-- ATUALIZACAO (LOTE E): VELOCIDADE DO BANCO
-- Cria indices (como o indice de um livro) nas tabelas que mais crescem.
-- So acelera as consultas: nao altera nem apaga nenhum dado. Pode rodar mais de uma vez.
-- =====================================================================
do $$
declare
  r record;
  -- tabela, nome do indice, colunas
  lista text[][] := array[
    ['questao_respostas',   'idx_qr_aluno_data',     'aluno_id, respondido_em'],
    ['questao_respostas',   'idx_qr_questao',        'questao_id'],
    ['sessoes_estudo',      'idx_se_aluno_data',     'aluno_id, data'],
    ['sessoes_estudo',      'idx_se_data',           'data'],
    ['registros_diarios',   'idx_rd_aluno_data',     'aluno_id, data'],
    ['cronograma_log',      'idx_cl_criado',         'criado_em'],
    ['cronograma_log',      'idx_cl_aluno',          'aluno_id'],
    ['caderno_erros',       'idx_ce_aluno',          'aluno_id'],
    ['edital_progresso',    'idx_ep_aluno',          'aluno_id'],
    ['flashcard_progresso', 'idx_fp_aluno_proxima',  'aluno_id, proxima'],
    ['questao_comentarios', 'idx_qc_questao',        'questao_id'],
    ['questao_comentarios', 'idx_qc_criado',         'criado_em'],
    ['avisos',              'idx_av_aluno',          'aluno_id'],
    ['simulado_tentativas', 'idx_st_aluno',          'aluno_id'],
    ['aluno_concursos',     'idx_ac_aluno',          'aluno_id'],
    ['erros_site',          'idx_es_criado',         'criado_em'],
    ['sim_respostas',       'idx_sr_item',           'item_id'],
    ['lei_leituras',        'idx_ll_lei',            'lei_id'],
    ['compras',             'idx_cp_aluno',          'aluno_id']
  ];
  i int; ok boolean; col text;
begin
  for i in 1 .. array_length(lista, 1) loop
    if to_regclass('public.' || lista[i][1]) is null then continue; end if;
    -- so cria se todas as colunas existirem nesta instalacao
    ok := true;
    foreach col in array string_to_array(replace(lista[i][3], ' ', ''), ',') loop
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = lista[i][1] and column_name = col) then ok := false; end if;
    end loop;
    if ok then
      execute format('create index if not exists %I on public.%I (%s)', lista[i][2], lista[i][1], lista[i][3]);
    end if;
  end loop;
end $$;

-- Conferencia: quantos indices novos existem
select count(*) as indices_criados from pg_indexes
where schemaname = 'public' and indexname like any (array['idx_qr_%','idx_se_%','idx_rd_%','idx_cl_%','idx_ce_%','idx_ep_%','idx_fp_%','idx_qc_%','idx_av_%','idx_st_%','idx_ac_%','idx_es_%','idx_sr_%','idx_ll_%','idx_cp_%']);
