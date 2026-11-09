/* =====================================================================
   LEITOR DE SIMULADO (Word / PDF / texto colado)
   Recebe os paragrafos do arquivo e devolve as questoes encontradas.
   Entende:
   - itens numerados "1." "1)" "1 -" "Questao 1" "Item 1"
   - cabecalho "1. Disciplina - Assunto - Subtema" (padrao do banco comentado)
   - alternativas "A)" "(A)" "a)" "A."  -> multipla escolha; sem alternativas -> certo/errado
   - "Gabarito: Certo/Errado/C/E/A..E" e "Comentario" dentro da questao
   - secao final "GABARITO" com pares "1 C 2 E" / "1-C" / tabela
   - texto de apoio compartilhado ("Texto CG1A1...", "Julgue os itens...") antes de um bloco de itens
   - titulos de disciplina em MAIUSCULAS ("LINGUA PORTUGUESA")
   Funciona no navegador e no Node (para testes).
   ===================================================================== */
(function (raiz) {
  var RX_NUM = /^\s*(?:quest[aã]o|item)?\s*(\d{1,3})\s*(?:[.)\-–—:]\s*|\s{2,}|\s(?=["“(«A-ZÁÉÍÓÚÂÊÔÃÕÇ]))(.*)$/i
  var RX_NUM_SO = /^\s*(?:quest[aã]o|item)?\s*(\d{1,3})\s*[.)\-–—:]?\s*$/i
  var RX_ALT = /^\s*\(?\s*([A-Ea-e])\s*[).\-–]\s*(.+)$/
  var RX_CE = /^\s*(?:\(\s*\)\s*)?(certo|errado)\s*$/i
  var RX_CE2 = /^\s*c\s*\(?\s*\)?\s*e\s*\(?\s*\)?\s*$/i
  var RX_GAB = /^\s*gabarito\s*(?:oficial|preliminar|definitivo)?\s*[:\-–]\s*(certo|errado|[A-Ea-e])\b[.)]?\s*(.*)$/i
  var RX_COM = /^\s*coment[aá]rios?\s*(?:do\s+professor|do\s+jota)?\s*[:\-–]?\s*(.*)$/i
  var RX_SEC_GAB = /^\s*(?:gabarito|gabaritos|folha\s+de\s+respostas|respostas)(?:\s+(?:oficial|preliminar|definitivo|comentado))?\s*(?:\(.*\))?\s*[:.]?\s*$/i
  var RX_TEMA = /^\s*tema\s*\d*\s*[-–:]\s*(.+?)\s*(?:\(.*\))?\s*$/i
  var RX_APOIO = /^\s*(texto\s|texto$|textos\s|com base n|julgue|considere|acerca d|a respeito d|no que se refere|no que concerne|em rela[cç][aã]o|tendo como refer|tendo em vista|leia |levando em conta|considerando|a partir d|quanto a|quanto ao|com rela[cç][aã]o)/i
  var LETRAS = 'ABCDE'
  // "BIZU: ...", "💡 Bizu do Jota:", "**BIZU**"
  var RX_BIZU = /^\s*(?:[^\wÀ-ÿ\s]{1,3}\s*)?\**\s*bizu(?:\s+do\s+jota)?\s*\**\s*[:\-–—]?\s*(.*)$/i
  var RX_ROT_COM = /^\s*(?:coment[aá]rios?(?:\s+do\s+(?:professor|jota))?|justificativa|fundamenta[cç][aã]o|resolu[cç][aã]o|explica[cç][aã]o|an[aá]lise)\s*[:\-–—]?\s*(.*)$/i
  // "GABARITO: ERRADO" em qualquer ponto da linha (cabecalho do cartao)
  var RX_GAB_ANY = /gabarito\s*(?:oficial|preliminar|definitivo)?\s*[:\-–—]\s*(certo|errado|anulad[ao]|[A-E])(?![A-Za-zÀ-ÿ])/i
  var RX_GAB_ANY_G = /gabarito\s*(?:oficial|preliminar|definitivo)?\s*[:\-–—]\s*(certo|errado|anulad[ao]|[A-E])(?![A-Za-zÀ-ÿ]).*$/i
  var RX_TOPICO = /^\s*t[óo]pico(?:\s+do\s+edital)?\s*[:\-–—]\s*(.+)$/i
  var RX_FICHA = /^\s*(?:t[óo]pico(?:\s+do\s+edital)?|incid[êe]ncia|dificuldade|formato|fundamento|ciclos)\s*[:\-–—]/i
  // fim do cartao: linha de revisao "CICLOS: R1 ( ) R2 ( )..."
  // titulo de secao: so letras maiusculas ("DIREITO ADMINISTRATIVO", "ESPELHO DA REDACAO — CRITERIOS")
  var RX_TIT_SECAO = /^[\sA-ZÀ-ÖØ-Þ\-–—•/]+$/
  var RX_FIM_BLOCO = /^\s*(?:ciclos\s*[:\-–—]|r1\s*\(\s*\))/i
  var RX_SEC_COM = /^\s*(?:gabarito\s+comentado|gabaritos\s+comentados|coment[aá]rios?\s+(?:das|dos|aos)\s+(?:quest[oõ]es|itens)|quest[oõ]es\s+comentadas|itens\s+comentados|resolu[cç][aã]o\s+comentada|corre[cç][aã]o\s+comentada)\b.{0,60}$/i
  var RX_ITEM_C = /^\s*(?:quest[aã]o|item|cart[aã]o|n[º°o]\.?)?\s*0*(\d{1,3})\s*(?:[.)\-–—:º°]+\s*|\s+|$)(.*)$/i
  var RX_GAB_TXT = /^\s*(?:gabarito|resposta|alternativa\s+correta)\s*(?:oficial|preliminar|definitivo|correto|correta)?\s*[:\-–—]?\s*(certo|errado|anulad[ao]|[A-E])(?![A-Za-zÀ-ÿ])\s*[.\-–—:)]*\s*(.*)$/i
  var RX_GAB_INI = /^\s*[\-–—:]*\s*[(\[]?\s*(CERTO|ERRADO|ANULAD[AO]|Certo|Errado|Anulad[ao]|certo|errado|anulad[ao]|[A-E])\s*[)\]]?(?![A-Za-zÀ-ÿ])\s*[.\-–—:)]*\s*(.*)$/
  var RX_LINHA_PARES = /^[\s\d.\-–—:|()\[\]]*(?:(?:certo|errado|anulad[ao]|[A-Ea-eXx])(?![A-Za-zÀ-ÿ])[\s\d.\-–—:|()\[\]]*)*$/i

  // separa o BIZU do resto do comentario
  function separarBizu (texto) {
    if (!texto) return { com: texto || null, bizu: null }
    var ls = String(texto).split('\n'), ib = -1
    for (var i = 0; i < ls.length; i++) { if (RX_BIZU.test(ls[i])) { ib = i; break } }
    if (ib < 0) return { com: texto, bizu: null }
    var m = ls[ib].match(RX_BIZU)
    var bz = [m[1]].concat(ls.slice(ib + 1)).join('\n').trim()
    var com = ls.slice(0, ib).join('\n').trim()
    return { com: com || null, bizu: bz || null }
  }

  // Escolhe a sequencia PRINCIPAL de itens do documento (1, 2, 3... ate o fim), ignorando outras
  // numeracoes (instrucoes "1. Este caderno...", tabela "01 a 20", folha de respostas, linhas da redacao).
  // cands: [{ i: posicao, n: numero, w: peso }] em ordem de posicao. Devolve o conjunto de posicoes escolhidas.
  function escolherCadeia (cands) {
    var best = [], prev = []
    for (var a = 0; a < cands.length; a++) {
      best[a] = cands[a].n <= 3 ? cands[a].w : -1e9; prev[a] = -1
      for (var b = 0; b < a; b++) {
        var d = cands[a].n - cands[b].n
        if (d >= 1 && d <= 4 && best[b] > -1e8 && best[b] + cands[a].w - (d - 1) * 0.5 > best[a]) { best[a] = best[b] + cands[a].w - (d - 1) * 0.5; prev[a] = b }
      }
    }
    var top = -1
    for (var c = 0; c < cands.length; c++) if (best[c] > -1e8 && (top < 0 || best[c] > best[top])) top = c
    var set = {}
    while (top >= 0) { set[cands[top].i] = true; top = prev[top] }
    return set
  }
  // "(   ) C      (   ) E" no fim do item (folha do caderno)
  var RX_MARCAS_CE = /\s*\(\s*\)\s*C\s*\(\s*\)\s*E\s*$/i
  var SIGLAS = ['PM', 'PMAL', 'PMSE', 'PMBA', 'PMPE', 'PMPB', 'PMCE', 'PMESP', 'GCM', 'CF', 'ECA', 'CTB', 'CP', 'CPP', 'CPM', 'CPPM', 'LEP', 'STF', 'STJ', 'TI', 'SUS', 'DF', 'ONU', 'OEA', 'CEBRASPE', 'IDECAN']

  function limpa (s) { return String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim() }
  function maiusculo (s) {
    var l = s.replace(/[^A-Za-zÀ-ÿ]/g, '')
    return l.length >= 4 && l === l.toUpperCase() && s.length <= 90
  }
  function titulo (s) {
    var peq = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no', 'para', 'com']
    return s.toLowerCase().split(' ').map(function (w, i) {
      if (SIGLAS.indexOf(w.toUpperCase()) >= 0) return w.toUpperCase()
      return (i && peq.indexOf(w) >= 0) ? w : w.charAt(0).toUpperCase() + w.slice(1)
    }).join(' ')
  }
  function gabNorm (g) {
    g = limpa(g).toUpperCase()
    if (g === 'CERTO' || g === 'C') return 'C'
    if (g === 'ERRADO' || g === 'E') return g === 'ERRADO' ? 'E' : 'E'
    return g.charAt(0)
  }

  // pares "1 C 2 E" / "1-C" / "01. Certo" / tabela (linha de numeros e linha de respostas)
  function lerParesGabarito (txt) {
    var out = {}, tk = [], m
    var rx = /(\d{1,3})|(?:^|[^A-Za-zÀ-ÿ])(certo|errado|anulad[ao]|[A-Ea-eXx])(?![A-Za-zÀ-ÿ])/gi
    while ((m = rx.exec(txt))) {
      if (m[1]) tk.push({ n: parseInt(m[1], 10) })
      else {
        var g = m[2].toUpperCase()
        tk.push({ g: /^ANULAD/.test(g) || g === 'X' ? 'X' : g === 'CERTO' ? 'C' : g === 'ERRADO' ? 'E' : g })
      }
    }
    var i = 0
    while (i < tk.length) {
      if (tk[i].n == null) { i++; continue }
      var nums = []; while (i < tk.length && tk[i].n != null) { nums.push(tk[i].n); i++ }
      var res = []; while (i < tk.length && tk[i].g != null) { res.push(tk[i].g); i++ }
      if (!res.length) continue
      if (nums.length > 1 && res.length === nums.length) nums.forEach(function (n, k) { out[n] = res[k] })
      else out[nums[nums.length - 1]] = res[0]
    }
    return out
  }

  function lerSimulado (paragrafos) {
    var ps = paragrafos.map(limpa).filter(function (x) { return x })
    var avisos = []
    // 1) separa a secao de gabarito do final (se houver)
    var iGab = -1
    for (var i = Math.floor(ps.length * 0.3); i < ps.length; i++) { if (RX_SEC_GAB.test(ps[i])) { iGab = i; break } }
    var corpo = iGab >= 0 ? ps.slice(0, iGab) : ps
    var secGab = iGab >= 0 ? ps.slice(iGab + 1) : []
    var gabComentado = {}, gabPares = {}
    if (secGab.length) {
      // gabarito comentado (blocos numerados com texto) ou so pares
      var blocos = {}, atual = null
      secGab.forEach(function (p) {
        var m = p.match(RX_NUM)
        if (m && p.length > 12 && /[a-zà-ú]{3}/.test(m[2] || '')) { atual = parseInt(m[1], 10); blocos[atual] = [m[2]] } else if (atual != null && !RX_SEC_GAB.test(p)) blocos[atual].push(p)
      })
      var nb = Object.keys(blocos).length
      if (nb >= 3) {
        Object.keys(blocos).forEach(function (n) {
          var t = blocos[n].join('\n'), g = t.match(/(?:gabarito\s*[:\-–]?\s*|^)(certo|errado|anulad[ao]|[A-E])(?![A-Za-zÀ-ÿ])/i)
          gabComentado[n] = { gab: g ? (/^anulad/i.test(g[1]) ? 'X' : gabNorm(g[1])) : null, com: t.replace(/^\s*(?:gabarito\s*[:\-–]?\s*)?(certo|errado|[A-E])(?![A-Za-zÀ-ÿ])\s*[.\-–:]*\s*/i, '').trim() }
        })
      } else {
        // so linhas que parecem gabarito (numeros e letras); folha de respostas em branco nao conta
        gabPares = lerParesGabarito(secGab.filter(function (p) { return RX_LINHA_PARES.test(p) }).join(' '))
      }
    }

    // 2) questoes
    var itens = [], cur = null, pend = [], ativo = [], faixa = null, disc = '', assunto = ''
    function fecha () {
      if (!cur) return
      var linhas = cur.linhas.slice()
      var enun = linhas.length ? linhas.pop() : ''
      var tipo = cur.alts.length >= 2 ? 'multipla' : 'certo_errado'
      if (tipo === 'multipla' && linhas.length && enun.length < 40) { enun = linhas.pop() + '\n' + enun }
      itens.push({
        numero: cur.numero, disciplina: cur.disc || disc || '', assunto: cur.ass || assunto || '',
        tipo: tipo, enunciado: enun, alternativas: tipo === 'multipla' ? cur.alts.slice() : null,
        apoioLocal: linhas,
        // texto compartilhado: no certo/errado vale para o bloco; na multipla so para a proxima (ou para a faixa "questoes X a Y")
        apoioAtivo: (cur.faixa ? (cur.numero >= cur.faixa[0] && cur.numero <= cur.faixa[1]) : (tipo === 'certo_errado' || cur.novoAtivo)) ? cur.ativo.slice() : [],
        gabarito: cur.gab || null, comentario: cur.com.length ? cur.com.join('\n').trim() : null
      })
      var sb = separarBizu(itens[itens.length - 1].comentario)
      itens[itens.length - 1].comentario = sb.com; itens[itens.length - 1].bizu = sb.bizu
      cur = null
    }
    // sequencia principal de itens (ignora instrucoes numeradas, tabelas e folha de respostas)
    var candI = []
    corpo.forEach(function (p, i) {
      var m = p.match(RX_NUM), mso = p.match(RX_NUM_SO)
      if (!m && !mso) return
      var txt = m ? limpa(m[2]) : ''
      var w = 1 + (txt.length >= 20 ? 2 : 0) + (RX_MARCAS_CE.test(p) ? 1 : 0)
      // numero sozinho colado em outro numero sozinho: folha de respostas / linhas da redacao, nao questao
      if (!txt) {
        var soNum = function (x) { return x != null && RX_NUM_SO.test(x) && !RX_NUM.test(x) }
        if (soNum(corpo[i - 1]) || soNum(corpo[i + 1])) w = -1
      }
      candI.push({ i: i, n: parseInt((m || mso)[1], 10), w: w })
    })
    var cadeia = escolherCadeia(candI)
    var esperado = 1
    corpo.forEach(function (p, iP) {
      var mt = p.match(RX_TEMA)
      if (mt && p.length < 120) { fecha(); assunto = maiusculo(mt[1]) ? titulo(mt[1]) : mt[1]; pend = []; ativo = []; return }
      var m = p.match(RX_NUM), mso = p.match(RX_NUM_SO)
      var n = m ? parseInt(m[1], 10) : mso ? parseInt(mso[1], 10) : null
      var aceita = n != null && !!cadeia[iP]
      if (aceita && cur && cur.alts.length && RX_ALT.test(p)) aceita = false
      if (aceita) {
        fecha()
        var novo = false
        if (pend.length) {
          ativo = pend; pend = []; novo = true
          // "texto para as questoes 3 a 5": vale so para essas
          var mr = ativo.join(' ').match(/quest(?:[õo]es|[ãa]o)\s+(\d{1,3})\s*(?:a|e|at[ée]|[-–])\s*(\d{1,3})/i)
          faixa = mr ? [parseInt(mr[1], 10), parseInt(mr[2], 10)] : null
        }
        cur = { numero: n, linhas: [], alts: [], gab: null, com: [], comMode: false, ativo: ativo, novoAtivo: novo, faixa: faixa, disc: '', ass: '' }
        esperado = n + 1
        var resto = m ? limpa(m[2]) : ''
        if (RX_MARCAS_CE.test(resto)) { resto = limpa(resto.replace(RX_MARCAS_CE, '')); cur.ce = true }
        var partes = resto.split(/\s+[-–—]\s+/)
        if (resto && partes.length >= 2 && resto.length < 170 && !/[.?:]$/.test(resto)) {
          cur.disc = partes[0]; cur.ass = partes[1]
        } else if (resto) { cur.linhas.push(resto); if (!RX_APOIO.test(resto)) cur.temItem = true }
        return
      }
      if (!cur || cur.comMode === false) {
        if (maiusculo(p) && !RX_CE.test(p) && !RX_ALT.test(p) && !/^GABARITO/i.test(p)) {
          fecha(); disc = titulo(p); pend = []; ativo = []; return
        }
      }
      if (!cur) { pend.push(p); return }
      var mg = p.match(RX_GAB)
      if (mg) { cur.gab = gabNorm(mg[1]); if (mg[2]) { var mc0 = mg[2].match(RX_COM); cur.com.push(mc0 ? mc0[1] : mg[2]) } cur.comMode = true; return }
      if (cur.comMode) {
        var mc = p.match(RX_COM)
        if (mc && !cur.com.length) { if (mc[1]) cur.com.push(mc[1]); return }
        cur.com.push(p); return
      }
      var mcx = p.match(RX_COM)
      if (mcx && cur.linhas.length) { cur.comMode = true; if (mcx[1]) cur.com.push(mcx[1]); return }
      if (RX_CE.test(p) || RX_CE2.test(p)) { cur.ce = true; return }
      var ma = p.match(RX_ALT)
      if (ma && LETRAS.indexOf(ma[1].toUpperCase()) === cur.alts.length && (cur.linhas.length || cur.alts.length)) { cur.alts.push(limpa(ma[2])); return }
      if (cur.alts.length) {
        // texto depois das alternativas: apoio da proxima questao
        if (RX_APOIO.test(p) || p.length > 200) { pend.push(p); return }
        cur.alts[cur.alts.length - 1] += ' ' + p; return
      }
      if (cur.temItem && !cur.ce && RX_APOIO.test(p)) { pend.push(p); return }
      if (cur.ce) { pend.push(p); return }
      cur.linhas.push(p); if (!RX_APOIO.test(p)) cur.temItem = true
    })
    fecha()

    // 3) modo: banco comentado (gabarito dentro da questao) ou caderno de prova
    var comGabDentro = itens.filter(function (q) { return q.gabarito }).length
    var modoComentado = itens.length && comGabDentro >= itens.length * 0.5
    var usarPares = Object.keys(gabPares).length >= Math.max(3, itens.length * 0.5)
    if (Object.keys(gabPares).length && !usarPares) avisos.push('Ignorei a secao "gabarito/folha de respostas" do final: ela nao tem respostas para a maioria das questoes.')
    itens.forEach(function (q) {
      var apoio = (modoComentado ? [] : q.apoioAtivo).concat(q.apoioLocal)
      q.texto_apoio = apoio.length ? apoio.join('\n\n') : null
      delete q.apoioLocal; delete q.apoioAtivo
      var gc = gabComentado[q.numero]
      if (gc) {
        if (gc.gab) q.gabarito = gc.gab
        var sg = separarBizu(gc.com)
        if (sg.com && !q.comentario) q.comentario = sg.com
        if (sg.bizu && !q.bizu) q.bizu = sg.bizu
      }
      if (usarPares && gabPares[q.numero]) q.gabarito = gabPares[q.numero]
      if (q.gabarito === 'X') { q.gabarito = q.tipo === 'multipla' ? 'A' : 'C'; q.anulada = true }
      if (!q.disciplina) q.disciplina = 'Geral'
    })
    // 4) avisos
    var semGab = itens.filter(function (q) { return !q.gabarito }).map(function (q) { return q.numero })
    if (semGab.length) avisos.push(semGab.length + ' questao(oes) sem gabarito: ' + semGab.slice(0, 15).join(', ') + (semGab.length > 15 ? '...' : '') + '. Envie o arquivo do gabarito comentado (botao "Gabarito comentado + BIZU") ou use o "Gabarito rapido".')
    for (var k = 1; k < itens.length; k++) if (itens[k].numero !== itens[k - 1].numero + 1) avisos.push('Numeracao pulou de ' + itens[k - 1].numero + ' para ' + itens[k].numero + '. Confira se faltou alguma questao.')
    itens.forEach(function (q) {
      if (q.tipo === 'certo_errado' && q.gabarito && 'CE'.indexOf(q.gabarito) < 0) avisos.push('Questao ' + q.numero + ': gabarito "' + q.gabarito + '" em questao de certo/errado. Faltaram as alternativas?')
      if (q.tipo === 'multipla' && q.gabarito && LETRAS.slice(0, q.alternativas.length).indexOf(q.gabarito) < 0) avisos.push('Questao ' + q.numero + ': gabarito "' + q.gabarito + '" nao existe entre as ' + q.alternativas.length + ' alternativas.')
      if (!q.enunciado || q.enunciado.length < 8) avisos.push('Questao ' + q.numero + ': enunciado vazio ou muito curto.')
    })
    return { itens: itens, avisos: avisos, modo: modoComentado ? 'comentado' : 'caderno' }
  }

  /* GABARITO COMENTADO (arquivo do simulado com o gabarito)
     Le o gabarito rapido do comeco (1 C 2 E..., tabela) e, item por item, o comentario e o BIZU.
     Devolve { gab:{n:'C'}, itens:{n:{gab,comentario,bizu}}, conflitos:[n], avisos:[] } */
  function lerGabaritoComentado (paragrafos) {
    var ps = paragrafos.map(limpa).filter(function (x) { return x })
    var avisos = []
    // 1) cabecalhos dos itens: escolhe a sequencia principal ("CARTAO 001", "Item 1 —", "Questao 01", "1. Certo")
    var cands = []
    ps.forEach(function (p, i) {
      var m = p.match(RX_ITEM_C); if (!m) return
      var resto = limpa(m[2]), pref = /^\s*(?:quest[aã]o|item|cart[aã]o|n[º°o])/i.test(p)
      var w = 1 + (pref ? 1 : 0) + (resto.length >= 3 ? 1 : 0) + (RX_GAB_ANY.test(p) ? 1 : 0)
      // linha so de pares "1-C 2-E 3-C" nao e cabecalho de item comentado
      if (!pref && RX_LINHA_PARES.test(p) && /\d\D+\d/.test(p)) w = 0.5
      cands.push({ i: i, n: parseInt(m[1], 10), w: w, resto: resto })
    })
    var cadeia = escolherCadeia(cands), porI = {}
    cands.forEach(function (c) { if (cadeia[c.i]) porI[c.i] = c })
    // 2) blocos: do cabecalho ate o proximo cabecalho, parando em "CICLOS", titulo de secao ou fim
    var blocos = [], cur = null, dentro = {}
    ps.forEach(function (p, i) {
      if (porI[i]) { cur = { n: porI[i].n, cab: porI[i].resto, ls: [], idx: i }; blocos.push(cur); dentro[i] = 1; return }
      if (!cur) return
      if (RX_FIM_BLOCO.test(p) || (RX_TIT_SECAO.test(p) && p.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 6 && !RX_GAB_INI.test(p) && !RX_BIZU.test(p) && !RX_ROT_COM.test(p) && cur.ls.length)) { cur = null; return }
      cur.ls.push(p); dentro[i] = 1
    })
    // um bloco "so com a letra" e linha do gabarito rapido, nao item comentado
    var res = {}, conflitos = []
    blocos.forEach(function (b) {
      var ls = b.cab ? [b.cab].concat(b.ls) : b.ls.slice()
      var g = null, ig = -1, resto = ''
      for (var j = 0; j < Math.min(ls.length, 4) && !g; j++) {
        var mg = ls[j].match(RX_GAB_TXT)
        if (mg) { g = mg[1]; ig = j; resto = mg[2]; break }
        var ma = ls[j].match(RX_GAB_ANY)
        if (ma) { g = ma[1]; ig = j; resto = ''; break }
      }
      if (!g && ls.length) { var mi = ls[0].match(RX_GAB_INI); if (mi && (!mi[2] || !/^[a-zà-ú]/.test(mi[2]))) { g = mi[1]; ig = 0; resto = mi[2] } }
      var pareLike = ls.length > 1 && ls.every(function (l) { return RX_LINHA_PARES.test(l) })
      if (pareLike) { g = null; ig = -1 }
      // ficha do item: disciplina no cabecalho ("CARTAO 001 | Lingua Portuguesa  GABARITO: ERRADO") e topico do edital
      var disc = null, ass = null
      if (b.cab && /[|]/.test(b.cab)) {
        var dc = limpa(b.cab.replace(RX_GAB_ANY_G, '').replace(/^[|\-–—:\s]+/, '').replace(/[|\-–—:\s]+$/, ''))
        if (dc && dc.length <= 60 && !/[.?]$/.test(dc)) disc = dc
      }
      var ib = -1, ic = -1, it = -1
      for (var t = 0; t < ls.length; t++) {
        if (ib < 0 && RX_BIZU.test(ls[t])) ib = t
        if (it < 0 && RX_TOPICO.test(ls[t])) it = t
      }
      if (it >= 0) {
        ass = limpa(ls[it].match(RX_TOPICO)[1].replace(/^[A-Za-zÀ-ÿ]{1,8}\s*[\d.]+\s*[-–—:]\s*/, ''))
        if (ass) ass = ass.charAt(0).toUpperCase() + ass.slice(1)
      }
      var bizu = null
      if (ib >= 0) { var mb = ls[ib].match(RX_BIZU); bizu = [mb[1]].concat(ls.slice(ib + 1)).join('\n').trim() || null }
      var fim = ib >= 0 ? ib : ls.length
      for (var u = 0; u < fim; u++) { if (RX_ROT_COM.test(ls[u])) { ic = u; break } }
      var com
      if (ic >= 0) com = [ls[ic].match(RX_ROT_COM)[1]].concat(ls.slice(ic + 1, fim))
      else if (ig >= 0) com = [resto].concat(ls.slice(ig + 1, fim))
      else com = ls.slice(0, fim)
      // tira a ficha tecnica (topico, incidencia...) quando nao ha rotulo de comentario
      if (ic < 0) com = com.filter(function (l) { return !RX_FICHA.test(l) })
      com = com.join('\n').trim().replace(/\n\s*mecanismo\s+da\s+banca\s*[:\-–—]\s*/i, '\n\n🎯 Mecanismo da banca: ')
      if (!/[A-Za-zÀ-ÿ]{4,}/.test(com)) com = ''
      var gn = g ? (/^anulad/i.test(g) ? 'X' : gabNorm(g)) : null
      var curto = (com.length < 12 && !bizu)
      if (!res[b.n]) res[b.n] = { gab: null, comentario: null, bizu: null, disciplina: null, assunto: null }
      if (gn && !res[b.n].gab) res[b.n].gab = gn
      if (!curto) {
        res[b.n].comentario = com || null; res[b.n].bizu = bizu
        if (disc) res[b.n].disciplina = disc
        if (ass) res[b.n].assunto = ass
      }
    })
    // 3) gabarito rapido: linhas so com numeros e letras FORA dos itens comentados (comeco ou fim do arquivo)
    var linhas = ps.filter(function (p, i) { return !dentro[i] && RX_LINHA_PARES.test(p) && /[\dA-Ea-eXx]/.test(p) })
    var gab = linhas.length ? lerParesGabarito(linhas.join(' ')) : {}
    // junta: gabarito rapido manda; o do comentario completa
    Object.keys(res).forEach(function (n) {
      var r = res[n]
      if (gab[n] && r.gab && gab[n] !== r.gab) conflitos.push(parseInt(n, 10))
      if (!gab[n] && r.gab) gab[n] = r.gab
    })
    var nItens = Object.keys(res).filter(function (n) { return res[n].comentario || res[n].bizu }).length
    // gabarito rapido sem item correspondente nem sequencia (lixo de tabela) e descartado
    Object.keys(gab).forEach(function (n) { if (nItens >= 5 && !res[n]) delete gab[n] })
    var nGab = Object.keys(gab).length, nCom = Object.keys(res).filter(function (n) { return res[n].comentario }).length
    var nBiz = Object.keys(res).filter(function (n) { return res[n].bizu }).length
    if (!nGab && !nCom) avisos.push('Nao encontrei gabarito nem comentarios numerados neste arquivo.')
    if (conflitos.length) avisos.push('O gabarito rapido e o comentado discordam nos itens ' + conflitos.join(', ') + '. Ficou o do gabarito rapido: confira.')
    return { gab: gab, itens: res, conflitos: conflitos, avisos: avisos, nGab: nGab, nCom: nCom, nBizu: nBiz }
  }

  raiz.lerGabaritoComentado = lerGabaritoComentado
  raiz.separarBizu = separarBizu
  raiz.lerSimulado = lerSimulado
  raiz.lerParesGabarito = lerParesGabarito
  if (typeof module !== 'undefined') module.exports = { lerSimulado: lerSimulado, lerParesGabarito: lerParesGabarito, lerGabaritoComentado: lerGabaritoComentado, separarBizu: separarBizu }
})(typeof window !== 'undefined' ? window : this)
