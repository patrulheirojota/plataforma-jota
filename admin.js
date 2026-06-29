const diasOrdem = { segunda:1, terca:2, quarta:3, quinta:4, sexta:5, sabado:6, domingo:7 }
const nomeDias = { segunda:'Segunda', terca:'Terca', quarta:'Quarta', quinta:'Quinta', sexta:'Sexta', sabado:'Sabado', domingo:'Domingo' }

// ========== LOGIN ==========
async function loginAdmin() {
  const email = document.getElementById('admin-email').value
  const senha = document.getElementById('admin-senha').value
  if (!email || !senha) { mostrarErroLogin('Preencha e-mail e senha.'); return }
  const { error } = await _supabase.auth.signInWithPassword({ email, password: senha })
  if (error) { mostrarErroLogin('E-mail ou senha incorretos.'); return }
  entrarNoPainel()
}

function mostrarErroLogin(msg) {
  const el = document.getElementById('msg-erro-admin')
  el.style.display = 'block'; el.textContent = msg
}

async function entrarNoPainel() {
  document.getElementById('tela-login').style.display = 'none'
  document.getElementById('painel-admin').style.display = 'block'
  try { await carregarConcursos() } catch(e) { console.error(e) }
  try { await carregarAlunosParaCronograma() } catch(e) { console.error(e) }
}

async function sairAdmin() { await _supabase.auth.signOut(); location.reload() }

async function verificarSessao() {
  const { data: { user } } = await _supabase.auth.getUser()
  if (user) entrarNoPainel()
}
verificarSessao()

function mostrarAba(id) {
  document.querySelectorAll('.aba-conteudo').forEach(el => el.style.display = 'none')
  document.querySelectorAll('.aba-btn').forEach(el => el.classList.remove('ativa'))
  document.getElementById(id).style.display = 'block'
  event.target.classList.add('ativa')
  if (id === 'aba-alunos') carregarAlunos()
  if (id === 'aba-templates') { carregarTemplates(); preencherSelectsMassa() }
  if (id === 'aba-cronograma') carregarSelectsCronograma()
  if (id === 'aba-desempenho') carregarSelectDesempenho()
  if (id === 'aba-avisos') carregarSelectsAvisos()
}

// ========== CONCURSOS ==========
async function carregarConcursos() {
  const { data: concursos } = await _supabase.from('concursos').select('*').order('criado_em', { ascending: false })
  const div = document.getElementById('lista-concursos')
  if (div) {
    div.innerHTML = ''
    concursos.forEach(c => {
      div.innerHTML += `<div class="item-lista">
        <strong>${c.nome}</strong><span>${c.banca||''}</span>
        <span>${c.data_prova ? new Date(c.data_prova).toLocaleDateString('pt-BR') : 'Sem data'}</span>
      </div>`
    })
  }
  const ids = ['novo-aluno-concurso','editar-aluno-concurso','filtro-cron-concurso',
                'template-concurso','filtro-template-concurso','aplicar-template-concurso',
                'massa-concurso-select','filtro-desempenho-concurso','aviso-concurso','filtro-avisos-concurso']
  ids.forEach(sid => {
    const s = document.getElementById(sid)
    if (!s) return
    const val = s.value
    s.innerHTML = '<option value="">Selecione o concurso</option>'
    concursos.forEach(c => { s.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
    if (val) s.value = val
  })
  window._concursos = concursos
}

async function criarConcurso() {
  const nome = document.getElementById('novo-concurso-nome').value
  const banca = document.getElementById('novo-concurso-banca').value
  const data_prova = document.getElementById('novo-concurso-data').value
  if (!nome) { alert('Digite o nome do concurso'); return }
  const { error } = await _supabase.from('concursos').insert({ nome, banca, data_prova: data_prova||null })
  if (error) { alert('Erro: '+error.message); return }
  document.getElementById('novo-concurso-nome').value = ''
  document.getElementById('novo-concurso-banca').value = ''
  document.getElementById('novo-concurso-data').value = ''
  carregarConcursos()
}

// ========== ALUNOS ==========
// CORRECAO: usa a API admin do Supabase via REST para criar usuario sem fazer login automatico
async function criarAluno() {
  const nome = document.getElementById('novo-aluno-nome').value
  const email = document.getElementById('novo-aluno-email').value
  const senha = document.getElementById('novo-aluno-senha').value
  const concurso_id = document.getElementById('novo-aluno-concurso').value
  const msg = document.getElementById('msg-aluno')
  if (!nome||!email||!senha||!concurso_id) { alert('Preencha todos os campos.'); return }
  if (senha.length < 6) { alert('Senha minimo 6 caracteres.'); return }

  msg.style.color = '#aaa'; msg.textContent = 'Cadastrando aluno...'

  // Usa signUp mas imediatamente restaura a sessao do admin
  const { data: adminSession } = await _supabase.auth.getSession()

  const { data, error } = await _supabase.auth.signUp({ email, password: senha })
  if (error) { msg.style.color='#e57373'; msg.textContent='Erro: '+error.message; return }

  const novoId = data.user.id

  // Restaura sessao do admin imediatamente
  if (adminSession?.session?.access_token) {
    await _supabase.auth.setSession({
      access_token: adminSession.session.access_token,
      refresh_token: adminSession.session.refresh_token
    })
  }

  // Salva dados do aluno
  const { error: erroAluno } = await _supabase.from('alunos').insert({ id: novoId, nome, email, concurso_id })
  if (erroAluno) { msg.style.color='#e57373'; msg.textContent='Login criado, erro ao salvar dados: '+erroAluno.message; return }

  await _supabase.from('aluno_concursos').insert({ aluno_id: novoId, concurso_id }).catch(()=>{})

  msg.style.color='#81c784'
  msg.textContent='Aluno '+nome+' cadastrado! Login: '+email+' / Senha: '+senha

  document.getElementById('novo-aluno-nome').value = ''
  document.getElementById('novo-aluno-email').value = ''
  document.getElementById('novo-aluno-senha').value = ''

  // Recarrega a lista sem perder nada
  await carregarAlunos()
  await carregarAlunosParaCronograma()
}

async function carregarAlunos() {
  const { data: alunos } = await _supabase.from('alunos').select('*, concursos(nome)').order('nome', { ascending: true })
  const div = document.getElementById('lista-alunos')
  div.innerHTML = ''
  if (!alunos||alunos.length===0) { div.innerHTML='<p style="color:#aaa">Nenhum aluno cadastrado.</p>'; return }

  // Campo de busca
  div.innerHTML = `<div style="margin-bottom:12px">
    <input type="text" id="busca-aluno" placeholder="Buscar aluno..." oninput="filtrarAlunos()" style="margin:0">
  </div>
  <div id="lista-alunos-inner"></div>`

  window._todosAlunos = alunos
  renderizarListaAlunos(alunos)
}

function filtrarAlunos() {
  const termo = document.getElementById('busca-aluno')?.value.toLowerCase() || ''
  const filtrados = window._todosAlunos.filter(a =>
    a.nome.toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo)
  )
  renderizarListaAlunos(filtrados)
}

function renderizarListaAlunos(alunos) {
  const div = document.getElementById('lista-alunos-inner')
  if (!div) return
  div.innerHTML = ''
  if (alunos.length === 0) { div.innerHTML='<p style="color:#aaa">Nenhum aluno encontrado.</p>'; return }

  alunos.forEach(a => {
    div.innerHTML += `<div class="item-lista" style="flex-wrap:wrap;gap:8px">
      <div style="flex:1;min-width:140px">
        <strong>${a.nome}</strong>
        <div style="color:#aaa;font-size:12px">${a.email}</div>
        <div style="color:#aaa;font-size:12px">${a.concursos?.nome||'Sem concurso'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-acao btn-editar" onclick="abrirEditarAluno('${a.id}','${a.nome}','${a.email}','${a.concurso_id||''}')">Editar</button>
        <button class="btn-acao btn-editar" onclick="gerenciarConcursosAluno('${a.id}','${a.nome}')">Concursos</button>
        <button class="btn-acao btn-editar" onclick="irParaCronogramaAluno('${a.id}','${a.nome}')" style="background:#1a3a5c;color:#4a8ab5;border:1px solid #4a8ab5">Cronograma</button>
        <button class="btn-acao" onclick="abrirAplicarTemplate('${a.id}','${a.nome}')" style="background:#1a3a1a;color:#81c784;border:1px solid #81c784">Template</button>
      </div>
    </div>`
  })
  div.innerHTML += `<p style="color:#aaa;font-size:12px;margin-top:8px">${alunos.length} aluno(s)</p>`
}

// Atalho: vai direto para a aba de cronograma com o aluno ja selecionado
async function irParaCronogramaAluno(aluno_id, nome) {
  // Ativa a aba de cronograma
  document.querySelectorAll('.aba-conteudo').forEach(el => el.style.display = 'none')
  document.querySelectorAll('.aba-btn').forEach(el => el.classList.remove('ativa'))
  document.getElementById('aba-cronograma').style.display = 'block'
  document.querySelectorAll('.aba-btn').forEach(el => {
    if (el.textContent.trim() === 'Cronograma') el.classList.add('ativa')
  })

  await carregarSelectsCronograma()

  // Seleciona o aluno automaticamente
  const selectAluno = document.getElementById('cron-aluno')
  if (selectAluno) {
    selectAluno.value = aluno_id
    await carregarConcursosParaCronograma()
  }

  document.getElementById('aba-cronograma').scrollIntoView({ behavior: 'smooth' })
}

function abrirEditarAluno(id, nome, email, concurso_id) {
  document.getElementById('card-editar-aluno').style.display = 'block'
  document.getElementById('titulo-editar-aluno').textContent = 'Editar — '+nome
  document.getElementById('editar-aluno-id').value = id
  document.getElementById('editar-aluno-nome').value = nome
  document.getElementById('editar-aluno-email').value = email
  const sel = document.getElementById('editar-aluno-concurso')
  if (sel && concurso_id) sel.value = concurso_id
  document.getElementById('card-editar-aluno').scrollIntoView({ behavior:'smooth' })
  document.getElementById('msg-editar-aluno').textContent = ''
}

async function salvarEdicaoAluno() {
  const id = document.getElementById('editar-aluno-id').value
  const nome = document.getElementById('editar-aluno-nome').value
  const email = document.getElementById('editar-aluno-email').value
  const concurso_id = document.getElementById('editar-aluno-concurso').value
  const msg = document.getElementById('msg-editar-aluno')
  if (!nome||!email) { msg.style.color='#e57373'; msg.textContent='Preencha nome e e-mail.'; return }
  const { error } = await _supabase.from('alunos').update({ nome, email, concurso_id: concurso_id||null }).eq('id', id)
  if (error) { msg.style.color='#e57373'; msg.textContent='Erro: '+error.message; return }
  msg.style.color='#81c784'; msg.textContent='Salvo com sucesso!'
  carregarAlunos()
}

function fecharEditarAluno() { document.getElementById('card-editar-aluno').style.display='none' }

async function gerenciarConcursosAluno(aluno_id, nome) {
  window._alunoGerenciando = aluno_id
  document.getElementById('card-concursos-aluno').style.display = 'block'
  document.getElementById('titulo-concursos-aluno').textContent = 'Concursos — '+nome
  document.getElementById('card-concursos-aluno').scrollIntoView({ behavior:'smooth' })
  const select = document.getElementById('select-add-concurso')
  select.innerHTML = '<option value="">Selecione o concurso</option>'
  window._concursos.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  await carregarConcursosDoAluno(aluno_id)
}

async function carregarConcursosDoAluno(aluno_id) {
  const { data: vinculos } = await _supabase.from('aluno_concursos').select('*, concursos(nome,banca)').eq('aluno_id', aluno_id)
  const div = document.getElementById('lista-concursos-aluno')
  div.innerHTML = ''
  if (!vinculos||vinculos.length===0) { div.innerHTML='<p style="color:#aaa">Nenhum concurso vinculado.</p>'; return }
  vinculos.forEach(v => {
    div.innerHTML += `<div class="item-lista">
      <div><strong>${v.concursos?.nome}</strong><div style="color:#aaa;font-size:12px">${v.concursos?.banca||''}</div></div>
      <button class="btn-acao btn-excluir" onclick="removerConcursoAluno('${v.id}')">Remover</button>
    </div>`
  })
}

async function adicionarConcursoAluno() {
  const aluno_id = window._alunoGerenciando
  const concurso_id = document.getElementById('select-add-concurso').value
  if (!concurso_id) { alert('Selecione um concurso.'); return }
  const { error } = await _supabase.from('aluno_concursos').insert({ aluno_id, concurso_id })
  if (error) { if (error.code==='23505') { alert('Concurso ja vinculado.'); return }; alert('Erro: '+error.message); return }
  alert('Concurso adicionado!')
  carregarConcursosDoAluno(aluno_id)
}

async function removerConcursoAluno(vinculo_id) {
  if (!confirm('Remover este concurso do aluno?')) return
  await _supabase.from('aluno_concursos').delete().eq('id', vinculo_id)
  carregarConcursosDoAluno(window._alunoGerenciando)
}

function fecharConcursosAluno() { document.getElementById('card-concursos-aluno').style.display='none' }

// ========== TEMPLATES ==========
async function carregarTemplates() {
  const concurso_id = document.getElementById('filtro-template-concurso').value
  if (concurso_id) await carregarListaTemplates(concurso_id)
}

async function carregarListaTemplates(concurso_id) {
  const { data: templates } = await _supabase.from('templates_cronograma')
    .select('*').eq('concurso_id', concurso_id).order('criado_em', { ascending: false })
  const div = document.getElementById('lista-templates')
  div.innerHTML = ''
  if (!templates||templates.length===0) { div.innerHTML='<p style="color:#aaa">Nenhum template para este concurso.</p>'; return }
  templates.forEach(t => {
    div.innerHTML += `<div class="item-lista" style="flex-wrap:wrap;gap:8px">
      <div style="flex:1"><strong>${t.nome}</strong><div style="color:#aaa;font-size:12px">${t.descricao||''}</div></div>
      <div style="display:flex;gap:6px">
        <button class="btn-acao btn-editar" onclick="verItensTemplate('${t.id}','${t.nome}')">Ver itens</button>
        <button class="btn-acao btn-excluir" onclick="excluirTemplate('${t.id}')">Excluir</button>
      </div>
    </div>`
  })
  window._templates = templates
}

function preencherSelectsMassa() {
  if (!window._concursos) return
  const s = document.getElementById('massa-concurso-select')
  if (!s) return
  const val = s.value
  s.innerHTML = '<option value="">Selecione o concurso</option>'
  window._concursos.forEach(c => { s.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  if (val) s.value = val
}

async function criarTemplate() {
  const concurso_id = document.getElementById('template-concurso').value
  const nome = document.getElementById('template-nome').value
  const descricao = document.getElementById('template-descricao').value
  if (!concurso_id||!nome) { alert('Selecione o concurso e digite o nome.'); return }
  const { data, error } = await _supabase.from('templates_cronograma').insert({ concurso_id, nome, descricao }).select().single()
  if (error) { alert('Erro: '+error.message); return }
  document.getElementById('template-nome').value = ''
  document.getElementById('template-descricao').value = ''
  window._templateAtivo = data.id
  window._templateAtivoNome = nome
  document.getElementById('card-itens-template').style.display = 'block'
  document.getElementById('titulo-itens-template').textContent = 'Itens do template: '+nome
  document.getElementById('lista-itens-template').innerHTML = '<p style="color:#aaa">Nenhum item ainda. Adicione abaixo.</p>'
  document.getElementById('card-itens-template').scrollIntoView({ behavior:'smooth' })
  await carregarListaTemplates(concurso_id)
  alert('Template "'+nome+'" criado! Adicione as disciplinas abaixo.')
}

async function adicionarItemTemplate() {
  const template_id = window._templateAtivo
  if (!template_id) { alert('Crie ou selecione um template primeiro.'); return }
  const disciplina = document.getElementById('item-disciplina').value
  const dia_semana = document.getElementById('item-dia').value
  const tempo_minutos = parseInt(document.getElementById('item-tempo').value)
  const meta_questoes = parseInt(document.getElementById('item-questoes').value)||30
  if (!disciplina||!tempo_minutos) { alert('Preencha disciplina e tempo.'); return }
  const { error } = await _supabase.from('template_itens').insert({ template_id, disciplina, dia_semana, tempo_minutos, meta_questoes })
  if (error) { alert('Erro: '+error.message); return }
  document.getElementById('item-disciplina').value = ''
  document.getElementById('item-tempo').value = ''
  document.getElementById('item-questoes').value = '30'
  await verItensTemplate(template_id, window._templateAtivoNome)
}

async function verItensTemplate(template_id, nome) {
  window._templateAtivo = template_id
  window._templateAtivoNome = nome
  document.getElementById('card-itens-template').style.display = 'block'
  document.getElementById('titulo-itens-template').textContent = 'Itens: '+nome
  document.getElementById('card-itens-template').scrollIntoView({ behavior:'smooth' })
  const { data: itens } = await _supabase.from('template_itens').select('*').eq('template_id', template_id)
  const div = document.getElementById('lista-itens-template')
  div.innerHTML = ''
  if (!itens||itens.length===0) { div.innerHTML='<p style="color:#aaa">Nenhum item ainda.</p>'; return }
  itens.sort((a,b) => diasOrdem[a.dia_semana]-diasOrdem[b.dia_semana])
  const porDia = {}
  itens.forEach(i => { if (!porDia[i.dia_semana]) porDia[i.dia_semana]=[]; porDia[i.dia_semana].push(i) })
  let totalMinSemana = 0
  Object.keys(porDia).sort((a,b)=>diasOrdem[a]-diasOrdem[b]).forEach(dia => {
    const itensDia = porDia[dia]
    const totalMin = itensDia.reduce((s,i)=>s+i.tempo_minutos,0)
    totalMinSemana += totalMin
    div.innerHTML += `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <strong style="color:#C9A83C">${nomeDias[dia]}</strong>
        <span style="color:#aaa;font-size:12px">${Math.floor(totalMin/60)>0?Math.floor(totalMin/60)+'h ':''}${totalMin%60>0?totalMin%60+'min':''}</span>
      </div>
      ${itensDia.map(i=>`<div class="item-lista" style="margin-bottom:4px">
        <strong style="min-width:140px">${i.disciplina}</strong>
        <span style="color:#aaa;font-size:13px">${i.tempo_minutos}min</span>
        <span style="color:#aaa;font-size:13px">${i.meta_questoes}q</span>
        <button class="btn-acao btn-excluir" onclick="excluirItemTemplate('${i.id}','${template_id}','${nome}')">X</button>
      </div>`).join('')}
    </div>`
  })
  const hSemana = Math.floor(totalMinSemana/60)
  const mSemana = totalMinSemana%60
  div.innerHTML += `<div style="background:#0d1b2a;border-radius:8px;padding:10px;text-align:center;color:#C9A83C;font-size:13px">
    Total semanal: ${hSemana>0?hSemana+'h ':''}${mSemana>0?mSemana+'min':''} · ${itens.length} disciplinas
  </div>`
}

async function excluirItemTemplate(id, template_id, nome) {
  if (!confirm('Remover este item?')) return
  await _supabase.from('template_itens').delete().eq('id', id)
  verItensTemplate(template_id, nome)
}

async function excluirTemplate(id) {
  if (!confirm('Excluir este template e todos os seus itens?')) return
  await _supabase.from('template_itens').delete().eq('template_id', id)
  await _supabase.from('templates_cronograma').delete().eq('id', id)
  const concurso_id = document.getElementById('filtro-template-concurso').value
  carregarListaTemplates(concurso_id)
  document.getElementById('card-itens-template').style.display = 'none'
}

// ========== APLICAR TEMPLATE (individual) ==========
function abrirAplicarTemplate(aluno_id, nome) {
  window._alunoAplicarTemplate = aluno_id
  document.getElementById('card-aplicar-template').style.display = 'block'
  document.getElementById('titulo-aplicar-template').textContent = 'Aplicar template — '+nome
  document.getElementById('preview-template').innerHTML = ''
  document.getElementById('btn-confirmar-aplicar').style.display = 'none'
  // Preenche o select de concurso
  const sel = document.getElementById('aplicar-template-concurso')
  sel.innerHTML = '<option value="">Selecione o concurso</option>'
  window._concursos.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  document.getElementById('aplicar-template-select').innerHTML = '<option value="">Selecione o template</option>'
  document.getElementById('card-aplicar-template').scrollIntoView({ behavior:'smooth' })
}

async function carregarTemplatesParaAplicar() {
  const concurso_id = document.getElementById('aplicar-template-concurso').value
  const sel = document.getElementById('aplicar-template-select')
  sel.innerHTML = '<option value="">Selecione o template</option>'
  document.getElementById('preview-template').innerHTML = ''
  document.getElementById('btn-confirmar-aplicar').style.display = 'none'
  if (!concurso_id) return
  const { data: templates } = await _supabase.from('templates_cronograma').select('*').eq('concurso_id', concurso_id)
  if (!templates||templates.length===0) { sel.innerHTML='<option value="">Nenhum template para este concurso</option>'; return }
  templates.forEach(t => { sel.innerHTML += `<option value="${t.id}">${t.nome}</option>` })
}

async function preVisualizarTemplate() {
  const template_id = document.getElementById('aplicar-template-select').value
  const concurso_id = document.getElementById('aplicar-template-concurso').value
  if (!template_id) { alert('Selecione um template.'); return }
  if (!concurso_id) { alert('Selecione um concurso.'); return }
  const { data: itens } = await _supabase.from('template_itens').select('*').eq('template_id', template_id)
  const div = document.getElementById('preview-template')
  div.innerHTML = ''
  if (!itens||itens.length===0) { div.innerHTML='<p style="color:#aaa">Template sem itens.</p>'; return }
  itens.sort((a,b)=>diasOrdem[a.dia_semana]-diasOrdem[b.dia_semana])
  const porDia = {}
  itens.forEach(i=>{ if (!porDia[i.dia_semana]) porDia[i.dia_semana]=[]; porDia[i.dia_semana].push(i) })
  div.innerHTML = '<p style="color:#C9A83C;font-size:13px;margin-bottom:10px">Ajuste a carga horaria se necessario (opcional):</p>'
  Object.keys(porDia).sort((a,b)=>diasOrdem[a]-diasOrdem[b]).forEach(dia => {
    div.innerHTML += `<div style="margin-bottom:12px">
      <strong style="color:#aaa;font-size:13px">${nomeDias[dia]}</strong>
      ${porDia[dia].map(i=>`<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
        <span style="flex:1;font-size:13px">${i.disciplina}</span>
        <input type="number" id="adj-${i.id}" value="${i.tempo_minutos}" min="15" step="15"
          style="width:80px;padding:6px;border-radius:6px;border:1px solid #2a4a6a;background:#0d1b2a;color:#fff;font-size:13px">
        <span style="color:#aaa;font-size:12px">min</span>
        <input type="number" id="adjq-${i.id}" value="${i.meta_questoes}" min="0"
          style="width:70px;padding:6px;border-radius:6px;border:1px solid #2a4a6a;background:#0d1b2a;color:#fff;font-size:13px">
        <span style="color:#aaa;font-size:12px">q</span>
      </div>`).join('')}
    </div>`
  })
  window._templateItensPreview = itens
  document.getElementById('btn-confirmar-aplicar').style.display = 'block'
}

async function confirmarAplicarTemplate() {
  const aluno_id = window._alunoAplicarTemplate
  const template_id = document.getElementById('aplicar-template-select').value
  const concurso_id = document.getElementById('aplicar-template-concurso').value
  const itens = window._templateItensPreview
  if (!aluno_id||!template_id||!concurso_id||!itens) { alert('Selecione template e concurso.'); return }
  const novosItens = itens.map(i => ({
    aluno_id, concurso_id, template_id,
    disciplina: i.disciplina, dia_semana: i.dia_semana,
    tempo_minutos: parseInt(document.getElementById('adj-'+i.id)?.value)||i.tempo_minutos,
    meta_questoes: parseInt(document.getElementById('adjq-'+i.id)?.value)||i.meta_questoes,
    ordem: i.ordem||1, tempo_personalizado: false
  }))
  const { error } = await _supabase.from('plano_aluno').insert(novosItens)
  if (error) { alert('Erro: '+error.message); return }
  alert('Template aplicado! '+novosItens.length+' itens adicionados.')
  document.getElementById('card-aplicar-template').style.display = 'none'
  document.getElementById('preview-template').innerHTML = ''
  document.getElementById('btn-confirmar-aplicar').style.display = 'none'
}

// ========== APLICAR EM MASSA ==========
async function carregarAlunosParaMassa() {
  const concurso_id = document.getElementById('massa-concurso-select').value
  const divAlunos = document.getElementById('lista-massa-alunos')
  const selTemplate = document.getElementById('massa-template-select')
  divAlunos.innerHTML = ''
  selTemplate.innerHTML = '<option value="">Selecione o template</option>'
  if (!concurso_id) return
  const { data: vinculos } = await _supabase.from('aluno_concursos')
    .select('aluno_id, alunos(id,nome)').eq('concurso_id', concurso_id)
  const { data: templates } = await _supabase.from('templates_cronograma')
    .select('*').eq('concurso_id', concurso_id)
  if (templates) templates.forEach(t => { selTemplate.innerHTML += `<option value="${t.id}">${t.nome}</option>` })
  if (!vinculos||vinculos.length===0) { divAlunos.innerHTML='<p style="color:#aaa">Nenhum aluno neste concurso.</p>'; return }
  divAlunos.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:10px">
    <button class="btn-acao btn-editar" onclick="selecionarTodosAlunos(true)">Selecionar todos</button>
    <button class="btn-acao" onclick="selecionarTodosAlunos(false)" style="background:#1a2f45;color:#aaa;border:1px solid #2a4a6a">Desmarcar todos</button>
  </div>`
  vinculos.forEach(v => {
    if (!v.alunos) return
    divAlunos.innerHTML += `<label style="display:flex;align-items:center;gap:10px;padding:8px;background:#0d1b2a;border-radius:6px;margin-bottom:4px;cursor:pointer">
      <input type="checkbox" class="massa-aluno-check" value="${v.alunos.id}">
      <span>${v.alunos.nome}</span>
    </label>`
  })
}

function selecionarTodosAlunos(valor) {
  document.querySelectorAll('.massa-aluno-check').forEach(cb => { cb.checked = valor })
}

async function aplicarTemplateEmMassa() {
  const template_id = document.getElementById('massa-template-select').value
  const concurso_id = document.getElementById('massa-concurso-select').value
  if (!template_id||!concurso_id) { alert('Selecione o concurso e o template.'); return }
  const checkboxes = document.querySelectorAll('.massa-aluno-check:checked')
  if (checkboxes.length===0) { alert('Selecione pelo menos um aluno.'); return }
  if (!confirm('Aplicar template a '+checkboxes.length+' aluno(s)?')) return
  const { data: itens } = await _supabase.from('template_itens').select('*').eq('template_id', template_id)
  if (!itens||itens.length===0) { alert('Template sem itens cadastrados.'); return }
  let erros = 0, sucesso = 0
  for (const cb of checkboxes) {
    const aluno_id = cb.value
    const novosItens = itens.map(i => ({
      aluno_id, concurso_id, template_id,
      disciplina: i.disciplina, dia_semana: i.dia_semana,
      tempo_minutos: i.tempo_minutos, meta_questoes: i.meta_questoes,
      ordem: i.ordem||1, tempo_personalizado: false
    }))
    const { error } = await _supabase.from('plano_aluno').insert(novosItens)
    if (error) erros++; else sucesso++
  }
  alert('Concluido! '+sucesso+' aluno(s) receberam o template.'+(erros>0?' '+erros+' erro(s).':''))
  document.getElementById('card-massa').style.display = 'none'
}

// ========== CRONOGRAMA INDIVIDUAL ==========
function carregarSelectsCronograma() {
  carregarAlunosParaCronograma()
  const s = document.getElementById('filtro-cron-concurso')
  if (s && window._concursos) {
    s.innerHTML = '<option value="">Selecione o concurso</option>'
    window._concursos.forEach(c => { s.innerHTML += `<option value="${c.id}">${c.nome}</option>` })
  }
}

async function carregarAlunosParaCronograma() {
  const { data: alunos } = await _supabase.from('alunos').select('id,nome').order('nome')
  const selects = ['cron-aluno','cron-aluno-origem']
  selects.forEach(sid => {
    const s = document.getElementById(sid)
    if (!s) return
    const val = s.value
    s.innerHTML = '<option value="">Selecione o aluno</option>'
    alunos.forEach(a => { s.innerHTML += `<option value="${a.id}">${a.nome}</option>` })
    if (val) s.value = val
  })
}

async function visualizarCronogramaConcurso() {
  const concurso_id = document.getElementById('filtro-cron-concurso').value
  const div = document.getElementById('viz-cronograma-concurso')
  div.innerHTML = ''
  if (!concurso_id) return
  const { data: vinculos } = await _supabase.from('aluno_concursos').select('aluno_id, alunos(nome)').eq('concurso_id', concurso_id)
  if (!vinculos||vinculos.length===0) { div.innerHTML='<p style="color:#aaa">Nenhum aluno vinculado.</p>'; return }
  div.innerHTML = '<p style="color:#aaa;font-size:13px;margin-bottom:12px">'+vinculos.length+' aluno(s)</p>'
  for (const v of vinculos) {
    const { data: itens } = await _supabase.from('plano_aluno').select('*')
      .eq('aluno_id', v.aluno_id).eq('concurso_id', concurso_id)
    if (!itens||itens.length===0) {
      div.innerHTML += `<div style="background:#0d1b2a;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <strong style="color:#C9A83C">${v.alunos?.nome}</strong>
        <span style="color:#e57373;font-size:13px">Sem plano</span>
      </div>`
      continue
    }
    itens.sort((a,b)=>diasOrdem[a.dia_semana]-diasOrdem[b.dia_semana])
    const totalMin = itens.reduce((s,i)=>s+i.tempo_minutos,0)
    const personalizados = itens.filter(i=>i.tempo_personalizado).length
    div.innerHTML += `<div style="background:#0d1b2a;border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <strong style="color:#C9A83C">${v.alunos?.nome}</strong>
        <div style="display:flex;gap:8px;align-items:center">
          ${personalizados>0?`<span style="color:#C9A83C;font-size:11px;padding:2px 8px;border:1px solid #C9A83C;border-radius:10px">${personalizados} personalizado(s)</span>`:''}
          <span style="color:#aaa;font-size:12px">${itens.length} disc · ${Math.floor(totalMin/60)>0?Math.floor(totalMin/60)+'h ':''}${totalMin%60>0?totalMin%60+'min':''}/sem</span>
        </div>
      </div>
      ${itens.map(i=>`<div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid #1a2f45;font-size:13px;flex-wrap:wrap">
        <span style="color:#aaa;min-width:70px">${nomeDias[i.dia_semana]}</span>
        <span style="flex:1">${i.disciplina}</span>
        <span style="color:${i.tempo_personalizado?'#C9A83C':'#aaa'}">${i.tempo_minutos}min${i.tempo_personalizado?' *':''}</span>
        <span style="color:#aaa">${i.meta_questoes}q</span>
      </div>`).join('')}
      ${personalizados>0?'<p style="color:#C9A83C;font-size:11px;margin-top:6px">* ajustado pelo aluno</p>':''}
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
  const { data: vinculos } = await _supabase.from('aluno_concursos').select('concurso_id, concursos(nome)').eq('aluno_id', aluno_id)
  if (!vinculos||vinculos.length===0) { selectConcurso.innerHTML='<option value="">Sem concurso vinculado</option>'; return }
  vinculos.forEach(v => { selectConcurso.innerHTML += `<option value="${v.concurso_id}">${v.concursos?.nome}</option>` })
  // Se so tem um concurso, seleciona automaticamente
  if (vinculos.length === 1) {
    selectConcurso.value = vinculos[0].concurso_id
    carregarPlanoAluno()
  }
}

async function carregarPlanoAluno() {
  const aluno_id = document.getElementById('cron-aluno').value
  const concurso_id = document.getElementById('cron-concurso-filtro').value
  if (!aluno_id||!concurso_id) {
    document.getElementById('form-plano').style.display='none'
    document.getElementById('card-plano-atual').style.display='none'
    document.getElementById('card-revisoes').style.display='none'
    return
  }
  window._concursoAtivoCronograma = concurso_id
  document.getElementById('form-plano').style.display='block'
  document.getElementById('card-plano-atual').style.display='block'
  document.getElementById('card-revisoes').style.display='block'
  await renderizarPlano(aluno_id, concurso_id)
  await renderizarRevisoes(aluno_id)
}

async function renderizarPlano(aluno_id, concurso_id) {
  const { data: itens } = await _supabase.from('plano_aluno').select('*')
    .eq('aluno_id', aluno_id).eq('concurso_id', concurso_id)
  const div = document.getElementById('lista-plano-aluno')
  div.innerHTML = ''
  if (!itens||itens.length===0) { div.innerHTML='<p style="color:#aaa">Nenhuma disciplina no plano. Adicione manualmente ou aplique um template pela aba Alunos.</p>'; return }
  itens.sort((a,b)=>diasOrdem[a.dia_semana]-diasOrdem[b.dia_semana])
  const porDia = {}
  itens.forEach(i=>{ if (!porDia[i.dia_semana]) porDia[i.dia_semana]=[]; porDia[i.dia_semana].push(i) })
  Object.keys(porDia).sort((a,b)=>diasOrdem[a]-diasOrdem[b]).forEach(dia => {
    const itensDia = porDia[dia]
    const totalMin = itensDia.reduce((s,i)=>s+i.tempo_minutos,0)
    div.innerHTML += `<div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <strong style="color:#C9A83C">${nomeDias[dia]}</strong>
        <span style="color:#aaa;font-size:12px">${Math.floor(totalMin/60)>0?Math.floor(totalMin/60)+'h ':''}${totalMin%60>0?totalMin%60+'min':''} · ${itensDia.length} disc.</span>
      </div>
      ${itensDia.map(i=>`<div class="item-lista" id="item-${i.id}" style="flex-wrap:wrap;gap:8px">
        <div id="view-${i.id}" style="display:flex;gap:10px;align-items:center;flex:1;flex-wrap:wrap">
          <strong style="min-width:130px">${i.disciplina}</strong>
          <span style="color:${i.tempo_personalizado?'#C9A83C':'#aaa'};font-size:13px">${i.tempo_minutos}min${i.tempo_personalizado?' *':''}</span>
          <span style="color:#aaa;font-size:13px">${i.meta_questoes}q</span>
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
              ${['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(d=>`<option value="${d}" ${d===i.dia_semana?'selected':''}>${nomeDias[d]}</option>`).join('')}
            </select>
            <button class="btn-acao btn-editar" onclick="salvarEdicaoItemPlano('${i.id}','${aluno_id}','${concurso_id}')">Salvar</button>
            <button class="btn-acao" onclick="cancelarEdicaoItem('${i.id}')" style="background:#1a2f45;color:#aaa;border:1px solid #2a4a6a">X</button>
          </div>
        </div>
      </div>`).join('')}
    </div>`
  })
}

function editarItemPlano(id) { document.getElementById('view-'+id).style.display='none'; document.getElementById('edit-'+id).style.display='block' }
function cancelarEdicaoItem(id) { document.getElementById('view-'+id).style.display='flex'; document.getElementById('edit-'+id).style.display='none' }

async function salvarEdicaoItemPlano(id, aluno_id, concurso_id) {
  const disciplina = document.getElementById('edit-disc-'+id).value
  const tempo_minutos = parseInt(document.getElementById('edit-tempo-'+id).value)
  const meta_questoes = parseInt(document.getElementById('edit-quest-'+id).value)
  const dia_semana = document.getElementById('edit-dia-'+id).value
  if (!disciplina||!tempo_minutos) { alert('Preencha disciplina e tempo.'); return }
  const { error } = await _supabase.from('plano_aluno').update({ disciplina, tempo_minutos, meta_questoes, dia_semana, tempo_personalizado: false }).eq('id', id)
  if (error) { alert('Erro: '+error.message); return }
  renderizarPlano(aluno_id, concurso_id)
}

async function excluirItemPlano(id, aluno_id, concurso_id) {
  if (!confirm('Remover esta disciplina?')) return
  await _supabase.from('plano_aluno').delete().eq('id', id)
  renderizarPlano(aluno_id, concurso_id)
}

async function renderizarRevisoes(aluno_id) {
  const { data: revisoes } = await _supabase.from('revisoes_programadas').select('*')
    .eq('aluno_id', aluno_id).eq('concluida', false).order('data_revisao')
  const div = document.getElementById('lista-revisoes-admin')
  div.innerHTML = ''
  if (!revisoes||revisoes.length===0) { div.innerHTML='<p style="color:#aaa">Nenhuma revisao programada.</p>'; return }
  revisoes.forEach(r => {
    const data = new Date(r.data_revisao+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})
    div.innerHTML += `<div class="item-lista">
      <span>${r.tipo==='exercicios'?'Exercicios':'Revisao'}</span>
      <strong>${r.disciplina}</strong>
      <span style="color:#C9A83C">${data}</span>
      <button class="btn-acao btn-excluir" onclick="excluirRevisao('${r.id}','${aluno_id}')">X</button>
    </div>`
  })
}

async function adicionarAoPlano() {
  const aluno_id = document.getElementById('cron-aluno').value
  const concurso_id = window._concursoAtivoCronograma
  const disciplina = document.getElementById('cron-disciplina').value
  const dia_semana = document.getElementById('cron-dia').value
  const tempo_minutos = parseInt(document.getElementById('cron-tempo').value)
  const meta_questoes = parseInt(document.getElementById('cron-questoes').value)||30
  const usarRevisao = document.getElementById('usar-revisao').checked
  const diasEx = parseInt(document.getElementById('dias-exercicios').value)||5
  const diasRev = parseInt(document.getElementById('dias-revisao').value)||12
  if (!disciplina||!tempo_minutos) { alert('Preencha disciplina e tempo.'); return }
  const { error } = await _supabase.from('plano_aluno').insert({ aluno_id, concurso_id, disciplina, dia_semana, tempo_minutos, meta_questoes })
  if (error) { alert('Erro: '+error.message); return }
  if (usarRevisao) {
    const hoje = new Date()
    const dataEx = new Date(hoje); dataEx.setDate(hoje.getDate()+diasEx)
    const dataRv = new Date(hoje); dataRv.setDate(hoje.getDate()+diasRev)
    await _supabase.from('revisoes_programadas').insert([
      { aluno_id, disciplina, data_revisao: dataEx.toISOString().split('T')[0], tipo:'exercicios' },
      { aluno_id, disciplina, data_revisao: dataRv.toISOString().split('T')[0], tipo:'revisao' }
    ])
  }
  document.getElementById('cron-disciplina').value=''
  document.getElementById('cron-tempo').value=''
  document.getElementById('cron-questoes').value='30'
  alert(disciplina+' adicionada!')
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
  if (!aluno_destino||!aluno_origem) { alert('Selecione os dois alunos.'); return }
  if (aluno_destino===aluno_origem) { alert('Selecione alunos diferentes.'); return }
  if (!confirm('Adicionar o plano do aluno de origem ao aluno selecionado?')) return
  const { data: itens } = await _supabase.from('plano_aluno').select('disciplina,dia_semana,tempo_minutos,meta_questoes,ordem,concurso_id').eq('aluno_id', aluno_origem)
  if (!itens||itens.length===0) { alert('Aluno de origem sem plano.'); return }
  const { error } = await _supabase.from('plano_aluno').insert(itens.map(i=>({...i,aluno_id:aluno_destino})))
  if (error) { alert('Erro: '+error.message); return }
  alert('Plano copiado! '+itens.length+' itens adicionados.')
  renderizarPlano(aluno_destino, window._concursoAtivoCronograma)
}

// ========== DESEMPENHO ==========
function carregarSelectDesempenho() {
  verificarInatividade()
}

async function verificarInatividade() {
  const dias = parseInt(document.getElementById('dias-inatividade').value)||3
  const limite = new Date(); limite.setDate(limite.getDate()-dias)
  const dataLimite = limite.toISOString().split('T')[0]
  const { data: alunos } = await _supabase.from('alunos').select('id,nome,email,concursos(nome)')
  const div = document.getElementById('lista-inatividade')
  div.innerHTML='<p style="color:#aaa;font-size:13px">Verificando...</p>'
  const inativos=[]
  for (const aluno of alunos) {
    const { data: reg } = await _supabase.from('registros_diarios').select('data').eq('aluno_id',aluno.id).gte('data',dataLimite).limit(1)
    if (!reg||reg.length===0) {
      const { data: ult } = await _supabase.from('registros_diarios').select('data').eq('aluno_id',aluno.id).order('data',{ascending:false}).limit(1)
      const ultimaData = ult?.[0]?.data
      const diasSem = ultimaData ? Math.floor((new Date()-new Date(ultimaData+'T12:00:00'))/(1000*60*60*24)) : null
      inativos.push({aluno,ultimaData,diasSem})
    }
  }
  div.innerHTML=''
  if (inativos.length===0) { div.innerHTML='<p style="color:#81c784">Nenhum aluno inativo nos ultimos '+dias+' dias!</p>'; return }
  inativos.sort((a,b)=>(b.diasSem||999)-(a.diasSem||999))
  inativos.forEach(({aluno,ultimaData,diasSem})=>{
    const cor = diasSem>7?'#e57373':'#ffb74d'
    const msg = ultimaData?'Ha '+diasSem+' dias':'Nunca registrou'
    div.innerHTML+=`<div class="item-lista" style="border-left:4px solid ${cor}">
      <div><strong>${aluno.nome}</strong><div style="color:#aaa;font-size:12px">${aluno.email}</div></div>
      <span style="color:${cor};font-size:13px">${msg}</span>
      <button class="btn-acao btn-editar" onclick="verRelatorioIndividual('${aluno.id}','${aluno.nome}')">Ver historico</button>
    </div>`
  })
}

async function carregarDesempenho() {
  const concurso_id = document.getElementById('filtro-desempenho-concurso').value
  if (!concurso_id) return
  const { data: vinculos } = await _supabase.from('aluno_concursos').select('aluno_id,alunos(id,nome)').eq('concurso_id',concurso_id)
  if (!vinculos||vinculos.length===0) { document.getElementById('lista-desempenho').innerHTML='<p>Nenhum aluno nesse concurso.</p>'; return }
  const sete = new Date(); sete.setDate(sete.getDate()-7)
  const dataLimite = sete.toISOString().split('T')[0]
  const div = document.getElementById('lista-desempenho')
  div.innerHTML='<p style="color:#aaa">Carregando...</p>'
  const linhas=[]
  for (const v of vinculos) {
    const aluno=v.alunos; if (!aluno) continue
    const { data: reg } = await _supabase.from('registros_diarios').select('*').eq('aluno_id',aluno.id).gte('data',dataLimite)
    const totalDias=reg.length, diasC=reg.filter(r=>r.cumpriu).length
    const totalQ=reg.reduce((s,r)=>s+(r.questoes_feitas||0),0)
    const totalC=reg.reduce((s,r)=>s+(r.questoes_certas||0),0)
    const pctA=totalQ>0?Math.round((totalC/totalQ)*100):0
    const pctC=totalDias>0?Math.round((diasC/totalDias)*100):0
    const cor=pctC>=70?'#81c784':pctC>=40?'#ffb74d':'#e57373'
    linhas.push({aluno,totalDias,diasC,totalQ,pctA,pctC,cor})
  }
  linhas.sort((a,b)=>a.pctC-b.pctC)
  div.innerHTML=''
  linhas.forEach(l=>{
    div.innerHTML+=`<div class="item-lista" style="border-left:4px solid ${l.cor}">
      <strong>${l.aluno.nome}</strong>
      <span>${l.diasC}/${l.totalDias} dias (${l.pctC}%)</span>
      <span>${l.totalQ} questoes</span>
      <span>${l.pctA}% acerto</span>
      <button class="btn-acao btn-editar" onclick="verRelatorioIndividual('${l.aluno.id}','${l.aluno.nome}')">Detalhar</button>
    </div>`
  })
}

async function verRelatorioIndividual(aluno_id, nome) {
  document.getElementById('card-relatorio-individual').style.display='block'
  document.getElementById('titulo-relatorio-individual').textContent='Historico — '+nome
  document.getElementById('card-relatorio-individual').scrollIntoView({behavior:'smooth'})
  const { data: reg } = await _supabase.from('registros_diarios').select('*').eq('aluno_id',aluno_id).order('data',{ascending:false}).limit(30)
  const div = document.getElementById('conteudo-relatorio-individual')
  div.innerHTML=''
  if (!reg||reg.length===0) { div.innerHTML='<p style="color:#aaa">Nenhum registro.</p>'; return }
  const totalQ=reg.reduce((s,r)=>s+(r.questoes_feitas||0),0)
  const totalC=reg.reduce((s,r)=>s+(r.questoes_certas||0),0)
  const pct=totalQ>0?Math.round((totalC/totalQ)*100):0
  const diasC=reg.filter(r=>r.cumpriu).length
  div.innerHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    ${[['#C9A83C',reg.length,'registros'],['#81c784',diasC,'cumpridos'],['#C9A83C',totalQ,'questoes'],['#81c784',pct+'%','acerto']].map(([c,v,l])=>`
    <div style="background:#0d1b2a;border-radius:8px;padding:12px;flex:1;min-width:80px;text-align:center">
      <div style="color:${c};font-size:22px;font-weight:bold">${v}</div>
      <div style="color:#aaa;font-size:12px">${l}</div>
    </div>`).join('')}</div>`
  const porData={}
  reg.forEach(r=>{ if (!porData[r.data]) porData[r.data]=[]; porData[r.data].push(r) })
  Object.keys(porData).sort((a,b)=>b.localeCompare(a)).forEach(data=>{
    const itens=porData[data]
    const tD=itens.reduce((s,r)=>s+(r.questoes_feitas||0),0)
    const cD=itens.reduce((s,r)=>s+(r.questoes_certas||0),0)
    const pD=tD>0?Math.round((cD/tD)*100):0
    const fmt=new Date(data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})
    div.innerHTML+=`<div style="background:#0d1b2a;border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <strong style="color:#C9A83C">${fmt}</strong>
        <span style="color:#aaa;font-size:12px">${tD} questoes · ${pD}%</span>
      </div>
      ${itens.map(r=>`<div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid #1a2f45;flex-wrap:wrap">
        <span>${r.cumpriu?'OK':'X'}</span><span style="flex:1">${r.disciplina}</span>
        <span style="color:#aaa;font-size:12px">${r.questoes_feitas||0} · ${r.questoes_certas||0} certas</span>
      </div>`).join('')}
    </div>`
  })
}

function fecharRelatorioIndividual() { document.getElementById('card-relatorio-individual').style.display='none' }

// ========== AVISOS ==========
function carregarSelectsAvisos() {
  ['aviso-concurso','filtro-avisos-concurso'].forEach(sid=>{
    const s=document.getElementById(sid); if (!s) return
    s.innerHTML='<option value="">Selecione o concurso</option>'
    window._concursos.forEach(c=>{ s.innerHTML+=`<option value="${c.id}">${c.nome}</option>` })
  })
}

async function criarAviso() {
  const concurso_id=document.getElementById('aviso-concurso').value
  const titulo=document.getElementById('aviso-titulo').value
  const mensagem=document.getElementById('aviso-mensagem').value
  if (!concurso_id||!titulo||!mensagem) { alert('Preencha todos os campos.'); return }
  const { error } = await _supabase.from('avisos').insert({ concurso_id, titulo, mensagem })
  if (error) { alert('Erro: '+error.message); return }
  document.getElementById('aviso-titulo').value=''
  document.getElementById('aviso-mensagem').value=''
  alert('Aviso publicado!')
  document.getElementById('filtro-avisos-concurso').value=concurso_id
  carregarAvisos()
}

async function carregarAvisos() {
  const concurso_id=document.getElementById('filtro-avisos-concurso').value
  if (!concurso_id) return
  const { data: avisos } = await _supabase.from('avisos').select('*').eq('concurso_id',concurso_id).order('criado_em',{ascending:false})
  const div=document.getElementById('lista-avisos')
  div.innerHTML=''
  if (!avisos||avisos.length===0) { div.innerHTML='<p style="color:#aaa">Nenhum aviso.</p>'; return }
  avisos.forEach(a=>{
    const data=new Date(a.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
    div.innerHTML+=`<div class="item-lista" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
        <strong>${a.titulo}</strong>
        <div style="display:flex;gap:6px"><span style="color:#aaa;font-size:12px">${data}</span>
        <button class="btn-acao btn-excluir" onclick="excluirAviso('${a.id}')">X</button></div>
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
