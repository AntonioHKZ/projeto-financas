import { useRef, useState } from 'react'
import { Moon, Sun, Plus, Trash2, Download, Upload, Sparkles, AlertTriangle } from 'lucide-react'
import { Cabecalho } from '../components/Cabecalho'
import { aplicarDestaque, aplicarTema, CORES_DESTAQUE, destaqueAtual, temaAtual } from '../app/tema'
import { apagarTudo, criarSugestoes, db, exportarTudo, substituirTudo } from '../lib/db'
import { carregarExemplo } from '../lib/exemplo'
import { hojeISO, parseValorBR, uid } from '../lib/format'
import type { Categoria, Conta, Dados } from '../lib/types'
import { SelectCategoria } from '../components/ui'

export default function Personalizar({ dados }: { dados: Dados }) {
  const [tema, setTema] = useState(temaAtual())
  const [destaque, setDestaque] = useState(destaqueAtual())
  const arquivo = useRef<HTMLInputElement>(null)

  const trocarTema = (t: 'claro' | 'escuro') => { setTema(t); aplicarTema(t) }
  const trocarDestaque = (c: string) => { setDestaque(c); aplicarDestaque(c) }

  const exportar = async () => {
    const blob = new Blob([JSON.stringify({ app: 'financas', versao: 1, ...(await exportarTudo()) }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `financas-backup-${hojeISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importar = async (f?: File) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text())
      if (!Array.isArray(d.categorias) || !Array.isArray(d.lancamentos)) throw new Error()
      if (!confirm('Importar este backup vai SUBSTITUIR todos os dados atuais. Continuar?')) return
      await substituirTudo(d)
      alert('Backup restaurado!')
    } catch {
      alert('Arquivo de backup inválido.')
    }
    if (arquivo.current) arquivo.current.value = ''
  }

  return (
    <div>
      <Cabecalho titulo="Personalizar" comMes={false} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Aparência</h2>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button className={tema === 'claro' ? 'btn-primary' : 'btn-outline'} onClick={() => trocarTema('claro')}><Sun size={16} /> Claro</button>
            <button className={tema === 'escuro' ? 'btn-primary' : 'btn-outline'} onClick={() => trocarTema('escuro')}><Moon size={16} /> Escuro</button>
          </div>
          <span className="label">Cor de destaque</span>
          <div className="flex flex-wrap items-center gap-2">
            {CORES_DESTAQUE.map((c) => (
              <button key={c} onClick={() => trocarDestaque(c)} aria-label={c}
                className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${destaque === c ? 'ring-2 ring-slate-400' : ''}`} style={{ background: c }} />
            ))}
            <input type="color" value={destaque} onChange={(e) => trocarDestaque(e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" title="Outra cor" />
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Dados e backup</h2>
          <p className="mb-3 text-sm text-slate-500">Tudo fica salvo só neste navegador. Exporte um backup de vez em quando.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-outline" onClick={exportar}><Download size={16} /> Exportar backup (JSON)</button>
            <button className="btn-outline" onClick={() => arquivo.current?.click()}><Upload size={16} /> Importar backup</button>
            <input ref={arquivo} type="file" accept=".json,application/json" hidden onChange={(e) => importar(e.target.files?.[0])} />
            <button className="btn-outline" onClick={async () => confirm('Carregar dados de exemplo vai SUBSTITUIR os dados atuais. Continuar?') && (await carregarExemplo())}><Sparkles size={16} /> Carregar exemplo</button>
            <button className="btn-danger" onClick={async () => {
              if (confirm('Apagar TODOS os dados (lançamentos, categorias, contas e regras)? Isso não pode ser desfeito, a não ser que você tenha um backup.')) await apagarTudo()
            }}><AlertTriangle size={16} /> Apagar tudo</button>
          </div>
        </section>

        <Categorias dados={dados} />
        <Contas dados={dados} />
        <Regras dados={dados} />
      </div>
    </div>
  )
}

function Categorias({ dados }: { dados: Dados }) {
  const salvar = (c: Categoria, mud: Partial<Categoria>) => db.categorias.update(c.id, mud)
  const excluir = async (c: Categoria) => {
    const uso = dados.lancamentos.filter((l) => l.categoriaId === c.id).length + dados.parcelados.filter((p) => p.categoriaId === c.id).length + dados.recorrentes.filter((r) => r.categoriaId === c.id).length
    if (confirm(uso ? `"${c.nome}" está em ${uso} item(ns), que ficarão sem categoria. Excluir?` : `Excluir "${c.nome}"?`)) {
      await db.categorias.delete(c.id)
      await db.regras.where('id').anyOf(dados.regras.filter((r) => r.categoriaId === c.id).map((r) => r.id)).delete()
    }
  }
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Categorias</h2>
        <button className="btn-outline !py-1" onClick={() => db.categorias.add({ id: uid(), nome: 'Nova categoria', emoji: '🏷️', cor: '#64748b' })}><Plus size={14} /> Nova</button>
      </div>
      {dados.categorias.length === 0 && (
        <p className="mb-3 text-sm text-slate-500">Nenhuma categoria ainda. Crie as suas em “Nova” ou <button className="text-accent underline" onClick={() => criarSugestoes()}>use as sugeridas</button> (Alimentação, Mercado, Transporte…).</p>
      )}
      <div className="mb-1 grid grid-cols-[3rem_1fr_2.5rem_6.5rem_2rem] gap-2 text-xs text-slate-500"><span>Emoji</span><span>Nome</span><span>Cor</span><span>Limite/mês</span><span /></div>
      <ul className="space-y-2">
        {dados.categorias.map((c) => (
          <li key={c.id} className="grid grid-cols-[3rem_1fr_2.5rem_6.5rem_2rem] items-center gap-2">
            <input className="input !px-1 text-center" defaultValue={c.emoji} onBlur={(e) => salvar(c, { emoji: e.target.value || '🏷️' })} />
            <input className="input" defaultValue={c.nome} onBlur={(e) => e.target.value.trim() && salvar(c, { nome: e.target.value.trim() })} />
            <input type="color" className="h-9 w-full cursor-pointer rounded bg-transparent" defaultValue={c.cor} onBlur={(e) => salvar(c, { cor: e.target.value })} />
            <input className="input" inputMode="decimal" placeholder="—" defaultValue={c.limite ? String(c.limite).replace('.', ',') : ''}
              onBlur={(e) => { const v = parseValorBR(e.target.value); salvar(c, { limite: v > 0 ? v : undefined }) }} />
            <button className="btn-ghost !p-1.5 hover:!text-rose-500" onClick={() => excluir(c)}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Contas({ dados }: { dados: Dados }) {
  const salvar = (c: Conta, mud: Partial<Conta>) => db.contas.update(c.id, mud)
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Contas e cartões</h2>
        <button className="btn-outline !py-1" onClick={() => db.contas.add({ id: uid(), nome: 'Novo cartão', tipo: 'cartao', cor: '#0ea5e9', diaVencimento: 10 })}><Plus size={14} /> Nova</button>
      </div>
      <div className="mb-1 grid grid-cols-[1fr_6.5rem_2.5rem_4rem_2rem] gap-2 text-xs text-slate-500"><span>Nome</span><span>Tipo</span><span>Cor</span><span>Venc.</span><span /></div>
      <ul className="space-y-2">
        {dados.contas.map((c) => (
          <li key={c.id} className="grid grid-cols-[1fr_6.5rem_2.5rem_4rem_2rem] items-center gap-2">
            <input className="input" defaultValue={c.nome} onBlur={(e) => e.target.value.trim() && salvar(c, { nome: e.target.value.trim() })} />
            <select className="input" value={c.tipo} onChange={(e) => salvar(c, { tipo: e.target.value as Conta['tipo'] })}>
              <option value="cartao">Cartão</option><option value="conta">Conta</option><option value="dinheiro">Dinheiro</option>
            </select>
            <input type="color" className="h-9 w-full cursor-pointer rounded bg-transparent" defaultValue={c.cor} onBlur={(e) => salvar(c, { cor: e.target.value })} />
            <input type="number" min={1} max={31} className="input" placeholder="—" defaultValue={c.diaVencimento ?? ''}
              onBlur={(e) => salvar(c, { diaVencimento: Number(e.target.value) || undefined })} />
            <button className="btn-ghost !p-1.5 hover:!text-rose-500" onClick={() => confirm(`Excluir "${c.nome}"? Os itens dela ficam "sem conta".`) && db.contas.delete(c.id)}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Regras({ dados }: { dados: Dados }) {
  const [contem, setContem] = useState('')
  const [cat, setCat] = useState('')
  return (
    <section className="card lg:col-span-2">
      <h2 className="mb-1 font-semibold">Regras de categorização (importação)</h2>
      <p className="mb-3 text-sm text-slate-500">Quando a descrição importada contém o texto, aplica a categoria. Regras novas são criadas automaticamente quando você corrige uma categoria na tela de importação.</p>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={async (e) => {
        e.preventDefault()
        if (!contem.trim() || !cat) return
        await db.regras.add({ id: uid(), contem: contem.trim().toLowerCase(), categoriaId: cat })
        setContem('')
      }}>
        <input className="input max-w-xs" placeholder='Texto contém… (ex.: "uber")' value={contem} onChange={(e) => setContem(e.target.value)} />
        <div className="w-56"><SelectCategoria categorias={dados.categorias} value={cat} onChange={setCat} vazio="Escolha a categoria" /></div>
        <button className="btn-primary"><Plus size={14} /> Adicionar regra</button>
      </form>
      {dados.regras.length === 0 ? <p className="text-sm text-slate-500">Nenhuma regra ainda.</p> : (
        <ul className="flex flex-wrap gap-2">
          {dados.regras.map((r) => {
            const c = dados.categorias.find((x) => x.id === r.categoriaId)
            return (
              <li key={r.id} className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-3 pr-1 text-sm dark:border-slate-700">
                “{r.contem}” → {c ? `${c.emoji} ${c.nome}` : '?'}
                <button className="btn-ghost !p-1 hover:!text-rose-500" onClick={() => db.regras.delete(r.id)}><Trash2 size={13} /></button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
