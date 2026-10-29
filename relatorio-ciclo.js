/* =====================================================================
   RELATORIO AUTOMATICO DE 21 DIAS (aluno)
   - os ciclos contam a partir do dia em que o aluno foi cadastrado
   - quando um ciclo fecha, o relatorio aparece ANTES da Missao de hoje
   - o aluno toca em "Ciente" e o relatorio fica guardado no historico
   Precisa: desempenho.js e o SQL atualizacao-desempenho-turmas.sql
   ===================================================================== */
var RC_DIAS = 21

function rcYmd (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
function rcData (k) { return new Date(k + 'T12:00:00') }
function rcBR (k) { return rcData(k).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
function rcSoma (k, n) { var d = rcData(k); d.setDate(d.getDate() + n); return rcYmd(d) }
function rcEsc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function rcHoras (min) { var h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? ' ' + m + 'min' : '') }

// inicio dos ciclos = dia do cadastro do aluno
function rcInicio (criadoEm) { var d = criadoEm ? new Date(criadoEm) : new Date(); return rcYmd(d) }
function rcCiclosFechados (criadoEm) {
  var ini = rcData(rcInicio(criadoEm)), hoje = rcData(rcYmd(new Date()))
  return Math.max(0, Math.floor(Math.round((hoje - ini) / 86400000) / RC_DIAS))
}
function rcPeriodo (criadoEm, k) {
  var a = rcSoma(rcInicio(criadoEm), RC_DIAS * (k - 1))
  return { ciclo: k, ini: a, fimExcl: rcSoma(a, RC_DIAS), fim: rcSoma(a, RC_DIAS - 1) }
}

async function rcMedir (alunoId, p) {
  var desde = p.ini + 'T00:00:00', ate = p.fimExcl + 'T00:00:00'
  var tz = function (k) { return new Date(k).toISOString() }
  var res = await Promise.all([
    _supabase.from('sessoes_estudo').select('data,concluida,tempo_minutos,questoes_feitas,questoes_certas,caderno_erros_lido,disciplina')
      .eq('aluno_id', alunoId).gte('data', p.ini).lt('data', p.fimExcl).limit(1000),
    _supabase.from('questao_respostas').select('correta,respondido_em').eq('aluno_id', alunoId)
      .gte('respondido_em', tz(desde)).lt('respondido_em', tz(ate)).limit(5000),
    _supabase.from('simulado_tentativas').select('acertos,total,finalizado_em').eq('aluno_id', alunoId)
      .gte('finalizado_em', tz(desde)).lt('finalizado_em', tz(ate)).limit(200)
  ])
  var sess = (res[0] && res[0].data) || [], resp = (res[1] && res[1].data) || [], sims = (res[2] && res[2].data) || []
  var feitas = sess.filter(function (s) { return s.concluida })
  var dias = {}, diasCad = {}
  feitas.forEach(function (s) { dias[s.data] = 1 })
  sess.forEach(function (s) { if (s.caderno_erros_lido) diasCad[s.data] = 1 })
  resp.forEach(function (r) { if (r.respondido_em) dias[rcYmd(new Date(r.respondido_em))] = 1 })
  // maior sequencia de dias seguidos estudando dentro do ciclo
  var seq = 0, cur = 0
  for (var i = 0; i < RC_DIAS; i++) { if (dias[rcSoma(p.ini, i)]) { cur++; if (cur > seq) seq = cur } else cur = 0 }
  var qS = sess.reduce(function (a, s) { return a + (s.questoes_feitas || 0) }, 0)
  var cS = sess.reduce(function (a, s) { return a + (s.questoes_certas || 0) }, 0)
  var qB = resp.length, cB = resp.filter(function (r) { return r.correta }).length
  var assuntos = []
  try { assuntos = await buscarDesempenhoAssuntos(alunoId, tz(desde), tz(ate)) } catch (e) {}
  var simPct = sims.filter(function (s) { return s.total }).map(function (s) { return s.acertos / s.total * 100 })
  return {
    sessoes: sess.length, concluidas: feitas.length,
    cumprimento: sess.length ? Math.round(feitas.length / sess.length * 100) : null,
    minutos: feitas.reduce(function (a, s) { return a + (s.tempo_minutos || 0) }, 0),
    diasEstudo: Object.keys(dias).length, diasCaderno: Object.keys(diasCad).length, sequencia: seq,
    questoes: qS + qB, acerto: (qS + qB) ? Math.round((cS + cB) / (qS + qB) * 100) : null,
    questoesBanco: qB,
    simulados: sims.length, simMedia: simPct.length ? Math.round(simPct.reduce(function (a, b) { return a + b }, 0) / simPct.length) : null,
    fortes: desPontosFortes(assuntos, 3), fracos: desPontosFracos(assuntos, 3)
  }
}

function rcSeta (agora, antes, sufixo) {
  if (antes == null || agora == null) return ''
  var d = agora - antes
  if (!d) return '<span style="color:var(--tx3);font-size:11px"> = igual ao ciclo anterior</span>'
  return '<span style="color:' + (d > 0 ? '#6ddba0' : '#f07171') + ';font-size:11px;font-weight:700"> ' + (d > 0 ? '▲ +' : '▼ ') + d + (sufixo || '') + ' vs. ciclo anterior</span>'
}

function rcMensagem (m) {
  var base = m.cumprimento != null ? m.cumprimento : Math.round(m.diasEstudo / RC_DIAS * 100)
  if (!m.diasEstudo) return ['😶', 'Ciclo parado', 'Voce nao registrou estudo neste ciclo. Nao tem problema recomecar, o que nao pode e desistir. Hoje e o dia 1 do seu novo ciclo.', '#f07171']
  if (base >= 85) return ['🏆', 'Ciclo de elite', 'Constancia de quem vai ser aprovado. Mantenha o padrao e ataque os pontos fracos abaixo.', '#6ddba0']
  if (base >= 65) return ['💪', 'Bom ciclo', 'Voce manteve o ritmo na maior parte do tempo. Ajuste os detalhes e o proximo ciclo pode ser de elite.', '#e8b04b']
  return ['⚠️', 'Ciclo abaixo do esperado', 'O ritmo caiu neste ciclo. Reveja sua rotina, corte distracoes e foque em cumprir o basico todos os dias.', '#f07171']
}

function rcMetas (m, metaDia) {
  var out = []
  var c = m.cumprimento
  if (c != null) out.push(c < 80 ? 'Cumprir pelo menos 80% das sessoes do cronograma (neste ciclo: ' + c + '%).' : 'Manter o cumprimento acima de 80% (neste ciclo: ' + c + '%).')
  else out.push('Estudar pelo menos 5 dias por semana.')
  var alvoQ = Math.max(Math.ceil((m.questoes * 1.2) / 10) * 10, Math.min((metaDia || 30) * 15, 600))
  out.push('Resolver ' + alvoQ + ' questoes no proximo ciclo (neste: ' + m.questoes + ').')
  if (m.fracos.length) out.push('Treinar "' + m.fracos[0].assunto + '" (' + m.fracos[0].disciplina + ') ate passar de 60% de acerto.')
  if (m.diasEstudo && m.diasCaderno < m.diasEstudo * 0.7) out.push('Ler o caderno de erros em todos os dias de estudo (neste ciclo: ' + m.diasCaderno + ' de ' + m.diasEstudo + ' dias).')
  return out.slice(0, 4)
}

function rcKpi (ic, valor, nome, extra, cor) {
  return '<div style="background:var(--card2);border:1px solid var(--bd);border-radius:12px;padding:11px 12px">'
    + '<div style="font-size:11.5px;color:var(--tx3)">' + ic + ' ' + nome + '</div>'
    + '<div style="font-size:21px;font-weight:800;color:' + (cor || 'var(--tx)') + ';margin-top:2px">' + valor + '</div>' + (extra || '') + '</div>'
}

function rcHTML (nome, p, m, ant, metaDia, jaVisto) {
  var msg = rcMensagem(m)
  var corAc = m.acerto == null ? 'var(--tx3)' : m.acerto >= 70 ? '#6ddba0' : m.acerto >= 50 ? '#e8b04b' : '#f07171'
  var h = '<div style="text-align:center;margin-bottom:14px">'
    + '<div style="font-size:11px;font-weight:800;letter-spacing:1px;color:var(--ouro);text-transform:uppercase">Relatorio do ciclo ' + p.ciclo + ' · 21 dias</div>'
    + '<div style="font-size:12.5px;color:var(--tx3);margin-top:3px">' + rcBR(p.ini) + ' a ' + rcBR(p.fim) + '</div>'
    + '<div style="font-size:42px;margin-top:10px">' + msg[0] + '</div>'
    + '<div style="font-size:20px;font-weight:800;color:' + msg[3] + '">' + msg[1] + ', ' + rcEsc(String(nome || '').split(' ')[0]) + '</div>'
    + '<div style="font-size:13px;color:var(--tx2);line-height:1.6;margin-top:6px">' + msg[2] + '</div></div>'
  h += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">'
    + rcKpi('📅', m.cumprimento == null ? '--' : m.cumprimento + '%', 'Cronograma cumprido', '<div style="font-size:11px;color:var(--tx3)">' + m.concluidas + ' de ' + m.sessoes + ' sessoes</div>' + (ant ? rcSeta(m.cumprimento, ant.cumprimento, ' pts') : ''), m.cumprimento == null ? 'var(--tx3)' : m.cumprimento >= 80 ? '#6ddba0' : m.cumprimento >= 60 ? '#e8b04b' : '#f07171')
    + rcKpi('⏱️', rcHoras(m.minutos), 'Horas de estudo', '<div style="font-size:11px;color:var(--tx3)">' + m.diasEstudo + ' de 21 dias com estudo</div>' + (ant ? rcSeta(Math.round(m.minutos / 60), Math.round(ant.minutos / 60), 'h') : ''))
    + rcKpi('🎯', String(m.questoes), 'Questoes', '<div style="font-size:11px;color:' + corAc + '">' + (m.acerto == null ? 'sem questoes' : m.acerto + '% de acerto') + '</div>' + (ant ? rcSeta(m.questoes, ant.questoes, '') : ''))
    + rcKpi('🔥', m.sequencia + (m.sequencia === 1 ? ' dia' : ' dias'), 'Maior sequencia', '<div style="font-size:11px;color:var(--tx3)">📓 caderno em ' + m.diasCaderno + ' dia(s)</div>')
    + '</div>'
  if (m.simulados) h += '<div style="font-size:12.5px;color:var(--tx2);margin-top:8px;text-align:center">🧪 ' + m.simulados + ' simulado(s) no ciclo · media ' + m.simMedia + '%</div>'
  if (m.fortes.length || m.fracos.length) {
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:12px">'
    if (m.fortes.length) h += '<div style="border:1px solid #6ddba0;border-radius:12px;padding:10px 12px"><div style="font-weight:800;color:#6ddba0;font-size:13px;margin-bottom:4px">🟢 Pontos fortes</div>'
      + m.fortes.map(function (r) { return '<div style="font-size:12.5px;color:var(--tx2);padding:2px 0">' + rcEsc(r.assunto) + ' <span style="color:var(--tx3)">· ' + Math.round(r.certas / r.feitas * 100) + '% em ' + r.feitas + 'q</span></div>' }).join('') + '</div>'
    if (m.fracos.length) h += '<div style="border:1px solid #f07171;border-radius:12px;padding:10px 12px"><div style="font-weight:800;color:#f07171;font-size:13px;margin-bottom:4px">🔴 Precisa de atencao</div>'
      + m.fracos.map(function (r) { return '<div style="font-size:12.5px;color:var(--tx2);padding:2px 0">' + rcEsc(r.assunto) + ' <span style="color:var(--tx3)">· ' + Math.round(r.certas / r.feitas * 100) + '% em ' + r.feitas + 'q</span></div>' }).join('') + '</div>'
    h += '</div>'
  }
  h += '<div style="background:var(--card2);border:1px solid var(--ouro);border-radius:12px;padding:12px 14px;margin-top:12px">'
    + '<div style="font-weight:800;color:var(--ouro);font-size:13.5px;margin-bottom:6px">🎖️ Missao para os proximos 21 dias</div>'
    + rcMetas(m, metaDia).map(function (t, i) { return '<div style="font-size:13px;color:var(--tx2);line-height:1.55;padding:3px 0">' + (i + 1) + ') ' + rcEsc(t) + '</div>' }).join('')
    + '</div>'
    + '<div style="font-size:12px;color:var(--tx3);text-align:center;margin-top:10px">Seu mentor acompanha estes numeros e pode complementar com uma analise individual.</div>'
  h += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'
    + (jaVisto ? '<button class="btn btn-ouro" style="flex:1;padding:13px" onclick="rcFechar()">Fechar</button>'
      : '<button class="btn btn-ouro" style="flex:1;padding:13px;font-size:15px" onclick="rcCiente()">Ciente, bora para o proximo ciclo! 🛡️</button>')
    + '</div>'
  return h
}

var _rcAtual = null
function rcAbrirCaixa (conteudo) {
  var ov = document.getElementById('rc-ov')
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'rc-ov'; ov.className = 'rc-ov on'
    ov.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(5,10,18,.88);overflow-y:auto;padding:18px 12px;display:flex;justify-content:center;align-items:flex-start'
    document.body.appendChild(ov)
  }
  ov.className = 'rc-ov on'; ov.style.display = 'flex'
  ov.innerHTML = '<div style="background:var(--bg2,#0c1826);border:1px solid var(--ouro);border-radius:18px;padding:18px 16px;width:100%;max-width:560px;margin:auto 0">' + conteudo + '</div>'
}
function rcFechar () {
  var ov = document.getElementById('rc-ov'); if (ov) { ov.style.display = 'none'; ov.className = 'rc-ov' }
  var cb = _rcAtual && _rcAtual.depois; _rcAtual = null
  if (typeof cb === 'function') cb()
}
async function rcCiente () {
  var r = _rcAtual; if (!r) { rcFechar(); return }
  try { localStorage.setItem('rc_visto_' + r.alunoId + '_' + r.p.ciclo, '1') } catch (e) {}
  try {
    await _supabase.from('relatorio_ciclo_visto').insert({ aluno_id: r.alunoId, ciclo: r.p.ciclo, periodo_inicio: r.p.ini, periodo_fim: r.p.fim, resumo: r.resumo })
  } catch (e) {}
  rcFechar()
}

async function rcMontar (aluno, k, jaVisto, depois) {
  rcAbrirCaixa('<div style="text-align:center;color:var(--tx3);padding:30px">Montando seu relatorio do ciclo ' + k + '...</div>')
  var p = rcPeriodo(aluno.criado_em, k)
  var m = await rcMedir(aluno.id, p)
  var ant = null
  if (k > 1) { try { ant = await rcMedir(aluno.id, rcPeriodo(aluno.criado_em, k - 1)) } catch (e) {} }
  var resumo = { cumprimento: m.cumprimento, minutos: m.minutos, questoes: m.questoes, acerto: m.acerto, dias: m.diasEstudo }
  _rcAtual = { alunoId: aluno.id, p: p, resumo: resumo, depois: depois }
  rcAbrirCaixa(rcHTML(aluno.nome, p, m, ant, aluno.meta_questoes_dia, jaVisto))
}

// chamada ao abrir o cronograma (so o aluno). Devolve true se mostrou o relatorio.
async function verificarRelatorioCiclo (aluno, depois) {
  try {
    if (!aluno || !aluno.criado_em) return false
    var k = rcCiclosFechados(aluno.criado_em)
    if (k < 1) return false
    try { if (localStorage.getItem('rc_visto_' + aluno.id + '_' + k)) return false } catch (e) {}
    var r = await _supabase.from('relatorio_ciclo_visto').select('ciclo').eq('aluno_id', aluno.id).eq('ciclo', k).limit(1)
    if (!r.error && r.data && r.data.length) { try { localStorage.setItem('rc_visto_' + aluno.id + '_' + k, '1') } catch (e) {} return false }
    await rcMontar(aluno, k, false, depois)
    return true
  } catch (e) { console.error(e); return false }
}

// historico na secao Desempenho
function htmlHistoricoCiclos (aluno) {
  var k = rcCiclosFechados(aluno && aluno.criado_em)
  if (!k) {
    var falta = RC_DIAS - (Math.round((rcData(rcYmd(new Date())) - rcData(rcInicio(aluno && aluno.criado_em))) / 86400000) % RC_DIAS)
    return '<div style="color:var(--tx3);font-size:13px">Seu primeiro relatorio de 21 dias sai em ' + falta + ' dia(s).</div>'
  }
  var h = '<div style="display:flex;gap:6px;flex-wrap:wrap">'
  for (var i = k; i >= Math.max(1, k - 11); i--) {
    var p = rcPeriodo(aluno.criado_em, i)
    h += '<button class="btn" style="padding:8px 12px;font-size:12.5px" onclick="rcAbrirHistorico(' + i + ')">📄 Ciclo ' + i + ' · ' + rcBR(p.ini) + '–' + rcBR(p.fim) + '</button>'
  }
  return h + '</div>'
}
var _rcAluno = null
function rcAbrirHistorico (k) { if (_rcAluno) rcMontar(_rcAluno, k, true) }
