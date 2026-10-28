let _entrando = false
async function login() {
  if (_entrando) return
  const email = document.getElementById('email').value.trim()
  const senha = document.getElementById('senha').value
  const msg = document.getElementById('msg-erro')
  const bt = document.querySelector('.login-box button')
  if (!email || !senha) { msg.style.display = 'block'; msg.textContent = 'Preencha o e-mail e a senha.'; return }
  _entrando = true
  if (bt) { bt.disabled = true; bt.textContent = 'Entrando...' }

  const { data, error } = await _supabase.auth.signInWithPassword({ email: email, password: senha })

  if (error) {
    _entrando = false
    if (bt) { bt.disabled = false; bt.textContent = 'Entrar' }
    msg.style.display = 'block'
    msg.textContent = 'E-mail ou senha incorretos.'
    return
  }

  // mentor vai direto para o painel; aluno para a plataforma
  let admin = false
  try { const r = await _supabase.rpc('eh_admin'); admin = !r.error && !!r.data } catch (e) {}
  window.location.href = admin ? 'admin.html' : 'dashboard.html'
}

// Enter no campo de senha (ou e-mail) ja entra
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.target.id === 'senha' || e.target.id === 'email')) login()
})
async function esqueceuSenha() {
  const email = document.getElementById('email').value
  if (!email) {
    alert('Digite seu e-mail no campo acima antes de clicar em "Esqueci minha senha".')
    return
  }

  const { error } = await _supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://patrulheirojota.com.br/nova-senha.html'
  })

  if (error) {
    alert('Erro ao enviar e-mail: ' + error.message)
    return
  }

  alert('✅ E-mail de recuperação enviado! Peça ao aluno para verificar a caixa de entrada (e o spam).')
}
