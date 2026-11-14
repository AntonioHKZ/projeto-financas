import { describe, expect, it } from 'vitest'
import { analisar, categoriasNovasDisponiveis, ehNova, PREFIXO_NOVA } from './importacao'
import type { TransacaoBruta } from './importadores'
import type { Categoria, Dados } from './types'

const t = (descricao: string, extra: Partial<TransacaoBruta> = {}): TransacaoBruta => ({
  fonte: 'cartao', data: '2026-10-05', descricao, descBase: descricao, valor: 1990, tipo: 'despesa', hash: 'h-' + descricao, ...extra,
})

const vazio: Dados = { categorias: [], contas: [], lancamentos: [], parcelados: [], recorrentes: [], regras: [] }
const transporte: Categoria = { id: 'cat-transp', nome: 'Transporte', emoji: '🚗', cor: '#0ea5e9' }

describe('categorias sugeridas na importação', () => {
  it('sem categorias: sugere a categoria padrão como nova', () => {
    const [uber, ifood, loja] = analisar([t('Uber *Trip'), t('Ifood *Restaurante'), t('Loja Qualquer')], vazio)
    expect(uber.categoriaId).toBe(PREFIXO_NOVA + 'Transporte')
    expect(ifood.categoriaId).toBe(PREFIXO_NOVA + 'Alimentação')
    expect(ehNova(uber.categoriaId)).toBe(true)
    expect(loja.categoriaId).toBeUndefined() // não reconhecido: continua sem categoria
  })

  it('usa a categoria existente em vez de sugerir nova', () => {
    const [uber] = analisar([t('Uber *Trip')], { ...vazio, categorias: [transporte] })
    expect(uber.categoriaId).toBe('cat-transp')
  })

  it('não oferece como nova uma categoria que já existe (maiúsculas e acentos não importam)', () => {
    const existentes: Categoria[] = [{ ...transporte, nome: 'TRANSPORTE' }, { id: 'x', nome: 'alimentacao', emoji: '🍔', cor: '#f00' }]
    const novas = categoriasNovasDisponiveis(existentes).map((c) => c.nome)
    expect(novas).not.toContain('Transporte')
    expect(novas).not.toContain('Alimentação')
    expect(novas).toContain('Mercado')
    expect(categoriasNovasDisponiveis(existentes).every((c) => ehNova(c.id))).toBe(true)
  })

  it('regra do usuário vence a sugestão automática', () => {
    const lazer: Categoria = { id: 'cat-lazer', nome: 'Lazer', emoji: '🎮', cor: '#ec4899' }
    const [uber] = analisar([t('Uber *Trip')], { ...vazio, categorias: [lazer], regras: [{ id: 'r', contem: 'uber', categoriaId: 'cat-lazer' }] })
    expect(uber.categoriaId).toBe('cat-lazer')
  })
})
