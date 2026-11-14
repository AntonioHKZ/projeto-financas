/**
 * Sugestão de categoria para um item importado. Tudo roda localmente, sem IA.
 *
 * Duas fontes "de fábrica" (as regras do usuário e o histórico ficam em importacao.ts):
 *  - PALAVRAS: nome do estabelecimento → categoria (ex.: "uber" → Transporte)
 *  - CATEGORIAS_DO_BANCO: categoria que o próprio banco manda no arquivo → categoria do app
 *    (ex.: "SUPERMERCADOS" → Mercado)
 *
 * Os nomes das categorias aqui são os de CATEGORIAS_PADRAO (db.ts). Tudo é comparado em
 * minúsculas e sem acento (ver `normalizar`).
 */
import { normalizar } from './format'

// ---------- 1) palavras-chave do estabelecimento ----------

export const PALAVRAS: Record<string, string[]> = {
  'Assinaturas': [
    'netflix', 'spotify', 'disney', 'disney+', 'hbo', 'hbomax', 'hbo max', 'max', 'prime video', 'amazon prime', 'primevideo', 'amazon music',
    'youtube', 'youtube premium', 'youtubepremium', 'google one', 'google storage', 'icloud', 'apple.com', 'apple com', 'apple tv', 'apple music',
    'deezer', 'tidal', 'globoplay', 'globo play', 'telecine', 'premiere', 'paramount', 'crunchyroll', 'star+', 'mubi', 'looke', 'directv go', 'dgo',
    'chatgpt', 'openai', 'claude', 'anthropic', 'microsoft 365', 'office 365', 'dropbox', 'canva', 'adobe', 'notion', 'github', 'linkedin premium',
    'kindle unlimited', 'audible', 'playstation plus', 'ps plus', 'game pass', 'xbox game pass', 'nintendo online', 'twitch', 'discord', 'meli+',
  ],
  'Alimentação': [
    'ifood', 'ifd', 'rappi', 'uber eats', 'ubereats', 'ze delivery', 'aiqfome', 'restaurante', 'lanchonete', 'lanches', 'lanche', 'padaria', 'panificadora',
    'confeitaria', 'doceria', 'pastelaria', 'churrascaria', 'hamburgueria', 'pizzaria', 'pizza', 'pizza hut', 'dominos', 'burger', 'burger king', 'bk',
    'mcdonalds', 'mc donalds', 'mcdonald', 'bobs', 'giraffas', 'spoleto', 'china in box', 'kfc', 'popeyes', 'subway', 'habibs', 'ragazzo', 'jeronimo',
    'madero', 'outback', 'coco bambu', 'starbucks', 'cafe', 'cafeteria', 'the coffee', 'cacau show', 'kopenhagen', 'havanna', 'sorveteria', 'sorvete',
    'bacio di latte', 'oakberry', 'acai', 'sushi', 'temaki', 'marmitaria', 'marmita', 'espetinho', 'cantina', 'bistro', 'galeto', 'grill',
  ],
  'Mercado': [
    'supermercado', 'supermercados', 'hipermercado', 'minimercado', 'mini mercado', 'mercado', 'mercearia', 'atacadista', 'atacarejo', 'atacadao',
    'assai', 'carrefour', 'pao de acucar', 'extra hiper', 'sams club', 'makro', 'max atacadista', 'fort atacadista', 'tenda atacado', 'dia supermercado',
    'zaffari', 'big bompreco', 'bompreco', 'gbarbosa', 'mateus supermercados', 'nordestao', 'guanabara', 'prezunic', 'muffato', 'angeloni', 'bistek',
    'giassi', 'comper', 'savegnago', 'hirota', 'st marche', 'mambo', 'verdemar', 'supernosso', 'bh supermercados', 'oxxo', 'hortifruti', 'oba hortifruti',
    'natural da terra', 'sacolao', 'quitanda', 'acougue', 'peixaria',
  ],
  'Transporte': [
    'uber', '99app', '99 app', '99pop', '99 tecnologia', 'cabify', 'indrive', 'in drive', 'buser', 'clickbus', 'blablacar', 'posto', 'auto posto',
    'autoposto', 'shell', 'ipiranga', 'petrobras', 'br mania', 'ale combustiveis', 'combustivel', 'gasolina', 'etanol', 'estacionamento', 'estapar',
    'indigo', 'multipark', 'zul digital', 'sem parar', 'veloe', 'conectcar', 'taggy', 'pedagio', 'metro', 'cptm', 'sptrans', 'riocard', 'bilhete unico',
    'top bilhete', 'onibus', 'tembici', 'bike itau', 'localiza', 'movida', 'unidas', 'gol linhas', 'latam', 'azul linhas', 'detran', 'ipva',
    'licenciamento', 'oficina', 'borracharia', 'auto pecas', 'autopecas', 'lava jato', 'lava rapido',
  ],
  'Saúde': [
    'drogasil', 'droga raia', 'drogaria', 'drogaria sao paulo', 'drogao', 'farmacia', 'farmacias', 'pague menos', 'panvel', 'ultrafarma', 'extrafarma',
    'venancio', 'pacheco', 'nissei', 'araujo', 'onofre', 'hospital', 'clinica', 'laboratorio', 'fleury', 'dasa', 'delboni', 'lavoisier', 'hermes pardini',
    'sabin', 'dentista', 'odonto', 'odontologia', 'odontoprev', 'unimed', 'amil', 'sulamerica', 'hapvida', 'notredame', 'prevent senior', 'psicologo',
    'psicologa', 'fisioterapia', 'otica', 'oticas', 'smart fit', 'smartfit', 'bluefit', 'selfit', 'bodytech', 'academia', 'crossfit', 'pilates',
    'wellhub', 'gympass', 'totalpass',
  ],
  'Compras': [
    'amazon', 'amzn', 'mercado livre', 'mercadolivre', 'mercadopago', 'shopee', 'aliexpress', 'shein', 'temu', 'magalu', 'magazine luiza', 'americanas',
    'lojas americanas', 'submarino', 'shoptime', 'casas bahia', 'ponto frio', 'pontofrio', 'fast shop', 'fastshop', 'kabum', 'pichau', 'terabyte',
    'renner', 'lojas renner', 'riachuelo', 'c&a', 'cea', 'zara', 'marisa', 'pernambucanas', 'havan', 'hering', 'youcom', 'arezzo', 'schutz', 'nike',
    'adidas', 'centauro', 'netshoes', 'decathlon', 'dafiti', 'zattini', 'privalia', 'boticario', 'natura', 'sephora', 'epoca cosmeticos', 'leroy merlin',
    'telhanorte', 'tok stok', 'tokstok', 'camicado', 'daiso', 'miniso', 'le biscuit', 'kalunga', 'papelaria', 'petz', 'cobasi', 'petlove', 'apple store',
    'samsung', 'xiaomi',
  ],
  'Lazer': [
    'cinema', 'cinemark', 'cinepolis', 'kinoplex', 'cinesystem', 'uci cinemas', 'ingresso', 'ingresso.com', 'sympla', 'eventim', 'ticketmaster',
    'tickets for fun', 'livepass', 'blueticket', 'ingresse', 'teatro', 'museu', 'show', 'steam', 'playstation', 'psn', 'xbox', 'nintendo', 'epic games',
    'riot games', 'blizzard', 'bar', 'boteco', 'pub', 'balada', 'boliche', 'karaoke', 'booking', 'airbnb', 'decolar', 'hurb', 'cvc', '123milhas',
    'hotel', 'pousada', 'hostel', 'hopi hari', 'beto carrero', 'beach park',
  ],
  'Educação': [
    'udemy', 'alura', 'coursera', 'duolingo', 'hotmart', 'eduzz', 'kiwify', 'domestika', 'rocketseat', 'descomplica', 'estrategia concursos', 'gran cursos',
    'curso', 'cursos', 'escola', 'colegio', 'faculdade', 'universidade', 'mensalidade escolar', 'cultura inglesa', 'wizard', 'ccaa', 'fisk', 'kumon',
    'livraria', 'saraiva', 'livraria cultura', 'estante virtual', 'kindle', 'unip', 'estacio', 'anhanguera', 'uninter', 'fgv', 'senac', 'senai',
  ],
  'Moradia': [
    'aluguel', 'condominio', 'imobiliaria', 'quintoandar', 'quinto andar', 'iptu', 'energia', 'enel', 'cemig', 'copel', 'light', 'celesc', 'coelba',
    'neoenergia', 'equatorial', 'cpfl', 'elektro', 'energisa', 'celpe', 'cosern', 'coelce', 'ceee', 'sabesp', 'sanepar', 'copasa', 'cedae', 'embasa',
    'caesb', 'compesa', 'cagece', 'gas', 'comgas', 'naturgy', 'ultragaz', 'liquigas', 'supergasbras', 'internet', 'vivo', 'vivo fibra', 'claro',
    'claro net', 'tim', 'tim live', 'oi fibra', 'brisanet', 'algar', 'sky', 'diarista', 'faxina', 'lavanderia', 'seguro residencial',
  ],
  'Salário': ['salario', 'pagamento de salario', 'folha de pagamento', 'proventos', 'remuneracao', 'adiantamento salarial', '13 salario', 'decimo terceiro', 'pro labore', 'prolabore'],
}

export const ASSINATURAS_CONHECIDAS = PALAVRAS['Assinaturas']

export function contemPalavra(texto: string, palavra: string): boolean {
  const esc = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(texto)
}

/** Procura o termo mais específico (mais longo) que aparece no texto e devolve a categoria dele. */
function melhorCategoria(textoNormalizado: string, dicionario: Record<string, string[]>): string | undefined {
  let melhor: { categoria: string; tamanho: number } | undefined
  for (const [categoria, termos] of Object.entries(dicionario)) {
    for (const termo of termos) {
      if (termo.length > (melhor?.tamanho ?? 0) && contemPalavra(textoNormalizado, termo)) melhor = { categoria, tamanho: termo.length }
    }
  }
  return melhor?.categoria
}

/**
 * Nome da categoria padrão para a descrição de um estabelecimento, ou undefined.
 * Quando mais de uma palavra bate, vence a mais longa: "MAX ATACADISTA" é Mercado
 * (por "max atacadista"), não Assinaturas (por "max").
 */
export function categoriaPorPalavra(descricao: string): string | undefined {
  return melhorCategoria(normalizar(descricao), PALAVRAS)
}

// ---------- 2) categoria que o próprio banco manda no arquivo ----------

/**
 * Termos que os bancos costumam usar na coluna de categoria da fatura/extrato → categoria do app.
 * A lista foi montada com os nomes mais comuns; nomes que não estiverem aqui ficam sem tradução
 * (o item continua sem categoria e mostra a categoria do banco na revisão).
 */
export const CATEGORIAS_DO_BANCO: Record<string, string[]> = {
  'Alimentação': ['alimentacao', 'restaurante', 'restaurantes', 'bares e restaurantes', 'bar e restaurante', 'lanchonete', 'lanchonetes', 'fast food', 'delivery', 'refeicao', 'refeicoes', 'padaria', 'padarias', 'cafeteria', 'comida'],
  'Mercado': ['mercado', 'mercados', 'supermercado', 'supermercados', 'hipermercado', 'hipermercados', 'atacado', 'atacadista', 'mercearia', 'hortifruti', 'acougue', 'feira'],
  'Transporte': ['transporte', 'transportes', 'combustivel', 'combustiveis', 'posto', 'postos', 'posto de combustivel', 'postos de combustivel', 'automovel', 'automoveis', 'automotivo', 'veiculo', 'veiculos', 'carro', 'estacionamento', 'estacionamentos', 'pedagio', 'pedagios', 'taxi', 'mobilidade', 'transporte por aplicativo', 'companhia aerea', 'companhias aereas', 'passagens', 'passagem'],
  'Saúde': ['saude', 'farmacia', 'farmacias', 'drogaria', 'drogarias', 'hospital', 'hospitais', 'clinica', 'clinicas', 'medico', 'medicos', 'servicos medicos', 'laboratorio', 'laboratorios', 'plano de saude', 'bem estar', 'saude e bem estar', 'academia', 'academias', 'cuidados pessoais', 'beleza', 'estetica'],
  'Compras': ['compras', 'vestuario', 'roupas', 'moda', 'calcados', 'acessorios', 'loja', 'lojas', 'loja de departamento', 'lojas de departamento', 'departamento', 'eletronicos', 'eletrodomesticos', 'eletro', 'informatica', 'tecnologia', 'e-commerce', 'ecommerce', 'compras online', 'marketplace', 'presentes', 'cosmeticos', 'perfumaria', 'pet', 'pet shop', 'petshop', 'artigos esportivos', 'brinquedos', 'joalheria'],
  'Lazer': ['lazer', 'entretenimento', 'diversao', 'cinema', 'cinemas', 'cultura', 'shows', 'eventos', 'ingressos', 'jogos', 'games', 'esporte', 'esportes', 'viagem', 'viagens', 'turismo', 'hotel', 'hoteis', 'hospedagem', 'bares', 'bar', 'casa noturna'],
  'Educação': ['educacao', 'ensino', 'escola', 'escolas', 'curso', 'cursos', 'faculdade', 'universidade', 'livraria', 'livrarias', 'livros', 'material escolar'],
  'Moradia': ['moradia', 'casa', 'lar', 'casa e construcao', 'construcao', 'material de construcao', 'moveis', 'decoracao', 'contas', 'contas de consumo', 'contas e servicos', 'utilidades', 'servicos publicos', 'energia', 'energia eletrica', 'agua', 'agua e esgoto', 'gas', 'telefonia', 'telefone', 'telecomunicacoes', 'internet', 'tv por assinatura', 'aluguel', 'condominio', 'habitacao'],
  'Assinaturas': ['assinatura', 'assinaturas', 'streaming', 'servicos digitais', 'servicos online', 'servicos de streaming', 'assinaturas e servicos'],
  'Salário': ['salario', 'salarios', 'renda', 'rendimento', 'rendimentos', 'proventos'],
  'Outros': ['outros', 'outras', 'diversos', 'servicos', 'servico', 'taxas', 'tarifas', 'impostos', 'tributos', 'seguros', 'seguro', 'financeiro', 'servicos financeiros', 'doacoes', 'ajuste'],
}

/** "SUPERMERCADOS" → "Mercado". Devolve undefined para vazio, "-" ou nome desconhecido. */
export function traduzirCategoriaDoBanco(categoriaDoBanco?: string): string | undefined {
  const n = normalizar(categoriaDoBanco ?? '').replace(/[^a-z0-9 &+-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (n.length < 2) return undefined
  // 1º a categoria inteira igual a um termo; depois o termo mais longo contido nela
  for (const [categoria, termos] of Object.entries(CATEGORIAS_DO_BANCO)) if (termos.includes(n)) return categoria
  return melhorCategoria(n, CATEGORIAS_DO_BANCO)
}
