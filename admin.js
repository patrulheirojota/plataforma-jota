const diasOrdem = { segunda:1, terca:2, quarta:3, quinta:4, sexta:5, sabado:6, domingo:7 }
const nomeDias = { segunda:'Segunda', terca:'Terça', quarta:'Quarta', quinta:'Quinta', sexta:'Sexta', sabado:'Sábado', domingo:'Domingo' }

// ---------- LOGIN ----------
async function loginAdmin() {
  const email = document.getElementById('admin-email').value
  const senha = document.getElementById('admin-senha').value

  const { data, error } = await _supabase.auth.signInWithPassword({ email, password: senha })

  if (error) {
    document.getElementById('msg-erro-admin').style.display = 'block'
    document.getElementById('msg-erro-admin').textContent = 'E-mail ou senha incorretos.'
    return
  }

  document.getElementById('tela-login').style.display = 'none'
  document.getElementById('painel-admin').style.display = 'block'
  carregarConcursos()
}

async function sairAdmin() {
  await _supabase.auth.signOut()
  location.reload()
}

// Verifica se já está logado ao abrir a página
async function verificarSessao() {
  const { data: { user } } = await _supabase.auth.getUser()
  if (user) {
    document.getElementById('tela-login').style.display = 'none'
    document.getElementById('painel-admin').style.display = 'block'
    carregarConcursos()
  }
}
verificarSessao()

// ---------- ABAS ----------
function mostrarAba(id) {
  document.querySelectorAll('.aba-conteudo').forEach(el => el.style.display = 'none')
  document.querySelectorAll('.aba-btn').forEach(el => el.classList.remove('ativa'))
  document.getElementById(id).style.display = 'block'
  event.target.classList.add('ativa')

 if (id === 'aba-alunos') carregarAlunos()
  if (id === 'aba-cronograma') carregarSelectsCronograma()
  if (id === 'aba-desempenho') carregarSelectDesempenho()
  if (id === 'aba-avisos') carregarSelectsAvisos()
}

// ---------- CONCURSOS ----------
async function criarConcurso() {
  const nome = document.getElementById('novo-concurso-nome').value
  const banca = document.getElementById('novo-concurso-banca').value
  const data_prova = document.getElementById('novo-concurso-data').value

  if (!nome) { alert('Digite o nome do concurso'); return }

  const { error } = await _supabase.from('concursos').insert({ nome, banca, data_prova: data_prova || null })

  if (error) { alert('Erro ao cadastrar: ' + error.message); return }

  document.getElementById('novo-concurso-nome').value = ''
  document.getElementById('novo-concurso-banca').value = ''
  document.getElementById('novo-concurso-data').value = ''
  carregarConcursos()
}

async function carregarConcursos() {
  const { data: concursos } = await _supabase.from('concursos').select('*').order('criado_em', { ascending: false })

  // Lista visual
  const div = document.getElementById('lista-concursos')
  div.innerHTML = ''
  concursos.forEach(c => {
    div.innerHTML += `
      <div class="item-lista">
        <strong>${c.nome}</strong>
        <span>${c.banca || ''}</span>
        <span>${c.data_prova ? new Date(c.data_prova).toLocaleDateString('pt-BR') : ''}</span>
      </div>`
  })

  // Preenche o select de "novo aluno"
  const select = document.getElementById('novo-aluno-concurso')
  select.innerHTML = '<option value="">Selecione o concurso</option>'
  concursos.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nome}</option>`
  })

  window._concursos = concursos
}

// ---------- ALUNOS ----------
async function criarAluno() {
  const nome = document.getElementById('novo-aluno-nome').value
  const email = document.getElementById('novo-aluno-email').value
  const senha = document.getElementById('novo-aluno-senha').value
  const concurso_id = document.getElementById('novo-aluno-concurso').value

  if (!nome || !email || !senha || !concurso_id) {
    alert('Preencha todos os campos, incluindo o concurso.')
    return
  }
  if (senha.length < 6) {
    alert('A senha precisa ter pelo menos 6 caracteres.')
    return
  }

  // Cria o login do aluno
  const { data, error } = await _supabase.auth.signUp({ email, password: senha })

  if (error) {
    document.getElementById('msg-aluno').style.color = '#e57373'
    document.getElementById('msg-aluno').textContent = 'Erro: ' + error.message
    return
  }

  // Cria o registro na tabela alunos
  const { error: erroAluno } = await _supabase.from('alunos').insert({
    id: data.user.id,
    nome: nome,
    email: email,
    concurso_id: concurso_id
  })

  if (erroAluno) {
    document.getElementById('msg-aluno').style.color = '#e57373'
    document.getElementById('msg-aluno').textContent = 'Login criado, mas erro ao salvar dados: ' + erroAluno.message
    return
  }

  document.getElementById('msg-aluno').style.color = '#81c784'
  document.getElementById('msg-aluno').textContent = `✅ Aluno ${nome} cadastrado! Login: ${email} / Senha: ${senha}`

  document.getElementById('novo-aluno-nome').value = ''
  document.getElementById('novo-aluno-email').value = ''
  document.getElementById('novo-aluno-senha').value = ''
  carregarAlunos()
}

async function carregarAlunos() {
  const { data: alunos } = await _supabase
    .from('alunos')
    .select('*, concursos(nome)')
    .order('criado_em', { ascending: false })

  const div = document.getElementById('lista-alunos')
  div.innerHTML = ''
  alunos.forEach(a => {
    div.innerHTML += `
      <div class="item-lista">
        <strong>${a.nome}</strong>
        <span>${a.email}</span>
        <span>${a.concursos?.nome || 'Sem concurso'}</span>
      </div>`
  })
}

// ---------- CRONOGRAMA INDIVIDUAL ----------
function carregarSelectsCronograma() {
  const select = document.getElementById('cron-aluno')
  select.innerHTML = '<option value="">Selecione o aluno</option>'
  // Carrega alunos do array já em memória
  carregarAlunosParaCronograma()
}

async function carregarAlunosParaCronograma() {
  const { data: alunos } = await _supabase
    .from('alunos')
    .select('id, nome')
    .order('nome')

  const select = document.getElementById('cron-aluno')
  select.innerHTML = '<option value="">Selecione o aluno</option>'
  alunos.forEach(a => {
    select.innerHTML += `<option value="${a.id}">${a.nome}</option>`
  })
}

async function carregarPlanoAluno() {
  const aluno_id = document.getElementById('cron-aluno').value
  if (!aluno_id) {
    document.getElementById('form-plano').style.display = 'none'
    document.getElementById('card-plano-atual').style.display = 'none'
    document.getElementById('card-revisoes').style.display = 'none'
    return
  }

  document.getElementById('form-plano').style.display = 'block'
  document.getElementById('card-plano-atual').style.display = 'block'
  document.getElementById('card-revisoes').style.display = 'block'

  await renderizarPlano(aluno_id)
  await renderizarRevisoes(aluno_id)
}

async function renderizarPlano(aluno_id) {
  const diasOrdemLocal = { segunda:1, terca:2, quarta:3, quinta:4, sexta:5, sabado:6, domingo:7 }
  const nomeDiasLocal = { segunda:'Segunda', terca:'Terça', quarta:'Quarta', quinta:'Quinta', sexta:'Sexta', sabado:'Sábado', domingo:'Domingo' }

  const { data: itens } = await _supabase
    .from('plano_aluno')
    .select('*')
    .eq('aluno_id', aluno_id)

  itens.sort((a, b) => diasOrdemLocal[a.dia_semana] - diasOrdemLocal[b.dia_semana])

  const div = document.getElementById('lista-plano-aluno')
  div.innerHTML = ''

  if (!itens || itens.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhuma disciplina no plano ainda.</p>'
    return
  }

  itens.forEach(i => {
    div.innerHTML += `
      <div class="item-lista">
        <strong>${nomeDiasLocal[i.dia_semana]}</strong>
        <span>${i.disciplina}</span>
        <span>⏱ ${i.tempo_minutos} min</span>
        <span>🎯 ${i.meta_questoes} questões</span>
        <button class="btn-acao btn-excluir" onclick="excluirItemPlano('${i.id}','${aluno_id}')">🗑️</button>
      </div>`
  })
}

async function renderizarRevisoes(aluno_id) {
  const { data: revisoes } = await _supabase
    .from('revisoes_programadas')
    .select('*')
    .eq('aluno_id', aluno_id)
    .eq('concluida', false)
    .order('data_revisao')

  const div = document.getElementById('lista-revisoes-admin')
  div.innerHTML = ''

  if (!revisoes || revisoes.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhuma revisão programada.</p>'
    return
  }

  revisoes.forEach(r => {
    const data = new Date(r.data_revisao + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
    const icone = r.tipo === 'exercicios' ? '📝' : '🔄'
    const label = r.tipo === 'exercicios' ? 'Exercícios' : 'Revisão'
    div.innerHTML += `
      <div class="item-lista">
        <span>${icone} ${label}</span>
        <strong>${r.disciplina}</strong>
        <span style="color:#C9A83C">${data}</span>
        <button class="btn-acao btn-excluir" onclick="excluirRevisao('${r.id}','${aluno_id}')">🗑️</button>
      </div>`
  })
}

async function adicionarAoPlano() {
  const aluno_id = document.getElementById('cron-aluno').value
  const disciplina = document.getElementById('cron-disciplina').value
  const dia_semana = document.getElementById('cron-dia').value
  const tempo_minutos = parseInt(document.getElementById('cron-tempo').value)
  const meta_questoes = parseInt(document.getElementById('cron-questoes').value) || 30
  const usarRevisao = document.getElementById('usar-revisao').checked
  const diasExercicios = parseInt(document.getElementById('dias-exercicios').value) || 5
  const diasRevisao = parseInt(document.getElementById('dias-revisao').value) || 12

  if (!disciplina || !tempo_minutos) {
    alert('Preencha a disciplina e o tempo de estudo.')
    return
  }

  // Adiciona ao plano
  const { error } = await _supabase.from('plano_aluno').insert({
    aluno_id, disciplina, dia_semana, tempo_minutos, meta_questoes
  })

  if (error) { alert('Erro: ' + error.message); return }

  // Gera revisões espaçadas se ativado
  if (usarRevisao) {
    const hoje = new Date()

    const dataExercicios = new Date(hoje)
    dataExercicios.setDate(hoje.getDate() + diasExercicios)

    const dataRevisao = new Date(hoje)
    dataRevisao.setDate(hoje.getDate() + diasRevisao)

    await _supabase.from('revisoes_programadas').insert([
      {
        aluno_id,
        disciplina,
        data_revisao: dataExercicios.toISOString().split('T')[0],
        tipo: 'exercicios'
      },
      {
        aluno_id,
        disciplina,
        data_revisao: dataRevisao.toISOString().split('T')[0],
        tipo: 'revisao'
      }
    ])
  }

  document.getElementById('cron-disciplina').value = ''
  document.getElementById('cron-tempo').value = ''
  document.getElementById('cron-questoes').value = '30'

  alert(`✅ ${disciplina} adicionada ao plano!${usarRevisao ? `\n📝 Exercícios programados para daqui ${diasExercicios} dias\n🔄 Revisão programada para daqui ${diasRevisao} dias` : ''}`)
  renderizarPlano(aluno_id)
  renderizarRevisoes(aluno_id)
}

async function excluirItemPlano(id, aluno_id) {
  if (!confirm('Remover esta disciplina do plano?')) return
  await _supabase.from('plano_aluno').delete().eq('id', id)
  renderizarPlano(aluno_id)
}

async function excluirRevisao(id, aluno_id) {
  if (!confirm('Cancelar esta revisão?')) return
  await _supabase.from('revisoes_programadas').delete().eq('id', id)
  renderizarRevisoes(aluno_id)
}
// ---------- DESEMPENHO ----------
function carregarSelectDesempenho() {
  const select = document.getElementById('filtro-desempenho-concurso')
  select.innerHTML = '<option value="">Selecione o concurso</option>'
  window._concursos.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nome}</option>`
  })
}

async function carregarDesempenho() {
  const concurso_id = document.getElementById('filtro-desempenho-concurso').value
  if (!concurso_id) return

  // Busca alunos daquele concurso
  const { data: alunos } = await _supabase
    .from('alunos')
    .select('*')
    .eq('concurso_id', concurso_id)

  if (!alunos || alunos.length === 0) {
    document.getElementById('lista-desempenho').innerHTML = '<p>Nenhum aluno cadastrado nesse concurso ainda.</p>'
    return
  }

  // Data de 7 dias atrás
  const seteDiasAtras = new Date()
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
  const dataLimite = seteDiasAtras.toISOString().split('T')[0]

  const div = document.getElementById('lista-desempenho')
  div.innerHTML = '<p>Carregando...</p>'

  const linhas = []

  for (const aluno of alunos) {
    const { data: registros } = await _supabase
      .from('registros_diarios')
      .select('*')
      .eq('aluno_id', aluno.id)
      .gte('data', dataLimite)

    const totalDias = registros.length
    const diasCumpridos = registros.filter(r => r.cumpriu).length
    const totalQuestoes = registros.reduce((soma, r) => soma + (r.questoes_feitas || 0), 0)
    const totalCertas = registros.reduce((soma, r) => soma + (r.questoes_certas || 0), 0)
    const percentualAcerto = totalQuestoes > 0 ? Math.round((totalCertas / totalQuestoes) * 100) : 0
    const percentualCumprimento = totalDias > 0 ? Math.round((diasCumpridos / totalDias) * 100) : 0

    let corStatus = '#e57373' // vermelho
    if (percentualCumprimento >= 70) corStatus = '#81c784' // verde
    else if (percentualCumprimento >= 40) corStatus = '#ffb74d' // amarelo

    linhas.push({ aluno, totalDias, diasCumpridos, totalQuestoes, totalCertas, percentualAcerto, percentualCumprimento, corStatus })
  }

  // Ordena por quem cumpriu menos primeiro (quem precisa de mais atenção aparece no topo)
  linhas.sort((a, b) => a.percentualCumprimento - b.percentualCumprimento)

  div.innerHTML = ''
  linhas.forEach(l => {
    div.innerHTML += `
      <div class="item-lista" style="border-left: 4px solid ${l.corStatus}">
        <strong>${l.aluno.nome}</strong>
        <span>📅 ${l.diasCumpridos}/${l.totalDias} dias cumpridos (${l.percentualCumprimento}%)</span>
        <span>📝 ${l.totalQuestoes} questões feitas</span>
        <span>✅ ${l.percentualAcerto}% de acerto</span>
      </div>`
  })

  if (linhas.length === 0) {
    div.innerHTML = '<p>Nenhum registro de estudo encontrado nos últimos 7 dias.</p>'
  }
}
// ---------- AVISOS ----------
function carregarSelectsAvisos() {
  const selects = [
    document.getElementById('aviso-concurso'),
    document.getElementById('filtro-avisos-concurso')
  ]
  selects.forEach(select => {
    select.innerHTML = '<option value="">Selecione o concurso</option>'
    window._concursos.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.nome}</option>`
    })
  })
}

async function criarAviso() {
  const concurso_id = document.getElementById('aviso-concurso').value
  const titulo = document.getElementById('aviso-titulo').value
  const mensagem = document.getElementById('aviso-mensagem').value

  if (!concurso_id || !titulo || !mensagem) {
    alert('Preencha todos os campos do aviso.')
    return
  }

  const { error } = await _supabase.from('avisos').insert({ concurso_id, titulo, mensagem })

  if (error) { alert('Erro: ' + error.message); return }

  document.getElementById('aviso-titulo').value = ''
  document.getElementById('aviso-mensagem').value = ''
  alert('✅ Aviso publicado!')
  document.getElementById('filtro-avisos-concurso').value = concurso_id
  carregarAvisos()
}

async function carregarAvisos() {
  const concurso_id = document.getElementById('filtro-avisos-concurso').value
  if (!concurso_id) return

  const { data: avisos } = await _supabase
    .from('avisos')
    .select('*')
    .eq('concurso_id', concurso_id)
    .order('criado_em', { ascending: false })

  const div = document.getElementById('lista-avisos')
  div.innerHTML = ''

  if (!avisos || avisos.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum aviso publicado ainda.</p>'
    return
  }

  avisos.forEach(a => {
    const data = new Date(a.criado_em).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })
    div.innerHTML += `
      <div class="item-lista" style="flex-direction:column;align-items:flex-start;gap:6px">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <strong>${a.titulo}</strong>
          <div style="display:flex;gap:6px">
            <span style="color:#aaa;font-size:12px">${data}</span>
            <button class="btn-acao btn-excluir" onclick="excluirAviso('${a.id}')">🗑️</button>
          </div>
        </div>
        <p style="color:#ccc;font-size:14px;margin:0">${a.mensagem}</p>
      </div>`
  })
}

async function excluirAviso(id) {
  if (!confirm('Excluir este aviso?')) return
  const { error } = await _supabase.from('avisos').delete().eq('id', id)
  if (error) { alert('Erro: ' + error.message); return }
  carregarAvisos()
}
