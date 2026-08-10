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

// Only items confirmed to have real market data via Albion Online Data Project API.
// Weapons, capes (named), food, mounts, journals, books, runic mats, farm items all return 0.
const TRACKED_ITEMS = [
  // --- Resources T4-T8 ---
  'T4_ORE','T5_ORE','T6_ORE','T7_ORE','T8_ORE',
  'T4_WOOD','T5_WOOD','T6_WOOD','T7_WOOD','T8_WOOD',
  'T4_FIBER','T5_FIBER','T6_FIBER','T7_FIBER','T8_FIBER',
  'T4_HIDE','T5_HIDE','T6_HIDE','T7_HIDE','T8_HIDE',
  'T4_ROCK','T5_ROCK','T6_ROCK','T7_ROCK','T8_ROCK',
  // --- Materials T4-T8 ---
  'T4_METALBAR','T5_METALBAR','T6_METALBAR','T7_METALBAR','T8_METALBAR',
  'T4_PLANKS','T5_PLANKS','T6_PLANKS','T7_PLANKS','T8_PLANKS',
  'T4_CLOTH','T5_CLOTH','T6_CLOTH','T7_CLOTH','T8_CLOTH',
  'T4_LEATHER','T5_LEATHER','T6_LEATHER','T7_LEATHER','T8_LEATHER',
  'T4_STONEBLOCK','T5_STONEBLOCK','T6_STONEBLOCK','T7_STONEBLOCK','T8_STONEBLOCK',
  // --- Bags T4-T8 ---
  'T4_BAG','T5_BAG','T6_BAG','T7_BAG','T8_BAG',
  // --- Capes T4-T8 ---
  'T4_CAPE','T5_CAPE','T6_CAPE','T7_CAPE','T8_CAPE',
  // --- Armor Cloth T4-T8 ---
  'T4_ARMOR_CLOTH_SET1','T5_ARMOR_CLOTH_SET1','T6_ARMOR_CLOTH_SET1','T7_ARMOR_CLOTH_SET1','T8_ARMOR_CLOTH_SET1',
  'T4_SHOES_CLOTH_SET1','T5_SHOES_CLOTH_SET1','T6_SHOES_CLOTH_SET1','T7_SHOES_CLOTH_SET1','T8_SHOES_CLOTH_SET1',
  'T4_HEAD_CLOTH_SET1','T5_HEAD_CLOTH_SET1','T6_HEAD_CLOTH_SET1','T7_HEAD_CLOTH_SET1','T8_HEAD_CLOTH_SET1',
  // --- Armor Leather T4-T8 ---
  'T4_ARMOR_LEATHER_SET1','T5_ARMOR_LEATHER_SET1','T6_ARMOR_LEATHER_SET1','T7_ARMOR_LEATHER_SET1','T8_ARMOR_LEATHER_SET1',
  'T4_SHOES_LEATHER_SET1','T5_SHOES_LEATHER_SET1','T6_SHOES_LEATHER_SET1','T7_SHOES_LEATHER_SET1','T8_SHOES_LEATHER_SET1',
  'T4_HEAD_LEATHER_SET1','T5_HEAD_LEATHER_SET1','T6_HEAD_LEATHER_SET1','T7_HEAD_LEATHER_SET1','T8_HEAD_LEATHER_SET1',
  // --- Armor Plate T4-T8 ---
  'T4_ARMOR_PLATE_SET1','T5_ARMOR_PLATE_SET1','T6_ARMOR_PLATE_SET1','T7_ARMOR_PLATE_SET1','T8_ARMOR_PLATE_SET1',
  'T4_SHOES_PLATE_SET1','T5_SHOES_PLATE_SET1','T6_SHOES_PLATE_SET1','T7_SHOES_PLATE_SET1','T8_SHOES_PLATE_SET1',
  'T4_HEAD_PLATE_SET1','T5_HEAD_PLATE_SET1','T6_HEAD_PLATE_SET1','T7_HEAD_PLATE_SET1',
  // --- Runes / Souls / Relics T4-T8 ---
  'T4_RUNE','T5_RUNE','T6_RUNE','T7_RUNE','T8_RUNE',
  'T4_SOUL','T5_SOUL','T6_SOUL','T7_SOUL','T8_SOUL',
  'T4_RELIC','T5_RELIC','T6_RELIC','T7_RELIC','T8_RELIC',
  // --- Potions (T4 and T6 confirmed with data) ---
  'T4_POTION_HEAL','T6_POTION_HEAL',
  'T4_POTION_ENERGY','T6_POTION_ENERGY',
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
  // Resources
  'ORE': 'Minerai', 'WOOD': 'Bois', 'FIBER': 'Fibre', 'HIDE': 'Peau', 'ROCK': 'Pierre',
  // Materials
  'METALBAR': 'Lingot de métal', 'PLANKS': 'Planche', 'CLOTH': 'Tissu', 'LEATHER': 'Cuir', 'STONEBLOCK': 'Bloc de pierre',
  // Equipment
  'BAG': 'Sac', 'CAPE': 'Cape',
  // Armor Cloth
  'ARMOR_CLOTH_SET1': 'Armure en tissu', 'SHOES_CLOTH_SET1': 'Chaussures en tissu', 'HEAD_CLOTH_SET1': 'Coiffe en tissu',
  // Armor Leather
  'ARMOR_LEATHER_SET1': 'Armure en cuir', 'SHOES_LEATHER_SET1': 'Chaussures en cuir', 'HEAD_LEATHER_SET1': 'Coiffe en cuir',
  // Armor Plate
  'ARMOR_PLATE_SET1': 'Armure en plaques', 'SHOES_PLATE_SET1': 'Chaussures en plaques', 'HEAD_PLATE_SET1': 'Coiffe en plaques',
  // Runes
  'RUNE': 'Rune', 'SOUL': 'Âme', 'RELIC': 'Relique',
  // Potions
  'POTION_HEAL': 'Potion de soins', 'POTION_ENERGY': "Potion d'énergie",
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
        // API returns all quality levels — filter to quality 1 only
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
    for (const tier of [4, 5, 6, 7, 8]) {
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
  const RESOURCE_KW = ['ORE','WOOD','FIBER','HIDE','ROCK','METALBAR','PLANKS','CLOTH','LEATHER','STONEBLOCK','RUNE','SOUL','RELIC','POTION','BAG','CAPE','ARMOR','SHOES','HEAD']
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
