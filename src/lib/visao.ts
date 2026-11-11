/**
 * "Visão por banco": cada banco das suas contas vira um filtro que vale para as telas
 * Painel, Extrato, Parcelados e Assinaturas. Os dados continuam juntos (dá para ver o
 * total de todos os bancos); a visão só mostra a parte de um banco.
 */
import { normalizar } from './format'
import { bancoPeloNome } from './importadores/util'
import type { Conta, Dados } from './types'

export const TODOS = ''
export const OUTRAS = '__outras' // contas sem banco (ex.: Dinheiro)

export function bancoDaConta(c: Conta): string | undefined {
  return c.banco?.trim() || bancoPeloNome(c.nome)
}

export function mesmoBanco(a?: string, b?: string) {
  return !!a && !!b && normalizar(a) === normalizar(b)
}

export interface OpcaoVisao { id: string; nome: string; cor?: string }

export function opcoesDeVisao(contas: Conta[]): OpcaoVisao[] {
  const bancos = new Map<string, OpcaoVisao>()
  let temOutras = false
  for (const c of contas) {
    const b = bancoDaConta(c)
    if (!b) { temOutras = true; continue }
    const chave = normalizar(b)
    if (!bancos.has(chave)) bancos.set(chave, { id: b, nome: b, cor: c.cor })
  }
  const lista = [...bancos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  if (temOutras && lista.length) lista.push({ id: OUTRAS, nome: 'Outras contas', cor: '#94a3b8' })
  return lista
}

/** Mantém só as contas da visão e os itens ligados a elas. Categorias e regras não mudam. */
export function filtrarPorVisao<T extends Dados>(d: T, visao: string): T {
  if (visao === TODOS) return d
  const contas = d.contas.filter((c) => {
    const b = bancoDaConta(c)
    return visao === OUTRAS ? !b : mesmoBanco(b, visao)
  })
  const ids = new Set(contas.map((c) => c.id))
  const daVisao = (x: { contaId?: string }) => !!x.contaId && ids.has(x.contaId)
  return {
    ...d,
    contas,
    lancamentos: d.lancamentos.filter(daVisao),
    parcelados: d.parcelados.filter(daVisao),
    recorrentes: d.recorrentes.filter(daVisao),
  }
}
