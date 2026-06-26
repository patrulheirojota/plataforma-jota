const diasOrdem = { segunda:1, terca:2, quarta:3, quinta:4, sexta:5, sabado:6, domingo:7 }
const nomeDias = { segunda:'Segunda', terca:'Terca', quarta:'Quarta', quinta:'Quinta', sexta:'Sexta', sabado:'Sabado', domingo:'Domingo' }

// ========== LOGIN ==========
async function loginAdmin() {
  const email = document.getElementById('admin-email').value
  const senha = document.getElementById('admin-senha').value
  if (!email || !senha) {
    document.getElementById('msg-erro-admin').style.display = 'block'
    document.getElementById('msg-erro-admin').textContent = 'Preencha e-mail e senha.'
    return
  }
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password: senha })
  if (error) {
    document.getElementById('msg-erro-admin').style.display = 'block'
    document.getElementById('msg-erro-admin').textContent = 'E-mail ou senha incorretos.'
    return
  }
  document.getElementById('tela-login').style.display = 'none'
  document.getElementById('painel-admin').style.display = 'block'
  try { await carregarConcursos() } catch(e) { console.error('Erro concursos:', e) }
  try { await carregarAlunosParaCronograma() } catch(e) { console.error('Erro alunos:', e) }
}

async function sairAdmin() {
  await _supabase.auth.signOut()
  location.reload()
}

async function verificarSessao() {
  const { data: { user } } = await _supabase.auth.getUser()
  if (user) {
    document.getElementById('tela-login').style.display = 'none'
    document.getElementById('painel-admin').style.display = 'block'
    try { await carregarConcursos() } catch(e) { console.error(e) }
    try { await carregarAlunosParaCronograma() } catch(e) { console.error(e) }
  }
}
verificarSessao()

// ========== ABAS ==========
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

// ========== CONCURSOS ==========
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
  const div = document.getElementById('lista-concursos')
  div.innerHTML = ''
  concursos.forEach(c => {
    div.innerHTML += `
      <div class="item-lista">
        <strong>${c.nome}</strong>
        <span>${c.banca || ''}</span>
        <span>${c.data_prova ? new Date(c.data_prova).toLocaleDateString('pt-BR') : 'Sem data'}</span>
      </div>`
  })
  const selects = ['novo-aluno-concurso','editar-aluno-concurso','filtro-cron-concurso']
  selects.forEach(sid => {
    const s = document.getElementById(sid)
    if (!s) return
    s.innerHTML = '<option value="">Selecione o concurso</option>'
    concursos.forEach(c => { s.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  })
  window._concursos = concursos
}

// ========== ALUNOS ==========
async function criarAluno() {
  const nome = document.getElementById('novo-aluno-nome').value
  const email = document.getElementById('novo-aluno-email').value
  const senha = document.getElementById('novo-aluno-senha').value
  const concurso_id = document.getElementById('novo-aluno-concurso').value
  const msg = document.getElementById('msg-aluno')
  if (!nome || !email || !senha || !concurso_id) { alert('Preencha todos os campos.'); return }
  if (senha.length < 6) { alert('Senha precisa ter pelo menos 6 caracteres.'); return }
  const { data, error } = await _supabase.auth.signUp({ email, password: senha })
  if (error) { msg.style.color='#e57373'; msg.textContent='Erro: '+error.message; return }
  const { error: erroAluno } = await _supabase.from('alunos').insert({ id: data.user.id, nome, email, concurso_id })
  if (erroAluno) { msg.style.color='#e57373'; msg.textContent='Login criado, erro ao salvar: '+erroAluno.message; return }
  await _supabase.from('aluno_concursos').insert({ aluno_id: data.user.id, concurso_id }).catch(() => {})
  msg.style.color='#81c784'
  msg.textContent='Aluno ' + nome + ' cadastrado! Login: ' + email + ' / Senha: ' + senha
  document.getElementById('novo-aluno-nome').value = ''
  document.getElementById('novo-aluno-email').value = ''
  document.getElementById('novo-aluno-senha').value = ''
  carregarAlunos()
}

async function carregarAlunos() {
  const { data: alunos } = await _supabase.from('alunos').select('*, concursos(nome)').order('criado_em', { ascending: false })
  const div = document.getElementById('lista-alunos')
  div.innerHTML = ''
  if (!alunos || alunos.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum aluno cadastrado ainda.</p>'
    return
  }
  alunos.forEach(a => {
    div.innerHTML += `
      <div class="item-lista" style="flex-wrap:wrap;gap:8px">
        <div style="flex:1;min-width:150px">
          <strong>${a.nome}</strong>
          <div style="color:#aaa;font-size:12px">${a.email}</div>
          <div style="color:#aaa;font-size:12px">${a.concursos?.nome || 'Sem concurso'}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-acao btn-editar" onclick="abrirEditarAluno('${a.id}','${a.nome}','${a.email}','${a.concurso_id || ''}')">Editar</button>
          <button class="btn-acao btn-editar" onclick="gerenciarConcursosAluno('${a.id}','${a.nome}')">Concursos</button>
        </div>
      </div>`
  })
}

function abrirEditarAluno(id, nome, email, concurso_id) {
  document.getElementById('card-editar-aluno').style.display = 'block'
  document.getElementById('titulo-editar-aluno').textContent = 'Editar — ' + nome
  document.getElementById('editar-aluno-id').value = id
  document.getElementById('editar-aluno-nome').value = nome
  document.getElementById('editar-aluno-email').value = email
  const sel = document.getElementById('editar-aluno-concurso')
  if (sel && concurso_id) sel.value = concurso_id
  document.getElementById('card-editar-aluno').scrollIntoView({ behavior: 'smooth' })
  document.getElementById('msg-editar-aluno').textContent = ''
}

async function salvarEdicaoAluno() {
  const id = document.getElementById('editar-aluno-id').value
  const nome = document.getElementById('editar-aluno-nome').value
  const email = document.getElementById('editar-aluno-email').value
  const concurso_id = document.getElementById('editar-aluno-concurso').value
  const msg = document.getElementById('msg-editar-aluno')
  if (!nome || !email) { msg.style.color='#e57373'; msg.textContent='Preencha nome e e-mail.'; return }
  const { error } = await _supabase.from('alunos').update({ nome, email, concurso_id: concurso_id || null }).eq('id', id)
  if (error) { msg.style.color='#e57373'; msg.textContent='Erro: '+error.message; return }
  msg.style.color='#81c784'; msg.textContent='Salvo com sucesso!'
  carregarAlunos()
}

function fecharEditarAluno() {
  document.getElementById('card-editar-aluno').style.display = 'none'
}

async function gerenciarConcursosAluno(aluno_id, nome) {
  window._alunoGerenciando = aluno_id
  document.getElementById('card-concursos-aluno').style.display = 'block'
  document.getElementById('titulo-concursos-aluno').textContent = 'Concursos — ' + nome
  document.getElementById('card-concursos-aluno').scrollIntoView({ behavior: 'smooth' })
  const select = document.getElementById('select-add-concurso')
  select.innerHTML = '<option value="">Selecione o concurso</option>'
  window._concursos.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  await carregarConcursosDoAluno(aluno_id)
}

async function carregarConcursosDoAluno(aluno_id) {
  const { data: vinculos } = await _supabase
    .from('aluno_concursos').select('*, concursos(nome, banca)').eq('aluno_id', aluno_id)
  const div = document.getElementById('lista-concursos-aluno')
  div.innerHTML = ''
  if (!vinculos || vinculos.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum concurso vinculado ainda.</p>'
    return
  }
  vinculos.forEach(v => {
    div.innerHTML += `
      <div class="item-lista">
        <div>
          <strong>${v.concursos?.nome}</strong>
          <div style="color:#aaa;font-size:12px">${v.concursos?.banca || ''}</div>
        </div>
        <button class="btn-acao btn-excluir" onclick="removerConcursoAluno('${v.id}')">Remover</button>
      </div>`
  })
}

async function adicionarConcursoAluno() {
  const aluno_id = window._alunoGerenciando
  const concurso_id = document.getElementById('select-add-concurso').value
  if (!concurso_id) { alert('Selecione um concurso.'); return }
  const { error } = await _supabase.from('aluno_concursos').insert({ aluno_id, concurso_id })
  if (error) {
    if (error.code === '23505') { alert('Esse concurso ja esta vinculado a este aluno.'); return }
    alert('Erro: ' + error.message); return
  }
  alert('Concurso adicionado!')
  carregarConcursosDoAluno(aluno_id)
}

async function removerConcursoAluno(vinculo_id) {
  if (!confirm('Remover este concurso do aluno?')) return
  await _supabase.from('aluno_concursos').delete().eq('id', vinculo_id)
  carregarConcursosDoAluno(window._alunoGerenciando)
}

function fecharConcursosAluno() {
  document.getElementById('card-concursos-aluno').style.display = 'none'
}

// ========== CRONOGRAMA ==========
function carregarSelectsCronograma() {
  carregarAlunosParaCronograma()
  const s = document.getElementById('filtro-cron-concurso')
  if (s && window._concursos) {
    s.innerHTML = '<option value="">Selecione o concurso</option>'
    window._concursos.forEach(c => { s.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  }
}

async function carregarAlunosParaCronograma() {
  const { data: alunos } = await _supabase.from('alunos').select('id, nome').order('nome')
  const selects = ['cron-aluno','cron-aluno-origem']
  selects.forEach(sid => {
    const s = document.getElementById(sid)
    if (!s) return
    s.innerHTML = '<option value="">Selecione o aluno</option>'
    alunos.forEach(a => { s.innerHTML += `<option value="${a.id}">${a.nome}</option>` })
  })
}

async function visualizarCronogramaConcurso() {
  const concurso_id = document.getElementById('filtro-cron-concurso').value
  const div = document.getElementById('viz-cronograma-concurso')
  div.innerHTML = ''
  if (!concurso_id) return

  const { data: vinculos } = await _supabase
    .from('aluno_concursos').select('aluno_id, alunos(nome)').eq('concurso_id', concurso_id)

  if (!vinculos || vinculos.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum aluno vinculado a este concurso.</p>'
    return
  }

  div.innerHTML = '<p style="color:#aaa;font-size:13px;margin-bottom:12px">' + vinculos.length + ' aluno(s) neste concurso</p>'

  for (const v of vinculos) {
    const { data: itens } = await _supabase
      .from('plano_aluno').select('*')
      .eq('aluno_id', v.aluno_id).eq('concurso_id', concurso_id)

    if (!itens || itens.length === 0) {
      div.innerHTML += `
        <div style="background:#0d1b2a;border-radius:8px;padding:12px;margin-bottom:8px">
          <strong style="color:#C9A83C">${v.alunos?.nome}</strong>
          <span style="color:#aaa;font-size:13px;margin-left:10px">Sem plano cadastrado</span>
        </div>`
      continue
    }

    itens.sort((a, b) => diasOrdem[a.dia_semana] - diasOrdem[b.dia_semana])
    const totalMin = itens.reduce((s, i) => s + i.tempo_minutos, 0)
    const horas = Math.floor(totalMin / 60)
    const min = totalMin % 60

    div.innerHTML += `
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="color:#C9A83C">${v.alunos?.nome}</strong>
          <span style="color:#aaa;font-size:12px">${itens.length} disciplinas · ${horas > 0 ? horas+'h ' : ''}${min > 0 ? min+'min' : ''}/semana</span>
        </div>
        ${itens.map(i => `
          <div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid #1a2f45;flex-wrap:wrap;font-size:13px">
            <span style="color:#aaa;min-width:70px">${nomeDias[i.dia_semana]}</span>
            <span style="flex:1">${i.disciplina}</span>
            <span style="color:#aaa">${i.tempo_minutos}min</span>
            <span style="color:#aaa">${i.meta_questoes}q</span>
          </div>`).join('')}
      </div>`
  }
}

async function carregarConcursosParaCronograma() {
  const aluno_id = document.getElementById('cron-aluno').value
  const selectConcurso = document.getElementById('cron-concurso-filtro')
  selectConcurso.innerHTML = '<option value="">Selecione o concurso</option>'
  document.getElementById('form-plano').style.display = 'none'
  document.getElementById('card-plano-atual').style.display = 'none'
  document.getElementById('card-revisoes').style.display = 'none'
  if (!aluno_id) return
  const { data: vinculos } = await _supabase
    .from('aluno_concursos').select('concurso_id, concursos(nome)').eq('aluno_id', aluno_id)
  if (!vinculos || vinculos.length === 0) {
    selectConcurso.innerHTML = '<option value="">Aluno sem concurso vinculado</option>'
    return
  }
  vinculos.forEach(v => { selectConcurso.innerHTML += `<option value="${v.concurso_id}">${v.concursos?.nome}</option>` })
}

async function carregarPlanoAluno() {
  const aluno_id = document.getElementById('cron-aluno').value
  const concurso_id = document.getElementById('cron-concurso-filtro').value
  if (!aluno_id || !concurso_id) {
    document.getElementById('form-plano').style.display = 'none'
    document.getElementById('card-plano-atual').style.display = 'none'
    document.getElementById('card-revisoes').style.display = 'none'
    return
  }
  window._concursoAtivoCronograma = concurso_id
  document.getElementById('form-plano').style.display = 'block'
  document.getElementById('card-plano-atual').style.display = 'block'
  document.getElementById('card-revisoes').style.display = 'block'
  await renderizarPlano(aluno_id, concurso_id)
  await renderizarRevisoes(aluno_id)
}

async function renderizarPlano(aluno_id, concurso_id) {
  const { data: itens } = await _supabase
    .from('plano_aluno').select('*')
    .eq('aluno_id', aluno_id).eq('concurso_id', concurso_id)
  const div = document.getElementById('lista-plano-aluno')
  div.innerHTML = ''
  if (!itens || itens.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhuma disciplina no plano ainda. Adicione acima.</p>'
    return
  }
  itens.sort((a, b) => diasOrdem[a.dia_semana] - diasOrdem[b.dia_semana])
  const porDia = {}
  itens.forEach(i => {
    if (!porDia[i.dia_semana]) porDia[i.dia_semana] = []
    porDia[i.dia_semana].push(i)
  })
  Object.keys(porDia).sort((a, b) => diasOrdem[a] - diasOrdem[b]).forEach(dia => {
    const itensDia = porDia[dia]
    const totalMin = itensDia.reduce((s, i) => s + i.tempo_minutos, 0)
    const horas = Math.floor(totalMin / 60)
    const min = totalMin % 60
    div.innerHTML += `
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="color:#C9A83C">${nomeDias[dia]}</strong>
          <span style="color:#aaa;font-size:12px">Total: ${horas > 0 ? horas+'h ' : ''}${min > 0 ? min+'min' : ''} · ${itensDia.length} disciplina${itensDia.length > 1 ? 's' : ''}</span>
        </div>
        ${itensDia.map(i => `
          <div class="item-lista" id="item-${i.id}" style="flex-wrap:wrap;gap:8px">
            <div id="view-${i.id}" style="display:flex;gap:10px;align-items:center;flex:1;flex-wrap:wrap">
              <strong style="min-width:140px">${i.disciplina}</strong>
              <span style="color:#aaa;font-size:13px">${i.tempo_minutos} min</span>
              <span style="color:#aaa;font-size:13px">${i.meta_questoes} questoes</span>
              <div style="display:flex;gap:6px;margin-left:auto">
                <button class="btn-acao btn-editar" onclick="editarItemPlano('${i.id}')">Editar</button>
                <button class="btn-acao btn-excluir" onclick="excluirItemPlano('${i.id}','${aluno_id}','${concurso_id}')">Excluir</button>
              </div>
            </div>
            <div id="edit-${i.id}" style="display:none;width:100%;background:#0d1b2a;border-radius:8px;padding:10px;margin-top:4px">
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <input type="text" id="edit-disc-${i.id}" value="${i.disciplina}" style="flex:2;min-width:120px">
                <input type="number" id="edit-tempo-${i.id}" value="${i.tempo_minutos}" style="width:80px">
                <input type="number" id="edit-quest-${i.id}" value="${i.meta_questoes}" style="width:80px">
                <select id="edit-dia-${i.id}" style="flex:1;min-width:110px">
                  ${['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(d =>
                    `<option value="${d}" ${d === i.dia_semana ? 'selected' : ''}>${nomeDias[d]}</option>`
                  ).join('')}
                </select>
                <button class="btn-acao btn-editar" onclick="salvarEdicaoItemPlano('${i.id}','${aluno_id}','${concurso_id}')">Salvar</button>
                <button class="btn-acao" onclick="cancelarEdicaoItem('${i.id}')" style="background:#1a2f45;color:#aaa;border:1px solid #2a4a6a">X</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`
  })
}

function editarItemPlano(id) {
  document.getElementById('view-'+id).style.display = 'none'
  document.getElementById('edit-'+id).style.display = 'block'
}

function cancelarEdicaoItem(id) {
  document.getElementById('view-'+id).style.display = 'flex'
  document.getElementById('edit-'+id).style.display = 'none'
}

async function salvarEdicaoItemPlano(id, aluno_id, concurso_id) {
  const disciplina = document.getElementById('edit-disc-'+id).value
  const tempo_minutos = parseInt(document.getElementById('edit-tempo-'+id).value)
  const meta_questoes = parseInt(document.getElementById('edit-quest-'+id).value)
  const dia_semana = document.getElementById('edit-dia-'+id).value
  if (!disciplina || !tempo_minutos) { alert('Preencha disciplina e tempo.'); return }
  const { error } = await _supabase.from('plano_aluno')
    .update({ disciplina, tempo_minutos, meta_questoes, dia_semana }).eq('id', id)
  if (error) { alert('Erro: ' + error.message); return }
  renderizarPlano(aluno_id, concurso_id)
}

async function excluirItemPlano(id, aluno_id, concurso_id) {
  if (!confirm('Remover esta disciplina do plano?')) return
  await _supabase.from('plano_aluno').delete().eq('id', id)
  renderizarPlano(aluno_id, concurso_id)
}

async function renderizarRevisoes(aluno_id) {
  const { data: revisoes } = await _supabase
    .from('revisoes_programadas').select('*')
    .eq('aluno_id', aluno_id).eq('concluida', false).order('data_revisao')
  const div = document.getElementById('lista-revisoes-admin')
  div.innerHTML = ''
  if (!revisoes || revisoes.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhuma revisao programada.</p>'
    return
  }
  revisoes.forEach(r => {
    const data = new Date(r.data_revisao + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
    const label = r.tipo === 'exercicios' ? 'Exercicios' : 'Revisao'
    div.innerHTML += `
      <div class="item-lista">
        <span>${label}</span>
        <strong>${r.disciplina}</strong>
        <span style="color:#C9A83C">${data}</span>
        <button class="btn-acao btn-excluir" onclick="excluirRevisao('${r.id}','${aluno_id}')">Excluir</button>
      </div>`
  })
}

async function adicionarAoPlano() {
  const aluno_id = document.getElementById('cron-aluno').value
  const concurso_id = window._concursoAtivoCronograma
  const disciplina = document.getElementById('cron-disciplina').value
  const dia_semana = document.getElementById('cron-dia').value
  const tempo_minutos = parseInt(document.getElementById('cron-tempo').value)
  const meta_questoes = parseInt(document.getElementById('cron-questoes').value) || 30
  const usarRevisao = document.getElementById('usar-revisao').checked
  const diasExercicios = parseInt(document.getElementById('dias-exercicios').value) || 5
  const diasRevisaoVal = parseInt(document.getElementById('dias-revisao').value) || 12
  if (!disciplina || !tempo_minutos) { alert('Preencha a disciplina e o tempo de estudo.'); return }
  const { error } = await _supabase.from('plano_aluno').insert({
    aluno_id, concurso_id, disciplina, dia_semana, tempo_minutos, meta_questoes
  })
  if (error) { alert('Erro: ' + error.message); return }
  if (usarRevisao) {
    const hoje = new Date()
    const dataEx = new Date(hoje); dataEx.setDate(hoje.getDate() + diasExercicios)
    const dataRev = new Date(hoje); dataRev.setDate(hoje.getDate() + diasRevisaoVal)
    await _supabase.from('revisoes_programadas').insert([
      { aluno_id, disciplina, data_revisao: dataEx.toISOString().split('T')[0], tipo: 'exercicios' },
      { aluno_id, disciplina, data_revisao: dataRev.toISOString().split('T')[0], tipo: 'revisao' }
    ])
  }
  document.getElementById('cron-disciplina').value = ''
  document.getElementById('cron-tempo').value = ''
  document.getElementById('cron-questoes').value = '30'
  alert(disciplina + ' adicionada!')
  renderizarPlano(aluno_id, concurso_id)
  renderizarRevisoes(aluno_id)
}

async function excluirRevisao(id, aluno_id) {
  if (!confirm('Cancelar esta revisao?')) return
  await _supabase.from('revisoes_programadas').delete().eq('id', id)
  renderizarRevisoes(aluno_id)
}

async function copiarPlano() {
  const aluno_destino = document.getElementById('cron-aluno').value
  const aluno_origem = document.getElementById('cron-aluno-origem').value
  if (!aluno_destino || !aluno_origem) { alert('Selecione os dois alunos.'); return }
  if (aluno_destino === aluno_origem) { alert('Selecione alunos diferentes.'); return }
  if (!confirm('Isso vai ADICIONAR o plano do aluno de origem ao aluno selecionado. Confirmar?')) return
  const { data: itens } = await _supabase.from('plano_aluno')
    .select('disciplina, dia_semana, tempo_minutos, meta_questoes, ordem, concurso_id')
    .eq('aluno_id', aluno_origem)
  if (!itens || itens.length === 0) { alert('O aluno de origem nao tem plano cadastrado.'); return }
  const { error } = await _supabase.from('plano_aluno').insert(itens.map(i => ({ ...i, aluno_id: aluno_destino })))
  if (error) { alert('Erro ao copiar: ' + error.message); return }
  alert('Plano copiado! ' + itens.length + ' itens adicionados.')
  renderizarPlano(aluno_destino, window._concursoAtivoCronograma)
}

// ========== DESEMPENHO ==========
function carregarSelectDesempenho() {
  const select = document.getElementById('filtro-desempenho-concurso')
  select.innerHTML = '<option value="">Selecione o concurso</option>'
  window._concursos.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  verificarInatividade()
}

async function verificarInatividade() {
  const dias = parseInt(document.getElementById('dias-inatividade').value) || 3
  const limite = new Date()
  limite.setDate(limite.getDate() - dias)
  const dataLimite = limite.toISOString().split('T')[0]
  const { data: alunos } = await _supabase.from('alunos').select('id, nome, email, concursos(nome)')
  const div = document.getElementById('lista-inatividade')
  div.innerHTML = '<p style="color:#aaa;font-size:13px">Verificando...</p>'
  const inativos = []
  for (const aluno of alunos) {
    const { data: registros } = await _supabase.from('registros_diarios')
      .select('data').eq('aluno_id', aluno.id).gte('data', dataLimite).limit(1)
    if (!registros || registros.length === 0) {
      const { data: ultimo } = await _supabase.from('registros_diarios')
        .select('data').eq('aluno_id', aluno.id).order('data', { ascending: false }).limit(1)
      const ultimaData = ultimo?.[0]?.data
      const diasSemRegistro = ultimaData
        ? Math.floor((new Date() - new Date(ultimaData + 'T12:00:00')) / (1000 * 60 * 60 * 24))
        : null
      inativos.push({ aluno, ultimaData, diasSemRegistro })
    }
  }
  div.innerHTML = ''
  if (inativos.length === 0) {
    div.innerHTML = '<p style="color:#81c784">Nenhum aluno inativo nos ultimos ' + dias + ' dias!</p>'
    return
  }
  inativos.sort((a, b) => (b.diasSemRegistro || 999) - (a.diasSemRegistro || 999))
  inativos.forEach(({ aluno, ultimaData, diasSemRegistro }) => {
    const cor = diasSemRegistro > 7 ? '#e57373' : '#ffb74d'
    const msg = ultimaData
      ? 'Ultimo registro ha ' + diasSemRegistro + ' dias (' + new Date(ultimaData + 'T12:00:00').toLocaleDateString('pt-BR') + ')'
      : 'Nunca registrou'
    div.innerHTML += `
      <div class="item-lista" style="border-left:4px solid ${cor}">
        <div>
          <strong>${aluno.nome}</strong>
          <div style="color:#aaa;font-size:12px">${aluno.email}</div>
        </div>
        <span style="color:${cor};font-size:13px">${msg}</span>
        <button class="btn-acao btn-editar" onclick="verRelatorioIndividual('${aluno.id}','${aluno.nome}')">Ver historico</button>
      </div>`
  })
}

async function carregarDesempenho() {
  const concurso_id = document.getElementById('filtro-desempenho-concurso').value
  if (!concurso_id) return
  const { data: vinculos } = await _supabase
    .from('aluno_concursos').select('aluno_id, alunos(id, nome)').eq('concurso_id', concurso_id)
  if (!vinculos || vinculos.length === 0) {
    document.getElementById('lista-desempenho').innerHTML = '<p>Nenhum aluno nesse concurso.</p>'
    return
  }
  const seteDiasAtras = new Date()
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
  const dataLimite = seteDiasAtras.toISOString().split('T')[0]
  const div = document.getElementById('lista-desempenho')
  div.innerHTML = '<p style="color:#aaa">Carregando...</p>'
  const linhas = []
  for (const v of vinculos) {
    const aluno = v.alunos
    if (!aluno) continue
    const { data: registros } = await _supabase.from('registros_diarios')
      .select('*').eq('aluno_id', aluno.id).gte('data', dataLimite)
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
        <span>${l.diasCumpridos}/${l.totalDias} dias (${l.percentualCumprimento}%)</span>
        <span>${l.totalQuestoes} questoes</span>
        <span>${l.percentualAcerto}% acerto</span>
        <button class="btn-acao btn-editar" onclick="verRelatorioIndividual('${l.aluno.id}','${l.aluno.nome}')">Detalhar</button>
      </div>`
  })
}

async function verRelatorioIndividual(aluno_id, nome) {
  document.getElementById('card-relatorio-individual').style.display = 'block'
  document.getElementById('titulo-relatorio-individual').textContent = 'Historico — ' + nome
  document.getElementById('card-relatorio-individual').scrollIntoView({ behavior: 'smooth' })
  const { data: registros } = await _supabase.from('registros_diarios')
    .select('*').eq('aluno_id', aluno_id).order('data', { ascending: false }).limit(30)
  const div = document.getElementById('conteudo-relatorio-individual')
  div.innerHTML = ''
  if (!registros || registros.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum registro encontrado.</p>'
    return
  }
  const totalQ = registros.reduce((s, r) => s + (r.questoes_feitas || 0), 0)
  const totalC = registros.reduce((s, r) => s + (r.questoes_certas || 0), 0)
  const pctGeral = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0
  const diasCumpridos = registros.filter(r => r.cumpriu).length
  div.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:80px;text-align:center">
        <div style="color:#C9A83C;font-size:22px;font-weight:bold">${registros.length}</div>
        <div style="color:#aaa;font-size:12px">registros</div>
      </div>
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:80px;text-align:center">
        <div style="color:#81c784;font-size:22px;font-weight:bold">${diasCumpridos}</div>
        <div style="color:#aaa;font-size:12px">dias cumpridos</div>
      </div>
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:80px;text-align:center">
        <div style="color:#C9A83C;font-size:22px;font-weight:bold">${totalQ}</div>
        <div style="color:#aaa;font-size:12px">questoes</div>
      </div>
      <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:80px;text-align:center">
        <div style="color:#81c784;font-size:22px;font-weight:bold">${pctGeral}%</div>
        <div style="color:#aaa;font-size:12px">acerto</div>
      </div>
    </div>`
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
          <span style="color:#aaa;font-size:12px">${totalDia} questoes · ${pctDia}% acerto</span>
        </div>
        ${itens.map(r => `
          <div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid #1a2f45;flex-wrap:wrap">
            <span>${r.cumpriu ? 'OK' : 'X'}</span>
            <span style="flex:1">${r.disciplina}</span>
            <span style="color:#aaa;font-size:12px">${r.questoes_feitas || 0} feitas · ${r.questoes_certas || 0} certas</span>
          </div>`).join('')}
      </div>`
  })
}

function fecharRelatorioIndividual() {
  document.getElementById('card-relatorio-individual').style.display = 'none'
}

// ========== AVISOS ==========
function carregarSelectsAvisos() {
  const selects = ['aviso-concurso','filtro-avisos-concurso']
  selects.forEach(sid => {
    const s = document.getElementById(sid)
    if (!s) return
    s.innerHTML = '<option value="">Selecione o concurso</option>'
    window._concursos.forEach(c => { s.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  })
}

async function criarAviso() {
  const concurso_id = document.getElementById('aviso-concurso').value
  const titulo = document.getElementById('aviso-titulo').value
  const mensagem = document.getElementById('aviso-mensagem').value
  if (!concurso_id || !titulo || !mensagem) { alert('Preencha todos os campos.'); return }
  const { error } = await _supabase.from('avisos').insert({ concurso_id, titulo, mensagem })
  if (error) { alert('Erro: ' + error.message); return }
  document.getElementById('aviso-titulo').value = ''
  document.getElementById('aviso-mensagem').value = ''
  alert('Aviso publicado!')
  document.getElementById('filtro-avisos-concurso').value = concurso_id
  carregarAvisos()
}

async function carregarAvisos() {
  const concurso_id = document.getElementById('filtro-avisos-concurso').value
  if (!concurso_id) return
  const { data: avisos } = await _supabase.from('avisos').select('*')
    .eq('concurso_id', concurso_id).order('criado_em', { ascending: false })
  const div = document.getElementById('lista-avisos')
  div.innerHTML = ''
  if (!avisos || avisos.length === 0) {
    div.innerHTML = '<p style="color:#aaa">Nenhum aviso publicado ainda.</p>'
    return
  }
  avisos.forEach(a => {
    const data = new Date(a.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    div.innerHTML += `
      <div class="item-lista" style="flex-direction:column;align-items:flex-start;gap:6px">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <strong>${a.titulo}</strong>
          <div style="display:flex;gap:6px">
            <span style="color:#aaa;font-size:12px">${data}</span>
            <button class="btn-acao btn-excluir" onclick="excluirAviso('${a.id}')">Excluir</button>
          </div>
        </div>
        <p style="color:#ccc;font-size:14px;margin:0">${a.mensagem}</p>
      </div>`
  })
}

async function excluirAviso(id) {
  if (!confirm('Excluir este aviso?')) return
  await _supabase.from('avisos').delete().eq('id', id)
  carregarAvisos()
}
