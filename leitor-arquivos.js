/* =====================================================================
   LEITOR DE ARQUIVOS: Word (.docx), PDF e texto -> lista de paragrafos
   - Word: lido aqui mesmo, sem biblioteca externa (inclusive numeracao automatica)
   - PDF: usa o pdf.js (gratuito), carregado so quando precisa
   Sem custo e sem enviar o arquivo para nenhum servidor.
   ===================================================================== */
var PDFJS_URL = window.PDFJS_URL || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
var PDFJS_WORKER = window.PDFJS_WORKER || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

async function lerArquivoParagrafos (file) {
  var nome = String(file.name || '').toLowerCase()
  if (nome.endsWith('.docx')) return lerDocx(file)
  if (nome.endsWith('.pdf')) return lerPdf(file)
  if (nome.endsWith('.doc')) throw new Error('Arquivo .doc antigo: abra no Word e use "Salvar como" .docx')
  var t = await file.text()
  return t.split(/\r?\n/)
}

/* ---------------- DOCX ---------------- */
async function unzipArquivos (buf, nomes) {
  var dv = new DataView(buf), u8 = new Uint8Array(buf), out = {}
  // fim do diretorio central
  var eocd = -1
  for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break } }
  if (eocd < 0) throw new Error('arquivo .docx invalido')
  var qtd = dv.getUint16(eocd + 10, true), pos = dv.getUint32(eocd + 16, true)
  var dec = new TextDecoder('utf-8')
  for (var k = 0; k < qtd; k++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) break
    var metodo = dv.getUint16(pos + 10, true), tamC = dv.getUint32(pos + 20, true)
    var lenN = dv.getUint16(pos + 28, true), lenX = dv.getUint16(pos + 30, true), lenK = dv.getUint16(pos + 32, true)
    var off = dv.getUint32(pos + 42, true)
    var nome = dec.decode(u8.subarray(pos + 46, pos + 46 + lenN))
    pos += 46 + lenN + lenX + lenK
    if (nomes.indexOf(nome) < 0) continue
    var ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true)
    var dados = u8.subarray(ini, ini + tamC)
    if (metodo === 0) out[nome] = dec.decode(dados)
    else if (metodo === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador nao abre .docx. Use o Chrome atualizado.')
      var st = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      out[nome] = await new Response(st).text()
    }
  }
  return out
}

async function lerDocx (file) {
  var buf = await file.arrayBuffer()
  var arq = await unzipArquivos(buf, ['word/document.xml', 'word/numbering.xml', 'word/styles.xml'])
  if (!arq['word/document.xml']) throw new Error('nao encontrei o texto dentro do .docx')
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  var doc = new DOMParser().parseFromString(arq['word/document.xml'], 'application/xml')
  // numeracao automatica do Word (1. 2. 3. / a) b) c))
  var fmt = {}
  if (arq['word/numbering.xml']) {
    var nd = new DOMParser().parseFromString(arq['word/numbering.xml'], 'application/xml')
    var abs = {}
    Array.prototype.forEach.call(nd.getElementsByTagNameNS(W, 'abstractNum'), function (a) {
      var id = a.getAttributeNS(W, 'abstractNumId'), lv = {}
      Array.prototype.forEach.call(a.getElementsByTagNameNS(W, 'lvl'), function (l) {
        var nf = l.getElementsByTagNameNS(W, 'numFmt')[0], tx = l.getElementsByTagNameNS(W, 'lvlText')[0], st = l.getElementsByTagNameNS(W, 'start')[0]
        lv[l.getAttributeNS(W, 'ilvl')] = { f: nf ? nf.getAttributeNS(W, 'val') : 'decimal', t: tx ? tx.getAttributeNS(W, 'val') : '%1.', s: st ? parseInt(st.getAttributeNS(W, 'val'), 10) : 1 }
      })
      abs[id] = lv
    })
    Array.prototype.forEach.call(nd.getElementsByTagNameNS(W, 'num'), function (n) {
      var a = n.getElementsByTagNameNS(W, 'abstractNumId')[0]
      if (a) fmt[n.getAttributeNS(W, 'numId')] = abs[a.getAttributeNS(W, 'val')] || {}
    })
  }
  // numeracao que vem do ESTILO do paragrafo (ex.: estilo "Lista numerada")
  var numEstilo = {}
  if (arq['word/styles.xml']) {
    var sd = new DOMParser().parseFromString(arq['word/styles.xml'], 'application/xml')
    var base = {}
    Array.prototype.forEach.call(sd.getElementsByTagNameNS(W, 'style'), function (st) {
      var sid = st.getAttributeNS(W, 'styleId'), np = st.getElementsByTagNameNS(W, 'numPr')[0], bo = st.getElementsByTagNameNS(W, 'basedOn')[0]
      if (bo) base[sid] = bo.getAttributeNS(W, 'val')
      if (np) {
        var ni = np.getElementsByTagNameNS(W, 'numId')[0], il = np.getElementsByTagNameNS(W, 'ilvl')[0]
        if (ni) numEstilo[sid] = { numId: ni.getAttributeNS(W, 'val'), ilvl: il ? il.getAttributeNS(W, 'val') : '0' }
      }
    })
    Object.keys(base).forEach(function (sid) { var b = base[sid], k = 0; while (!numEstilo[sid] && b && k++ < 5) { if (numEstilo[b]) numEstilo[sid] = numEstilo[b]; b = base[b] } })
  }
  var cont = {}
  function rotulo (numId, ilvl) {
    var lv = (fmt[numId] || {})[ilvl]; if (!lv || lv.f === 'bullet' || lv.f === 'none') return ''
    var k = numId + ':' + ilvl
    cont[k] = (cont[k] == null ? lv.s : cont[k] + 1)
    // zera os niveis de baixo (ex.: alternativas recomecam em "a" a cada questao)
    Object.keys(cont).forEach(function (x) { var p = x.split(':'); if (p[0] === numId && parseInt(p[1], 10) > parseInt(ilvl, 10)) delete cont[x] })
    var n = cont[k], v
    if (lv.f === 'lowerLetter') v = String.fromCharCode(96 + n)
    else if (lv.f === 'upperLetter') v = String.fromCharCode(64 + n)
    else v = String(n)
    return lv.t.replace(/%\d/, v) + ' '
  }
  var paras = []
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'p'), function (p) {
    var t = ''
    var walker = function (no) {
      for (var c = no.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue
        var ln = c.localName
        if (ln === 't') t += c.textContent
        else if (ln === 'tab') t += ' '
        else if (ln === 'br' || ln === 'cr') t += ' '
        else if (ln === 'p') continue
        else walker(c)
      }
    }
    walker(p)
    var np = p.getElementsByTagNameNS(W, 'numPr')[0]
    if (t.trim()) {
      var numId = null, ilvl = '0'
      if (np) {
        var ni = np.getElementsByTagNameNS(W, 'numId')[0], il = np.getElementsByTagNameNS(W, 'ilvl')[0]
        if (ni) numId = ni.getAttributeNS(W, 'val'); if (il) ilvl = il.getAttributeNS(W, 'val')
      }
      if (!numId) {
        var ps = p.getElementsByTagNameNS(W, 'pStyle')[0], e = ps && numEstilo[ps.getAttributeNS(W, 'val')]
        if (e) { numId = e.numId; ilvl = e.ilvl }
      }
      if (numId && numId !== '0') t = rotulo(numId, ilvl) + t
    }
    paras.push(t)
  })
  return paras
}

/* ---------------- PDF ---------------- */
function carregarScript (url) {
  return new Promise(function (ok, erro) {
    var s = document.createElement('script'); s.src = url; s.onload = ok
    s.onerror = function () { erro(new Error('nao consegui carregar o leitor de PDF (verifique a internet)')) }
    document.head.appendChild(s)
  })
}
async function lerPdf (file) {
  if (!window.pdfjsLib) await carregarScript(PDFJS_URL)
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
  var pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  var linhasTodas = []
  for (var pg = 1; pg <= pdf.numPages; pg++) {
    var page = await pdf.getPage(pg)
    var vp = page.getViewport({ scale: 1 })
    var tc = await page.getTextContent()
    var itens = tc.items.filter(function (it) { return it.str && it.str.trim() }).map(function (it) {
      return { s: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || 10, w: it.width || 0 }
    })
    // duas colunas? (comum no caderno da CEBRASPE)
    var meio = vp.width / 2
    var esq = itens.filter(function (i) { return i.x + i.w <= meio + 5 }), dir = itens.filter(function (i) { return i.x >= meio - 5 })
    var colunas = (esq.length > 15 && dir.length > 15 && esq.length + dir.length >= itens.length * 0.9) ? [esq, dir.filter(function (i) { return esq.indexOf(i) < 0 })] : [itens]
    colunas.forEach(function (col) {
      col.sort(function (a, b) { return b.y - a.y || a.x - b.x })
      var linhas = []
      col.forEach(function (i) {
        var l = linhas[linhas.length - 1]
        if (l && Math.abs(l.y - i.y) <= Math.max(2, i.h * 0.35)) { l.partes.push(i) } else linhas.push({ y: i.y, h: i.h, partes: [i] })
      })
      linhas.forEach(function (l) {
        l.partes.sort(function (a, b) { return a.x - b.x })
        var t = '', fimX = null
        l.partes.forEach(function (p) { if (fimX != null && p.x - fimX > 1.5) t += ' '; t += p.s; fimX = p.x + p.w })
        linhasTodas.push({ t: t.replace(/\s+/g, ' ').trim(), y: l.y, h: l.h, pg: pg, x: l.partes[0].x })
      })
    })
  }
  // tira cabecalho/rodape repetido e numero de pagina
  var freq = {}
  linhasTodas.forEach(function (l) { var k = l.t.replace(/\d+/g, '#'); freq[k] = (freq[k] || 0) + 1 })
  var lim = Math.max(3, Math.floor(pdf.numPages * 0.6))
  linhasTodas = linhasTodas.filter(function (l) {
    var k = l.t.replace(/\d+/g, '#')
    return !(freq[k] >= lim && pdf.numPages >= 3) && !/^(p[aá]gina\s*)?\d+\s*(de\s*\d+)?$/i.test(l.t) && !/^[–-]?\s*\d+\s*[–-]?$/.test(l.t) || /^\d{1,3}\s*[.)-]/.test(l.t)
  })
  // junta linhas em paragrafos
  var INICIO = /^\s*((quest[aã]o|item)\s*\d+|\d{1,3}\s*[.)\-–—]|\d{1,3}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“(]|\(?[A-Ea-e]\s*[).\-–]\s|gabarito|coment[aá]rio|certo$|errado$|texto\s|julgue|considere|acerca|com base)/i
  var paras = [], atual = null, ant = null
  linhasTodas.forEach(function (l) {
    var maius = l.t.replace(/[^A-Za-zÀ-ÿ]/g, ''); maius = maius.length >= 4 && maius === maius.toUpperCase()
    var gap = ant && ant.pg === l.pg ? (ant.y - l.y) : 0
    var novo = !atual || INICIO.test(l.t) || maius || (ant && ant.pg === l.pg && gap > ant.h * 1.9) || (ant && /^[A-ZÁÉÍÓÚ ]+$/.test(ant.t))
    if (novo) { if (atual) paras.push(atual); atual = l.t }
    else atual = /-$/.test(atual) ? atual.slice(0, -1) + l.t : atual + ' ' + l.t
    ant = l
  })
  if (atual) paras.push(atual)
  return paras
}
