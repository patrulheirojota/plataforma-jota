async function login() {
  const email = document.getElementById('email').value
  const senha = document.getElementById('senha').value
  
  const { data, error } = await supabase.auth.signInWithPassword({
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
