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

// ---------- CRONOGRAMA ----------
function carregarSelectsCronograma() {
  const selects = [document.getElementById('cron-concurso'), document.getElementById('filtro-cronograma')]
  selects.forEach(select => {
    select.innerHTML = '<option value="">Selecione o concurso</option>'
    window._concursos.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.nome}</option>`
    })
  })
}

async function criarCronograma() {
  const concurso_id = document.getElementById('cron-concurso').value
  const dia_semana = document.getElementById('cron-dia').value
  const disciplina = document.getElementById('cron-disciplina').value
  const tempo_minutos = parseInt(document.getElementById('cron-tempo').value)
  const meta_questoes = parseInt(document.getElementById('cron-questoes').value) || 30

  if (!concurso_id || !disciplina || !tempo_minutos) {
    alert('Preencha concurso, disciplina e tempo de estudo.')
    return
  }

  const { error } = await _supabase.from('cronograma').insert({
    concurso_id, dia_semana, disciplina, tempo_minutos, meta_questoes
  })

  if (error) { alert('Erro: ' + error.message); return }

  document.getElementById('cron-disciplina').value = ''
  document.getElementById('cron-tempo').value = ''
  document.getElementById('cron-questoes').value = '30'

  alert('✅ Item adicionado ao cronograma!')
}

async function carregarCronogramaPorConcurso() {
  const concurso_id = document.getElementById('filtro-cronograma').value
  if (!concurso_id) return

  const { data: itens } = await _supabase
    .from('cronograma')
    .select('*')
    .eq('concurso_id', concurso_id)

  itens.sort((a, b) => diasOrdem[a.dia_semana] - diasOrdem[b.dia_semana])

  const div = document.getElementById('lista-cronograma')
  div.innerHTML = ''
  itens.forEach(i => {
    div.innerHTML += `
      <div class="item-lista">
        <strong>${nomeDias[i.dia_semana]}</strong>
        <span>${i.disciplina}</span>
        <span>${i.tempo_minutos} min</span>
        <span>${i.meta_questoes} questões</span>
      </div>`
  })
}
