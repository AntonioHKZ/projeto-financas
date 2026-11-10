import { CATEGORIAS_PADRAO, CONTAS_PADRAO, substituirTudo } from './db'
import { addMes, dataNoMes, mesDe, uid } from './format'
import type { Categoria, Conta, Lancamento, Parcelado, Recorrente } from './types'

export async function carregarExemplo() {
  const hoje = mesDe()
  const categorias: Categoria[] = CATEGORIAS_PADRAO.map((c) => ({ ...c, id: uid() }))
  const contas: Conta[] = CONTAS_PADRAO.map((c) => ({ ...c, id: uid() }))
  const cat = (nome: string) => categorias.find((c) => c.nome === nome)!.id
  const [cartao, conta, dinheiro] = contas.map((c) => c.id)

  categorias.find((c) => c.nome === 'Alimentação')!.limite = 900
  categorias.find((c) => c.nome === 'Mercado')!.limite = 1200
  categorias.find((c) => c.nome === 'Lazer')!.limite = 400
  categorias.find((c) => c.nome === 'Transporte')!.limite = 500

  const lancamentos: Lancamento[] = []
  const avulsos: [string, number, string, string, number][] = [
    ['iFood', 62.9, 'Alimentação', cartao, 3],
    ['Supermercado Pão de Açúcar', 418.35, 'Mercado', cartao, 5],
    ['Uber', 28.4, 'Transporte', cartao, 7],
    ['Posto Shell', 210, 'Transporte', cartao, 9],
    ['Cinema', 64, 'Lazer', cartao, 12],
    ['Farmácia Drogasil', 89.9, 'Saúde', conta, 14],
    ['Restaurante', 132.5, 'Alimentação', cartao, 18],
    ['Feira', 75, 'Mercado', dinheiro, 20],
    ['Uber', 19.9, 'Transporte', cartao, 22],
  ]
  for (let k = -2; k <= 0; k++) {
    const m = addMes(hoje, k)
    for (const [descricao, valor, c, contaId, dia] of avulsos) {
      lancamentos.push({
        id: uid(), tipo: 'despesa', descricao, valor: Math.round(valor * (1 + k * 0.07) * 100) / 100,
        data: dataNoMes(m, dia), categoriaId: cat(c), contaId,
      })
    }
  }

  const parcelados: Parcelado[] = [
    { id: uid(), descricao: 'Notebook', valorParcela: 450, parcelas: 10, primeiroMes: addMes(hoje, -3), categoriaId: cat('Compras'), contaId: cartao, pagos: {} },
    { id: uid(), descricao: 'Geladeira', valorParcela: 320, parcelas: 6, primeiroMes: addMes(hoje, -4), categoriaId: cat('Moradia'), contaId: cartao, pagos: {} },
    { id: uid(), descricao: 'Tênis', valorParcela: 89.9, parcelas: 3, primeiroMes: addMes(hoje, -1), categoriaId: cat('Compras'), contaId: cartao, pagos: {} },
    { id: uid(), descricao: 'Curso de inglês', valorParcela: 199, parcelas: 12, primeiroMes: addMes(hoje, -2), categoriaId: cat('Educação'), contaId: cartao, pagos: {} },
  ]

  const ini = addMes(hoje, -6)
  const recorrentes: Recorrente[] = [
    { id: uid(), tipo: 'receita', descricao: 'Salário', valor: 6500, frequencia: 'mensal', dia: 5, inicio: ini, categoriaId: cat('Salário'), contaId: conta, pagos: {} },
    { id: uid(), tipo: 'fixa', descricao: 'Aluguel', valor: 1800, frequencia: 'mensal', dia: 10, inicio: ini, categoriaId: cat('Moradia'), contaId: conta, pagos: {} },
    { id: uid(), tipo: 'fixa', descricao: 'Energia', valor: 180, frequencia: 'mensal', dia: 15, inicio: ini, categoriaId: cat('Moradia'), contaId: conta, pagos: {} },
    { id: uid(), tipo: 'fixa', descricao: 'Internet', valor: 110, frequencia: 'mensal', dia: 20, inicio: ini, categoriaId: cat('Moradia'), contaId: conta, pagos: {} },
    { id: uid(), tipo: 'assinatura', descricao: 'Netflix', valor: 44.9, frequencia: 'mensal', dia: 8, inicio: ini, categoriaId: cat('Assinaturas'), contaId: cartao, pagos: {} },
    { id: uid(), tipo: 'assinatura', descricao: 'Spotify', valor: 23.9, frequencia: 'mensal', dia: 12, inicio: ini, categoriaId: cat('Assinaturas'), contaId: cartao, pagos: {} },
    { id: uid(), tipo: 'assinatura', descricao: 'Academia', valor: 119.9, frequencia: 'mensal', dia: 1, inicio: ini, categoriaId: cat('Saúde'), contaId: cartao, pagos: {} },
    { id: uid(), tipo: 'assinatura', descricao: 'Amazon Prime (anual)', valor: 166.8, frequencia: 'anual', dia: 3, inicio: addMes(hoje, -10), categoriaId: cat('Assinaturas'), contaId: cartao, pagos: {} },
  ]

  await substituirTudo({ categorias, contas, lancamentos, parcelados, recorrentes, regras: [] })
}
