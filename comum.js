/* =====================================================================
   COMUM A TODAS AS PAGINAS
   - numero da versao no rodape (confira se a Vercel publicou o arquivo certo)
   - registro de erros do navegador (o mentor ve em Central do dia)
   - aviso para instalar a plataforma como app na tela inicial (alunos)
   A cada atualizacao, troque a VERSAO abaixo.
   ===================================================================== */
(function () {
  var VERSAO = '2026.10.29-b'
  window.VERSAO_PLATAFORMA = VERSAO

  var pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase()
  var PAGINAS_MENTOR = ['admin.html', 'overview.html', 'gerador.html', 'ajustar.html', 'temas.html', 'importador.html',
    'questoes-admin.html', 'flashcards-admin.html', 'simulados-admin.html', 'edital-admin.html', 'relatorio.html', 'marca.html']
  function ehPaginaMentor () {
    return PAGINAS_MENTOR.indexOf(pagina) >= 0 || /[?&](aluno|admin)=/.test(location.search)
  }

  /* ---------------- versao no rodape ---------------- */
  function rodape () {
    if (document.getElementById('versao-rodape')) return
    var d = document.createElement('div')
    d.id = 'versao-rodape'
    d.style.cssText = 'text-align:center;font-size:10.5px;color:var(--tx4,#4d6684);padding:18px 10px 84px;letter-spacing:.3px'
    d.textContent = 'Patrulheiros de Elite · versao ' + VERSAO
    document.body.appendChild(d)
  }

  /* ---------------- registro de erros ---------------- */
  var enviados = 0, vistos = {}
  function registrar (msg, detalhe) {
    try {
      msg = String(msg || '').slice(0, 480)
      if (!msg || enviados >= 5 || vistos[msg]) return
      if (/ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:/i.test(msg + ' ' + (detalhe || ''))) return
      vistos[msg] = 1; enviados++
      if (typeof _supabase === 'undefined' || !_supabase.auth) return
      _supabase.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session
        if (!s) return
        _supabase.from('erros_site').insert({
          usuario: s.user.id,
          pagina: (pagina + location.search).slice(0, 200),
          mensagem: msg,
          detalhe: String(detalhe || '').slice(0, 1900),
          navegador: (navigator.userAgent || '').slice(0, 250),
          versao: VERSAO
        }).then(function () {}, function () {})
      }, function () {})
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    registrar(e.message, (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || '') + '\n' + ((e.error && e.error.stack) || ''))
  })
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason || {}
    registrar('Falha: ' + (r.message || String(r)), r.stack || '')
  })
  window.registrarErroSite = registrar

  /* ---------------- instalar como app ---------------- */
  var adiado = 'app_inst_adiado', nunca = 'app_inst_nunca', evento = null
  function ls (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) { return null } }
  function instalado () {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
  }
  function podeMostrar () {
    if (ehPaginaMentor() || instalado() || ls(nunca) === '1') return false
    var t = parseInt(ls(adiado) || '0', 10)
    return !t || (Date.now() - t) > 5 * 86400000   // pergunta de novo depois de 5 dias
  }
  var ua = navigator.userAgent || ''
  var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  var celular = ios || /Android|Mobile/i.test(ua)

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault()
    evento = e
  })

  function fechar (tipo) {
    var b = document.getElementById('app-inst'); if (b) b.remove()
    if (tipo === 'nunca') ls(nunca, '1')
    else ls(adiado, String(Date.now()))
  }
  window.fecharAvisoApp = fechar
  window.instalarApp = function () {
    if (evento) {
      evento.prompt()
      evento.userChoice.then(function (c) { fechar(c && c.outcome === 'accepted' ? 'nunca' : 'depois') }, function () { fechar('depois') })
      evento = null
    } else fechar('depois')
  }

  function aviso () {
    if (!podeMostrar() || document.getElementById('app-inst')) return
    // espera outra janela da pagina fechar (ex.: fechamento do dia)
    var modal = document.querySelector('.modal.on, #modal.on, .fcm-ov.on, .rc-ov.on')
    if (modal) { setTimeout(aviso, 6000); return }
    var passos
    if (evento) {
      passos = '<div style="font-size:13px;color:var(--tx2,#8fa5bd);line-height:1.55;margin-top:4px">Acesse seu cronograma com um toque, em tela cheia, como um aplicativo.</div>'
    } else if (ios) {
      passos = '<div style="font-size:13px;color:var(--tx2,#8fa5bd);line-height:1.6;margin-top:4px">No Safari: toque em <strong style="color:var(--tx,#e8edf4)">Compartilhar</strong> '
        + '<span style="display:inline-block;border:1px solid var(--bd2,#24384f);border-radius:6px;padding:0 5px">⬆︎</span> e depois em '
        + '<strong style="color:var(--tx,#e8edf4)">Adicionar à Tela de Início</strong>.</div>'
    } else {
      passos = '<div style="font-size:13px;color:var(--tx2,#8fa5bd);line-height:1.6;margin-top:4px">No menu do navegador <strong style="color:var(--tx,#e8edf4)">⋮</strong>, toque em '
        + '<strong style="color:var(--tx,#e8edf4)">Instalar app</strong> ou <strong style="color:var(--tx,#e8edf4)">Adicionar à tela inicial</strong>.</div>'
    }
    var b = document.createElement('div')
    b.id = 'app-inst'
    b.setAttribute('role', 'dialog')
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:14px;z-index:600;max-width:440px;margin:0 auto;'
      + 'background:var(--bg2,#0c1826);border:1px solid var(--ouro,#C9A83C);border-radius:16px;padding:16px;'
      + 'box-shadow:0 14px 40px rgba(0,0,0,.45);font-family:inherit;color:var(--tx,#e8edf4);animation:appInst .3s ease'
    b.innerHTML = '<style>@keyframes appInst{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}</style>'
      + '<div style="display:flex;gap:12px;align-items:flex-start">'
      + '<img src="/icone-192.png" alt="" onerror="this.style.visibility=\hidden" style="width:48px;height:48px;border-radius:12px;flex-shrink:0;background:var(--card,#101d2c)">'
      + '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:15px">Instale o app Patrulheiros</div>' + passos + '</div>'
      + '<button onclick="fecharAvisoApp(\'depois\')" aria-label="Fechar" style="background:none;border:0;color:var(--tx3,#63809e);font-size:18px;cursor:pointer;padding:0 2px">✕</button></div>'
      + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + (evento ? '<button onclick="instalarApp()" style="flex:1;min-width:130px;padding:11px;border-radius:10px;border:0;background:var(--ouro,#C9A83C);color:#0a1420;font-weight:800;font-size:14px;cursor:pointer">Instalar agora</button>' : '')
      + '<button onclick="fecharAvisoApp(\'depois\')" style="flex:1;min-width:110px;padding:11px;border-radius:10px;border:1px solid var(--bd2,#24384f);background:transparent;color:var(--tx2,#8fa5bd);font-weight:700;font-size:13px;cursor:pointer">' + (evento ? 'Agora nao' : 'Entendi') + '</button>'
      + '<button onclick="fecharAvisoApp(\'nunca\')" style="padding:11px 8px;border:0;background:transparent;color:var(--tx4,#4d6684);font-size:12px;cursor:pointer;text-decoration:underline">Nao mostrar mais</button>'
      + '</div>'
    document.body.appendChild(b)
  }

  function iniciar () {
    rodape()
    if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('/sw.js').catch(function () {}) } catch (e) {} }
    if (celular && podeMostrar()) setTimeout(aviso, 3500)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})();
