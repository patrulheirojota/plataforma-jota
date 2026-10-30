// =====================================================================
// NOTIFICACOES NO CELULAR (Web Push, gratuito)
//   GET  /api/push            -> chave publica (o celular precisa dela para se inscrever)
//   POST /api/push            -> o MENTOR envia um aviso (login do mentor obrigatorio)
//        { titulo, corpo, url, alvo: { tipo: 'aluno'|'turma'|'todos', id } }
// Variaveis na Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLICA, VAPID_PRIVADA
// =====================================================================
const P = require('./_push')

module.exports = async function (req, res) {
  if (req.method === 'GET') { res.status(200).json({ publica: P.cfg().publica || null, configurado: P.pronto() }); return }
  if (req.method !== 'POST') { res.status(405).json({ erro: 'metodo' }); return }
  if (!P.pronto()) { res.status(500).json({ erro: 'notificacoes ainda nao configuradas na Vercel' }); return }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  try {
    if (!(await P.ehMentor(token))) { res.status(401).json({ erro: 'somente o mentor' }); return }
    let b = req.body; if (typeof b === 'string') b = JSON.parse(b || '{}')
    const titulo = String(b.titulo || '').slice(0, 80), corpo = String(b.corpo || '').slice(0, 240)
    if (!titulo) { res.status(400).json({ erro: 'falta o titulo' }); return }
    const alvo = b.alvo || {}
    let ids = []
    if (alvo.tipo === 'aluno' && alvo.id) ids = [String(alvo.id)]
    else if (alvo.tipo === 'turma' && alvo.id) {
      const a = await P.banco('alunos?select=id&concurso_id=eq.' + encodeURIComponent(alvo.id))
      const v = await P.banco('aluno_concursos?select=aluno_id&concurso_id=eq.' + encodeURIComponent(alvo.id))
      ids = [...new Set(a.map(x => x.id).concat(v.map(x => x.aluno_id)))]
    } else if (alvo.tipo === 'todos') {
      const a = await P.banco('push_inscricoes?select=aluno_id&ativo=eq.true')
      ids = [...new Set(a.map(x => x.aluno_id))]
    } else { res.status(400).json({ erro: 'alvo invalido' }); return }
    const r = await P.enviar(ids, { titulo, corpo, url: b.url || '/cronograma.html#avisos', tag: 'aviso' }, 'avisos')
    res.status(200).json(Object.assign({ ok: true }, r))
  } catch (e) {
    res.status(500).json({ erro: String(e && e.message || e).slice(0, 200) })
  }
}
