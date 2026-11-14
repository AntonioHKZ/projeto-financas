import { describe, expect, it } from 'vitest'
import { categoriaPorPalavra, CATEGORIAS_DO_BANCO, PALAVRAS, traduzirCategoriaDoBanco } from './categorizacao'
import { analisar, PREFIXO_NOVA } from './importacao'
import { lerArquivo, parseComMapeamento, type TransacaoBruta } from './importadores'
import { CATEGORIAS_PADRAO } from './db'
import type { Dados } from './types'

const vazio: Dados = { categorias: [], contas: [], lancamentos: [], parcelados: [], recorrentes: [], regras: [] }

describe('palavras-chave do estabelecimento', () => {
  it('reconhece lojas e apps comuns', () => {
    const casos: [string, string][] = [
      ['Uber *Trip', 'Transporte'], ['IFD*Restaurante Sabor', 'Alimentação'], ['DROGARIA SAO PAULO', 'Saúde'], ['Cinemark Shopping', 'Lazer'],
      ['SUPERMERCADO BOM PRECO', 'Mercado'], ['Netflix.com', 'Assinaturas'], ['CASAS BAHIA', 'Compras'], ['Hotmart *Curso', 'Educação'],
      ['SABESP', 'Moradia'], ['AUTO POSTO CENTRAL', 'Transporte'], ['Pagamento de salário', 'Salário'],
    ]
    for (const [desc, esperado] of casos) expect([desc, categoriaPorPalavra(desc)]).toEqual([desc, esperado])
  })
  it('quando mais de uma palavra bate, vence a mais específica', () => {
    expect(categoriaPorPalavra('MAX ATACADISTA')).toBe('Mercado') // e não Assinaturas por "max"
    expect(categoriaPorPalavra('Max')).toBe('Assinaturas')
    expect(categoriaPorPalavra('MERCADO LIVRE')).toBe('Compras') // e não Mercado por "mercado"
    expect(categoriaPorPalavra('UBER EATS')).toBe('Alimentação') // e não Transporte por "uber"
    expect(categoriaPorPalavra('Amazon Prime')).toBe('Assinaturas') // e não Compras por "amazon"
  })
  it('não confunde pedaço de palavra', () => {
    expect(categoriaPorPalavra('BARBEARIA DO ZE')).toBeUndefined() // "bar" só vale como palavra inteira
    expect(categoriaPorPalavra('Loja Qualquer')).toBeUndefined()
  })
  it('só usa categorias que existem na lista padrão', () => {
    const padrao = new Set(CATEGORIAS_PADRAO.map((c) => c.nome))
    for (const nome of [...Object.keys(PALAVRAS), ...Object.keys(CATEGORIAS_DO_BANCO)]) expect(padrao.has(nome), nome).toBe(true)
  })
})

describe('categoria informada pelo banco', () => {
  it('traduz os nomes mais comuns', () => {
    const casos: [string, string | undefined][] = [
      ['SUPERMERCADOS', 'Mercado'], ['Bares e Restaurantes', 'Alimentação'], ['VESTUÁRIO', 'Compras'], ['ELETRÔNICOS', 'Compras'],
      ['Transporte', 'Transporte'], ['POSTOS DE COMBUSTÍVEL', 'Transporte'], ['Saúde e Bem-estar', 'Saúde'], ['Casa e Construção', 'Moradia'],
      ['SERVIÇOS', 'Outros'], ['viagem', 'Lazer'], ['Educação', 'Educação'],
      ['-', undefined], ['', undefined], ['XPTO 123', undefined],
    ]
    for (const [banco, esperado] of casos) expect([banco, traduzirCategoriaDoBanco(banco)]).toEqual([banco, esperado])
  })

  const CSV = `Data;Lançamento;Categoria;Tipo;Valor
02/10/2026;RESTAURANTE SABOR CASEIRO;ALIMENTAÇÃO;Compra à vista;R$ 58,90
04/10/2026;NETFLIX.COM;SERVIÇOS;Compra à vista;R$ 44,90
06/10/2026;LOJA DE ROUPAS 02/05;VESTUÁRIO;Parcela;R$ 120,00
09/10/2026;COMERCIO XYZ LTDA;PET SHOP;Compra à vista;R$ 80,00
10/10/2026;ESTABELECIMENTO ABC;RAMO DESCONHECIDO;Compra à vista;R$ 10,00
18/10/2026;PAGAMENTO FATURA;-;Pagamento;-R$ 900,00
`
  const ler = (): TransacaoBruta[] => {
    const l = lerArquivo(CSV, 'fatura_itau.csv')
    if (l.tipo !== 'mapear') throw new Error()
    expect(l.sugestao.colCategoria).toBe(2)
    return parseComMapeamento(l.linhas, l.sugestao, l.nomeArquivo, l.banco).transacoes
  }

  it('lê a coluna de categoria do CSV', () => {
    const ts = ler()
    expect(ts.map((t) => t.categoriaBanco)).toEqual(['ALIMENTAÇÃO', 'SERVIÇOS', 'VESTUÁRIO', 'PET SHOP', 'RAMO DESCONHECIDO', undefined])
  })

  it('usa a categoria do banco quando o nome da loja não diz nada', () => {
    const linhas = analisar(ler(), vazio)
    const cat = (desc: string) => linhas.find((l) => l.t.descBase.startsWith(desc))!.categoriaId
    expect(cat('LOJA DE ROUPAS')).toBe(PREFIXO_NOVA + 'Compras') // veio do banco (VESTUÁRIO)
    expect(cat('COMERCIO XYZ')).toBe(PREFIXO_NOVA + 'Compras') // veio do banco (PET SHOP)
    expect(cat('NETFLIX')).toBe(PREFIXO_NOVA + 'Assinaturas') // a loja é mais específica que "SERVIÇOS"
    expect(cat('RESTAURANTE')).toBe(PREFIXO_NOVA + 'Alimentação')
    expect(cat('ESTABELECIMENTO ABC')).toBeUndefined() // banco usou um nome que não conhecemos
  })

  it('regra do usuário continua valendo mais que a categoria do banco', () => {
    const lazer = { id: 'cat-lazer', nome: 'Lazer', emoji: '🎮', cor: '#ec4899' }
    const linhas = analisar(ler(), { ...vazio, categorias: [lazer], regras: [{ id: 'r', contem: 'loja de roupas', categoriaId: 'cat-lazer' }] })
    expect(linhas.find((l) => l.t.descBase.startsWith('LOJA DE ROUPAS'))!.categoriaId).toBe('cat-lazer')
  })

  it('lê a coluna category das exportações antigas do Nubank', () => {
    const l = lerArquivo('date,category,title,amount\n2026-10-02,restaurante,Lugar Novo,45.90\n2026-10-03,,Sem Categoria Ltda,10.00\n')
    if (l.tipo !== 'pronto') throw new Error()
    expect(l.resultado.transacoes.map((t) => t.categoriaBanco)).toEqual(['restaurante', undefined])
    expect(analisar(l.resultado.transacoes, vazio)[0].categoriaId).toBe(PREFIXO_NOVA + 'Alimentação')
  })
})
