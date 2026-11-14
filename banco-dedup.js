/* =====================================================================
   TRIAGEM DE DUPLICADAS NA IMPORTACAO (banco de questoes)
   Antes de inserir, compara cada questao com o banco inteiro:
   - nova            -> entra no banco
   - ja existe       -> NAO duplica; se faltar, ganha o vinculo com o concurso
                        escolhido e o comentario/bizu/assunto que estiverem vazios
   - repetida no lote-> a mesma questao veio duas vezes nos arquivos: entra uma so
   - conflito        -> ja existe, mas com gabarito diferente: nao mexe, so avisa
   Com opts.atualizar (reimportar o arquivo corrigido): a que ja existe recebe a disciplina,
   o assunto, o texto de apoio, o gabarito, o comentario e o bizu do arquivo e volta a ficar ativa.
   Usado por questoes-admin.html e simulados-admin.html.
   Funciona no navegador e no Node (para testes).
   ===================================================================== */
(function (raiz) {
  function norm (t) {
    return String(t == null ? '' : t).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim()
  }
  // chave da questao: enunciado + alternativas. Enunciado curto ("Julgue o item")
  // nao identifica sozinho: entra tambem o comeco do texto de apoio.
  function chave (q) {
    var en = norm(q && q.enunciado)
    if (!en) return ''
    var k = en
    if (q.alternativas && q.alternativas.length) k += ' #' + q.alternativas.map(norm).join(' | ')
    if (en.length < 60 && q.texto_apoio) k = norm(q.texto_apoio).slice(0, 400) + ' #' + k
    return k
  }

  async function paginar (fabrica, max) {
    var out = [], ini = 0
    for (var g = 0; g < (max || 300); g++) {
      var r = await fabrica().range(ini, ini + 999)
      if (r.error) throw r.error
      var d = r.data || []
      out.push.apply(out, d)
      if (d.length < 1000) break
      ini += 1000
    }
    return out
  }

  // carrega o banco uma vez (id, textos e vinculos com concursos)
  async function carregarIndice (sb, prog) {
    var qs = await paginar(function () {
      return sb.from('questoes').select('id,enunciado,alternativas,texto_apoio,gabarito,comentario,bizu,assunto,disciplina,ativo').order('id')
    })
    if (prog) prog('Conferindo vinculos de ' + qs.length + ' questoes...')
    var vins = []
    try { vins = await paginar(function () { return sb.from('questao_concursos').select('questao_id,concurso_id').order('questao_id') }) } catch (e) { vins = [] }
    var ind = { porChave: {}, porId: {}, total: qs.length, quando: Date.now() }
    qs.forEach(function (q) { indexar(ind, q) })
    vins.forEach(function (v) { var x = ind.porId[v.questao_id]; if (x) x.concursos[v.concurso_id] = 1 })
    return ind
  }
  function indexar (ind, q) {
    var x = { id: q.id, gabarito: String(q.gabarito || '').toUpperCase(), comentario: !!q.comentario, bizu: !!q.bizu, assunto: !!q.assunto, concursos: {},
      ativo: q.ativo !== false, v: { disciplina: q.disciplina || null, assunto: q.assunto || null, texto_apoio: q.texto_apoio || null, comentario: q.comentario || null, bizu: q.bizu || null } }
    ind.porId[q.id] = x
    var k = chave(q)
    if (k && !ind.porChave[k]) ind.porChave[k] = x
    return x
  }

  // classifica o lote. Nao altera nada no banco.
  function triar (lote, ind, concursoId, opts) {
    opts = opts || {}
    var vistos = {}
    var tri = lote.map(function (q, i) {
      var k = chave(q)
      if (!k) return { i: i, q: q, acao: 'nova', k: k }
      if (vistos[k] != null) {
        var pri = vistos[k]
        // aproveita comentario/bizu da repeticao se a primeira nao tiver
        ;['comentario', 'bizu', 'assunto'].forEach(function (c) { if (!pri.q[c] && q[c]) pri.q[c] = q[c] })
        return { i: i, q: q, acao: 'repetida', k: k, de: pri.i }
      }
      var r = { i: i, q: q, k: k }
      vistos[k] = r
      var ex = ind && ind.porChave[k]
      if (!ex) { r.acao = 'nova'; return r }
      r.acao = 'existe'; r.id = ex.id
      var g = String(q.gabarito || '').toUpperCase()
      if (concursoId && !ex.concursos[concursoId]) r.vincular = true
      if (!ex.ativo) r.inativa = true
      if (opts.atualizar) {
        var at = {}, vv = ex.v || {}
        ;['disciplina', 'assunto', 'texto_apoio', 'comentario', 'bizu'].forEach(function (c) {
          var nv = q[c] == null || q[c] === '' ? null : String(q[c]).trim()
          if (nv && nv !== (vv[c] || null)) at[c] = nv
        })
        if (g && ex.gabarito !== g) { at.gabarito = g; r.gabCorrigido = ex.gabarito }
        if (!ex.ativo) at.ativo = true
        if (Object.keys(at).length) r.atualizar = at
        return r
      }
      if (ex.gabarito && g && ex.gabarito !== g) { r.conflito = true; r.gabBanco = ex.gabarito }
      var up = {}
      if (!r.conflito) {
        if (!ex.comentario && q.comentario) up.comentario = q.comentario
        if (!ex.bizu && q.bizu) up.bizu = q.bizu
        if (!ex.assunto && q.assunto) up.assunto = q.assunto
      }
      if (Object.keys(up).length) r.completar = up
      return r
    })
    return tri
  }
  function resumo (tri) {
    var s = { total: tri.length, novas: 0, existe: 0, repetidas: 0, vincular: 0, completar: 0, conflitos: 0, atualizar: 0, reativar: 0, gabCorrigido: 0, inativas: 0 }
    tri.forEach(function (t) {
      if (t.acao === 'nova') s.novas++
      else if (t.acao === 'repetida') s.repetidas++
      else {
        s.existe++
        if (t.vincular) s.vincular++
        if (t.completar) s.completar++
        if (t.conflito) s.conflitos++
        if (t.atualizar) s.atualizar++
        if (t.atualizar && t.atualizar.ativo) s.reativar++
        if (t.gabCorrigido) s.gabCorrigido++
        if (t.inativa && !t.atualizar) s.inativas++
      }
    })
    return s
  }

  // aplica nas que ja existem: vinculo com o concurso e campos vazios
  async function aplicarExistentes (sb, tri, concursoId, ind, prog) {
    var res = { vinculadas: 0, completadas: 0, erros: [] }
    var ex = tri.filter(function (t) { return t.acao === 'existe' })
    var vin = ex.filter(function (t) { return t.vincular && concursoId }).map(function (t) { return t.id })
      .filter(function (id, i, a) { return a.indexOf(id) === i })
    for (var i = 0; i < vin.length; i += 100) {
      var parte = vin.slice(i, i + 100)
      var r = await sb.from('questao_concursos').insert(parte.map(function (id) { return { questao_id: id, concurso_id: concursoId } }))
      if (r.error) {
        // pode ter vinculo criado em outra aba: tenta um por um
        for (var j = 0; j < parte.length; j++) {
          var r1 = await sb.from('questao_concursos').insert({ questao_id: parte[j], concurso_id: concursoId })
          if (!r1.error) { res.vinculadas++; marcar(ind, parte[j], concursoId) }
        }
      } else { res.vinculadas += parte.length; parte.forEach(function (id) { marcar(ind, id, concursoId) }) }
      if (prog) prog('Vinculando ao concurso... ' + res.vinculadas)
    }
    var comp = ex.filter(function (t) { return t.completar || t.atualizar })
    for (var c = 0; c < comp.length; c++) {
      var dados = comp[c].atualizar || comp[c].completar
      var u = await sb.from('questoes').update(dados).eq('id', comp[c].id)
      if (u.error) { res.erros.push(u.error.message); continue }
      res.completadas++
      if (comp[c].atualizar) res.atualizadas = (res.atualizadas || 0) + 1
      var x = ind && ind.porId[comp[c].id]
      if (x) Object.keys(dados).forEach(function (f) {
        if (f === 'ativo') x.ativo = true
        else if (f === 'gabarito') x.gabarito = dados[f]
        else { if (x.v) x.v[f] = dados[f]; if (f in x) x[f] = true }
      })
      if (prog && res.completadas % 10 === 0) prog('Completando comentarios e bizus... ' + res.completadas)
    }
    return res
  }
  function marcar (ind, id, concursoId) { var x = ind && ind.porId[id]; if (x) x.concursos[concursoId] = 1 }
  // depois de inserir, poe as novas no indice (evita duplicar na proxima importacao)
  function registrarNovas (ind, linhas, ids, concursoId) {
    if (!ind) return
    linhas.forEach(function (l, i) {
      if (!ids[i]) return
      var x = indexar(ind, Object.assign({}, l, { id: ids[i] }))
      if (concursoId) x.concursos[concursoId] = 1
      ind.total++
    })
  }

  var api = { norm: norm, chave: chave, carregarIndice: carregarIndice, triar: triar, resumo: resumo, aplicarExistentes: aplicarExistentes, registrarNovas: registrarNovas }
  raiz.BancoDedup = api
  if (typeof module !== 'undefined') module.exports = api
})(typeof window !== 'undefined' ? window : this)
