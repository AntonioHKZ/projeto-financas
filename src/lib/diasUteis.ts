/**
 * Dias úteis no Brasil: sem domingos e feriados nacionais.
 *
 * Para salário, a CLT (art. 459) manda pagar até o 5º dia útil do mês seguinte e, nessa
 * contagem, o SÁBADO conta como dia útil (entendimento do Ministério do Trabalho). Por isso
 * o sábado é configurável: por padrão conta, como na regra do salário.
 */
import { diasNoMes } from './format'
import type { Mes } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']

const cache = new Map<number, Set<string>>()

/** Feriados nacionais do ano no formato 'MM-DD' (fixos + Sexta-feira Santa). */
export function feriadosNacionais(ano: number): Set<string> {
  let s = cache.get(ano)
  if (!s) {
    const p = pascoa(ano)
    const sextaSanta = new Date(p.getFullYear(), p.getMonth(), p.getDate() - 2)
    s = new Set([...FIXOS, `${pad(sextaSanta.getMonth() + 1)}-${pad(sextaSanta.getDate())}`])
    cache.set(ano, s)
  }
  return s
}

export function ehDiaUtil(ano: number, mes: number, dia: number, sabadoConta = true): boolean {
  const semana = new Date(ano, mes - 1, dia).getDay() // 0 = domingo, 6 = sábado
  if (semana === 0 || (semana === 6 && !sabadoConta)) return false
  return !feriadosNacionais(ano).has(`${pad(mes)}-${pad(dia)}`)
}

/** Data (YYYY-MM-DD) do n-ésimo dia útil do mês. Se o mês tiver menos dias úteis, devolve o último. */
export function enesimoDiaUtil(m: Mes, n: number, sabadoConta = true): string {
  const [ano, mes] = m.split('-').map(Number)
  let contados = 0, ultimo = 1
  for (let dia = 1; dia <= diasNoMes(m); dia++) {
    if (!ehDiaUtil(ano, mes, dia, sabadoConta)) continue
    contados++
    ultimo = dia
    if (contados === Math.max(1, n)) break
  }
  return `${m}-${pad(ultimo)}`
}

/** "5º dia útil" */
export const rotuloDiaUtil = (n: number) => `${n}º dia útil`
