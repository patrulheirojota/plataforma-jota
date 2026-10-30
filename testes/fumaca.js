// =====================================================================
// TESTE DE FUMACA: abre cada pagina num navegador de verdade (com banco FALSO)
// e confere se nenhuma da erro na tela.   node testes/fumaca.js
// Precisa do Playwright:  npm i playwright && npx playwright install chromium
// =====================================================================
const http = require('http'), fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const RAIZ = path.join(__dirname, '..')
const FALSO = fs.readFileSync(path.join(__dirname, 'mock', 'supabase-falso.js'), 'utf8')
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }

const ALUNO = ['cronograma.html', 'questoes.html', 'questoes.html#simulados', 'flashcards.html', 'edital.html', 'lei-seca.html', 'ranking.html', 'cronograma.html#desempenho', 'cronograma.html#perfil']
const MENTOR = ['notificacoes-admin.html', 'admin.html', 'questoes-admin.html', 'questoes-admin.html#estatisticas', 'simulados-admin.html', 'leis-admin.html', 'vendas-admin.html', 'overview.html', 'flashcards-admin.html', 'cronograma.html?aluno=al1']
const PUBLICAS = ['index.html', 'primeiro-acesso.html', 'privacidade.html']

const srv = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (f === '/') f = '/index.html'
  const p = path.join(RAIZ, f)
  if (!p.startsWith(RAIZ) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nao encontrado'); return }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res)
}).listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/'
  const b = await chromium.launch()
  let falhas = 0
  async function abrir (pag, perfil) {
    const ctx = await b.newContext({ viewport: perfil === 'celular' ? { width: 390, height: 844 } : { width: 1280, height: 900 } })
    const pg = await ctx.newPage(), erros = []
    await pg.route('**/*', r => {
      const u = r.request().url()
      if (u.startsWith(base)) { if (/\/config\.js(\?|$)/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: FALSO }); return r.continue() }
      if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' })
      if (/chart\.js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'window.Chart=function(){return {destroy(){}}}' })
      if (/\.js(\?|$)/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' })
      return r.abort()
    })
    pg.on('pageerror', e => erros.push(e.message))
    pg.on('dialog', d => d.dismiss().catch(() => {}))
    const mentor = MENTOR.indexOf(pag) >= 0
    await pg.addInitScript(m => {
      try { localStorage.setItem('app_inst_nunca', '1') } catch (e) {}
      if (m === 'mentor') { window.ADMIN = 1; window.UID = 'adm' } else if (m === 'aluno') window.UID = 'al1'; else window.UID = null
    }, mentor ? 'mentor' : PUBLICAS.indexOf(pag) >= 0 ? 'publico' : 'aluno')
    try { await pg.goto(base + pag, { waitUntil: 'load', timeout: 20000 }); await pg.waitForTimeout(2500) } catch (e) { erros.push('nao abriu: ' + e.message) }
    const vazio = await pg.evaluate(() => document.body && document.body.innerText.trim().length < 20).catch(() => true)
    if (vazio) erros.push('a pagina ficou em branco')
    await ctx.close()
    if (erros.length) { falhas++; console.log('✗ ' + pag + ' (' + perfil + ')\n    ' + erros.slice(0, 3).join('\n    ')) } else console.log('✓ ' + pag + ' (' + perfil + ')')
  }
  for (const p of ALUNO.concat(MENTOR).concat(PUBLICAS)) { await abrir(p, 'computador') }
  for (const p of ['cronograma.html', 'questoes.html', 'lei-seca.html', 'primeiro-acesso.html']) { await abrir(p, 'celular') }
  await b.close(); srv.close()
  console.log('\n' + (falhas ? '❌ ' + falhas + ' pagina(s) com erro' : '✅ Todas as paginas abriram sem erro'))
  process.exit(falhas ? 1 : 0)
})
