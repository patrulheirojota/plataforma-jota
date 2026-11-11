/* =====================================================================
   COMUM A TODAS AS PAGINAS
   - numero da versao no rodape (confira se a Vercel publicou o arquivo certo)
   - registro de erros do navegador (o mentor ve em Central do dia)
   - aviso para instalar a plataforma como app na tela inicial (alunos)
   A cada atualizacao, troque a VERSAO abaixo.
   ===================================================================== */
(function () {
  var VERSAO = '2026.11.11-c'
  window.VERSAO_PLATAFORMA = VERSAO

  var pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase()
  var PAGINAS_MENTOR = ['admin.html', 'overview.html', 'gerador.html', 'ajustar.html', 'temas.html', 'importador.html',
    'questoes-admin.html', 'flashcards-admin.html', 'simulados-admin.html', 'leis-admin.html', 'vendas-admin.html', 'notificacoes-admin.html', 'edital-admin.html', 'relatorio.html', 'marca.html', 'migrar-concurso.html', 'banco-cobertura.html']
  function ehPaginaMentor () {
    return PAGINAS_MENTOR.indexOf(pagina) >= 0 || /[?&](aluno|admin)=/.test(location.search)
  }

  /* ---------------- versao no rodape ---------------- */
  function rodape () {
    if (document.getElementById('versao-rodape')) return
    var d = document.createElement('div')
    d.id = 'versao-rodape'
    d.style.cssText = 'text-align:center;font-size:10.5px;color:var(--tx4,#4d6684);padding:18px 10px 84px;letter-spacing:.3px'
    d.textContent = 'Patrulheiros de Elite · versao ' + VERSAO + (typeof AMBIENTE !== 'undefined' && AMBIENTE !== 'producao' ? ' · ' + AMBIENTE : '')
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
      + '<img src="/icone-192.png" alt="" onerror="this.style.visibility=\'hidden\'" style="width:48px;height:48px;border-radius:12px;flex-shrink:0;background:var(--card,#101d2c)">'
      + '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:15px">Instale o app Patrulheiros</div>' + passos + '</div>'
      + '<button onclick="fecharAvisoApp(\'depois\')" aria-label="Fechar" style="background:none;border:0;color:var(--tx3,#63809e);font-size:18px;cursor:pointer;padding:0 2px">✕</button></div>'
      + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + (evento ? '<button onclick="instalarApp()" style="flex:1;min-width:130px;padding:11px;border-radius:10px;border:0;background:var(--ouro,#C9A83C);color:#0a1420;font-weight:800;font-size:14px;cursor:pointer">Instalar agora</button>' : '')
      + '<button onclick="fecharAvisoApp(\'depois\')" style="flex:1;min-width:110px;padding:11px;border-radius:10px;border:1px solid var(--bd2,#24384f);background:transparent;color:var(--tx2,#8fa5bd);font-weight:700;font-size:13px;cursor:pointer">' + (evento ? 'Agora nao' : 'Entendi') + '</button>'
      + '<button onclick="fecharAvisoApp(\'nunca\')" style="padding:11px 8px;border:0;background:transparent;color:var(--tx4,#4d6684);font-size:12px;cursor:pointer;text-decoration:underline">Nao mostrar mais</button>'
      + '</div>'
    document.body.appendChild(b)
  }

  /* ---------------- aviso de ambiente de teste ---------------- */
  function faixaTeste () {
    if (typeof AMBIENTE === 'undefined' || AMBIENTE === 'producao' || document.getElementById('faixa-teste')) return
    var real = AMBIENTE === 'teste-banco-real'
    var d = document.createElement('div')
    d.id = 'faixa-teste'
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;text-align:center;font:700 11.5px/1.2 Arial,sans-serif;padding:4px 8px;pointer-events:none;'
      + (real ? 'background:#d24646;color:#fff' : 'background:#e8b04b;color:#0a1420')
    d.textContent = real ? '⚠️ SITE DE TESTE USANDO O BANCO REAL: o que voce mudar aqui muda para os alunos' : '🧪 AMBIENTE DE TESTE · banco de teste (pode mexer a vontade)'
    document.body.appendChild(d)
  }

  /* ---------------- bugs e sugestoes (turma de teste) ---------------- */
  var fbTipo = 'bug'
  function menuFeedback () {
    if (ehPaginaMentor() || document.getElementById('nav-feedback')) return
    var sair = document.getElementById('nav-sair')
    if (!sair || !sair.parentNode) return
    var it = document.createElement('div')
    it.className = 'nav-i'
    it.id = 'nav-feedback'
    it.innerHTML = '<span class="nav-ic">🐞</span>Bugs e sugestões'
    it.onclick = abrirFeedback
    // no celular o bloco do "Sair" fica escondido: o item vai para a barra de menu principal
    var alvo = sair.parentNode.classList && sair.parentNode.classList.contains('side-b') ? sair.parentNode : sair
    alvo.parentNode.insertBefore(it, alvo)
  }
  function chipFb (t) {
    fbTipo = t
    var cs = document.querySelectorAll('#fb-ov [data-fb]')
    for (var i = 0; i < cs.length; i++) {
      var on = cs[i].getAttribute('data-fb') === t
      cs[i].style.background = on ? 'var(--ouro,#C9A83C)' : 'transparent'
      cs[i].style.color = on ? '#0a1420' : 'var(--tx2,#8fa5bd)'
    }
  }
  function fecharFeedback () { var o = document.getElementById('fb-ov'); if (o) o.remove() }
  function abrirFeedback () {
    fecharFeedback()
    var tipos = [['bug', '🐞 Algo deu erro'], ['melhoria', '💡 Ideia de melhoria'], ['duvida', '❓ Dúvida'], ['elogio', '👏 Elogio']]
    var o = document.createElement('div')
    o.id = 'fb-ov'
    o.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:14px'
    o.onclick = function (e) { if (e.target === o) fecharFeedback() }
    var bt = 'padding:8px 11px;border-radius:20px;border:1px solid var(--bd2,#24384f);font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit'
    o.innerHTML = '<div style="width:100%;max-width:460px;max-height:92vh;overflow:auto;background:var(--bg2,#0c1826);border:1px solid var(--bd2,#24384f);border-radius:16px;padding:18px;color:var(--tx,#e8edf4);font-family:inherit">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div style="font-weight:800;font-size:16px">🐞 Bugs e sugestões</div>'
      + '<button id="fb-x" aria-label="Fechar" style="background:none;border:0;color:var(--tx3,#63809e);font-size:18px;cursor:pointer">✕</button></div>'
      + '<div style="font-size:13px;color:var(--tx2,#8fa5bd);line-height:1.55;margin:6px 0 12px">Achou algo estranho ou tem uma ideia? Conte aqui. O mentor recebe na hora, junto com a página e o aparelho que você está usando.</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'
      + tipos.map(function (t) { return '<button type="button" data-fb="' + t[0] + '" style="' + bt + '">' + t[1] + '</button>' }).join('')
      + '</div>'
      + '<textarea id="fb-txt" rows="5" maxlength="3000" placeholder="Ex.: na aba Questões, ao clicar em Responder, a tela travou." style="width:100%;box-sizing:border-box;padding:11px;border-radius:10px;border:1px solid var(--bd2,#24384f);background:var(--card,#101d2c);color:var(--tx,#e8edf4);font:inherit;font-size:14px;resize:vertical"></textarea>'
      + '<div id="fb-msg" style="font-size:12.5px;min-height:18px;margin:8px 0;color:var(--tx3,#63809e)"></div>'
      + '<button id="fb-env" style="width:100%;padding:12px;border-radius:10px;border:0;background:var(--ouro,#C9A83C);color:#0a1420;font-weight:800;font-size:14px;cursor:pointer">Enviar para o mentor</button>'
      + '</div>'
    document.body.appendChild(o)
    var cs = o.querySelectorAll('[data-fb]')
    for (var i = 0; i < cs.length; i++) cs[i].onclick = function () { chipFb(this.getAttribute('data-fb')) }
    document.getElementById('fb-x').onclick = fecharFeedback
    document.getElementById('fb-env').onclick = enviarFeedback
    chipFb('bug')
    setTimeout(function () { var t = document.getElementById('fb-txt'); if (t) t.focus() }, 50)
  }
  function enviarFeedback () {
    var txt = (document.getElementById('fb-txt').value || '').trim()
    var msg = document.getElementById('fb-msg'), btn = document.getElementById('fb-env')
    if (txt.length < 3) { msg.style.color = '#e8b04b'; msg.textContent = 'Escreva um pouco mais para o mentor entender.'; return }
    if (typeof _supabase === 'undefined') { msg.textContent = 'Sem conexao com o servidor.'; return }
    btn.disabled = true; btn.textContent = 'Enviando...'
    var aparelho = (navigator.userAgent || '').slice(0, 200) + ' | tela ' + (screen.width || 0) + 'x' + (screen.height || 0)
    _supabase.from('feedback_alunos').insert({
      tipo: fbTipo, texto: txt.slice(0, 3000),
      pagina: (pagina + location.search + location.hash).slice(0, 200),
      aparelho: aparelho, versao: VERSAO
    }).then(function (r) {
      if (r && r.error) {
        btn.disabled = false; btn.textContent = 'Enviar para o mentor'
        msg.style.color = '#e06c6c'
        msg.textContent = /does not exist|relation|schema cache/i.test(r.error.message || '') ? 'Canal ainda nao ativado pelo mentor. Avise-o pelo WhatsApp.' : 'Nao foi possivel enviar agora. Tente de novo.'
        return
      }
      var box = document.querySelector('#fb-ov > div')
      if (box) box.innerHTML = '<div style="text-align:center;padding:14px 4px"><div style="font-size:40px">✅</div><div style="font-weight:800;font-size:16px;margin:8px 0">Recebido! Obrigado.</div>'
        + '<div style="font-size:13px;color:var(--tx2,#8fa5bd);line-height:1.55">Cada relato ajuda a deixar a plataforma melhor para toda a turma.</div>'
        + '<button onclick="document.getElementById(\'fb-ov\').remove()" style="margin-top:14px;padding:11px 22px;border-radius:10px;border:0;background:var(--ouro,#C9A83C);color:#0a1420;font-weight:800;cursor:pointer">Fechar</button></div>'
    }, function () { btn.disabled = false; btn.textContent = 'Enviar para o mentor'; msg.textContent = 'Falha de conexao. Tente de novo.' })
  }
  window.abrirFeedback = abrirFeedback

  function senhaVisivel () {
    // botao de "olho" nos campos de senha (login, primeiro acesso, troca de senha)
    if (window.__senhaVisivel || document.querySelector('script[src*="senha-visivel.js"]')) return
    var sc = document.createElement('script'); sc.src = 'senha-visivel.js'; document.head.appendChild(sc)
  }

  function iniciar () {
    senhaVisivel()
    rodape()
    faixaTeste()
    menuFeedback()
    if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('/sw.js').catch(function () {}) } catch (e) {} }
    if (celular && podeMostrar()) setTimeout(aviso, 3500)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})();
