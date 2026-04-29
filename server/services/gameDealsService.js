function buildEpicUrl(g) {
  const slug =
    g.offerMappings?.find((m) => m.pageSlug)?.pageSlug ||
    g.catalogNs?.mappings?.find((m) => m.pageSlug)?.pageSlug ||
    g.productSlug ||
    g.urlSlug;
  return slug
    ? `https://store.epicgames.com/de/p/${slug.replace(/\/home$/, '')}`
    : 'https://store.epicgames.com/de/free-games';
}

async function fetchEpic() {
  const r = await fetch(
    'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=de&country=DE&allowCountries=DE',
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  );
  if (!r.ok) throw new Error(`Epic ${r.status}`);
  const data = await r.json();
  const elements = data?.data?.Catalog?.searchStore?.elements ?? [];
  return elements
    .filter((g) => {
      const o = g.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
      return o && o.discountSetting?.discountPercentage === 0;
    })
    .map((g) => {
      const o = g.promotions.promotionalOffers[0].promotionalOffers[0];
      const image =
        g.keyImages?.find((i) =>
          ['OfferImageWide', 'DieselStoreFrontWide', 'Thumbnail'].includes(i.type),
        )?.url ||
        g.keyImages?.[0]?.url ||
        '';
      return {
        id: g.id,
        title: g.title,
        image,
        originalPrice: g.price?.totalPrice?.fmtPrice?.originalPrice ?? '',
        endDate: o.endDate,
        url: buildEpicUrl(g),
        platform: 'epic',
      };
    });
}

async function fetchSteam() {
  const r = await fetch(
    'https://store.steampowered.com/search/results/?maxprice=free&specials=1&json=1&infinite=1&cc=de&l=german',
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } },
  );
  if (!r.ok) throw new Error(`Steam ${r.status}`);
  const { results_html: html = '' } = await r.json();
  const rows = html.split(
    /(?=<a\s+href="https:\/\/store\.steampowered\.com\/(?:app|sub|bundle)\/)/,
  );
  const out = [];
  for (const row of rows) {
    const href = row.match(/href="([^"]+)"/)?.[1];
    const title = row.match(/<span class="title">([^<]+)<\/span>/)?.[1];
    const discount = Number(row.match(/data-discount="(\d+)"/)?.[1] ?? -1);
    const finalPrice = Number(row.match(/data-price-final="(\d+)"/)?.[1] ?? -1);
    if (!href || !title || discount !== 100 || finalPrice !== 0) continue;
    out.push({
      id: row.match(/data-ds-(?:appid|bundleid|packageid)="(\d+)"/)?.[1] ?? href,
      title: title.trim(),
      image: row.match(/<div class="search_capsule"><img src="([^"]+)"/)?.[1] ?? '',
      originalPrice:
        row.match(/<div class="discount_original_price">([^<]+)<\/div>/)?.[1]?.trim() ?? '',
      endDate: null,
      url: href.split('?')[0],
      platform: 'steam',
    });
  }
  return out;
}

let cachedDeals = null;
let lastFetchTime = 0;
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

async function getDeals(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedDeals && now - lastFetchTime < CACHE_MS) {
    return cachedDeals;
  }

  const [epicResult, steamResult] = await Promise.allSettled([fetchEpic(), fetchSteam()]);
  const errors = {};
  if (epicResult.status === 'rejected') errors.epic = String(epicResult.reason);
  if (steamResult.status === 'rejected') errors.steam = String(steamResult.reason);

  cachedDeals = {
    epic: epicResult.status === 'fulfilled' ? epicResult.value : [],
    steam: steamResult.status === 'fulfilled' ? steamResult.value : [],
    fetchedAt: new Date().toISOString(),
    errors,
  };
  lastFetchTime = now;
  return cachedDeals;
}

module.exports = {
  getDeals,
  fetchEpic,
  fetchSteam,
};
