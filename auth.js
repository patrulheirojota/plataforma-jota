async function login() {
  const email = document.getElementById('email').value
  const senha = document.getElementById('senha').value
  
  const { data, error } = await _supabase.auth.signInWithPassword({
    email: email,
    password: senha
  })

  if (error) {
    document.getElementById('msg-erro').style.display = 'block'
    document.getElementById('msg-erro').textContent = 'E-mail ou senha incorretos.'
    return
  }

  window.location.href = 'dashboard.html'
}
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
