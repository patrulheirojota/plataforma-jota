-- =====================================================================
-- ATUALIZACAO: CARGA HORARIA DIFERENTE EM CADA DIA DA SEMANA
-- Guarda, na configuracao do cronograma de cada aluno, os minutos de
-- estudo de cada dia da semana (ex.: {"1":240,"3":120,"6":300}).
-- Vazio = todos os dias com "sessoes por dia x tempo da sessao" (como hoje).
-- Seguro: so ADICIONA uma coluna. Nao apaga nada. Pode rodar mais de uma vez.
-- =====================================================================
alter table public.config_cronograma add column if not exists carga_dias jsonb;

-- Conferencia (deve mostrar 1)
select 'coluna carga_dias' as item, count(*) as ok
  from information_schema.columns
 where table_schema = 'public' and table_name = 'config_cronograma' and column_name = 'carga_dias';
