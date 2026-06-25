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

  const selects = [
    document.getElementById('cron-aluno'),
    document.getElementById('cron-aluno-origem')
  ]

  selects.forEach(select => {
    select.innerHTML = '<option value="">Selecione o aluno</option>'
    alunos.forEach(a => {
      select.innerHTML += `<option value="${a.id}">${a.nome}</option>`
    })
  })
}

async function copiarPlano() {
  const aluno_destino = document.getElementById('cron-aluno').value
  const aluno_origem = document.getElementById('cron-aluno-origem').value

  if (!aluno_destino || !aluno_origem) {
    alert('Selecione o aluno de destino e o aluno de origem.')
    return
  }
  if (aluno_destino === aluno_origem) {
    alert('Selecione alunos diferentes.')
    return
  }
  if (!confirm('Isso vai ADICIONAR o plano do aluno de origem ao aluno selecionado (sem apagar o que já existe). Confirmar?')) return

  const { data: itens } = await _supabase
    .from('plano_aluno')
    .select('disciplina, dia_semana, tempo_minutos, meta_questoes, ordem')
    .eq('aluno_id', aluno_origem)

  if (!itens || itens.length === 0) {
    alert('O aluno de origem não tem plano cadastrado.')
    return
  }

  const novosItens = itens.map(i => ({ ...i, aluno_id: aluno_destino }))

  const { error } = await _supabase.from('plano_aluno').insert(novosItens)

  if (error) { alert('Erro ao copiar: ' + error.message); return }

  alert(`✅ Plano copiado com sucesso! ${itens.length} itens adicionados.`)
  renderizarPlano(aluno_destino)
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

  const div = document.getElementById('lista-plano-aluno')
  div.innerHTML = ''

  if (!itens || itens.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhuma disciplina no plano ainda. Adicione acima.</p>'
    return
  }

  itens.sort((a, b) => diasOrdemLocal[a.dia_semana] - diasOrdemLocal[b.dia_semana])

  // Agrupa por dia
  const porDia = {}
  itens.forEach(i => {
    if (!porDia[i.dia_semana]) porDia[i.dia_semana] = []
    porDia[i.dia_semana].push(i)
  })

  Object.keys(porDia).sort((a, b) => diasOrdemLocal[a] - diasOrdemLocal[b]).forEach(dia => {
    const itensDia = porDia[dia]
    const totalMin = itensDia.reduce((s, i) => s + i.tempo_minutos, 0)
    const horas = Math.floor(totalMin / 60)
    const min = totalMin % 60

    div.innerHTML += `
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="color:#C9A83C">${nomeDiasLocal[dia]}</strong>
          <span style="color:#aaa;font-size:12px">Total: ${horas > 0 ? horas+'h ' : ''}${min > 0 ? min+'min' : ''} · ${itensDia.length} disciplina${itensDia.length > 1 ? 's' : ''}</span>
        </div>
        ${itensDia.map(i => `
          <div class="item-lista" id="item-${i.id}" style="flex-wrap:wrap;gap:8px">
            <div id="view-${i.id}" style="display:flex;gap:10px;align-items:center;flex:1;flex-wrap:wrap">
              <strong style="min-width:160px">${i.disciplina}</strong>
              <span style="color:#aaa;font-size:13px">⏱ ${i.tempo_minutos} min</span>
              <span style="color:#aaa;font-size:13px">🎯 ${i.meta_questoes} questões</span>
              <div style="display:flex;gap:6px;margin-left:auto">
                <button class="btn-acao btn-editar" onclick="editarItemPlano('${i.id}')">✏️</button>
                <button class="btn-acao btn-excluir" onclick="excluirItemPlano('${i.id}','${aluno_id}')">🗑️</button>
              </div>
            </div>
            <div id="edit-${i.id}" style="display:none;width:100%;background:#0d1b2a;border-radius:8px;padding:10px;margin-top:4px">
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <input type="text" id="edit-disc-${i.id}" value="${i.disciplina}" style="flex:2;min-width:140px">
                <input type="number" id="edit-tempo-${i.id}" value="${i.tempo_minutos}" placeholder="Minutos" style="width:80px">
                <input type="number" id="edit-quest-${i.id}" value="${i.meta_questoes}" placeholder="Questões" style="width:80px">
                <select id="edit-dia-${i.id}" style="flex:1;min-width:120px">
                  ${['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(d =>
                    `<option value="${d}" ${d === i.dia_semana ? 'selected' : ''}>${nomeDiasLocal[d]}</option>`
                  ).join('')}
                </select>
                <button class="btn-acao btn-editar" onclick="salvarEdicaoItemPlano('${i.id}','${aluno_id}')">💾 Salvar</button>
                <button class="btn-acao" onclick="cancelarEdicaoItem('${i.id}')" style="background:#1a2f45;color:#aaa;border:1px solid #2a4a6a">✕</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`
  })
}

function editarItemPlano(id) {
  document.getElementById(`view-${id}`).style.display = 'none'
  document.getElementById(`edit-${id}`).style.display = 'block'
}

function cancelarEdicaoItem(id) {
  document.getElementById(`view-${id}`).style.display = 'flex'
  document.getElementById(`edit-${id}`).style.display = 'none'
}

async function salvarEdicaoItemPlano(id, aluno_id) {
  const disciplina = document.getElementById(`edit-disc-${id}`).value
  const tempo_minutos = parseInt(document.getElementById(`edit-tempo-${id}`).value)
  const meta_questoes = parseInt(document.getElementById(`edit-quest-${id}`).value)
  const dia_semana = document.getElementById(`edit-dia-${id}`).value

  if (!disciplina || !tempo_minutos) {
    alert('Preencha disciplina e tempo.')
    return
  }

  const { error } = await _supabase
    .from('plano_aluno')
    .update({ disciplina, tempo_minutos, meta_questoes, dia_semana })
    .eq('id', id)

  if (error) { alert('Erro: ' + error.message); return }
  renderizarPlano(aluno_id)
}
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
  verificarInatividade()
}

async function verificarInatividade() {
  const dias = parseInt(document.getElementById('dias-inatividade').value) || 3
  const limite = new Date()
  limite.setDate(limite.getDate() - dias)
  const dataLimite = limite.toISOString().split('T')[0]

  const { data: alunos } = await _supabase
    .from('alunos')
    .select('id, nome, email, concursos(nome)')

  const div = document.getElementById('lista-inatividade')
  div.innerHTML = '<p style="color:#aaa;font-size:13px">Verificando...</p>'

  const inativos = []

  for (const aluno of alunos) {
    const { data: registros } = await _supabase
      .from('registros_diarios')
      .select('data')
      .eq('aluno_id', aluno.id)
      .gte('data', dataLimite)
      .limit(1)

    if (!registros || registros.length === 0) {
      // Busca último registro
      const { data: ultimo } = await _supabase
        .from('registros_diarios')
        .select('data')
        .eq('aluno_id', aluno.id)
        .order('data', { ascending: false })
        .limit(1)

      const ultimaData = ultimo?.[0]?.data
      const diasSemRegistro = ultimaData
        ? Math.floor((new Date() - new Date(ultimaData + 'T12:00:00')) / (1000 * 60 * 60 * 24))
        : null

      inativos.push({ aluno, ultimaData, diasSemRegistro })
    }
  }

  div.innerHTML = ''

  if (inativos.length === 0) {
    div.innerHTML = `<p style="color:#81c784">✅ Nenhum aluno inativo nos últimos ${dias} dias!</p>`
    return
  }

  inativos.sort((a, b) => (b.diasSemRegistro || 999) - (a.diasSemRegistro || 999))

  inativos.forEach(({ aluno, ultimaData, diasSemRegistro }) => {
    const cor = diasSemRegistro > 7 ? '#e57373' : '#ffb74d'
    const msg = ultimaData
      ? `Último registro há ${diasSemRegistro} dias (${new Date(ultimaData + 'T12:00:00').toLocaleDateString('pt-BR')})`
      : 'Nunca registrou'

    div.innerHTML += `
      <div class="item-lista" style="border-left:4px solid ${cor}">
        <div>
          <strong>${aluno.nome}</strong>
          <div style="color:#aaa;font-size:12px">${aluno.email}</div>
          <div style="color:#aaa;font-size:12px">${aluno.concursos?.nome || ''}</div>
        </div>
        <span style="color:${cor};font-size:13px">${msg}</span>
        <button class="btn-acao btn-editar" onclick="verRelatorioIndividual('${aluno.id}','${aluno.nome}')">
          📋 Ver histórico
        </button>
      </div>`
  })
}

async function carregarDesempenho() {
  const concurso_id = document.getElementById('filtro-desempenho-concurso').value
  if (!concurso_id) return

  const { data: alunos } = await _supabase
    .from('alunos')
    .select('*')
    .eq('concurso_id', concurso_id)

  if (!alunos || alunos.length === 0) {
    document.getElementById('lista-desempenho').innerHTML = '<p>Nenhum aluno nesse concurso.</p>'
    return
  }

  const seteDiasAtras = new Date()
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
  const dataLimite = seteDiasAtras.toISOString().split('T')[0]

  const div = document.getElementById('lista-desempenho')
  div.innerHTML = '<p style="color:#aaa">Carregando...</p>'

  const linhas = []

  for (const aluno of alunos) {
    const { data: registros } = await _supabase
      .from('registros_diarios')
      .select('*')
      .eq('aluno_id', aluno.id)
      .gte('data', dataLimite)

    const totalDias = registros.length
    const diasCumpridos = registros.filter(r => r.cumpriu).length
    const totalQuestoes = registros.reduce((s, r) => s + (r.questoes_feitas || 0), 0)
    const totalCertas = registros.reduce((s, r) => s + (r.questoes_certas || 0), 0)
    const percentualAcerto = totalQuestoes > 0 ? Math.round((totalCertas / totalQuestoes) * 100) : 0
    const percentualCumprimento = totalDias > 0 ? Math.round((diasCumpridos / totalDias) * 100) : 0
    const corStatus = percentualCumprimento >= 70 ? '#81c784' : percentualCumprimento >= 40 ? '#ffb74d' : '#e57373'

    linhas.push({ aluno, totalDias, diasCumpridos, totalQuestoes, percentualAcerto, percentualCumprimento, corStatus })
  }

  linhas.sort((a, b) => a.percentualCumprimento - b.percentualCumprimento)

  div.innerHTML = ''
  linhas.forEach(l => {
    div.innerHTML += `
      <div class="item-lista" style="border-left:4px solid ${l.corStatus}">
        <strong>${l.aluno.nome}</strong>
        <span>📅 ${l.diasCumpridos}/${l.totalDias} dias (${l.percentualCumprimento}%)</span>
        <span>📝 ${l.totalQuestoes} questões</span>
        <span>✅ ${l.percentualAcerto}% acerto</span>
        <button class="btn-acao btn-editar" onclick="verRelatorioIndividual('${l.aluno.id}','${l.aluno.nome}')">
          📋 Detalhar
        </button>
      </div>`
  })
}

async function verRelatorioIndividual(aluno_id, nome) {
  document.getElementById('card-relatorio-individual').style.display = 'block'
  document.getElementById('titulo-relatorio-individual').textContent = `Histórico — ${nome}`
  document.getElementById('card-relatorio-individual').scrollIntoView({ behavior: 'smooth' })

  const { data: registros } = await _supabase
    .from('registros_diarios')
    .select('*')
    .eq('aluno_id', aluno_id)
    .order('data', { ascending: false })
    .limit(30)

  const div = document.getElementById('conteudo-relatorio-individual')
  div.innerHTML = ''

  if (!registros || registros.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum registro encontrado.</p>'
    return
  }

  // Resumo geral
  const totalQ = registros.reduce((s, r) => s + (r.questoes_feitas || 0), 0)
  const totalC = registros.reduce((s, r) => s + (r.questoes_certas || 0), 0)
  const pctGeral = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0
  const diasCumpridos = registros.filter(r => r.cumpriu).length

  div.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:120px;text-align:center">
        <div style="color:#C9A83C;font-size:22px;font-weight:bold">${registros.length}</div>
        <div style="color:#aaa;font-size:12px">registros</div>
      </div>
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:120px;text-align:center">
        <div style="color:#81c784;font-size:22px;font-weight:bold">${diasCumpridos}</div>
        <div style="color:#aaa;font-size:12px">dias cumpridos</div>
      </div>
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:120px;text-align:center">
        <div style="color:#C9A83C;font-size:22px;font-weight:bold">${totalQ}</div>
        <div style="color:#aaa;font-size:12px">questões feitas</div>
      </div>
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:120px;text-align:center">
        <div style="color:#81c784;font-size:22px;font-weight:bold">${pctGeral}%</div>
        <div style="color:#aaa;font-size:12px">de acerto</div>
      </div>
    </div>`

  // Registros agrupados por data
  const porData = {}
  registros.forEach(r => {
    if (!porData[r.data]) porData[r.data] = []
    porData[r.data].push(r)
  })

  Object.keys(porData).sort((a, b) => b.localeCompare(a)).forEach(data => {
    const itens = porData[data]
    const totalDia = itens.reduce((s, r) => s + (r.questoes_feitas || 0), 0)
    const certasDia = itens.reduce((s, r) => s + (r.questoes_certas || 0), 0)
    const pctDia = totalDia > 0 ? Math.round((certasDia / totalDia) * 100) : 0
    const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })

    div.innerHTML += `
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <strong style="color:#C9A83C">${dataFmt}</strong>
          <span style="color:#aaa;font-size:12px">${totalDia} questões · ${pctDia}% acerto</span>
        </div>
        ${itens.map(r => `
          <div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid #1a2f45;flex-wrap:wrap">
            <span>${r.cumpriu ? '✅' : '❌'}</span>
            <span style="flex:1">${r.disciplina}</span>
            <span style="color:#aaa;font-size:12px">${r.questoes_feitas || 0} feitas · ${r.questoes_certas || 0} certas</span>
          </div>`).join('')}
      </div>`
  })
}

function fecharRelatorioIndividual() {
  document.getElementById('card-relatorio-individual').style.display = 'none'
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
