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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' })

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
