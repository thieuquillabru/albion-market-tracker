import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// --- Albion Online Data Project API ---
const ALBION_API = "https://www.albion-online-data.com/api/v2/stats"

// Popular items to track (item IDs from Albion Online)
const TRACKED_ITEMS = [
  // T8 Resources
  "T8_BAG", "T8_CAPE", "T8_HEAD_CLOTH_SET1", "T8_HEAD_CLOTH_SET2", "T8_HEAD_LEATHER_SET1", "T8_HEAD_LEATHER_SET2", "T8_HEAD_PLATE_SET1", "T8_HEAD_PLATE_SET2",
  // T8 Weapons
  "T8_ARMORED_SWORD", "T8_BROADSWORD", "T8_CLAYMORE", "T8_DUAL_SWORDS", "T8_FIRE_STAFF", "T8_FROST_STAFF", "T8_HOLY_STAFF", "T8_ARCANESTAFF", "T8_NATURE_STAFF",
  "T8_BOW", "T8_CROSSBOW", "T8_LONGBOW", "T8_WARBOW",
  "T8_DAGGER", "T8_KATAR", "T8_SHADOW_DAGGER",
  "T8_HAMMER", "T8_MACE", "T8_BATTLEAXE", "T8_HALBERD",
  "T8_QUARTERSTAFF", "T8_ESCIMITAR",
  // T7 Resources
  "T7_BAG", "T7_HEAD_CLOTH_SET1", "T7_HEAD_LEATHER_SET1", "T7_HEAD_PLATE_SET1",
  "T7_ARMORED_SWORD", "T7_BROADSWORD", "T7_CLAYMORE",
  "T7_FIRE_STAFF", "T7_FROST_STAFF", "T7_HOLY_STAFF", "T7_ARCANESTAFF", "T7_NATURE_STAFF",
  "T7_BOW", "T7_CROSSBOW", "T7_LONGBOW",
  "T7_DAGGER", "T7_HAMMER", "T7_MACE", "T7_BATTLEAXE",
  // T6 popular
  "T6_BAG", "T6_ARMORED_SWORD", "T6_FIRE_STAFF", "T6_BOW", "T6_DAGGER", "T6_HAMMER",
  // Resources & Materials
  "T8_ORE", "T8_WOOD", "T8_FIBER", "T8_HIDE", "T8_ROCK", "T8_SAND",
  "T7_ORE", "T7_WOOD", "T7_FIBER", "T7_HIDE", "T7_ROCK", "T7_SAND",
  "T6_ORE", "T6_WOOD", "T6_FIBER", "T6_HIDE",
  "T5_ORE", "T5_WOOD", "T5_FIBER", "T5_HIDE",
  // Refined materials
  "T8_METALBAR", "T8_PLANKS", "T8_CLOTH", "T8_LEATHER", "T8_STONEBLOCK",
  "T7_METALBAR", "T7_PLANKS", "T7_CLOTH", "T7_LEATHER", "T7_STONEBLOCK",
  // Refined resources
  "T8_RMETALBAR", "T8_RPLANKS", "T8_RCLOTH", "T8_RLEATHER", "T8_RSTONEBLOCK",
  // Consumables
  "T8_POTION_HEAL", "T8_POTION_ENERGY", "T8_POTION_FLEX",
  "T7_POTION_HEAL", "T7_POTION_ENERGY",
  // Food
  "T8_PORK_RIPE", "T8_CHICKEN_RIPE", "T8_BEET_RIPE", "T8_CABBAGE_RIPE", "T8_POTATO_RIPE", "T8_CORN_RIPE", "T8_MUSHROOM_RIPE",
  "T7_PORK_RIPE", "T7_CHICKEN_RIPE", "T7_BEET_RIPE", "T7_CABBAGE_RIPE",
  // Mounts
  "MOUNT_HORSE", "MOUNT_ARMORED_HORSE", "MOUNT_OX", "MOUNT_STAG",
  // Runes/Soul
  "RUNE_S3", "RUNE_S4", "RUNE_S5", "SOUL_S3", "SOUL_S4", "SOUL_S5", "RELIC_S3", "RELIC_S4", "RELIC_S5",
  // Avalonian Weapons (high demand)
  "T8_AVALONIAN_SWORD", "T8_AVALONIAN_FIRE", "T8_AVALONIAN_FROST", "T8_AVALONIAN_HOLY", "T8_AVALONIAN_ARCANE",
  "T8_AVALONIAN_NATURE", "T8_AVALONIAN_BOW", "T8_AVALONIAN_CROSSBOW",
  // Royal weapons
  "T8_ROYAL_SWORD", "T8_ROYAL_FIRE", "T8_ROYAL_FROST", "T8_ROYAL_BOW",
  // Artifact items
  "T8_ARTIFACT_SWORD", "T8_ARTIFACT_FIRE", "T8_ARTIFACT_FROST", "T8_ARTIFACT_HOLY", "T8_ARTIFACT_ARCANE",
  "T8_ARTIFACT_NATURE", "T8_ARTIFACT_BOW", "T8_ARTIFACT_CROSSBOW", "T8_ARTIFACT_DAGGER", "T8_ARTIFACT_HAMMER",
  // Cape
  "T8_CAPEMAGE", "T8_CAPERANGER", "T8_CAPEMERCENARY", "T8_CAPEINQUISITOR", "T8_CAPEVALKYRIE", "T8_CAPEHELL",
  // Books
  "T8_BOOK_UNDEAD", "T8_BOOK_DEMON", "T8_BOOK_MORGANA", "T8_BOOK_AVALON", "T8_BOOK_KEEPER",
  // Specialty items (high market activity)
  "T8_FARM_FOCUS", "T7_FARM_FOCUS",
  "T7_JOURNAL_WARRIOR", "T7_JOURNAL_MAGE", "T7_JOURNAL_HUNTER",
  "T8_JOURNAL_WARRIOR", "T8_JOURNAL_MAGE", "T8_JOURNAL_HUNTER",
]

interface MarketData {
  item_id: string
  city: string
  quality: number
  sell_price_min: number | null
  sell_price_min_date: string | null
  sell_price_max: number | null
  sell_price_max_date: string | null
  buy_price_min: number | null
  buy_price_min_date: string | null
  buy_price_max: number | null
  buy_price_max_date: string | null
}

interface GoldData {
  timestamp: number
  price: number
}

// In-memory cache
let marketCache: Map<string, MarketData[]> = new Map()
let goldCache: GoldData | null = null
let lastFetchTime = 0
const FETCH_INTERVAL = 60000 // 60 seconds
let fetchInProgress = false

// City list for main markets
const CITIES = ["Bridgewatch", "Caerleon", "Fort Sterling", "Lymhurst", "Martlock", "Thetford"]
// Black Market city
const BLACK_MARKET_CITY = "Caerleon"

function displayName(itemId: string): string {
  return itemId
    .replace(/_/g, ' ')
    .replace(/T([0-9])/, 'T$1')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

async function fetchMarketData(): Promise<void> {
  if (fetchInProgress) return
  fetchInProgress = true

  try {
    console.log(`[${new Date().toISOString()}] Fetching market data for ${TRACKED_ITEMS.length} items...`)

    // Fetch in batches of 20 (API limit)
    const batchSize = 20
    const batches: string[][] = []
    for (let i = 0; i < TRACKED_ITEMS.length; i += batchSize) {
      batches.push(TRACKED_ITEMS.slice(i, i + batchSize))
    }

    const allData: MarketData[] = []

    for (const batch of batches) {
      const itemsParam = batch.join(',')
      const url = `${ALBION_API}/prices/${itemsParam}?locations=${CITIES.join(',')}&quality=1`
      
      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000)
        })
        
        if (response.ok) {
          const data = await response.json()
          allData.push(...data)
        }
      } catch (err) {
        console.error(`Failed to fetch batch:`, err)
      }
    }

    // Organize data by item
    marketCache.clear()
    for (const item of allData) {
      const existing = marketCache.get(item.item_id) || []
      existing.push(item)
      marketCache.set(item.item_id, existing)
    }

    // Fetch gold price
    try {
      const goldUrl = `${ALBION_API}/gold?count=1`
      const goldRes = await fetch(goldUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      })
      if (goldRes.ok) {
        const goldData = await goldRes.json()
        if (goldData && goldData.length > 0) {
          goldCache = goldData[0]
        }
      }
    } catch (err) {
      console.error('Failed to fetch gold price:', err)
    }

    lastFetchTime = Date.now()
    console.log(`[${new Date().toISOString()}] Market data updated. ${marketCache.size} items loaded.`)

    // Broadcast to all connected clients
    broadcastData()
  } catch (err) {
    console.error('Error fetching market data:', err)
  } finally {
    fetchInProgress = false
  }
}

function getTopSelling(): any[] {
  const items: any[] = []

  for (const [itemId, entries] of marketCache) {
    // Sum volumes across cities
    let totalSellMin = 0
    let totalBuyMax = 0
    let bestSellPrice = Infinity
    let bestBuyPrice = 0
    let bestCity = ''
    let sellCount = 0
    let buyCount = 0

    for (const entry of entries) {
      if (entry.sell_price_min && entry.sell_price_min > 0) {
        totalSellMin += entry.sell_price_min
        sellCount++
        if (entry.sell_price_min < bestSellPrice) {
          bestSellPrice = entry.sell_price_min
          bestCity = entry.city
        }
      }
      if (entry.buy_price_max && entry.buy_price_max > 0) {
        totalBuyMax += entry.buy_price_max
        buyCount++
        if (entry.buy_price_max > bestBuyPrice) {
          bestBuyPrice = entry.buy_price_max
        }
      }
    }

    if (sellCount > 0 || buyCount > 0) {
      items.push({
        itemId,
        name: displayName(itemId),
        avgSellPrice: sellCount > 0 ? Math.round(totalSellMin / sellCount) : null,
        bestSellPrice: bestSellPrice === Infinity ? null : bestSellPrice,
        bestSellCity: bestCity || null,
        bestBuyPrice: bestBuyPrice > 0 ? bestBuyPrice : null,
        totalVolume: sellCount + buyCount, // proxy for trading activity
        cities: entries.map(e => e.city),
      })
    }
  }

  // Sort by total volume (proxy for most traded/sold)
  return items.sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 30)
}

function getBlackMarketData(): any[] {
  const items: any[] = []

  for (const [itemId, entries] of marketCache) {
    const caerleonEntry = entries.find(e => e.city === BLACK_MARKET_CITY)
    const otherEntries = entries.filter(e => e.city !== BLACK_MARKET_CITY)

    if (!caerleonEntry || !caerleonEntry.sell_price_min) continue

    // Find best non-caerleon sell price (source for black market)
    let bestSourcePrice = Infinity
    let sourceCity = ''
    for (const entry of otherEntries) {
      if (entry.sell_price_min && entry.sell_price_min < bestSourcePrice && entry.sell_price_min > 0) {
        bestSourcePrice = entry.sell_price_min
        sourceCity = entry.city
      }
    }

    if (bestSourcePrice === Infinity) continue

    const profit = caerleonEntry.sell_price_min - bestSourcePrice
    const marginPercent = bestSourcePrice > 0 ? Math.round((profit / bestSourcePrice) * 100) : 0

    items.push({
      itemId,
      name: displayName(itemId),
      blackMarketPrice: caerleonEntry.sell_price_min,
      sourcePrice: bestSourcePrice,
      sourceCity,
      profit,
      marginPercent,
      updatedAt: caerleonEntry.sell_price_min_date,
    })
  }

  // Sort by profit margin
  return items
    .filter(i => i.profit > 0)
    .sort((a, b) => b.marginPercent - a.marginPercent)
    .slice(0, 30)
}

function getTrendingItems(): any[] {
  // Items with the most market activity (most cities listing them)
  const items: any[] = []

  for (const [itemId, entries] of marketCache) {
    const activeCities = entries.filter(e => e.sell_price_min && e.sell_price_min > 0)
    const avgPrice = activeCities.length > 0
      ? Math.round(activeCities.reduce((sum, e) => sum + (e.sell_price_min || 0), 0) / activeCities.length)
      : 0
    const minPrice = activeCities.length > 0
      ? Math.min(...activeCities.map(e => e.sell_price_min || Infinity))
      : 0
    const maxPrice = activeCities.length > 0
      ? Math.max(...activeCities.map(e => e.sell_price_max || 0))
      : 0

    if (activeCities.length >= 2) {
      items.push({
        itemId,
        name: displayName(itemId),
        avgPrice,
        minPrice: minPrice === Infinity ? 0 : minPrice,
        maxPrice,
        cityCount: activeCities.length,
        spread: maxPrice - minPrice,
        cities: activeCities.map(e => ({
          city: e.city,
          sellPrice: e.sell_price_min,
          buyPrice: e.buy_price_max,
        }))
      })
    }
  }

  return items.sort((a, b) => b.cityCount - a.cityCount || b.spread - a.spread).slice(0, 25)
}

function broadcastData(): void {
  const topSelling = getTopSelling()
  const blackMarket = getBlackMarketData()
  const trending = getTrendingItems()

  const payload = {
    type: 'market-update',
    timestamp: new Date().toISOString(),
    lastFetchTime,
    gold: goldCache,
    data: {
      topSelling,
      blackMarket,
      trending,
      totalItemsTracked: marketCache.size,
    }
  }

  io.emit('market-data', payload)
  console.log(`[${new Date().toISOString()}] Broadcasted data to ${io.engine.clientsCount} clients`)
}

// --- Socket.IO handlers ---
io.on('connection', (socket) => {
  console.log(`[Client connected] ${socket.id}, total: ${io.engine.clientsCount}`)

  // Send current cached data immediately
  if (marketCache.size > 0) {
    const topSelling = getTopSelling()
    const blackMarket = getBlackMarketData()
    const trending = getTrendingItems()

    socket.emit('market-data', {
      type: 'market-update',
      timestamp: new Date().toISOString(),
      lastFetchTime,
      gold: goldCache,
      data: {
        topSelling,
        blackMarket,
        trending,
        totalItemsTracked: marketCache.size,
      }
    })
    console.log(`[Initial data sent] to ${socket.id}`)
  } else {
    // Trigger initial fetch if no cache
    fetchMarketData()
  }

  socket.on('request-refresh', () => {
    console.log(`[Manual refresh requested] by ${socket.id}`)
    fetchMarketData()
  })

  socket.on('disconnect', () => {
    console.log(`[Client disconnected] ${socket.id}, total: ${io.engine.clientsCount}`)
  })
})

// --- Start server ---
const PORT = 3005
httpServer.listen(PORT, () => {
  console.log(`Albion Market WebSocket server running on port ${PORT}`)
})

// Initial fetch
fetchMarketData()

// Auto-refresh every 60 seconds
setInterval(() => {
  fetchMarketData()
}, FETCH_INTERVAL)

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('Shutting down...')
  httpServer.close(() => process.exit(0))
})
