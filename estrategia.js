// =====================================================================
// CERTEZA / DUVIDA / CHUTE + ESTRATEGIA DE CHUTE
// Usado em: questoes.html (treino e "meus simulados"), simulado.html (simulado da banca)
// e cronograma.html (aba Desempenho, inclusive no modo mentor).
// =====================================================================
(function () {
  var NIVEIS = [
    { k: 'certeza', ic: '🟢', nome: 'Tenho certeza', curto: 'Certeza', cor: '#6ddba0' },
    { k: 'duvida', ic: '🟡', nome: 'Duvida', curto: 'Duvida', cor: '#e8b04b' },
    { k: 'chute', ic: '🔴', nome: 'Chutei', curto: 'Chute', cor: '#f07171' }
  ]
  var MIN = 5 // abaixo disso, avisa que ha poucos dados
  function esc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function pct (a, b) { return b ? Math.round(a / b * 100) : 0 }
  function nivel (k) { for (var i = 0; i < NIVEIS.length; i++) if (NIVEIS[i].k === k) return NIVEIS[i]; return null }
  function minTxt (s) { s = Math.round(s || 0); return s >= 60 ? Math.floor(s / 60) + 'min' + (s % 60 ? ' ' + (s % 60) + 's' : '') : s + 's' }
  function sinal (n) { return (n > 0 ? '+' : '') + String(n).replace('.', ',') }

  // ---------- botoes ----------
  // fn = nome da funcao global chamada com (id, nivel)
  function botoes (id, atual, fn, rotulo) {
    return '<div class="conf-linha" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:12px">'
      + '<span style="color:var(--tx3);font-size:12.5px;margin-right:2px">' + esc(rotulo || 'Sua confianca:') + '</span>'
      + NIVEIS.map(function (n) {
        var on = atual === n.k
        return '<button type="button" class="btn conf-b" data-conf="' + n.k + '" onclick="' + fn + '(\'' + id + '\',\'' + n.k + '\')" style="padding:7px 11px;font-size:12.5px;'
          + (on ? 'border-color:' + n.cor + ';color:' + n.cor + ';background:rgba(255,255,255,.04);font-weight:700' : '') + '">' + n.ic + ' ' + n.curto + '</button>'
      }).join('') + '</div>'
  }
  // botoes que JA respondem (treino): um toque so
  function botoesResponder (id, fn) {
    return NIVEIS.map(function (n, i) {
      return '<button type="button" class="btn' + (i === 0 ? ' btn-ouro' : '') + '" onclick="' + fn + '(\'' + id + '\',\'' + n.k + '\')" style="padding:11px 14px;flex:1;min-width:104px' + (i ? ';border-color:' + n.cor + ';color:' + n.cor : '') + '">' + n.ic + ' ' + n.nome + '</button>'
    }).join('')
  }
  function tag (k) {
    var n = nivel(k); if (!n) return ''
    return '<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11.5px;font-weight:700;border:1px solid ' + n.cor + ';color:' + n.cor + '">' + n.ic + ' ' + n.curto + '</span>'
  }
  // recado logo depois de responder
  function recado (k, acertou) {
    if (k === 'certeza' && !acertou) return '<div style="margin-top:9px;font-size:13px;color:#f07171"><strong>❗ Errou com certeza.</strong> Este e o erro mais perigoso: voce acha que sabe. Leia o comentario com calma e anote no caderno.</div>'
    if (k === 'chute' && acertou) return '<div style="margin-top:9px;font-size:13px;color:#e8b04b"><strong>🍀 Acertou no chute.</strong> O ponto conta, mas o conteudo ainda nao e seu. Vale revisar.</div>'
    if (k === 'duvida' && acertou) return '<div style="margin-top:9px;font-size:12.5px;color:var(--tx3)">Acertou na duvida: revise para transformar em certeza.</div>'
    return ''
  }

  // ---------- analise ----------
  // itens: [{tipo:'ce'|'me', conf, status:'certa'|'errada'|'branca'|'anulada', nAlt, elim, tempo}]
  // opts: {penaliza: a prova desconta erro? (simulado da banca) | null no treino}
  function analisar (itens, opts) {
    opts = opts || {}
    var A = { marcadas: 0, semMarca: 0, brancasMe: 0, ganhoBrancasMe: 0, niv: {}, tempoTotal: 0, temTempo: false, temCe: false, temMe: false, penaliza: opts.penaliza }
    NIVEIS.forEach(function (n) { A.niv[n.k] = { n: 0, c: 0, e: 0, ce: { n: 0, c: 0, e: 0 }, me: { n: 0, c: 0, e: 0, sorte: 0, sem_elim: 0 }, tempo: 0, tn: 0 } })
    ;(itens || []).forEach(function (it) {
      if (it.status === 'anulada') return
      var nAlt = it.nAlt || 5, elim = Math.min(Math.max(it.elim || 0, 0), nAlt - 1)
      if (it.tipo === 'ce') A.temCe = true; else A.temMe = true
      if (it.tempo) { A.temTempo = true; A.tempoTotal += it.tempo }
      if (it.status === 'branca') { if (it.tipo !== 'ce') { A.brancasMe++; A.ganhoBrancasMe += 1 / (nAlt - elim) } return }
      var x = A.niv[it.conf]
      if (!x) { A.semMarca++; return }
      A.marcadas++
      var ok = it.status === 'certa'
      x.n++; if (ok) x.c++; else x.e++
      var t = it.tipo === 'ce' ? x.ce : x.me
      t.n++; if (ok) t.c++; else t.e++
      if (it.tipo !== 'ce') { t.sorte += 1 / (nAlt - elim); if (!elim) t.sem_elim++ }
      if (it.tempo) { x.tempo += it.tempo; x.tn++ }
    })
    A.dicas = dicas(A)
    return A
  }

  function dicas (A) {
    var D = [], cer = A.niv.certeza, duv = A.niv.duvida, chu = A.niv.chute
    if (A.brancasMe && !A.penaliza) D.push({ tom: 'erro', txt: 'Voce deixou <strong>' + A.brancasMe + ' questao(oes) de multipla escolha em branco</strong>. Sem desconto por erro, branco e ponto perdido: so na sorte seriam cerca de <strong>+' + String(Math.round(A.ganhoBrancasMe * 10) / 10).replace('.', ',') + ' ponto(s)</strong>. Na multipla escolha, <strong>sempre marque</strong>.' })
    if (!A.marcadas) return D
    // 1) metacognicao
    if (cer.e) D.push({ tom: 'erro', txt: '<strong>' + cer.e + ' erro(s) com certeza.</strong> Sao os mais perigosos: voce acha que sabe e erra. Revise esses primeiro.' })
    if (cer.n >= MIN && pct(cer.c, cer.n) < 80) D.push({ tom: 'alerta', txt: 'Quando voce marca <strong>certeza</strong>, acerta so <strong>' + pct(cer.c, cer.n) + '%</strong>. O ideal e passar de 90%: desconfie mais das "certezas" e leia o enunciado ate o fim.' })
    if (chu.c) D.push({ tom: 'info', txt: '<strong>' + chu.c + ' acerto(s) no chute.</strong> O ponto entrou, mas o conteudo ainda nao e seu: revise esses assuntos.' })

    // 2) CERTO/ERRADO: chutar compensa? (uma errada anula uma certa: so compensa acertando mais da metade)
    var ceNeg = A.penaliza !== false
    if (A.temCe && ceNeg) {
      ;[['no chute', chu], ['na duvida', duv]].forEach(function (p) {
        var t = p[1].ce; if (!t.n) return
        var saldo = t.c - t.e, poucos = t.n < MIN ? ' <em style="color:var(--tx4)">(poucos dados ainda)</em>' : ''
        if (saldo < 0) D.push({ tom: 'erro', txt: 'Certo/Errado: <strong>' + p[0] + '</strong> voce acertou ' + t.c + ' e errou ' + t.e + ' (saldo <strong>' + sinal(saldo) + '</strong>). Numa prova que desconta, <strong>deixar em branco</strong> teria sido melhor.' + poucos })
        else if (saldo > 0) D.push({ tom: 'ok', txt: 'Certo/Errado: <strong>' + p[0] + '</strong> o saldo foi <strong>' + sinal(saldo) + '</strong> (' + pct(t.c, t.n) + '% de acerto). Nesse nivel, <strong>arriscar compensa</strong>.' + poucos })
        else D.push({ tom: 'info', txt: 'Certo/Errado: <strong>' + p[0] + '</strong> empatou (' + t.c + ' x ' + t.e + '). Arriscar nao ganhou nem perdeu.' + poucos })
      })
    }

    // 3) MULTIPLA ESCOLHA: nunca em branco; o chute e melhor que a sorte?
    if (A.temMe) {
      var m = chu.me
      if (m.n) {
        var acerto = pct(m.c, m.n), sorte = Math.round(m.sorte / m.n * 100), poucos = m.n < MIN ? ' <em style="color:var(--tx4)">(poucos dados ainda)</em>' : ''
        if (acerto >= sorte * 1.25) D.push({ tom: 'ok', txt: 'Multipla escolha: seu chute acerta <strong>' + acerto + '%</strong>, acima da sorte (' + sorte + '%). Sua eliminacao de alternativas funciona: <strong>elimine e chute com confianca</strong>.' + poucos })
        else if (acerto < sorte * 0.8) D.push({ tom: 'erro', txt: 'Multipla escolha: seu chute acerta <strong>' + acerto + '%</strong>, abaixo da sorte (' + sorte + '%). Voce esta caindo nas <strong>pegadinhas da banca</strong>: revise as erradas e veja que tipo de alternativa te atrai.' + poucos })
        else D.push({ tom: 'alerta', txt: 'Multipla escolha: seu chute acerta <strong>' + acerto + '%</strong>, igual a sorte (' + sorte + '%). <strong>Elimine pelo menos 1 ou 2 alternativas</strong> antes de chutar.' + poucos })
        if (A.temTempo && m.sem_elim >= 3 && m.sem_elim / m.n >= 0.5) D.push({ tom: 'alerta', txt: 'Em <strong>' + m.sem_elim + ' chute(s)</strong> voce nao riscou nenhuma alternativa. Use a tesoura ✂️: eliminar 2 de 5 sobe a chance de 20% para 33%.' })
      }
      var d2 = duv.me
      if (d2.n >= MIN) D.push({ tom: 'info', txt: 'Na <strong>duvida</strong> (multipla escolha) voce acerta <strong>' + pct(d2.c, d2.n) + '%</strong>.' + (pct(d2.c, d2.n) < 50 ? ' Quando sobrar duvida entre duas, volte ao comando da questao: a banca costuma premiar a resposta mais exata, nao a mais completa.' : ' Boa leitura das alternativas.') })
    }

    // 4) tempo (so no simulado da banca, que mede tempo por questao)
    if (A.temTempo && chu.tn >= 2 && cer.tn) {
      var tChu = chu.tempo / chu.tn, tCer = cer.tempo / cer.tn
      if (tChu > tCer * 1.5 && chu.tempo >= 120) D.push({ tom: 'alerta', txt: 'Voce gastou <strong>' + minTxt(chu.tempo) + '</strong> em questoes que acabou chutando (media de ' + minTxt(tChu) + ' cada, contra ' + minTxt(tCer) + ' nas de certeza). Estrategia: se em ~' + minTxt(Math.max(90, tCer * 2)) + ' nao resolveu, <strong>marque ⚑, ' + (A.penaliza ? 'decida entre chutar ou deixar em branco' : 'chute') + ' e siga</strong>. Volte no fim se sobrar tempo.' })
    }
    return D
  }

  // nota se o aluno tivesse deixado em branco (so quando a prova desconta)
  function cenarios (A, notaAtual) {
    var nChu = A.niv.chute.c - A.niv.chute.e, nDuv = A.niv.duvida.c - A.niv.duvida.e
    return [
      { txt: 'Sua nota', v: notaAtual },
      { txt: 'Deixando em branco os chutes', v: notaAtual - nChu },
      { txt: 'Deixando em branco chutes e duvidas', v: notaAtual - nChu - nDuv }
    ]
  }

  // ---------- telas ----------
  var COR = { ok: '#6ddba0', erro: '#f07171', alerta: '#e8b04b', info: 'var(--tx2)' }
  function cardsNiveis (fonte) {
    return '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 12px">'
      + NIVEIS.map(function (n) {
        var x = fonte[n.k] || { n: 0, c: 0 }
        return '<div style="background:var(--card2,rgba(255,255,255,.03));border:1px solid var(--bd);border-top:3px solid ' + n.cor + ';border-radius:10px;padding:9px 6px;text-align:center">'
          + '<div style="font-size:12px;color:var(--tx3)">' + n.ic + ' ' + n.curto + '</div>'
          + '<div style="font-size:21px;font-weight:800;color:' + (x.n ? n.cor : 'var(--tx4)') + '">' + (x.n ? pct(x.c, x.n) + '%' : '--') + '</div>'
          + '<div style="font-size:11.5px;color:var(--tx3)">' + x.c + ' de ' + x.n + '</div></div>'
      }).join('') + '</div>'
  }
  function listaDicas (D) {
    return D.map(function (d) {
      return '<div style="display:flex;gap:8px;padding:8px 0;border-top:1px solid var(--bd);font-size:13.5px;line-height:1.55;color:var(--tx2)"><span style="color:' + COR[d.tom] + '">●</span><div>' + d.txt + '</div></div>'
    }).join('')
  }
  function semMarcacao () {
    return '<div style="font-size:13.5px;color:var(--tx2);line-height:1.6">Na proxima prova, marque <strong>🟢 Certeza</strong>, <strong>🟡 Duvida</strong> ou <strong>🔴 Chute</strong> em cada questao. Assim a plataforma mostra se o seu chute compensa e onde estao os erros mais perigosos.</div>'
  }
  // card do resultado de uma prova. opts: {penaliza, nota (numero), titulo}
  function html (A, opts) {
    opts = opts || {}
    var h = '<div class="painel card" style="margin-bottom:16px"><div style="font-size:14px;font-weight:800;color:var(--ouro)">🧠 ' + esc(opts.titulo || 'Sua estrategia de chute') + '</div>'
    if (!A.marcadas) return h + '<div style="margin-top:8px">' + semMarcacao() + '</div>' + listaDicas(A.dicas) + '</div>'
    h += '<div style="color:var(--tx3);font-size:12px;margin-top:2px">Acerto em cada nivel de confianca' + (A.semMarca ? ' · ' + A.semMarca + ' resposta(s) sem marcacao' : '') + '</div>'
    h += cardsNiveis(A.niv)
    if (A.penaliza && typeof opts.nota === 'number' && (A.niv.chute.n || A.niv.duvida.n)) {
      var cs = cenarios(A, opts.nota), melhor = Math.max.apply(null, cs.map(function (c) { return c.v }))
      h += '<div style="background:var(--card2,rgba(255,255,255,.03));border:1px solid var(--bd);border-radius:10px;padding:10px 12px;margin-bottom:6px"><div style="font-size:12.5px;color:var(--tx3);margin-bottom:6px">E se voce tivesse deixado em branco? (cada errada anula uma certa)</div>'
        + cs.map(function (c, i) {
          var top = c.v === melhor && melhor !== cs[0].v
          return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13.5px;padding:3px 0;' + (top ? 'color:#6ddba0;font-weight:800' : i ? 'color:var(--tx2)' : 'font-weight:700') + '"><span>' + c.txt + (top ? ' ⭐' : '') + '</span><span>' + String(Math.round(c.v * 100) / 100).replace('.', ',') + '</span></div>'
        }).join('') + '</div>'
    } else if (A.temCe && A.penaliza == null && (A.niv.chute.ce.n || A.niv.duvida.ce.n)) {
      h += '<div style="font-size:12.5px;color:var(--tx3);margin-bottom:4px">Nas questoes de Certo/Errado, a analise considera a regra CEBRASPE: uma errada anula uma certa.</div>'
    }
    h += listaDicas(A.dicas)
    return h + '</div>'
  }

  // painel da aba Desempenho (dados da funcao metacognicao do banco)
  function htmlResumo (d, opts) {
    opts = opts || {}
    if (!d || typeof d !== 'object' || !Array.isArray(d.niveis)) return '<div style="color:var(--tx3);font-size:13px">Ainda nao disponivel.</div>'
    if (!d.marcadas) return semMarcacao()
    var niv = {}, A = { marcadas: d.marcadas, semMarca: 0, brancasMe: 0, temCe: false, temMe: false, temTempo: false, penaliza: null, niv: {} }
    NIVEIS.forEach(function (n) { niv[n.k] = { n: 0, c: 0 }; A.niv[n.k] = { n: 0, c: 0, e: 0, ce: { n: 0, c: 0, e: 0 }, me: { n: 0, c: 0, e: 0, sorte: 0, sem_elim: 0 }, tempo: 0, tn: 0 } })
    d.niveis.forEach(function (l) {
      var x = A.niv[l.confianca]; if (!x) return
      var n = +l.n || 0, c = +l.certas || 0
      x.n += n; x.c += c; x.e += n - c; niv[l.confianca].n += n; niv[l.confianca].c += c
      if (l.tipo === 'ce') { A.temCe = true; x.ce.n += n; x.ce.c += c; x.ce.e += n - c } else { A.temMe = true; x.me.n += n; x.me.c += c; x.me.e += n - c; x.me.sorte += +l.sorte || 0 }
    })
    var D = dicas(A)
    var h = '<div style="color:var(--tx3);font-size:12px">' + d.marcadas + ' resposta(s) marcadas com certeza, duvida ou chute</div>' + cardsNiveis(niv)
    function lista (arr, titulo, cor, status) {
      if (!arr || !arr.length) return ''
      return '<div style="margin-top:10px"><div style="font-size:13px;font-weight:700;color:' + cor + ';margin-bottom:4px">' + titulo + '</div>'
        + arr.map(function (r) {
          var link = typeof desLinkTreinar === 'function' ? '<a href="' + esc(desLinkTreinar(r.disciplina, r.assunto, status)) + '" style="color:var(--ouro);font-weight:700;text-decoration:none">treinar ›</a>' : ''
          return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:5px 0;border-top:1px solid var(--bd)"><span>' + esc(r.disciplina) + ' › ' + esc(r.assunto) + '</span><span style="white-space:nowrap;color:var(--tx3)">' + r.n + 'x' + (link ? ' ' + link : '') + '</span></div>'
        }).join('') + '</div>'
    }
    h += lista(d.erros_com_certeza, '❗ Onde voce erra achando que sabe', '#f07171', 'errei')
    h += lista(d.acertos_no_chute, '🍀 Onde voce acerta no chute (ainda nao e seu)', '#e8b04b', '')
    return h + '<div style="margin-top:6px">' + listaDicas(D) + '</div>'
  }

  window.Estrategia = { NIVEIS: NIVEIS, botoes: botoes, botoesResponder: botoesResponder, tag: tag, recado: recado, analisar: analisar, html: html, htmlResumo: htmlResumo, cenarios: cenarios }
})()
