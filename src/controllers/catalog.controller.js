import { getCoverage, getOffers, getPackages } from '../services/catalog.service.js';
import {
  firstQueryParam,
  validateCoverageFields,
  validatePackageFilters
} from '../utils/route-helpers.js';

export async function listPackagesGet(req, res) {
  const type = firstQueryParam(req.query.type);
  const category = firstQueryParam(req.query.category);
  const v = validatePackageFilters(type, category);
  if (!v.ok) return res.status(v.status).json(v.body);
  const data = await getPackages(v.params);
  res.json(data);
}

export async function listPackagesPost(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const v = validatePackageFilters(body.type, body.category);
  if (!v.ok) return res.status(v.status).json(v.body);
  const data = await getPackages(v.params);
  res.json(data);
}

export async function listOffers(_req, res) {
  const data = await getOffers();
  res.json(data);
}

export async function checkCoverageGet(req, res) {
  const city = firstQueryParam(req.query.city);
  const area = firstQueryParam(req.query.area);
  const serviceType = firstQueryParam(req.query.serviceType);
  const v = validateCoverageFields({ city: city ?? '', area, serviceType });
  if (!v.ok) return res.status(v.status).json(v.body);
  const data = await getCoverage(v.params);
  res.status(data.found ? 200 : 404).json(data);
}

export async function checkCoveragePost(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const v = validateCoverageFields({ city: body.city, area: body.area, serviceType: body.serviceType });
  if (!v.ok) return res.status(v.status).json(v.body);
  const data = await getCoverage(v.params);
  res.status(data.found ? 200 : 404).json(data);
}
