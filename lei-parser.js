/* =====================================================================
   DIVIDE O TEXTO DE UMA LEI EM ARTIGOS (copiado do Planalto ou de PDF)
   - "Art. 1º", "Art. 5o-A", "Art 10."  -> um bloco por artigo
   - §, incisos (I -), alineas (a)) e "Paragrafo unico" ficam dentro do artigo
   - TITULO / CAPITULO / SECAO viram separadores
   - artigos "(Revogado)" ficam marcados
   ===================================================================== */
(function (raiz) {
  var RX_ART = /^\s*Art(?:igo)?\.?\s*(\d{1,4})\s*(?:[º°ºo]|\.)?\s*(?:[-–]\s*([A-Z]{1,2})\b)?\s*[.\-–:]?\s*(.*)$/i
  var RX_SEC = /^\s*(T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|LIVRO|PARTE)\s+([IVXLCDM\d]+|[ÚU]NIC[OA]|GERAL|ESPECIAL)\b(.*)$/i

  function limpa (s) { return String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim() }

  function lerLei (texto) {
    var linhas = String(texto || '').replace(/\r/g, '').split('\n').map(limpa).filter(Boolean)
    var unidades = [], cur = null, ementa = [], secAtual = null, vistos = {}
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i]
      var ms = l.match(RX_SEC)
      if (ms && l.length < 160) {
        cur = null
        var tit = limpa(ms[1] + ' ' + ms[2] + (ms[3] || ''))
        // titulo da secao costuma vir na linha seguinte, em maiusculas
        var prox = linhas[i + 1]
        if (prox && !RX_ART.test(prox) && !RX_SEC.test(prox) && prox.length < 140 && prox.replace(/[^A-Za-zÀ-ÿ]/g, '') === prox.replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase()) { tit += ' — ' + prox; i++ }
        secAtual = tit
        unidades.push({ tipo: 'secao', texto: tit })
        continue
      }
      var ma = l.match(RX_ART)
      if (ma && (ma[3] || linhas[i + 1])) {
        var chave = ma[1] + (ma[2] ? '-' + ma[2].toUpperCase() : '')
        // a mesma lei citada no meio do texto ("art. 5º desta Lei") nao abre artigo novo
        if (cur && /^art/i.test(l) && /^\s*art\.?\s*\d+[º°o]?\s*(desta|da|do|deste|,)/i.test(l)) { cur.linhas.push(l); continue }
        if (vistos[chave]) chave = chave + '#' + (++vistos[chave])
        else vistos[chave] = 1
        cur = { tipo: 'art', chave: chave, numero: ma[1] + (ma[2] ? '-' + ma[2].toUpperCase() : ''), linhas: [l], secao: secAtual }
        unidades.push(cur)
        continue
      }
      if (cur) cur.linhas.push(l)
      else if (!unidades.length) ementa.push(l)
    }
    unidades.forEach(function (u) {
      if (u.tipo !== 'art') return
      u.texto = u.linhas.join('\n')
      u.revogado = /^\s*art[^\n]{0,30}\((revogad|vetad)/i.test(u.texto) || /^\s*art\.?\s*\d+[^\n]{0,8}(revogado|vetado)\.?\s*(\(|$)/i.test(u.texto)
      delete u.linhas
    })
    return { ementa: ementa.join('\n'), unidades: unidades, artigos: unidades.filter(function (u) { return u.tipo === 'art' }) }
  }
  raiz.lerLei = lerLei
  if (typeof module !== 'undefined') module.exports = { lerLei: lerLei }
})(typeof window !== 'undefined' ? window : this)
