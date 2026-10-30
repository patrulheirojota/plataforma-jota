// =====================================================================
// CONEXAO COM O BANCO (Supabase)
// - No site oficial (patrulheirojota.com.br) usa SEMPRE o banco de producao.
// - Nos links de teste da Vercel (...vercel.app) usa o banco de TESTE,
//   se voce preencher abaixo. Sem banco de teste, avisa na tela que e o banco real.
// A chave "publishable" pode ficar aqui (ela e publica por natureza).
// NUNCA coloque aqui a chave "secret" / "service_role".
// =====================================================================
const BANCO_PRODUCAO = {
  url: 'https://hlygwqftnfmywsmajvkz.supabase.co',
  chave: 'sb_publishable_g1To88yIFAty6kkkIeskkQ_XrSkGOaA'
}
// banco de TESTE (opcional): crie um 2o projeto gratis no Supabase e cole a URL e a chave publishable
const BANCO_TESTE = {
  url: '',
  chave: ''
}
const SITES_OFICIAIS = ['patrulheirojota.com.br', 'www.patrulheirojota.com.br']

const AMBIENTE = SITES_OFICIAIS.indexOf(location.hostname) >= 0 ? 'producao'
  : (BANCO_TESTE.url && BANCO_TESTE.chave ? 'teste' : 'teste-banco-real')
const SUPABASE_URL = AMBIENTE === 'teste' ? BANCO_TESTE.url : BANCO_PRODUCAO.url
const SUPABASE_ANON_KEY = AMBIENTE === 'teste' ? BANCO_TESTE.chave : BANCO_PRODUCAO.chave

const { createClient } = supabase
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
