'use client'

import { useEffect, useState } from 'react'
import { useAlbionData } from '@/lib/albion-client'
import type { TopSellingItem, BlackMarketItem, TrendingItem, FlipOpportunity, RefineOpportunity, TransportOpportunity, GoldData } from '@/lib/albion-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  TrendingUp, RefreshCw, Coins, Skull, BarChart3, Clock, ArrowUpRight,
  ArrowRightLeft, Activity, Search, ShoppingBag, Radio, Flame, Truck, Factory,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts'

// --- Utility functions ---
function formatSilver(price: number | null): string {
  if (price === null || price === undefined) return '-'
  if (price >= 1000000) return `${(price / 1000000).toFixed(2)}M`
  if (price >= 1000) return `${(price / 1000).toFixed(1)}K`
  return price.toString()
}

function formatGoldPrice(price: number): string {
  return price.toLocaleString('fr-FR')
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return "à l'instant"
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
  if (lower.includes('lingot') || lower.includes('planche') || lower.includes('tissu') || lower.includes('cuir') || lower.includes('bloc de pierre')) return 'Matériau'
  if (lower.includes('armure') || lower.includes('coiffe') || lower.includes('chaussures')) return 'Armure'
  if (lower.includes('sac')) return 'Équipement'
  if (lower.includes('cape')) return 'Équipement'
  if (lower.includes('rune') || lower.includes('âme') || lower.includes('relique')) return 'Rune'
  if (lower.includes('potion')) return 'Potion'
  return 'Autre'
}

function getRenderId(dataProjectId: string): string {
  // Most Data Project IDs match render IDs directly.
  // Only a few items need remapping.
  const m = dataProjectId.match(/^(T\d+_|)(.+)$/)
  if (!m) return dataProjectId
  const tier = m[1] || ''
  const base = m[2]
  const MAP: Record<string, string> = {
    CLOTH: 'CLOTHITEM',
    LEATHER: 'LEATHERITEM',
  }
  return tier + (MAP[base] || base)
}

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

// --- Components ---

function LiveIndicator({ connected, lastUpdate, updateCount, fetching }: { connected: boolean; lastUpdate: number; updateCount: number; fetching: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`live-pulse absolute inline-flex h-full w-full rounded-full opacity-75 ${!connected ? 'bg-red-400' : fetching ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${!connected ? 'bg-red-500' : fetching ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
        </span>
        <span className={`${!connected ? 'text-red-400' : fetching ? 'text-amber-400' : 'text-emerald-400'} font-medium flex items-center gap-1.5`}>
          <Radio className="h-3.5 w-3.5" />
          {!connected ? 'HORS LIGNE' : fetching ? 'SYNC...' : 'LIVE'}
        </span>
      </div>
      {connected && updateCount > 0 && (
        <span className="text-xs text-muted-foreground font-mono">
          {updateCount} mises à jour reçues
        </span>
      )}
      {lastUpdate > 0 && (
        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{timeAgo(lastUpdate)}</span>
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
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold font-mono">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TopSellingTable({ items }: { items: TopSellingItem[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="hidden md:table-cell">Catégorie</TableHead>
            <TableHead className="text-right">Prix Vente</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Prix Achat</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Prix Moyen</TableHead>
            <TableHead className="hidden lg:table-cell">Meilleur Marché</TableHead>
            <TableHead className="text-center">Activité</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <span className={`font-semibold ${getTierColor(item.name)}`}>{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant={getTierBadgeVariant(item.name)} className="text-xs">
                  {getItemCategory(item.name)}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-emerald-400">
                {item.bestSellPrice ? formatSilver(item.bestSellPrice) : '-'}
              </TableCell>
              <TableCell className="text-right font-mono text-amber-400 hidden sm:table-cell">
                {item.bestBuyPrice ? formatSilver(item.bestBuyPrice) : '-'}
              </TableCell>
              <TableCell className="text-right font-mono hidden lg:table-cell">
                {item.avgSellPrice ? formatSilver(item.avgSellPrice) : '-'}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {item.bestSellCity ? (
                  <Badge variant="outline" className="text-xs font-normal">{item.bestSellCity}</Badge>
                ) : '-'}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-sm">{item.totalVolume}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Aucune donnée disponible. Patientez pendant le chargement...
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function BlackMarketTable({ items }: { items: BlackMarketItem[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Black Market</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Source</TableHead>
            <TableHead className="hidden md:table-cell">Ville Source</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Marge</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <span className={`font-semibold ${getTierColor(item.name)}`}>{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-amber-400">
                {formatSilver(item.blackMarketPrice)}
              </TableCell>
              <TableCell className="text-right font-mono hidden sm:table-cell">
                {formatSilver(item.sourcePrice)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="outline" className="text-xs font-normal">{item.sourceCity}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-emerald-400">
                +{formatSilver(item.profit)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <ArrowUpRight className={`h-4 w-4 ${item.marginPercent > 30 ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className={`font-mono font-semibold ${item.marginPercent > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    +{item.marginPercent}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Aucune opportunité de profit trouvée sur le Black Market
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TrendingChart({ items }: { items: TrendingItem[] }) {
  // Horizontal bar chart: best for long French item names, sorted by spread desc
  const chartData = items.slice(0, 10).map(item => ({
    name: item.name,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    spread: item.spread,
  }))
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Meilleurs Écarts de Prix Inter-Villes
          </CardTitle>
          <CardDescription>Items avec le plus grand écart de prix de vente entre villes (hors Black Market)</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: Math.max(280, chartData.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 260)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'oklch(0.65 0.02 260)', fontSize: 11 }} tickFormatter={(v: number) => formatSilver(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'oklch(0.8 0.02 260)', fontSize: 11 }} width={115} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'oklch(0.17 0.012 260)', border: '1px solid oklch(0.3 0.02 260)', borderRadius: '8px', color: 'oklch(0.93 0.01 80)' }}
                  formatter={(value: number, name: string) => [formatSilver(value), name === 'minPrice' ? 'Prix Min' : name === 'maxPrice' ? 'Prix Max' : 'Écart']}
                />
                <Bar dataKey="minPrice" fill="oklch(0.65 0.2 155)" radius={[0, 2, 2, 0]} name="Prix Min" />
                <Bar dataKey="maxPrice" fill="oklch(0.65 0.2 25)" radius={[0, 2, 2, 0]} name="Prix Max" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Détail des Tendances
          </CardTitle>
          <CardDescription>Items les plus recherchés avec leurs prix par ville</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2">
            {items.map((item) => (
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
                    <span className="text-sky-400">Écart: <span className="font-mono">{formatSilver(item.spread)}</span></span>
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
            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Aucune tendance disponible</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FlipOpportunitiesTable({ items }: { items: FlipOpportunity[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="hidden md:table-cell">Acheter à</TableHead>
            <TableHead className="text-right">Prix Achat</TableHead>
            <TableHead className="hidden md:table-cell">Vendre à</TableHead>
            <TableHead className="text-right">Prix Vente</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Marge</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell><div className="flex items-center gap-2"><ItemIcon itemId={item.itemId} size={40} /><span className={`font-semibold ${getTierColor(item.name)}`}>{item.name}</span></div></TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-sky-400 border-sky-500/30">{item.buyCity}</Badge></TableCell>
              <TableCell className="text-right font-mono text-amber-400">{formatSilver(item.buyPrice)}</TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal text-emerald-400 border-emerald-500/30">{item.sellCity}</Badge></TableCell>
              <TableCell className="text-right font-mono text-emerald-400">{formatSilver(item.sellPrice)}</TableCell>
              <TableCell className="text-right font-mono font-semibold text-emerald-400">+{formatSilver(item.profit)}</TableCell>
              <TableCell className="text-right">
                <span className={`font-mono font-semibold ${item.marginPercent > 20 ? 'text-emerald-400' : 'text-amber-400'}`}>+{item.marginPercent}%</span>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune opportunité d'achat/revente détectée</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function RefineOpportunitiesTable({ items }: { items: RefineOpportunity[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>Produit Raffiné</TableHead>
            <TableHead className="hidden lg:table-cell">Matière Première</TableHead>
            <TableHead className="hidden md:table-cell">Ratio</TableHead>
            <TableHead className="hidden md:table-cell">Acheter à</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Coût Brut</TableHead>
            <TableHead className="hidden md:table-cell">Vendre à</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Marge</TableHead>
            <TableHead className="hidden lg:table-cell text-center">Bonus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.itemId} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ItemIcon itemId={item.itemId} size={36} />
                  <div>
                    <span className={`font-semibold ${getTierColor(item.name)}`}>{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-1">T{item.tier}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">{item.rawName}</span>
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
          {items.length === 0 && (
            <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune opportunité de raffinage rentable détectée</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TransportOpportunitiesTable({ items }: { items: TransportOpportunity[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>Ressource</TableHead>
            <TableHead className="hidden md:table-cell">De</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Achat</TableHead>
            <TableHead className="hidden md:table-cell">Vers</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Vente</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Marge</TableHead>
            <TableHead className="hidden lg:table-cell">Route</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={`${item.itemId}-${item.fromCity}-${item.toCity}`} className="border-border/30 hover:bg-muted/50 transition-colors">
              <TableCell className="text-center font-mono text-muted-foreground text-sm">{idx + 1}</TableCell>
              <TableCell><div className="flex items-center gap-2"><ItemIcon itemId={item.itemId} size={40} /><span className={`font-semibold ${getTierColor(item.name)}`}>{item.name}</span></div></TableCell>
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
          {items.length === 0 && (
            <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune route de transport rentable détectée</TableCell></TableRow>
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
      <Skeleton className="h-64 rounded-lg" />
      <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
    </div>
  )
}

// --- Main Page ---
export default function AlbionMarketTracker() {
  const { topSelling, blackMarket, trending, opportunities, gold, totalItemsTracked,
          lastUpdate, loading, fetching, connected, updateCount, refresh } = useAlbionData(30000)

  // Time ago ticker
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(interval)
  }, [])

  const avgBlackMarketMargin = blackMarket.length > 0
    ? Math.round(blackMarket.reduce((sum, i) => sum + i.marginPercent, 0) / blackMarket.length)
    : 0

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  Albion Market <span className="text-primary">Tracker</span>
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Données en temps réel du marché &amp; black market
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LiveIndicator connected={connected} lastUpdate={lastUpdate} updateCount={updateCount} fetching={fetching} />
              <Button variant="outline" size="icon" onClick={refresh} disabled={fetching} title="Rafraîchir">
                <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        <GoldTicker gold={gold} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BarChart3} label="Items Suivis" value={totalItemsTracked} subtext="sur tous les marchés" color="bg-primary/20 text-primary" />
          <StatCard icon={TrendingUp} label="Top Ventes" value={topSelling.length} subtext="items les plus actifs" color="bg-emerald-500/20 text-emerald-400" />
          <StatCard icon={Skull} label="Black Market" value={blackMarket.length} subtext="opportunités détectées" color="bg-red-500/20 text-red-400" />
          <StatCard icon={Coins} label="Marge Moyenne" value={`${avgBlackMarketMargin}%`} subtext="marge bénéficiaire BM" color="bg-amber-500/20 text-amber-400" />
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <Tabs defaultValue="market" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="market" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Marché</span></TabsTrigger>
              <TabsTrigger value="blackmarket" className="flex items-center gap-2"><Skull className="h-4 w-4" /><span className="hidden sm:inline">Black Market</span></TabsTrigger>
              <TabsTrigger value="trending" className="flex items-center gap-2"><Activity className="h-4 w-4" /><span className="hidden sm:inline">Tendances</span></TabsTrigger>
              <TabsTrigger value="opportunities" className="flex items-center gap-2"><Flame className="h-4 w-4" /><span className="hidden sm:inline">Opportunités</span></TabsTrigger>
            </TabsList>

            <TabsContent value="market" className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Items les Plus Recherchés &amp; Vendus</h2>
                <p className="text-sm text-muted-foreground">Classés par volume d'activité sur tous les marchés royaux</p>
              </div>
              <ScrollArea className="max-h-[55vh]"><TopSellingTable items={topSelling} /></ScrollArea>
            </TabsContent>

            <TabsContent value="blackmarket" className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><Skull className="h-5 w-5 text-red-400" />Opportunités Black Market</h2>
                <p className="text-sm text-muted-foreground">Acheter sur les marchés royaux et revendre au Black Market de Caerleon</p>
              </div>
              <ScrollArea className="max-h-[55vh]"><BlackMarketTable items={blackMarket} /></ScrollArea>
            </TabsContent>

            <TabsContent value="trending" className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Tendances du Marché</h2>
                <p className="text-sm text-muted-foreground">Items les plus recherchés avec écarts de prix inter-villes</p>
              </div>
              <TrendingChart items={trending} />
            </TabsContent>

            <TabsContent value="opportunities" className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Achat / Revente Inter-Villes</h2>
                <p className="text-sm text-muted-foreground">Acheter au prix le plus bas dans une ville et revendre au prix d'achat le plus élevé dans une autre — classé par profit absolu</p>
              </div>
              <ScrollArea className="max-h-[45vh]"><FlipOpportunitiesTable items={opportunities.flip} /></ScrollArea>

              <div className="border-t border-border/50 pt-6">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Factory className="h-5 w-5 text-amber-400" />Meilleures Opportunités de Raffinage</h2>
                <p className="text-sm text-muted-foreground">Acheter des matières premières, les raffiner, et vendre le produit fini — les ratios T4-T6: 2:1, T7: 3:1, T8: 4:1</p>
              </div>
              <ScrollArea className="max-h-[45vh]"><RefineOpportunitiesTable items={opportunities.refine} /></ScrollArea>

              <div className="border-t border-border/50 pt-6">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Truck className="h-5 w-5 text-sky-400" />Meilleures Routes de Transport</h2>
                <p className="text-sm text-muted-foreground">Ressources et matériaux avec le plus gros écart de prix entre deux villes — idéal pour le transport de marchandises</p>
              </div>
              <ScrollArea className="max-h-[45vh]"><TransportOpportunitiesTable items={opportunities.transport} /></ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="border-t border-border/50 bg-background/80 backdrop-blur-xl mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>Données fournies par{' '}
              <a href="https://www.albion-online-data.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Albion Online Data Project</a>
            </p>
            <p className="flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-emerald-400" />
              Données mises à jour automatiquement toutes les 30s
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
