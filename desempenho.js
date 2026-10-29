/* =====================================================================
   DESEMPENHO POR ASSUNTO (compartilhado: cronograma, questoes e relatorio)
   - busca: funcao do banco "desempenho_assuntos" (rapida)
     plano B: se o SQL ainda nao foi rodado, calcula aqui mesmo
   - classifica cada assunto: ponto fraco / atencao / forte / pouco treino
   ===================================================================== */
var DES_MIN = 5          // minimo de questoes para classificar um assunto
var DES_FRACO = 60       // abaixo disso = ponto fraco
var DES_FORTE = 75       // a partir disso = forte

function desEsc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function desJs (s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') }

async function desLinhas (fn) {
  var out = [], i = 0
  for (; i < 50; i++) {
    var r = await fn().range(i * 1000, i * 1000 + 999)
    if (r.error) throw r.error
    out = out.concat(r.data || [])
    if (!r.data || r.data.length < 1000) break
  }
  return out
}

// devolve [{disciplina, assunto, feitas, certas, ultima}]
async function buscarDesempenhoAssuntos (alunoId, desde, ate) {
  try {
    var r = await _supabase.rpc('desempenho_assuntos', { p_aluno: alunoId || null, p_desde: desde || null, p_ate: ate || null })
    if (!r.error && Array.isArray(r.data)) return r.data
  } catch (e) {}
  // plano B (antes de rodar o SQL)
  var rs = await desLinhas(function () {
    var q = _supabase.from('questao_respostas').select('questao_id,correta,respondido_em').eq('aluno_id', alunoId)
    if (desde) q = q.gte('respondido_em', desde)
    if (ate) q = q.lt('respondido_em', ate)
    return q.order('questao_id')
  })
  if (!rs.length) return []
  var ids = rs.map(function (x) { return x.questao_id }).filter(function (x, i, a) { return a.indexOf(x) === i })
  var mapa = {}
  for (var i = 0; i < ids.length; i += 100) {
    var q = await _supabase.from('questoes').select('id,disciplina,assunto').in('id', ids.slice(i, i + 100))
    ;(q.data || []).forEach(function (x) { mapa[x.id] = x })
  }
  var g = {}
  rs.forEach(function (x) {
    var qq = mapa[x.questao_id]; if (!qq) return
    var d = String(qq.disciplina || '').trim() || 'Sem disciplina', a = String(qq.assunto || '').trim() || 'Geral'
    var k = d + '||' + a
    if (!g[k]) g[k] = { disciplina: d, assunto: a, feitas: 0, certas: 0, ultima: null }
    g[k].feitas++; if (x.correta) g[k].certas++
    if (!g[k].ultima || x.respondido_em > g[k].ultima) g[k].ultima = x.respondido_em
  })
  return Object.keys(g).map(function (k) { return g[k] })
}

function desClasse (feitas, certas) {
  if (!feitas || feitas < DES_MIN) return { k: 'pouco', nome: 'Pouco treino', cor: 'var(--tx3)', ic: '⚪' }
  var p = Math.round(certas / feitas * 100)
  if (p < DES_FRACO) return { k: 'fraco', nome: 'Ponto fraco', cor: '#f07171', ic: '🔴' }
  if (p < DES_FORTE) return { k: 'atencao', nome: 'Atencao', cor: '#e8b04b', ic: '🟡' }
  return { k: 'forte', nome: 'Forte', cor: '#6ddba0', ic: '🟢' }
}

// agrupa por disciplina
function desAgrupar (rows) {
  var d = {}
  rows.forEach(function (r) {
    if (!d[r.disciplina]) d[r.disciplina] = { nome: r.disciplina, feitas: 0, certas: 0, assuntos: [] }
    d[r.disciplina].feitas += r.feitas; d[r.disciplina].certas += r.certas
    d[r.disciplina].assuntos.push(r)
  })
  return Object.keys(d).map(function (k) { return d[k] })
}

function desPontosFracos (rows, n) {
  return rows.filter(function (r) { return desClasse(r.feitas, r.certas).k === 'fraco' })
    .sort(function (a, b) { return a.certas / a.feitas - b.certas / b.feitas || b.feitas - a.feitas }).slice(0, n || 3)
}
function desPontosFortes (rows, n) {
  return rows.filter(function (r) { return desClasse(r.feitas, r.certas).k === 'forte' })
    .sort(function (a, b) { return b.certas / b.feitas - a.certas / a.feitas || b.feitas - a.feitas }).slice(0, n || 3)
}

// link para treinar o assunto no banco de questoes (mantem o modo mentor)
function desLinkTreinar (d, a, status) {
  var qs = new URLSearchParams(location.search), al = qs.get('aluno')
  return 'questoes.html?' + (al ? 'aluno=' + encodeURIComponent(al) + '&' : '') + 'treinar=' + encodeURIComponent(d + '||' + a) + (status ? '&st=' + status : '')
}

function desLinkQuestoes () {
  var al = new URLSearchParams(location.search).get('aluno')
  return 'questoes.html' + (al ? '?aluno=' + encodeURIComponent(al) : '')
}

/* ---------------- tela completa ---------------- */
var _desRows = [], _desOrdem = 'fracos', _desAberto = {}
function desBarra (p, cor) { return '<div style="height:6px;border-radius:4px;background:var(--bd);overflow:hidden;margin-top:5px"><div style="height:100%;width:' + p + '%;background:' + cor + '"></div></div>' }

function htmlDesempenhoAssuntos (rows, opts) {
  opts = opts || {}
  _desRows = rows || []
  if (!_desRows.length) {
    return '<div style="text-align:center;color:var(--tx3);font-size:13px;padding:22px;line-height:1.6">Voce ainda nao resolveu questoes no banco da plataforma.<br>'
      + '<a href="' + desLinkQuestoes() + '" style="color:var(--ouro);font-weight:700">Resolver questoes agora →</a></div>'
  }
  var tot = _desRows.reduce(function (a, r) { return a + r.feitas }, 0)
  var cer = _desRows.reduce(function (a, r) { return a + r.certas }, 0)
  var fr = desPontosFracos(_desRows, 3)
  var cont = { fraco: 0, atencao: 0, forte: 0, pouco: 0 }
  _desRows.forEach(function (r) { cont[desClasse(r.feitas, r.certas).k]++ })

  var h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:14px">'
  ;[['fraco', '🔴', 'Pontos fracos', '#f07171'], ['atencao', '🟡', 'Atencao', '#e8b04b'], ['forte', '🟢', 'Fortes', '#6ddba0'], ['pouco', '⚪', 'Pouco treino', 'var(--tx3)']].forEach(function (x) {
    h += '<div style="background:var(--card2);border:1px solid var(--bd);border-radius:12px;padding:10px;text-align:center">'
      + '<div style="font-size:20px;font-weight:800;color:' + x[3] + '">' + cont[x[0]] + '</div>'
      + '<div style="font-size:11.5px;color:var(--tx3)">' + x[1] + ' ' + x[2] + '</div></div>'
  })
  h += '</div>'
  h += '<div style="font-size:12px;color:var(--tx3);margin-bottom:12px">' + tot + ' questoes ' + (opts.rotulo || 'resolvidas no banco') + ' · ' + Math.round(cer / tot * 100) + '% de acerto geral. '
    + 'Assunto com menos de ' + DES_MIN + ' questoes fica como "pouco treino" (ainda nao da para avaliar).</div>'

  if (fr.length && !opts.semFoco) {
    h += '<div style="border:1px solid #f07171;background:rgba(240,113,113,.07);border-radius:12px;padding:12px;margin-bottom:14px">'
      + '<div style="font-weight:800;color:#f07171;font-size:13.5px;margin-bottom:8px">🎯 Seu foco agora</div>'
      + fr.map(function (r) {
        var p = Math.round(r.certas / r.feitas * 100)
        return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--bd)">'
          + '<div style="flex:1;min-width:160px"><div style="font-size:13.5px;font-weight:700">' + desEsc(r.assunto) + '</div>'
          + '<div style="font-size:11.5px;color:var(--tx3)">' + desEsc(r.disciplina) + ' · ' + r.certas + '/' + r.feitas + ' (' + p + '%)</div></div>'
          + '<a class="btn" style="text-decoration:none;border-color:#f07171;color:#f07171;padding:7px 12px;font-size:12.5px" href="' + desLinkTreinar(r.disciplina, r.assunto, 'errei') + '">Refazer erros</a>'
          + '<a class="btn btn-ouro" style="text-decoration:none;padding:7px 12px;font-size:12.5px" href="' + desLinkTreinar(r.disciplina, r.assunto, 'nao') + '">Questoes novas</a></div>'
      }).join('') + '</div>'
  }

  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
  ;[['fracos', 'Piores primeiro'], ['disc', 'Por disciplina'], ['mais', 'Mais treinados']].forEach(function (o) {
    h += '<button class="btn" style="padding:6px 12px;font-size:12px;' + (_desOrdem === o[0] ? 'border-color:var(--ouro);color:var(--ouro);font-weight:700' : '') + '" onclick="desMudarOrdem(\'' + o[0] + '\')">' + o[1] + '</button>'
  })
  h += '</div><div id="des-lista">' + htmlDesLista() + '</div>'
  return h
}

function desMudarOrdem (o) {
  _desOrdem = o
  var box = document.getElementById('des-lista'); if (!box) return
  box.parentNode.querySelectorAll('button[onclick^="desMudarOrdem"]').forEach(function (b) {
    var on = b.getAttribute('onclick').indexOf("'" + o + "'") >= 0
    b.style.borderColor = on ? 'var(--ouro)' : ''; b.style.color = on ? 'var(--ouro)' : ''; b.style.fontWeight = on ? '700' : ''
  })
  box.innerHTML = htmlDesLista()
}
function desAlternar (i) { _desAberto[i] = !_desAberto[i]; var b = document.getElementById('des-lista'); if (b) b.innerHTML = htmlDesLista() }

function htmlLinhaAssunto (r) {
  var c = desClasse(r.feitas, r.certas), p = Math.round(r.certas / r.feitas * 100)
  return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 0;border-top:1px solid var(--bd)">'
    + '<div style="flex:1;min-width:170px"><div style="font-size:13px;font-weight:600">' + c.ic + ' ' + desEsc(r.assunto) + '</div>'
    + '<div style="font-size:11.5px;color:var(--tx3)">' + (_desOrdem === 'disc' ? '' : desEsc(r.disciplina) + ' · ') + r.certas + ' de ' + r.feitas + ' certas'
    + (r.ultima ? ' · ultima vez ' + new Date(r.ultima).toLocaleDateString('pt-BR') : '') + '</div>'
    + desBarra(p, c.cor) + '</div>'
    + '<div style="text-align:right;min-width:56px"><div style="font-size:16px;font-weight:800;color:' + c.cor + '">' + p + '%</div><div style="font-size:10.5px;color:' + c.cor + '">' + c.nome + '</div></div>'
    + '<a class="btn" style="text-decoration:none;padding:6px 11px;font-size:12px" href="' + desLinkTreinar(r.disciplina, r.assunto, r.certas < r.feitas ? 'errei' : 'nao') + '">Treinar</a></div>'
}

function htmlDesLista () {
  var rows = _desRows.slice()
  if (_desOrdem === 'disc') {
    return desAgrupar(rows).sort(function (a, b) { return a.nome.localeCompare(b.nome) }).map(function (d, i) {
      var p = Math.round(d.certas / d.feitas * 100), c = desClasse(d.feitas, d.certas)
      var ab = _desAberto[i]
      return '<div style="background:var(--card2);border:1px solid var(--bd);border-radius:12px;padding:11px 13px;margin-bottom:8px">'
        + '<div style="display:flex;gap:10px;align-items:center;cursor:pointer" onclick="desAlternar(' + i + ')">'
        + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">' + desEsc(d.nome) + '</div>'
        + '<div style="font-size:11.5px;color:var(--tx3)">' + d.assuntos.length + ' assunto(s) · ' + d.certas + '/' + d.feitas + ' certas</div>' + desBarra(p, c.cor) + '</div>'
        + '<div style="font-size:17px;font-weight:800;color:' + c.cor + '">' + p + '%</div><div style="color:var(--tx3)">' + (ab ? '▴' : '▾') + '</div></div>'
        + (ab ? d.assuntos.sort(function (x, y) { return x.certas / x.feitas - y.certas / y.feitas }).map(htmlLinhaAssunto).join('') : '')
        + '</div>'
    }).join('')
  }
  if (_desOrdem === 'mais') rows.sort(function (a, b) { return b.feitas - a.feitas })
  else rows.sort(function (a, b) {
    var ka = a.feitas >= DES_MIN ? 0 : 1, kb = b.feitas >= DES_MIN ? 0 : 1
    if (ka !== kb) return ka - kb
    return a.certas / a.feitas - b.certas / b.feitas || b.feitas - a.feitas
  })
  var lim = _desAberto.todos ? rows.length : 15
  return rows.slice(0, lim).map(htmlLinhaAssunto).join('')
    + (rows.length > lim ? '<button class="btn" style="width:100%;margin-top:8px" onclick="_desAberto.todos=1;document.getElementById(\'des-lista\').innerHTML=htmlDesLista()">Ver todos os ' + rows.length + ' assuntos</button>' : '')
}
