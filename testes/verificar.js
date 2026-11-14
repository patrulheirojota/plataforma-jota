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
  'menu-admin.js': 'window.MenuAdmin', 'comum.js': 'VERSAO_PLATAFORMA', 'motor-cronograma.js': 'function montarPlano', 'motor-migracao.js': 'function migMontarProposta', 'motor-banco.js': 'function bancoCobertura', 'senha-visivel.js': '__senhaVisivel', 'banco-dedup.js': 'function triar', 'central.js': 'function carregarCentral',
  'desempenho.js': 'buscarDesempenhoAssuntos', 'relatorio-ciclo.js': 'verificarRelatorioCiclo', 'pomodoro.js': 'pomoAbrir',
  'explicacao.js': 'htmlExplicacao', 'lei-parser.js': 'lerLei', 'simulado-parser.js': 'lerSimulado',
  'leitor-arquivos.js': 'lerArquivoParagrafos', 'caderno-revisao.js': 'renderRevisaoCaderno', 'admin.js': 'function carregarAlunos',
  'api/kiwify.js': 'kiwify_registrar', 'config.js': 'createClient',
  'notificacoes.js': 'ativarNotificacoes', 'api/push.js': 'ehMentor', 'api/_push.js': 'sendNotification', 'api/lembretes.js': 'lembretes_do_dia',
  'sw.js': 'notificationclick', 'estrategia.js': 'window.Estrategia', 'primeiro-acesso.html': 'ativar_acesso', 'vendas-admin.html': 'aprovar_pedido'
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
  // gabarito comentado separado: gabarito rapido + comentario + BIZU
  const { lerGabaritoComentado } = SP
  if (lerGabaritoComentado) {
    let g = lerGabaritoComentado(fx('gab-com-tabela.txt').split('\n'))
    ok(JSON.stringify(g.gab) === '{"1":"C","2":"E","3":"C","4":"E","5":"X"}' && g.nCom === 5 && g.nBizu === 4 && /DATA = dados/.test(g.itens[4].bizu) && !/BIZU/.test(g.itens[4].comentario), 'gabarito comentado: tabela + Item N — CERTO + BIZU', JSON.stringify(g.gab))
    g = lerGabaritoComentado(fx('gab-com-linha.txt').split('\n'))
    ok(g.gab[3] === 'C' && g.conflitos.join() === '3' && g.nBizu === 3 && /O item esta errado|O item está errado/.test(g.itens[1].comentario), 'gabarito comentado: linha "1-E 2-C" + itens com enunciado (avisa divergencia)')
    g = lerGabaritoComentado(fx('gab-com-grade.txt').split('\n'))
    ok(JSON.stringify(g.gab) === '{"1":"B","2":"D","3":"A","4":"E"}' && g.nCom === 4 && g.nBizu === 2 && /Ato administrativo/.test(g.itens[1].bizu), 'gabarito comentado: grade de multipla escolha + Justificativa/BIZU', JSON.stringify(g.gab))
    // formato "caderno de aplicacao" (capa, instrucoes numeradas, folha de respostas) + "cartao por cartao"
    const cc = lerSimulado(fx('caderno-cartoes.txt').split('\n'))
    ok(cc.itens.length === 6 && cc.itens[0].numero === 1 && cc.itens[5].numero === 6 && cc.itens.every(q => q.tipo === 'certo_errado' && q.enunciado.length > 30 && !/\(\s*\)/.test(q.enunciado)), 'caderno: ignora instrucoes "1. Este caderno", tabela "01 a 03", folha de respostas e tira o "( ) C ( ) E"', cc.itens.map(q => q.numero).join(','))
    ok(cc.itens[0].disciplina === 'Língua Portuguesa' && cc.itens[3].disciplina === 'Legislação PMAL' && /TT1A1/.test(cc.itens[0].texto_apoio || '') && !cc.itens.some(q => q.gabarito), 'caderno: disciplinas (com sigla PMAL), texto de apoio e folha de respostas vazia nao vira gabarito')
    g = lerGabaritoComentado(fx('gabarito-cartoes.txt').split('\n'))
    ok(JSON.stringify(g.gab) === '{"1":"E","2":"C","3":"C","4":"C","5":"E","6":"E"}' && g.nCom === 6 && g.nBizu === 6 && !g.conflitos.length, 'gabarito cartao por cartao: gabarito rapido + GABARITO: no cabecalho', JSON.stringify(g.gab))
    ok(/^O texto afirma/.test(g.itens[1].comentario) && /\n\n🎯 Mecanismo da banca: Antecipar/.test(g.itens[1].comentario) && !/INCID|TÓPICO|Enunciado repetido/.test(g.itens[1].comentario) && /começa antes/.test(g.itens[1].bizu) && !/CICLOS|ESPELHO|PLANO/.test(g.itens[6].bizu + g.itens[6].comentario), 'gabarito cartao por cartao: ANALISE + MECANISMO no comentario, BIZU limpo, sem ficha/ciclos/espelho')
    ok(g.itens[1].disciplina === 'Língua Portuguesa' && g.itens[1].assunto === 'Compreensão e interpretação' && g.itens[6].assunto === 'Vedações', 'gabarito cartao por cartao: disciplina e assunto (topico do edital)', g.itens[1].assunto)
    // caderno em PDF (PMPE): instrucoes numeradas, "INCORRETA."/"EXCETO" em linha propria, tabela "A B C D", "QUESTOES 01 A 02"
    const PE = ['LÍNGUA PORTUGUESA', 'HISTÓRIA DE PERNAMBUCO', 'RACIOCÍNIO LÓGICO', 'INFORMÁTICA', 'DIREITO CONSTITUCIONAL', 'DIREITOS HUMANOS E LEGISLAÇÃO EXTRAVAGANTE']
    ;[PE, null].forEach(lista => {
      const pe = lerSimulado(fx('caderno-pmpe-pdf.txt').split('\n'), { disciplinas: lista })
      const ds = pe.itens.map(q => q.disciplina)
      ok(pe.itens.length === 6 && pe.itens.every(q => q.tipo === 'multipla' && q.alternativas.length === 5) && pe.itens.map(q => q.numero).join() === '1,2,3,4,5,6', 'caderno PDF: instrucoes numeradas e tabela nao viram questao (' + (lista ? 'com' : 'sem') + ' edital)', pe.itens.map(q => q.numero + ':' + q.tipo).join(' '))
      ok(ds.join('|') === 'Língua Portuguesa|Língua Portuguesa|Informática|Informática|Direitos Humanos e Legislação Extravagante|Direitos Humanos e Legislação Extravagante', 'caderno PDF: "INCORRETA.", "EXCETO", "A B C D" e "COLUNA 1" nao viram disciplina (' + (lista ? 'com' : 'sem') + ' edital)', ds.join('|'))
      ok(/INCORRETA/.test(pe.itens[0].enunciado) && /EXCETO/.test(pe.itens[3].enunciado) && !/QUESTÕES 0/.test(pe.itens.map(q => q.texto_apoio || '').join()), 'caderno PDF: "INCORRETA." e "EXCETO" ficam no enunciado; faixa "QUESTOES 01 A 02" nao vai para o texto de apoio')
    })
    const AL = ['LÍNGUA PORTUGUESA', 'MATEMÁTICA', 'NOÇÕES DE INFORMÁTICA', 'LEGISLAÇÃO PERTINENTE AO POLICIAL MILITAR DE ALAGOAS', 'NOÇÕES DE DIREITO ADMINISTRATIVO', 'NOÇÕES DE DIREITO PROCESSUAL PENAL', 'NOÇÕES DE DIREITO PROCESSUAL PENAL MILITAR', 'NOÇÕES DE DIREITOS HUMANOS']
    const al = lerSimulado(fx('caderno-pmal-ce.txt').split('\n'), { disciplinas: AL })
    ok(al.itens.length === 4 && al.itens.map(q => q.disciplina).join('|') === 'Língua Portuguesa|Língua Portuguesa|Noções de Direito Processual Penal Militar|Noções de Direito Processual Penal Militar' && al.itens.every(q => q.tipo === 'certo_errado' && !/Certo|PARTE/.test(q.enunciado + (q.texto_apoio || ''))), 'caderno CE: "PARTE 1", "(ITENS 1 A 2)" e "( ) Certo ( ) Errado" nao viram disciplina; nome do edital', al.itens.map(q => q.disciplina).join('|'))
    const { casarDisciplina } = SP
    ok(['Direito Administrativo (itens 61 a 70)', 'Legislação PMAL', 'Noções de Dir. Proc. Penal Militar (q113–q120)', 'Direitos Humanos', 'Direito Processual Penal'].map(x => casarDisciplina(x, AL)).join('|') === 'Noções de Direito Administrativo|Legislação Pertinente ao Policial Militar de Alagoas|Noções de Direito Processual Penal Militar|Noções de Direitos Humanos|Noções de Direito Processual Penal' && ['Incorreta.', 'A B C D', 'Parte 1 – Conhecimentos Básicos', 'Instruções Gerais'].every(x => !casarDisciplina(x, AL)), 'disciplina: variacoes casam com o edital; lixo nao casa')
  } else ok(false, 'simulado-parser.js sem o leitor de gabarito comentado')
}
// triagem de duplicadas na importacao do banco
const BD = existe('banco-dedup.js') && carregar('banco-dedup.js')
if (BD) {
  const ind = { porChave: {}, porId: {}, total: 0 }
  const base = [
    { id: 'b1', enunciado: 'A legítima defesa exige agressão injusta, atual ou iminente.', gabarito: 'C', comentario: null, bizu: null },
    { id: 'b2', enunciado: 'Assinale a correta.', texto_apoio: 'Texto CG1A1 sobre patrulhamento', alternativas: ['a', 'b'], gabarito: 'A', comentario: 'x', bizu: 'y', assunto: 'z' },
    { id: 'b3', enunciado: 'Item com gabarito C no banco e muito texto para passar de sessenta letras.', gabarito: 'C' }
  ]
  base.forEach(q => { const x = { id: q.id, gabarito: q.gabarito, comentario: !!q.comentario, bizu: !!q.bizu, assunto: !!q.assunto, concursos: q.id === 'b2' ? { c1: 1 } : {} }; ind.porId[q.id] = x; ind.porChave[BD.chave(q)] = x; ind.total++ })
  const lote = [
    { enunciado: 'A LEGITIMA DEFESA exige agressao injusta, atual ou iminente', gabarito: 'C', comentario: 'novo coment', bizu: 'novo bizu' },
    { enunciado: 'Assinale a correta.', texto_apoio: 'Texto CG1A1 sobre patrulhamento', alternativas: ['a', 'b'], gabarito: 'A' },
    { enunciado: 'Assinale a correta.', texto_apoio: 'Outro texto completamente diferente', alternativas: ['a', 'b'], gabarito: 'B' },
    { enunciado: 'Questao nova de verdade sobre o Estatuto dos Militares de Alagoas.', gabarito: 'E' },
    { enunciado: 'Questao nova de verdade sobre o Estatuto dos Militares de Alagoas.', gabarito: 'E', bizu: 'bizu da repetida' },
    { enunciado: 'Item com gabarito C no banco e muito texto para passar de sessenta letras.', gabarito: 'E', comentario: 'diz E' }
  ]
  const t = BD.triar(lote, ind, 'c1'), r = BD.resumo(t)
  ok(t[0].acao === 'existe' && t[0].id === 'b1' && t[0].vincular && t[0].completar.comentario === 'novo coment', 'triagem: mesma questao com acento/maiuscula diferente e reconhecida, ganha vinculo e comentario')
  ok(t[1].acao === 'existe' && !t[1].vincular && !t[1].completar, 'triagem: ja vinculada e completa nao muda nada')
  ok(t[2].acao === 'nova', 'triagem: enunciado curto igual com texto de apoio diferente e outra questao')
  ok(t[3].acao === 'nova' && t[4].acao === 'repetida' && t[3].q.bizu === 'bizu da repetida', 'triagem: repetida dentro do lote entra uma vez so (aproveitando o bizu)')
  ok(t[5].conflito && !t[5].completar && t[5].gabBanco === 'C', 'triagem: gabarito diferente vira conflito e nao mexe na questao')
  ok(r.novas === 2 && r.existe === 3 && r.repetidas === 1 && r.vincular === 2 && r.conflitos === 1, 'triagem: resumo', JSON.stringify(r))
  BD.registrarNovas(ind, [lote[3]], ['n1'], 'c1')
  ok(BD.triar([lote[3]], ind, 'c1')[0].acao === 'existe', 'triagem: questao recem-importada nao duplica na importacao seguinte')
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
