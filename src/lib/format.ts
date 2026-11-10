import type { Mes } from './types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const moeda = (v: number) => brl.format(v)

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

const pad = (n: number) => String(n).padStart(2, '0')

export function mesDe(d: Date = new Date()): Mes {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addMes(m: Mes, n: number): Mes {
  const [y, mo] = m.split('-').map(Number)
  const total = y * 12 + (mo - 1) + n
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** quantos meses de a até b (b - a) */
export function diffMes(a: Mes, b: Mes): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

export function diasNoMes(m: Mes): number {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo, 0).getDate()
}

export function dataNoMes(m: Mes, dia: number): string {
  return `${m}-${pad(Math.min(Math.max(1, dia), diasNoMes(m)))}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function nomeMes(m: Mes, curto = false): string {
  const [y, mo] = m.split('-').map(Number)
  const nome = MESES[mo - 1]
  if (curto) return `${nome.slice(0, 3)}/${String(y).slice(2)}`
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${y}`
}

export function dataBR(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** normaliza texto: minúsculas, sem acento, sem espaços extras */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseValorBR(s: string): number {
  const limpo = s.replace(/[^\d,.-]/g, '')
  if (limpo.includes(',')) return Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number(limpo)
}

export const arred = (v: number) => Math.round(v * 100) / 100
