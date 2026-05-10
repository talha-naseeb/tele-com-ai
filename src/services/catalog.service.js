import { CoverageArea, Offer, PackageCatalog } from '../models/index.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {{ type?: string, category?: string }} filters */
export async function getPackages(filters = {}) {
  const query = {};
  const type = filters.type?.toLowerCase()?.trim();
  if (type && ['prepaid', 'postpaid', 'internet', 'data'].includes(type)) {
    query.type = type;
  }

  let rows = await PackageCatalog.find(query).sort({ sort_order: 1, name: 1 }).lean();

  const category = filters.category?.toLowerCase()?.trim();
  if (category) {
    const synonyms = {
      gaming: ['gaming', 'game'],
      streaming: ['streaming', 'stream', 'video'],
      social: ['social', 'chat', 'messaging']
    };
    const needles = synonyms[category] || [category];
    rows = rows.filter((p) =>
      (p.categories || []).some((c) =>
        needles.some((n) => String(c).toLowerCase().includes(n))
      )
    );
  }

  const packages = rows.map((p) => ({
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    type: p.type,
    categories: p.categories || [],
    data_gb: p.data_gb,
    price_monthly_aed: Number(p.price_monthly_aed),
    currency: p.currency || 'AED',
    description: p.description,
    sort_order: p.sort_order
  }));

  return { count: packages.length, packages };
}

export async function getOffers() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await Offer.find({ active: { $ne: false } })
    .sort({ created_at: -1 })
    .lean();

  const active = rows.filter((o) => {
    if (!o.valid_until) return true;
    return new Date(o.valid_until) >= todayStart;
  });

  const offers = active.map((o) => ({
    id: o._id.toString(),
    title: o.title,
    description: o.description,
    valid_until: o.valid_until instanceof Date ? o.valid_until.toISOString().slice(0, 10) : o.valid_until,
    discount_percent: o.discount_percent ?? null,
    promo_code: o.promo_code ?? null
  }));

  return { count: offers.length, offers };
}

/** @param {{ city: string, area?: string, serviceType?: string }} params */
export async function getCoverage(params) {
  const cityRaw = params.city?.trim();
  if (!cityRaw) {
    return { found: false, message: 'Query parameter city is required.' };
  }

  const cityRe = new RegExp(`^${escapeRegex(cityRaw)}$`, 'i');
  const baseQuery = { city: cityRe };

  let candidates = await CoverageArea.find(baseQuery).lean();

  const areaRaw = params.area?.trim();
  if (areaRaw && candidates.length > 1) {
    const areaRe = new RegExp(escapeRegex(areaRaw), 'i');
    const narrowed = candidates.filter((c) => areaRe.test(c.area || ''));
    if (narrowed.length) {
      candidates = narrowed;
    }
  }

  const row = candidates[0];
  if (!row) {
    return {
      found: false,
      city: cityRaw,
      message: 'No coverage record found for this location. Try another city or area.'
    };
  }

  const serviceType = params.serviceType?.toLowerCase()?.trim();
  let serviceSummary = '';
  if (serviceType === 'fiber') {
    serviceSummary = row.fiber_available
      ? 'Fiber is available in this area.'
      : 'Fiber is not yet available; 4G/5G may apply.';
  } else if (serviceType === '5g' || serviceType === '5G') {
    serviceSummary = row.five_g_available
      ? '5G service is available.'
      : '5G may be limited in parts of this area.';
  } else if (serviceType === '4g' || serviceType === '4G') {
    serviceSummary = row.four_g_available ? '4G coverage is available.' : '4G coverage may vary.';
  }

  return {
    found: true,
    city: row.city,
    area: row.area || null,
    fiber_available: row.fiber_available,
    five_g_available: row.five_g_available,
    four_g_available: row.four_g_available,
    notes: row.notes || '',
    ...(serviceSummary ? { service_summary: serviceSummary } : {})
  };
}
