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
  document.getElementById('painel-admin').style.display = 'flex'
  try { await carregarConcursos() } catch(e) { console.error(e) }
  try { await carregarAlunosParaCronograma() } catch(e) { console.error(e) }
  try { await carregarAlunos() } catch(e) { console.error(e) }
}

async function sairAdmin() { await _supabase.auth.signOut(); location.reload() }

async function verificarSessao() {
  const { data: { user } } = await _supabase.auth.getUser()
  if (user) entrarNoPainel()
}
verificarSessao()

const TITULOS = {
  'aba-alunos':['Alunos','Cadastro, acesso e acompanhamento'],
  'aba-concursos':['Concursos','Cadastro, data da prova e edicao'],
  'aba-avisos':['Avisos','Recados para a turma'],
  'aba-cronograma':['Planos de estudo','Visualize e edite o plano de cada aluno'],
  'aba-templates':['Templates','Modelos de cronograma reutilizaveis'],
  'aba-desempenho':['Desempenho','Inatividade e evolucao da turma']
}

function mostrarAba(id) {
  document.querySelectorAll('.aba-conteudo').forEach(function(el){ el.style.display='none' })
  const alvo = document.getElementById(id)
  if (alvo) alvo.style.display='block'
  document.querySelectorAll('.nav-i').forEach(function(el){
    if (el.dataset.a) el.classList.toggle('on', el.dataset.a===id)
  })
  const t = TITULOS[id]
  if (t) {
    const a=document.getElementById('pag-t'), b=document.getElementById('pag-s')
    if(a)a.textContent=t[0]
    if(b)b.textContent=t[1]
  }
  window.scrollTo({top:0,behavior:'smooth'})
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
    if (!concursos || !concursos.length) {
      div.innerHTML = '<p style="color:var(--tx3)">Nenhum concurso cadastrado.</p>'
    } else {
      concursos.forEach(c => {
        let restante = ''
        if (c.data_prova) {
          const h = new Date(); h.setHours(0,0,0,0)
          const dias = Math.ceil((new Date(c.data_prova+'T12:00:00') - h) / 86400000)
          restante = dias > 0 ? ' · faltam '+dias+' dias' : (dias === 0 ? ' · e hoje!' : ' · ja passou')
        }
        div.innerHTML += `<div class="item-lista" style="flex-wrap:wrap;gap:8px">
          <div style="flex:1;min-width:150px">
            <strong>${c.nome}</strong>
            <div style="color:var(--tx3);font-size:12px">${c.banca||'Sem banca'}</div>
            <div style="color:${c.data_prova?'#C9A83C':'var(--tx3)'};font-size:12px">${c.data_prova ? new Date(c.data_prova+'T12:00:00').toLocaleDateString('pt-BR')+restante : 'Sem data de prova'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-acao btn-editar" onclick="abrirEditarConcurso('${c.id}')">Editar</button>
            <button class="btn-acao btn-excluir" onclick="excluirConcurso('${c.id}','${String(c.nome).replace(/'/g,"\\'")}')">Excluir</button>
          </div>
        </div>`
      })
    }
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

function abrirEditarConcurso(id) {
  const c = (window._concursos||[]).find(function(x){ return x.id===id })
  if (!c) return
  document.getElementById('card-editar-concurso').style.display = 'block'
  document.getElementById('titulo-editar-concurso').textContent = 'Editar — ' + c.nome
  document.getElementById('edc-id').value = c.id
  document.getElementById('edc-nome').value = c.nome || ''
  document.getElementById('edc-banca').value = c.banca || ''
  document.getElementById('edc-data').value = c.data_prova || ''
  document.getElementById('msg-editar-concurso').textContent = ''
  document.getElementById('card-editar-concurso').scrollIntoView({ behavior:'smooth' })
}

function fecharEditarConcurso() {
  document.getElementById('card-editar-concurso').style.display = 'none'
}

async function salvarEdicaoConcurso() {
  const id = document.getElementById('edc-id').value
  const nome = document.getElementById('edc-nome').value.trim()
  const banca = document.getElementById('edc-banca').value.trim()
  const data_prova = document.getElementById('edc-data').value || null
  const msg = document.getElementById('msg-editar-concurso')
  if (!nome) { msg.style.color='var(--erro)'; msg.textContent='O nome do concurso e obrigatorio.'; return }
  msg.style.color='var(--tx3)'; msg.textContent='Salvando...'
  const { error } = await _supabase.from('concursos').update({ nome, banca, data_prova }).eq('id', id)
  if (error) { msg.style.color='var(--erro)'; msg.textContent='Erro: '+error.message; return }

  // Mantem a data da prova em sincronia com os planos ja gerados
  let extra = ''
  if (data_prova) {
    const { error: e2 } = await _supabase.from('config_cronograma').update({ data_prova }).eq('concurso_id', id)
    if (!e2) extra = ' A data foi replicada para os cronogramas ja gerados.'
  }
  msg.style.color='var(--ok)'
  msg.textContent='Concurso atualizado!'+extra
  await carregarConcursos()
}

async function excluirConcurso(id, nome) {
  const conf = prompt('ATENCAO: excluir o concurso "'+nome+'" remove tambem os editais, cronogramas, templates e avisos ligados a ele.\n\nPara confirmar, digite o nome do concurso:')
  if (!conf) return
  if (conf.trim() !== String(nome).trim()) { alert('Nome incorreto. Exclusao cancelada.'); return }
  const erros = []
  const tabelas = [
    ['sessoes_estudo','concurso_id'], ['config_cronograma','concurso_id'],
    ['tema_aluno_status','concurso_id'], ['edital_topicos','concurso_id'],
    ['plano_aluno','concurso_id'], ['avisos','concurso_id'],
    ['aluno_concursos','concurso_id']
  ]
  for (const t of tabelas) {
    const r = await _supabase.from(t[0]).delete().eq(t[1], id)
    if (r.error) erros.push(t[0]+': '+r.error.message)
  }
  const { data: tpl } = await _supabase.from('templates_cronograma').select('id').eq('concurso_id', id)
  if (tpl) for (const t of tpl) { await _supabase.from('template_itens').delete().eq('template_id', t.id) }
  await _supabase.from('templates_cronograma').delete().eq('concurso_id', id)
  await _supabase.from('alunos').update({ concurso_id: null }).eq('concurso_id', id)
  const r = await _supabase.from('concursos').delete().eq('id', id)
  if (r.error) erros.push('concursos: '+r.error.message)
  if (erros.length) { alert('Nem tudo foi removido:\n'+erros.join('\n')); return }
  alert('Concurso "'+nome+'" removido.')
  carregarConcursos()
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
function calcularDataExpiracao(meses) {
  if (!meses || meses === '0') return null
  const data = new Date()
  data.setMonth(data.getMonth() + parseInt(meses))
  return data.toISOString().split('T')[0]
}

async function criarAluno() {
  const nome = document.getElementById('novo-aluno-nome').value
  const email = document.getElementById('novo-aluno-email').value
  const senha = document.getElementById('novo-aluno-senha').value
  const concurso_id = document.getElementById('novo-aluno-concurso').value
  const duracaoAcesso = document.getElementById('novo-aluno-acesso')?.value || '0'
  const msg = document.getElementById('msg-aluno')
  if (!nome||!email||!senha||!concurso_id) { alert('Preencha todos os campos.'); return }
  if (senha.length < 6) { alert('Senha minimo 6 caracteres.'); return }

  msg.style.color = 'var(--tx3)'; msg.textContent = 'Cadastrando aluno...'

  const data_expiracao = calcularDataExpiracao(duracaoAcesso)

  // Usa signUp mas imediatamente restaura a sessao do admin
  const { data: adminSession } = await _supabase.auth.getSession()

  const { data, error } = await _supabase.auth.signUp({ email, password: senha })
  if (error) { msg.style.color='var(--erro)'; msg.textContent='Erro: '+error.message; return }

  const novoId = data.user.id

  // Restaura sessao do admin imediatamente
  if (adminSession?.session?.access_token) {
    await _supabase.auth.setSession({
      access_token: adminSession.session.access_token,
      refresh_token: adminSession.session.refresh_token
    })
  }

  // Salva dados do aluno
  const { error: erroAluno } = await _supabase.from('alunos').insert({ id: novoId, nome, email, concurso_id, data_expiracao })
  if (erroAluno) { msg.style.color='var(--erro)'; msg.textContent='Login criado, erro ao salvar dados: '+erroAluno.message; return }

  await _supabase.from('aluno_concursos').insert({ aluno_id: novoId, concurso_id }).catch(()=>{})

  msg.style.color='var(--ok)'
  const acessoTexto = data_expiracao ? ' Acesso ate ' + new Date(data_expiracao+'T00:00:00').toLocaleDateString('pt-BR') + '.' : ' Sem prazo de expiracao definido.'
  msg.textContent='Aluno '+nome+' cadastrado! Login: '+email+' / Senha: '+senha + acessoTexto

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
  if (!alunos||alunos.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhum aluno cadastrado.</p>'; return }

  // Campo de busca + ordenacao + botao exportar
  div.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    <input type="text" id="busca-aluno" placeholder="Buscar aluno..." oninput="filtrarAlunos()" style="margin:0;flex:1;min-width:160px">
    <select id="ordenar-alunos" onchange="filtrarAlunos()" style="margin:0;width:auto;min-width:170px">
      <option value="recente" selected>Mais recente primeiro</option>
      <option value="antigo">Mais antigo primeiro</option>
      <option value="nome-az">Nome A-Z</option>
      <option value="nome-za">Nome Z-A</option>
      <option value="expira-breve">Acesso expirando primeiro</option>
    </select>
    <button onclick="exportarAlunosCSV()" class="btn-acao btn-editar" style="padding:10px 16px;white-space:nowrap">Exportar CSV</button>
  </div>
  <div id="lista-alunos-inner"></div>`

  window._todosAlunos = alunos
  filtrarAlunos()
}

function filtrarAlunos() {
  const termo = document.getElementById('busca-aluno')?.value.toLowerCase() || ''
  const ordem = document.getElementById('ordenar-alunos')?.value || 'recente'

  let filtrados = window._todosAlunos.filter(a =>
    a.nome.toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo)
  )

  filtrados = [...filtrados].sort((a, b) => {
    if (ordem === 'nome-az') return a.nome.localeCompare(b.nome)
    if (ordem === 'nome-za') return b.nome.localeCompare(a.nome)
    if (ordem === 'recente') return new Date(b.criado_em || 0) - new Date(a.criado_em || 0)
    if (ordem === 'antigo') return new Date(a.criado_em || 0) - new Date(b.criado_em || 0)
    if (ordem === 'expira-breve') {
      const da = a.data_expiracao ? new Date(a.data_expiracao) : new Date('2099-12-31')
      const db = b.data_expiracao ? new Date(b.data_expiracao) : new Date('2099-12-31')
      return da - db
    }
    return 0
  })

  renderizarListaAlunos(filtrados)
}

function exportarAlunosCSV() {
  const alunos = window._todosAlunos
  if (!alunos || alunos.length === 0) { alert('Nenhum aluno para exportar.'); return }
  const cabecalho = 'Nome;Email;Concurso;Cadastrado em'
  const linhas = alunos.map(a => {
    const data = a.criado_em ? new Date(a.criado_em).toLocaleDateString('pt-BR') : ''
    const concurso = a.concursos?.nome || 'Sem concurso'
    return [a.nome, a.email, concurso, data].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')
  })
  const csv = '\uFEFF' + cabecalho + '\n' + linhas.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'alunos-patrulheiros-' + new Date().toISOString().split('T')[0] + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function statusAcesso(data_expiracao) {
  if (!data_expiracao) return { texto: 'Sem prazo definido', cor: 'var(--tx3)' }
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const exp = new Date(data_expiracao + 'T00:00:00')
  const dias = Math.round((exp - hoje) / (1000*60*60*24))
  const dataFmt = exp.toLocaleDateString('pt-BR')
  if (dias < 0) return { texto: 'Expirado em ' + dataFmt, cor: 'var(--erro)' }
  if (dias === 0) return { texto: 'Expira hoje', cor: 'var(--erro)' }
  if (dias <= 7) return { texto: 'Expira em ' + dias + ' dia(s) — ' + dataFmt, cor: 'var(--erro)' }
  if (dias <= 30) return { texto: 'Expira em ' + dias + ' dias — ' + dataFmt, cor: 'var(--alerta)' }
  return { texto: 'Acesso ate ' + dataFmt, cor: 'var(--ok)' }
}

function renderizarListaAlunos(alunos) {
  const div = document.getElementById('lista-alunos-inner')
  if (!div) return
  div.innerHTML = ''
  if (alunos.length === 0) { div.innerHTML='<p style="color:var(--tx3)">Nenhum aluno encontrado.</p>'; return }

  alunos.forEach(a => {
    const status = statusAcesso(a.data_expiracao)
    div.innerHTML += `<div class="item-lista" style="flex-wrap:wrap;gap:8px" id="card-aluno-${a.id}">
      <div style="flex:1;min-width:140px">
        <strong>${a.nome}</strong>
        <div style="color:var(--tx3);font-size:12px">${a.email}</div>
        <div style="color:var(--tx3);font-size:12px">${a.concursos?.nome||'Sem concurso'}</div>
        <div style="color:${status.cor};font-size:11px;margin-top:2px;font-weight:bold">${status.texto}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-acao btn-editar" onclick="abrirEditarAluno('${a.id}','${a.nome}','${a.email}','${a.concurso_id||''}')">Editar</button>
        <button class="btn-acao btn-editar" onclick="gerenciarConcursosAluno('${a.id}','${a.nome}')">Concursos</button>
        <button class="btn-acao btn-editar" onclick="irParaCronogramaAluno('${a.id}','${a.nome}')" style="background:#1a3a5c;color:var(--info);border:1px solid #4a8ab5">Cronograma</button>
        <button class="btn-acao" onclick="abrirAplicarTemplate('${a.id}','${a.nome}')" style="background:#1a3a1a;color:var(--ok);border:1px solid #81c784">Template</button>
        <button class="btn-acao btn-excluir" onclick="confirmarExcluirAluno('${a.id}','${a.nome}')">Excluir</button>
      </div>
    </div>`
  })
  div.innerHTML += `<p style="color:var(--tx3);font-size:12px;margin-top:8px">${alunos.length} aluno(s)</p>`
}

async function confirmarExcluirAluno(aluno_id, nome) {
  const confirmacao = prompt(
    'ATENCAO: Esta acao e irreversivel!\n\n' +
    'Isso vai remover o aluno "' + nome + '" da plataforma, incluindo:\n' +
    '- Todos os registros de estudo\n' +
    '- Plano de estudos\n' +
    '- Progresso no edital\n\n' +
    'Para confirmar, digite o nome do aluno exatamente como esta:'
  )
  if (!confirmacao) return
  if (confirmacao.trim() !== nome.trim()) {
    alert('Nome incorreto. Exclusao cancelada.')
    return
  }
  await excluirAluno(aluno_id, nome)
}

async function excluirAluno(aluno_id, nome) {
  const card = document.getElementById('card-aluno-' + aluno_id)
  if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none' }

  const erros = []

  const r1 = await _supabase.from('edital_progresso').delete().eq('aluno_id', aluno_id)
  if (r1.error) erros.push('edital_progresso: ' + r1.error.message)

  const r2 = await _supabase.from('registros_diarios').delete().eq('aluno_id', aluno_id)
  if (r2.error) erros.push('registros_diarios: ' + r2.error.message)

  const r3 = await _supabase.from('revisoes_programadas').delete().eq('aluno_id', aluno_id)
  if (r3.error) erros.push('revisoes_programadas: ' + r3.error.message)

  const r4 = await _supabase.from('plano_aluno').delete().eq('aluno_id', aluno_id)
  if (r4.error) erros.push('plano_aluno: ' + r4.error.message)

  const r5 = await _supabase.from('aluno_concursos').delete().eq('aluno_id', aluno_id)
  if (r5.error) erros.push('aluno_concursos: ' + r5.error.message)

  const r6 = await _supabase.from('alunos').delete().eq('id', aluno_id)
  if (r6.error) erros.push('alunos: ' + r6.error.message)

  if (erros.length > 0) {
    if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto' }
    alert('ATENCAO: Nem tudo foi excluido corretamente!\n\nErros encontrados:\n' + erros.join('\n') + '\n\nProvavelmente falta permissao (RLS) no Supabase. Peca ajuda para adicionar as policies de DELETE nas tabelas listadas acima.')
    return
  }

  // Confirma que o aluno realmente sumiu do banco antes de comemorar
  const { data: verificacao } = await _supabase.from('alunos').select('id').eq('id', aluno_id)
  if (verificacao && verificacao.length > 0) {
    if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto' }
    alert('ATENCAO: O aluno ainda existe no banco de dados apos a tentativa de exclusao.\n\nIsso geralmente significa que falta uma politica de seguranca (RLS) de DELETE na tabela alunos. Peca ajuda para adicionar essa permissao no Supabase.')
    return
  }

  // So remove da tela se realmente foi excluido do banco
  if (card) card.remove()
  if (window._todosAlunos) {
    window._todosAlunos = window._todosAlunos.filter(a => a.id !== aluno_id)
  }

  const inner = document.getElementById('lista-alunos-inner')
  const total = inner ? inner.querySelectorAll('.item-lista').length : 0
  const countEl = inner ? inner.querySelector('p:last-child') : null
  if (countEl) countEl.textContent = total + ' aluno(s)'

  alert('Aluno "' + nome + '" removido com sucesso e confirmado no banco de dados.\n\nLembre-se de remover tambem o login no Supabase > Authentication > Users se necessario.')
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
  if (sel) sel.value = concurso_id || ''
  document.getElementById('msg-editar-aluno').textContent = ''
  document.getElementById('card-editar-aluno').scrollIntoView({ behavior:'smooth' })
  // Carrega senha atual como placeholder
  const senhaInput = document.getElementById('editar-aluno-senha')
  if (senhaInput) { senhaInput.value = ''; senhaInput.placeholder = 'Nova senha (deixe vazio para nao alterar)' }

  // Carrega data de expiracao atual
  const aluno = window._todosAlunos?.find(a => a.id === id)
  const dataInput = document.getElementById('editar-aluno-data-expiracao')
  if (dataInput) dataInput.value = aluno?.data_expiracao || ''
}

function estenderAcesso(meses) {
  const dataInput = document.getElementById('editar-aluno-data-expiracao')
  if (!dataInput) return
  const base = dataInput.value ? new Date(dataInput.value+'T00:00:00') : new Date()
  base.setMonth(base.getMonth() + meses)
  dataInput.value = base.toISOString().split('T')[0]
}

async function salvarEdicaoAluno() {
  const id = document.getElementById('editar-aluno-id').value
  const nome = document.getElementById('editar-aluno-nome').value
  const email = document.getElementById('editar-aluno-email').value
  const concurso_id = document.getElementById('editar-aluno-concurso').value
  const novaSenha = document.getElementById('editar-aluno-senha')?.value || ''
  const data_expiracao = document.getElementById('editar-aluno-data-expiracao')?.value || null
  const msg = document.getElementById('msg-editar-aluno')

  if (!nome||!email) { msg.style.color='var(--erro)'; msg.textContent='Preencha nome e e-mail.'; return }

  msg.style.color='var(--tx3)'; msg.textContent='Salvando...'

  // Atualiza dados na tabela alunos
  const { error } = await _supabase.from('alunos')
    .update({ nome, email, concurso_id: concurso_id||null, data_expiracao: data_expiracao||null }).eq('id', id)
  if (error) { msg.style.color='var(--erro)'; msg.textContent='Erro: '+error.message; return }

  // Atualiza cache local
  const alunoCache = window._todosAlunos?.find(a => a.id === id)
  if (alunoCache) alunoCache.data_expiracao = data_expiracao

  // Se digitou nova senha, envia link de redefinicao por email
  if (novaSenha && novaSenha.length >= 6) {
    msg.style.color='var(--tx3)'; msg.textContent='Atualizando dados e redefinindo senha...'
    // Usa updateUser via admin (funciona pois o admin esta logado)
    // Como nao temos acesso direto ao auth.admin via anon key,
    // enviamos email de redefinicao como alternativa segura
    await _supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://patrulheirojota.com.br/nova-senha.html'
    })
    msg.style.color='var(--ok)'
    msg.textContent='Dados salvos! Um link de redefinicao de senha foi enviado para ' + email
  } else {
    msg.style.color='var(--ok)'; msg.textContent='Dados salvos com sucesso!'
  }

  // Atualiza o card na lista sem recarregar tudo
  const card = document.getElementById('card-aluno-' + id)
  if (card) {
    const strong = card.querySelector('strong')
    const divs = card.querySelectorAll('div[style*="color:var(--tx3)"]')
    if (strong) strong.textContent = nome
    if (divs[0]) divs[0].textContent = email
    if (divs[1] && concurso_id) {
      const concurso = window._concursos?.find(c => c.id === concurso_id)
      if (concurso) divs[1].textContent = concurso.nome
    }
  }
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
  if (!vinculos||vinculos.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhum concurso vinculado.</p>'; return }
  vinculos.forEach(v => {
    div.innerHTML += `<div class="item-lista">
      <div><strong>${v.concursos?.nome}</strong><div style="color:var(--tx3);font-size:12px">${v.concursos?.banca||''}</div></div>
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
  if (!templates||templates.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhum template para este concurso.</p>'; return }
  templates.forEach(t => {
    div.innerHTML += `<div class="item-lista" style="flex-wrap:wrap;gap:8px">
      <div style="flex:1"><strong>${t.nome}</strong><div style="color:var(--tx3);font-size:12px">${t.descricao||''}</div></div>
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
  document.getElementById('lista-itens-template').innerHTML = '<p style="color:var(--tx3)">Nenhum item ainda. Adicione abaixo.</p>'
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
  if (!itens||itens.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhum item ainda.</p>'; return }
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
        <strong style="color:var(--ouro)">${nomeDias[dia]}</strong>
        <span style="color:var(--tx3);font-size:12px">${Math.floor(totalMin/60)>0?Math.floor(totalMin/60)+'h ':''}${totalMin%60>0?totalMin%60+'min':''}</span>
      </div>
      ${itensDia.map(i=>`<div class="item-lista" style="margin-bottom:4px">
        <strong style="min-width:140px">${i.disciplina}</strong>
        <span style="color:var(--tx3);font-size:13px">${i.tempo_minutos}min</span>
        <span style="color:var(--tx3);font-size:13px">${i.meta_questoes}q</span>
        <button class="btn-acao btn-excluir" onclick="excluirItemTemplate('${i.id}','${template_id}','${nome}')">X</button>
      </div>`).join('')}
    </div>`
  })
  const hSemana = Math.floor(totalMinSemana/60)
  const mSemana = totalMinSemana%60
  div.innerHTML += `<div style="background:var(--card2);border-radius:8px;padding:10px;text-align:center;color:var(--ouro);font-size:13px">
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
  if (!itens||itens.length===0) { div.innerHTML='<p style="color:var(--tx3)">Template sem itens.</p>'; return }
  itens.sort((a,b)=>diasOrdem[a.dia_semana]-diasOrdem[b.dia_semana])
  const porDia = {}
  itens.forEach(i=>{ if (!porDia[i.dia_semana]) porDia[i.dia_semana]=[]; porDia[i.dia_semana].push(i) })
  div.innerHTML = '<p style="color:var(--ouro);font-size:13px;margin-bottom:10px">Ajuste a carga horaria se necessario (opcional):</p>'
  Object.keys(porDia).sort((a,b)=>diasOrdem[a]-diasOrdem[b]).forEach(dia => {
    div.innerHTML += `<div style="margin-bottom:12px">
      <strong style="color:var(--tx3);font-size:13px">${nomeDias[dia]}</strong>
      ${porDia[dia].map(i=>`<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
        <span style="flex:1;font-size:13px">${i.disciplina}</span>
        <input type="number" id="adj-${i.id}" value="${i.tempo_minutos}" min="15" step="15"
          style="width:80px;padding:6px;border-radius:6px;border:1px solid var(--bd2);background:var(--card2);color:#fff;font-size:13px">
        <span style="color:var(--tx3);font-size:12px">min</span>
        <input type="number" id="adjq-${i.id}" value="${i.meta_questoes}" min="0"
          style="width:70px;padding:6px;border-radius:6px;border:1px solid var(--bd2);background:var(--card2);color:#fff;font-size:13px">
        <span style="color:var(--tx3);font-size:12px">q</span>
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
  if (!vinculos||vinculos.length===0) { divAlunos.innerHTML='<p style="color:var(--tx3)">Nenhum aluno neste concurso.</p>'; return }
  divAlunos.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:10px">
    <button class="btn-acao btn-editar" onclick="selecionarTodosAlunos(true)">Selecionar todos</button>
    <button class="btn-acao" onclick="selecionarTodosAlunos(false)" style="background:var(--btn);color:var(--tx3);border:1px solid var(--bd2)">Desmarcar todos</button>
  </div>`
  vinculos.forEach(v => {
    if (!v.alunos) return
    divAlunos.innerHTML += `<label style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--card2);border-radius:6px;margin-bottom:4px;cursor:pointer">
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
  div.innerHTML=''
  if (!concurso_id) return
  div.innerHTML='<p style="color:var(--tx3);font-size:13px">Carregando...</p>'

  const { data: vinculos } = await _supabase.from('aluno_concursos')
    .select('aluno_id, alunos(nome)').eq('concurso_id', concurso_id)
  if (!vinculos||!vinculos.length) { div.innerHTML='<p style="color:var(--tx3)">Nenhum aluno vinculado.</p>'; return }

  const ids = vinculos.map(function(v){return v.aluno_id})
  // UMA consulta para os planos de todos os alunos
  const { data: todos } = await _supabase.from('plano_aluno').select('*')
    .in('aluno_id', ids).eq('concurso_id', concurso_id)

  const porAluno={}
  ;(todos||[]).forEach(function(i){ if(!porAluno[i.aluno_id])porAluno[i.aluno_id]=[]; porAluno[i.aluno_id].push(i) })

  div.innerHTML='<p style="color:var(--tx3);font-size:13px;margin-bottom:12px">'+vinculos.length+' aluno(s)</p>'
  vinculos.forEach(function(v){
    const itens = porAluno[v.aluno_id]||[]
    const nome = v.alunos?v.alunos.nome:''
    if (!itens.length) {
      div.innerHTML += '<div class="bloco-viz"><strong style="color:var(--ouro)">'+nome+'</strong>'
        +'<span style="color:var(--erro);font-size:13px;float:right">Sem plano</span></div>'
      return
    }
    itens.sort(function(a,b){return diasOrdem[a.dia_semana]-diasOrdem[b.dia_semana]})
    const totalMin=itens.reduce(function(s,i){return s+i.tempo_minutos},0)
    const pers=itens.filter(function(i){return i.tempo_personalizado}).length
    div.innerHTML += '<div class="bloco-viz">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">'
      +'<strong style="color:var(--ouro)">'+nome+'</strong>'
      +'<div style="display:flex;gap:8px;align-items:center">'
      +(pers>0?'<span style="color:var(--ouro);font-size:11px;padding:2px 8px;border:1px solid var(--ouro);border-radius:10px">'+pers+' personalizado(s)</span>':'')
      +'<span style="color:var(--tx3);font-size:12px">'+itens.length+' disc · '+(Math.floor(totalMin/60)>0?Math.floor(totalMin/60)+'h ':'')+(totalMin%60>0?totalMin%60+'min':'')+'/sem</span></div></div>'
      +itens.map(function(i){
        return '<div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid var(--bd);font-size:13px;flex-wrap:wrap">'
          +'<span style="color:var(--tx3);min-width:70px">'+nomeDias[i.dia_semana]+'</span>'
          +'<span style="flex:1">'+i.disciplina+'</span>'
          +'<span style="color:'+(i.tempo_personalizado?'var(--ouro)':'var(--tx3)')+'">'+i.tempo_minutos+'min'+(i.tempo_personalizado?' *':'')+'</span>'
          +'<span style="color:var(--tx3)">'+i.meta_questoes+'q</span></div>'
      }).join('')
      +(pers>0?'<p style="color:var(--ouro);font-size:11px;margin-top:6px">* ajustado pelo aluno</p>':'')
      +'</div>'
  })
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
  if (!itens||itens.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhuma disciplina no plano. Adicione manualmente ou aplique um template pela aba Alunos.</p>'; return }

  // Botao para remover o plano inteiro
  div.innerHTML += `<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <button class="btn-acao btn-excluir" onclick="removerPlanoInteiro('${aluno_id}','${concurso_id}')" style="padding:8px 14px">Remover plano inteiro (${itens.length} itens)</button>
  </div>`
  itens.sort((a,b)=>diasOrdem[a.dia_semana]-diasOrdem[b.dia_semana])
  const porDia = {}
  itens.forEach(i=>{ if (!porDia[i.dia_semana]) porDia[i.dia_semana]=[]; porDia[i.dia_semana].push(i) })
  Object.keys(porDia).sort((a,b)=>diasOrdem[a]-diasOrdem[b]).forEach(dia => {
    const itensDia = porDia[dia]
    const totalMin = itensDia.reduce((s,i)=>s+i.tempo_minutos,0)
    div.innerHTML += `<div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <strong style="color:var(--ouro)">${nomeDias[dia]}</strong>
        <span style="color:var(--tx3);font-size:12px">${Math.floor(totalMin/60)>0?Math.floor(totalMin/60)+'h ':''}${totalMin%60>0?totalMin%60+'min':''} · ${itensDia.length} disc.</span>
      </div>
      ${itensDia.map(i=>`<div class="item-lista" id="item-${i.id}" style="flex-wrap:wrap;gap:8px">
        <div id="view-${i.id}" style="display:flex;gap:10px;align-items:center;flex:1;flex-wrap:wrap">
          <strong style="min-width:130px">${i.disciplina}</strong>
          <span style="color:${i.tempo_personalizado?'#C9A83C':'var(--tx3)'};font-size:13px">${i.tempo_minutos}min${i.tempo_personalizado?' *':''}</span>
          <span style="color:var(--tx3);font-size:13px">${i.meta_questoes}q</span>
          <div style="display:flex;gap:6px;margin-left:auto">
            <button class="btn-acao btn-editar" onclick="editarItemPlano('${i.id}')">Editar</button>
            <button class="btn-acao btn-excluir" onclick="excluirItemPlano('${i.id}','${aluno_id}','${concurso_id}')">Excluir</button>
          </div>
        </div>
        <div id="edit-${i.id}" style="display:none;width:100%;background:var(--card2);border-radius:8px;padding:10px;margin-top:4px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input type="text" id="edit-disc-${i.id}" value="${i.disciplina}" style="flex:2;min-width:120px">
            <input type="number" id="edit-tempo-${i.id}" value="${i.tempo_minutos}" style="width:80px">
            <input type="number" id="edit-quest-${i.id}" value="${i.meta_questoes}" style="width:80px">
            <select id="edit-dia-${i.id}" style="flex:1;min-width:110px">
              ${['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(d=>`<option value="${d}" ${d===i.dia_semana?'selected':''}>${nomeDias[d]}</option>`).join('')}
            </select>
            <button class="btn-acao btn-editar" onclick="salvarEdicaoItemPlano('${i.id}','${aluno_id}','${concurso_id}')">Salvar</button>
            <button class="btn-acao" onclick="cancelarEdicaoItem('${i.id}')" style="background:var(--btn);color:var(--tx3);border:1px solid var(--bd2)">X</button>
          </div>
        </div>
      </div>`).join('')}
    </div>`
  })
}

async function removerPlanoInteiro(aluno_id, concurso_id) {
  const confirma = prompt('Isso vai remover TODAS as disciplinas do plano deste aluno neste concurso.\n\nPara confirmar, digite: REMOVER')
  if (!confirma) return
  if (confirma.trim().toUpperCase() !== 'REMOVER') { alert('Confirmacao incorreta. Nada foi removido.'); return }
  const { error } = await _supabase.from('plano_aluno').delete()
    .eq('aluno_id', aluno_id).eq('concurso_id', concurso_id)
  if (error) { alert('Erro: ' + error.message); return }
  alert('Plano removido com sucesso!')
  renderizarPlano(aluno_id, concurso_id)
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
  if (!revisoes||revisoes.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhuma revisao programada.</p>'; return }
  revisoes.forEach(r => {
    const data = new Date(r.data_revisao+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})
    div.innerHTML += `<div class="item-lista">
      <span>${r.tipo==='exercicios'?'Exercicios':'Revisao'}</span>
      <strong>${r.disciplina}</strong>
      <span style="color:var(--ouro)">${data}</span>
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
  const div = document.getElementById('lista-inatividade')
  div.innerHTML='<p style="color:var(--tx3);font-size:13px">Verificando...</p>'

  // UMA consulta para os alunos e UMA para todos os registros
  const [ra, rr] = await Promise.all([
    _supabase.from('alunos').select('id,nome,email,concursos(nome)'),
    _supabase.from('registros_diarios').select('aluno_id,data').order('data',{ascending:false})
  ])
  const alunos = ra.data||[]
  const ultimo = {}
  ;(rr.data||[]).forEach(function(r){ if(!ultimo[r.aluno_id]) ultimo[r.aluno_id]=r.data })

  const inativos=[]
  alunos.forEach(function(aluno){
    const ud = ultimo[aluno.id]
    if (ud && ud >= dataLimite) return
    const diasSem = ud ? Math.floor((new Date()-new Date(ud+'T12:00:00'))/86400000) : null
    inativos.push({aluno:aluno, ultimaData:ud||null, diasSem:diasSem})
  })

  div.innerHTML=''
  if (!inativos.length) { div.innerHTML='<p style="color:var(--ok)">Nenhum aluno inativo nos ultimos '+dias+' dias!</p>'; return }
  inativos.sort(function(a,b){ return (b.diasSem||9999)-(a.diasSem||9999) })
  inativos.forEach(function(x){
    const cor = x.diasSem>7?'var(--erro)':'var(--alerta)'
    const msg = x.ultimaData ? 'Ha '+x.diasSem+' dias' : 'Nunca registrou'
    div.innerHTML += '<div class="item-lista" style="border-left:4px solid '+cor+'">'
      +'<div><strong>'+x.aluno.nome+'</strong><div style="color:var(--tx3);font-size:12px">'+x.aluno.email+'</div></div>'
      +'<span style="color:'+cor+';font-size:13px">'+msg+'</span>'
      +'<button class="btn-acao btn-editar" onclick="verRelatorioIndividual(\''+x.aluno.id+'\',\''+String(x.aluno.nome).replace(/'/g,"\\'")+'\')">Ver historico</button></div>'
  })
}

async function carregarDesempenho() {
  const concurso_id = document.getElementById('filtro-desempenho-concurso').value
  const div = document.getElementById('lista-desempenho')
  if (!concurso_id) { div.innerHTML=''; return }
  div.innerHTML='<p style="color:var(--tx3)">Carregando...</p>'

  const sete = new Date(); sete.setDate(sete.getDate()-7)
  const dataLimite = sete.toISOString().split('T')[0]

  const { data: vinculos } = await _supabase.from('aluno_concursos')
    .select('aluno_id,alunos(id,nome)').eq('concurso_id',concurso_id)
  if (!vinculos||!vinculos.length) { div.innerHTML='<p style="color:var(--tx3)">Nenhum aluno nesse concurso.</p>'; return }

  const ids = vinculos.map(function(v){return v.aluno_id})
  // UMA consulta para todos os registros da turma
  const { data: regs } = await _supabase.from('registros_diarios')
    .select('aluno_id,cumpriu,questoes_feitas,questoes_certas').in('aluno_id',ids).gte('data',dataLimite)

  const porAluno={}
  ;(regs||[]).forEach(function(r){
    if(!porAluno[r.aluno_id])porAluno[r.aluno_id]={t:0,c:0,q:0,a:0}
    const x=porAluno[r.aluno_id]
    x.t++; if(r.cumpriu)x.c++
    x.q+=r.questoes_feitas||0; x.a+=r.questoes_certas||0
  })

  const linhas=[]
  vinculos.forEach(function(v){
    const aluno=v.alunos; if(!aluno)return
    const x=porAluno[aluno.id]||{t:0,c:0,q:0,a:0}
    const pctA=x.q>0?Math.round(x.a/x.q*100):0
    const pctC=x.t>0?Math.round(x.c/x.t*100):0
    linhas.push({aluno:aluno,totalDias:x.t,diasC:x.c,totalQ:x.q,pctA:pctA,pctC:pctC,
      cor:pctC>=70?'var(--ok)':pctC>=40?'var(--alerta)':'var(--erro)'})
  })
  linhas.sort(function(a,b){return a.pctC-b.pctC})
  div.innerHTML=linhas.map(function(l){
    return '<div class="item-lista" style="border-left:4px solid '+l.cor+'">'
      +'<strong>'+l.aluno.nome+'</strong>'
      +'<span>'+l.diasC+'/'+l.totalDias+' dias ('+l.pctC+'%)</span>'
      +'<span>'+l.totalQ+' questoes</span><span>'+l.pctA+'% acerto</span>'
      +'<button class="btn-acao btn-editar" onclick="verRelatorioIndividual(\''+l.aluno.id+'\',\''+String(l.aluno.nome).replace(/'/g,"\\'")+'\')">Detalhar</button></div>'
  }).join('')
}

async function verRelatorioIndividual(aluno_id, nome) {
  document.getElementById('card-relatorio-individual').style.display='block'
  document.getElementById('titulo-relatorio-individual').textContent='Historico — '+nome
  document.getElementById('card-relatorio-individual').scrollIntoView({behavior:'smooth'})
  const { data: reg } = await _supabase.from('registros_diarios').select('*').eq('aluno_id',aluno_id).order('data',{ascending:false}).limit(30)
  const div = document.getElementById('conteudo-relatorio-individual')
  div.innerHTML=''
  if (!reg||reg.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhum registro.</p>'; return }
  const totalQ=reg.reduce((s,r)=>s+(r.questoes_feitas||0),0)
  const totalC=reg.reduce((s,r)=>s+(r.questoes_certas||0),0)
  const pct=totalQ>0?Math.round((totalC/totalQ)*100):0
  const diasC=reg.filter(r=>r.cumpriu).length
  div.innerHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    ${[['#C9A83C',reg.length,'registros'],['var(--ok)',diasC,'cumpridos'],['#C9A83C',totalQ,'questoes'],['var(--ok)',pct+'%','acerto']].map(([c,v,l])=>`
    <div style="background:var(--card2);border-radius:8px;padding:12px;flex:1;min-width:80px;text-align:center">
      <div style="color:${c};font-size:22px;font-weight:bold">${v}</div>
      <div style="color:var(--tx3);font-size:12px">${l}</div>
    </div>`).join('')}</div>`
  const porData={}
  reg.forEach(r=>{ if (!porData[r.data]) porData[r.data]=[]; porData[r.data].push(r) })
  Object.keys(porData).sort((a,b)=>b.localeCompare(a)).forEach(data=>{
    const itens=porData[data]
    const tD=itens.reduce((s,r)=>s+(r.questoes_feitas||0),0)
    const cD=itens.reduce((s,r)=>s+(r.questoes_certas||0),0)
    const pD=tD>0?Math.round((cD/tD)*100):0
    const fmt=new Date(data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})
    div.innerHTML+=`<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <strong style="color:var(--ouro)">${fmt}</strong>
        <span style="color:var(--tx3);font-size:12px">${tD} questoes · ${pD}%</span>
      </div>
      ${itens.map(r=>`<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--bd);flex-wrap:wrap;align-items:center" id="reg-${r.id}">
        <span>${r.cumpriu?'OK':'X'}</span><span style="flex:1;font-size:13px">${r.disciplina}</span>
        <span style="color:var(--tx3);font-size:12px">${r.questoes_feitas||0} · ${r.questoes_certas||0} certas</span>
        <button class="btn-acao btn-editar" onclick="editarRegistro('${r.id}',${r.questoes_feitas||0},${r.questoes_certas||0},${r.cumpriu})" style="font-size:11px;padding:3px 8px">Editar</button>
        <button class="btn-acao btn-excluir" onclick="excluirRegistro('${r.id}','${aluno_id}','${nome}')" style="font-size:11px;padding:3px 8px">X</button>
      </div>`).join('')}
    </div>`
  })
}

function fecharRelatorioIndividual() { document.getElementById('card-relatorio-individual').style.display='none' }

async function editarRegistro(id, feitas, certas, cumpriu) {
  const novasFeitas = prompt('Questoes feitas:', feitas)
  if (novasFeitas === null) return
  const novasCertas = prompt('Questoes certas:', certas)
  if (novasCertas === null) return
  const novoCumpriu = confirm('O aluno cumpriu o tempo de estudo neste dia?\n\nOK = Sim | Cancelar = Nao')
  const f = parseInt(novasFeitas)||0
  const c = parseInt(novasCertas)||0
  const { error } = await _supabase.from('registros_diarios')
    .update({ questoes_feitas: f, questoes_certas: c, questoes_erradas: Math.max(0, f-c), cumpriu: novoCumpriu })
    .eq('id', id)
  if (error) { alert('Erro: ' + error.message); return }
  alert('Registro atualizado!')
  const el = document.getElementById('reg-'+id)
  if (el) {
    el.querySelector('span:first-child').textContent = novoCumpriu ? 'OK' : 'X'
    el.querySelectorAll('span')[2].textContent = f + ' · ' + c + ' certas'
  }
}

async function excluirRegistro(id, aluno_id, nome) {
  if (!confirm('Excluir este registro? Isso afeta o streak e as estatisticas do aluno.')) return
  const { error } = await _supabase.from('registros_diarios').delete().eq('id', id)
  if (error) { alert('Erro: ' + error.message); return }
  const el = document.getElementById('reg-'+id)
  if (el) el.remove()
}

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
  if (!avisos||avisos.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhum aviso.</p>'; return }
  avisos.forEach(a=>{
    const data=new Date(a.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
    div.innerHTML+=`<div class="item-lista" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
        <strong>${a.titulo}</strong>
        <div style="display:flex;gap:6px"><span style="color:var(--tx3);font-size:12px">${data}</span>
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
