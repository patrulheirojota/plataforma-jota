// =====================================================================
// LEMBRETE DIARIO (18h): a Vercel chama sozinha uma vez por dia (vercel.json -> crons)
// No maximo 1 por aluno: acesso vencendo ou Missao de hoje ainda nao comecada.
// Protegido pela variavel CRON_SECRET (a Vercel envia automaticamente).
// =====================================================================
const P = require('./_push')

module.exports = async function (req, res) {
  const segredo = process.env.CRON_SECRET || ''
  const veio = String(req.headers.authorization || '')
  if (!segredo || veio !== 'Bearer ' + segredo) { res.status(401).json({ erro: 'nao autorizado' }); return }
  if (!P.pronto()) { res.status(500).json({ erro: 'notificacoes ainda nao configuradas' }); return }
  try {
    const lista = await P.banco('rpc/lembretes_do_dia', { method: 'POST', body: '{}' })
    let enviados = 0, falhas = 0
    for (const l of lista || []) {
      const tipo = /vence/i.test(l.titulo) ? 'vencimento' : 'diario'
      const r = await P.enviar([l.aluno_id], { titulo: l.titulo, corpo: l.corpo, url: l.url, tag: tipo }, tipo)
      enviados += r.enviados; falhas += r.falhas
    }
    res.status(200).json({ ok: true, alunos: (lista || []).length, enviados, falhas })
  } catch (e) {
    res.status(500).json({ erro: String(e && e.message || e).slice(0, 200) })
  }
}
