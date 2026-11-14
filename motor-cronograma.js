// =====================================================================
// MOTOR DO CRONOGRAMA: o mesmo calculo do Gerador do mentor e do
// "Montar meu cronograma" do assinante. Funcoes puras (sem tela).
// =====================================================================
var PESO = { alta:0, media:1, baixa:2 }
function ymd(d){ const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0') }
function parseD(s){ return new Date(s+'T12:00:00') }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }

function intercalar(temas){
  const porDisc = {}
  temas.forEach(function(t){ if(!porDisc[t.disciplina]) porDisc[t.disciplina]=[]; porDisc[t.disciplina].push(t) })
  const filas = Object.keys(porDisc).map(function(nome){
    const itens = porDisc[nome].slice().sort(function(a,b){
      const pa = PESO[a.prioridade]===undefined?1:PESO[a.prioridade]
      const pb = PESO[b.prioridade]===undefined?1:PESO[b.prioridade]
      return pa-pb
    })
    return { nome:nome, itens:itens, total:itens.length }
  })
  const out = []
  let ultima = null
  while (filas.some(function(f){return f.itens.length})) {
    let cands = filas.filter(function(f){return f.itens.length})
    let esc = cands.filter(function(f){return f.nome!==ultima})
    if (!esc.length) esc = cands
    esc.sort(function(a,b){
      const ra = a.itens.length/a.total, rb = b.itens.length/b.total
      if (rb!==ra) return rb-ra
      return b.itens.length-a.itens.length
    })
    const f = esc[0]
    out.push(f.itens.shift())
    ultima = f.nome
  }
  return out
}

// Quanto tempo cada sessao ocupa, conforme o nivel de encaixe.
// nivel 0 = tudo no tempo cheio. Quanto maior o nivel, mais coisa entra com meio tempo.
// fator: quanto do tempo fica na sessao encurtada (0.75 = 45 de 60 min; 0.5 = 30 de 60 min). Nunca menos de 15 min.
function minutosDaSessao(tipo, prioridade, tempo, nivel, fator){
  const meio = Math.min(tempo, Math.max(15, Math.round((tempo*(fator||0.5))/5)*5))
  if (nivel <= 0) return tempo
  const p = prioridade || 'media'
  if (nivel >= 1 && tipo === 'revisao') return meio
  if (nivel >= 2 && p === 'baixa') return meio
  if (nivel >= 3 && p === 'media' && tipo === 'questoes') return meio
  if (nivel >= 4 && !(p === 'alta' && tipo === 'teoria')) return meio
  if (nivel >= 5) return meio
  return tempo
}

// etapas de cada tema: "so revisao", "sem teoria" (ja estudado no Edital) ou o ciclo normal
function etapasDoTema(tema, cfg){
  if (tema.status==='so_revisao') return [{tipo:'revisao',off:0}]
  if (tema.semTeoria && cfg.etapas[0].tipo==='teoria' && cfg.etapas.length>1){
    const r = cfg.etapas.slice(1), base = r[0].off
    return r.map(function(e){ return { tipo:e.tipo, off:e.off-base } })
  }
  return cfg.etapas
}

// Ciclo de reforco: quando todos os temas ja passaram por teoria, questoes e revisao
// e ainda sobra tempo ate a prova, os temas voltam (na mesma ordem intercalada)
// so com QUESTOES e, depois do mesmo intervalo do aluno, REVISAO. Assim nao sobram
// dias vazios no fim do cronograma. Desligue com cfg.reforco = false.
function rodadaReforco(temas, n){
  return intercalar(temas).map(function(t){ return Object.assign({}, t, { semTeoria:true, _reforco:n }) })
}
function chaveTema(t){ return (t.disciplina||'')+'|'+(t.topico||'') }

function montarPlano(temas, cfg){
  const fila = intercalar(temas)
  const nOriginal = fila.length
  const comReforco = cfg.reforco !== false && temas.length > 0
  let rodada = 1, reforcos = 0
  const dias = cfg.dias
  const nivelCfg = cfg.nivel || 0
  // encaixe so ate a data "ateData" (exclusive): depois dela, tudo volta ao tempo cheio
  const ateData = cfg.ateData || null
  const maxSess = cfg.maxSessoes || 0
  let nivel = nivelCfg
  const tempo = cfg.tempo || 60
  const fator = cfg.fator || 0.5
  const orcamento = cfg.porDia * tempo   // minutos disponiveis por dia
  const datas = []
  let d = parseD(cfg.inicio)
  const fim = parseD(cfg.prova)
  while (d <= fim) {
    if (dias.indexOf(d.getDay()) >= 0) datas.push(new Date(d))
    d = addDays(d,1)
  }

  const calendario = []
  let pendentes = []
  let idx = 0, seq = 0
  let encurtadas = 0

  for (let i=0;i<datas.length;i++){
    const dia = datas[i]
    const sessoes = []
    let usado = 0
    nivel = (ateData && ymd(dia) >= ateData) ? 0 : nivelCfg
    const cheio = function(){ return maxSess > 0 && sessoes.length >= maxSess }

    // guarda espaco para pelo menos 1 tema novo, se ainda houver fila
    let reserva = 0
    // (no reforco nao reserva: questoes/revisao que venceram vem antes de puxar outro tema)
    if (idx < fila.length && cfg.porDia > 1 && !fila[idx]._reforco) {
      const prox = fila[idx]
      const tipoProx = etapasDoTema(prox, cfg)[0].tipo
      reserva = minutosDaSessao(tipoProx, prox.prioridade, tempo, nivel, fator)
    }

    const due = pendentes.filter(function(p){ return p.due <= dia }).sort(function(a,b){ return a.due-b.due })
    for (let j=0;j<due.length;j++){
      const p = due[j]
      if (cheio()) break
      // reforco e sobra de tempo: sempre no tempo cheio
      const min = p.tema._reforco ? tempo : minutosDaSessao(p.tipo, p.tema.prioridade, tempo, nivel, fator)
      if (usado + min > orcamento - reserva) continue
      if (min < tempo) encurtadas++
      const sp = { tipo:p.tipo, key:'s'+(seq++), origem:p.origem, disciplina:p.tema.disciplina, topico:p.tema.topico, topico_id:p.tema.topico_id, min:min }
      if (p.tema._reforco) { sp.reforco = p.tema._reforco; reforcos++ }
      sessoes.push(sp)
      usado += min
      pendentes.splice(pendentes.indexOf(p),1)
    }

    let semEspacoRodada = false
    while (true){
      if (idx >= fila.length){
        // acabaram os temas: comeca (mais) uma rodada de reforco, se ainda couber algo hoje
        if (!comReforco || semEspacoRodada) break
        rodada++
        const r = rodadaReforco(temas, rodada)
        for (let q=0;q<r.length;q++) fila.push(r[q])
        semEspacoRodada = true   // evita abrir rodadas sem fim no mesmo dia
      }
      const tema = fila[idx]
      // no reforco, pula o tema que ainda tem questoes/revisao pendentes da rodada anterior
      if (tema._reforco && pendentes.some(function(p){ return chaveTema(p.tema) === chaveTema(tema) })) { idx++; continue }
      const et = etapasDoTema(tema, cfg)
      const min = tema._reforco ? tempo : minutosDaSessao(et[0].tipo, tema.prioridade, tempo, nivel, fator)
      if (usado + min > orcamento || cheio()) break
      if (min < tempo && !tema._reforco) encurtadas++
      idx++
      semEspacoRodada = false
      const key = 's'+(seq++)
      const sess = { tipo:et[0].tipo, key:key, origem:null, disciplina:tema.disciplina, topico:tema.topico, topico_id:tema.topico_id, min:min }
      if (tema._reforco) { sess.reforco = tema._reforco; reforcos++ }
      sessoes.push(sess)
      usado += min
      for (let k=1;k<et.length;k++){
        pendentes.push({ tipo:et[k].tipo, due:addDays(dia,et[k].off), tema:tema, origem:key })
      }
    }

    if (sessoes.length) calendario.push({ data:ymd(dia), sessoes:sessoes, minutos:usado })
  }

  // Questoes/revisao que cairiam depois da prova: em vez de sumir,
  // entram na reta final (ultimos dias), sempre com o tempo reduzido.
  let retaFinal = 0, descartadas = 0
  // o que sobrou do reforco depois da prova simplesmente nao entra (o tema ja foi estudado)
  pendentes = pendentes.filter(function(p){ return !p.tema._reforco })
  if (pendentes.length && calendario.length){
    const meio = Math.min(tempo, Math.max(15, Math.round((tempo*fator)/5)*5))
    const limite = Math.round(orcamento * 1.35)   // no maximo 35% a mais num dia
    pendentes.sort(function(a,b){ return a.due-b.due })
    for (let i=0;i<pendentes.length;i++){
      const p = pendentes[i]
      const dueStr = ymd(p.due)
      let cands = calendario.filter(function(x){ return x.data >= dueStr })
      if (!cands.length) cands = calendario.slice(-Math.min(10, calendario.length))
      // reta final: no maximo o limite de sessoes do dia (ou o dobro das sessoes do aluno); vai para o dia mais leve
      const tetoSess = maxSess > 0 ? maxSess : cfg.porDia * 2
      cands = cands.filter(function(x){ return x.sessoes.length < tetoSess })
      cands.sort(function(a,b){ return a.sessoes.length-b.sessoes.length || (a.minutos||0)-(b.minutos||0) })
      const alvo = cands[0]
      if (!alvo || (alvo.minutos||0) + meio > limite) { descartadas++; continue }
      alvo.sessoes.push({ tipo:p.tipo, key:'s'+(seq++), origem:p.origem, disciplina:p.tema.disciplina, topico:p.tema.topico, topico_id:p.tema.topico_id, min:meio, reta:true })
      alvo.minutos = (alvo.minutos||0) + meio
      retaFinal++
    }
    pendentes = []
  }

  return { calendario:calendario, naoAlocados: Math.max(0, nOriginal-Math.min(idx, nOriginal)), pendentes: descartadas, retaFinal: retaFinal,
           encurtadas: encurtadas, nivel: nivelCfg, totalDatas: datas.length, reforcos: reforcos, rodadas: rodada,
           ateData: ateData, fator: fator, datas: datas.map(ymd) }
}

// Escolhe o plano com o MENOR encaixe possivel:
// 1) tenta tudo no tempo cheio; 2) se faltar espaco, sobe o nivel de encaixe so ate todos os temas caberem;
// 3) encurta so o comeco do cronograma (o minimo de dias necessario) — depois dessa data as sessoes
//    voltam ao tempo cheio; 4) limita o numero de sessoes por dia (sessoes por dia + metade), se der.
// Assim, quando o aluno marca temas como estudados e sobra tempo, as questoes e revisoes nao ficam curtas a toa.
function melhorPlano(temas, base, encaixe){
  const limite = base.porDia + Math.ceil(base.porDia/2)
  const tempo = base.tempo || 60
  const tentar = function(n, f, ate, cap){ return montarPlano(temas, Object.assign({}, base, { nivel:n, fator:f, ateData:ate||null, maxSessoes:cap?limite:0 })) }
  const semEncaixe = tentar(0, 0.5, null, false)
  if (!semEncaixe.naoAlocados || encaixe === false) return semEncaixe
    const nota = function(pl){
    // sessoes alem do limite do dia, minutos cortados e revisoes que ficaram de fora
    let corte = 0, exc = 0
    pl.calendario.forEach(function(d){ exc += Math.max(0, d.sessoes.length - limite); d.sessoes.forEach(function(x){ corte += Math.max(0, tempo - x.min) }) })
    return exc * 250 + corte + pl.pendentes * 600
  }
  let melhor = semEncaixe, melhorNota = Infinity
  const fatores = [0.75, 0.5], caps = [true, false]
  for (let c=0;c<caps.length;c++){
    for (let fi=0;fi<fatores.length;fi++){
      for (let n=1;n<=5;n++){
        const todo = tentar(n, fatores[fi], null, caps[c])
        if (todo.naoAlocados > 0) { if (melhorNota === Infinity && todo.naoAlocados < melhor.naoAlocados) melhor = todo; continue }
        // menor janela de encaixe (em dias de estudo) que ainda cabe tudo; depois dela, tempo cheio
        const datas = todo.datas
        let lo = 1, hi = datas.length, ok = todo
        while (lo < hi){
          const mid = (lo + hi) >> 1
          const t = tentar(n, fatores[fi], datas[mid], caps[c])
          if (!t.naoAlocados && t.pendentes <= todo.pendentes) { hi = mid; ok = t } else lo = mid + 1
        }
        const nt = nota(ok)
        if (nt < melhorNota) { melhor = ok; melhorNota = nt }
        break   // niveis maiores com o mesmo fator so encurtam mais
      }
    }
  }
  return melhor
}
