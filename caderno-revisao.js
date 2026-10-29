/* =====================================================================
   REVISAO DO CADERNO DE ERROS (repeticao espacada)
   Cada anotacao volta para revisao em 1, 3, 7, 15, 30 e 60 dias.
   "Lembrei" -> o intervalo aumenta. "Esqueci" -> volta para amanha.
   Terminar a revisao do dia marca a meta "Caderno de erros" na Missao.
   Usa as variaveis do cronograma: _notas, _alunoId, _mentor
   ===================================================================== */
var CR_INTERVALOS = [1, 3, 7, 15, 30, 60]
var _crFila = [], _crPos = 0, _crMostrar = false, _crFeitas = { l: 0, e: 0 }, _crSemColuna = false

function crHoje () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
function crSoma (n) { var d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
function crLocal () { try { return JSON.parse(localStorage.getItem('cr_' + _alunoId) || '{}') } catch (e) { return {} } }
function crGuardarLocal (m) { try { localStorage.setItem('cr_' + _alunoId, JSON.stringify(m)) } catch (e) {} }

// data da proxima revisao de uma anotacao (coluna do banco ou, antes do SQL, copia local)
function crRevisarEm (n) {
  var loc = crLocal()[n.id]
  var r = n.revisar_em || (loc && loc.r)
  if (r) return String(r).slice(0, 10)
  // anotacao nova: revisa no dia seguinte ao que foi escrita
  var d = new Date(n.criado_em || n.atualizado_em || Date.now()); d.setDate(d.getDate() + 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function crNivel (n) { var loc = crLocal()[n.id]; return n.nivel != null ? n.nivel : (loc ? loc.n : 0) || 0 }
function crVencidas (notas) {
  var h = crHoje()
  return (notas || []).filter(function (n) { return crRevisarEm(n) <= h })
    .sort(function (a, b) { return crRevisarEm(a) < crRevisarEm(b) ? -1 : crRevisarEm(a) > crRevisarEm(b) ? 1 : crNivel(a) - crNivel(b) })
}

function crIniciar () {
  _crFila = crVencidas(_notas); _crPos = 0; _crMostrar = false; _crFeitas = { l: 0, e: 0 }
}
function crEsc (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function renderRevisaoCaderno (box) {
  if (!_notas.length) {
    box.innerHTML = '<div style="text-align:center;padding:36px 10px;color:var(--tx3);font-size:13px">Seu caderno esta vazio. Ao errar uma questao, salve a anotacao: ela volta aqui para revisar no dia certo.</div>'
    return
  }
  if (!_crFila.length && !_crFeitas.l && !_crFeitas.e) crIniciar()
  if (!_crFila.length) {
    var prox = _notas.map(crRevisarEm).sort()[0]
    box.innerHTML = '<div style="text-align:center;padding:30px 10px">'
      + '<div style="font-size:42px">✅</div><div style="color:#c9a9e8;font-weight:800;font-size:16px;margin-top:6px">Nada para revisar hoje</div>'
      + '<p style="color:var(--tx3);font-size:13px;margin-top:8px;line-height:1.6">Proxima revisao: <strong>' + new Date(prox + 'T12:00:00').toLocaleDateString('pt-BR') + '</strong>.<br>Se quiser, releia tudo no modo Leitura.</p></div>'
    return
  }
  if (_crPos >= _crFila.length) {
    box.innerHTML = '<div style="text-align:center;padding:30px 10px">'
      + '<div style="font-size:42px">🏁</div><div style="color:#c9a9e8;font-weight:800;font-size:16px;margin-top:6px">Revisao do dia concluida!</div>'
      + '<p style="color:var(--tx2);font-size:13.5px;margin-top:8px;line-height:1.6">✓ ' + _crFeitas.l + ' lembrei · ✗ ' + _crFeitas.e + ' esqueci<br>'
      + (_crFeitas.e ? 'As que voce esqueceu voltam amanha.' : 'Memoria afiada. Continue assim!') + '</p>'
      + '<button class="btn btn-ouro" style="margin-top:14px" onclick="fecharCaderno()">Fechar</button></div>'
    return
  }
  var n = _crFila[_crPos], niv = crNivel(n)
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;color:var(--tx3)">'
    + '<span>🔁 ' + (_crPos + 1) + ' de ' + _crFila.length + ' para hoje</span><span>nivel ' + niv + '/' + (CR_INTERVALOS.length - 1) + '</span></div>'
    + '<div style="height:5px;border-radius:4px;background:var(--bd);overflow:hidden;margin-bottom:14px"><div style="height:100%;width:' + Math.round(_crPos / _crFila.length * 100) + '%;background:#b98ae0"></div></div>'
    + '<div class="cd-item" style="cursor:default;border-left-width:4px">'
    + '<div class="cd-it" style="font-size:15px">' + crEsc(n.titulo) + '</div>'
    + '<div class="cd-id">' + (n.disciplina ? crEsc(n.disciplina) : 'Sem disciplina') + '</div></div>'
  if (!_crMostrar) {
    h += '<p style="color:var(--tx2);font-size:13.5px;line-height:1.6;margin:12px 0;text-align:center">Antes de abrir, tente lembrar: <strong>qual e a regra? por que voce errou?</strong></p>'
      + '<button class="btn btn-ouro" style="width:100%;padding:13px" onclick="_crMostrar=true;renderCaderno()">Mostrar minha anotacao</button>'
  } else {
    h += '<div class="cd-ro" style="margin:12px 0">' + crEsc(n.conteudo || '(sem texto)') + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + '<button class="btn" style="padding:13px;border-color:#f07171;color:#f07171;font-weight:800" ' + (_mentor ? 'disabled' : '') + ' onclick="crResponder(false)">✗ Esqueci</button>'
      + '<button class="btn" style="padding:13px;border-color:#6ddba0;color:#6ddba0;font-weight:800" ' + (_mentor ? 'disabled' : '') + ' onclick="crResponder(true)">✓ Lembrei</button></div>'
      + '<div style="color:var(--tx4);font-size:11.5px;text-align:center;margin-top:8px">Lembrei: volta em ' + CR_INTERVALOS[Math.min(niv + 1, CR_INTERVALOS.length - 1)] + ' dia(s) · Esqueci: volta amanha</div>'
  }
  box.innerHTML = h
}

async function crResponder (lembrou) {
  var n = _crFila[_crPos]; if (!n) return
  var niv = crNivel(n)
  var novo = lembrou ? Math.min(niv + 1, CR_INTERVALOS.length - 1) : 0
  var r = crSoma(lembrou ? CR_INTERVALOS[novo] : 1)
  n.nivel = novo; n.revisar_em = r; n.revisoes = (n.revisoes || 0) + 1
  if (lembrou) _crFeitas.l++; else _crFeitas.e++
  _crPos++; _crMostrar = false
  renderCaderno()
  // salva (coluna do banco; se o SQL ainda nao rodou, guarda neste aparelho)
  var loc = crLocal(); loc[n.id] = { r: r, n: novo }; crGuardarLocal(loc)
  if (!_crSemColuna) {
    try {
      var x = await _supabase.from('caderno_erros').update({ nivel: novo, revisar_em: r, revisoes: n.revisoes, ultima_revisao: new Date().toISOString() }).eq('id', n.id)
      if (x.error && /column|schema cache/i.test(x.error.message)) _crSemColuna = true
    } catch (e) {}
  }
  // terminou a fila: marca a meta do caderno de hoje
  if (_crPos >= _crFila.length && typeof marcarCaderno === 'function' && typeof cadernoHoje === 'function' && !cadernoHoje()) {
    try { await marcarCaderno(hojeStr(), true); if (typeof renderHoje === 'function') renderHoje(); if (typeof toast === 'function') toast('📓 Revisao feita: meta do caderno cumprida!') } catch (e) {}
  }
}

// quantas anotacoes vencem hoje (para a Missao de hoje), sem abrir o caderno
var _crPendentes = null
async function contarRevisaoCaderno () {
  try {
    var r = await _supabase.from('caderno_erros').select('*').eq('aluno_id', _alunoId).limit(2000)
    if (r.error) return
    if (!_cdCarregado) { _notas = (r.data || []).sort(function (a, b) { return new Date(b.atualizado_em) - new Date(a.atualizado_em) }); _cdCarregado = true }
    _crPendentes = crVencidas(_notas).length
    if (typeof renderHoje === 'function') renderHoje()
  } catch (e) {}
}
