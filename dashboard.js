const diasSemana = ['domingo','segunda','terca','quarta','quinta','sexta','sabado']

async function init() {
  // Verifica se está logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { window.location.href = 'index.html'; return }

  // Busca dados do aluno
  const { data: aluno } = await supabase
    .from('alunos')
    .select('*, concursos(*)')
    .eq('id', user.id)
    .single()

  document.getElementById('nome-aluno').textContent = aluno.nome

  // Dia da semana atual
  const hoje = new Date()
  const diaAtual = diasSemana[hoje.getDay()]

  // Busca cronograma do dia
  const { data: cronograma } = await supabase
    .from('cronograma')
    .select('*')
    .eq('concurso_id', aluno.concurso_id)
    .eq('dia_semana', diaAtual)
    .order('ordem')

  // Monta a tela
  const div = document.getElementById('cronograma-hoje')
  const formDiv = document.getElementById('form-registro')

  if (!cronograma || cronograma.length === 0) {
    div.innerHTML = '<p>Hoje é dia de descanso! 🔋</p>'
    return
  }

  cronograma.forEach(item => {
    // Exibe disciplina
    div.innerHTML += `
      <div class="disciplina-card">
        <strong>${item.disciplina}</strong>
        <span>⏱ ${item.tempo_minutos} min</span>
        <span>🎯 Meta: ${item.meta_questoes} questões</span>
      </div>`

    // Formulário de registro
    formDiv.innerHTML += `
      <div class="registro-item">
        <label><strong>${item.disciplina}</strong></label>
        <label><input type="checkbox" id="cumpriu-${item.id}"> Cumpri o estudo</label>
        <div style="display:flex;gap:8px;margin-top:6px">
          <input type="number" id="feitas-${item.id}" placeholder="Questões feitas" min="0">
          <input type="number" id="certas-${item.id}" placeholder="Acertos" min="0">
        </div>
      </div>`
  })

  window._cronograma = cronograma
  window._alunoId = user.id
  window._hoje = hoje.toISOString().split('T')[0]
}

async function salvarRegistro() {
  const registros = window._cronograma.map(item => {
    const feitas = parseInt(document.getElementById(`feitas-${item.id}`)?.value) || 0
    const certas = parseInt(document.getElementById(`certas-${item.id}`)?.value) || 0
    return {
      aluno_id: window._alunoId,
      data: window._hoje,
      disciplina: item.disciplina,
      cumpriu: document.getElementById(`cumpriu-${item.id}`)?.checked || false,
      questoes_feitas: feitas,
      questoes_certas: certas,
      questoes_erradas: feitas - certas
    }
  })

  const { error } = await supabase.from('registros_diarios').upsert(registros)

  if (error) alert('Erro ao salvar. Tente novamente.')
  else alert('✅ Desempenho salvo com sucesso!')
}

async function sair() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}

init()
