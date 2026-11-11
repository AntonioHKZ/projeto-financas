import { describe, expect, it } from 'vitest'
import { ehDiaUtil, enesimoDiaUtil, pascoa } from './diasUteis'
import { dataDoRecorrente } from './mes'
import { filtrarPorVisao, opcoesDeVisao, OUTRAS, TODOS } from './visao'
import type { Dados, Recorrente } from './types'

describe('dias úteis', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString())
    expect(pascoa(2025).toDateString()).toBe(new Date(2025, 3, 20).toDateString())
  })
  it('pula domingos e feriados (Finados, Sexta-feira Santa)', () => {
    expect(ehDiaUtil(2026, 11, 1)).toBe(false) // domingo
    expect(ehDiaUtil(2026, 11, 2)).toBe(false) // Finados
    expect(ehDiaUtil(2026, 4, 3)).toBe(false) // Sexta-feira Santa
    expect(ehDiaUtil(2026, 11, 3)).toBe(true)
  })
  it('5º dia útil: sábado conta (CLT) ou não', () => {
    // nov/2026: 1 dom, 2 Finados → 3,4,5,6 (seg-sex) e 7 (sáb)
    expect(enesimoDiaUtil('2026-11', 5, true)).toBe('2026-11-07')
    expect(enesimoDiaUtil('2026-11', 5, false)).toBe('2026-11-09')
    // jan/2027: 1 é feriado (sexta)
    expect(enesimoDiaUtil('2027-01', 5, true)).toBe('2027-01-07')
    expect(enesimoDiaUtil('2027-01', 5, false)).toBe('2027-01-08')
  })
  it('recorrente usa dia útil ou dia fixo', () => {
    const r: Recorrente = { id: '1', tipo: 'receita', descricao: 'Salário', valor: 100, frequencia: 'mensal', dia: 5, inicio: '2026-01', pagos: {} }
    expect(dataDoRecorrente(r, '2026-11')).toBe('2026-11-05')
    expect(dataDoRecorrente({ ...r, diaUtil: true }, '2026-11')).toBe('2026-11-07')
    expect(dataDoRecorrente({ ...r, diaUtil: true, sabadoUtil: false }, '2026-11')).toBe('2026-11-09')
  })
})

describe('visão por banco', () => {
  const dados: Dados = {
    categorias: [], regras: [],
    contas: [
      { id: 'nu', nome: 'Nubank Cartão', tipo: 'cartao', cor: '#820ad1' }, // banco pelo nome
      { id: 'in', nome: 'Cartão laranja', banco: 'Inter', tipo: 'cartao', cor: '#ff7a00' }, // banco explícito
      { id: 'din', nome: 'Dinheiro', tipo: 'dinheiro', cor: '#16a34a' },
    ],
    lancamentos: [
      { id: 'a', tipo: 'despesa', descricao: 'x', valor: 100, data: '2026-11-01', contaId: 'nu' },
      { id: 'b', tipo: 'despesa', descricao: 'y', valor: 200, data: '2026-11-01', contaId: 'in' },
      { id: 'c', tipo: 'despesa', descricao: 'z', valor: 300, data: '2026-11-01', contaId: 'din' },
    ],
    parcelados: [{ id: 'p', descricao: 'TV', valorParcela: 1000, parcelas: 3, primeiroMes: '2026-11', pagos: {}, contaId: 'in' }],
    recorrentes: [],
  }
  it('lista os bancos das contas + "Outras contas"', () => {
    expect(opcoesDeVisao(dados.contas).map((o) => o.nome)).toEqual(['Inter', 'Nubank', 'Outras contas'])
  })
  it('filtra contas e itens do banco escolhido', () => {
    const inter = filtrarPorVisao(dados, 'Inter')
    expect(inter.contas.map((c) => c.id)).toEqual(['in'])
    expect(inter.lancamentos.map((l) => l.id)).toEqual(['b'])
    expect(inter.parcelados).toHaveLength(1)
    expect(filtrarPorVisao(dados, 'nubank').lancamentos.map((l) => l.id)).toEqual(['a'])
    expect(filtrarPorVisao(dados, OUTRAS).lancamentos.map((l) => l.id)).toEqual(['c'])
    expect(filtrarPorVisao(dados, TODOS).lancamentos).toHaveLength(3)
  })
})
