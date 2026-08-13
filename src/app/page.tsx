'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useAlbionData } from '@/lib/albion-client'
import type { TopSellingItem, BlackMarketItem, TrendingItem, FlipOpportunity, RefineOpportunity, TransportOpportunity, GoldData, DataQuality } from '@/lib/albion-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  TrendingUp, RefreshCw, Coins, Skull, BarChart3, Clock, ArrowUpRight,
  ArrowRightLeft, Activity, Search, ShoppingBag, Radio, Flame, Truck, Factory,
  AlertTriangle, ShieldCheck, Zap, Star, ArrowUpDown, ArrowUp, ArrowDown,
  Eye, EyeOff, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================================
// Utility functions
// ============================================================

function formatSilver(price: number | null): string {
  if (price === null || price === undefined) return '-'
  if (price >= 1000000) return `${(price / 1000000).toFixed(2)}M`
  if (price >= 1000) return `${(price / 1000).toFixed(1)}K`
  return price.toString()
}

function formatDataAge(dateStr: string | null): { text: string; stale: boolean; minutes: number } {
  if (!dateStr) return { text: '-', stale: true, minutes: 9999 }
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (minutes < 5) return { text: '< 5min', stale: false, minutes }
  if (minutes < 60) return { text: `${minutes}min`, stale: false, minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { text: `${hours}h`, stale: true, minutes }
  const days = Math.floor(hours / 24)
  return { text: `${days}j`, stale: true, minutes }
}

function formatGoldPrice(price: number): string {
  return price.toLocaleString('fr-FR')
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return "\u00e0 l'instant"
  if (seconds < 60) return `il y a ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  return `il y a ${hours}h`
}

function getTierColor(name: string): string {
  if (name.includes('T8')) return 'text-amber-400'
  if (name.includes('T7')) return 'text-purple-400'
  if (name.includes('T6')) return 'text-orange-400'
  if (name.includes('T5')) return 'text-sky-400'
  return 'text-foreground'
}

function getTierBadgeVariant(name: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (name.includes('T8')) return 'default'
  if (name.includes('T7')) return 'secondary'
  return 'outline'
}

function getTierLabel(name: string): string {
  const match = name.match(/T(\d)/)
  return match ? `Tier ${match[1]}` : ''
}

function getItemCategory(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('minerai') || lower.includes('bois') || lower.includes('fibre') || lower.includes('peau') || lower.includes('pierre')) return 'Ressource'
  if (lower.includes('lingot') || lower.includes('planche') || lower.includes('tissu') || lower.includes('cuir') || lower.includes('bloc de pierre')) return 'Mat\u00e9riau'
  if (lower.includes('armure') || lower.includes('coiffe') || lower.includes('chaussures')) return 'Armure'
  if (lower.includes('sac')) return '\u00c9quipement'
  if (lower.includes('cape')) return '\u00c9quipement'
  if (lower.includes('rune') || lower.includes('\u00e2me') || lower.includes('relique')) return 'Rune'
  if (lower.includes('potion')) return 'Potion'
  return 'Autre'
}

function getRenderId(dataProjectId: string): string {
  const m = dataProjectId.match(/^(T\d+_|)(.+)$/)
  if (!m) return dataProjectId
  const tier = m[1] || ''
  const base = m[2]
  const MAP: Record<string, string> = { CLOTH: 'CLOTHITEM', LEATHER: 'LEATHERITEM' }
  return tier + (MAP[base] || base)
}

// ============================================================
// Favorites hook (localStorage-backed)
// ============================================================

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('albion-favorites')
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch { return new Set() }
  })

  useEffect(() => {
    try { localStorage.setItem('albion-favorites', JSON.stringify([...favorites])) } catch {}
  }, [favorites])

  const toggle = useCallback((itemId: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) { next.delete(itemId) } else { next.add(itemId) }
      return next
    })
  }, [])

  return { favorites, toggle }
}

// ============================================================
// Generic sort hook
// ============================================================

function useSort<T>(items: T[], defaultKey?: string, defaultDir: 'asc' | 'desc' = 'desc') {
  const [sortKey, setSortKey] = useState(defaultKey || '')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir)

  const toggleSort = useCallback((key: string) => {
    setSortKey(prev => prev === key && sortDir === 'desc' ? '' : key)
    setSortDir(prev => (sortKey === key && prev === 'asc') ? 'desc' : 'asc')
  }, [sortKey, sortDir])

  const sorted = useMemo(() => {
    if (!sortKey) return items
    return [...items].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey]
      const bVal = (b as Record<string, unknown>)[sortKey]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal ?? '')
      const bStr = String(bVal ?? '')
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }, [items, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggleSort }
}

// ============================================================
// Reusable Components
// ============================================================

function ItemIcon({ itemId, size = 32 }: { itemId: string; size?: number }) {
  const [error, setError] = useState(false)
  const renderId = getRenderId(itemId)
  const src = `https://render.albiononline.com/v1/item/${renderId}?quality=1`
  const tier = itemId.match(/T(\d)/)
  const tierNum = tier ? parseInt(tier[1]) : 4
  const colors = ['','oklch(0.7 0.15 250)','oklch(0.65 0.2 200)','oklch(0.7 0.18 40)','oklch(0.7 0.18 40)','oklch(0.75 0.2 80)','oklch(0.7 0.2 300)','oklch(0.65 0.22 300)','oklch(0.8 0.18 80)']
  const color = colors[tierNum] || colors[4]
  if (error) {
    return (
      <div
        className="inline-flex items-center justify-center rounded-md border border-border/30 flex-shrink-0"
        style={{ width: size, height: size, minWidth: size, minHeight: size, backgroundColor: color + '33' }}
        title={renderId}
      >
        <span style={{ fontSize: size * 0.45, color, fontWeight: 700, lineHeight: 1 }}>{tier ? tier[1] : '?'}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setError(true)}
      className="inline-block rounded-md bg-black/30 border border-border/30 flex-shrink-0"
      style={{ imageRendering: 'auto', minWidth: size, minHeight: size }}
    />
  )
}

function FavoriteBtn({ itemId, isFav, onToggle }: { itemId: string; isFav: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(itemId) }}
      className="p-0.5 rounded hover:bg-muted/50 transition-colors"
      title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Star className={`h-3.5 w-3.5 transition-colors ${isFav ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40 hover:text-muted-foreground'}`} />
    </button>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />
  return dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
}

function StaleWarning({ dateStr, threshold = 60 }: { dateStr: string | null; threshold?: number }) {
  const { stale, minutes } = formatDataAge(dateStr)
  if (!stale || minutes <= threshold) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" title={`Donn\u00e9es datant de ${Math.round(minutes / 60)}h - prix potentiellement obsol\u00e8te`}>
      <AlertTriangle className="h-3 w-3" />
    </span>
  )
}

function DataAgeCell({ dateStr }: { dateStr: string | null }) {
  const age = formatDataAge(dateStr)
  return (
    <span
      className={`text-xs font-mono ${age.stale ? 'text-amber-400' : 'text-emerald-400'}`}
      title={dateStr ? `Derni\u00e8re transaction: ${new Date(dateStr).toLocaleString('fr-FR')}` : undefined}
    >
      {age.text}
    </span>
  )
}

function DataQualityBadge({ quality }: { quality: DataQuality | null }) {
  if (!quality) return null
  const { apiAgeMinutes, coveragePercent, fetchDurationMs, stale, itemsWithData, totalItems, batchSize } = quality
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs border ${stale ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
      {stale ? (
        <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
      ) : (
        <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
        <span className={stale ? 'text-amber-300 font-medium' : 'text-emerald-400 font-medium'}>
          Derni\u00e8re activit\u00e9 API : il y a {apiAgeMinutes}min
        </span>
        <span className="text-muted-foreground">
          <Zap className="h-3 w-3 inline mr-1" />{fetchDurationMs}ms
        </span>
        <span className="text-muted-foreground">
          {itemsWithData}/{totalItems} items ({coveragePercent}%)
        </span>
        <span className="text-muted-foreground hidden sm:inline">
          {batchSize} entr\u00e9es
        </span>
      </div>
    </div>
  )
}

function LiveIndicator({ connected, lastUpdate, updateCount, fetching }: { connected: boolean; lastUpdate: number; updateCount: number; fetching: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`live-pulse absolute inline-flex h-full w-full rounded-full opacity-75 ${!connected ? 'bg-red-400' : fetching ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${!connected ? 'bg-red-500' : fetching ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
        </span>
        <span className={`${!connected ? 'text-red-400' : fetching ? 'text-amber-400' : 'text-emerald-400'} font-medium flex items-center gap-1 text-xs sm:text-sm`}>
          <Radio className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          {!connected ? 'HORS LIGNE' : fetching ? 'SYNC...' : 'LIVE'}
        </span>
      </div>
      {connected && updateCount > 0 && (
        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
          {updateCount} maj
        </span>
      )}
      {lastUpdate > 0 && (
        <div className="hidden md:flex items-center gap-1.5 text-muted-foreground flex-shrink-0">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs">{timeAgo(lastUpdate)}</span>
        </div>
      )}
    </div>
  )
}

function GoldTicker({ gold }: { gold: GoldData | null }) {
  return (
    <Card className="border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Coins className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Prix de l'Or</p>
              <p className="text-2xl font-bold text-amber-400 font-mono">
                {gold ? formatGoldPrice(gold.price) : '...'}{' '}
                <span className="text-sm text-muted-foreground font-sans">argent/or</span>
              </p>
            </div>
          </div>
          {gold && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {new Date(gold.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({ icon: Icon, label, value, subtext, color }: { icon: React.ElementType; label: string; value: string | number; subtext?: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold font-mono">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground truncate">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Search bar
// ============================================================

function SearchBar({ value, onChange, count, total }: { value: string; onChange: (v: string) => void; count: number; total: number }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Rechercher un item..."
        className="w-full h-9 pl-9 pr-20 bg-muted/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {value && <span className="font-mono text-primary font-medium">{count}/{total}</span>}
        {value && (
          <button onClick={() => onChange('')} className="hover:text-foreground transition-colors">
            <span className="text-xs">\u2715</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Filter toggle for favorites
// ============================================================

function FavoritesToggle({ showFavOnly, onToggle, favCount }: { showFavOnly: boolean; onToggle: () => void; favCount: number }) {
  return (
    <Button
      variant={showFavOnly ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
      className="h-8 text-xs gap-1.5"
    >
      {showFavOnly ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      <Star className={`h-3 w-3 ${showFavOnly ? 'fill-current' : ''}`} />
      {favCount > 0 && <span>{favCount}</span>}
      {showFavOnly ? 'Favoris' : 'Favoris'}
    </Button>
  )
}

// ============================================================
// Tables with search, sort, favorites, stale warnings
// ============================================================

function TopSellingTable({ items, search, favorites, onToggleFav }: {
  items: TopSellingItem[]; search: string; favorites: Set<string>; onToggleFav: (id: string) => void
}) {
  const query = search.toLowerCase()
  const filtered = useMemo(() => {
    let result = items
    if (query) result = result.filter(i => i.name.toLowerCase().includes(query))
    return result
  }, [items, query])

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'totalVolume')

  return (
    <div className="rounded-lg border">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center"></TableHead>
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Item <SortIcon active={sortKey === 'name'} dir={sortDir} /></TableHead>
            <TableHead className="hidden md:table-cell">Cat\u00e9gorie</TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('bestSellPrice')}>Prix Vente <SortIcon active={sortKey === 'bestSellPrice'} dir={sortDir} /></TableHead>
            <TableHead className="text-right hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort('bestBuyPrice')}>Prix Achat <SortIcon active={sortKey === 'bestBuyPrice'} dir={sortDir} /></TableHead>
            <TableHead className="text-right hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('avgSellPrice')}>Prix Moyen <SortIcon active={sortKey === 'avgSellPrice'} dir={sortDir} /></TableHead>
            <TableHead className="hidden lg:table-cell">Meilleur March\u00e9</TableHead>
            <TableHead className="text-center hidden xl:table-cell">Derni\u00e8re Tx</TableHead>
            <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('totalVolume')}>Activit\u00e9 <SortIcon active={sortKey === 'totalVolume'} dir={sortDir} /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center"><FavoriteBtn itemId={item.itemId} isFav={favorites.has(item.itemId)} onToggle={onToggleFav} /></TableCell>
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-2 min-w-0">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <span className={`font-semibold truncate ${getTierColor(item.name)}`}>{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant={getTierBadgeVariant(item.name)} className="text-xs">{getItemCategory(item.name)}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-emerald-400">{item.bestSellPrice ? formatSilver(item.bestSellPrice) : '-'}</TableCell>
              <TableCell className="text-right font-mono text-amber-400 hidden sm:table-cell">{item.bestBuyPrice ? formatSilver(item.bestBuyPrice) : '-'}</TableCell>
              <TableCell className="text-right font-mono hidden lg:table-cell">{item.avgSellPrice ? formatSilver(item.avgSellPrice) : '-'}</TableCell>
              <TableCell className="hidden lg:table-cell">
                {item.bestSellCity ? <Badge variant="outline" className="text-xs font-normal">{item.bestSellCity}</Badge> : '-'}
              </TableCell>
              <TableCell className="text-center hidden xl:table-cell"><DataAgeCell dateStr={item.lastSellDate || item.lastBuyDate} /></TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-sm">{item.totalVolume}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                {query ? 'Aucun item ne correspond \u00e0 votre recherche' : 'Aucune donn\u00e9e disponible. Patientez pendant le chargement...'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function BlackMarketTable({ items, search, favorites, onToggleFav }: {
  items: BlackMarketItem[]; search: string; favorites: Set<string>; onToggleFav: (id: string) => void
}) {
  const query = search.toLowerCase()
  const filtered = useMemo(() => {
    let result = items
    if (query) result = result.filter(i => i.name.toLowerCase().includes(query))
    return result
  }, [items, query])

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'marginPercent')

  return (
    <div className="rounded-lg border">
      <Table className="min-w-[650px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center"></TableHead>
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Item <SortIcon active={sortKey === 'name'} dir={sortDir} /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('blackMarketPrice')}>Black Market <SortIcon active={sortKey === 'blackMarketPrice'} dir={sortDir} /></TableHead>
            <TableHead className="text-right hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort('sourcePrice')}>Source <SortIcon active={sortKey === 'sourcePrice'} dir={sortDir} /></TableHead>
            <TableHead className="hidden md:table-cell">Ville Source</TableHead>
            <TableHead className="hidden xl:table-cell">Derni\u00e8re Tx</TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('profit')}>Profit <SortIcon active={sortKey === 'profit'} dir={sortDir} /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('marginPercent')}>Marge <SortIcon active={sortKey === 'marginPercent'} dir={sortDir} /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center"><FavoriteBtn itemId={item.itemId} isFav={favorites.has(item.itemId)} onToggle={onToggleFav} /></TableCell>
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-2 min-w-0">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <span className={`font-semibold truncate ${getTierColor(item.name)}`}>{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-amber-400">{formatSilver(item.blackMarketPrice)}</TableCell>
              <TableCell className="text-right font-mono hidden sm:table-cell">{formatSilver(item.sourcePrice)}</TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal">{item.sourceCity}</Badge></TableCell>
              <TableCell className="hidden xl:table-cell">
                <div className="flex items-center gap-1">
                  <DataAgeCell dateStr={item.bmLastSellDate || item.sourceLastSellDate} />
                  <StaleWarning dateStr={item.bmLastSellDate || item.sourceLastSellDate} />
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-emerald-400">+{formatSilver(item.profit)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <StaleWarning dateStr={item.bmLastSellDate || item.sourceLastSellDate} />
                  <ArrowUpRight className={`h-4 w-4 ${item.marginPercent > 30 ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className={`font-mono font-semibold ${item.marginPercent > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>+{item.marginPercent}%</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {query ? 'Aucun item ne correspond \u00e0 votre recherche' : 'Aucune opportunit\u00e9 de profit trouv\u00e9e sur le Black Market'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TrendingChart({ items, search }: { items: TrendingItem[]; search: string }) {
  const query = search.toLowerCase()
  const filtered = useMemo(() => {
    if (!query) return items
    return items.filter(i => i.name.toLowerCase().includes(query))
  }, [items, query])

  const topItems = filtered.slice(0, 10)
  const maxPrice = Math.max(...topItems.map(i => i.maxPrice), 1)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Meilleurs \u00c9carts de Prix Inter-Villes
          </CardTitle>
          <CardDescription>Items avec le plus grand \u00e9cart de prix de vente entre villes (hors Black Market)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {topItems.map((item) => {
              const minPct = (item.minPrice / maxPrice) * 100
              const maxPct = (item.maxPrice / maxPrice) * 100
              return (
                <div key={item.itemId} className="group">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={`font-medium ${getTierColor(item.name)}`}>{item.name}</span>
                    <span className="text-muted-foreground font-mono">{formatSilver(item.spread)} d'\u00e9cart</span>
                  </div>
                  <div className="relative h-5 rounded-sm overflow-hidden bg-muted/50">
                    <div className="absolute top-0 left-0 h-full rounded-sm" style={{ width: `${maxPct}%`, backgroundColor: 'oklch(0.55 0.18 25)' }} title={`Max: ${formatSilver(item.maxPrice)}`} />
                    <div className="absolute top-0 left-0 h-full rounded-sm" style={{ width: `${minPct}%`, backgroundColor: 'oklch(0.6 0.18 155)' }} title={`Min: ${formatSilver(item.minPrice)}`} />
                  </div>
                </div>
              )
            })}
            {topItems.length === 0 && <div className="text-center py-8 text-muted-foreground">Aucune tendance disponible</div>}
            <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(0.6 0.18 155)' }} /> Prix Min</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(0.55 0.18 25)' }} /> Prix Max</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            D\u00e9tail des Tendances
          </CardTitle>
          <CardDescription>Items les plus recherch\u00e9s avec leurs prix par ville</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2">
            {filtered.map((item) => (
              <div key={item.itemId} className="p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ItemIcon itemId={item.itemId} size={36} />
                    <span className={`font-semibold ${getTierColor(item.name)}`}>{item.name}</span>
                    <Badge variant={getTierBadgeVariant(item.name)} className="text-xs">{getTierLabel(item.name)}</Badge>
                    <Badge variant="outline" className="text-xs">{item.cityCount} villes</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <span className="text-muted-foreground">Moy: <span className="font-mono text-foreground">{formatSilver(item.avgPrice)}</span></span>
                    <span className="text-emerald-400">Min: <span className="font-mono">{formatSilver(item.minPrice)}</span></span>
                    <span className="text-red-400">Max: <span className="font-mono">{formatSilver(item.maxPrice)}</span></span>
                    <span className="text-sky-400">\u00c9cart: <span className="font-mono">{formatSilver(item.spread)}</span></span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.cities.map((c) => (
                    <div key={c.city} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 text-xs">
                      <span className="text-muted-foreground">{c.city}:</span>
                      {c.sellPrice && <span className="font-mono text-emerald-400">V {formatSilver(c.sellPrice)}</span>}
                      {c.buyPrice && c.buyPrice > 0 && <span className="font-mono text-amber-400">A {formatSilver(c.buyPrice)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-8 text-muted-foreground">Aucune tendance disponible</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FlipOpportunitiesTable({ items, search, favorites, onToggleFav }: {
  items: FlipOpportunity[]; search: string; favorites: Set<string>; onToggleFav: (id: string) => void
}) {
  const query = search.toLowerCase()
  const filtered = useMemo(() => {
    let result = items
    if (query) result = result.filter(i => i.name.toLowerCase().includes(query))
    return result
  }, [items, query])

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'profit')

  return (
    <div className="rounded-lg border">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center"></TableHead>
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Item <SortIcon active={sortKey === 'name'} dir={sortDir} /></TableHead>
            <TableHead className="hidden md:table-cell">Acheter \u00e0</TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('buyPrice')}>Prix Achat <SortIcon active={sortKey === 'buyPrice'} dir={sortDir} /></TableHead>
            <TableHead className="hidden md:table-cell">Vendre \u00e0</TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('sellPrice')}>Prix Vente <SortIcon active={sortKey === 'sellPrice'} dir={sortDir} /></TableHead>
            <TableHead className="hidden xl:table-cell">Fra\u00eecheur</TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('profit')}>Profit <SortIcon active={sortKey === 'profit'} dir={sortDir} /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('marginPercent')}>Marge <SortIcon active={sortKey === 'marginPercent'} dir={sortDir} /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center"><FavoriteBtn itemId={item.itemId} isFav={favorites.has(item.itemId)} onToggle={onToggleFav} /></TableCell>
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-2 min-w-0">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <span className={`font-semibold truncate ${getTierColor(item.name)}`}>{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-sky-400 border-sky-500/30">{item.buyCity}</Badge></TableCell>
              <TableCell className="text-right font-mono text-amber-400">{formatSilver(item.buyPrice)}</TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-emerald-400 border-emerald-500/30">{item.sellCity}</Badge></TableCell>
              <TableCell className="text-right font-mono text-emerald-400">{formatSilver(item.sellPrice)}</TableCell>
              <TableCell className="hidden xl:table-cell">
                <div className="flex items-center gap-1">
                  <DataAgeCell dateStr={item.buyDate || item.sellDate} />
                  <StaleWarning dateStr={item.buyDate || item.sellDate} />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <StaleWarning dateStr={item.buyDate || item.sellDate} />
                  <span className="font-mono font-semibold text-emerald-400">+{formatSilver(item.profit)}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className={`font-mono font-semibold ${item.marginPercent > 20 ? 'text-emerald-400' : 'text-amber-400'}`}>+{item.marginPercent}%</span>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{query ? 'Aucun r\u00e9sultat' : 'Aucune opportunit\u00e9 d\'achat/revente d\u00e9tect\u00e9e'}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function RefineOpportunitiesTable({ items, search, favorites, onToggleFav }: {
  items: RefineOpportunity[]; search: string; favorites: Set<string>; onToggleFav: (id: string) => void
}) {
  const query = search.toLowerCase()
  const filtered = useMemo(() => {
    let result = items
    if (query) result = result.filter(i => i.name.toLowerCase().includes(query) || i.rawName.toLowerCase().includes(query))
    return result
  }, [items, query])

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'marginPercent')

  return (
    <div className="rounded-lg border">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center"></TableHead>
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Produit Raffin\u00e9 <SortIcon active={sortKey === 'name'} dir={sortDir} /></TableHead>
            <TableHead className="hidden lg:table-cell">Mati\u00e8re Premi\u00e8re</TableHead>
            <TableHead className="hidden md:table-cell">Ratio</TableHead>
            <TableHead className="hidden md:table-cell">Acheter \u00e0</TableHead>
            <TableHead className="text-right hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort('costRaw')}>Co\u00fbt Brut <SortIcon active={sortKey === 'costRaw'} dir={sortDir} /></TableHead>
            <TableHead className="hidden md:table-cell">Vendre \u00e0</TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('profit')}>Profit <SortIcon active={sortKey === 'profit'} dir={sortDir} /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('marginPercent')}>Marge <SortIcon active={sortKey === 'marginPercent'} dir={sortDir} /></TableHead>
            <TableHead className="hidden lg:table-cell text-center">Bonus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center"><FavoriteBtn itemId={item.itemId} isFav={favorites.has(item.itemId)} onToggle={onToggleFav} /></TableCell>
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-2 min-w-0">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <div className="min-w-0">
                    <span className={`font-semibold truncate block ${getTierColor(item.name)}`}>{item.name}</span>
                    <span className="text-xs text-muted-foreground">T{item.tier}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell max-w-[180px]">
                <span className="text-sm text-muted-foreground truncate block">{item.rawName}</span>
                <span className="text-xs text-muted-foreground ml-1">@ {formatSilver(item.rawPrice)}</span>
              </TableCell>
              <TableCell className="hidden md:table-cell font-mono text-sm text-muted-foreground">{item.ratio}:1</TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-sky-400 border-sky-500/30">{item.buyCity}</Badge></TableCell>
              <TableCell className="text-right font-mono text-amber-400 hidden sm:table-cell">{formatSilver(item.costRaw)}</TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-emerald-400 border-emerald-500/30">{item.sellCity}</Badge></TableCell>
              <TableCell className="text-right font-mono font-semibold text-emerald-400">+{formatSilver(item.profit)}</TableCell>
              <TableCell className="text-right">
                <span className={`font-mono font-semibold ${item.marginPercent > 15 ? 'text-emerald-400' : 'text-amber-400'}`}>+{item.marginPercent}%</span>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-center">
                {item.hasBonus ? (
                  <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">{item.bonusCity}</Badge>
                ) : <span className="text-xs text-muted-foreground">-</span>}
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{query ? 'Aucun r\u00e9sultat' : 'Aucune opportunit\u00e9 de raffinage rentable d\u00e9tect\u00e9e'}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TransportOpportunitiesTable({ items, search, favorites, onToggleFav }: {
  items: TransportOpportunity[]; search: string; favorites: Set<string>; onToggleFav: (id: string) => void
}) {
  const query = search.toLowerCase()
  const filtered = useMemo(() => {
    let result = items
    if (query) result = result.filter(i => i.name.toLowerCase().includes(query))
    return result
  }, [items, query])

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'profit')

  return (
    <div className="rounded-lg border">
      <Table className="min-w-[750px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center"></TableHead>
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Ressource <SortIcon active={sortKey === 'name'} dir={sortDir} /></TableHead>
            <TableHead className="hidden md:table-cell">De</TableHead>
            <TableHead className="text-right hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort('buyPrice')}>Achat <SortIcon active={sortKey === 'buyPrice'} dir={sortDir} /></TableHead>
            <TableHead className="hidden md:table-cell">Vers</TableHead>
            <TableHead className="text-right hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort('sellPrice')}>Vente <SortIcon active={sortKey === 'sellPrice'} dir={sortDir} /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('profit')}>Profit <SortIcon active={sortKey === 'profit'} dir={sortDir} /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('marginPercent')}>Marge <SortIcon active={sortKey === 'marginPercent'} dir={sortDir} /></TableHead>
            <TableHead className="hidden lg:table-cell">Route</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item, idx) => (
            <TableRow key={`${item.itemId}-${item.fromCity}-${item.toCity}`} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center"><FavoriteBtn itemId={item.itemId} isFav={favorites.has(item.itemId)} onToggle={onToggleFav} /></TableCell>
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-2 min-w-0">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <span className={`font-semibold truncate ${getTierColor(item.name)}`}>{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-sky-400 border-sky-500/30">{item.fromCity}</Badge></TableCell>
              <TableCell className="text-right font-mono text-amber-400 hidden sm:table-cell">{formatSilver(item.buyPrice)}</TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-emerald-400 border-emerald-500/30">{item.toCity}</Badge></TableCell>
              <TableCell className="text-right font-mono text-emerald-400 hidden sm:table-cell">{formatSilver(item.sellPrice)}</TableCell>
              <TableCell className="text-right font-mono font-semibold text-emerald-400">+{formatSilver(item.profit)}</TableCell>
              <TableCell className="text-right">
                <span className={`font-mono font-semibold ${item.marginPercent > 15 ? 'text-emerald-400' : 'text-amber-400'}`}>+{item.marginPercent}%</span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="text-sky-400">{item.fromCity}</span>
                  <ArrowRightLeft className="h-3 w-3 text-primary" />
                  <span className="text-emerald-400">{item.toCity}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{query ? 'Aucun r\u00e9sultat' : 'Aucune route de transport rentable d\u00e9tect\u00e9e'}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-20 rounded-lg" /><Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" /><Skeleton className="h-20 rounded-lg" />
      </div>
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
      <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function AlbionMarketTracker() {
  const { topSelling, blackMarket, trending, opportunities, gold, totalItemsTracked, dataQuality,
          lastUpdate, loading, fetching, connected, updateCount, refresh } = useAlbionData(10000)

  const { favorites, toggle: toggleFav } = useFavorites()
  const [search, setSearch] = useState('')
  const [showFavOnly, setShowFavOnly] = useState(false)

  // Time ago ticker
  const [, setTick] = useState(0)
  useEffect(() => { const interval = setInterval(() => setTick(t => t + 1), 5000); return () => clearInterval(interval) }, [])

  // Filter by favorites
  const isFavFilter = showFavOnly && favorites.size > 0
  const filteredTopSelling = useMemo(() => isFavFilter ? topSelling.filter(i => favorites.has(i.itemId)) : topSelling, [topSelling, isFavFilter, favorites])
  const filteredBlackMarket = useMemo(() => isFavFilter ? blackMarket.filter(i => favorites.has(i.itemId)) : blackMarket, [blackMarket, isFavFilter, favorites])
  const filteredTrending = useMemo(() => isFavFilter ? trending.filter(i => favorites.has(i.itemId)) : trending, [trending, isFavFilter, favorites])
  const filteredFlip = useMemo(() => isFavFilter ? opportunities.flip.filter(i => favorites.has(i.itemId)) : opportunities.flip, [opportunities.flip, isFavFilter, favorites])
  const filteredRefine = useMemo(() => isFavFilter ? opportunities.refine.filter(i => favorites.has(i.itemId)) : opportunities.refine, [opportunities.refine, isFavFilter, favorites])
  const filteredTransport = useMemo(() => isFavFilter ? opportunities.transport.filter(i => favorites.has(i.itemId)) : opportunities.transport, [opportunities.transport, isFavFilter, favorites])

  const avgBlackMarketMargin = blackMarket.length > 0
    ? Math.round(blackMarket.reduce((sum, i) => sum + i.marginPercent, 0) / blackMarket.length)
    : 0

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  Albion Market <span className="text-primary">Tracker</span>
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Donn\u00e9es en temps r\u00e9el du march\u00e9 &amp; black market
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LiveIndicator connected={connected} lastUpdate={lastUpdate} updateCount={updateCount} fetching={fetching} />
              <Button variant="outline" size="icon" onClick={refresh} disabled={fetching} title="Rafra\u00eechir" className="h-8 w-8">
                <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <GoldTicker gold={gold} />

        {!loading && <DataQualityBadge quality={dataQuality} />}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={BarChart3} label="Items Suivis" value={totalItemsTracked} subtext="sur tous les march\u00e9s" color="bg-primary/20 text-primary" />
          <StatCard icon={TrendingUp} label="Top Ventes" value={topSelling.length} subtext="items les plus actifs" color="bg-emerald-500/20 text-emerald-400" />
          <StatCard icon={Skull} label="Black Market" value={blackMarket.length} subtext="opportunit\u00e9s d\u00e9tect\u00e9es" color="bg-red-500/20 text-red-400" />
          <StatCard icon={Coins} label="Marge Moyenne" value={`${avgBlackMarketMargin}%`} subtext="marge b\u00e9n\u00e9ficiaire BM" color="bg-amber-500/20 text-amber-400" />
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex-1">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  count={topSelling.length}
                  total={totalItemsTracked}
                />
              </div>
              <FavoritesToggle
                showFavOnly={showFavOnly}
                onToggle={() => setShowFavOnly(v => !v)}
                favCount={favorites.size}
              />
            </div>

            <Tabs defaultValue="market" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="market" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">March\u00e9</span></TabsTrigger>
                <TabsTrigger value="blackmarket" className="flex items-center gap-2"><Skull className="h-4 w-4" /><span className="hidden sm:inline">Black Market</span></TabsTrigger>
                <TabsTrigger value="trending" className="flex items-center gap-2"><Activity className="h-4 w-4" /><span className="hidden sm:inline">Tendances</span></TabsTrigger>
                <TabsTrigger value="opportunities" className="flex items-center gap-2"><Flame className="h-4 w-4" /><span className="hidden sm:inline">Opportunit\u00e9s</span></TabsTrigger>
              </TabsList>

              <TabsContent value="market" className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Items les Plus Recherch\u00e9s &amp; Vendus</h2>
                  <p className="text-sm text-muted-foreground">Class\u00e9s par volume d'activit\u00e9 sur tous les march\u00e9s royaux</p>
                </div>
                <div className="overflow-auto max-h-[55vh] rounded-lg">
                  <TopSellingTable items={filteredTopSelling} search={search} favorites={favorites} onToggleFav={toggleFav} />
                </div>
              </TabsContent>

              <TabsContent value="blackmarket" className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Skull className="h-5 w-5 text-red-400" />Opportunit\u00e9s Black Market</h2>
                  <p className="text-sm text-muted-foreground">Acheter sur les march\u00e9s royaux et revendre au Black Market de Caerleon</p>
                </div>
                <div className="overflow-auto max-h-[55vh] rounded-lg">
                  <BlackMarketTable items={filteredBlackMarket} search={search} favorites={favorites} onToggleFav={toggleFav} />
                </div>
              </TabsContent>

              <TabsContent value="trending" className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Tendances du March\u00e9</h2>
                  <p className="text-sm text-muted-foreground">Items les plus recherch\u00e9s avec \u00e9carts de prix inter-villes</p>
                </div>
                <TrendingChart items={filteredTrending} search={search} />
              </TabsContent>

              <TabsContent value="opportunities">
                <div className="overflow-auto max-h-[75vh] space-y-6 pr-1">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Achat / Revente Inter-Villes</h2>
                    <p className="text-sm text-muted-foreground">Acheter au prix le plus bas dans une ville et revendre au prix d'achat le plus \u00e9lev\u00e9 dans une autre</p>
                  </div>
                  <FlipOpportunitiesTable items={filteredFlip} search={search} favorites={favorites} onToggleFav={toggleFav} />

                  <div className="border-t border-border pt-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2"><Factory className="h-5 w-5 text-amber-400" />Meilleures Opportunit\u00e9s de Raffinage</h2>
                    <p className="text-sm text-muted-foreground">Acheter des mati\u00e8res premi\u00e8res, les raffiner, et vendre le produit fini</p>
                  </div>
                  <RefineOpportunitiesTable items={filteredRefine} search={search} favorites={favorites} onToggleFav={toggleFav} />

                  <div className="border-t border-border pt-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2"><Truck className="h-5 w-5 text-sky-400" />Meilleures Routes de Transport</h2>
                    <p className="text-sm text-muted-foreground">Ressources et mat\u00e9riaux avec le plus gros \u00e9cart de prix entre deux villes</p>
                  </div>
                  <TransportOpportunitiesTable items={filteredTransport} search={search} favorites={favorites} onToggleFav={toggleFav} />
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <footer className="border-t border-border/50 bg-background/80 backdrop-blur-xl mt-auto">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-200/80">
                <span className="font-semibold text-amber-400">Source des donn\u00e9es :</span> Les prix affich\u00e9s proviennent du{' '}
                <a href="https://www.albion-online-data.com/" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline font-medium">Albion Online Data Project</a>
                , un projet <span className="font-semibold">communautaire</span> (b\u00e9n\u00e9voles), et non de Sandbox Interactive.
                Il n'existe aucune API officielle Albion Online. Les donn\u00e9es peuvent avoir un d\u00e9lai et ne sont pas garanties en temps r\u00e9el.
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-emerald-400" />
              Actualisation toutes les 10s
            </p>
            <p>
              Albion Market Tracker &mdash; Non affili\u00e9 \u00e0 Sandbox Interactive
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
