// Funcao serverless da Vercel — ponte segura entre a plataforma e a API da Anthropic.
// A chave da API fica so no servidor, nunca no navegador do aluno.

const SISTEMA = `Voce e o tutor virtual da mentoria "Patrulheiros de Elite", do Cabo Jota (Jorge Mendes),
policial militar de Sergipe e mentor de concursos policiais.

QUEM VOCE ATENDE
Concurseiros que estudam para carreiras policiais e militares no Brasil (Policia Militar, Policia Civil,
Guarda Municipal, PRF, Policia Penal). Muitos trabalham e estudam, alguns tem dificuldade de leitura e
interpretacao. Escreva para eles, nao para um professor universitario.

COMO RESPONDER
- Portugues do Brasil, direto, sem enrolacao. Frases curtas.
- Comece pela resposta. Depois explique.
- Use exemplos ligados a rotina policial sempre que ajudar a fixar.
- Cite o dispositivo legal quando existir (artigo, lei, sumula).
- Termine com um "BIZU:" de uma ou duas frases: a regra pratica que o aluno anota no caderno de erros.
- Se a pergunta for sobre uma questao especifica, explique por que o gabarito e aquele e por que as
  outras alternativas estao erradas.
- Responda em ate 350 palavras, salvo se o aluno pedir mais profundidade.

REGRAS IMPORTANTES
- Se nao tiver certeza sobre uma lei recente, alteracao legislativa ou entendimento de tribunal, diga
  claramente que o aluno deve conferir a redacao atualizada. Nunca invente numero de artigo, sumula ou
  jurisprudencia.
- Foque no que a banca cobra. Quando souber que um tema e recorrente em prova, avise.
- Voce nao substitui o mentor. Se a duvida for sobre cronograma, prazo de acesso, pagamento ou estrategia
  pessoal de estudo, oriente o aluno a falar direto com o Cabo Jota.
- Nao responda temas fora do escopo de concursos e estudo. Se fugir do assunto, redirecione com gentileza.
- Nunca escreva ou corrija provas em andamento, nem ajude em qualquer forma de fraude.`

// So o site da mentoria pode chamar esta funcao, e so com aluno logado.
// (antes qualquer pessoa na internet podia usar e gastar os creditos da API)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hlygwqftnfmywsmajvkz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_g1To88yIFAty6kkkIeskkQ_XrSkGOaA'
const ORIGENS = ['https://patrulheirojota.com.br', 'https://www.patrulheirojota.com.br']
const LIMITE_POR_HORA = 40
const _uso = {}   // limite simples por usuario (por instancia do servidor)

async function usuarioLogado(req) {
  const h = req.headers.authorization || ''
  const token = h.indexOf('Bearer ') === 0 ? h.slice(7) : ''
  if (!token) return null
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_KEY }
    })
    if (!r.ok) return null
    const u = await r.json()
    return u && u.id ? u : null
  } catch (e) { return null }
}

export default async function handler(req, res) {
  const origem = req.headers.origin || ''
  const permitida = ORIGENS.indexOf(origem) >= 0 || /\.vercel\.app$/.test(origem)
  if (permitida) res.setHeader('Access-Control-Allow-Origin', origem)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' })
  if (origem && !permitida) return res.status(403).json({ erro: 'Origem nao permitida.' })

  const usuario = await usuarioLogado(req)
  if (!usuario) return res.status(401).json({ erro: 'Entre na plataforma para usar o tutor.' })

  const hora = Math.floor(Date.now() / 3600000)
  const k = usuario.id + ':' + hora
  _uso[k] = (_uso[k] || 0) + 1
  if (_uso[k] > LIMITE_POR_HORA) return res.status(429).json({ erro: 'Limite de perguntas por hora atingido. Tente mais tarde.' })

  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) {
    return res.status(500).json({ erro: 'A chave da API nao foi configurada no servidor.' })
  }

  try {
    const { mensagens, contexto } = req.body || {}
    if (!Array.isArray(mensagens) || !mensagens.length) {
      return res.status(400).json({ erro: 'Envie ao menos uma mensagem.' })
    }
    if (mensagens.length > 30) {
      return res.status(400).json({ erro: 'Conversa muito longa. Comece uma nova.' })
    }

    // Mantem apenas as ultimas 12 trocas para controlar custo
    const hist = mensagens.slice(-12).map(function (m) {
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 6000)
      }
    })

    let sistema = SISTEMA
    if (contexto && String(contexto).trim()) {
      sistema += '\n\nCONTEXTO DA DUVIDA (questao que o aluno esta vendo agora):\n' + String(contexto).slice(0, 4000)
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: sistema,
        messages: hist
      })
    })

    if (!r.ok) {
      const t = await r.text()
      console.error('Erro da API:', r.status, t)
      if (r.status === 429) return res.status(429).json({ erro: 'Muitas perguntas ao mesmo tempo. Tente de novo em instantes.' })
      if (r.status === 401) return res.status(500).json({ erro: 'Chave da API invalida. Verifique a configuracao.' })
      return res.status(500).json({ erro: 'Nao consegui responder agora. Tente novamente.' })
    }

    const dados = await r.json()
    const texto = (dados.content || [])
      .filter(function (b) { return b.type === 'text' })
      .map(function (b) { return b.text })
      .join('\n')

    return res.status(200).json({
      resposta: texto || 'Nao consegui gerar uma resposta. Reformule a pergunta.',
      uso: dados.usage || null
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ erro: 'Erro inesperado: ' + e.message })
  }
}
