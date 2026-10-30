// Funcoes compartilhadas das notificacoes (o "_" no nome faz a Vercel nao publicar este arquivo como endereco)
const webpush = require('web-push')

function cfg () {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    chave: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    publica: process.env.VAPID_PUBLICA || '',
    privada: process.env.VAPID_PRIVADA || '',
    contato: process.env.VAPID_CONTATO || 'mailto:suporte.patrulheirojota@gmail.com'
  }
}
function pronto () { const c = cfg(); return !!(c.url && c.chave && c.publica && c.privada) }
function cab (c, extra) { return Object.assign({ apikey: c.chave, 'Content-Type': 'application/json' }, /^eyJ/.test(c.chave) ? { Authorization: 'Bearer ' + c.chave } : {}, extra || {}) }

async function banco (caminho, opcoes) {
  const c = cfg()
  const r = await fetch(c.url + '/rest/v1/' + caminho, Object.assign({ headers: cab(c) }, opcoes || {}))
  const t = await r.text()
  if (!r.ok) throw new Error('banco ' + r.status + ': ' + t.slice(0, 200))
  return t ? JSON.parse(t) : null
}

// confere se quem chamou e o mentor (pelo login dele)
async function ehMentor (token) {
  if (!token) return false
  const c = cfg()
  const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.chave, Authorization: 'Bearer ' + token } })
  if (!r.ok) return false
  const u = await r.json()
  if (!u || !u.id) return false
  const a = await banco('admins?select=user_id&user_id=eq.' + encodeURIComponent(u.id))
  return Array.isArray(a) && a.length > 0
}

// envia para todos os celulares ativos dos alunos indicados
async function enviar (alunoIds, msg, tipo) {
  const c = cfg()
  webpush.setVapidDetails(c.contato, c.publica, c.privada)
  if (!alunoIds.length) return { enviados: 0, falhas: 0, celulares: 0 }
  let insc = []
  for (let i = 0; i < alunoIds.length; i += 100) {
    const lote = alunoIds.slice(i, i + 100).map(encodeURIComponent).join(',')
    insc = insc.concat(await banco('push_inscricoes?select=id,aluno_id,endpoint,p256dh,auth,prefs&ativo=eq.true&aluno_id=in.(' + lote + ')'))
  }
  insc = insc.filter(s => !tipo || !s.prefs || s.prefs[tipo] !== false)
  let enviados = 0, falhas = 0
  const corpo = JSON.stringify({ titulo: msg.titulo, corpo: msg.corpo, url: msg.url || '/cronograma.html', tag: msg.tag || tipo || 'aviso' })
  await Promise.all(insc.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, corpo, { TTL: 60 * 60 * 12 })
      enviados++
    } catch (e) {
      falhas++
      // celular desinstalou ou bloqueou: desativa a inscricao (nao apaga)
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        try { await banco('push_inscricoes?id=eq.' + s.id, { method: 'PATCH', body: JSON.stringify({ ativo: false }) }) } catch (x) {}
      }
    }
  }))
  return { enviados, falhas, celulares: insc.length }
}

module.exports = { cfg, pronto, banco, ehMentor, enviar }
