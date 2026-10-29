/* =====================================================================
   MENU LATERAL DO MENTOR — o mesmo em todas as paginas do painel
   Basta incluir <script src="menu-admin.js"></script> no fim da pagina.
   ===================================================================== */
(function(){
  // versao no rodape + registro de erros (comum.js) em todas as paginas do painel
  if (!document.querySelector('script[src*="comum.js"]')) {
    const sc = document.createElement('script'); sc.src = 'comum.js'; document.head.appendChild(sc)
  }
  const ITENS = [
    ['Gestao'],
    ['🎯','Central do dia','aba-central'],
    ['👥','Alunos','aba-alunos'],
    ['🏆','Concursos','aba-concursos'],
    ['🔔','Avisos','aba-avisos'],
    ['📝','Evolucao','aba-evolucao'],
    ['Cronograma'],
    ['⚡','Gerador','gerador.html'],
    ['📅','Planos','aba-cronograma'],
    ['🔄','Ajustar ao edital','ajustar.html'],
    ['🎯','Controle de Temas','temas.html'],
    ['Conteudo'],
    ['📄','Importar Prova','importador.html'],
    ['❓','Questoes','questoes-admin.html'],
    ['🧪','Simulados','simulados-admin.html'],
    ['🗂️','Flashcards','flashcards-admin.html'],
    ['📖','Editais','edital-admin.html'],
    ['Acompanhamento'],
    ['🏆','Ranking','ranking.html?admin=1'],
    ['📊','Visao Geral','overview.html'],
    ['📈','Desempenho','aba-desempenho'],
    ['🗓️','Relatorio 21 dias','aba-ciclos'],
    ['📑','Relatorios','relatorio.html'],
    ['Ajustes'],
    ['🎨','Marca','marca.html']
  ]

  function paginaAtual(){
    const p = (location.pathname.split('/').pop() || 'admin.html').toLowerCase()
    return p
  }
  function ir(dest){
    if (dest.indexOf('aba-') === 0) location.href = 'admin.html#' + dest
    else location.href = dest
  }
  function html(ativo){
    const atual = ativo || paginaAtual()
    let h = '<div class="logo"><div class="logo-i">🛡️</div><div class="logo-t">Painel<span>do Mentor</span></div></div>'
    ITENS.forEach(function(it){
      if (it.length === 1) { h += '<div class="side-h">' + it[0] + '</div>'; return }
      const dest = it[2], arq = dest.split('?')[0]
      const on = arq === atual
      h += '<div class="nav-i' + (on ? ' on' : '') + '" onclick="MenuAdmin.ir(\'' + dest + '\')"><span class="nav-ic">' + it[0] + '</span>' + it[1] + '</div>'
    })
    h += '<div class="side-b">'
      + '<div class="nav-i" onclick="MenuAdmin.tema()"><span class="nav-ic" id="madm-tema-ic">🌙</span>Tema</div>'
      + '<div class="nav-i" onclick="MenuAdmin.sair()"><span class="nav-ic">🚪</span>Sair</div></div>'
    return h
  }
  function tema(){
    const c = document.documentElement.getAttribute('data-tema') === 'claro'
    document.documentElement.setAttribute('data-tema', c ? 'escuro' : 'claro')
    try { localStorage.setItem('tema', c ? 'escuro' : 'claro') } catch(e) {}
    const ic = document.getElementById('madm-tema-ic'); if (ic) ic.textContent = c ? '🌙' : '☀️'
  }
  async function sair(){
    try { await _supabase.auth.signOut() } catch(e) {}
    location.href = 'admin.html'
  }
  function abrir(){ const s=document.getElementById('madm-side'), o=document.getElementById('madm-ov'); if(s)s.classList.add('aberta'); if(o)o.classList.add('on') }
  function fechar(){ const s=document.getElementById('madm-side'), o=document.getElementById('madm-ov'); if(s)s.classList.remove('aberta'); if(o)o.classList.remove('on') }

  // paginas com style.css e .container: injeta o menu fixo a esquerda
  function montar(){
    if (document.getElementById('madm-side')) return
    const css = document.createElement('style')
    css.textContent = ''
      + '@media(min-width:861px){body.madm-on{padding-left:228px}body.madm-on .container{max-width:1140px}}'
      + 'body.madm-on .voltar-mob{display:none!important}'
      + '.madm-side .nav-i{white-space:nowrap}'
    document.head.appendChild(css)
    const titulo = (document.title || '').split('—')[0].trim()
    const topo = document.createElement('div')
    topo.className = 'mob-top'
    topo.innerHTML = '<button class="mob-b" onclick="MenuAdmin.abrir()" aria-label="Menu">&#9776;</button>'
      + '<div class="mob-t"><div class="mob-t1">' + titulo.replace(/</g,'&lt;') + '</div><div class="mob-t2">Painel do Mentor</div></div>'
    const ov = document.createElement('div')
    ov.className = 'mob-ov'; ov.id = 'madm-ov'; ov.onclick = fechar
    const side = document.createElement('aside')
    side.className = 'side madm-side'; side.id = 'madm-side'
    side.innerHTML = html()
    document.body.insertBefore(side, document.body.firstChild)
    document.body.insertBefore(ov, document.body.firstChild)
    document.body.insertBefore(topo, document.body.firstChild)
    document.body.classList.add('madm-on')
    const ic = document.getElementById('madm-tema-ic')
    if (ic) ic.textContent = document.documentElement.getAttribute('data-tema') === 'claro' ? '☀️' : '🌙'
  }

  window.MenuAdmin = { html: html, ir: ir, tema: tema, sair: sair, abrir: abrir, fechar: fechar, montar: montar }
  if (!window.MENU_ADMIN_MANUAL) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar)
    else montar()
  }
})();
