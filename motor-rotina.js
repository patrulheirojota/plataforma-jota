/* =====================================================================
   ROTINA INDIVIDUAL DO ALUNO ("Mapa da Jornada")
   A rotina diz QUANDO o aluno estuda (horarios da semana, com trabalho,
   treino, refeicoes...). O cronograma diz O QUE ele estuda em cada dia.
   Os blocos de estudo marcados como "cronograma" mostram as sessoes do dia.
   Funciona no navegador (window.Rotina) e no Node (testes).
   ===================================================================== */
(function (raiz) {
  // tipos de bloco: rotulo, cor (fundo do bloco) e se e estudo
  var TIPOS = {
    preparo:     { n: 'Preparacao',            c: '#7fb069', estudo: false },
    trabalho:    { n: 'Trabalho',              c: '#e3c84a', estudo: false },
    deslocamento:{ n: 'Deslocamento',          c: '#b08a5a', estudo: false },
    refeicao:    { n: 'Refeicao',              c: '#9aa3a0', estudo: false },
    treino:      { n: 'Treino',                c: '#8fa8c8', estudo: false },
    estudo:      { n: 'Estudo',                c: '#3d8fd6', estudo: true },
    questoes:    { n: 'Questoes',              c: '#2f6fb0', estudo: true },
    revisao:     { n: 'Revisao',               c: '#6a7fd6', estudo: true },
    descanso:    { n: 'Descanso',              c: '#5f6b74', estudo: false },
    livre:       { n: 'Livre',                 c: '#c1281f', estudo: false },
    outro:       { n: 'Outro',                 c: '#8b9189', estudo: false }
  }
  var DIAS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']
  var DIAS_C = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  var ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]
  var RECOMENDACOES_PADRAO = [
    'Faca um mapeamento do seu desempenho. Ao responder questoes, anote quantas acertou e quantas errou. Seja sincero nos numeros: e isso que mostra a sua evolucao.',
    'Siga os horarios como compromisso. Se perder um bloco, nao tente compensar varando a noite: retome no proximo horario.',
    'Busque fechar um topico do edital por semana em cada disciplina.',
    'Prefira estudar pelo PDF: voce mantem a concentracao por mais tempo e ganha o habito da leitura. Use a videoaula quando o assunto for novo ou muito dificil.'
  ].join('\n')

  function min (h) {
    var m = String(h || '').match(/^(\d{1,2}):(\d{2})$/)
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
  }
  function hm (m) {
    m = Math.round(m)
    var h = Math.floor(m / 60) % 24, mm = m % 60
    return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
  }
  // fim depois da meia-noite (ex.: 23:00 as 00:30) conta como dia seguinte
  function intervalo (b) {
    var i = min(b.ini), f = min(b.fim)
    if (i == null || f == null) return null
    if (f <= i) f += 24 * 60
    return [i, f]
  }
  function duracao (b) { var iv = intervalo(b); return iv ? iv[1] - iv[0] : 0 }
  function ordenar (bl) {
    return bl.slice().sort(function (a, b) { return (a.d === b.d ? 0 : ORDEM_DIAS.indexOf(a.d) - ORDEM_DIAS.indexOf(b.d)) || (min(a.ini) - min(b.ini)) })
  }
  function doDia (bl, d) { return ordenar((bl || []).filter(function (b) { return b.d === d })) }

  // ---------- validacao: horarios invalidos e blocos que se sobrepoem ----------
  function validar (bl) {
    var erros = []
    for (var d = 0; d < 7; d++) {
      var l = doDia(bl, d)
      l.forEach(function (b) { if (!intervalo(b)) erros.push(DIAS[d] + ': horario invalido em "' + (b.txt || TIPOS[b.tipo] && TIPOS[b.tipo].n || b.tipo) + '"') })
      for (var i = 1; i < l.length; i++) {
        var a = intervalo(l[i - 1]), c = intervalo(l[i])
        if (a && c && c[0] < a[1]) erros.push(DIAS[d] + ': ' + l[i - 1].ini + '–' + l[i - 1].fim + ' e ' + l[i].ini + '–' + l[i].fim + ' se sobrepoem')
      }
    }
    return erros
  }
  function minutosEstudo (bl, d) {
    return (bl || []).filter(function (b) { return (d == null || b.d === d) && TIPOS[b.tipo] && TIPOS[b.tipo].estudo }).reduce(function (s, b) { return s + duracao(b) }, 0)
  }

  // ---------- rascunho a partir das respostas do formulario ----------
  // r: { acorda, dorme, trabDias[], trab1:{ini,fim}, trab2:{ini,fim}|null, treinoDias[], treino:{ini,fim}|null,
  //      jantar:'19:00', estudoDias[], minDia, minSab, bloco:90, intervalo:10,
  //      modo:'cronograma'|'fixo', disciplinas[], questoes15:true, revisaoSemanal:true }
  function montarRascunho (r) {
    r = r || {}
    var acorda = min(r.acorda) != null ? min(r.acorda) : 6 * 60
    var dorme = min(r.dorme) != null ? min(r.dorme) : 23 * 60
    if (dorme <= acorda) dorme += 24 * 60
    var bloco = Math.max(30, parseInt(r.bloco, 10) || 90)
    var pausa = Math.max(0, parseInt(r.intervalo, 10) || 10)
    var trabDias = r.trabDias || [], treinoDias = r.treinoDias || [], estudoDias = r.estudoDias || []
    var discs = (r.disciplinas || []).filter(Boolean), iDisc = 0
    var out = []
    var ultimoEstudo = -1
    ORDEM_DIAS.forEach(function (d) { if (estudoDias.indexOf(d) >= 0) ultimoEstudo = d })

    ORDEM_DIAS.forEach(function (d) {
      var fixos = []
      var add = function (i, f, tipo, txt) { if (i != null && f != null && f - i >= 10) fixos.push({ i: i, f: f, tipo: tipo, txt: txt }) }
      var livreTotal = trabDias.indexOf(d) < 0 && treinoDias.indexOf(d) < 0 && estudoDias.indexOf(d) < 0
      if (livreTotal) { out.push({ d: d, ini: hm(acorda), fim: hm(dorme), tipo: 'livre', txt: 'Livre — descanso e familia' }); return }
      var trabalha = trabDias.indexOf(d) >= 0 && r.trab1 && min(r.trab1.ini) != null
      if (trabalha) {
        var t1i = min(r.trab1.ini), t1f = min(r.trab1.fim)
        add(Math.max(acorda, t1i - 90), t1i, 'preparo', 'Preparacao para o trabalho')
        add(t1i, t1f, 'trabalho', 'Trabalho')
        if (r.trab2 && min(r.trab2.ini) != null) {
          var t2i = min(r.trab2.ini), t2f = min(r.trab2.fim)
          if (t2i - t1f >= 30) add(t1f, t2i, 'refeicao', 'Almoco')
          add(t2i, t2f, 'trabalho', 'Trabalho')
        } else if (t1f <= 12 * 60) add(12 * 60, 13 * 60, 'refeicao', 'Almoco')
        else if (t1f <= 15 * 60) add(t1f, t1f + 60, 'refeicao', 'Almoco')
      } else {
        add(acorda, acorda + 30, 'refeicao', 'Cafe da manha')
      }
      if (treinoDias.indexOf(d) >= 0 && r.treino && min(r.treino.ini) != null) add(min(r.treino.ini), min(r.treino.fim), 'treino', 'Treino')
      // almoco (se ainda nao tem) e janta, so onde estiver livre
      var livre = function (i, f) { return fixos.every(function (x) { return f <= x.i || i >= x.f }) }
      if (!fixos.some(function (x) { return x.txt === 'Almoco' }) && livre(12 * 60, 13 * 60)) add(12 * 60, 13 * 60, 'refeicao', 'Almoco')
      var jt = min(r.jantar) != null ? min(r.jantar) : 19 * 60
      for (var k = 0; k < 6 && !livre(jt, jt + 60); k++) jt += 30
      if (livre(jt, jt + 60) && jt + 60 <= dorme) add(jt, jt + 60, 'refeicao', 'Janta')
      fixos.sort(function (a, b) { return a.i - b.i })

      // estudo: janelas livres entre acordar e dormir
      var alvo = estudoDias.indexOf(d) < 0 ? 0 : (d === 6 && r.minSab != null ? parseInt(r.minSab, 10) : (d === 0 && r.minDom != null ? parseInt(r.minDom, 10) : parseInt(r.minDia, 10) || 0))
      var janelas = [], cur = acorda
      fixos.forEach(function (x) { if (x.i - cur >= 30) janelas.push([cur, x.i]); cur = Math.max(cur, x.f) })
      if (dorme - cur >= 30) janelas.push([cur, dorme])
      // quem trabalha estuda depois do expediente (noite) e so usa a manha se faltar tempo
      var fimTrab = trabalha ? Math.max.apply(null, fixos.filter(function (x) { return x.tipo === 'trabalho' }).map(function (x) { return x.f })) : 0
      janelas.sort(function (a, b) {
        var pa = trabalha && a[0] >= fimTrab ? 0 : 1, pb = trabalha && b[0] >= fimTrab ? 0 : 1
        return pa - pb || a[0] - b[0]
      })
      var estudos = []
      janelas.forEach(function (j) {
        // apos a janta ou o treino, comeca 0 min depois; respeita um intervalo entre blocos
        var ini = j[0] + (j[0] === acorda ? 0 : (fixos.some(function (x) { return x.f === j[0] && x.tipo !== 'refeicao' }) ? pausa : 0))
        while (alvo > 0 && j[1] - ini >= 30) {
          var dur = Math.min(bloco, alvo, j[1] - ini)
          if (alvo - dur > 0 && alvo - dur < 30) dur = Math.min(j[1] - ini, alvo)   // nao deixa sobra menor que 30 min
          if (dur < 30) break                                                          // bloco curto demais: nao vale
          estudos.push({ i: ini, f: ini + dur })
          alvo -= dur
          ini += dur + pausa
        }
      })
      estudos.sort(function (a, b) { return a.i - b.i })
      estudos.forEach(function (e, ix) {
        var b = { d: d, ini: hm(e.i), fim: hm(e.f), tipo: 'estudo', txt: '', cron: false }
        var ultimos = estudos.length - ix
        if (r.revisaoSemanal !== false && d === ultimoEstudo && estudos.length >= 2 && ultimos <= 2) {
          if (ultimos === 2) { b.tipo = 'questoes'; b.txt = 'Resolucao de questoes + correcao dos erros + revisao dos temas das questoes erradas' }
          else { b.tipo = 'revisao'; b.txt = 'Revisao da semana' }
        } else if (r.modo === 'fixo' && discs.length) {
          b.txt = discs[iDisc % discs.length] + (r.questoes15 !== false ? '. Questoes nos 15 min finais.' : '')
          iDisc++
        } else {
          b.cron = true
          b.txt = 'Estudo — sessoes do cronograma'
        }
        out.push(b)
      })
      fixos.forEach(function (x) { out.push({ d: d, ini: hm(x.i), fim: hm(x.f), tipo: x.tipo, txt: x.txt }) })
    })
    return ordenar(out)
  }

  // ---------- distribui as sessoes do cronograma do dia nos blocos "cronograma" ----------
  // devolve { [indiceDoBloco]: [sessoes] } e "sobra" (sessoes que nao couberam no tempo dos blocos)
  function distribuirSessoes (blocosDia, sessoes) {
    var alvos = []
    blocosDia.forEach(function (b, i) { if (b.cron) alvos.push({ i: i, cap: duracao(b) }) })
    var mapa = {}, sobra = []
    if (!alvos.length) return { mapa: mapa, sobra: (sessoes || []).slice() }
    var k = 0
    ;(sessoes || []).forEach(function (s) {
      var m = s.tempo_minutos || 60
      while (k < alvos.length - 1 && alvos[k].cap < Math.min(m, 30)) k++
      var a = alvos[k]
      if (a.cap < Math.min(m, 30) && k === alvos.length - 1) { sobra.push(s); return }
      ;(mapa[a.i] = mapa[a.i] || []).push(s)
      a.cap -= m
    })
    return { mapa: mapa, sobra: sobra }
  }

  // bloco atual e proximo (para "agora" e "a seguir")
  function agoraEProximo (blocosDia, minutoAgora) {
    var agora = null, prox = null
    blocosDia.forEach(function (b) {
      var iv = intervalo(b); if (!iv) return
      if (minutoAgora >= iv[0] && minutoAgora < iv[1]) agora = b
      else if (iv[0] > minutoAgora && (!prox || iv[0] < min(prox.ini))) prox = b
    })
    return { agora: agora, prox: prox }
  }

  function esc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function rotuloBloco (b) { return b.txt || (TIPOS[b.tipo] || TIPOS.outro).n }

  // ---------- semana em formato de agenda (colunas = dias) ----------
  function htmlSemana (bl, opts) {
    opts = opts || {}
    var l = (bl || []).filter(function (b) { return intervalo(b) })
    if (!l.length) return '<div class="rt-vazio">Nenhum bloco ainda.</div>'
    var ini = Math.min.apply(null, l.map(function (b) { return intervalo(b)[0] }))
    var fim = Math.max.apply(null, l.map(function (b) { return intervalo(b)[1] }))
    ini = Math.floor(ini / 60) * 60; fim = Math.ceil(fim / 60) * 60
    var px = opts.px || 0.9, alt = Math.round((fim - ini) * px)
    var h = '<div class="rt-sem" style="--rt-alt:' + alt + 'px"><div class="rt-hrs"><div class="rt-cab"></div><div class="rt-col-h" style="height:' + alt + 'px">'
    for (var t = ini; t < fim; t += 60) h += '<div class="rt-hr" style="top:' + Math.round((t - ini) * px) + 'px">' + hm(t) + '</div>'
    h += '</div></div>'
    ORDEM_DIAS.forEach(function (d) {
      h += '<div class="rt-dia' + (opts.hoje === d ? ' hoje' : '') + '"><div class="rt-cab">' + DIAS[d] + '</div><div class="rt-col" style="height:' + alt + 'px">'
      for (var t2 = ini; t2 < fim; t2 += 60) h += '<div class="rt-lin" style="top:' + Math.round((t2 - ini) * px) + 'px"></div>'
      doDia(l, d).forEach(function (b) {
        var iv = intervalo(b), tp = TIPOS[b.tipo] || TIPOS.outro
        var top = Math.round((iv[0] - ini) * px), hh = Math.max(14, Math.round((iv[1] - iv[0]) * px) - 2)
        h += '<div class="rt-b" style="top:' + top + 'px;height:' + hh + 'px;--rt-c:' + tp.c + '" title="' + esc(b.ini + '–' + b.fim + ' ' + rotuloBloco(b)) + '">'
          + '<span class="rt-bh">' + esc(b.ini) + '–' + esc(b.fim) + '</span><span class="rt-bt">' + esc(rotuloBloco(b)) + '</span></div>'
      })
      h += '</div></div>'
    })
    return h + '</div>'
  }

  // CSS da agenda (usado pelo aluno, pelo mentor e na impressao)
  var CSS = [
    '.rt-sem{display:grid;grid-template-columns:44px repeat(7,minmax(92px,1fr));gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}',
    '.rt-cab{height:26px;font-size:11.5px;font-weight:800;color:var(--tx2);text-align:center;line-height:26px;text-transform:uppercase;letter-spacing:.5px}',
    '.rt-dia.hoje .rt-cab{color:var(--ouro)}',
    '.rt-col,.rt-col-h{position:relative;background:var(--card2);border-radius:8px}',
    '.rt-col-h{background:none}',
    '.rt-dia.hoje .rt-col{outline:1px solid var(--ouro)}',
    '.rt-hr{position:absolute;right:4px;font-size:10px;color:var(--tx4);transform:translateY(-1px)}',
    '.rt-lin{position:absolute;left:0;right:0;border-top:1px dashed var(--bd)}',
    '.rt-b{position:absolute;left:3px;right:3px;border-radius:6px;padding:3px 5px;overflow:hidden;background:color-mix(in srgb,var(--rt-c) 26%,var(--card));border-left:4px solid var(--rt-c);font-size:10.5px;line-height:1.25;color:var(--tx)}',
    '.rt-bh{display:block;font-weight:800;font-size:9.5px;color:var(--tx2)}',
    '.rt-bt{display:block}',
    '.rt-vazio{color:var(--tx3);font-size:13px;padding:10px 0}',
    '.rt-leg{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:10px;font-size:11.5px;color:var(--tx3)}',
    '.rt-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}',
    '@media print{.rt-sem{overflow:visible;grid-template-columns:40px repeat(7,1fr)}.rt-b{background:color-mix(in srgb,var(--rt-c) 45%,#fff);color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}.rt-bh{color:#333}.rt-col{background:#f4f4f2}}'
  ].join('\n')
  function htmlLegenda (bl) {
    var usados = {}
    ;(bl || []).forEach(function (b) { usados[b.tipo] = 1 })
    return '<div class="rt-leg">' + Object.keys(TIPOS).filter(function (t) { return usados[t] }).map(function (t) { return '<span><i style="background:' + TIPOS[t].c + '"></i>' + TIPOS[t].n + '</span>' }).join('') + '</div>'
  }

  var api = { TIPOS: TIPOS, DIAS: DIAS, DIAS_C: DIAS_C, ORDEM_DIAS: ORDEM_DIAS, RECOMENDACOES_PADRAO: RECOMENDACOES_PADRAO,
    min: min, hm: hm, intervalo: intervalo, duracao: duracao, ordenar: ordenar, doDia: doDia, validar: validar, minutosEstudo: minutosEstudo,
    montarRascunho: montarRascunho, distribuirSessoes: distribuirSessoes, agoraEProximo: agoraEProximo, htmlSemana: htmlSemana, htmlLegenda: htmlLegenda, rotulo: rotuloBloco, CSS: CSS }
  raiz.Rotina = api
  if (typeof module !== 'undefined') module.exports = api
})(typeof window !== 'undefined' ? window : this)
