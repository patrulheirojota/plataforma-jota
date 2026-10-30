/* =====================================================================
   ALUNO: notificacoes no celular + "Meus dados" (LGPD)
   Usa: _supabase, _alunoId, _mentor (do cronograma)
   ===================================================================== */
(function () {
  var PREFS_PADRAO = { diario: true, avisos: true, vencimento: true }
  function esc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
  var ua = navigator.userAgent || ''
  var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  var instalado = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
  function suportado () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window }
  function b64 (u8) { return btoa(String.fromCharCode.apply(null, new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
  function deB64 (s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a }
  var _insc = null

  async function minhaInscricao () {
    if (!suportado()) return null
    try {
      var reg = await navigator.serviceWorker.getRegistration('/')
      var sub = reg && await reg.pushManager.getSubscription()
      if (!sub) return null
      var r = await _supabase.from('push_inscricoes').select('*').eq('endpoint', sub.endpoint).maybeSingle()
      return r.data && r.data.ativo ? r.data : null
    } catch (e) { return null }
  }

  window.ativarNotificacoes = async function () {
    var m = document.getElementById('notif-msg'); function msg (t, c) { if (m) { m.style.color = c || 'var(--tx3)'; m.innerHTML = t } }
    if (!suportado()) return msg(ios ? 'No iPhone, primeiro instale a plataforma: no Safari toque em <strong>Compartilhar ⬆︎ → Adicionar à Tela de Início</strong> e abra pelo icone. Depois ative aqui.' : 'Este navegador nao aceita notificacoes. Use o Chrome.', 'var(--alerta)')
    if (ios && !instalado) return msg('No iPhone, os avisos so funcionam com a plataforma instalada: Safari → <strong>Compartilhar ⬆︎ → Adicionar à Tela de Início</strong>. Abra pelo icone e ative aqui.', 'var(--alerta)')
    msg('Ativando...')
    try {
      var k = await (await fetch('/api/push')).json()
      if (!k.publica) return msg('As notificacoes ainda estao sendo configuradas pelo mentor. Tente mais tarde.', 'var(--alerta)')
      var perm = await Notification.requestPermission()
      if (perm !== 'granted') return msg('Voce nao permitiu as notificacoes. Para ativar depois: cadeado ao lado do endereco → Notificacoes → Permitir.', 'var(--alerta)')
      var reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      var sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64(k.publica) })
      var linha = { aluno_id: _alunoId, endpoint: sub.endpoint, p256dh: b64(sub.getKey('p256dh')), auth: b64(sub.getKey('auth')),
        prefs: (_insc && _insc.prefs) || PREFS_PADRAO, aparelho: (ios ? 'iPhone' : /Android/i.test(ua) ? 'Android' : 'Computador'), ativo: true, atualizado_em: new Date().toISOString() }
      var r = await _supabase.from('push_inscricoes').upsert(linha, { onConflict: 'endpoint' })
      if (r.error) {
        // celular que ja foi de outro aluno: gera uma inscricao nova
        try { await sub.unsubscribe() } catch (e) {}
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64(k.publica) })
        linha.endpoint = sub.endpoint; linha.p256dh = b64(sub.getKey('p256dh')); linha.auth = b64(sub.getKey('auth'))
        r = await _supabase.from('push_inscricoes').insert(linha)
        if (r.error) throw r.error
      }
      try { localStorage.setItem('push_sug', 'feito') } catch (e) {}
      await renderNotificacoes()
      var s = document.getElementById('push-sug'); if (s) s.remove()
    } catch (e) { msg('Nao consegui ativar: ' + esc(e.message || e), 'var(--erro)') }
  }
  window.desativarNotificacoes = async function () {
    try {
      var reg = await navigator.serviceWorker.getRegistration('/'), sub = reg && await reg.pushManager.getSubscription()
      if (sub) { await _supabase.from('push_inscricoes').update({ ativo: false }).eq('endpoint', sub.endpoint); await sub.unsubscribe() }
    } catch (e) {}
    renderNotificacoes()
  }
  window.salvarPrefPush = async function (k, v) {
    if (!_insc) return
    _insc.prefs = Object.assign({}, PREFS_PADRAO, _insc.prefs || {}); _insc.prefs[k] = v
    await _supabase.from('push_inscricoes').update({ prefs: _insc.prefs, atualizado_em: new Date().toISOString() }).eq('id', _insc.id)
  }

  window.renderNotificacoes = async function () {
    var box = document.getElementById('perfil-notif'); if (!box) return
    if (typeof _mentor !== 'undefined' && _mentor) { box.style.display = 'none'; return }
    _insc = await minhaInscricao()
    var p = Object.assign({}, PREFS_PADRAO, (_insc && _insc.prefs) || {})
    var item = function (k, nome, sub) {
      return '<label style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--bd);cursor:pointer;font-size:13.5px">'
        + '<input type="checkbox" ' + (p[k] ? 'checked' : '') + ' onchange="salvarPrefPush(\'' + k + '\',this.checked)" style="width:19px;height:19px;flex-shrink:0;margin-top:1px">'
        + '<span><strong>' + nome + '</strong><br><span style="color:var(--tx3);font-size:12.5px">' + sub + '</span></span></label>'
    }
    box.innerHTML = '<div style="font-size:14px;font-weight:700;color:var(--ouro);margin-bottom:6px">📱 Avisos no celular</div>'
      + (_insc
        ? '<div style="color:var(--ok);font-size:13px;margin-bottom:6px">✓ Ativado neste aparelho</div>'
          + item('diario', 'Lembrete da Missao de hoje', 'As 18h, so se voce ainda nao comecou o cronograma do dia')
          + item('avisos', 'Recados do mentor', 'Quando o Jota enviar um aviso para voce ou para a turma')
          + item('vencimento', 'Vencimento do acesso', '7, 3 e 1 dia antes de vencer')
          + '<button class="btn" style="width:100%;margin-top:10px;padding:10px" onclick="desativarNotificacoes()">Desativar neste aparelho</button>'
        : '<div style="color:var(--tx3);font-size:13px;line-height:1.55;margin-bottom:8px">No maximo 1 lembrete por dia. Durante o estudo, deixe o celular no "Nao perturbe": o lembrete e para comecar, nao para interromper.</div>'
          + '<button class="btn btn-ouro" style="width:100%;padding:12px" onclick="ativarNotificacoes()">Ativar avisos neste aparelho</button>')
      + '<div id="notif-msg" style="font-size:12.5px;margin-top:8px;line-height:1.5"></div>'
  }

  // sugestao discreta na Missao de hoje (uma vez por semana, ate ativar)
  window.pushSugestaoHTML = function () {
    if (typeof _mentor !== 'undefined' && _mentor) return ''
    if (!suportado() || Notification.permission !== 'default') return ''
    try { var v = localStorage.getItem('push_sug'); if (v === 'feito' || (v && Date.now() - parseInt(v, 10) < 7 * 86400000)) return '' } catch (e) {}
    return '<div id="push-sug" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border:1px dashed var(--bd2);border-radius:12px;font-size:12.5px;color:var(--tx2)">'
      + '<span style="font-size:18px">📱</span><span style="flex:1;min-width:160px">Quer um lembrete as 18h quando ainda nao tiver comecado a missao?</span>'
      + '<button class="btn" style="padding:6px 11px" onclick="irSecao(\'perfil\');setTimeout(ativarNotificacoes,300)">Ativar</button>'
      + '<button class="btn" style="padding:6px 11px;color:var(--tx4)" onclick="try{localStorage.setItem(\'push_sug\',String(Date.now()))}catch(e){};this.parentNode.remove()">Agora nao</button></div>'
  }

  /* ---------------- LGPD: meus dados ---------------- */
  var TABELAS = [
    ['alunos', 'id'], ['config_cronograma', 'aluno_id'], ['sessoes_estudo', 'aluno_id'], ['registros_diarios', 'aluno_id'],
    ['questao_respostas', 'aluno_id'], ['questao_comentarios', 'aluno_id'], ['caderno_erros', 'aluno_id'],
    ['flashcards', 'aluno_id'], ['flashcard_progresso', 'aluno_id'], ['edital_progresso', 'aluno_id'],
    ['simulado_tentativas', 'aluno_id'], ['sim_resultados', 'aluno_id'], ['sim_respostas', 'aluno_id'],
    ['lei_leituras', 'aluno_id'], ['relatorio_ciclo_visto', 'aluno_id'], ['cronograma_log', 'aluno_id'],
    ['pedidos_acesso', 'aluno_id'], ['push_inscricoes', 'aluno_id'], ['solicitacoes_lgpd', 'aluno_id']
  ]
  window.baixarMeusDados = async function (b) {
    var m = document.getElementById('lgpd-msg'); b.disabled = true
    var out = { gerado_em: new Date().toISOString(), plataforma: 'Patrulheiros de Elite', dados: {} }
    for (var i = 0; i < TABELAS.length; i++) {
      var t = TABELAS[i]; if (m) m.textContent = 'Juntando seus dados... (' + (i + 1) + '/' + TABELAS.length + ')'
      var linhas = []
      for (var p = 0; p < 50; p++) {
        var r = await _supabase.from(t[0]).select('*').eq(t[1], _alunoId).range(p * 1000, p * 1000 + 999)
        if (r.error) { linhas = null; break }
        linhas = linhas.concat(r.data || []); if (!r.data || r.data.length < 1000) break
      }
      if (linhas && linhas.length) out.dados[t[0]] = linhas
    }
    var a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }))
    a.download = 'meus-dados-patrulheiros.json'; a.click()
    b.disabled = false; if (m) { m.style.color = 'var(--ok)'; m.textContent = '✓ Arquivo baixado (' + Object.keys(out.dados).length + ' tipos de dado).' }
  }
  window.pedirLgpd = async function () {
    var tipo = document.getElementById('lgpd-tipo').value, txt = document.getElementById('lgpd-txt').value.trim(), m = document.getElementById('lgpd-msg')
    if (tipo === 'exclusao' && !confirm('Pedir a EXCLUSAO dos seus dados?\n\nQuando o mentor concluir, seu login e bloqueado e o historico de estudo deixa de ter o seu nome. Isso nao tem volta.')) return
    var r = await _supabase.from('solicitacoes_lgpd').insert({ aluno_id: _alunoId, tipo: tipo, mensagem: txt || null })
    m.style.color = r.error ? 'var(--erro)' : 'var(--ok)'
    m.textContent = r.error ? 'Nao consegui enviar: ' + r.error.message : '✓ Pedido enviado. O mentor responde em ate 15 dias.'
    if (!r.error) document.getElementById('lgpd-txt').value = ''
  }
  window.renderMeusDados = function () {
    var box = document.getElementById('perfil-lgpd'); if (!box) return
    if (typeof _mentor !== 'undefined' && _mentor) { box.style.display = 'none'; return }
    box.innerHTML = '<div style="font-size:14px;font-weight:700;color:var(--ouro);margin-bottom:6px">🔐 Meus dados (LGPD)</div>'
      + '<div style="color:var(--tx3);font-size:13px;line-height:1.55;margin-bottom:8px">Veja como usamos seus dados nos <a href="privacidade.html" target="_blank" style="color:var(--ouro)">termos e privacidade</a>.</div>'
      + '<button class="btn" style="width:100%;padding:11px" onclick="baixarMeusDados(this)">⬇️ Baixar uma copia dos meus dados</button>'
      + '<label class="lbl" style="display:block;margin-top:12px">Pedido ao mentor</label>'
      + '<select class="inp" id="lgpd-tipo"><option value="correcao">Corrigir um dado meu</option><option value="copia">Duvida sobre meus dados</option><option value="exclusao">Excluir meus dados e minha conta</option></select>'
      + '<textarea class="inp" id="lgpd-txt" rows="2" placeholder="Explique (opcional)" style="margin-top:8px;min-height:60px"></textarea>'
      + '<button class="btn" style="width:100%;margin-top:8px;padding:10px" onclick="pedirLgpd()">Enviar pedido</button>'
      + '<div id="lgpd-msg" style="font-size:12.5px;margin-top:8px;text-align:center"></div>'
  }
})()
