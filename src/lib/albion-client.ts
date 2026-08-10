'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================
// Types
// ============================================================

export interface TopSellingItem {
  itemId: string; name: string; avgSellPrice: number | null; bestSellPrice: number | null
  bestSellCity: string | null; bestBuyPrice: number | null; totalVolume: number; cities: string[]
}
export interface BlackMarketItem {
  itemId: string; name: string; blackMarketPrice: number; sourcePrice: number
  sourceCity: string; profit: number; marginPercent: number; updatedAt: string | null
}
export interface TrendingItem {
  itemId: string; name: string; avgPrice: number; minPrice: number; maxPrice: number
  cityCount: number; spread: number
  cities: { city: string; sellPrice: number | null; buyPrice: number | null }[]
}
export interface FlipOpportunity {
  itemId: string; name: string; buyCity: string; buyPrice: number
  sellCity: string; sellPrice: number; profit: number; marginPercent: number
}
export interface RefineOpportunity {
  itemId: string; rawItemId: string; name: string; rawName: string; tier: number
  buyCity: string; rawPrice: number; sellCity: string; refinedPrice: number
  ratio: number; costRaw: number; profit: number; marginPercent: number
  bonusCity: string; hasBonus: boolean
}
export interface TransportOpportunity {
  itemId: string; name: string; fromCity: string; buyPrice: number
  toCity: string; sellPrice: number; profit: number; marginPercent: number
}
export interface GoldData { timestamp: number; price: number }

interface MarketData {
  item_id: string; city: string; quality: number
  sell_price_min: number | null; sell_price_min_date: string | null
  sell_price_max: number | null; sell_price_max_date: string | null
  buy_price_min: number | null; buy_price_min_date: string | null
  buy_price_max: number | null; buy_price_max_date: number | null
}

// ============================================================
// Constants
// ============================================================

const ALBION_API = 'https://www.albion-online-data.com/api/v2/stats'
const CITIES = ['Bridgewatch', 'Caerleon', 'Fort Sterling', 'Lymhurst', 'Martlock', 'Thetford']
const BLACK_MARKET_CITY = 'Caerleon'
const NON_BM_CITIES = CITIES.filter(c => c !== BLACK_MARKET_CITY)

const TRACKED_ITEMS = [
  'T8_ARMORED_SWORD','T8_BROADSWORD','T8_CLAYMORE','T8_DUAL_SWORDS',
  'T8_FIRE_STAFF','T8_FROST_STAFF','T8_HOLY_STAFF','T8_ARCANESTAFF','T8_NATURE_STAFF',
  'T8_BOW','T8_CROSSBOW','T8_LONGBOW','T8_WARBOW',
  'T8_DAGGER','T8_KATAR','T8_SHADOW_DAGGER',
  'T8_HAMMER','T8_MACE','T8_BATTLEAXE','T8_HALBERD','T8_QUARTERSTAFF','T8_ESCIMITAR',
  'T8_BAG','T8_CAPE','T8_HEAD_CLOTH_SET1','T8_HEAD_LEATHER_SET1','T8_HEAD_PLATE_SET1',
  'T8_CAPEMAGE','T8_CAPERANGER','T8_CAPEMERCENARY','T8_CAPEINQUISITOR','T8_CAPEVALKYRIE','T8_CAPEHELL',
  'T7_ARMORED_SWORD','T7_BROADSWORD','T7_CLAYMORE',
  'T7_FIRE_STAFF','T7_FROST_STAFF','T7_HOLY_STAFF','T7_ARCANESTAFF','T7_NATURE_STAFF',
  'T7_BOW','T7_CROSSBOW','T7_LONGBOW',
  'T7_DAGGER','T7_HAMMER','T7_MACE','T7_BATTLEAXE',
  'T7_BAG','T7_HEAD_CLOTH_SET1','T7_HEAD_LEATHER_SET1','T7_HEAD_PLATE_SET1',
  'T6_BAG','T6_ARMORED_SWORD','T6_FIRE_STAFF','T6_BOW','T6_DAGGER','T6_HAMMER',
  'T8_ORE','T8_WOOD','T8_FIBER','T8_HIDE','T8_ROCK',
  'T7_ORE','T7_WOOD','T7_FIBER','T7_HIDE','T7_ROCK',
  'T6_ORE','T6_WOOD','T6_FIBER','T6_HIDE',
  'T5_ORE','T5_WOOD','T5_FIBER','T5_HIDE',
  'T8_METALBAR','T8_PLANKS','T8_CLOTH','T8_LEATHER','T8_STONEBLOCK',
  'T7_METALBAR','T7_PLANKS','T7_CLOTH','T7_LEATHER','T7_STONEBLOCK',
  'T8_RMETALBAR','T8_RPLANKS','T8_RCLOTH','T8_RLEATHER','T8_RSTONEBLOCK',
  'T8_POTION_HEAL','T8_POTION_ENERGY','T8_POTION_FLEX',
  'T7_POTION_HEAL','T7_POTION_ENERGY',
  'T8_PORK_RIPE','T8_CHICKEN_RIPE','T8_BEET_RIPE','T8_CABBAGE_RIPE','T8_POTATO_RIPE',
  'T7_PORK_RIPE','T7_CHICKEN_RIPE','T7_BEET_RIPE','T7_CABBAGE_RIPE',
  'RUNE_S3','RUNE_S4','RUNE_S5','SOUL_S3','SOUL_S4','SOUL_S5','RELIC_S3','RELIC_S4','RELIC_S5',
  'T8_AVALONIAN_SWORD','T8_AVALONIAN_FIRE','T8_AVALONIAN_FROST','T8_AVALONIAN_HOLY','T8_AVALONIAN_ARCANE',
  'T8_AVALONIAN_NATURE','T8_AVALONIAN_BOW','T8_AVALONIAN_CROSSBOW',
  'T8_ROYAL_SWORD','T8_ROYAL_FIRE','T8_ROYAL_FROST','T8_ROYAL_BOW',
  'T8_ARTIFACT_SWORD','T8_ARTIFACT_FIRE','T8_ARTIFACT_FROST','T8_ARTIFACT_HOLY','T8_ARTIFACT_ARCANE',
  'T8_ARTIFACT_NATURE','T8_ARTIFACT_BOW','T8_ARTIFACT_CROSSBOW','T8_ARTIFACT_DAGGER','T8_ARTIFACT_HAMMER',
  'T8_BOOK_UNDEAD','T8_BOOK_DEMON','T8_BOOK_MORGANA','T8_BOOK_AVALON',
  'T8_JOURNAL_WARRIOR','T8_JOURNAL_MAGE','T8_JOURNAL_HUNTER',
  'T7_JOURNAL_WARRIOR','T7_JOURNAL_MAGE','T7_JOURNAL_HUNTER',
  'MOUNT_HORSE','MOUNT_ARMORED_HORSE','MOUNT_OX','MOUNT_STAG',
  'T8_FARM_FOCUS','T7_FARM_FOCUS',
]

const REFINE_CHAINS = [
  { raw: 'ORE', refined: 'METALBAR', getRatio: (t: number) => t >= 8 ? 4 : t >= 7 ? 3 : 2 },
  { raw: 'WOOD', refined: 'PLANKS', getRatio: (t: number) => t >= 8 ? 4 : t >= 7 ? 3 : 2 },
  { raw: 'FIBER', refined: 'CLOTH', getRatio: (t: number) => t >= 8 ? 4 : t >= 7 ? 3 : 2 },
  { raw: 'HIDE', refined: 'LEATHER', getRatio: (t: number) => t >= 8 ? 4 : t >= 7 ? 3 : 2 },
  { raw: 'ROCK', refined: 'STONEBLOCK', getRatio: (t: number) => t >= 8 ? 4 : t >= 7 ? 3 : 2 },
]

const CITY_REFINE_BONUS: Record<string, string> = {
  'METALBAR': 'Fort Sterling', 'PLANKS': 'Fort Sterling',
  'CLOTH': 'Lymhurst', 'LEATHER': 'Martlock', 'STONEBLOCK': 'Bridgewatch',
}

// ============================================================
// French Names
// ============================================================

const FR_NAMES: Record<string, string> = {
  'ARMORED_SWORD': 'Épée blindée', 'BROADSWORD': 'Épée à deux mains', 'CLAYMORE': 'Claymore',
  'DUAL_SWORDS': 'Épées doubles', 'ESCIMITAR': 'Cimeterre',
  'AVALONIAN_SWORD': 'Épée avalonienne', 'ROYAL_SWORD': 'Épée royale', 'ARTIFACT_SWORD': "Épée d'artéfact",
  'FIRE_STAFF': 'Bâton de feu', 'FROST_STAFF': 'Bâton de givre', 'HOLY_STAFF': 'Bâton sacré',
  'ARCANESTAFF': 'Bâton arcanique', 'NATURE_STAFF': 'Bâton de nature',
  'AVALONIAN_FIRE': 'Bâton de feu avalonien', 'AVALONIAN_FROST': 'Bâton de givre avalonien',
  'AVALONIAN_HOLY': 'Bâton sacré avalonien', 'AVALONIAN_ARCANE': 'Bâton arcanique avalonien',
  'AVALONIAN_NATURE': 'Bâton de nature avalonien',
  'ROYAL_FIRE': 'Bâton de feu royal', 'ROYAL_FROST': 'Bâton de givre royal',
  'ARTIFACT_FIRE': "Bâton de feu d'artéfact", 'ARTIFACT_FROST': "Bâton de givre d'artéfact",
  'ARTIFACT_HOLY': "Bâton sacré d'artéfact", 'ARTIFACT_ARCANE': "Bâton arcanique d'artéfact",
  'ARTIFACT_NATURE': "Bâton de nature d'artéfact",
  'BOW': 'Arc', 'CROSSBOW': 'Arbalète', 'LONGBOW': 'Arc long', 'WARBOW': 'Arc de guerre',
  'AVALONIAN_BOW': 'Arc avalonien', 'AVALONIAN_CROSSBOW': 'Arbalète avalonienne',
  'ROYAL_BOW': 'Arc royal', 'ARTIFACT_BOW': "Arc d'artéfact", 'ARTIFACT_CROSSBOW': "Arbalète d'artéfact",
  'DAGGER': 'Dague', 'KATAR': 'Katar', 'SHADOW_DAGGER': "Dague de l'ombre", 'ARTIFACT_DAGGER': "Dague d'artéfact",
  'HAMMER': 'Marteau', 'MACE': "Masse d'armes", 'BATTLEAXE': 'Hache de bataille',
  'HALBERD': 'Hallebarde', 'QUARTERSTAFF': 'Bâton de combat', 'ARTIFACT_HAMMER': "Marteau d'artéfact",
  'BAG': 'Sac', 'CAPE': 'Cape',
  'HEAD_CLOTH_SET1': 'Coiffe en tissu', 'HEAD_LEATHER_SET1': 'Coiffe en cuir', 'HEAD_PLATE_SET1': 'Coiffe en plaques',
  'CAPEMAGE': 'Cape de mage', 'CAPERANGER': 'Cape de chasseur', 'CAPEMERCENARY': 'Cape de mercenaire',
  'CAPEINQUISITOR': "Cape d'inquisiteur", 'CAPEVALKYRIE': 'Cape de valkyrie', 'CAPEHELL': 'Cape des enfers',
  'ORE': 'Minerai', 'WOOD': 'Bois', 'FIBER': 'Fibre', 'HIDE': 'Peau', 'ROCK': 'Pierre',
  'METALBAR': 'Lingot de métal', 'PLANKS': 'Planche', 'CLOTH': 'Tissu', 'LEATHER': 'Cuir', 'STONEBLOCK': 'Bloc de pierre',
  'RMETALBAR': 'Lingot runique', 'RPLANKS': 'Planche runique', 'RCLOTH': 'Tissu runique',
  'RLEATHER': 'Cuir runique', 'RSTONEBLOCK': 'Bloc de pierre runique',
  'POTION_HEAL': 'Potion de soins', 'POTION_ENERGY': "Potion d'énergie", 'POTION_FLEX': 'Potion de souplesse',
  'PORK_RIPE': 'Porc mûr', 'CHICKEN_RIPE': 'Poulet mûr', 'BEET_RIPE': 'Betterave mûre',
  'CABBAGE_RIPE': 'Chou mûr', 'POTATO_RIPE': 'Pomme de terre mûre',
  'RUNE_S3': 'Rune (Niv. 3)', 'RUNE_S4': 'Rune (Niv. 4)', 'RUNE_S5': 'Rune (Niv. 5)',
  'SOUL_S3': 'Âme (Niv. 3)', 'SOUL_S4': 'Âme (Niv. 4)', 'SOUL_S5': 'Âme (Niv. 5)',
  'RELIC_S3': 'Relique (Niv. 3)', 'RELIC_S4': 'Relique (Niv. 4)', 'RELIC_S5': 'Relique (Niv. 5)',
  'BOOK_UNDEAD': 'Livre des morts-vivants', 'BOOK_DEMON': 'Livre des démons',
  'BOOK_MORGANA': 'Livre de Morgana', 'BOOK_AVALON': "Livre d'Avalon",
  'JOURNAL_WARRIOR': 'Journal de guerrier', 'JOURNAL_MAGE': 'Journal de mage', 'JOURNAL_HUNTER': 'Journal de chasseur',
  'MOUNT_HORSE': 'Cheval', 'MOUNT_ARMORED_HORSE': 'Cheval blindé', 'MOUNT_OX': 'Bœuf', 'MOUNT_STAG': 'Cerf',
  'FARM_FOCUS': 'Focus de ferme',
}

function parseItemId(itemId: string): { tier: string | null; baseKey: string } {
  const m = itemId.match(/^(T\d+)_(.+)$|^(.+)$/)
  if (!m) return { tier: null, baseKey: itemId }
  if (m[1]) return { tier: m[1], baseKey: m[2] }
  return { tier: null, baseKey: m[3] }
}

function displayName(itemId: string): string {
  const { tier, baseKey } = parseItemId(itemId)
  const fr = FR_NAMES[baseKey] || baseKey.charAt(0).toUpperCase() + baseKey.slice(1).toLowerCase().replace(/_/g, ' ')
  return tier ? `${fr} ${tier}` : fr
}

// ============================================================
// Data Fetching
// ============================================================

async function fetchAllMarketData(): Promise<MarketData[]> {
  const batchSize = 20
  const batches: string[][] = []
  for (let i = 0; i < TRACKED_ITEMS.length; i += batchSize) {
    batches.push(TRACKED_ITEMS.slice(i, i + batchSize))
  }

  const allData: MarketData[] = []
  const concurrency = 5
  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      chunk.map(async (batch) => {
        const url = `${ALBION_API}/prices/${batch.join(',')}?locations=${CITIES.join(',')}`
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) return []
        const data = await res.json() as MarketData[]
        // Filter to quality 1 only (API returns all qualities despite filter)
        return data.filter(d => d.quality === 1)
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) allData.push(...r.value)
    }
  }
  return allData
}

async function fetchGold(): Promise<GoldData | null> {
  try {
    const res = await fetch(`${ALBION_API}/gold?count=1`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) { const gd = await res.json(); return gd?.length ? gd[0] : null }
  } catch { return null }
  return null
}

// ============================================================
// Data Processing (pure functions)
// ============================================================

function processAllData(allData: MarketData[], gold: GoldData | null) {
  const marketMap = new Map<string, MarketData[]>()
  for (const item of allData) {
    const arr = marketMap.get(item.item_id) || []
    arr.push(item)
    marketMap.set(item.item_id, arr)
  }

  // Top Selling
  const topSelling: TopSellingItem[] = []
  for (const [itemId, entries] of marketMap) {
    let bestSellPrice = Infinity, bestCity = '', totalSellMin = 0, bestBuyPrice = 0, sc = 0, bc = 0
    for (const e of entries) {
      if (e.sell_price_min && e.sell_price_min > 0) { totalSellMin += e.sell_price_min; sc++; if (e.sell_price_min < bestSellPrice) { bestSellPrice = e.sell_price_min; bestCity = e.city } }
      if (e.buy_price_max && e.buy_price_max > 0) { bc++; if (e.buy_price_max > bestBuyPrice) bestBuyPrice = e.buy_price_max }
    }
    if (sc > 0 || bc > 0) topSelling.push({ itemId, name: displayName(itemId), avgSellPrice: sc > 0 ? Math.round(totalSellMin / sc) : null, bestSellPrice: bestSellPrice === Infinity ? null : bestSellPrice, bestSellCity: bestCity || null, bestBuyPrice: bestBuyPrice > 0 ? bestBuyPrice : null, totalVolume: sc + bc, cities: entries.map(e => e.city) })
  }
  topSelling.sort((a, b) => b.totalVolume - a.totalVolume)

  // Black Market
  const blackMarket: BlackMarketItem[] = []
  for (const [itemId, entries] of marketMap) {
    const cel = entries.find(e => e.city === BLACK_MARKET_CITY)
    const others = entries.filter(e => e.city !== BLACK_MARKET_CITY)
    if (!cel?.sell_price_min) continue
    let bsp = Infinity, src = ''
    for (const e of others) { if (e.sell_price_min && e.sell_price_min < bsp && e.sell_price_min > 0) { bsp = e.sell_price_min; src = e.city } }
    if (bsp === Infinity) continue
    const profit = cel.sell_price_min - bsp
    const margin = bsp > 0 ? Math.round((profit / bsp) * 100) : 0
    if (profit > 0) blackMarket.push({ itemId, name: displayName(itemId), blackMarketPrice: cel.sell_price_min, sourcePrice: bsp, sourceCity: src, profit, marginPercent: margin, updatedAt: cel.sell_price_min_date })
  }
  blackMarket.sort((a, b) => b.marginPercent - a.marginPercent)

  // Trending
  const trending: TrendingItem[] = []
  for (const [itemId, entries] of marketMap) {
    const active = entries.filter(e => e.sell_price_min && e.sell_price_min > 0)
    if (active.length < 2) continue
    const avg = Math.round(active.reduce((s, e) => s + (e.sell_price_min || 0), 0) / active.length)
    const min = Math.min(...active.map(e => e.sell_price_min || Infinity))
    const max = Math.max(...active.map(e => e.sell_price_max || 0))
    trending.push({ itemId, name: displayName(itemId), avgPrice: avg, minPrice: min === Infinity ? 0 : min, maxPrice: max, cityCount: active.length, spread: max - (min === Infinity ? 0 : min), cities: active.map(e => ({ city: e.city, sellPrice: e.sell_price_min, buyPrice: e.buy_price_max })) })
  }
  trending.sort((a, b) => b.cityCount - a.cityCount || b.spread - a.spread)

  // === Opportunities ===

  // 1) Flip (achat/revente)
  const flip: FlipOpportunity[] = []
  for (const [itemId, entries] of marketMap) {
    const nonBM = entries.filter(e => e.city !== BLACK_MARKET_CITY)
    let lowestSell = Infinity, lowestCity = ''
    let highestBuy = 0, highestCity = ''
    for (const e of nonBM) {
      if (e.sell_price_min && e.sell_price_min > 0 && e.sell_price_min < lowestSell) { lowestSell = e.sell_price_min; lowestCity = e.city }
      if (e.buy_price_max && e.buy_price_max > 0 && e.buy_price_max > highestBuy) { highestBuy = e.buy_price_max; highestCity = e.city }
    }
    if (lowestSell === Infinity || highestBuy <= 0 || lowestCity === highestCity) continue
    const profit = highestBuy - lowestSell
    const margin = lowestSell > 0 ? Math.round((profit / lowestSell) * 100) : 0
    if (profit > 0) flip.push({ itemId, name: displayName(itemId), buyCity: lowestCity, buyPrice: lowestSell, sellCity: highestCity, sellPrice: highestBuy, profit, marginPercent: margin })
  }
  flip.sort((a, b) => b.profit - a.profit)

  // 2) Raffinage
  const refine: RefineOpportunity[] = []
  for (const chain of REFINE_CHAINS) {
    for (const tier of [5, 6, 7, 8]) {
      const rawId = `T${tier}_${chain.raw}`
      const refinedId = `T${tier}_${chain.refined}`
      const rawEntries = marketMap.get(rawId)
      const refinedEntries = marketMap.get(refinedId)
      if (!rawEntries || !refinedEntries) continue
      const ratio = chain.getRatio(tier)
      const bonusCity = CITY_REFINE_BONUS[chain.refined]
      for (const rCity of NON_BM_CITIES) {
        const rawInCity = rawEntries.find(e => e.city === rCity && e.sell_price_min && e.sell_price_min > 0)
        if (!rawInCity) continue
        const sellCandidates = refinedEntries.filter(e => e.city !== BLACK_MARKET_CITY && e.buy_price_max && e.buy_price_max > 0)
        if (sellCandidates.length === 0) continue
        sellCandidates.sort((a, b) => {
 const aB = a.city === bonusCity ? 1 : 0; const bB = b.city === bonusCity ? 1 : 0
          return bB !== aB ? bB - aB : (b.buy_price_max || 0) - (a.buy_price_max || 0)
        })
        const bestSell = sellCandidates[0]
        const costRaw = rawInCity.sell_price_min! * ratio
        const revenue = bestSell.buy_price_max!
        const profit = revenue - costRaw
        const margin = costRaw > 0 ? Math.round((profit / costRaw) * 100) : 0
        if (profit > 0) {
          refine.push({ itemId: refinedId, rawItemId: rawId, name: displayName(refinedId), rawName: displayName(rawId), tier, buyCity: rCity, rawPrice: rawInCity.sell_price_min, sellCity: bestSell.city, refinedPrice: bestSell.buy_price_max, ratio, costRaw: Math.round(costRaw), profit: Math.round(profit), marginPercent: margin, bonusCity, hasBonus: bestSell.city === bonusCity })
        }
      }
    }
  }
  const refineBest = new Map<string, RefineOpportunity>()
  for (const r of refine) { const ex = refineBest.get(r.itemId); if (!ex || r.profit > ex.profit) refineBest.set(r.itemId, r) }
  const refineList = [...refineBest.values()].sort((a, b) => b.marginPercent - a.marginPercent)

  // 3) Transport
  const RESOURCE_KW = ['ORE','WOOD','FIBER','HIDE','ROCK','METALBAR','PLANKS','CLOTH','LEATHER','STONEBLOCK','RMETALBAR','RPLANKS','RCLOTH','RLEATHER','RSTONEBLOCK','POTION','PORK','CHICKEN','BEET','CABBAGE','POTATO','RUNE','SOUL','RELIC','JOURNAL','BOOK','FARM']
  const transport: TransportOpportunity[] = []
  for (const [itemId, entries] of marketMap) {
    if (!RESOURCE_KW.some(kw => itemId.includes(kw))) continue
    const nonBM = entries.filter(e => e.city !== BLACK_MARKET_CITY)
    for (const buyE of nonBM) {
      if (!buyE.sell_price_min || buyE.sell_price_min <= 0) continue
      for (const sellE of nonBM) {
        if (sellE.city === buyE.city || !sellE.buy_price_max || sellE.buy_price_max <= 0) continue
        const profit = sellE.buy_price_max - buyE.sell_price_min
        if (profit > 0) transport.push({ itemId, name: displayName(itemId), fromCity: buyE.city, buyPrice: buyE.sell_price_min, toCity: sellE.city, sellPrice: sellE.buy_price_max, profit, marginPercent: Math.round((profit / buyE.sell_price_min) * 100) })
      }
    }
  }
  const transportBest = new Map<string, TransportOpportunity>()
  for (const t of transport) { const ex = transportBest.get(t.itemId); if (!ex || t.profit > ex.profit) transportBest.set(t.itemId, t) }
  const transportList = [...transportBest.values()].sort((a, b) => b.profit - a.profit)

  return {
    topSelling: topSelling.slice(0, 30),
    blackMarket: blackMarket.slice(0, 30),
    trending: trending.slice(0, 25),
    opportunities: { flip: flip.slice(0, 40), refine: refineList.slice(0, 30), transport: transportList.slice(0, 40) },
    gold,
    totalItemsTracked: marketMap.size,
  }
}

// ============================================================
// React Hook
// ============================================================

export interface AlbionDataResult {
  topSelling: TopSellingItem[]
  blackMarket: BlackMarketItem[]
  trending: TrendingItem[]
  opportunities: { flip: FlipOpportunity[]; refine: RefineOpportunity[]; transport: TransportOpportunity[] }
  gold: GoldData | null
  totalItemsTracked: number
  lastUpdate: number
  loading: boolean
  fetching: boolean
  connected: boolean
  updateCount: number
  refresh: () => void
}

export function useAlbionData(pollInterval = 30000): AlbionDataResult {
  const [topSelling, setTopSelling] = useState<TopSellingItem[]>([])
  const [blackMarket, setBlackMarket] = useState<BlackMarketItem[]>([])
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [opportunities, setOpportunities] = useState<AlbionDataResult['opportunities']>({ flip: [], refine: [], transport: [] })
  const [gold, setGold] = useState<GoldData | null>(null)
  const [totalItemsTracked, setTotalItemsTracked] = useState(0)
  const [lastUpdate, setLastUpdate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [connected, setConnected] = useState(false)
  const [updateCount, setUpdateCount] = useState(0)
  const fetchingRef = useRef(false)

  const doFetch = useCallback(async (isInitial = false) => {
    if (fetchingRef.current && !isInitial) return
    fetchingRef.current = true
    if (!isInitial) setFetching(true)

    try {
      const [allData, goldData] = await Promise.all([fetchAllMarketData(), fetchGold()])
      const result = processAllData(allData, goldData)

      setTopSelling(result.topSelling)
      setBlackMarket(result.blackMarket)
      setTrending(result.trending)
      setOpportunities(result.opportunities)
      setGold(result.gold)
      setTotalItemsTracked(result.totalItemsTracked)
      setLastUpdate(Date.now())
      setConnected(true)
      if (!isInitial) setUpdateCount(c => c + 1)
    } catch (err) {
      console.error('[Albion Client] Fetch error:', err)
      setConnected(false)
    } finally {
      setLoading(false)
      setFetching(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    doFetch(true)
    const interval = setInterval(() => doFetch(false), pollInterval)
    return () => clearInterval(interval)
  }, [doFetch, pollInterval])

  const refresh = useCallback(() => { doFetch(false) }, [doFetch])

  return { topSelling, blackMarket, trending, opportunities, gold, totalItemsTracked, lastUpdate, loading, fetching, connected, updateCount, refresh }
}
