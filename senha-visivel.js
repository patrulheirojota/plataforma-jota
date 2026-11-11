/* =====================================================================
   MOSTRAR / ESCONDER SENHA
   Coloca um botao de "olho" dentro de todo campo de senha da pagina,
   inclusive os que aparecem depois (telas montadas por JavaScript).
   Basta incluir <script src="senha-visivel.js"></script> (o comum.js ja inclui).
   ===================================================================== */
(function () {
  if (window.__senhaVisivel) return
  window.__senhaVisivel = true

  var OLHO = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
  var FECHADO = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"></path><path d="M1 1l22 22"></path></svg>'

  function preparar (inp) {
    if (!inp || inp.getAttribute('data-olho') || !inp.parentNode) return
    inp.setAttribute('data-olho', '1')
    var cs = window.getComputedStyle(inp)
    var caixa = document.createElement('span')
    caixa.className = 'senha-caixa'
    caixa.style.cssText = 'position:relative;display:block;width:' + (cs.width && cs.display !== 'inline' && inp.style.width ? inp.style.width : '100%') +
      ';margin-top:' + cs.marginTop + ';margin-bottom:' + cs.marginBottom
    inp.parentNode.insertBefore(caixa, inp)
    caixa.appendChild(inp)
    inp.style.marginTop = '0'
    inp.style.marginBottom = '0'
    inp.style.width = '100%'
    inp.style.boxSizing = 'border-box'
    inp.style.paddingRight = '48px'

    var bt = document.createElement('button')
    bt.type = 'button'
    bt.className = 'senha-olho'
    bt.setAttribute('aria-label', 'Mostrar senha')
    bt.setAttribute('title', 'Mostrar senha')
    bt.innerHTML = OLHO
    bt.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);width:42px;height:42px;min-height:0;margin:0;padding:0;' +
      'display:flex;align-items:center;justify-content:center;background:transparent;border:0;box-shadow:none;cursor:pointer;color:inherit;opacity:.65'
    bt.addEventListener('click', function (e) {
      e.preventDefault()
      var ver = inp.type === 'password'
      inp.type = ver ? 'text' : 'password'
      bt.innerHTML = ver ? FECHADO : OLHO
      bt.setAttribute('aria-label', ver ? 'Esconder senha' : 'Mostrar senha')
      bt.setAttribute('title', ver ? 'Esconder senha' : 'Mostrar senha')
      bt.style.opacity = ver ? '1' : '.65'
      try { inp.focus({ preventScroll: true }); var n = inp.value.length; inp.setSelectionRange(n, n) } catch (er) {}
    })
    caixa.appendChild(bt)
  }

  function varrer (raiz) {
    var lista = (raiz || document).querySelectorAll ? (raiz || document).querySelectorAll('input[type="password"]:not([data-olho])') : []
    for (var i = 0; i < lista.length; i++) preparar(lista[i])
  }

  function iniciar () {
    varrer(document)
    if (window.MutationObserver) {
      new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes && ms[i].addedNodes.length) { varrer(document); break }
      }).observe(document.body, { childList: true, subtree: true })
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})()
