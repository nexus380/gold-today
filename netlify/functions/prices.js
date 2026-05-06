/**
 * prices.js — Production Multi-Source Metals API
 * ─────────────────────────────────────────────────────
 * Priority order (auto-failover):
 *  1. GoldAPI.io       — primary, tracks daily quota
 *  2. Yahoo Finance    — free futures (GC=F, SI=F, PL=F)
 *  3. Metals-API       — free, no key
 *  4. Swissquote       — free public quotes
 *  5. Fawaz/CDN        — last resort
 *  6. Cached data      — last known good
 *  7. Static fallback  — never fails
 *
 * Currency sources:
 *  1. open.er-api.com
 *  2. frankfurter.app  (European Central Bank)
 *  3. fawaz CDN rates
 */

'use strict';

// ─── CACHE ────────────────────────────────────────────────────────────────────
const cache = {
  metals:   { data: null, ts: 0, ttl: 60_000  },  // 60s
  currency: { data: null, ts: 0, ttl: 600_000 },  // 10min
};

function isFresh(e) {
  return e.data !== null && (Date.now() - e.ts) < e.ttl;
}

// ─── GOLDAPI QUOTA TRACKER ────────────────────────────────────────────────────
const quota = {
  date: '', count: 0, limit: 85,  // safety margin under 100/day
  canUse() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.date !== today) { this.date = today; this.count = 0; }
    return this.count < this.limit;
  },
  use() { this.count++; },
};

// ─── SAFE STATIC FALLBACK (update monthly) ────────────────────────────────────
const FALLBACK = {
  gold:     { ounce_usd: 3300.00, ch: 0, chp: 0 },
  silver:   { ounce_usd: 33.50,   ch: 0, chp: 0 },
  platinum: { ounce_usd: 990.00,  ch: 0, chp: 0 },
};

const FALLBACK_FX = { usd_to_egp: 50.50, usd_to_sar: 3.75, usd_to_aed: 3.67 };

// Confidence score per source (0–100)
const CONFIDENCE = {
  goldapi: 100, yahoo: 88, metals_api: 85,
  swissquote: 82, fawaz: 78, cache: 65, fallback: 0,
};

const OZ = 31.1035;

// ─── SAFE FETCH ───────────────────────────────────────────────────────────────
async function go(url, opts = {}, ms = 7000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── SANITY CHECK ─────────────────────────────────────────────────────────────
const RANGES = {
  XAU: [1500, 10000],
  XAG: [10,   500  ],
  XPT: [300,  5000 ],
};

function sane(sym, price) {
  const [lo, hi] = RANGES[sym] || [0, Infinity];
  if (price < lo || price > hi) throw new Error(`${sym} price ${price} out of range [${lo}–${hi}]`);
  return price;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 1 — GoldAPI.io  (100 req/day free, tracks quota)
// ═══════════════════════════════════════════════════════════════════════════════
async function src_goldapi(sym) {
  const key = process.env.GOLDAPI_KEY;
  if (!key)              throw new Error('No GOLDAPI_KEY');
  if (!quota.canUse())   throw new Error(`GoldAPI quota reached (${quota.count}/${quota.limit})`);

  const d = await go(
    `https://www.goldapi.io/api/${sym}/USD`,
    { headers: { 'x-access-token': key, 'Content-Type': 'application/json' } }
  );
  if (!d?.price) throw new Error('GoldAPI: no price field');
  quota.use();
  return { ounce_usd: sane(sym, d.price), ch: d.ch || 0, chp: d.chp || 0, source: 'goldapi' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 2 — Yahoo Finance  (free futures, no key)
// ═══════════════════════════════════════════════════════════════════════════════
const YTICK = { XAU: 'GC=F', XAG: 'SI=F', XPT: 'PL=F' };

async function src_yahoo(sym) {
  const tick = YTICK[sym];
  if (!tick) throw new Error(`Yahoo: no ticker for ${sym}`);

  let d;
  try {
    d = await go(
      `https://query1.finance.yahoo.com/v8/finance/chart/${tick}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
  } catch {
    d = await go(
      `https://query2.finance.yahoo.com/v8/finance/chart/${tick}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
  }

  const meta = d?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('Yahoo: no meta');

  const price = meta.regularMarketPrice || meta.chartPreviousClose;
  const prev  = meta.previousClose || meta.chartPreviousClose || price;
  if (!price || price <= 0) throw new Error('Yahoo: invalid price');

  return {
    ounce_usd: sane(sym, price),
    ch:  price - prev,
    chp: prev ? ((price - prev) / prev) * 100 : 0,
    source: 'yahoo',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 3 — MetalPriceAPI.com  (free, no key)
// ═══════════════════════════════════════════════════════════════════════════════
async function src_metalpriceapi(sym) {
  const d = await go(
    `https://api.metalpriceapi.com/v1/latest?api_key=goldprice&base=USD&currencies=${sym}`,
    {}, 6000
  );
  if (!d?.rates?.[sym]) throw new Error('MetalPriceAPI: no rate');
  const price = 1 / d.rates[sym];
  return { ounce_usd: sane(sym, price), ch: 0, chp: 0, source: 'metals_api' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 4 — Swissquote public quotes  (free, no key)
// ═══════════════════════════════════════════════════════════════════════════════
async function src_swissquote(sym) {
  const d = await go(
    `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${sym}/USD`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }, 6000
  );
  if (!Array.isArray(d) || !d[0]?.spreadProfilePrices) throw new Error('Swissquote: bad format');
  const quotes = d[0].spreadProfilePrices;
  const q      = quotes.find(x => x.spreadProfile === 'Prime') || quotes[0];
  const price  = q?.bid || q?.ask;
  if (!price || price <= 0) throw new Error('Swissquote: no price');
  return { ounce_usd: sane(sym, price), ch: 0, chp: 0, source: 'swissquote' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 5 — Fawaz CDN rates (last resort, converts from USD base)
// ═══════════════════════════════════════════════════════════════════════════════
// XAU/USD, XAG/USD, XPT/USD are available as currency pairs in Fawaz
async function src_fawaz(sym) {
  const pair = sym.toLowerCase();
  const d    = await go(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${pair}.json`,
    {}, 6000
  );
  // Fawaz gives rate relative to 1 unit of metal in USD
  const priceInUSD = d?.[pair]?.usd;
  if (!priceInUSD || priceInUSD <= 0) throw new Error('Fawaz: no price');
  return { ounce_usd: sane(sym, priceInUSD), ch: 0, chp: 0, source: 'fawaz' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH ONE METAL — waterfall through all sources
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchMetal(sym) {
  const sources = [src_goldapi, src_yahoo, src_metalpriceapi, src_swissquote, src_fawaz];
  const errors  = [];

  for (const fn of sources) {
    try {
      return await fn(sym);
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(`All sources failed for ${sym}: ${errors.join(' | ')}`);
}

// ─── FETCH ALL METALS ─────────────────────────────────────────────────────────
async function getMetals() {
  if (isFresh(cache.metals)) return { ...cache.metals.data, fromCache: true };

  const syms    = ['XAU', 'XAG', 'XPT'];
  const keys    = ['gold', 'silver', 'platinum'];
  const results = {};
  let   mainSrc = 'fallback', conf = 0, estimated = false;

  await Promise.all(syms.map(async (sym, i) => {
    const key = keys[i];
    try {
      const d    = await fetchMetal(sym);
      results[key] = d;
      if (i === 0) { mainSrc = d.source; conf = CONFIDENCE[d.source] || 0; }
    } catch {
      const last   = cache.metals.data?.[key];
      results[key] = last || { ...FALLBACK[key], source: 'fallback' };
      estimated    = true;
      if (i === 0) conf = last ? CONFIDENCE.cache : 0;
    }
  }));

  const data = { ...results, source: mainSrc, confidence: conf, isEstimated: estimated };
  cache.metals = { data, ts: Date.now(), ttl: cache.metals.ttl };
  return { ...data, fromCache: false };
}

// ─── FETCH CURRENCY ───────────────────────────────────────────────────────────
async function getCurrency() {
  if (isFresh(cache.currency)) return cache.currency.data;

  const fxSources = [
    async () => {
      const d = await go('https://open.er-api.com/v6/latest/USD');
      if (!d?.rates) throw new Error('er-api: no rates');
      return { usd_to_egp: d.rates.EGP, usd_to_sar: d.rates.SAR, usd_to_aed: d.rates.AED };
    },
    async () => {
      const d = await go('https://api.frankfurter.app/latest?from=USD&to=EGP,SAR,AED');
      if (!d?.rates) throw new Error('frankfurter: no rates');
      return { usd_to_egp: d.rates.EGP, usd_to_sar: d.rates.SAR, usd_to_aed: d.rates.AED };
    },
    async () => {
      const d = await go('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      if (!d?.usd) throw new Error('fawaz: no usd');
      return { usd_to_egp: d.usd.egp, usd_to_sar: d.usd.sar, usd_to_aed: d.usd.aed };
    },
  ];

  for (const fn of fxSources) {
    try {
      const r = await fn();
      if (r.usd_to_egp > 20 && r.usd_to_egp < 200) {
        cache.currency = { data: r, ts: Date.now(), ttl: cache.currency.ttl };
        return r;
      }
    } catch { /* try next */ }
  }
  return cache.currency.data || FALLBACK_FX;
}

// ─── BUILD RESPONSE ───────────────────────────────────────────────────────────
function buildResponse(metals, fx) {
  const gl = oz => {
    const g = oz / OZ;
    return { egp: g * fx.usd_to_egp, sar: g * fx.usd_to_sar, aed: g * fx.usd_to_aed };
  };
  const r  = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const ro = obj => ({ egp: r(obj.egp, 2), sar: r(obj.sar, 3), aed: r(obj.aed, 3) });

  const g24 = gl(metals.gold.ounce_usd);
  const g21 = { egp: g24.egp * 0.875, sar: g24.sar * 0.875, aed: g24.aed * 0.875 };
  const g18 = { egp: g24.egp * 0.75,  sar: g24.sar * 0.75,  aed: g24.aed * 0.75  };

  return {
    gold: {
      ounce_usd: r(metals.gold.ounce_usd),
      ch:  r(metals.gold.ch),
      chp: r(metals.gold.chp, 3),
      gram_24: ro(g24), gram_21: ro(g21), gram_18: ro(g18),
    },
    silver: {
      ounce_usd: r(metals.silver.ounce_usd, 3),
      ch: r(metals.silver.ch, 3), chp: r(metals.silver.chp, 3),
      gram: ro(gl(metals.silver.ounce_usd)),
    },
    platinum: {
      ounce_usd: r(metals.platinum.ounce_usd),
      ch: r(metals.platinum.ch), chp: r(metals.platinum.chp, 3),
      gram: ro(gl(metals.platinum.ounce_usd)),
    },
    currency: {
      usd_to_egp: r(fx.usd_to_egp, 4),
      usd_to_sar: r(fx.usd_to_sar, 4),
      usd_to_aed: r(fx.usd_to_aed, 4),
    },
    meta: {
      source:       metals.source,
      confidence:   metals.confidence || 0,
      from_cache:   metals.fromCache  || false,
      is_estimated: metals.isEstimated || false,
      quota_used:   quota.count,
      last_updated: new Date().toISOString(),
    },
  };
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  try {
    const [metals, fx] = await Promise.all([getMetals(), getCurrency()]);
    return {
      statusCode: 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=55, s-maxage=55',
      },
      body: JSON.stringify(buildResponse(metals, fx)),
    };
  } catch (err) {
    // Absolute last resort — never expose error to frontend
    const payload = buildResponse(
      { ...FALLBACK, gold: { ...FALLBACK.gold, source: 'fallback' },
        silver: { ...FALLBACK.silver, source: 'fallback' },
        platinum: { ...FALLBACK.platinum, source: 'fallback' },
        source: 'fallback', confidence: 0, isEstimated: true, fromCache: false },
      cache.currency.data || FALLBACK_FX
    );
    payload.meta.is_estimated = true;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(payload),
    };
  }
};
