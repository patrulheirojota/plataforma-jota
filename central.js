/* =====================================================================
   CENTRAL DO DIA — tudo o que o mentor precisa resolver hoje, numa tela
   (usa os dados que o admin.js ja carrega: alunos, alertas e ciclos)
   ===================================================================== */
let _central = null, _abertosCentral = {}

function hojeLocal() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function diasEntreDatas(a, b) { return Math.round((b - a) / 86400000) }
function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || '' }
function escC(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function dataBR(k) { return k ? new Date(String(k).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '' }

// evita carregar duas vezes ao mesmo tempo (o painel e este arquivo podem pedir juntos)
let _centralCarregando = null
function carregarCentral() {
  if (_centralCarregando) return _centralCarregando
  _centralCarregando = carregarCentralAgora().catch(function (e) {
    console.error(e)
    const box = document.getElementById('central-conteudo')
    if (box) box.innerHTML = '<div class="card" style="text-align:center;color:var(--erro)">Nao consegui montar a central. <button class="btn-acao btn-editar" onclick="carregarCentral()">Tentar de novo</button></div>'
  }).finally(function () { _centralCarregando = null })
  return _centralCarregando
}
async function carregarCentralAgora() {
  const box = document.getElementById('central-conteudo')
  if (!box) return
  box.innerHTML = '<div class="card" style="text-align:center;color:var(--tx3)">Montando a sua central do dia...</div>'
  // o painel ja esta carregando os alunos ao abrir: espera terminar em vez de buscar tudo de novo
  if (!window._ciclos) {
    await new Promise(function (ok) { let t = 0; const iv = setInterval(function () { if (window._ciclos || ++t > 60) { clearInterval(iv); ok() } }, 250) })
  }
  if (!window._todosAlunos) { try { await carregarAlunos() } catch (e) { console.error(e) } }
  if (!window._alertasAluno) { try { await carregarAlertas() } catch (e) {} }
  if (!window._ciclos) { try { await calcularCiclos() } catch (e) {} }

  const sete = new Date(Date.now() - 7 * 86400000).toISOString()
  const [rr, re, rc, rpd, rcp, rlg] = await Promise.all([
    _supabase.from('questao_reportes').select('*').eq('status', 'aberto').order('criado_em', { ascending: false }).limit(100),
    _supabase.from('erros_site').select('*').gte('criado_em', sete).order('criado_em', { ascending: false }).limit(60),
    _supabase.from('questao_comentarios').select('id').gte('criado_em', sete),
    _supabase.from('pedidos_acesso').select('*').eq('status', 'pendente').order('criado_em', { ascending: true }).limit(100),
    _supabase.from('compras').select('id,email,nome,produto_id,produto_nome,criado_em').eq('status', 'aprovada').is('aluno_id', null).order('criado_em', { ascending: true }).limit(100),
    _supabase.from('solicitacoes_lgpd').select('*').eq('status', 'aberta').order('criado_em', { ascending: true }).limit(50)
  ])
  _central = {
    reportes: rr.error ? null : (rr.data || []),
    todosReportes: rr.error ? null : (rr.data || []),
    erros: re.error ? null : (re.data || []),
    comentarios: rc.error ? null : (rc.data || []).length,
    pedidos: rpd && !rpd.error ? (rpd.data || []) : [],
    comprasEsperando: rcp && !rcp.error ? (rcp.data || []) : [],
    lgpd: rlg && !rlg.error ? (rlg.data || []) : []
  }
  renderCentral()
}

function montarGrupos(soTurma) {
  const alunos = (window._todosAlunos || []).filter(function (a) { return typeof alunoNaTurma !== 'function' || alunoNaTurma(a, soTurma) }), al = window._alertasAluno || {}, ci = window._ciclos || {}
  const pausados = window._pausados || {}
  const h = hojeLocal()
  const g = { sumidos: [], vencendo: [], vencidos: [], ciclos: [], mexeu: [], pausaVencida: [], bloqueados: [] }
  alunos.forEach(function (a) {
    const bloq = (typeof alunoBloqueado === 'function') ? alunoBloqueado(a) : 0
    const exp = a.data_expiracao ? new Date(a.data_expiracao + 'T00:00:00') : null
    const diasExp = exp ? diasEntreDatas(h, exp) : null
    const x = al[a.id] || {}
    if (bloq) { g.bloqueados.push({ a: a, dias: bloq }); return }
    if (exp && diasExp < 0) { if (diasExp >= -30) g.vencidos.push({ a: a, dias: -diasExp }); return }
    if (exp && diasExp <= 15) g.vencendo.push({ a: a, dias: diasExp })
    if (pausados[a.id]) {
      if (x.pausa && x.pausa.prevista && x.pausa.prevista <= h.toISOString().slice(0, 10)) g.pausaVencida.push({ a: a, prevista: x.pausa.prevista })
    } else {
      // sem estudar ha 3+ dias (ultimo estudo concluido; se nunca estudou, conta desde o ultimo acesso)
      const ref = x.estudo ? new Date(x.estudo + 'T12:00:00') : (a.ultimo_acesso ? new Date(a.ultimo_acesso) : (a.criado_em ? new Date(a.criado_em) : null))
      const dias = ref ? Math.floor((Date.now() - ref.getTime()) / 86400000) : null
      if (dias !== null && dias >= 3) g.sumidos.push({ a: a, dias: dias, nunca: !x.estudo })
    }
    if (ci[a.id] && ci[a.id].vencido) g.ciclos.push({ a: a, c: ci[a.id] })
    if (x.mudou) g.mexeu.push({ a: a, txt: x.ajusteTxt || '' })
  })
  g.sumidos.sort(function (p, q) { return q.dias - p.dias })
  g.vencendo.sort(function (p, q) { return p.dias - q.dias })
  g.vencidos.sort(function (p, q) { return p.dias - q.dias })
  g.bloqueados.sort(function (p, q) { return p.dias - q.dias })
  return g
}

function renderCentral() {
  const box = document.getElementById('central-conteudo'); if (!box) return
  const g = montarGrupos(), c = _central || {}
  // erros reportados: so os dos alunos da turma escolhida
  if (c.reportes && typeof turmaAtual === 'function' && turmaAtual()) {
    const ids = {}; (window._todosAlunos || []).forEach(function (a) { if (alunoNaTurma(a)) ids[a.id] = 1 })
    c.reportes = (_central.todosReportes || c.reportes).filter(function (r) { return ids[r.aluno_id] })
  } else if (_central && _central.todosReportes) c.reportes = _central.todosReportes
  const nRep = c.reportes ? c.reportes.length : 0, nErr = c.erros ? c.erros.length : 0
  const total = (c.pedidos || []).length + g.sumidos.length + g.vencendo.length + g.vencidos.length + g.ciclos.length + g.mexeu.length + g.pausaVencida.length + nRep
  const kpi = function (n, l, cor) { return '<div class="kpi"><div class="kpi-n" style="color:' + cor + '">' + n + '</div><div class="kpi-l">' + l + '</div></div>' }
  let h = (typeof htmlSeletorTurma === 'function' ? htmlSeletorTurma() : '')
  h += '<div class="kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">'
    + kpi(total, 'acoes para hoje', total ? 'var(--ouro)' : 'var(--ok)')
    + kpi(g.sumidos.length, 'sem estudar 3+ dias', g.sumidos.length ? 'var(--erro)' : 'var(--tx3)')
    + kpi(g.vencendo.length + g.vencidos.length, 'renovacoes', (g.vencendo.length + g.vencidos.length) ? 'var(--alerta)' : 'var(--tx3)')
    + kpi(nRep, 'erros reportados', nRep ? 'var(--erro)' : 'var(--tx3)')
    + '</div>'
  if (typeof htmlResumoTurmas === 'function' && typeof turmaAtual === 'function' && !turmaAtual()) h += htmlResumoTurmas()
  if (!total) h += '<div class="card" style="text-align:center;border-color:var(--ok)"><div style="font-size:36px">✅</div><div style="font-weight:800;color:var(--ok);margin-top:6px">Tudo em dia por aqui!</div><div style="color:var(--tx3);font-size:13px;margin-top:4px">Nenhuma pendencia com os alunos hoje.</div></div>'

  h += grupo('sumidos', '🚨', 'Sem estudar ha 3 dias ou mais', 'var(--erro)', g.sumidos, function (x) {
    return linhaAluno(x.a, (x.nunca ? 'Nunca concluiu sessao · ' : '') + x.dias + ' dia(s) sem estudar', [['💬 Mensagem', "msgCentral('sumido','" + x.a.id + "'," + x.dias + ")"], ['👁️', "verComoAluno('" + x.a.id + "')"]])
  })
  h += grupo('vencendo', '⏳', 'Acesso vencendo em ate 15 dias', 'var(--alerta)', g.vencendo, function (x) {
    return linhaAluno(x.a, x.dias === 0 ? 'Vence HOJE (' + dataBR(x.a.data_expiracao) + ')' : 'Vence em ' + x.dias + ' dia(s) · ' + dataBR(x.a.data_expiracao), [['💬 Renovacao', "msgCentral('renovar','" + x.a.id + "'," + x.dias + ")"], ['✏️', "irEditarDaCentral('" + x.a.id + "')"]])
  })
  h += grupo('vencidos', '⌛', 'Acesso vencido nos ultimos 30 dias', 'var(--alerta)', g.vencidos, function (x) {
    return linhaAluno(x.a, 'Venceu ha ' + x.dias + ' dia(s) · ' + dataBR(x.a.data_expiracao), [['💬 Renovacao', "msgCentral('vencido','" + x.a.id + "'," + x.dias + ")"], ['✏️', "irEditarDaCentral('" + x.a.id + "')"]])
  })
  h += grupo('ciclos', '🗓️', 'Relatorio de 21 dias para enviar', 'var(--alerta)', g.ciclos, function (x) {
    return linhaAluno(x.a, 'Ciclo ' + x.c.ciclo + ' · ' + x.c.iniBR + ' a ' + x.c.fimBR + (x.c.atraso > 0 ? ' · atrasado ' + x.c.atraso + ' dia(s)' : ' · fecha hoje'), [['🗓️ Fazer relatorio', "abrirRelatorioCiclo('" + x.a.id + "')"]])
  })
  h += grupo('mexeu', '🔄', 'Mexeram no cronograma (voce ainda nao viu)', 'var(--info)', g.mexeu, function (x) {
    return linhaAluno(x.a, String(x.txt).slice(0, 90), [['👁️ Ver', "verComoAluno('" + x.a.id + "')"]])
  }, '<button class="btn-acao btn-editar" style="padding:7px 12px" onclick="mostrarAba(\'aba-desempenho\')">Ver historico</button>')
  h += grupo('pausa', '⏸️', 'Pausa com retorno vencido', 'var(--alerta)', g.pausaVencida, function (x) {
    return linhaAluno(x.a, 'Retorno previsto em ' + dataBR(x.prevista), [['💬 Mensagem', "msgCentral('pausa','" + x.a.id + "',0)"], ['👁️', "verComoAluno('" + x.a.id + "')"]])
  })

  // vendas e acesso: pedidos de liberacao (Pix / Mercado Pago) e compras da Kiwify esperando
  const peds = (c.pedidos || [])
  if (peds.length) h += grupo('pedidos', '💰', 'Pagamentos para liberar (Pix / Mercado Pago)', 'var(--ok)', peds, function (p) {
    return '<div class="item-lista" style="gap:8px"><div style="flex:1;min-width:200px"><strong>' + escC(p.nome || p.email) + '</strong>' + (p.tipo === 'renovacao' ? ' <span style="color:var(--info);font-size:11.5px">renovacao</span>' : '')
      + '<div style="color:var(--tx3);font-size:12px">' + escC(p.email || '') + ' · ' + escC(p.forma_pagamento || '') + ' · ' + new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</div>'
      + (p.observacao ? '<div style="color:var(--tx2);font-size:12.5px;margin-top:3px">“' + escC(p.observacao) + '”</div>' : '') + '</div>'
      + '<button style="width:auto;margin:0;padding:8px 14px;background:var(--ok);color:#0a1420;border:1px solid var(--ok);font-weight:800" onclick="location.href=\'vendas-admin.html?ap=' + p.id + '#pedidos\'">✓ Aprovar</button></div>'
  })
  const esp = (c.comprasEsperando || []).filter(function (x) { return (Date.now() - new Date(x.criado_em).getTime()) > 30 * 60000 })
  if (esp.length) h += '<div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-color:var(--alerta)"><div style="font-size:24px">🛒</div>'
    + '<div style="flex:1;min-width:180px"><strong>' + esp.length + ' compra(s) da Kiwify ainda sem acesso</strong><div style="color:var(--tx3);font-size:12.5px">O produto nao foi configurado ou o aluno ainda nao criou o login pelo link de primeiro acesso.</div></div>'
    + '<button style="width:auto;padding:9px 15px" onclick="location.href=\'vendas-admin.html#vendas\'">Ver vendas</button></div>'

  // LGPD: pedidos dos alunos sobre os proprios dados (prazo legal: responder em ate 15 dias)
  const lg = (c.lgpd || [])
  const TIPO_LG = { exclusao: 'Excluir meus dados', correcao: 'Corrigir um dado', copia: 'Duvida sobre meus dados', outro: 'Outro' }
  if (lg.length) h += grupo('lgpd', '🔐', 'Pedidos sobre dados pessoais (LGPD)', 'var(--info)', lg, function (x) {
    const a = (window._todosAlunos || []).find(function (y) { return y.id === x.aluno_id }) || {}
    const dias = Math.floor((Date.now() - new Date(x.criado_em).getTime()) / 86400000)
    return '<div class="item-lista" style="gap:8px"><div style="flex:1;min-width:200px"><strong>' + escC(TIPO_LG[x.tipo] || x.tipo) + '</strong> · ' + escC(a.nome || 'Aluno')
      + '<div style="color:' + (dias >= 10 ? 'var(--erro)' : 'var(--tx3)') + ';font-size:12px">ha ' + dias + ' dia(s) · prazo: 15 dias</div>'
      + (x.mensagem ? '<div style="color:var(--tx2);font-size:12.5px;margin-top:3px">“' + escC(x.mensagem) + '”</div>' : '') + '</div>'
      + (x.tipo === 'exclusao' ? '<button class="btn-acao btn-excluir" style="padding:8px 12px" onclick="anonimizarLgpd(\'' + x.aluno_id + '\',\'' + jsC(a.nome || '') + '\')">Excluir dados</button>' : '')
      + '<button class="btn-acao btn-editar" style="padding:8px 12px" onclick="concluirLgpd(\'' + x.id + '\')">✓ Resolvido</button></div>'
  })

  // erros reportados nas questoes
  if (c.reportes === null) h += '<div class="card" style="border-color:var(--alerta);font-size:13px;color:var(--tx2)">Para ver os erros reportados pelos alunos, rode o arquivo <strong>atualizacao-central-mentor.sql</strong> no Supabase.</div>'
  else if (nRep) h += grupo('reportes', '⚑', 'Erros reportados nas questoes', 'var(--erro)', c.reportes, function (r) {
    const nome = ((window._todosAlunos || []).find(function (a) { return a.id === r.aluno_id }) || {}).nome || 'Aluno'
    return '<div class="item-lista" style="gap:8px"><div style="flex:1;min-width:200px"><strong>' + escC(MOTIVO_TXT[r.motivo] || r.motivo) + '</strong>'
      + '<div style="color:var(--tx3);font-size:12px">' + escC(nome) + ' · ' + new Date(r.criado_em).toLocaleDateString('pt-BR') + '</div>'
      + (r.texto ? '<div style="color:var(--tx2);font-size:12.5px;margin-top:4px;white-space:pre-wrap">' + escC(r.texto) + '</div>' : '') + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-acao btn-editar" onclick="location.href=\'questoes-admin.html#reportes\'">Abrir questao</button></div></div>'
  })

  // comentarios e erros do site
  if (c.comentarios) h += '<div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:24px">💬</div>'
    + '<div style="flex:1;min-width:180px"><strong>' + c.comentarios + ' comentario(s) novo(s) nas questoes (7 dias)</strong><div style="color:var(--tx3);font-size:12.5px">Confira se ha algo para corrigir ou apagar.</div></div>'
    + '<button style="width:auto;padding:9px 15px" onclick="location.href=\'questoes-admin.html#comentarios\'">Moderar comentarios</button></div>'
  if (c.erros && nErr) h += grupo('erros', '🐞', 'Erros do site nos ultimos 7 dias', 'var(--tx3)', c.erros, function (e) {
    const nome = ((window._todosAlunos || []).find(function (a) { return a.id === e.usuario }) || {}).nome || 'Mentor/desconhecido'
    return '<div class="item-lista" style="gap:6px;font-size:12.5px"><div style="flex:1;min-width:200px"><strong style="font-size:13px">' + escC(e.mensagem) + '</strong>'
      + '<div style="color:var(--tx3);font-size:11.5px">' + escC(e.pagina) + ' · ' + escC(nome) + ' · ' + new Date(e.criado_em).toLocaleString('pt-BR') + ' · versao ' + escC(e.versao || '?') + '</div></div></div>'
  }, '', true)

  // bloqueados ficam por ultimo (normalmente aguardam a taxa de reabilitacao)
  h += grupo('bloqueados', '🔒', 'Bloqueados por inatividade', 'var(--tx3)', g.bloqueados, function (x) {
    return linhaAluno(x.a, x.dias + ' dia(s) sem acessar', [['💬 Mensagem', "msgCentral('bloqueado','" + x.a.id + "'," + x.dias + ")"], ['🔓 Reativar', "reativarAluno('" + x.a.id + "','" + jsC(x.a.nome) + "')"]])
  }, '', true)

  box.innerHTML = h
}

const MOTIVO_TXT = { gabarito: 'Gabarito errado', enunciado: 'Erro no enunciado ou alternativas', desatualizada: 'Questao desatualizada', incompleta: 'Texto cortado ou falta imagem', outro: 'Outro problema' }
function jsC(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') }

function grupo(id, ic, titulo, cor, itens, linha, extra, fechado) {
  if (!itens || !itens.length) return ''
  const aberto = _abertosCentral[id] !== undefined ? _abertosCentral[id] : !fechado
  const mostrar = aberto ? (_abertosCentral[id + '_todos'] ? itens : itens.slice(0, 8)) : []
  return '<div class="card" style="border-left:4px solid ' + cor + '">'
    + '<div style="display:flex;align-items:center;gap:10px;cursor:pointer;flex-wrap:wrap" onclick="alternarGrupoCentral(\'' + id + '\',' + (!aberto) + ')">'
    + '<span style="font-size:20px">' + ic + '</span><strong style="flex:1;min-width:160px">' + titulo + '</strong>'
    + '<span style="background:' + cor + ';color:#0a1420;border-radius:10px;padding:2px 10px;font-weight:800;font-size:12px">' + itens.length + '</span>'
    + '<span style="color:var(--tx4)">' + (aberto ? '▾' : '▸') + '</span></div>'
    + (aberto ? '<div style="margin-top:12px">' + mostrar.map(linha).join('')
      + (itens.length > mostrar.length ? '<button class="btn-acao btn-editar" style="padding:8px 14px" onclick="_abertosCentral[\'' + id + '_todos\']=true;renderCentral()">Ver todos (' + itens.length + ')</button>' : '')
      + (extra ? '<div style="margin-top:8px">' + extra + '</div>' : '') + '</div>' : '')
    + '</div>'
}
function alternarGrupoCentral(id, v) { _abertosCentral[id] = v; renderCentral() }
function linhaAluno(a, detalhe, botoes) {
  return '<div class="item-lista" style="gap:8px"><div style="flex:1;min-width:180px"><strong>' + escC(a.nome) + '</strong>'
    + '<div style="color:var(--tx3);font-size:12px">' + escC(detalhe) + '</div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + botoes.map(function (b) {
      return '<button class="btn-acao btn-editar" style="padding:8px 12px" onclick="' + b[1] + '">' + b[0] + '</button>'
    }).join('') + '</div></div>'
}
function irEditarDaCentral(id) {
  const a = (window._todosAlunos || []).find(function (x) { return x.id === id }); if (!a) return
  mostrarAba('aba-alunos')
  setTimeout(function () { abrirEditarAluno(a.id, a.nome, a.email, a.concurso_id || '') }, 200)
}

/* ---------------- mensagens prontas ---------------- */
async function resumoAluno(id) {
  const a = (window._todosAlunos || []).find(function (x) { return x.id === id }) || {}
  const out = { horas: 0, questoes: 0, edital: null }
  try {
    const s = await todasLinhasA(function () { return _supabase.from('sessoes_estudo').select('tempo_minutos,questoes_feitas').eq('aluno_id', id).eq('concluida', true).order('id') })
    s.forEach(function (x) { out.horas += x.tempo_minutos || 0; out.questoes += x.questoes_feitas || 0 })
  } catch (e) {}
  try {
    const r = await todasLinhasA(function () { return _supabase.from('questao_respostas').select('questao_id').eq('aluno_id', id).order('questao_id') })
    out.questoes += r.length
  } catch (e) {}
  try {
    if (a.concurso_id) {
      const [t, p] = await Promise.all([
        _supabase.from('edital_topicos').select('id').eq('concurso_id', a.concurso_id),
        _supabase.from('edital_progresso').select('topico_id').eq('aluno_id', id).eq('concluido', true)
      ])
      const ids = {}; (t.data || []).forEach(function (x) { ids[x.id] = 1 })
      const feitos = (p.data || []).filter(function (x) { return ids[x.topico_id] }).length
      if ((t.data || []).length) out.edital = Math.round(feitos / t.data.length * 100)
    }
  } catch (e) {}
  out.horas = Math.round(out.horas / 60)
  return out
}

async function msgCentral(tipo, id, dias) {
  const a = (window._todosAlunos || []).find(function (x) { return x.id === id }); if (!a) return
  const n = primeiroNome(a.nome)
  abrirMsgCentral(a, 'Preparando a mensagem...')
  let t = ''
  if (tipo === 'sumido') {
    t = 'Fala, ' + n + '! Aqui e o Jota. Vi que faz ' + dias + ' dias que voce nao registra estudo na plataforma. Ta tudo bem?\n\n'
      + 'Bora retomar hoje: abre a Missao de hoje e cumpre nem que seja 1 sessao. Constancia vence talento.\n\nA sorte acompanha o audaz! 💪'
  } else if (tipo === 'pausa') {
    const al = (window._alertasAluno || {})[id] || {}
    t = 'Fala, ' + n + '! Aqui e o Jota. A previsao de retorno da sua pausa era ' + dataBR(al.pausa && al.pausa.prevista) + '.\n\n'
      + 'Quando estiver pronto, e so abrir o cronograma e tocar em "Retomar plano": tudo continua de onde voce parou.\n\nConta comigo! 🛡️'
  } else if (tipo === 'bloqueado') {
    t = 'Fala, ' + n + '! Aqui e o Jota. Seu acesso a plataforma foi bloqueado por inatividade (' + dias + ' dias sem entrar).\n\n'
      + 'Quer voltar para a missao? Me chama aqui que eu te explico como reativar. A aprovacao nao espera! 🛡️'
  } else {
    const r = await resumoAluno(id)
    // so mostra o que o aluno realmente tem (zero nao entra na mensagem)
    const itens = (Number(r.horas) > 0 ? '⏱️ ' + r.horas + 'h de estudo registradas\n' : '')
      + (Number(r.questoes) > 0 ? '🎯 ' + r.questoes + ' questoes resolvidas\n' : '')
      + (r.edital !== null && Number(r.edital) > 0 ? '📖 ' + r.edital + '% do edital estudado\n' : '')
    const conquistas = itens ? 'Olha o que voce ja construiu na mentoria:\n' + itens
      : 'Ainda da tempo de tirar muito proveito do cronograma, das questoes e do acompanhamento.\n'
    if (tipo === 'renovar') {
      t = 'Fala, ' + n + '! Aqui e o Jota. Seu acesso a mentoria Patrulheiros de Elite vence em ' + dataBR(a.data_expiracao)
        + (dias === 0 ? ' (hoje)' : ' (daqui a ' + dias + ' dia' + (dias > 1 ? 's' : '') + ')') + '.\n\n'
        + conquistas + '\nNao deixa esse ritmo parar agora. Quer renovar e seguir firme ate a aprovacao? Me responde aqui que eu te passo as condicoes. 🛡️'
    } else {
      t = 'Fala, ' + n + '! Aqui e o Jota. Seu acesso a mentoria Patrulheiros de Elite venceu em ' + dataBR(a.data_expiracao) + '.\n\n'
        + conquistas + '\nSeu plano e todo o seu progresso continuam guardados. Quer renovar e retomar de onde parou? Me responde aqui. 🛡️'
    }
  }
  abrirMsgCentral(a, t)
}

function abrirMsgCentral(a, texto) {
  let ov = document.getElementById('msg-central-ov')
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'msg-central-ov'
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(4,9,16,.7);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:40px 12px;overflow-y:auto'
    ov.onclick = function (e) { if (e.target === ov) ov.style.display = 'none' }
    document.body.appendChild(ov)
  }
  ov.style.display = 'flex'
  const tel = String(a.telefone || '').replace(/\D/g, '')
  ov.innerHTML = '<div class="card" style="width:100%;max-width:520px;margin:0">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 style="margin:0">Mensagem para ' + escC(primeiroNome(a.nome)) + '</h3>'
    + '<button class="btn-acao" style="padding:6px 11px" onclick="document.getElementById(\'msg-central-ov\').style.display=\'none\'">✕</button></div>'
    + '<p style="color:var(--tx3);font-size:12.5px;margin:6px 0 8px">Edite se quiser e envie pelo WhatsApp.</p>'
    + '<textarea id="msg-central-txt" rows="10" style="font-size:14px">' + escC(texto) + '</textarea>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">'
    + '<button style="flex:1;min-width:150px;margin:0;background:#25D366;color:#0a1420" onclick="enviarWhatsCentral(\'' + tel + '\')">📲 Abrir no WhatsApp</button>'
    + '<button style="flex:1;min-width:120px;margin:0;background:var(--card2);color:var(--tx2);border:1px solid var(--bd2)" onclick="copiarMsgCentral()">📋 Copiar</button></div>'
    + (tel ? '' : '<p style="color:var(--tx4);font-size:11.5px;margin-top:8px">Dica: cadastre o telefone do aluno (Editar aluno) para o WhatsApp abrir direto na conversa dele.</p>')
    + '<p id="msg-central-ok" style="color:var(--ok);font-size:12.5px;margin-top:6px"></p></div>'
}
function enviarWhatsCentral(tel) {
  const t = encodeURIComponent(document.getElementById('msg-central-txt').value)
  const num = tel ? (tel.length <= 11 ? '55' + tel : tel) : ''
  window.open('https://wa.me/' + num + '?text=' + t, '_blank')
}
async function copiarMsgCentral() {
  const el = document.getElementById('msg-central-txt')
  let ok = false
  try { await navigator.clipboard.writeText(el.value); ok = true } catch (e) {}
  if (!ok) { el.focus(); el.select(); try { ok = document.execCommand('copy') } catch (e) {} }
  document.getElementById('msg-central-ok').textContent = ok ? '✅ Copiada! Cole na conversa do aluno.' : 'Texto selecionado: copie com Ctrl+C.'
}

// se o painel abriu a Central antes deste arquivo terminar de chegar, monta agora
;(function () {
  const ab = document.getElementById('aba-central')
  const pn = document.getElementById('painel-admin')
  if (ab && ab.style.display !== 'none' && pn && pn.style.display !== 'none' && !_central) carregarCentral()
})()

/* ---------------- TURMAS (alunos agrupados por concurso) ---------------- */
function htmlSeletorTurma () {
  const t = turmaAtual()
  return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">'
    + '<span style="color:var(--tx3);font-size:13px;font-weight:600">Turma:</span>'
    + '<select class="filtro-turma" onchange="definirTurma(this.value)" style="width:auto;min-width:200px;margin:0">' + opcoesTurmaHTML(t) + '</select>'
    + (t ? '<button class="btn-acao btn-editar" style="padding:8px 12px" onclick="definirTurma(\'\')">Ver todas</button>' : '')
    + '</div>'
}
function htmlResumoTurmas () {
  const cs = (window._concursos || []).map(function (c) {
    const al = (window._todosAlunos || []).filter(function (a) { return alunoNaTurma(a, String(c.id)) })
    if (!al.length) return null
    const g = montarGrupos(String(c.id))
    const ativos = al.length - g.bloqueados.length - g.vencidos.length
    return { c: c, n: al.length, ativos: ativos, sum: g.sumidos.length, ren: g.vencendo.length + g.vencidos.length, cic: g.ciclos.length }
  }).filter(Boolean)
  if (cs.length < 2) return ''
  return '<div class="card"><div style="font-weight:800;font-size:14px;margin-bottom:10px">👥 Suas turmas</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">'
    + cs.map(function (x) {
      return '<div onclick="definirTurma(\'' + x.c.id + '\')" style="cursor:pointer;background:var(--card2);border:1px solid var(--bd);border-radius:12px;padding:11px 12px">'
        + '<div style="font-weight:800;color:var(--ouro);font-size:14px">' + escC(x.c.nome) + '</div>'
        + '<div style="font-size:12px;color:var(--tx3);margin-top:2px">' + x.ativos + ' ativo(s) de ' + x.n + '</div>'
        + '<div style="display:flex;gap:10px;margin-top:6px;font-size:12px;flex-wrap:wrap">'
        + '<span style="color:' + (x.sum ? 'var(--erro)' : 'var(--tx4)') + '">🚨 ' + x.sum + ' sumido(s)</span>'
        + '<span style="color:' + (x.ren ? 'var(--alerta)' : 'var(--tx4)') + '">⏳ ' + x.ren + ' renov.</span>'
        + '<span style="color:' + (x.cic ? 'var(--alerta)' : 'var(--tx4)') + '">🗓️ ' + x.cic + ' relat.</span></div></div>'
    }).join('') + '</div><div style="font-size:11.5px;color:var(--tx4);margin-top:8px">Toque numa turma para ver so as pendencias dela.</div></div>'
}

/* ---------------- LGPD ---------------- */
async function concluirLgpd (id) {
  const r = await _supabase.from('solicitacoes_lgpd').update({ status: 'concluida', concluido_em: new Date().toISOString() }).eq('id', id)
  if (r.error) { alert('Erro: ' + r.error.message); return }
  carregarCentral()
}
async function anonimizarLgpd (alunoId, nome) {
  if (!confirm('Excluir os dados pessoais de ' + (nome || 'este aluno') + '?\n\n• O nome, e-mail e telefone sao apagados\n• Comentarios e anotacoes pessoais sao apagados\n• O login e bloqueado\n• Os numeros de estudo ficam sem nome e os registros de compra sao mantidos (obrigacao legal)\n\nIsso NAO tem volta.')) return
  if (prompt('Para confirmar, digite EXCLUIR') !== 'EXCLUIR') return
  const r = await _supabase.rpc('anonimizar_aluno', { p_aluno: alunoId })
  if (r.error) { alert('Erro: ' + r.error.message); return }
  alert('Dados excluidos. Avise o aluno que o pedido foi concluido.')
  try { await carregarAlunos() } catch (e) {}
  carregarCentral()
}
