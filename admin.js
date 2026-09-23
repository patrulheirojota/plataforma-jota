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
  const foco = sessionStorage.getItem('alunoFoco')
  if (foco) {
    sessionStorage.removeItem('alunoFoco')
    setTimeout(function(){
      const el = document.getElementById('card-aluno-'+foco)
      if (el) {
        el.scrollIntoView({behavior:'smooth',block:'center'})
        el.style.borderColor='var(--ouro)'
        el.style.boxShadow='0 0 0 2px rgba(201,168,60,.25)'
        setTimeout(function(){ el.style.boxShadow='' },2600)
      }
    }, 500)
  }
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
  'aba-desempenho':['Desempenho','Inatividade e evolucao da turma'],
  'aba-evolucao':['Evolucao','Suas anotacoes sobre cada aluno'],
  'aba-ciclos':['Relatorio 21 dias','Avaliacao periodica de cada aluno']
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
    const m1=document.getElementById('mob-t1'), m2=document.getElementById('mob-t2')
    if(m1)m1.textContent=t[0]
    if(m2)m2.textContent=t[1]
  }
  window.scrollTo({top:0,behavior:'smooth'})
  if (id === 'aba-alunos') carregarAlunos()
  if (id === 'aba-cronograma') carregarSelectsCronograma()
  if (id === 'aba-desempenho') carregarSelectDesempenho()
  if (id === 'aba-avisos') carregarSelectsAvisos()
  if (id === 'aba-evolucao') carregarSelectAnotacoes()
  if (id === 'aba-ciclos') carregarCiclos()
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
                'filtro-desempenho-concurso','aviso-concurso','filtro-avisos']
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

  const restaurarAdmin = async function() {
    if (adminSession?.session?.access_token) {
      await _supabase.auth.setSession({
        access_token: adminSession.session.access_token,
        refresh_token: adminSession.session.refresh_token
      })
    }
  }

  let novoId = null
  let reaproveitado = false
  const { data, error } = await _supabase.auth.signUp({ email, password: senha })

  if (error) {
    // E-mail ja tem login: normalmente e um cadastro que falhou no meio do caminho.
    // Tentamos entrar com a senha digitada para recuperar o ID e completar o cadastro.
    if (/already|existe|registered/i.test(error.message)) {
      msg.textContent = 'Este e-mail ja tem login. Tentando recuperar o cadastro...'
      const rec = await _supabase.auth.signInWithPassword({ email, password: senha })
      await restaurarAdmin()
      if (rec.error || !rec.data || !rec.data.user) {
        msg.style.color='var(--erro)'
        msg.innerHTML = 'Este e-mail <strong>ja tem login criado</strong> e a senha digitada nao confere.<br>'
          + '• Se foi um cadastro que falhou antes, digite a MESMA senha usada naquela vez e clique de novo.<br>'
          + '• Se o aluno ja existe, procure o nome na lista abaixo.<br>'
          + '• Se quiser recomecar do zero, apague o usuario em Supabase > Authentication > Users e cadastre de novo.'
        return
      }
      novoId = rec.data.user.id
      reaproveitado = true
    } else {
      msg.style.color='var(--erro)'; msg.textContent='Erro: '+error.message; return
    }
  } else {
    novoId = data.user.id
    await restaurarAdmin()
  }

  // Ja existe ficha deste aluno?
  const { data: jaTem } = await _supabase.from('alunos').select('id,nome').eq('id', novoId).maybeSingle()
  if (jaTem) {
    msg.style.color='var(--alerta)'
    msg.textContent = 'Este aluno ja estava cadastrado como "'+jaTem.nome+'". Nada foi duplicado.'
    await carregarAlunos()
    return
  }

  // Salva dados do aluno
  const { error: erroAluno } = await _supabase.from('alunos').insert({ id: novoId, nome, email, concurso_id, data_expiracao })
  if (erroAluno) { msg.style.color='var(--erro)'; msg.textContent='Login criado, erro ao salvar dados: '+erroAluno.message; return }
  if (reaproveitado) msg.textContent = 'Cadastro recuperado e concluido.'

  try { await _supabase.from('aluno_concursos').insert({ aluno_id: novoId, concurso_id }) } catch(e) {}

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
  div.innerHTML = `<div class="barra-busca" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;position:sticky;top:60px;z-index:20;background:var(--card);padding:10px 0">
    <input type="text" id="busca-aluno" placeholder="Buscar aluno..." oninput="filtrarAlunos()" style="margin:0;flex:1;min-width:160px">
    <select id="ordenar-alunos" onchange="filtrarAlunos()" style="margin:0;width:auto;min-width:170px">
      <option value="recente" selected>Mais recente primeiro</option>
      <option value="antigo">Mais antigo primeiro</option>
      <option value="nome-az">Nome A-Z</option>
      <option value="nome-za">Nome Z-A</option>
      <option value="sem-acesso">Sumido ha mais tempo</option>
      <option value="mexeu">Quem mexeu no cronograma</option>
      <option value="expira-breve">Acesso expirando primeiro</option>
      <option value="bloqueados">Bloqueados por inatividade</option>
    </select>
    <button onclick="exportarAlunosCSV()" class="btn-acao btn-editar" style="padding:10px 16px;white-space:nowrap">Exportar CSV</button>
  </div>
  <div id="lista-alunos-inner"></div>`

  window._todosAlunos = alunos
  try {
    const { data: mc } = await _supabase.from('config_marca').select('*').eq('id',1).maybeSingle()
    window._diasBloqueio = (mc && mc.dias_bloqueio) ? mc.dias_bloqueio : 20
  } catch(e) { window._diasBloqueio = 20 }
  await carregarAlertas()
  await calcularCiclos()
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
    if (ordem === 'sem-acesso') {
      const ta = a.ultimo_acesso ? new Date(a.ultimo_acesso).getTime() : 0
      const tb = b.ultimo_acesso ? new Date(b.ultimo_acesso).getTime() : 0
      return ta - tb
    }
    if (ordem === 'mexeu') {
      const al = window._alertasAluno||{}
      const ma = (al[a.id]&&al[a.id].mudou)?0:1
      const mb = (al[b.id]&&al[b.id].mudou)?0:1
      if (ma !== mb) return ma - mb
      const da = (al[a.id]&&al[a.id].ajuste)?new Date(al[a.id].ajuste).getTime():0
      const db = (al[b.id]&&al[b.id].ajuste)?new Date(al[b.id].ajuste).getTime():0
      return db - da
    }
    if (ordem === 'bloqueados') {
      const ba = alunoBloqueado(a), bb = alunoBloqueado(b)
      if ((ba>0) !== (bb>0)) return ba>0 ? -1 : 1
      return bb - ba
    }
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
  const alertas = window._alertasAluno || {}

  alunos.forEach(a => {
    const status = statusAcesso(a.data_expiracao)
    const al = alertas[a.id] || {}
    const acesso = tempoRelativo(a.ultimo_acesso)
    const estudo = al.estudo ? tempoRelativo(al.estudo+'T12:00:00') : null
    const ajuste = tempoRelativo(al.ajuste)
    const plano  = tempoRelativo(al.plano)

    const bloq = alunoBloqueado(a)
    const ci = (window._ciclos||{})[a.id]
    const corEstudo = !al.estudo ? 'var(--erro)'
      : (Math.floor((Date.now()-new Date(al.estudo+'T12:00:00').getTime())/86400000) > 3 ? 'var(--alerta)' : 'var(--ok)')

    div.innerHTML += `<div class="item-lista" style="flex-wrap:wrap;gap:8px" id="card-aluno-${a.id}">
      <div style="flex:1;min-width:190px">
        <strong>${a.nome}</strong>
        <div style="color:var(--tx3);font-size:12px">${a.email}</div>
        <div style="color:var(--tx3);font-size:12px">${a.concursos?.nome||'Sem concurso'}</div>
        <div style="color:${status.cor};font-size:11px;margin-top:2px;font-weight:bold">${status.texto}</div>
        ${(ci&&ci.vencido) ? `<div style="margin-top:6px;padding:7px 10px;border-radius:8px;background:rgba(232,176,75,.10);border:1px solid var(--alerta);color:var(--alerta);font-size:11.5px;font-weight:700">
          🗓️ Relatorio de 21 dias (ciclo ${ci.ciclo}) ${ci.atraso>0?('vencido ha '+ci.atraso+' dia(s)'):'fecha hoje'} — periodo ${ci.iniBR} a ${ci.fimBR}</div>` : ''}
        ${bloq ? `<div style="margin-top:6px;padding:7px 10px;border-radius:8px;background:rgba(240,113,113,.10);border:1px solid var(--erro);color:var(--erro);font-size:11.5px;font-weight:700">
          🔒 Bloqueado por inatividade (${bloq} dias sem acessar). Aguardando taxa de reabilitacao.</div>` : ''}

        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:7px;font-size:11.5px">
          <span style="color:var(--tx4)">Ultimo acesso: <strong style="color:${acesso?'var(--tx2)':'var(--tx4)'}">${acesso||'nunca entrou'}</strong></span>
          <span style="color:var(--tx4)">Ultimo estudo: <strong style="color:${corEstudo}">${estudo||'nunca'}</strong></span>
        </div>
        ${ajuste ? `<div style="font-size:11.5px;margin-top:4px;color:${al.mudou?'var(--info)':'var(--tx4)'}">
          Ajustou o cronograma ${ajuste}: ${String(al.ajusteTxt||'').substring(0,68)}</div>` : ''}
        ${plano ? `<div style="font-size:11.5px;margin-top:3px;color:var(--tx4)">Plano gerado por voce ${plano}</div>` : ''}

        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">
          ${a.diretrizes?'<span class="tag tag-info">tem diretrizes</span>':''}
          ${al.mudou?'<span class="tag tag-alerta">mexeu no cronograma</span>':''}
          ${al.fraco?'<span class="tag tag-erro">'+al.fraco+'</span>':''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-content:flex-start">
        <button class="btn-acao" onclick="verComoAluno('${a.id}')" style="background:var(--ouro);color:#0a1420;border:1px solid var(--ouro);font-weight:700"><span class="ic">👁️</span><span class="lb">Ver como aluno</span></button>
        ${bloq ? `<button class="btn-acao" onclick="reativarAluno('${a.id}','${String(a.nome).replace(/'/g,"\\'")}')" style="background:var(--ok);color:#0a1420;border:1px solid var(--ok);font-weight:700"><span class="ic">🔓</span><span class="lb">Reativar</span></button>` : ''}
        <button class="btn-acao btn-editar" onclick="abrirEditarAluno('${a.id}','${a.nome}','${a.email}','${a.concurso_id||''}')"><span class="ic">✏️</span><span class="lb">Editar</span></button>
        <button class="btn-acao btn-editar" onclick="gerenciarConcursosAluno('${a.id}','${a.nome}')"><span class="ic">🏆</span><span class="lb">Concursos</span></button>
        <button class="btn-acao btn-editar" onclick="irParaCronogramaAluno('${a.id}','${a.nome}')" style="background:var(--hov);color:var(--info);border:1px solid var(--info)"><span class="ic">📅</span><span class="lb">Cronograma</span></button>
        <button class="btn-acao" onclick="abrirRelatorioCiclo('${a.id}')" style="background:${(ci&&ci.vencido)?'var(--alerta)':'var(--card2)'};color:${(ci&&ci.vencido)?'#0a1420':'var(--alerta)'};border:1px solid var(--alerta);font-weight:700"><span class="ic">🗓️</span><span class="lb">Relatorio 21d</span></button>
        <button class="btn-acao btn-editar" onclick="anotarAluno('${a.id}','${String(a.nome).replace(/'/g,"\\'")}')"><span class="ic">📝</span><span class="lb">Anotar</span></button>
        <button class="btn-acao btn-info" onclick="avisoParaAluno('${a.id}','${String(a.nome).replace(/'/g,"\\'")}')"><span class="ic">🔔</span><span class="lb">Aviso</span></button>
        <button class="btn-acao btn-excluir" onclick="confirmarExcluirAluno('${a.id}','${a.nome}')"><span class="ic">🗑️</span><span class="lb">Excluir</span></button>
      </div>
    </div>`
  })
  div.innerHTML += `<p style="color:var(--tx3);font-size:12px;margin-top:8px">${alunos.length} aluno(s)</p>`
}

// ========== MODO MENTOR E BLOQUEIO POR INATIVIDADE ==========
// retorna o numero de dias sem acesso se o aluno esta bloqueado, senao 0
function alunoBloqueado(a) {
  const lim = window._diasBloqueio || 20
  if (!a.ultimo_acesso) return a.bloqueado_inatividade ? lim : 0
  const dias = Math.floor((Date.now() - new Date(a.ultimo_acesso).getTime()) / 86400000)
  if (a.bloqueado_inatividade) return Math.max(dias, lim)
  return dias >= lim ? dias : 0
}

function verComoAluno(aluno_id) {
  sessionStorage.setItem('alunoFoco', aluno_id)
  location.href = 'cronograma.html?aluno=' + aluno_id
}

async function reativarAluno(aluno_id, nome) {
  if (!confirm('Reativar o acesso de ' + nome + '?\n\nUse depois que o aluno regularizar a taxa de reabilitacao. O contador de inatividade volta a zero.')) return
  const agora = new Date().toISOString()
  let r = await _supabase.from('alunos').update({ bloqueado_inatividade: false, ultimo_acesso: agora }).eq('id', aluno_id)
  if (r.error) r = await _supabase.from('alunos').update({ ultimo_acesso: agora }).eq('id', aluno_id)
  if (r.error) { alert('Erro ao reativar: ' + r.error.message); return }
  const a = (window._todosAlunos || []).find(function(x){ return x.id === aluno_id })
  if (a) { a.bloqueado_inatividade = false; a.ultimo_acesso = agora }
  filtrarAlunos()
  alert(nome + ' foi reativado. Ja pode acessar a plataforma.')
}

// Alertas: quem mexeu no cronograma e quem esta fraco em alguma disciplina
async function carregarAlertas() {
  const alertas = {}

  const [rl, rs, rr] = await Promise.all([
    _supabase.from('cronograma_log').select('*').order('criado_em',{ascending:false}),
    _supabase.from('sessoes_estudo').select('aluno_id,disciplina,questoes_feitas,questoes_certas,concluida,data'),
    _supabase.from('config_cronograma').select('aluno_id,atualizado_em')
  ])

  // ultimo ajuste feito pelo proprio aluno
  ;(rl.data||[]).forEach(function(l){
    if(l.por_mentor || String(l.detalhe||'').indexOf('[Mentor]')===0) return
    if(!alertas[l.aluno_id])alertas[l.aluno_id]={}
    const a = alertas[l.aluno_id]
    if(!a.ajuste){ a.ajuste = l.criado_em; a.ajusteTxt = l.detalhe||l.acao }
    if(!l.visto) a.mudou = true
  })

  // ultima geracao de plano feita por voce
  ;(rr.data||[]).forEach(function(x){
    if(!alertas[x.aluno_id])alertas[x.aluno_id]={}
    alertas[x.aluno_id].plano = x.atualizado_em
  })

  // ultimo estudo e desempenho fraco por disciplina
  const acc = {}, ultimo = {}
  ;(rs.data||[]).forEach(function(s){
    if(s.concluida && (!ultimo[s.aluno_id] || s.data > ultimo[s.aluno_id])) ultimo[s.aluno_id] = s.data
    if(!s.questoes_feitas) return
    const k = s.aluno_id+'||'+s.disciplina
    if(!acc[k])acc[k]={aluno:s.aluno_id,disc:s.disciplina,f:0,c:0}
    acc[k].f += s.questoes_feitas||0
    acc[k].c += s.questoes_certas||0
  })
  Object.keys(ultimo).forEach(function(id){
    if(!alertas[id])alertas[id]={}
    alertas[id].estudo = ultimo[id]
  })
  const piores = {}
  Object.keys(acc).forEach(function(k){
    const x = acc[k]
    if(x.f < 15) return
    const pct = Math.round(x.c/x.f*100)
    if(pct >= 50) return
    if(!piores[x.aluno] || pct < piores[x.aluno].pct) piores[x.aluno] = {disc:x.disc, pct:pct}
  })
  Object.keys(piores).forEach(function(id){
    if(!alertas[id])alertas[id]={}
    alertas[id].fraco = piores[id].pct+'% em '+piores[id].disc
  })

  window._alertasAluno = alertas
  return alertas
}

function tempoRelativo(d) {
  if(!d) return null
  const dias = Math.floor((Date.now() - new Date(d).getTime())/86400000)
  if(dias <= 0) return 'hoje'
  if(dias === 1) return 'ontem'
  if(dias < 30) return 'ha '+dias+' dias'
  const m = Math.floor(dias/30)
  return 'ha '+m+(m===1?' mes':' meses')
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
  const a = (window._todosAlunos||[]).find(function(x){return x.id===id})
  const mq = document.getElementById('editar-aluno-meta')
  if (mq) mq.value = (a && a.meta_questoes_dia) ? a.meta_questoes_dia : 30
  const dz = document.getElementById('editar-aluno-diretrizes')
  if (dz) dz.value = (a && a.diretrizes) ? a.diretrizes : ''
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
  const meta = parseInt(document.getElementById('editar-aluno-meta')?.value) || 30
  const diretrizes = (document.getElementById('editar-aluno-diretrizes')?.value || '').trim()
  const msg = document.getElementById('msg-editar-aluno')

  if (!nome||!email) { msg.style.color='var(--erro)'; msg.textContent='Preencha nome e e-mail.'; return }

  msg.style.color='var(--tx3)'; msg.textContent='Salvando...'

  // Atualiza dados na tabela alunos
  const { error } = await _supabase.from('alunos')
    .update({ nome, email, concurso_id: concurso_id||null, data_expiracao: data_expiracao||null,
              meta_questoes_dia: meta, diretrizes: diretrizes||null,
              diretrizes_em: diretrizes?new Date().toISOString():null }).eq('id', id)
  if (error) { msg.style.color='var(--erro)'; msg.textContent='Erro: '+error.message; return }

  // Atualiza cache local
  const alunoCache = window._todosAlunos?.find(a => a.id === id)
  if (alunoCache) { alunoCache.data_expiracao = data_expiracao; alunoCache.meta_questoes_dia = meta; alunoCache.diretrizes = diretrizes }

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








// ========== APLICAR TEMPLATE (individual) ==========




// ========== APLICAR EM MASSA ==========



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
  if (!itens||itens.length===0) { div.innerHTML='<p style="color:var(--tx3)">Nenhuma disciplina no plano. Use o Gerador para montar o cronograma deste aluno.</p>'; return }

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
  carregarLog()
}

async function carregarLog() {
  const div = document.getElementById('lista-log')
  if (!div) return
  div.innerHTML = '<p style="color:var(--tx3);font-size:13px">Carregando...</p>'
  const { data: logs } = await _supabase.from('cronograma_log')
    .select('*, alunos(nome)').order('criado_em', { ascending: false }).limit(60)
  if (!logs || !logs.length) {
    div.innerHTML = '<p style="color:var(--tx3);font-size:13px">Nenhuma alteracao registrada ainda.</p>'
    return
  }
  const naoVistos = logs.filter(function(l){ return !l.visto }).length
  div.innerHTML = (naoVistos ? '<p style="color:var(--alerta);font-size:13px;font-weight:600;margin-bottom:10px">'+naoVistos+' alteracao(oes) que voce ainda nao viu</p>' : '')
    + logs.map(function(l){
      const d = new Date(l.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
      return '<div class="item-lista" style="border-left:3px solid '+(l.visto?'var(--bd2)':'var(--alerta)')+'">'
        +'<div style="flex:1;min-width:150px">'
        +'<strong>'+(l.alunos?l.alunos.nome:'Aluno')+'</strong>'
        +((l.por_mentor||String(l.detalhe||'').indexOf('[Mentor]')===0)?' <span class="tag tag-ouro">FEITO POR VOCE</span>':(l.visto?'':' <span class="tag tag-alerta">NOVO</span>'))
        +'<div style="color:var(--tx2);font-size:12.5px;margin-top:3px">'+(l.detalhe||l.acao)+'</div></div>'
        +'<span style="color:var(--tx4);font-size:11.5px">'+d+'</span>'
        +'<button class="btn-acao btn-editar" onclick="irParaCronogramaAluno(\''+l.aluno_id+'\',\''+String(l.alunos?l.alunos.nome:'').replace(/'/g,"\\'")+'\')">Ver plano</button></div>'
    }).join('')
}

async function marcarLogVisto() {
  await _supabase.from('cronograma_log').update({ visto: true }).eq('visto', false)
  carregarLog()
  carregarAlertas().then(function(){ if(window._todosAlunos) filtrarAlunos() })
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
// ========== ANOTACOES DE EVOLUCAO ==========
const TIPO_ANOT = {
  evolucao:['Evolucao','var(--info)'], ponto_forte:['Ponto forte','var(--ok)'],
  ponto_fraco:['Ponto fraco','var(--erro)'], combinado:['Combinado / meta','var(--ouro)'],
  conversa:['Conversa','var(--roxo)']
}

async function carregarSelectAnotacoes() {
  const s = document.getElementById('anot-aluno')
  if (!s) return
  const atual = s.value
  const { data: alunos } = await _supabase.from('alunos').select('id,nome').order('nome')
  s.innerHTML = '<option value="">Selecione o aluno</option>'
  ;(alunos||[]).forEach(function(a){ s.innerHTML += '<option value="'+a.id+'">'+a.nome+'</option>' })
  if (atual) s.value = atual
  if (s.value) carregarAnotacoes()
}

function anotarAluno(aluno_id, nome) {
  mostrarAba('aba-evolucao')
  setTimeout(function(){
    const s = document.getElementById('anot-aluno')
    if (s) { s.value = aluno_id; carregarAnotacoes() }
    document.getElementById('anot-texto').focus()
  }, 250)
}

async function salvarAnotacao() {
  const aluno_id = document.getElementById('anot-aluno').value
  const texto = document.getElementById('anot-texto').value.trim()
  const tipo = document.getElementById('anot-tipo').value
  const m = document.getElementById('msg-anot')
  m.style.display='block'
  if (!aluno_id) { m.style.color='var(--erro)'; m.textContent='Selecione o aluno.'; return }
  if (!texto) { m.style.color='var(--erro)'; m.textContent='Escreva a anotacao.'; return }
  m.style.color='var(--tx3)'; m.textContent='Salvando...'
  const { error } = await _supabase.from('anotacoes_aluno').insert({ aluno_id: aluno_id, texto: texto, tipo: tipo })
  if (error) { m.style.color='var(--erro)'; m.textContent='Erro: '+error.message+' (ja rodou o SQL desta atualizacao?)'; return }
  m.style.color='var(--ok)'; m.textContent='Anotacao salva.'
  document.getElementById('anot-texto').value=''
  carregarAnotacoes()
}

async function carregarAnotacoes() {
  const aluno_id = document.getElementById('anot-aluno').value
  const div = document.getElementById('lista-anot')
  const tit = document.getElementById('titulo-anot')
  if (!div) return
  if (!aluno_id) { div.innerHTML='<p style="color:var(--tx3);font-size:13px">Selecione um aluno para ver o historico.</p>'; return }
  div.innerHTML='<p style="color:var(--tx3);font-size:13px">Carregando...</p>'
  const { data: notas, error } = await _supabase.from('anotacoes_aluno')
    .select('*').eq('aluno_id',aluno_id).order('criado_em',{ascending:false}).limit(200)
  if (error) { div.innerHTML='<p style="color:var(--erro);font-size:13px">Erro: '+error.message+' (rode o SQL desta atualizacao no Supabase)</p>'; return }
  const nome = document.getElementById('anot-aluno').options[document.getElementById('anot-aluno').selectedIndex].text
  if (tit) tit.textContent = 'Historico de anotacoes — '+nome
  if (!notas || !notas.length) { div.innerHTML='<p style="color:var(--tx3);font-size:13px">Nenhuma anotacao ainda.</p>'; return }
  div.innerHTML = notas.map(function(n){
    const t = TIPO_ANOT[n.tipo] || ['Anotacao','var(--tx3)']
    const d = new Date(n.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})
    return '<div class="item-lista" style="flex-direction:column;align-items:flex-start;gap:6px;border-left:3px solid '+t[1]+'">'
      +'<div style="display:flex;gap:8px;align-items:center;width:100%;flex-wrap:wrap">'
      +'<span class="tag" style="background:var(--card2);color:'+t[1]+';border:1px solid '+t[1]+'">'+t[0]+'</span>'
      +'<span style="color:var(--tx4);font-size:11.5px">'+d+'</span>'
      +'<button class="btn-acao btn-excluir" style="margin-left:auto" onclick="excluirAnotacao(\''+n.id+'\')">Excluir</button></div>'
      +'<p style="color:var(--tx2);font-size:13.5px;margin:0;line-height:1.6;white-space:pre-wrap">'+String(n.texto).replace(/</g,'&lt;')+'</p></div>'
  }).join('')
}

async function excluirAnotacao(id) {
  if (!confirm('Excluir esta anotacao?')) return
  await _supabase.from('anotacoes_aluno').delete().eq('id',id)
  carregarAnotacoes()
}

// ========== CICLO DE 21 DIAS ==========
const CICLO_DIAS = 21
function diaBR(d){ return new Date(d).toLocaleDateString('pt-BR') }
function somaDias(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }

// calcula, para cada aluno, em que ciclo esta e se o relatorio venceu
async function calcularCiclos() {
  const alunos = window._todosAlunos || []
  const ciclos = {}
  let rel = []
  const r = await _supabase.from('relatorios_aluno').select('aluno_id,ciclo,periodo_fim,enviado_em').order('enviado_em',{ascending:false})
  if (!r.error) rel = r.data || []
  const ultimo = {}, quantos = {}
  rel.forEach(function(x){
    quantos[x.aluno_id] = (quantos[x.aluno_id]||0)+1
    if (!ultimo[x.aluno_id]) ultimo[x.aluno_id] = x
  })
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  alunos.forEach(function(a){
    const entrada = a.criado_em ? new Date(a.criado_em) : null
    if (!entrada) return
    const u = ultimo[a.id]
    const ini = u && u.periodo_fim ? new Date(u.periodo_fim+'T12:00:00') : entrada
    const fim = somaDias(ini, CICLO_DIAS)
    const atraso = Math.floor((hoje - fim)/86400000)
    ciclos[a.id] = {
      ciclo: (quantos[a.id]||0)+1,
      ini: ini, fim: fim,
      iniBR: diaBR(ini), fimBR: diaBR(fim),
      atraso: atraso,
      vencido: atraso >= 0,
      faltam: -atraso
    }
  })
  window._ciclos = ciclos
  const pend = Object.keys(ciclos).filter(function(k){ return ciclos[k].vencido }).length
  const bd = document.getElementById('bd-ciclos')
  if (bd) { bd.textContent = pend; bd.style.display = pend ? 'inline-block' : 'none' }
  const av = document.getElementById('aviso-ciclos')
  if (av) {
    if (pend) {
      av.style.display='block'
      av.innerHTML = '<div class="card" style="border:1px solid var(--alerta);background:rgba(232,176,75,.07);display:flex;gap:12px;align-items:center;flex-wrap:wrap">'
        +'<div style="font-size:26px">🗓️</div>'
        +'<div style="flex:1;min-width:200px"><strong style="color:var(--alerta)">'+pend+' aluno(s) com relatorio de 21 dias para enviar</strong>'
        +'<div style="color:var(--tx3);font-size:12.5px;margin-top:3px">Avalie o estudo do periodo e mande o retorno para cada um.</div></div>'
        +'<button onclick="mostrarAba(\'aba-ciclos\')" style="width:auto;padding:10px 16px">Ver relatorios</button></div>'
    } else av.style.display='none'
  }
  return ciclos
}

async function carregarCiclos() {
  const div = document.getElementById('lista-ciclos')
  if (!div) return
  div.innerHTML = '<p style="color:var(--tx3);font-size:13px">Carregando...</p>'
  if (!window._todosAlunos) {
    const { data: alunos } = await _supabase.from('alunos').select('*, concursos(nome)').order('nome')
    window._todosAlunos = alunos || []
  }
  const ciclos = await calcularCiclos()
  const lista = (window._todosAlunos||[]).filter(function(a){ return ciclos[a.id] })
    .sort(function(a,b){ return ciclos[b.id].atraso - ciclos[a.id].atraso })
  if (!lista.length) { div.innerHTML='<p style="color:var(--tx3);font-size:13px">Nenhum aluno cadastrado ainda.</p>'; return }
  div.innerHTML = lista.map(function(a){
    const c = ciclos[a.id]
    const cor = c.vencido ? 'var(--alerta)' : 'var(--bd2)'
    const txt = c.vencido
      ? (c.atraso>0 ? 'Vencido ha '+c.atraso+' dia(s)' : 'Fecha hoje')
      : 'Faltam '+c.faltam+' dia(s)'
    return '<div class="item-lista" style="border-left:4px solid '+cor+'">'
      +'<div style="flex:1;min-width:170px"><strong>'+a.nome+'</strong>'
      +'<div style="color:var(--tx3);font-size:12px">'+(a.concursos?a.concursos.nome:'sem concurso')+'</div>'
      +'<div style="color:var(--tx4);font-size:11.5px;margin-top:3px">Ciclo '+c.ciclo+' · '+c.iniBR+' a '+c.fimBR+'</div></div>'
      +'<span style="color:'+(c.vencido?'var(--alerta)':'var(--tx3)')+';font-size:12.5px;font-weight:700">'+txt+'</span>'
      +'<button class="btn-acao btn-editar" onclick="abrirRelatorioCiclo(\''+a.id+'\')">Montar relatorio</button></div>'
  }).join('')
}

function fecharRelatorioCiclo(){ document.getElementById('card-relatorio-ciclo').style.display='none' }

// monta o relatorio do ciclo com os numeros reais do periodo
async function abrirRelatorioCiclo(aluno_id) {
  mostrarAba('aba-ciclos')
  const card = document.getElementById('card-relatorio-ciclo')
  const corpo = document.getElementById('corpo-ciclo')
  card.style.display='block'
  corpo.innerHTML='<p style="color:var(--tx3);font-size:13px">Montando relatorio...</p>'
  card.scrollIntoView({behavior:'smooth'})

  if (!window._ciclos || !window._ciclos[aluno_id]) await carregarCiclos()
  const c = (window._ciclos||{})[aluno_id]
  const aluno = (window._todosAlunos||[]).find(function(x){ return x.id===aluno_id }) || {nome:'Aluno'}
  if (!c) { corpo.innerHTML='<p style="color:var(--erro)">Nao foi possivel calcular o ciclo deste aluno.</p>'; return }

  const ini = ymdLocal(c.ini), fim = ymdLocal(new Date(Math.min(c.fim.getTime(), Date.now())))
  document.getElementById('titulo-ciclo').textContent='Relatorio do ciclo '+c.ciclo+' — '+aluno.nome

  const [rs, rq, rn, rl] = await Promise.all([
    _supabase.from('sessoes_estudo').select('*').eq('aluno_id',aluno_id).gte('data',ini).lte('data',fim),
    _supabase.from('questao_respostas').select('correta,respondido_em').eq('aluno_id',aluno_id).gte('respondido_em',ini+'T00:00:00'),
    _supabase.from('anotacoes_aluno').select('*').eq('aluno_id',aluno_id).gte('criado_em',ini+'T00:00:00').order('criado_em'),
    _supabase.from('cronograma_log').select('*').eq('aluno_id',aluno_id).gte('criado_em',ini+'T00:00:00').order('criado_em',{ascending:false})
  ])

  const sess = rs.data||[]
  const feitas = sess.filter(function(s){ return s.concluida })
  const pct = sess.length ? Math.round(feitas.length/sess.length*100) : 0
  const min = feitas.reduce(function(a,s){ return a+(s.tempo_minutos||0) },0)
  const qS = sess.reduce(function(a,s){ return a+(s.questoes_feitas||0) },0)
  const cS = sess.reduce(function(a,s){ return a+(s.questoes_certas||0) },0)
  const banco = rq.data||[]
  const qTot = qS + banco.length
  const cTot = cS + banco.filter(function(r){ return r.correta }).length
  const pctAc = qTot ? Math.round(cTot/qTot*100) : null
  const dias = {}; feitas.forEach(function(s){ dias[s.data]=1 })
  const nDias = Object.keys(dias).length
  const atrasadas = sess.filter(function(s){ return !s.concluida && s.data < ymdLocal(new Date()) }).length
  const parciais = sess.filter(function(s){ return s.parcial }).length

  const disc = {}
  sess.forEach(function(s){
    if(!disc[s.disciplina]) disc[s.disciplina]={tot:0,ok:0,q:0,c:0}
    const d=disc[s.disciplina]; d.tot++; if(s.concluida)d.ok++
    d.q+=s.questoes_feitas||0; d.c+=s.questoes_certas||0
  })
  const linhasDisc = Object.keys(disc).sort().map(function(k){
    const d=disc[k], p=d.tot?Math.round(d.ok/d.tot*100):0, pa=d.q?Math.round(d.c/d.q*100):null
    return {nome:k, cump:p, ac:pa, q:d.q, ok:d.ok, tot:d.tot}
  })
  const fracas = linhasDisc.filter(function(d){ return d.ac!==null && d.ac<60 && d.q>=10 }).sort(function(a,b){return a.ac-b.ac})
  const fortes = linhasDisc.filter(function(d){ return d.ac!==null && d.ac>=75 && d.q>=10 }).sort(function(a,b){return b.ac-a.ac})
  const notas = rn.data||[]
  const logs = (rl.data||[]).filter(function(l){ return !l.por_mentor && String(l.detalhe||'').indexOf('[Mentor]')!==0 })

  const cor = pct>=70?'var(--ok)':pct>=40?'var(--alerta)':'var(--erro)'
  const texto = montarTextoRelatorio(aluno.nome, c, {pct:pct,feitas:feitas.length,total:sess.length,min:min,qTot:qTot,pctAc:pctAc,nDias:nDias,atrasadas:atrasadas,parciais:parciais,fracas:fracas,fortes:fortes})
  window._relatorioAtual = { aluno_id:aluno_id, nome:aluno.nome, ciclo:c.ciclo, ini:ini, fim:fim,
    resumo:{pct:pct,feitas:feitas.length,total:sess.length,minutos:min,questoes:qTot,acerto:pctAc,dias:nDias,atrasadas:atrasadas} }

  corpo.innerHTML =
    '<p style="color:var(--tx3);font-size:13px;margin-bottom:14px">Periodo avaliado: <strong style="color:var(--tx2)">'+diaBR(c.ini)+' a '+diaBR(c.fim)+'</strong></p>'
   +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">'
   +bloco('Cumprimento', pct+'%', feitas.length+' de '+sess.length+' sessoes', cor)
   +bloco('Horas de estudo', Math.floor(min/60)+'h'+(min%60?' '+(min%60)+'min':''), nDias+' dia(s) com estudo', 'var(--info)')
   +bloco('Questoes', String(qTot), pctAc===null?'sem registro':pctAc+'% de acerto', pctAc===null?'var(--tx3)':(pctAc>=70?'var(--ok)':pctAc>=50?'var(--alerta)':'var(--erro)'))
   +bloco('Atrasadas', String(atrasadas), parciais+' tema(s) nao finalizados', atrasadas?'var(--erro)':'var(--ok)')
   +'</div>'

   +(linhasDisc.length?'<h3 style="font-size:15px;margin-bottom:8px">Por disciplina</h3><div style="margin-bottom:16px">'
     +linhasDisc.map(function(d){
        return '<div class="item-lista" style="padding:9px 12px"><strong style="flex:1;min-width:130px">'+d.nome+'</strong>'
          +'<span style="color:var(--tx3);font-size:12.5px">'+d.ok+'/'+d.tot+' sessoes ('+d.cump+'%)</span>'
          +'<span style="color:'+(d.ac===null?'var(--tx4)':(d.ac>=70?'var(--ok)':d.ac>=50?'var(--alerta)':'var(--erro)'))+';font-size:12.5px;font-weight:700">'
          +(d.ac===null?'sem questoes':d.ac+'% em '+d.q+'q')+'</span></div>'
     }).join('')+'</div>':'')

   +'<h3 style="font-size:15px;margin-bottom:8px">Suas anotacoes no periodo</h3>'
   +(notas.length
      ? '<div style="margin-bottom:8px">'+notas.map(function(n){
          const t=TIPO_ANOT[n.tipo]||['Anotacao','var(--tx3)']
          return '<div class="item-lista" style="flex-direction:column;align-items:flex-start;gap:5px;border-left:3px solid '+t[1]+'">'
            +'<div style="display:flex;gap:8px;align-items:center"><span class="tag" style="background:var(--card2);color:'+t[1]+';border:1px solid '+t[1]+'">'+t[0]+'</span>'
            +'<span style="color:var(--tx4);font-size:11.5px">'+new Date(n.criado_em).toLocaleDateString('pt-BR')+'</span></div>'
            +'<p style="color:var(--tx2);font-size:13px;margin:0;line-height:1.55;white-space:pre-wrap">'+String(n.texto).replace(/</g,'&lt;')+'</p></div>'
        }).join('')+'</div>'
      : '<p style="color:var(--tx3);font-size:13px;margin-bottom:8px">Nenhuma anotacao neste ciclo.</p>')
   +'<button class="btn-acao btn-editar" onclick="anotarAluno(\''+aluno_id+'\',\''+String(aluno.nome).replace(/'/g,"\\'")+'\')" style="margin-bottom:16px">📝 Nova anotacao</button>'

   +(logs.length?'<h3 style="font-size:15px;margin:10px 0 8px">O que o aluno mexeu no cronograma</h3><div style="margin-bottom:16px">'
     +logs.slice(0,8).map(function(l){
        return '<div class="item-lista" style="padding:8px 12px"><span style="flex:1;min-width:150px;color:var(--tx2);font-size:12.5px">'+(l.detalhe||l.acao)+'</span>'
          +'<span style="color:var(--tx4);font-size:11.5px">'+new Date(l.criado_em).toLocaleDateString('pt-BR')+'</span></div>'
     }).join('')+'</div>':'')

   +'<h3 style="font-size:15px;margin-bottom:6px">Sua analise para o aluno</h3>'
   +'<p style="color:var(--tx3);font-size:12.5px;margin-bottom:8px">O texto abaixo ja vem com os numeros do ciclo. Complete com a sua leitura e as orientacoes do proximo ciclo.</p>'
   +'<textarea id="ciclo-analise" rows="14" style="font-size:13.5px;line-height:1.6"></textarea>'
   +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
   +'<button onclick="copiarRelatorio()" style="width:auto;padding:10px 16px">📋 Copiar para o WhatsApp</button>'
   +'<button onclick="enviarRelatorioAviso()" style="width:auto;padding:10px 16px;background:var(--card2);color:var(--info);border:1px solid var(--info)">🔔 Enviar como aviso na plataforma</button>'
   +'<button onclick="marcarRelatorioEnviado()" style="width:auto;padding:10px 16px;background:var(--card2);color:var(--ok);border:1px solid var(--ok)">✅ Marcar como enviado</button>'
   +'</div>'
   +'<p id="msg-ciclo" style="display:none;margin-top:10px;font-size:13px"></p>'

  document.getElementById('ciclo-analise').value = texto
}

function bloco(titulo, valor, sub, cor) {
  return '<div style="background:var(--card2);border:1px solid var(--bd);border-radius:12px;padding:12px;text-align:center">'
    +'<div style="color:'+cor+';font-size:22px;font-weight:800">'+valor+'</div>'
    +'<div style="color:var(--tx2);font-size:12px;font-weight:600;margin-top:2px">'+titulo+'</div>'
    +'<div style="color:var(--tx4);font-size:11px;margin-top:2px">'+sub+'</div></div>'
}

function ymdLocal(d){ const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0') }

function montarTextoRelatorio(nome, c, r) {
  const h = Math.floor(r.min/60), m = r.min%60
  let t = 'RELATORIO DE 21 DIAS — '+nome.split(' ')[0]+'\n'
    + 'Periodo: '+diaBR(c.ini)+' a '+diaBR(c.fim)+' (ciclo '+c.ciclo+')\n\n'
    + 'COMO FOI O SEU CICLO\n'
    + '• Sessoes concluidas: '+r.feitas+' de '+r.total+' ('+r.pct+'%)\n'
    + '• Tempo de estudo: '+h+'h'+(m?' '+m+'min':'')+' em '+r.nDias+' dia(s)\n'
    + '• Questoes: '+r.qTot+(r.pctAc===null?'':' · '+r.pctAc+'% de acerto')+'\n'
    + (r.atrasadas?'• Sessoes atrasadas no fim do ciclo: '+r.atrasadas+'\n':'• Nenhuma sessao atrasada. Parabens pela constancia.\n')
    + (r.parciais?'• Temas que voce comecou e nao terminou: '+r.parciais+'\n':'')
    + '\n'
  if (r.fortes.length) t += 'PONTOS FORTES\n' + r.fortes.slice(0,3).map(function(d){ return '• '+d.nome+': '+d.ac+'% de acerto em '+d.q+' questoes' }).join('\n') + '\n\n'
  if (r.fracas.length) t += 'O QUE PRECISA DE ATENCAO\n' + r.fracas.slice(0,3).map(function(d){ return '• '+d.nome+': '+d.ac+'% de acerto em '+d.q+' questoes' }).join('\n') + '\n\n'
  t += 'MINHA ANALISE\n(escreva aqui)\n\nMETAS PARA OS PROXIMOS 21 DIAS\n1) \n2) \n3) \n\nSiga firme, patrulheiro. Disciplina vence talento.\nCabo Jota'
  return t
}

function copiarRelatorio() {
  const t = document.getElementById('ciclo-analise').value
  const m = document.getElementById('msg-ciclo')
  m.style.display='block'
  if (navigator.clipboard) {
    navigator.clipboard.writeText(t).then(function(){ m.style.color='var(--ok)'; m.textContent='Texto copiado! Cole no WhatsApp do aluno.' })
      .catch(function(){ m.style.color='var(--alerta)'; m.textContent='Nao consegui copiar. Selecione o texto e copie manualmente.' })
  } else { m.style.color='var(--alerta)'; m.textContent='Selecione o texto e copie manualmente.' }
}

async function enviarRelatorioAviso() {
  const r = window._relatorioAtual
  const m = document.getElementById('msg-ciclo')
  m.style.display='block'
  if (!r) { m.style.color='var(--erro)'; m.textContent='Abra o relatorio de novo.'; return }
  const texto = document.getElementById('ciclo-analise').value
  m.style.color='var(--tx3)'; m.textContent='Enviando...'
  const { error } = await _supabase.from('avisos').insert({
    aluno_id: r.aluno_id, titulo: 'Seu relatorio de 21 dias (ciclo '+r.ciclo+')', mensagem: texto, prioridade: 'alta'
  })
  if (error) { m.style.color='var(--erro)'; m.textContent='Erro: '+error.message; return }
  m.style.color='var(--ok)'; m.textContent='Aviso enviado. O aluno ve na aba Avisos da plataforma.'
}

async function marcarRelatorioEnviado() {
  const r = window._relatorioAtual
  const m = document.getElementById('msg-ciclo')
  m.style.display='block'
  if (!r) { m.style.color='var(--erro)'; m.textContent='Abra o relatorio de novo.'; return }
  if (!confirm('Marcar o relatorio do ciclo '+r.ciclo+' de '+r.nome+' como enviado?\n\nO proximo ciclo de 21 dias comeca a contar a partir de hoje.')) return
  m.style.color='var(--tx3)'; m.textContent='Salvando...'
  const hoje = ymdLocal(new Date())
  const { error } = await _supabase.from('relatorios_aluno').insert({
    aluno_id: r.aluno_id, ciclo: r.ciclo, periodo_inicio: r.ini, periodo_fim: hoje,
    resumo: r.resumo, analise: document.getElementById('ciclo-analise').value
  })
  if (error) { m.style.color='var(--erro)'; m.textContent='Erro: '+error.message+' (ja rodou o SQL desta atualizacao?)'; return }
  m.style.color='var(--ok)'; m.textContent='Relatorio registrado. Proximo ciclo fecha em '+diaBR(somaDias(new Date(),CICLO_DIAS))+'.'
  await carregarCiclos()
  if (window._todosAlunos) filtrarAlunos()
}

function carregarSelectsAvisos() {
  const sc = document.getElementById('aviso-concurso')
  if (sc) {
    sc.innerHTML='<option value="">Selecione o concurso</option>'
    ;(window._concursos||[]).forEach(function(c){ sc.innerHTML+='<option value="'+c.id+'">'+c.nome+'</option>' })
  }
  const sf = document.getElementById('filtro-avisos')
  if (sf) {
    sf.innerHTML='<option value="">Todos os avisos</option>'
      +'<option value="geral">Somente gerais (todos os alunos)</option>'
      +'<option value="turma">Somente de turma</option>'
      +'<option value="individuais">Somente individuais</option>'
    ;(window._concursos||[]).forEach(function(c){ sf.innerHTML+='<option value="c:'+c.id+'">Turma: '+c.nome+'</option>' })
  }
  carregarAlunosAviso()
  trocarDestino()
  carregarAvisos()
}

function trocarDestino() {
  const d = document.getElementById('aviso-destino').value
  const bg = document.getElementById('box-geral')
  if (bg) bg.style.display = (d==='geral')?'block':'none'
  document.getElementById('box-turma').style.display = (d==='turma')?'block':'none'
  document.getElementById('box-aluno').style.display = (d==='aluno')?'block':'none'
}

async function carregarAlunosAviso() {
  const s = document.getElementById('aviso-aluno')
  if (!s) return
  const { data: alunos } = await _supabase.from('alunos').select('id,nome,concursos(nome)').order('nome')
  s.innerHTML = '<option value="">Selecione o aluno</option>'
  ;(alunos||[]).forEach(function(a){
    s.innerHTML += '<option value="'+a.id+'">'+a.nome+(a.concursos?' — '+a.concursos.nome:'')+'</option>'
  })
}

function avisoParaAluno(aluno_id, nome) {
  mostrarAba('aba-avisos')
  setTimeout(function(){
    document.getElementById('aviso-destino').value = 'aluno'
    trocarDestino()
    const s = document.getElementById('aviso-aluno')
    if (s) s.value = aluno_id
    document.getElementById('aviso-titulo').focus()
    const m = document.getElementById('msg-aviso')
    if (m) { m.style.display='block'; m.style.color='var(--ouro)'; m.textContent='Escrevendo aviso individual para '+nome }
  }, 120)
}

async function criarAviso() {
  const destino = document.getElementById('aviso-destino').value
  const titulo = document.getElementById('aviso-titulo').value.trim()
  const mensagem = document.getElementById('aviso-mensagem').value.trim()
  const prioridade = document.getElementById('aviso-prioridade').value
  const msg = document.getElementById('msg-aviso')

  if (!titulo || !mensagem) { msg.style.display='block'; msg.style.color='var(--erro)'; msg.textContent='Preencha titulo e mensagem.'; return }

  const registro = { titulo: titulo, mensagem: mensagem, prioridade: prioridade }
  let quem = ''

  if (destino === 'geral') {
    if (!confirm('Publicar este aviso para TODOS os alunos da plataforma?')) return
    quem = 'todos os alunos'
  } else if (destino === 'turma') {
    const cid = document.getElementById('aviso-concurso').value
    if (!cid) { msg.style.display='block'; msg.style.color='var(--erro)'; msg.textContent='Selecione o concurso.'; return }
    registro.concurso_id = cid
    const cc = (window._concursos||[]).find(function(x){return x.id===cid})
    quem = 'a turma de ' + (cc?cc.nome:'concurso')
  } else {
    const aid = document.getElementById('aviso-aluno').value
    if (!aid) { msg.style.display='block'; msg.style.color='var(--erro)'; msg.textContent='Selecione o aluno.'; return }
    registro.aluno_id = aid
    const sel = document.getElementById('aviso-aluno')
    quem = sel.options[sel.selectedIndex].text.split(' — ')[0]
  }

  msg.style.display='block'; msg.style.color='var(--tx3)'; msg.textContent='Publicando...'
  const { error } = await _supabase.from('avisos').insert(registro)
  if (error) { msg.style.color='var(--erro)'; msg.textContent='Erro: '+error.message; return }

  msg.style.color='var(--ok)'
  msg.textContent='Aviso enviado para '+quem+'!'
  document.getElementById('aviso-titulo').value=''
  document.getElementById('aviso-mensagem').value=''
  carregarAvisos()
}

async function carregarAvisos() {
  const filtro = document.getElementById('filtro-avisos').value
  const div = document.getElementById('lista-avisos')
  div.innerHTML = '<p style="color:var(--tx3);font-size:13px">Carregando...</p>'

  let q = _supabase.from('avisos').select('*, concursos(nome), alunos(nome)').order('criado_em',{ascending:false}).limit(80)
  if (filtro === 'individuais') q = q.not('aluno_id','is',null)
  else if (filtro === 'turma') q = q.is('aluno_id',null).not('concurso_id','is',null)
  else if (filtro === 'geral') q = q.is('aluno_id',null).is('concurso_id',null)
  else if (filtro && filtro.indexOf('c:')===0) q = q.eq('concurso_id', filtro.slice(2))

  const { data: avisos, error } = await q
  if (error) { div.innerHTML='<p style="color:var(--erro)">Erro: '+error.message+'</p>'; return }
  if (!avisos || !avisos.length) { div.innerHTML='<p style="color:var(--tx3)">Nenhum aviso publicado ainda.</p>'; return }

  div.innerHTML = avisos.map(function(a){
    const data = new Date(a.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
    const individual = !!a.aluno_id
    const geral = !a.aluno_id && !a.concurso_id
    const destino = individual
      ? '<span class="tag tag-info">'+(a.alunos?a.alunos.nome:'aluno')+'</span>'
      : geral
        ? '<span class="tag tag-ok">TODOS OS ALUNOS</span>'
        : '<span class="tag tag-ouro">'+(a.concursos?a.concursos.nome:'turma')+'</span>'
    const prio = a.prioridade==='alta' ? '<span class="tag tag-erro">URGENTE</span>' : ''
    const lido = individual
      ? (a.lido_em
          ? '<span class="tag tag-ok">lido em '+new Date(a.lido_em).toLocaleDateString('pt-BR')+'</span>'
          : '<span class="tag tag-alerta">nao lido</span>')
      : ''
    return '<div class="item-lista" style="flex-direction:column;align-items:flex-start;gap:8px;border-left:3px solid '
      +(individual?'var(--info)':'var(--ouro)')+'">'
      +'<div style="display:flex;justify-content:space-between;width:100%;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<strong style="flex:1;min-width:130px">'+a.titulo+'</strong>'
      +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+prio+destino+lido
      +'<span style="color:var(--tx4);font-size:11.5px">'+data+'</span>'
      +'<button class="btn-acao btn-excluir" onclick="excluirAviso(\''+a.id+'\')">Excluir</button></div></div>'
      +'<p style="color:var(--tx2);font-size:13.5px;margin:0;line-height:1.6;white-space:pre-wrap">'+a.mensagem+'</p></div>'
  }).join('')
}

async function excluirAviso(id) {
  if (!confirm('Excluir este aviso?')) return
  await _supabase.from('avisos').delete().eq('id', id)
  carregarAvisos()
}
