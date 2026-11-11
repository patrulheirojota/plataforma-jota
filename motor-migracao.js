/* =====================================================================
   MOTOR DA MIGRACAO DE CONCURSO (usado em migrar-concurso.html)
   Compara as disciplinas e os temas de dois editais pelo nome e diz
   quais temas do NOVO edital o aluno ja estudou no concurso antigo.
   Funcoes puras: nao acessam o banco.
   ===================================================================== */
var MIG_STOP = { de:1, da:1, do:1, das:1, dos:1, e:1, a:1, o:1, as:1, os:1, em:1, no:1, na:1, nos:1, nas:1, ao:1, aos:1,
  um:1, uma:1, com:1, para:1, por:1, sua:1, suas:1, seu:1, seus:1, sobre:1, entre:1, ou:1, que:1, se:1,
  nocoes:1, nocao:1, conhecimentos:1, conhecimento:1, basicos:1, basicas:1, basico:1, basica:1, gerais:1, geral:1,
  aspectos:1, aspecto:1, conceito:1, conceitos:1, estudo:1, lei:1, art:1, arts:1 }
// palavras que nao distinguem disciplinas ("Direito Penal" x "Noções de Penal")
var MIG_GENERICAS_DISC = { direito:1, direitos:0, lingua:1, legislacao:0 }

function migNorm (v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^\s*[\divxlc]+\s*[.)\-–:]\s*/i, '')        // "1. ", "II - "
    .replace(/^\s*\d+(\.\d+)*\s+/, '')                     // "1.2.3 "
    .replace(/[^a-z0-9]+/g, ' ').trim()
}
function migRaiz (t) { return /^\d+$/.test(t) ? t : t.slice(0, 5) }
function migTokens (v, generico) {
  var out = []
  migNorm(v).split(' ').forEach(function (t) {
    if (!t || MIG_STOP[t]) return
    if (generico && generico[t]) return
    if (t.length < 3 && !/^\d+$/.test(t)) return
    var r = migRaiz(t)
    if (out.indexOf(r) < 0) out.push(r)
  })
  return out
}
function migInter (A, B) { var n = 0; A.forEach(function (t) { if (B.indexOf(t) >= 0) n++ }); return n }

// 0 a 1: quanto dois nomes de DISCIPLINA se parecem
function migNotaDisciplina (a, b) {
  if (migNorm(a) === migNorm(b)) return 1
  var A = migTokens(a, MIG_GENERICAS_DISC), B = migTokens(b, MIG_GENERICAS_DISC)
  if (!A.length || !B.length) return 0
  var i = migInter(A, B)
  return i / (A.length + B.length - i)
}

// 0 a 1: quanto dois nomes de TEMA se parecem
// (um contido no outro conta muito: "Crase" x "Emprego do sinal indicativo de crase")
function migNotaTema (a, b) {
  if (migNorm(a) === migNorm(b)) return 1
  var A = migTokens(a), B = migTokens(b)
  if (!A.length || !B.length) return 0
  var i = migInter(A, B)
  if (!i) return 0
  var contido = i / Math.min(A.length, B.length), jac = i / (A.length + B.length - i)
  return 0.7 * contido + 0.3 * jac
}

var MIG_CORTE_DISC = 0.6, MIG_CORTE_TEMA = 0.7

// Para cada disciplina do concurso antigo, a disciplina mais parecida do novo (ou '' se nenhuma)
function migSugerirDisciplinas (discsOrigem, discsDestino) {
  var out = {}
  discsOrigem.forEach(function (d) {
    var melhor = '', nota = 0
    discsDestino.forEach(function (x) {
      var n = migNotaDisciplina(d, x)
      if (n > nota) { nota = n; melhor = x }
    })
    out[d] = nota >= MIG_CORTE_DISC ? melhor : ''
  })
  return out
}

/* Monta a proposta.
   origem:  [{ disciplina, topico, feito }]   (temas do concurso antigo; feito = teoria ja estudada)
   destino: [{ id, disciplina, topico }]      (temas do edital novo)
   mapa:    { 'disciplina antiga': 'disciplina nova' | '' }
   Devolve, por disciplina NOVA, os temas que entram como ja estudados:
   [{ discDestino, discsOrigem:[...], marcar:[{ id, topico, de, nota }], total, estudadosOrigem, semPar:[topico antigo estudado sem equivalente] }] */
function migMontarProposta (origem, destino, mapa) {
  var porDest = {}
  Object.keys(mapa).forEach(function (dOrig) {
    var dDest = mapa[dOrig]; if (!dDest) return
    porDest[dDest] = porDest[dDest] || []
    if (porDest[dDest].indexOf(dOrig) < 0) porDest[dDest].push(dOrig)
  })
  var res = []
  Object.keys(porDest).forEach(function (dDest) {
    var origs = porDest[dDest]
    var temasO = origem.filter(function (t) { return origs.indexOf(t.disciplina) >= 0 })
    var temasD = destino.filter(function (t) { return t.disciplina === dDest })
    var marcar = [], usados = {}
    temasD.forEach(function (td) {
      var melhor = null, nota = 0
      temasO.forEach(function (to) {
        var n = migNotaTema(to.topico, td.topico)
        // empate: prefere o tema que o aluno ja estudou
        if (n > nota || (n === nota && n > 0 && to.feito && melhor && !melhor.feito)) { nota = n; melhor = to }
      })
      if (melhor && melhor.feito && nota >= MIG_CORTE_TEMA) {
        marcar.push({ id: td.id, topico: td.topico, de: melhor.topico, nota: Math.round(nota * 100) })
        usados[melhor.disciplina + '|' + melhor.topico] = true
      }
    })
    var estudados = temasO.filter(function (t) { return t.feito })
    res.push({
      discDestino: dDest, discsOrigem: origs, marcar: marcar, total: temasD.length,
      estudadosOrigem: estudados.length,
      semPar: estudados.filter(function (t) { return !usados[t.disciplina + '|' + t.topico] }).map(function (t) { return t.topico })
    })
  })
  return res.sort(function (a, b) { return b.marcar.length - a.marcar.length || a.discDestino.localeCompare(b.discDestino) })
}

if (typeof module !== 'undefined') module.exports = { migNorm: migNorm, migNotaDisciplina: migNotaDisciplina, migNotaTema: migNotaTema,
  migSugerirDisciplinas: migSugerirDisciplinas, migMontarProposta: migMontarProposta }
