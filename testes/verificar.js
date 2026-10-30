// =====================================================================
// TESTES AUTOMATICOS (rodam sozinhos no GitHub a cada envio de arquivo)
//   node testes/verificar.js
// Confere:
//   1. se todo arquivo .js e todo <script> das paginas esta escrito sem erro
//   2. se todo arquivo que uma pagina carrega existe (ex.: pomodoro.js)
//   3. se arquivos importantes nao foram trocados (ex.: menu-admin.js com o conteudo do comum.js)
//   4. se os menus do aluno tem os mesmos itens em todas as paginas
//   5. se os leitores de simulado e de lei continuam entendendo os formatos
//   6. se a funcao da Kiwify recusa senha errada e repassa a venda
// =====================================================================
const fs = require('fs'), path = require('path'), vm = require('vm')
const RAIZ = path.join(__dirname, '..')
let falhas = 0, oks = 0
function ok (cond, nome, detalhe) {
  if (cond) { oks++; return true }
  falhas++; console.log('✗ ' + nome + (detalhe ? '\n    ' + detalhe : '')); return false
}
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8')
const existe = f => fs.existsSync(path.join(RAIZ, f))
const htmls = fs.readdirSync(RAIZ).filter(f => f.endsWith('.html'))
const jss = fs.readdirSync(RAIZ).filter(f => f.endsWith('.js')).concat(existe('api') ? fs.readdirSync(path.join(RAIZ, 'api')).filter(f => f.endsWith('.js')).map(f => 'api/' + f) : [])

// 1) sintaxe
jss.forEach(f => {
  try { new vm.Script(ler(f), { filename: f }) ; oks++ } catch (e) { ok(false, 'erro de escrita em ' + f, e.message) }
})
htmls.forEach(f => {
  const s = ler(f)
  const blocos = [...s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1])
  blocos.forEach((b, i) => {
    try { new vm.Script(b, { filename: f + ' (script ' + (i + 1) + ')' }); oks++ } catch (e) { ok(false, 'erro de escrita em ' + f + ' (bloco ' + (i + 1) + ')', e.message) }
  })
  // 2) arquivos carregados pela pagina
  ;[...s.matchAll(/<script[^>]*\bsrc="([^"]+)"/gi)].map(m => m[1]).filter(u => !/^https?:|^\/\//.test(u)).forEach(u => {
    ok(existe(u.replace(/^\//, '').split('?')[0]), f + ' carrega "' + u + '", mas o arquivo nao existe no projeto')
  })
  ;[...s.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/gi)].map(m => m[1]).filter(u => !/^https?:/.test(u)).forEach(u => {
    ok(existe(u.replace(/^\//, '')), f + ' usa o estilo "' + u + '", mas o arquivo nao existe')
  })
})

// 3) arquivos que nao podem ser trocados por engano
const assinaturas = {
  'menu-admin.js': 'window.MenuAdmin', 'comum.js': 'VERSAO_PLATAFORMA', 'central.js': 'function carregarCentral',
  'desempenho.js': 'buscarDesempenhoAssuntos', 'relatorio-ciclo.js': 'verificarRelatorioCiclo', 'pomodoro.js': 'pomoAbrir',
  'explicacao.js': 'htmlExplicacao', 'lei-parser.js': 'lerLei', 'simulado-parser.js': 'lerSimulado',
  'leitor-arquivos.js': 'lerArquivoParagrafos', 'caderno-revisao.js': 'renderRevisaoCaderno', 'admin.js': 'function carregarAlunos',
  'api/kiwify.js': 'kiwify_registrar', 'config.js': 'createClient',
  'notificacoes.js': 'ativarNotificacoes', 'api/push.js': 'ehMentor', 'api/_push.js': 'sendNotification', 'api/lembretes.js': 'lembretes_do_dia',
  'sw.js': 'notificationclick', 'primeiro-acesso.html': 'ativar_acesso', 'vendas-admin.html': 'aprovar_pedido'
}
Object.keys(assinaturas).forEach(f => {
  if (!existe(f)) { ok(false, 'arquivo obrigatorio faltando: ' + f); return }
  ok(ler(f).indexOf(assinaturas[f]) >= 0, f + ' nao parece ser o arquivo certo (conteudo trocado?)', 'deveria conter: ' + assinaturas[f])
})
// chave secreta nunca pode ir para o GitHub
jss.concat(htmls).forEach(f => {
  const s = ler(f)
  ok(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(s) && !/service_role["']?\s*[:=]\s*["']eyJ/.test(s), 'ATENCAO: ' + f + ' tem uma chave secreta do Supabase! Apague e troque a chave no Supabase.')
})

// dependencias do servidor e agendamento do lembrete
try { ok(!!JSON.parse(ler('package.json')).dependencies['web-push'], 'package.json precisa ter a dependencia web-push') } catch (e) { ok(false, 'package.json ausente ou com erro', e.message) }
try { ok(JSON.parse(ler('vercel.json')).crons.some(c => c.path === '/api/lembretes'), 'vercel.json precisa agendar /api/lembretes') } catch (e) { ok(false, 'vercel.json ausente ou com erro', e.message) }

// 4) menu do aluno igual em todas as paginas
const paginasAluno = ['cronograma.html', 'questoes.html', 'edital.html', 'flashcards.html'].filter(existe)
const destinos = ['questoes.html', 'flashcards.html', 'lei-seca.html', 'ranking.html', 'edital']
paginasAluno.forEach(p => {
  const s = ler(p)
  destinos.forEach(d => { if (p.indexOf(d) === 0) return; ok(s.indexOf(d) >= 0, 'o menu de ' + p + ' nao tem o item "' + d + '"') })
})
// paginas novas do mentor precisam do menu lateral
;['questoes-admin.html', 'simulados-admin.html', 'leis-admin.html', 'vendas-admin.html', 'notificacoes-admin.html', 'flashcards-admin.html'].filter(existe).forEach(p => {
  ok(ler(p).indexOf('menu-admin.js') >= 0, p + ' esta sem o menu lateral do mentor (menu-admin.js)')
})

// 5) leitores de simulado e de lei
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8')
function carregar (f) { try { return require(path.join(RAIZ, f)) } catch (e) { ok(false, 'nao consegui carregar ' + f, e.message); return null } }
const SP = existe('simulado-parser.js') && carregar('simulado-parser.js')
if (SP) {
  const { lerSimulado, lerParesGabarito } = SP
  let r = lerSimulado(fx('caderno-cebraspe.txt').split('\n'))
  ok(r.itens.length === 7 && r.itens.map(q => q.gabarito).join('') === 'ECCECCE', 'leitor: caderno CEBRASPE', JSON.stringify(r.itens.map(q => q.gabarito)))
  ok(/Texto CG1A1/.test(r.itens[0].texto_apoio || '') && r.itens[5].disciplina === 'Direito Penal', 'leitor: texto de apoio e disciplina do caderno')
  r = lerSimulado(fx('caderno-idecan.txt').split('\n'))
  ok(r.itens.length === 3 && r.itens.every(q => q.tipo === 'multipla') && r.itens.map(q => q.gabarito).join('') === 'CBB', 'leitor: caderno IDECAN (A a E)', JSON.stringify(r.itens.map(q => q.gabarito)))
  r = lerSimulado(fx('gabarito-comentado.txt').split('\n'))
  ok(r.itens.length === 4 && r.itens[3].anulada && r.itens[0].gabarito === 'C' && r.itens[1].gabarito === 'E', 'leitor: gabarito comentado separado com anulada')
  r = lerSimulado(fx('banco-comentado.txt').split('\n'))
  ok(r.modo === 'comentado' && r.itens.length === 3 && r.itens.map(q => q.gabarito).join('') === 'ECE' && !!r.itens[0].comentario, 'leitor: banco comentado (gabarito e comentario dentro da questao)')
  ok(JSON.stringify(lerParesGabarito('1 2 3 4\nC E C X')) === '{"1":"C","2":"E","3":"C","4":"X"}', 'leitor: gabarito em tabela')
}
const LP = existe('lei-parser.js') && carregar('lei-parser.js')
if (LP) {
  const { lerLei } = LP
  const r = lerLei(fx('lei-tortura.txt'))
  ok(r.artigos.length === 6, 'lei seca: numero de artigos', 'achou ' + r.artigos.length)
  ok(r.artigos.some(a => a.chave === '5-A') && r.artigos.find(a => a.chave === '3').revogado && !r.artigos.find(a => a.chave === '4').revogado, 'lei seca: artigo 5-A, vetado e "revoga-se"')
}

// 6) funcao da Kiwify
;(async () => {
  const h = existe('api/kiwify.js') && carregar('api/kiwify.js')
  if (h) {
    process.env.KIWIFY_SEGREDO = 'teste123'; process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_teste'
    let chamou = null
    global.fetch = async (u, o) => { chamou = { u, o }; return { ok: true, text: async () => '"liberado ate 01/01/2030"' } }
    const resp = () => { const o = { c: 0, b: null, status (c) { o.c = c; return o }, json (b) { o.b = b; return o } }; return o }
    let r = resp(); await h({ method: 'POST', query: { segredo: 'errado' }, body: {} }, r)
    ok(r.c === 401 && !chamou, 'kiwify: recusa senha errada')
    r = resp(); await h({ method: 'POST', query: { segredo: 'teste123' }, body: { order_status: 'paid', Customer: { email: 'a@b.com' } } }, r)
    ok(r.c === 200 && chamou && /kiwify_registrar/.test(chamou.u) && JSON.parse(chamou.o.body).p.Customer.email === 'a@b.com', 'kiwify: repassa a venda para o banco')
  }
  console.log('\n' + (falhas ? '❌ ' + falhas + ' problema(s) encontrado(s)' : '✅ Tudo certo') + ' · ' + oks + ' verificacoes ok')
  process.exit(falhas ? 1 : 0)
})()
