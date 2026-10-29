/* =====================================================================
   POMODORO + MODO FOCO
   - antes de comecar: checklist do foco (Nao perturbe ligado, celular longe...)
   - cronometro que nao se perde (continua certo mesmo trocando de pagina)
   - alerta no fim (som, vibracao e, se permitido, aviso na tela bloqueada)
   - conta quantas vezes o aluno saiu da tela durante o foco
   - pode registrar o tempo estudado na sessao do cronograma
   Use: pomoAbrir({ sessaoId, titulo })
   ===================================================================== */
(function () {
  var CH = 'pomo_estado', est = null, tick = null, wake = null, audio = null
  function ler () { try { return JSON.parse(localStorage.getItem(CH) || 'null') } catch (e) { return null } }
  function gravar () { try { if (est) localStorage.setItem(CH, JSON.stringify(est)); else localStorage.removeItem(CH) } catch (e) {} }
  function hoje () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
  function diaStats () { try { return JSON.parse(localStorage.getItem('pomo_dia_' + hoje()) || '{"n":0,"min":0}') } catch (e) { return { n: 0, min: 0 } } }
  function somarDia (min) { var s = diaStats(); s.n++; s.min += min; try { localStorage.setItem('pomo_dia_' + hoje(), JSON.stringify(s)) } catch (e) {} }
  function esc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
  function mmss (ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }

  function css () {
    if (document.getElementById('pomo-css')) return
    var st = document.createElement('style'); st.id = 'pomo-css'
    st.textContent = '.pomo-ov{position:fixed;inset:0;background:rgba(5,10,18,.86);z-index:650;display:flex;align-items:flex-start;justify-content:center;padding:18px 12px;overflow-y:auto}'
      + '.pomo-c{background:var(--bg2,#0c1826);border:1px solid var(--ouro,#C9A83C);border-radius:18px;padding:18px;width:100%;max-width:460px;margin:auto 0;color:var(--tx,#e8edf4);font-family:inherit}'
      + '.pomo-pill{position:fixed;left:14px;bottom:18px;z-index:640;background:var(--bg2,#0c1826);border:1.5px solid var(--ouro,#C9A83C);border-radius:30px;padding:9px 15px;color:var(--tx,#e8edf4);font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.4);font-variant-numeric:tabular-nums;font-family:inherit}'
      + '.pomo-pill.pausa{border-color:#6ddba0}'
      + '.pomo-b{display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:12px;border:1px solid var(--bd2,#24384f);background:var(--card,#101d2c);color:var(--tx,#e8edf4);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;width:100%}'
      + '.pomo-b.ouro{background:var(--ouro,#C9A83C);border-color:var(--ouro,#C9A83C);color:#0a1420;font-weight:800}'
      + '.pomo-b:disabled{opacity:.45;cursor:default}'
      + '.pomo-ck{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--bd,#1b2c40);font-size:13.5px;line-height:1.45;cursor:pointer}'
      + '.pomo-ck input{width:20px;height:20px;flex-shrink:0;margin-top:1px}'
      + '.pomo-pre{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}'
      + '.pomo-pre button{padding:10px 6px;border-radius:10px;border:1px solid var(--bd2,#24384f);background:var(--card2,#0d1a28);color:var(--tx2,#8fa5bd);font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}'
      + '.pomo-pre button.on{border-color:var(--ouro,#C9A83C);color:var(--ouro,#C9A83C);background:var(--hov,#16283c)}'
    document.head.appendChild(st)
  }
  function caixa (h) {
    css()
    var ov = document.getElementById('pomo-ov')
    if (!ov) { ov = document.createElement('div'); ov.id = 'pomo-ov'; ov.className = 'pomo-ov'; document.body.appendChild(ov) }
    ov.style.display = 'flex'
    ov.innerHTML = '<div class="pomo-c">' + h + '</div>'
  }
  function fecharCaixa () { var ov = document.getElementById('pomo-ov'); if (ov) ov.style.display = 'none' }
  window.pomoFecharCaixa = fecharCaixa

  /* ---------- configuracao + checklist de foco ---------- */
  var cfg = { foco: 25, pausa: 5 }
  try { var c0 = JSON.parse(localStorage.getItem('pomo_cfg') || 'null'); if (c0) cfg = c0 } catch (e) {}
  var _opts = {}
  window.pomoAbrir = function (opts) {
    est = ler()
    if (est && est.fase !== 'parado') { painel(); return }
    _opts = opts || {}
    var notif = ('Notification' in window) ? Notification.permission : 'indisponivel'
    caixa('<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:18px;font-weight:800">🍅 Pomodoro · modo foco</div><button class="pomo-b" style="width:auto;padding:6px 11px" onclick="pomoFecharCaixa()">✕</button></div>'
      + (_opts.titulo ? '<div style="color:var(--ouro,#C9A83C);font-size:13px;font-weight:700;margin-top:4px">' + esc(_opts.titulo) + '</div>' : '')
      + '<div style="color:var(--tx3,#63809e);font-size:12.5px;margin-top:6px;line-height:1.5">Blocos de foco total com pausas curtas. Escolha o ritmo:</div>'
      + '<div class="pomo-pre" id="pomo-pre">'
      + [[25, 5, '25 + 5'], [50, 10, '50 + 10'], [90, 15, '90 + 15']].map(function (p) { return '<button class="' + (cfg.foco === p[0] ? 'on' : '') + '" onclick="pomoPreset(' + p[0] + ',' + p[1] + ')">' + p[2] + ' min</button>' }).join('') + '</div>'
      + '<div style="font-weight:800;font-size:14px;margin:6px 0 4px">Antes de comecar</div>'
      + '<label class="pomo-ck"><input type="checkbox" id="pk-np" onchange="pomoChecar()"><span><strong>Ativei o "Nao perturbe"</strong> (Android: puxe a barra de cima · iPhone: Central de Controle → Foco). Notificacao e o que mais rouba o foco e gera procrastinacao.</span></label>'
      + '<label class="pomo-ck"><input type="checkbox" id="pk-cel" onchange="pomoChecar()"><span>Fechei WhatsApp, redes sociais e abas que nao sao de estudo.</span></label>'
      + '<label class="pomo-ck"><input type="checkbox" id="pk-mat"><span>Agua, caneta e material ao lado (para nao levantar no meio).</span></label>'
      + (notif === 'default' ? '<div style="background:var(--card2,#0d1a28);border:1px solid var(--bd2,#24384f);border-radius:10px;padding:10px;margin-top:8px;font-size:12.5px;color:var(--tx2,#8fa5bd);line-height:1.5">Quer ser avisado quando o tempo acabar mesmo com a tela bloqueada? A plataforma so envia esse aviso.<button class="pomo-b" style="margin-top:8px;padding:9px" onclick="pomoPermitirAviso(this)">🔔 Permitir aviso de fim do Pomodoro</button></div>' : '')
      + '<button class="pomo-b ouro" id="pk-ir" style="margin-top:14px;padding:15px;font-size:15px" disabled onclick="pomoComecar()">Comecar foco de <span id="pk-min">' + cfg.foco + '</span> min</button>'
      + '<div style="color:var(--tx4,#4d6684);font-size:11.5px;text-align:center;margin-top:8px">Hoje: ' + diaStats().n + ' pomodoro(s) · ' + diaStats().min + ' min de foco</div>')
  }
  window.pomoPreset = function (f, p) {
    cfg = { foco: f, pausa: p }; try { localStorage.setItem('pomo_cfg', JSON.stringify(cfg)) } catch (e) {}
    document.querySelectorAll('#pomo-pre button').forEach(function (b, i) { b.classList.toggle('on', [25, 50, 90][i] === f) })
    var m = document.getElementById('pk-min'); if (m) m.textContent = f
  }
  window.pomoChecar = function () {
    var ok = document.getElementById('pk-np').checked && document.getElementById('pk-cel').checked
    document.getElementById('pk-ir').disabled = !ok
  }
  window.pomoPermitirAviso = function (b) {
    try { Notification.requestPermission().then(function (p) { b.textContent = p === 'granted' ? '✓ Aviso permitido' : 'Aviso nao permitido (tudo bem: toca o alarme na tela)'; b.disabled = true }) } catch (e) {}
  }
  function prepararSom () {
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume() } catch (e) {}
  }
  function bipe () {
    try {
      prepararSom(); if (!audio) return
      [0, 0.35, 0.7].forEach(function (t) {
        var o = audio.createOscillator(), g = audio.createGain()
        o.frequency.value = 880; o.connect(g); g.connect(audio.destination)
        g.gain.setValueAtTime(0.0001, audio.currentTime + t)
        g.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.28)
        o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.3)
      })
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]) } catch (e) {}
  }
  function avisar (titulo, corpo) {
    bipe()
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { r.showNotification(titulo, { body: corpo, icon: '/icone-192.png', tag: 'pomodoro' }) }).catch(function () { new Notification(titulo, { body: corpo }) })
        else new Notification(titulo, { body: corpo })
      }
    } catch (e) {}
  }
  async function telaLigada (on) {
    try { if (on && 'wakeLock' in navigator && !document.hidden) wake = await navigator.wakeLock.request('screen'); else if (!on && wake) { wake.release(); wake = null } } catch (e) {}
  }

  window.pomoComecar = function () {
    prepararSom()
    est = { fase: 'foco', fim: Date.now() + cfg.foco * 60000, foco: cfg.foco, pausa: cfg.pausa, ciclo: 1, feitos: 0, focoMin: 0, saidas: 0, sessaoId: _opts.sessaoId || null, titulo: _opts.titulo || '', pausadoRest: null }
    gravar(); fecharCaixa(); telaLigada(true); iniciarTique()
  }
  function restante () { return est.pausadoRest != null ? est.pausadoRest : est.fim - Date.now() }

  /* ---------- pilula flutuante e painel ---------- */
  function pilula () {
    css()
    var p = document.getElementById('pomo-pill')
    if (!est || est.fase === 'parado') { if (p) p.remove(); return }
    if (!p) { p = document.createElement('button'); p.id = 'pomo-pill'; p.className = 'pomo-pill'; p.onclick = painel; document.body.appendChild(p) }
    p.className = 'pomo-pill' + (est.fase === 'pausa' ? ' pausa' : '')
    p.textContent = (est.fase === 'foco' ? '🍅 ' : '☕ ') + mmss(restante()) + (est.pausadoRest != null ? ' ⏸' : '')
  }
  function painel () {
    if (!est) return
    var foco = est.fase === 'foco', r = restante()
    caixa('<div style="text-align:center">'
      + '<div style="font-size:12px;font-weight:800;letter-spacing:1px;color:' + (foco ? 'var(--ouro,#C9A83C)' : '#6ddba0') + '">' + (foco ? 'FOCO · BLOCO ' + est.ciclo : 'PAUSA') + '</div>'
      + (est.titulo ? '<div style="font-size:13px;color:var(--tx2,#8fa5bd);margin-top:4px">' + esc(est.titulo) + '</div>' : '')
      + '<div id="pomo-big" style="font-size:58px;font-weight:900;font-variant-numeric:tabular-nums;margin:8px 0">' + mmss(r) + '</div>'
      + '<div style="font-size:12.5px;color:var(--tx3,#63809e)">' + est.feitos + ' bloco(s) concluido(s) · ' + est.focoMin + ' min de foco'
      + (est.saidas ? ' · <span style="color:#e8b04b">saiu da tela ' + est.saidas + 'x</span>' : '') + '</div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">'
      + (est.pausadoRest != null ? '<button class="pomo-b ouro" onclick="pomoRetomar()">▶ Continuar</button>' : '<button class="pomo-b" onclick="pomoPausar()">⏸ Pausar</button>')
      + '<button class="pomo-b" onclick="pomoPular()">' + (foco ? '⏭ Ir para a pausa' : '⏭ Voltar ao foco') + '</button></div>'
      + (est.sessaoId ? '<button class="pomo-b" style="margin-top:8px;border-color:#6ddba0;color:#6ddba0" onclick="pomoConcluirSessao()">✅ Terminei a sessao (registrar ' + Math.max(est.focoMin, 1) + ' min)</button>' : '')
      + '<button class="pomo-b" style="margin-top:8px;color:#f07171;border-color:#f07171" onclick="pomoEncerrar()">Encerrar Pomodoro</button>'
      + '<button class="pomo-b" style="margin-top:8px" onclick="pomoFecharCaixa()">Minimizar</button>')
  }
  window.pomoPainel = painel
  window.pomoPausar = function () { est.pausadoRest = est.fim - Date.now(); gravar(); painel(); pilula() }
  window.pomoRetomar = function () { est.fim = Date.now() + est.pausadoRest; est.pausadoRest = null; gravar(); painel(); pilula(); telaLigada(true) }
  window.pomoPular = function () { fimFase(true) }
  window.pomoEncerrar = function () {
    if (!confirm('Encerrar o Pomodoro?' + (est.focoMin ? '\n\nVoce focou ' + est.focoMin + ' min.' : ''))) return
    est = null; gravar(); fecharCaixa(); pilula(); telaLigada(false); clearInterval(tick)
  }
  window.pomoConcluirSessao = async function () {
    var id = est.sessaoId, min = Math.max(est.focoMin + (est.fase === 'foco' ? Math.floor((est.foco * 60000 - restante()) / 60000) : 0), 1)
    est = null; gravar(); fecharCaixa(); pilula(); telaLigada(false); clearInterval(tick)
    if (typeof window.pomoRegistrarSessao === 'function') await window.pomoRegistrarSessao(id, min)
  }

  function fimFase (pulou) {
    if (!est) return
    if (est.fase === 'foco') {
      var feito = pulou ? Math.max(0, Math.floor((est.foco * 60000 - restante()) / 60000)) : est.foco
      est.focoMin += feito
      if (!pulou || feito >= 5) { est.feitos++; somarDia(feito) }
      est.fase = 'pausa'; est.fim = Date.now() + est.pausa * 60000; est.pausadoRest = null
      gravar()
      if (!pulou) avisar('🍅 Foco concluido!', 'Hora da pausa de ' + est.pausa + ' min. Levante, beba agua, sem celular.')
      painel()
    } else {
      est.fase = 'foco'; est.ciclo++; est.fim = Date.now() + est.foco * 60000; est.pausadoRest = null
      gravar()
      if (!pulou) avisar('☕ Pausa encerrada', 'Bora para o bloco ' + est.ciclo + '. Celular longe!')
      painel()
    }
    pilula()
  }
  function iniciarTique () {
    clearInterval(tick)
    tick = setInterval(function () {
      if (!est) { clearInterval(tick); return }
      if (est.pausadoRest == null && Date.now() >= est.fim) fimFase(false)
      pilula()
      var b = document.getElementById('pomo-big'); if (b) b.textContent = mmss(restante())
    }, 1000)
    pilula()
  }
  // sair da tela durante o foco conta como distracao
  // (trocar de pagina dentro da plataforma nao conta: so sair por mais de 4 segundos)
  var tSaida = null
  window.addEventListener('pagehide', function () { clearTimeout(tSaida) })
  document.addEventListener('visibilitychange', function () {
    if (!est || est.fase !== 'foco' || est.pausadoRest != null) return
    if (document.hidden) {
      clearTimeout(tSaida)
      tSaida = setTimeout(function () { var e2 = ler(); if (e2 && e2.fase === 'foco') { e2.saidas = (e2.saidas || 0) + 1; est = e2; gravar() } }, 4000)
    } else {
      var curta = !!tSaida; clearTimeout(tSaida); tSaida = null
      est = ler() || est
      telaLigada(true)
      if (!curta && est.saidas && typeof toast === 'function') toast('🍅 Voce saiu da tela. Volte ao foco: faltam ' + mmss(restante()))
    }
  })
  function iniciar () {
    est = ler()
    if (est && est.fase && est.fase !== 'parado') {
      // se o tempo acabou enquanto a pagina estava fechada
      if (est.pausadoRest == null && Date.now() >= est.fim) {
        var foco = est.fase === 'foco'
        if (foco) { est.focoMin += est.foco; est.feitos++; somarDia(est.foco) }
        est.fase = foco ? 'pausa' : 'foco'; if (!foco) est.ciclo++
        est.fim = Date.now() + (foco ? est.pausa : est.foco) * 60000
        gravar()
        iniciarTique()
        bipe(); painel()
        return
      }
      iniciarTique()
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar()
})()
