import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, ReceiptText, CreditCard, Repeat, Upload, Settings, Plus } from 'lucide-react'
import { AppCtx, type Edicao, type FiltrosExtrato, type Pagina } from './contexto'
import { mesDe } from '../lib/format'
import { useDados } from '../lib/useDados'
import { filtrarPorVisao, opcoesDeVisao, TODOS } from '../lib/visao'
import { ModalEdicao } from '../components/Formularios'
import { Dialogos } from '../components/Dialogos'
import Painel from '../pages/Painel'
import Extrato from '../pages/Extrato'
import Parcelados from '../pages/Parcelados'
import Assinaturas from '../pages/Assinaturas'
import Importar from '../pages/Importar'
import Personalizar from '../pages/Personalizar'

const PAGINAS: { id: Pagina; nome: string; Icone: typeof LayoutDashboard }[] = [
  { id: 'painel', nome: 'Painel', Icone: LayoutDashboard },
  { id: 'extrato', nome: 'Extrato', Icone: ReceiptText },
  { id: 'parcelados', nome: 'Parcelados', Icone: CreditCard },
  { id: 'assinaturas', nome: 'Assinaturas', Icone: Repeat },
  { id: 'importar', nome: 'Importar', Icone: Upload },
  { id: 'personalizar', nome: 'Personalizar', Icone: Settings },
]

function paginaDoHash(): Pagina {
  const h = location.hash.slice(1) as Pagina
  return PAGINAS.some((p) => p.id === h) ? h : 'painel'
}

export default function App() {
  const [pagina, setPagina] = useState<Pagina>(paginaDoHash)
  const [mes, setMes] = useState(mesDe())
  const [filtros, setFiltros] = useState<FiltrosExtrato>({})
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [chaveEdicao, setChaveEdicao] = useState(0)
  const dados = useDados()
  const [visaoSalva, setVisaoSalva] = useState(() => { try { return localStorage.getItem('visao') ?? TODOS } catch { return TODOS } })
  const opcoesVisao = useMemo(() => opcoesDeVisao(dados.contas), [dados.contas])
  // se o banco escolhido deixou de existir (contas apagadas), volta para "todos"
  const visao = visaoSalva === TODOS || opcoesVisao.some((o) => o.id === visaoSalva) ? visaoSalva : TODOS
  const setVisao = useCallback((v: string) => {
    setVisaoSalva(v)
    try { localStorage.setItem('visao', v) } catch { /* sem armazenamento */ }
  }, [])
  const dadosVisao = useMemo(() => filtrarPorVisao(dados, visao), [dados, visao])

  useEffect(() => {
    const f = () => setPagina(paginaDoHash())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const ir = useCallback((p: Pagina, f?: FiltrosExtrato) => {
    setFiltros(f ?? {})
    location.hash = p
    setPagina(p)
    window.scrollTo({ top: 0 })
  }, [])

  const editar = useCallback((e: Edicao) => {
    setChaveEdicao((k) => k + 1)
    setEdicao(e)
  }, [])

  const ctx = useMemo(() => ({ mes, setMes, ir, filtrosIniciais: filtros, editar, visao, setVisao, opcoesVisao }), [mes, ir, filtros, editar, visao, setVisao, opcoesVisao])

  return (
    <AppCtx.Provider value={ctx}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
          <div className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">💰 <span>Finanças</span></div>
          <nav className="flex flex-col gap-1">
            {PAGINAS.map(({ id, nome, Icone }) => (
              <button key={id} onClick={() => ir(id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${pagina === id ? 'bg-[var(--accent)]/10 text-accent' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <Icone size={18} /> {nome}
              </button>
            ))}
          </nav>
          <button className="btn-primary mt-6" onClick={() => editar({ tipo: 'lancamento' })}><Plus size={16} /> Novo</button>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">
          {!dados.carregado ? <p className="text-slate-500">Carregando…</p> : (
            <>
              {pagina === 'painel' && <Painel dados={dadosVisao} />}
              {pagina === 'extrato' && <Extrato dados={dadosVisao} />}
              {pagina === 'parcelados' && <Parcelados dados={dadosVisao} />}
              {pagina === 'assinaturas' && <Assinaturas dados={dadosVisao} />}
              {pagina === 'importar' && <Importar dados={dados} />}
              {pagina === 'personalizar' && <Personalizar dados={dados} />}
            </>
          )}
        </main>

        {/* navegação mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
          {PAGINAS.map(({ id, nome, Icone }) => (
            <button key={id} onClick={() => ir(id)} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${pagina === id ? 'text-accent' : 'text-slate-500'}`}>
              <Icone size={20} /> {nome}
            </button>
          ))}
        </nav>
        <button onClick={() => editar({ tipo: 'lancamento' })} aria-label="Novo cadastro"
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg md:hidden">
          <Plus size={26} />
        </button>
      </div>
      <ModalEdicao key={chaveEdicao} edicao={edicao} fechar={() => setEdicao(null)} dados={dados} />
      <Dialogos />
    </AppCtx.Provider>
  )
}
