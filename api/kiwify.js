// =====================================================================
// RECEBE OS AVISOS DA KIWIFY (compra aprovada, reembolso, chargeback)
// e repassa para o banco (funcao kiwify_registrar), que libera o acesso.
//
// Configure na Vercel (Settings > Environment Variables):
//   SUPABASE_URL               https://hlygwqftnfmywsmajvkz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase > Project Settings > API keys > service_role / secret)
//   KIWIFY_SEGREDO             uma senha longa que so voce sabe (vai no fim do link do webhook)
//   KIWIFY_TOKEN               (recomendado) o "token" que a Kiwify mostra no cadastro do webhook.
//                              Com ele, a funcao confere a assinatura de cada aviso: um aviso
//                              falso e recusado mesmo que alguem descubra o KIWIFY_SEGREDO.
//
// Link para cadastrar na Kiwify:
//   https://patrulheirojota.com.br/api/kiwify?segredo=SUA_SENHA
// =====================================================================
const crypto = require('crypto')

// compara sem vazar pelo tempo de resposta
function iguais (a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''))
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y)
}

// a Kiwify assina cada aviso: HMAC-SHA1 (com o token do webhook) do corpo em JSON, no parametro "signature"
function assinaturaOk (req, corpoOriginal, token) {
  const veio = String((req.query && req.query.signature) || '').toLowerCase()
  if (!veio) return false
  const textos = []
  if (typeof corpoOriginal === 'string') textos.push(corpoOriginal)
  else if (Buffer.isBuffer(corpoOriginal)) textos.push(corpoOriginal.toString('utf8'))
  else textos.push(JSON.stringify(corpoOriginal))
  return textos.some(function (t) { return iguais(crypto.createHmac('sha1', token).update(t).digest('hex'), veio) })
}

module.exports = async function (req, res) {
  const segredo = process.env.KIWIFY_SEGREDO || ''
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (req.method === 'GET') {
    // teste rapido no navegador: mostra se a configuracao esta completa (sem revelar nada)
    res.status(200).json({ ok: true, configurado: !!(segredo && url && chave), assinatura: !!process.env.KIWIFY_TOKEN })
    return
  }
  if (req.method !== 'POST') { res.status(405).json({ erro: 'metodo' }); return }
  if (!segredo || !url || !chave) { res.status(500).json({ erro: 'falta configurar as variaveis na Vercel' }); return }

  const recebido = String((req.query && req.query.segredo) || '')
  if (!iguais(recebido, segredo)) { res.status(401).json({ erro: 'segredo invalido' }); return }

  const token = process.env.KIWIFY_TOKEN || ''
  if (token && !assinaturaOk(req, req.body, token)) { res.status(401).json({ erro: 'assinatura invalida' }); return }

  let corpo = req.body
  try { if (typeof corpo === 'string') corpo = JSON.parse(corpo) } catch (e) { res.status(400).json({ erro: 'json invalido' }); return }
  if (!corpo || typeof corpo !== 'object') { res.status(400).json({ erro: 'corpo vazio' }); return }
  // alguns envios vem dentro de "order"
  if (corpo.order && typeof corpo.order === 'object' && !corpo.order_status) corpo = Object.assign({}, corpo.order, corpo)

  try {
    const r = await fetch(url + '/rest/v1/rpc/kiwify_registrar', {
      method: 'POST',
      // chave nova (sb_secret_...) vai so no apikey; chave antiga (eyJ...) vai tambem no Authorization
      headers: Object.assign({ 'Content-Type': 'application/json', apikey: chave }, /^eyJ/.test(chave) ? { Authorization: 'Bearer ' + chave } : {}),
      body: JSON.stringify({ p: corpo })
    })
    const txt = await r.text()
    if (!r.ok) { res.status(500).json({ erro: 'banco', detalhe: txt.slice(0, 300) }); return }
    res.status(200).json({ ok: true, resultado: JSON.parse(txt) })
  } catch (e) {
    res.status(500).json({ erro: 'falha', detalhe: String(e && e.message || e).slice(0, 200) })
  }
}
