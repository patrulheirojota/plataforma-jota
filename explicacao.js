/* =====================================================================
   EXPLICACAO GRAVADA DA QUESTAO (sem custo)
   - link do YouTube (pode ser "nao listado"), Google Drive ou arquivo de video/audio
   - ou audio gravado direto no navegador pelo mentor (vai para o armazenamento
     gratuito do Supabase, pasta "explicacoes")
   Aluno: htmlExplicacao(url)   ·   Mentor: campoExplicacaoHTML(id, valor)
   ===================================================================== */
(function () {
  function esc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function tipo (url) {
    var u = String(url || '').trim(), m
    if (!u) return null
    if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/))) return { t: 'yt', id: m[1] }
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]{10,})/))) return { t: 'drive', id: m[1] }
    if (/\.(webm|mp3|m4a|ogg|oga|wav|aac)(\?|$)/i.test(u) || /\/explicacoes\/.*audio/i.test(u)) return { t: 'audio', u: u }
    if (/\.(mp4|mov|m4v)(\?|$)/i.test(u)) return { t: 'video', u: u }
    return { t: 'link', u: u }
  }
  var cont = 0
  window.htmlExplicacao = function (url) {
    var x = tipo(url); if (!x) return ''
    var id = 'expl-' + (++cont)
    var rotulo = x.t === 'audio' ? '🎧 Ouvir a explicacao do Jota' : x.t === 'link' ? '🔗 Abrir a explicacao do Jota' : '▶️ Ver a explicacao do Jota'
    if (x.t === 'link') return '<a href="' + esc(x.u) + '" target="_blank" rel="noopener" style="display:inline-flex;gap:6px;align-items:center;margin-top:10px;padding:10px 14px;border-radius:11px;border:1px solid var(--ouro,#C9A83C);color:var(--ouro,#C9A83C);font-weight:700;font-size:13.5px;text-decoration:none">' + rotulo + '</a>'
    return '<div style="margin-top:10px"><button type="button" onclick="abrirExplicacao(\'' + id + '\')" style="display:inline-flex;gap:6px;align-items:center;padding:10px 14px;border-radius:11px;border:1px solid var(--ouro,#C9A83C);background:transparent;color:var(--ouro,#C9A83C);font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit">' + rotulo + '</button>'
      + '<div id="' + id + '" data-url="' + esc(url) + '" style="display:none;margin-top:8px"></div></div>'
  }
  // so carrega o player quando o aluno toca (economiza internet)
  window.abrirExplicacao = function (id) {
    var box = document.getElementById(id); if (!box) return
    if (box.style.display === 'block') { box.style.display = 'none'; box.innerHTML = ''; return }
    var x = tipo(box.getAttribute('data-url')), h = ''
    var quadro = function (src) { return '<div style="position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000"><iframe src="' + esc(src) + '" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' }
    if (x.t === 'yt') h = quadro('https://www.youtube-nocookie.com/embed/' + x.id + '?rel=0&modestbranding=1')
    else if (x.t === 'drive') h = quadro('https://drive.google.com/file/d/' + x.id + '/preview')
    else if (x.t === 'audio') h = '<audio controls preload="none" src="' + esc(x.u) + '" style="width:100%"></audio>'
    else if (x.t === 'video') h = '<video controls preload="metadata" src="' + esc(x.u) + '" style="width:100%;border-radius:12px;background:#000"></video>'
    box.innerHTML = h; box.style.display = 'block'
  }

  /* ---------------- MENTOR: campo + gravador ---------------- */
  window.campoExplicacaoHTML = function (id, valor) {
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
      + '<input type="text" id="' + id + '" value="' + esc(valor || '') + '" placeholder="Link do YouTube (pode ser nao listado), Google Drive... ou grave um audio" style="flex:1;min-width:220px;margin:0">'
      + '<button type="button" onclick="abrirGravadorExplicacao(\'' + id + '\')" style="width:auto;margin:0;padding:10px 13px;background:var(--card2);color:var(--ouro);border:1px solid var(--ouro)">🎙️ Gravar audio</button>'
      + '<button type="button" onclick="testarExplicacao(\'' + id + '\')" style="width:auto;margin:0;padding:10px 13px;background:var(--card2);color:var(--tx2);border:1px solid var(--bd2)">Testar</button></div>'
      + '<div id="' + id + '-prev"></div>'
  }
  window.testarExplicacao = function (id) {
    var v = (document.getElementById(id) || {}).value, p = document.getElementById(id + '-prev')
    if (!p) return
    p.innerHTML = v ? htmlExplicacao(v) : '<div style="color:var(--tx3);font-size:12px;margin-top:6px">Cole um link ou grave um audio primeiro.</div>'
    var b = p.querySelector('button'); if (b) b.click()
  }

  var rec = null, pedacos = [], stream = null, inicio = 0, relogio = null, blobAtual = null, alvo = null
  function ov () {
    var o = document.getElementById('grv-ov')
    if (!o) {
      o = document.createElement('div'); o.id = 'grv-ov'
      o.style.cssText = 'position:fixed;inset:0;background:rgba(5,10,18,.86);z-index:700;display:flex;align-items:center;justify-content:center;padding:16px'
      document.body.appendChild(o)
    }
    o.style.display = 'flex'; return o
  }
  function tela (h) { ov().innerHTML = '<div style="background:var(--bg2,#0c1826);border:1px solid var(--ouro,#C9A83C);border-radius:16px;padding:18px;width:100%;max-width:440px;color:var(--tx,#e8edf4);font-family:inherit">' + h + '</div>' }
  window.fecharGravador = function () {
    try { if (rec && rec.state !== 'inactive') rec.stop() } catch (e) {}
    try { if (stream) stream.getTracks().forEach(function (t) { t.stop() }) } catch (e) {}
    clearInterval(relogio); rec = null; stream = null
    var o = document.getElementById('grv-ov'); if (o) o.style.display = 'none'
  }
  window.abrirGravadorExplicacao = function (idInput) {
    alvo = idInput; blobAtual = null
    if (!navigator.mediaDevices || !window.MediaRecorder) { alert('Este navegador nao grava audio. Use o Chrome no computador ou no Android.'); return }
    tela('<div style="font-weight:800;font-size:16px">🎙️ Gravar explicacao</div>'
      + '<div style="color:var(--tx3,#63809e);font-size:12.5px;margin-top:4px;line-height:1.5">Explique a questao como em sala. Ate 10 minutos. O audio fica guardado na plataforma (sem custo).</div>'
      + '<div id="grv-tempo" style="font-size:40px;font-weight:900;text-align:center;margin:16px 0;font-variant-numeric:tabular-nums">00:00</div>'
      + '<div id="grv-acoes" style="display:grid;gap:8px"><button onclick="gravarIniciar()" style="padding:14px;border-radius:12px;border:0;background:#f07171;color:#fff;font-weight:800;font-size:15px;cursor:pointer">● Comecar a gravar</button></div>'
      + '<button onclick="fecharGravador()" style="margin-top:10px;width:100%;padding:10px;border-radius:10px;border:1px solid var(--bd2,#24384f);background:transparent;color:var(--tx2,#8fa5bd);cursor:pointer">Cancelar</button>'
      + '<div id="grv-msg" style="font-size:12.5px;margin-top:8px;text-align:center"></div>')
  }
  window.gravarIniciar = async function () {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch (e) { document.getElementById('grv-msg').textContent = 'Permita o uso do microfone para gravar.'; return }
    var mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].filter(function (m) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m) })[0] || ''
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined)
    pedacos = []
    rec.ondataavailable = function (e) { if (e.data && e.data.size) pedacos.push(e.data) }
    rec.onstop = function () {
      blobAtual = new Blob(pedacos, { type: rec && rec.mimeType || mime || 'audio/webm' })
      try { stream.getTracks().forEach(function (t) { t.stop() }) } catch (e) {}
      var url = URL.createObjectURL(blobAtual)
      document.getElementById('grv-acoes').innerHTML = '<audio controls src="' + url + '" style="width:100%"></audio>'
        + '<button onclick="gravarEnviar()" style="padding:13px;border-radius:12px;border:0;background:var(--ouro,#C9A83C);color:#0a1420;font-weight:800;cursor:pointer">Usar esta gravacao</button>'
        + '<button onclick="abrirGravadorExplicacao(\'' + alvo + '\')" style="padding:11px;border-radius:12px;border:1px solid var(--bd2,#24384f);background:transparent;color:var(--tx,#e8edf4);cursor:pointer">Gravar de novo</button>'
    }
    rec.start(1000); inicio = Date.now()
    document.getElementById('grv-acoes').innerHTML = '<button onclick="gravarParar()" style="padding:14px;border-radius:12px;border:0;background:var(--card,#101d2c);color:#f07171;font-weight:800;font-size:15px;cursor:pointer;border:1px solid #f07171">■ Parar</button>'
    relogio = setInterval(function () {
      var s = Math.floor((Date.now() - inicio) / 1000), e = document.getElementById('grv-tempo')
      if (e) e.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
      if (s >= 600) gravarParar()
    }, 500)
  }
  window.gravarParar = function () { clearInterval(relogio); try { if (rec && rec.state !== 'inactive') rec.stop() } catch (e) {} }
  window.gravarEnviar = async function () {
    if (!blobAtual) return
    var m = document.getElementById('grv-msg'); m.style.color = 'var(--tx3,#63809e)'; m.textContent = 'Enviando...'
    var ext = /mp4/.test(blobAtual.type) ? 'm4a' : /ogg/.test(blobAtual.type) ? 'ogg' : 'webm'
    var nome = 'audio/' + new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext
    try {
      var r = await _supabase.storage.from('explicacoes').upload(nome, blobAtual, { contentType: blobAtual.type || 'audio/webm', upsert: false })
      if (r.error) throw r.error
      var pub = _supabase.storage.from('explicacoes').getPublicUrl(nome)
      var url = pub && pub.data && pub.data.publicUrl
      var inp = document.getElementById(alvo); if (inp) inp.value = url
      fecharGravador()
      var p = document.getElementById(alvo + '-prev'); if (p) p.innerHTML = '<div style="color:var(--ok,#6ddba0);font-size:12.5px;margin-top:6px">✓ Audio gravado. Agora clique em Salvar.</div>'
    } catch (e) {
      m.style.color = '#f07171'
      m.textContent = /bucket|not found|policy|security/i.test(e.message || '') ? 'Rode o arquivo atualizacao-lote-c.sql no Supabase para liberar a gravacao.' : 'Erro ao enviar: ' + (e.message || e)
    }
  }
})()
