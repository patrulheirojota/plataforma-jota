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
  if (id === 'aba-avisos') carregarAvisosAluno()
}

// -------- ABA HOJE --------
async function carregarHoje() {
  const hoje = new Date()
  const diaAtual = diasSemana[hoje.getDay()]
  const dataHoje = hoje.toISOString().split('T')[0]

  // Busca plano individual do aluno
  const { data: plano } = await _supabase
    .from('plano_aluno')
    .select('*')
    .eq('aluno_id', _alunoId)
    .eq('dia_semana', diaAtual)

  // Busca revisões do dia
  const { data: revisoesDia } = await _supabase
    .from('revisoes_programadas')
    .select('*')
    .eq('aluno_id', _alunoId)
    .eq('data_revisao', dataHoje)
    .eq('concluida', false)

  const divCron = document.getElementById('cronograma-hoje')
  const divForm = document.getElementById('form-registro')
  const cardRegistro = document.getElementById('card-registro')

  const temPlano = plano && plano.length > 0
  const temRevisoes = revisoesDia && revisoesDia.length > 0

  if (!temPlano && !temRevisoes) {
    divCron.innerHTML = '<p style="color:#aaa">Hoje é dia de descanso! Aproveite para revisar ou descansar. 🔋</p>'
    return
  }

  cardRegistro.style.display = 'block'
  _cronogramaHoje = plano || []

  const { data: registrosHoje } = await _supabase
    .from('registros_diarios')
    .select('*')
    .eq('aluno_id', _alunoId)
    .eq('data', dataHoje)

  divCron.innerHTML = ''
  divForm.innerHTML = ''

  // Revisões do dia (aparecem primeiro, com destaque)
  if (temRevisoes) {
    divCron.innerHTML += `<p style="color:#C9A83C;font-weight:bold;font-size:13px;margin-bottom:8px">🔔 Revisões programadas para hoje</p>`
    revisoesDia.forEach(r => {
      const icone = r.tipo === 'exercicios' ? '📝' : '🔄'
      const label = r.tipo === 'exercicios' ? 'Exercícios de fixação' : 'Revisão'
      divCron.innerHTML += `
        <div class="disciplina-card" style="border-left:3px solid #C9A83C">
          <strong>${icone} ${label} — ${r.disciplina}</strong>
          <button class="btn-acao btn-editar" onclick="concluirRevisao('${r.id}')" style="margin-left:auto">✅ Concluir</button>
        </div>`
    })
  }

  // Plano do dia
  if (temPlano) {
    if (temRevisoes) divCron.innerHTML += `<p style="color:#aaa;font-size:13px;margin:12px 0 8px">📚 Estudos do dia</p>`
    plano.forEach(item => {
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
          <label><strong>${item.disciplina}</strong> · ${item.tempo_minutos} min</label>
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
}

async function concluirRevisao(id) {
  await _supabase.from('revisoes_programadas').update({ concluida: true }).eq('id', id)
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
// -------- AVISOS --------
async function carregarAvisosAluno() {
  const { data: aluno } = await _supabase
    .from('alunos')
    .select('concurso_id')
    .eq('id', _alunoId)
    .single()

  const { data: avisos } = await _supabase
    .from('avisos')
    .select('*')
    .eq('concurso_id', aluno.concurso_id)
    .order('criado_em', { ascending: false })

  const div = document.getElementById('lista-avisos-aluno')
  div.innerHTML = ''

  if (!avisos || avisos.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum aviso no momento. Fique atento!</p>'
    return
  }

  avisos.forEach(a => {
    const data = new Date(a.criado_em).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
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

  const { data: aluno } = await _supabase
    .from('alunos')
    .select('nome, concursos(nome)')
    .eq('id', _alunoId)
    .single()

  const { data: registros } = await _supabase
    .from('registros_diarios')
    .select('*')
    .eq('aluno_id', _alunoId)
    .order('data', { ascending: false })

  // Cabeçalho
  doc.setFillColor(26, 58, 92)
  doc.rect(0, 0, 210, 35, 'F')
  doc.setTextColor(201, 168, 60)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Patrulheiros de Elite', 14, 15)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 255, 255)
  doc.text(`Relatório de Desempenho — ${aluno.nome}`, 14, 25)
  doc.text(`Concurso: ${aluno.concursos?.nome || ''}`, 14, 32)

  // Data de geração
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 44)

  // Resumo geral
  const totalQ = registros.reduce((s, r) => s + (r.questoes_feitas || 0), 0)
  const totalC = registros.reduce((s, r) => s + (r.questoes_certas || 0), 0)
  const diasCumpridos = registros.filter(r => r.cumpriu).length
  const pctGeral = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0

  doc.setFillColor(240, 240, 240)
  doc.rect(14, 50, 182, 28, 'F')
  doc.setTextColor(26, 58, 92)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo Geral', 18, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Total de questões: ${totalQ}   |   Acertos: ${totalC}   |   Aproveitamento: ${pctGeral}%`, 18, 70)
  doc.text(`Dias com registro: ${registros.length}   |   Dias cumpridos: ${diasCumpridos}`, 18, 76)

  // Por disciplina
  const porDisc = {}
  registros.forEach(r => {
    if (!porDisc[r.disciplina]) porDisc[r.disciplina] = { feitas: 0, certas: 0 }
    porDisc[r.disciplina].feitas += r.questoes_feitas || 0
    porDisc[r.disciplina].certas += r.questoes_certas || 0
  })

  doc.setTextColor(26, 58, 92)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Desempenho por Disciplina', 14, 92)

  let y = 100
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  Object.entries(porDisc).forEach(([disc, dados]) => {
    const pct = dados.feitas > 0 ? Math.round((dados.certas / dados.feitas) * 100) : 0
    const cor = pct >= 70 ? [129, 199, 132] : pct >= 50 ? [255, 183, 77] : [229, 115, 115]

    doc.setFillColor(...cor)
    doc.rect(14, y - 4, 4, 8, 'F')
    doc.setTextColor(50, 50, 50)
    doc.text(`${disc}`, 22, y + 1)
    doc.text(`${dados.feitas} questões  |  ${dados.certas} certas  |  ${pct}% acerto`, 120, y + 1)
    y += 12

    if (y > 270) { doc.addPage(); y = 20 }
  })

  doc.save(`relatorio-${aluno.nome.replace(/ /g, '-')}.pdf`)
}
// -------- SAIR --------
async function sair() {
  await _supabase.auth.signOut()
  window.location.href = 'index.html'
}

init()
