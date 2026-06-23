const diasSemana = ['domingo','segunda','terca','quarta','quinta','sexta','sabado']
const nomeDias = { segunda:'Segunda-feira', terca:'Terça-feira', quarta:'Quarta-feira', quinta:'Quinta-feira', sexta:'Sexta-feira', sabado:'Sábado', domingo:'Domingo' }
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
    .from('alunos')
    .select('*, concursos(*)')
    .eq('id', user.id)
    .single()

  if (!aluno) { alert('Aluno não encontrado. Contate o mentor.'); return }

  document.getElementById('nome-aluno').textContent = aluno.nome
  _concursoId = aluno.concurso_id

  carregarHoje()
}

// -------- ABAS --------
function mostrarAbaAluno(id) {
  document.querySelectorAll('.aba-conteudo').forEach(el => el.style.display = 'none')
  document.querySelectorAll('.aba-btn').forEach(el => el.classList.remove('ativa'))
  document.getElementById(id).style.display = 'block'
  event.target.classList.add('ativa')

  if (id === 'aba-semana') carregarSemana()
  if (id === 'aba-historico') carregarHistorico()
  if (id === 'aba-grafico') carregarGrafico()
}

// -------- ABA HOJE --------
async function carregarHoje() {
  const hoje = new Date()
  const diaAtual = diasSemana[hoje.getDay()]
  const dataHoje = hoje.toISOString().split('T')[0]

  const { data: cronograma } = await _supabase
    .from('cronograma')
    .select('*')
    .eq('concurso_id', _concursoId)
    .eq('dia_semana', diaAtual)
    .order('ordem')

  const divCron = document.getElementById('cronograma-hoje')
  const divForm = document.getElementById('form-registro')
  const cardRegistro = document.getElementById('card-registro')

  if (!cronograma || cronograma.length === 0) {
    divCron.innerHTML = '<p style="color:#aaa">Hoje é dia de descanso! Aproveite para revisar ou descansar. 🔋</p>'
    return
  }

  _cronogramaHoje = cronograma
  cardRegistro.style.display = 'block'

  // Busca registros já salvos hoje
  const { data: registrosHoje } = await _supabase
    .from('registros_diarios')
    .select('*')
    .eq('aluno_id', _alunoId)
    .eq('data', dataHoje)

  divCron.innerHTML = ''
  divForm.innerHTML = ''

  cronograma.forEach(item => {
    const jaRegistrado = registrosHoje?.find(r => r.disciplina === item.disciplina)

    divCron.innerHTML += `
      <div class="disciplina-card">
        <strong>${item.disciplina}</strong>
        <span>⏱ ${item.tempo_minutos} min</span>
        <span>🎯 Meta: ${item.meta_questoes} questões</span>
        ${jaRegistrado ? `<span style="color:#81c784;margin-left:auto">✅ Registrado</span>` : ''}
      </div>`

    divForm.innerHTML += `
      <div class="registro-item">
        <label><strong>${item.disciplina}</strong></label>
        <label style="display:flex;align-items:center;gap:8px;margin:8px 0">
          <input type="checkbox" id="cumpriu-${item.id}" ${jaRegistrado?.cumpriu ? 'checked' : ''}>
          Cumpri o tempo de estudo
        </label>
        <div style="display:flex;gap:8px;margin-top:6px">
          <input type="number" id="feitas-${item.id}" placeholder="Questões feitas" min="0" value="${jaRegistrado?.questoes_feitas || ''}">
          <input type="number" id="certas-${item.id}" placeholder="Acertos" min="0" value="${jaRegistrado?.questoes_certas || ''}">
        </div>
      </div>`
  })
}

async function salvarRegistro() {
  const hoje = new Date().toISOString().split('T')[0]

  const registros = _cronogramaHoje.map(item => {
    const feitas = parseInt(document.getElementById(`feitas-${item.id}`)?.value) || 0
    const certas = parseInt(document.getElementById(`certas-${item.id}`)?.value) || 0
    return {
      aluno_id: _alunoId,
      data: hoje,
      disciplina: item.disciplina,
      cumpriu: document.getElementById(`cumpriu-${item.id}`)?.checked || false,
      questoes_feitas: feitas,
      questoes_certas: certas,
      questoes_erradas: Math.max(0, feitas - certas)
    }
  })

  const { error } = await _supabase
    .from('registros_diarios')
    .upsert(registros, { onConflict: 'aluno_id,data,disciplina' })

  if (error) { alert('Erro ao salvar: ' + error.message); return }

  document.getElementById('msg-salvo').style.display = 'block'
  setTimeout(() => document.getElementById('msg-salvo').style.display = 'none', 3000)
  carregarHoje()
}

// -------- ABA SEMANA --------
async function carregarSemana() {
  const { data: itens } = await _supabase
    .from('cronograma')
    .select('*')
    .eq('concurso_id', _concursoId)

  const div = document.getElementById('cronograma-semana')
  div.innerHTML = ''

  if (!itens || itens.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum cronograma cadastrado ainda.</p>'
    return
  }

  const hoje = diasSemana[new Date().getDay()]

  diasOrdem.forEach(dia => {
    const itensDia = itens.filter(i => i.dia_semana === dia)
    if (itensDia.length === 0) return

    const isHoje = dia === hoje
    div.innerHTML += `
      <div style="margin-bottom:16px">
        <div style="color:${isHoje ? '#C9A83C' : '#aaa'};font-weight:bold;margin-bottom:8px;font-size:15px">
          ${nomeDias[dia]} ${isHoje ? '← hoje' : ''}
        </div>
        ${itensDia.map(i => `
          <div class="disciplina-card" style="${isHoje ? 'border-left:3px solid #C9A83C' : ''}">
            <strong>${i.disciplina}</strong>
            <span>⏱ ${i.tempo_minutos} min</span>
            <span>🎯 ${i.meta_questoes} questões</span>
          </div>`).join('')}
      </div>`
  })
}

// -------- ABA HISTÓRICO --------
async function carregarHistorico() {
  const quatorze = new Date()
  quatorze.setDate(quatorze.getDate() - 14)
  const dataLimite = quatorze.toISOString().split('T')[0]

  const { data: registros } = await _supabase
    .from('registros_diarios')
    .select('*')
    .eq('aluno_id', _alunoId)
    .gte('data', dataLimite)
    .order('data', { ascending: false })

  const div = document.getElementById('lista-historico')
  div.innerHTML = ''

  if (!registros || registros.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum registro encontrado nos últimos 14 dias.</p>'
    return
  }

  // Agrupa por data
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
    const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

    div.innerHTML += `
      <div style="background:#0d1b2a;border-radius:10px;padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="color:#C9A83C">${dataFormatada}</strong>
          <span style="color:#aaa;font-size:13px">${cumpridos}/${itens.length} disciplinas cumpridas</span>
        </div>
        ${itens.map(r => `
          <div style="display:flex;gap:12px;align-items:center;padding:6px 0;border-bottom:1px solid #1a2f45;flex-wrap:wrap">
            <span>${r.cumpriu ? '✅' : '❌'}</span>
            <span style="flex:1;min-width:120px">${r.disciplina}</span>
            <span style="color:#aaa;font-size:13px">${r.questoes_feitas || 0} feitas · ${r.questoes_certas || 0} certas</span>
          </div>`).join('')}
        <div style="margin-top:10px;color:#aaa;font-size:13px">
          Total: ${totalQ} questões · ${pct}% de acerto
        </div>
      </div>`
  })
}

// -------- ABA GRÁFICO --------
async function carregarGrafico() {
  const { data: registros } = await _supabase
    .from('registros_diarios')
    .select('disciplina, questoes_feitas, questoes_certas')
    .eq('aluno_id', _alunoId)

  const canvas = document.getElementById('grafico-disciplinas')
  const semDados = document.getElementById('sem-dados-grafico')

  if (!registros || registros.length === 0) {
    canvas.style.display = 'none'
    semDados.style.display = 'block'
    return
  }

  // Agrupa por disciplina
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

  const cores = percentuais.map(p =>
    p >= 70 ? '#81c784' : p >= 50 ? '#ffb74d' : '#e57373'
  )

  if (_graficoCriado) _graficoCriado.destroy()

  _graficoCriado = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '% de acerto',
        data: percentuais,
        backgroundColor: cores,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw}% de acerto (${porDisc[labels[ctx.dataIndex]].feitas} questões feitas)`
          }
        }
      },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { color: '#aaa', callback: v => v + '%' },
          grid: { color: '#1a2f45' }
        },
        x: {
          ticks: { color: '#aaa' },
          grid: { display: false }
        }
      }
    }
  })
}

// -------- SAIR --------
async function sair() {
  await _supabase.auth.signOut()
  window.location.href = 'index.html'
}

init()
