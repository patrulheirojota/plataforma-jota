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

  function limpa (s) { return String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim() }
  function maiusculo (s) {
    var l = s.replace(/[^A-Za-zÀ-ÿ]/g, '')
    return l.length >= 4 && l === l.toUpperCase() && s.length <= 90
  }
  function titulo (s) {
    var peq = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no', 'para', 'com']
    return s.toLowerCase().split(' ').map(function (w, i) { return (i && peq.indexOf(w) >= 0) ? w : w.charAt(0).toUpperCase() + w.slice(1) }).join(' ')
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
      } else gabPares = lerParesGabarito(secGab.join(' '))
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
      cur = null
    }
    var esperado = 1
    corpo.forEach(function (p) {
      var mt = p.match(RX_TEMA)
      if (mt && p.length < 120) { fecha(); assunto = maiusculo(mt[1]) ? titulo(mt[1]) : mt[1]; pend = []; ativo = []; return }
      var m = p.match(RX_NUM), mso = p.match(RX_NUM_SO)
      var n = m ? parseInt(m[1], 10) : mso ? parseInt(mso[1], 10) : null
      var aceita = n != null && (n === esperado || (n > esperado && n <= esperado + 3) || (!itens.length && !cur && n <= 3))
      // linha que e so um numero solto: aceita apenas se for exatamente o proximo
      if (mso && !m && n !== esperado) aceita = false
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
    itens.forEach(function (q) {
      var apoio = (modoComentado ? [] : q.apoioAtivo).concat(q.apoioLocal)
      q.texto_apoio = apoio.length ? apoio.join('\n\n') : null
      delete q.apoioLocal; delete q.apoioAtivo
      var gc = gabComentado[q.numero]
      if (gc) { if (gc.gab) q.gabarito = gc.gab; if (gc.com && !q.comentario) q.comentario = gc.com }
      if (gabPares[q.numero]) q.gabarito = gabPares[q.numero]
      if (q.gabarito === 'X') { q.gabarito = q.tipo === 'multipla' ? 'A' : 'C'; q.anulada = true }
      if (!q.disciplina) q.disciplina = 'Geral'
    })
    // 4) avisos
    var semGab = itens.filter(function (q) { return !q.gabarito }).map(function (q) { return q.numero })
    if (semGab.length) avisos.push(semGab.length + ' questao(oes) sem gabarito: ' + semGab.slice(0, 15).join(', ') + (semGab.length > 15 ? '...' : '') + '. Use o "Gabarito rapido" para completar.')
    for (var k = 1; k < itens.length; k++) if (itens[k].numero !== itens[k - 1].numero + 1) avisos.push('Numeracao pulou de ' + itens[k - 1].numero + ' para ' + itens[k].numero + '. Confira se faltou alguma questao.')
    itens.forEach(function (q) {
      if (q.tipo === 'certo_errado' && q.gabarito && 'CE'.indexOf(q.gabarito) < 0) avisos.push('Questao ' + q.numero + ': gabarito "' + q.gabarito + '" em questao de certo/errado. Faltaram as alternativas?')
      if (q.tipo === 'multipla' && q.gabarito && LETRAS.slice(0, q.alternativas.length).indexOf(q.gabarito) < 0) avisos.push('Questao ' + q.numero + ': gabarito "' + q.gabarito + '" nao existe entre as ' + q.alternativas.length + ' alternativas.')
      if (!q.enunciado || q.enunciado.length < 8) avisos.push('Questao ' + q.numero + ': enunciado vazio ou muito curto.')
    })
    return { itens: itens, avisos: avisos, modo: modoComentado ? 'comentado' : 'caderno' }
  }

  raiz.lerSimulado = lerSimulado
  raiz.lerParesGabarito = lerParesGabarito
  if (typeof module !== 'undefined') module.exports = { lerSimulado: lerSimulado, lerParesGabarito: lerParesGabarito }
})(typeof window !== 'undefined' ? window : this)
