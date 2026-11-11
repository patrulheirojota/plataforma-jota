/* =====================================================================
   MOTOR DA COBERTURA DO BANCO DE QUESTOES
   Compara as disciplinas e temas de cada edital com as questoes do banco
   e diz onde falta questao. Usa as comparacoes de nome do motor-migracao.js
   ("Portugues" = "Lingua Portuguesa"). Funcoes puras: nao acessam o banco.
   ===================================================================== */
var BANCO_PRIOS = [
  ['urgente', 'Edital aberto', 4, '#f07171'],
  ['alta', 'Alta', 3, '#e8b04b'],
  ['media', 'Media', 2, '#5bb3f0'],
  ['baixa', 'Baixa', 1, '#8a9bb0'],
  ['fora', 'Fora do radar', 0, '#5c6b7d']
]
function bancoPrio (p) {
  for (var i = 0; i < BANCO_PRIOS.length; i++) if (BANCO_PRIOS[i][0] === p) return { id: BANCO_PRIOS[i][0], nome: BANCO_PRIOS[i][1], peso: BANCO_PRIOS[i][2], cor: BANCO_PRIOS[i][3] }
  return bancoPrio('media')
}
function bancoStatus (n, meta) {
  var p = meta > 0 ? n / meta : 1
  if (p < 0.25) return { id: 'critico', nome: 'Critico', cor: '#f07171' }
  if (p < 0.6) return { id: 'baixo', nome: 'Baixo', cor: '#e8b04b' }
  if (p < 1) return { id: 'quase', nome: 'Quase la', cor: '#5bb3f0' }
  return { id: 'ok', nome: 'Na meta', cor: '#3ccf8e' }
}

/* dados = resultado da funcao banco_contagem() do Supabase:
   { total, banco:[{d,a,n}], vinc:[{c,d,n}], edital:[{c,d,t}], concursos:[{id,nome,prio,meta}] }
   Devolve { total, concursos:[...ordenados por prioridade e falta], discsSemEdital:[{d,n}] } */
function bancoCobertura (dados) {
  dados = dados || {}
  var banco = dados.banco || [], vinc = dados.vinc || [], edital = dados.edital || []
  // disciplinas do banco: total e assuntos
  var discBanco = {}, ordemDisc = []
  banco.forEach(function (x) {
    var d = x.d || '(sem disciplina)'
    if (!discBanco[d]) { discBanco[d] = { n: 0, assuntos: {} }; ordemDisc.push(d) }
    discBanco[d].n += x.n
    if (x.a) discBanco[d].assuntos[x.a] = (discBanco[d].assuntos[x.a] || 0) + x.n
  })
  // cache de comparacao edital x banco
  var cacheDisc = {}
  function discsDoBanco (dEdital) {
    if (cacheDisc[dEdital]) return cacheDisc[dEdital]
    var r = ordemDisc.filter(function (d) { return migNotaDisciplina(dEdital, d) >= MIG_CORTE_DISC })
    cacheDisc[dEdital] = r
    return r
  }
  var usadas = {}
  var lista = (dados.concursos || []).map(function (c) {
    var pr = bancoPrio(c.prio), meta = c.meta || 200
    var temas = edital.filter(function (e) { return e.c === c.id })
    var discs = []
    var porDisc = {}
    temas.forEach(function (e) { if (!porDisc[e.d]) { porDisc[e.d] = []; discs.push(e.d) } porDisc[e.d].push(e.t) })
    var linhas = discs.map(function (d) {
      var ds = discsDoBanco(d)
      ds.forEach(function (x) { usadas[x] = 1 })
      var nBanco = 0, assuntos = {}
      ds.forEach(function (x) { nBanco += discBanco[x].n; Object.keys(discBanco[x].assuntos).forEach(function (a) { assuntos[a] = (assuntos[a] || 0) + discBanco[x].assuntos[a] }) })
      var nConc = 0
      vinc.forEach(function (v) { if (v.c === c.id && ds.indexOf(v.d || '(sem disciplina)') >= 0) nConc += v.n })
      var temasN = porDisc[d].map(function (t) {
        var n = 0
        Object.keys(assuntos).forEach(function (a) { if (migNotaTema(a, t) >= MIG_CORTE_TEMA) n += assuntos[a] })
        return { t: t, n: n }
      })
      var st = bancoStatus(nBanco, meta)
      return { disc: d, nBanco: nBanco, nConc: nConc, meta: meta, pct: Math.min(100, Math.round(nBanco * 100 / meta)), status: st,
        falta: Math.max(0, meta - nBanco), temas: temasN, temasSem: temasN.filter(function (x) { return !x.n }).length, nomesBanco: ds }
    })
    linhas.sort(function (a, b) { return a.pct - b.pct || a.disc.localeCompare(b.disc) })
    var falta = 0, soma = 0
    linhas.forEach(function (l) { falta += l.falta; soma += Math.min(l.nBanco, l.meta) })
    var pct = linhas.length ? Math.round(soma * 100 / (linhas.length * meta)) : 0
    return { id: c.id, nome: c.nome, prio: pr, meta: meta, temEdital: linhas.length > 0, discs: linhas, falta: falta, pct: pct,
      abaixo: linhas.filter(function (l) { return l.status.id === 'critico' || l.status.id === 'baixo' }).length,
      nConc: vinc.filter(function (v) { return v.c === c.id }).reduce(function (s, v) { return s + v.n }, 0) }
  })
  lista.sort(function (a, b) {
    return (b.temEdital - a.temEdital) || (b.prio.peso - a.prio.peso) || (a.pct - b.pct) || a.nome.localeCompare(b.nome)
  })
  var semEdital = ordemDisc.filter(function (d) { return !usadas[d] }).map(function (d) { return { d: d, n: discBanco[d].n } })
  return { total: dados.total || 0, concursos: lista, discsSemEdital: semEdital }
}

/* Lista do que alimentar primeiro (para a Central do dia):
   disciplinas abaixo da meta dos concursos priorizados, da mais urgente para a menos. */
function bancoPrioridades (cob, limite) {
  var itens = []
  ;(cob.concursos || []).forEach(function (c) {
    if (!c.temEdital || c.prio.peso <= 0) return
    c.discs.forEach(function (l) {
      if (l.status.id === 'ok') return
      itens.push({ c: c, l: l, nota: c.prio.peso * 1000 + (100 - l.pct) * 5 + Math.min(l.temasSem, 40) })
    })
  })
  itens.sort(function (a, b) { return b.nota - a.nota })
  // so os concursos do nivel de prioridade mais alto que tiver falta aparecem primeiro; o resto vem depois
  return limite ? itens.slice(0, limite) : itens
}

if (typeof module !== 'undefined') module.exports = { bancoCobertura: bancoCobertura, bancoPrioridades: bancoPrioridades, bancoPrio: bancoPrio, bancoStatus: bancoStatus, BANCO_PRIOS: BANCO_PRIOS }
