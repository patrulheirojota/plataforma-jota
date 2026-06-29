const diasSemana = ['domingo','segunda','terca','quarta','quinta','sexta','sabado']
const diasSemanaLabel = ['D','S','T','Q','Q','S','S']
const nomeDias = { segunda:'Segunda-feira', terca:'Terca-feira', quarta:'Quarta-feira', quinta:'Quinta-feira', sexta:'Sexta-feira', sabado:'Sabado', domingo:'Domingo' }
const diasOrdem = ['segunda','terca','quarta','quinta','sexta','sabado','domingo']

let _alunoId = null
let _concursoId = null
let _cronogramaHoje = []
let _graficoCriado = null

// -------- INIT --------
async function init() {
  const { data: { user } } = await _supabase.auth.getUser()
  if (!user) { window.location.href = 'index.html'; return }
  _alunoId = user.id

  const { data: aluno } = await _supabase
    .from('alunos').select('nome').eq('id', user.id).single()

  if (!aluno) { alert('Aluno nao encontrado. Contate o mentor.'); return }
  document.getElementById('nome-aluno').textContent = aluno.nome

  const { data: vinculos } = await _supabase
    .from('aluno_concursos')
    .select('concurso_id, concursos(nome)')
    .eq('aluno_id', _alunoId)

  if (!vinculos || vinculos.length === 0) {
    document.getElementById('cronograma-hoje').innerHTML = '<p style="color:#aaa">Nenhum concurso vinculado. Contate o mentor.</p>'
    return
  }

  if (vinculos.length === 1) {
    _concursoId = vinculos[0].concurso_id
    calcularStreak()
    verificarAvisosNovos()
    carregarHoje()
  } else {
    mostrarSeletorConcurso(vinculos)
  }
}

function mostrarSeletorConcurso(vinculos) {
  const div = document.getElementById('cronograma-hoje')
  div.innerHTML = `
    <p style="color:#C9A83C;font-weight:bold;margin-bottom:12px">Selecione o concurso que deseja estudar hoje:</p>
    ${vinculos.map(v => `
      <button onclick="selecionarConcurso('${v.concurso_id}')"
        style="display:block;width:100%;text-align:left;padding:14px;margin-bottom:8px;background:#1a2f45;border:1px solid #2a4a6a;border-radius:8px;color:#fff;font-size:15px;cursor:pointer">
        ${v.concursos?.nome}
      </button>`).join('')}`
}

async function selecionarConcurso(concurso_id) {
  _concursoId = concurso_id
  calcularStreak()
  verificarAvisosNovos()
  carregarHoje()
}

// -------- ABAS --------
function mostrarAbaAluno(id) {
  document.querySelectorAll('.aba-conteudo').forEach(el => el.style.display = 'none')
  document.querySelectorAll('.aba-btn').forEach(el => el.classList.remove('ativa'))
  document.getElementById(id).style.display = 'block'
  event.target.classList.add('ativa')
  if (id === 'aba-semana') carregarSemana()
  if (id === 'aba-sequencia') carregarSequencia()
  if (id === 'aba-historico') carregarHistorico()
  if (id === 'aba-grafico') carregarGrafico()
  if (id === 'aba-meuplano') carregarMeuPlano()
  if (id === 'aba-avisos') carregarAvisosAluno()
}

// -------- ABA HOJE --------
async function carregarHoje() {
  const hoje = new Date()
  const diaAtual = diasSemana[hoje.getDay()]
  const dataHoje = hoje.toISOString().split('T')[0]

  const { data: plano } = await _supabase
    .from('plano_aluno').select('*')
    .eq('aluno_id', _alunoId).eq('concurso_id', _concursoId).eq('dia_semana', diaAtual)

  const { data: revisoesDia } = await _supabase
    .from('revisoes_programadas').select('*')
    .eq('aluno_id', _alunoId).eq('data_revisao', dataHoje).eq('concluida', false)

  const divCron = document.getElementById('cronograma-hoje')
  const divForm = document.getElementById('form-registro')
  const cardRegistro = document.getElementById('card-registro')

  const temPlano = plano && plano.length > 0
  const temRevisoes = revisoesDia && revisoesDia.length > 0

  if (!temPlano && !temRevisoes) {
    divCron.innerHTML = '<p style="color:#aaa">Hoje e dia de descanso! Aproveite para revisar ou descansar.</p>'
    cardRegistro.style.display = 'none'
    return
  }

  cardRegistro.style.display = 'block'
  _cronogramaHoje = plano || []

  const { data: registrosHoje } = await _supabase
    .from('registros_diarios').select('*')
    .eq('aluno_id', _alunoId).eq('data', dataHoje)

  divCron.innerHTML = ''
  divForm.innerHTML = ''

  if (temRevisoes) {
    divCron.innerHTML += `<p style="color:#C9A83C;font-weight:bold;font-size:13px;margin-bottom:8px">Revisoes programadas para hoje</p>`
    revisoesDia.forEach(r => {
      const label = r.tipo === 'exercicios' ? 'Exercicios de fixacao' : 'Revisao'
      divCron.innerHTML += `
        <div class="disciplina-card" style="border-left:3px solid #C9A83C">
          <strong>${label} — ${r.disciplina}</strong>
          <button class="btn-acao btn-editar" onclick="concluirRevisao('${r.id}')" style="margin-left:auto">Concluir</button>
        </div>`
    })
  }

  if (temPlano) {
    if (temRevisoes) divCron.innerHTML += `<p style="color:#aaa;font-size:13px;margin:12px 0 8px">Estudos do dia</p>`
    plano.forEach(item => {
      const jaRegistrado = registrosHoje?.find(r => r.disciplina === item.disciplina)
      divCron.innerHTML += `
        <div class="disciplina-card">
          <strong>${item.disciplina}</strong>
          <span>${item.tempo_minutos} min</span>
          <span>Meta: ${item.meta_questoes} questoes</span>
          ${jaRegistrado ? '<span style="color:#81c784;margin-left:auto">Registrado</span>' : ''}
        </div>`

      divForm.innerHTML += `
        <div class="registro-item">
          <label><strong>${item.disciplina}</strong> · ${item.tempo_minutos} min</label>
          <label style="display:flex;align-items:center;gap:8px;margin:8px 0">
            <input type="checkbox" id="cumpriu-${item.id}" ${jaRegistrado?.cumpriu ? 'checked' : ''}>
            Cumpri o tempo de estudo
          </label>
          <div style="display:flex;gap:8px;margin-top:6px">
            <input type="number" id="feitas-${item.id}" placeholder="Questoes feitas" min="0" value="${jaRegistrado?.questoes_feitas || ''}">
            <input type="number" id="certas-${item.id}" placeholder="Acertos" min="0" value="${jaRegistrado?.questoes_certas || ''}">
          </div>
        </div>`
    })
  }
}

async function concluirRevisao(id) {
  await _supabase.from('revisoes_programadas').update({ concluida: true }).eq('id', id)
  carregarHoje()
}

async function salvarRegistro() {
  const hoje = new Date().toISOString().split('T')[0]
  if (!_cronogramaHoje || _cronogramaHoje.length === 0) { alert('Nenhum item para registrar.'); return }
  const registros = _cronogramaHoje.map(item => {
    const feitas = parseInt(document.getElementById('feitas-'+item.id)?.value) || 0
    const certas = parseInt(document.getElementById('certas-'+item.id)?.value) || 0
    return {
      aluno_id: _alunoId, data: hoje, disciplina: item.disciplina,
      cumpriu: document.getElementById('cumpriu-'+item.id)?.checked || false,
      questoes_feitas: feitas, questoes_certas: certas,
      questoes_erradas: Math.max(0, feitas - certas)
    }
  })
  const { error } = await _supabase.from('registros_diarios')
    .upsert(registros, { onConflict: 'aluno_id,data,disciplina' })
  if (error) { alert('Erro ao salvar: ' + error.message); return }
  document.getElementById('msg-salvo').style.display = 'block'
  setTimeout(() => document.getElementById('msg-salvo').style.display = 'none', 3000)
  calcularStreak()
  carregarHoje()
}

// -------- ABA SEMANA --------
async function carregarSemana() {
  const { data: itens } = await _supabase
    .from('plano_aluno').select('*')
    .eq('aluno_id', _alunoId).eq('concurso_id', _concursoId)

  const div = document.getElementById('cronograma-semana')
  div.innerHTML = ''

  if (!itens || itens.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum cronograma cadastrado ainda. Contate o mentor.</p>'
    return
  }

  const hoje = diasSemana[new Date().getDay()]
  diasOrdem.forEach(dia => {
    const itensDia = itens.filter(i => i.dia_semana === dia)
    if (itensDia.length === 0) return
    const isHoje = dia === hoje
    const totalMin = itensDia.reduce((s, i) => s + i.tempo_minutos, 0)
    const horas = Math.floor(totalMin / 60)
    const min = totalMin % 60

    div.innerHTML += `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="color:${isHoje ? '#C9A83C' : '#aaa'};font-weight:bold;font-size:15px">
            ${nomeDias[dia]} ${isHoje ? '← hoje' : ''}
          </span>
          <span style="color:#aaa;font-size:12px">${horas > 0 ? horas+'h ' : ''}${min > 0 ? min+'min' : ''} total</span>
        </div>
        ${itensDia.map(i => `
          <div class="disciplina-card" style="${isHoje ? 'border-left:3px solid #C9A83C' : ''}">
            <strong>${i.disciplina}</strong>
            <span>${i.tempo_minutos} min</span>
            <span>${i.meta_questoes} questoes</span>
          </div>`).join('')}
      </div>`
  })
}

// -------- ABA SEQUENCIA (STREAK VISUAL) --------
async function calcularStreak() {
  const { data: registros } = await _supabase
    .from('registros_diarios').select('data, cumpriu')
    .eq('aluno_id', _alunoId).eq('cumpriu', true)
    .order('data', { ascending: false })

  const mini = document.getElementById('streak-mini')

  if (!registros || registros.length === 0) {
    if (mini) mini.textContent = 'Comece a registrar seus estudos!'
    window._streakData = { streak: 0, melhor: 0, total: 0, datasSet: new Set() }
    return
  }

  const datasSet = new Set(registros.map(r => r.data))
  const datas = [...datasSet].sort((a, b) => b.localeCompare(a))

  // Calcula streak atual
  let streak = 0
  let dataRef = new Date(); dataRef.setHours(0,0,0,0)
  for (const data of datas) {
    const d = new Date(data + 'T12:00:00')
    const diff = Math.round((dataRef - d) / (1000 * 60 * 60 * 24))
    if (diff <= 1) { streak++; dataRef = d } else break
  }

  // Calcula melhor streak
  let melhor = 0, atual = 1
  const datasOrdem = [...datasSet].sort()
  for (let i = 1; i < datasOrdem.length; i++) {
    const d1 = new Date(datasOrdem[i-1] + 'T12:00:00')
    const d2 = new Date(datasOrdem[i] + 'T12:00:00')
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
    if (diff === 1) { atual++; melhor = Math.max(melhor, atual) }
    else { atual = 1 }
  }
  melhor = Math.max(melhor, streak)

  window._streakData = { streak, melhor, total: datasSet.size, datasSet }

  // Mini display no header
  if (mini) {
    if (streak === 0) mini.textContent = 'Bora comecar sua sequencia! 💪'
    else if (streak < 7) mini.textContent = '🔥 ' + streak + ' dias seguidos'
    else if (streak < 14) mini.textContent = '🔥🔥 ' + streak + ' dias — disciplina de policial!'
    else mini.textContent = '🔥🔥🔥 ' + streak + ' dias — ELITE!'
  }
}

async function carregarSequencia() {
  if (!window._streakData) await calcularStreak()
  const { streak, melhor, total, datasSet } = window._streakData || { streak:0, melhor:0, total:0, datasSet: new Set() }

  const hoje = new Date()
  const diaHoje = hoje.getDay()

  // Gera os 7 dias da semana atual (segunda a domingo)
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - ((diaHoje === 0 ? 7 : diaHoje) - 1))

  const diasSemanaAtual = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana)
    d.setDate(inicioSemana.getDate() + i)
    return d
  })

  // Nivel baseado no streak
  let nivel, nivelCor, proximoMeta
  if (streak >= 30) { nivel = 'LENDA'; nivelCor = '#9b59b6'; proximoMeta = null }
  else if (streak >= 14) { nivel = 'ELITE'; nivelCor = '#C9A83C'; proximoMeta = 30 }
  else if (streak >= 7) { nivel = 'VETERANO'; nivelCor = '#4a8ab5'; proximoMeta = 14 }
  else if (streak >= 3) { nivel = 'DEDICADO'; nivelCor = '#81c784'; proximoMeta = 7 }
  else { nivel = 'RECRUTA'; nivelCor = '#aaa'; proximoMeta = 3 }

  const progressoPct = proximoMeta ? Math.round((streak / proximoMeta) * 100) : 100

  // Calcula taxa semanal
  let diasCumpridosSemana = 0
  diasSemanaAtual.forEach(d => {
    const key = d.toISOString().split('T')[0]
    if (datasSet && datasSet.has(key)) diasCumpridosSemana++
  })
  const taxaSemanal = Math.round((diasCumpridosSemana / 7) * 100)

  const container = document.getElementById('streak-card-container')

  const iconeStreak = streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : streak >= 3 ? '🔥' : '💤'

  container.innerHTML = `
    <div class="streak-card">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:44px;margin-bottom:6px">${iconeStreak}</div>
        <div class="streak-numero">${streak}</div>
        <div style="color:#fff;font-size:16px;font-weight:bold;margin-top:4px">Dias de Sequencia</div>
        <div style="margin-top:8px">
          <span class="nivel-badge" style="background:${nivelCor}22;color:${nivelCor};border:1px solid ${nivelCor}">${nivel}</span>
        </div>
        ${proximoMeta ? `
          <div style="margin-top:10px">
            <div style="color:#aaa;font-size:12px;margin-bottom:6px">Meta: ${proximoMeta} dias para proximo nivel</div>
            <div style="background:#0d1b2a;border-radius:20px;height:8px;overflow:hidden">
              <div style="background:${nivelCor};height:100%;width:${progressoPct}%;border-radius:20px;transition:width 1s"></div>
            </div>
            <div style="color:#aaa;font-size:11px;margin-top:4px">${streak}/${proximoMeta} dias</div>
          </div>` : `<div style="color:#C9A83C;font-size:13px;margin-top:8px">Voce atingiu o nivel maximo!</div>`}
      </div>

      <div class="streak-dias-row">
        ${diasSemanaAtual.map((d, i) => {
          const key = d.toISOString().split('T')[0]
          const hojeKey = hoje.toISOString().split('T')[0]
          const cumpriu = datasSet && datasSet.has(key)
          const isHoje = key === hojeKey
          const futuro = d > hoje && !isHoje
          let classe, icone
          if (cumpriu) { classe = 'cumpriu'; icone = '✓' }
          else if (isHoje) { classe = 'hoje'; icone = '•' }
          else if (futuro) { classe = 'futuro'; icone = '○' }
          else { classe = 'perdeu'; icone = '✕' }
          const labels = ['S','T','Q','Q','S','S','D']
          return `
            <div class="streak-dia">
              <div class="streak-circulo ${classe}">${icone}</div>
              <span class="streak-label ${isHoje ? 'hoje' : ''}">${labels[i]}</span>
            </div>`
        }).join('')}
      </div>

      <div class="streak-stats">
        <div class="streak-stat">
          <div class="streak-stat-num" style="color:#C9A83C">${streak}</div>
          <div class="streak-stat-label">Sequencia atual</div>
        </div>
        <div class="streak-divider"></div>
        <div class="streak-stat">
          <div class="streak-stat-num" style="color:#81c784">${melhor}</div>
          <div class="streak-stat-label">Melhor sequencia</div>
        </div>
        <div class="streak-divider"></div>
        <div class="streak-stat">
          <div class="streak-stat-num" style="color:#4a8ab5">${taxaSemanal}%</div>
          <div class="streak-stat-label">Taxa semanal</div>
        </div>
        <div class="streak-divider"></div>
        <div class="streak-stat">
          <div class="streak-stat-num" style="color:#aaa">${total}</div>
          <div class="streak-stat-label">Total de dias</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Ultimas 4 semanas</h3>
      <div id="calendario-mensal"></div>
    </div>`

  renderizarCalendarioMensal(datasSet)
}

function renderizarCalendarioMensal(datasSet) {
  const div = document.getElementById('calendario-mensal')
  div.innerHTML = ''

  const hoje = new Date()
  const semanas = []

  // Gera 4 semanas para tras
  for (let s = 3; s >= 0; s--) {
    const semana = []
    for (let d = 0; d < 7; d++) {
      const dia = new Date(hoje)
      dia.setDate(hoje.getDate() - (s * 7) - (hoje.getDay() === 0 ? 7 : hoje.getDay()) + 1 + d)
      semana.push(dia)
    }
    semanas.push(semana)
  }

  const labels = ['S','T','Q','Q','S','S','D']

  div.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:8px">
      ${labels.map(l => `<div style="text-align:center;color:#aaa;font-size:11px;font-weight:bold">${l}</div>`).join('')}
    </div>
    ${semanas.map(semana => `
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px">
        ${semana.map(d => {
          const key = d.toISOString().split('T')[0]
          const hojeKey = hoje.toISOString().split('T')[0]
          const cumpriu = datasSet && datasSet.has(key)
          const futuro = d > hoje
          const isHoje = key === hojeKey
          let bg, cor
          if (futuro) { bg = 'transparent'; cor = '#2a4a6a' }
          else if (cumpriu) { bg = '#C9A83C'; cor = '#0d1b2a' }
          else if (isHoje) { bg = '#1a3a5c'; cor = '#4a8ab5' }
          else { bg = '#1a1a2a'; cor = '#333' }
          return `<div style="aspect-ratio:1;border-radius:6px;background:${bg};border:1px solid ${cor};display:flex;align-items:center;justify-content:center;font-size:11px;color:${cumpriu ? '#0d1b2a' : cor};font-weight:${cumpriu ? 'bold' : 'normal'}" title="${key}">${d.getDate()}</div>`
        }).join('')}
      </div>`).join('')}
    <div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:#aaa">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:14px;height:14px;border-radius:3px;background:#C9A83C"></div> Estudou
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:14px;height:14px;border-radius:3px;background:#1a1a2a;border:1px solid #333"></div> Nao estudou
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:14px;height:14px;border-radius:3px;background:#1a3a5c;border:1px solid #4a8ab5"></div> Hoje
      </div>
    </div>`
}

// -------- ABA HISTORICO --------
async function carregarHistorico() {
  const quatorze = new Date()
  quatorze.setDate(quatorze.getDate() - 14)
  const dataLimite = quatorze.toISOString().split('T')[0]

  const { data: registros } = await _supabase
    .from('registros_diarios').select('*')
    .eq('aluno_id', _alunoId).gte('data', dataLimite)
    .order('data', { ascending: false })

  const div = document.getElementById('lista-historico')
  div.innerHTML = ''

  if (!registros || registros.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum registro encontrado nos ultimos 14 dias.</p>'
    return
  }

  const porData = {}
  registros.forEach(r => {
    if (!porData[r.data]) porData[r.data] = []
    porData[r.data].push(r)
  })

  Object.keys(porData).sort((a, b) => b.localeCompare(a)).forEach(data => {
    const itens = porData[data]
    const totalQ = itens.reduce((s, r) => s + (r.questoes_feitas || 0), 0)
    const totalC = itens.reduce((s, r) => s + (r.questoes_certas || 0), 0)
    const cumpridos = itens.filter(r => r.cumpriu).length
    const pct = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0
    const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit' })

    div.innerHTML += `
      <div style="background:#0d1b2a;border-radius:10px;padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="color:#C9A83C">${dataFmt}</strong>
          <span style="color:#aaa;font-size:13px">${cumpridos}/${itens.length} cumpridas</span>
        </div>
        ${itens.map(r => `
          <div style="display:flex;gap:12px;align-items:center;padding:6px 0;border-bottom:1px solid #1a2f45;flex-wrap:wrap">
            <span>${r.cumpriu ? 'OK' : 'X'}</span>
            <span style="flex:1;min-width:120px">${r.disciplina}</span>
            <span style="color:#aaa;font-size:13px">${r.questoes_feitas || 0} feitas · ${r.questoes_certas || 0} certas</span>
          </div>`).join('')}
        <div style="margin-top:10px;color:#aaa;font-size:13px">
          Total: ${totalQ} questoes · ${pct}% de acerto
        </div>
      </div>`
  })
}

// -------- ABA GRAFICO --------
async function carregarGrafico() {
  const { data: registros } = await _supabase
    .from('registros_diarios').select('disciplina, questoes_feitas, questoes_certas')
    .eq('aluno_id', _alunoId)

  const canvas = document.getElementById('grafico-disciplinas')
  const semDados = document.getElementById('sem-dados-grafico')

  if (!registros || registros.length === 0) {
    canvas.style.display = 'none'; semDados.style.display = 'block'; return
  }

  const porDisc = {}
  registros.forEach(r => {
    if (!porDisc[r.disciplina]) porDisc[r.disciplina] = { feitas: 0, certas: 0 }
    porDisc[r.disciplina].feitas += r.questoes_feitas || 0
    porDisc[r.disciplina].certas += r.questoes_certas || 0
  })

  const labels = Object.keys(porDisc)
  const percentuais = labels.map(d => {
    const { feitas, certas } = porDisc[d]
    return feitas > 0 ? Math.round((certas / feitas) * 100) : 0
  })
  const cores = percentuais.map(p => p >= 70 ? '#81c784' : p >= 50 ? '#ffb74d' : '#e57373')

  if (_graficoCriado) _graficoCriado.destroy()
  _graficoCriado = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: '% de acerto', data: percentuais, backgroundColor: cores, borderRadius: 6 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { color: '#aaa', callback: v => v + '%' }, grid: { color: '#1a2f45' } },
        x: { ticks: { color: '#aaa' }, grid: { display: false } }
      }
    }
  })
}

// -------- ABA MEU PLANO --------
async function carregarMeuPlano() {
  const { data: itens } = await _supabase
    .from('plano_aluno').select('*')
    .eq('aluno_id', _alunoId).eq('concurso_id', _concursoId)

  const div = document.getElementById('meu-plano-container')
  const btnSalvar = document.getElementById('btn-salvar-plano')
  div.innerHTML = ''

  if (!itens || itens.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum plano cadastrado ainda. Aguarde seu mentor configurar seu cronograma.</p>'
    return
  }

  btnSalvar.style.display = 'block'
  itens.sort((a,b) => diasOrdem.indexOf(a.dia_semana) - diasOrdem.indexOf(b.dia_semana))

  const porDia = {}
  itens.forEach(i => { if (!porDia[i.dia_semana]) porDia[i.dia_semana]=[]; porDia[i.dia_semana].push(i) })

  Object.keys(porDia).sort((a,b) => diasOrdem.indexOf(a) - diasOrdem.indexOf(b)).forEach(dia => {
    const itensDia = porDia[dia]
    div.innerHTML += `<div style="margin-bottom:18px">
      <strong style="color:#C9A83C;font-size:14px">${nomeDias[dia]}</strong>
      ${itensDia.map(i => `
        <div style="background:#0d1b2a;border-radius:8px;padding:12px;margin-top:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span style="font-size:14px;font-weight:bold;flex:1">${i.disciplina}</span>
            ${i.tempo_personalizado ? '<span style="color:#C9A83C;font-size:11px;padding:2px 8px;border:1px solid #C9A83C;border-radius:10px">Personalizado</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
            <label style="color:#aaa;font-size:13px;min-width:100px">Tempo de estudo:</label>
            <input type="range" id="range-${i.id}" min="15" max="240" step="15" value="${i.tempo_minutos}"
              oninput="document.getElementById('val-${i.id}').textContent=this.value+' min'"
              style="flex:1;min-width:120px">
            <span id="val-${i.id}" style="color:#C9A83C;font-weight:bold;min-width:60px">${i.tempo_minutos} min</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
            <label style="color:#aaa;font-size:13px;min-width:100px">Meta de questoes:</label>
            <input type="number" id="quest-${i.id}" value="${i.meta_questoes}" min="0" max="200"
              style="width:90px;padding:6px;border-radius:6px;border:1px solid #2a4a6a;background:#1a2f45;color:#fff">
          </div>
        </div>`).join('')}
    </div>`
  })

  window._meuPlanoItens = itens
}

async function salvarMeuPlano() {
  const itens = window._meuPlanoItens
  if (!itens) return
  const msg = document.getElementById('msg-meu-plano')
  msg.style.display = 'block'
  msg.style.color = '#aaa'
  msg.textContent = 'Salvando...'

  let erros = 0
  for (const item of itens) {
    const novoTempo = parseInt(document.getElementById('range-'+item.id)?.value) || item.tempo_minutos
    const novasMeta = parseInt(document.getElementById('quest-'+item.id)?.value) || item.meta_questoes
    const personalizado = novoTempo !== item.tempo_minutos || novasMeta !== item.meta_questoes
    const { error } = await _supabase.from('plano_aluno')
      .update({ tempo_minutos: novoTempo, meta_questoes: novasMeta, tempo_personalizado: personalizado })
      .eq('id', item.id)
    if (error) erros++
  }

  if (erros > 0) {
    msg.style.color = '#e57373'
    msg.textContent = 'Erro ao salvar alguns itens. Tente novamente.'
  } else {
    msg.style.color = '#81c784'
    msg.textContent = 'Plano atualizado com sucesso! Seu mentor pode visualizar suas alteracoes.'
    await carregarMeuPlano()
    await carregarHoje()
  }
}

// -------- AVISOS --------
async function verificarAvisosNovos() {
  const { data: avisos } = await _supabase.from('avisos').select('id').eq('concurso_id', _concursoId)
  if (avisos && avisos.length > 0) {
    const badge = document.getElementById('badge-avisos')
    if (badge) { badge.style.display = 'inline'; badge.textContent = avisos.length }
  }
}

async function carregarAvisosAluno() {
  const { data: avisos } = await _supabase.from('avisos').select('*')
    .eq('concurso_id', _concursoId).order('criado_em', { ascending: false })
  const badge = document.getElementById('badge-avisos')
  if (badge) badge.style.display = 'none'
  const div = document.getElementById('lista-avisos-aluno')
  div.innerHTML = ''
  if (!avisos || avisos.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum aviso no momento.</p>'; return
  }
  avisos.forEach(a => {
    const data = new Date(a.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
    div.innerHTML += `
      <div style="background:#0d1b2a;border-left:4px solid #C9A83C;border-radius:8px;padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="color:#C9A83C">${a.titulo}</strong>
          <span style="color:#aaa;font-size:12px">${data}</span>
        </div>
        <p style="color:#ddd;font-size:14px;margin:0;line-height:1.5">${a.mensagem}</p>
      </div>`
  })
}

// -------- PDF --------
async function exportarPDF() {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  const { data: aluno } = await _supabase.from('alunos').select('nome, concursos(nome)').eq('id', _alunoId).single()
  const { data: registros } = await _supabase.from('registros_diarios').select('*').eq('aluno_id', _alunoId).order('data', { ascending: false })
  doc.setFillColor(26, 58, 92); doc.rect(0, 0, 210, 35, 'F')
  doc.setTextColor(201, 168, 60); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('Patrulheiros de Elite', 14, 15)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255)
  doc.text('Relatorio de Desempenho - ' + aluno.nome, 14, 25)
  doc.text('Concurso: ' + (aluno.concursos?.nome || ''), 14, 32)
  doc.setTextColor(100, 100, 100); doc.setFontSize(9)
  doc.text('Gerado em: ' + new Date().toLocaleDateString('pt-BR'), 14, 44)
  const totalQ = registros.reduce((s, r) => s + (r.questoes_feitas || 0), 0)
  const totalC = registros.reduce((s, r) => s + (r.questoes_certas || 0), 0)
  const diasCumpridos = registros.filter(r => r.cumpriu).length
  const pctGeral = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0
  doc.setFillColor(240, 240, 240); doc.rect(14, 50, 182, 28, 'F')
  doc.setTextColor(26, 58, 92); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('Resumo Geral', 18, 60)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text('Total de questoes: ' + totalQ + '   |   Acertos: ' + totalC + '   |   Aproveitamento: ' + pctGeral + '%', 18, 70)
  doc.text('Dias com registro: ' + registros.length + '   |   Dias cumpridos: ' + diasCumpridos, 18, 76)
  const porDisc = {}
  registros.forEach(r => {
    if (!porDisc[r.disciplina]) porDisc[r.disciplina] = { feitas: 0, certas: 0 }
    porDisc[r.disciplina].feitas += r.questoes_feitas || 0
    porDisc[r.disciplina].certas += r.questoes_certas || 0
  })
  doc.setTextColor(26, 58, 92); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('Desempenho por Disciplina', 14, 92)
  let y = 100; doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  Object.entries(porDisc).forEach(([disc, dados]) => {
    const pct = dados.feitas > 0 ? Math.round((dados.certas / dados.feitas) * 100) : 0
    const cor = pct >= 70 ? [129, 199, 132] : pct >= 50 ? [255, 183, 77] : [229, 115, 115]
    doc.setFillColor(...cor); doc.rect(14, y - 4, 4, 8, 'F')
    doc.setTextColor(50, 50, 50)
    doc.text(disc, 22, y + 1)
    doc.text(dados.feitas + ' questoes  |  ' + dados.certas + ' certas  |  ' + pct + '% acerto', 120, y + 1)
    y += 12; if (y > 270) { doc.addPage(); y = 20 }
  })
  doc.save('relatorio-' + aluno.nome.replace(/ /g, '-') + '.pdf')
}

// -------- SAIR --------
async function sair() {
  await _supabase.auth.signOut()
  window.location.href = 'index.html'
}

init()
