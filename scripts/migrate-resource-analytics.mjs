import { parseCSV } from "../js/api.js";

const GROUP_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRqcg9kXgh8lcmeTO9xwQJKjqSQt6IotKtDHEbxj0YOpQ1V_TC3xSA3YoB4lcIr01g2FoiNapJfI8Wg/pub?gid=1091433397&single=true&output=csv";
const DATABASE_URL = "https://yadoran-2025-default-rtdb.firebaseio.com";
const apply = process.argv.includes("--apply");

const [sheetText, analytics, allVisitors] = await Promise.all([
  fetch(`${GROUP_SHEET_URL}&_=${Date.now()}`, { cache: "no-store" }).then(requireOk).then(response => response.text()),
  fetchJson("analytics/groupClicks"),
  fetchJson("analytics/groupClickVisitors"),
]);
const resourcesByTitle = new Map(readPublishedResources(sheetText).map(resource => [resource.title, resource]));
const migrations = Object.values(analytics || {})
  .map(source => ({ source, target: resourcesByTitle.get(source.title) }))
  .filter(({ source, target }) => target && source.groupId && source.groupId !== target.id);

console.table(migrations.map(({ source, target }) => ({
  title: source.title,
  from: source.groupId,
  to: target.id,
  views: Number(source.views) || 0,
  clicks: Number(source.totalClicks) || 0,
})));

if (!apply) {
  console.log(`Dry run: ${migrations.length} analytics records. Re-run with --apply to copy them without deleting the originals.`);
  process.exit(0);
}

for (const { source, target } of migrations) {
  const targetStats = await fetchJson(`analytics/groupClicks/${target.id}`) || {};
  const sourceVisitors = (allVisitors || {})[source.groupId] || {};
  const targetVisitors = (allVisitors || {})[target.id] || {};
  const alreadyCopied = Number(targetStats.views) >= (Number(source.views) || 0)
    && Number(targetStats.totalClicks) >= (Number(source.totalClicks) || 0)
    && Number(targetStats.visitorCount) >= Object.keys(sourceVisitors).length
    && Object.keys(sourceVisitors).every(visitorId => targetVisitors[visitorId]);
  if (alreadyCopied) continue;
  const mergedVisitors = mergeVisitors(sourceVisitors, targetVisitors);

  await patchJson(`analytics/groupClicks/${target.id}`, {
    groupId: target.id,
    title: source.title,
    type: source.type || "group",
    lastHref: source.lastHref || "",
    lastActionKey: source.lastActionKey || "",
    updatedAt: Date.now(),
  });
  await Promise.all(Object.entries(mergedVisitors).map(([visitorId, value]) => putJson(`analytics/groupClickVisitors/${target.id}/${visitorId}`, value)));
  await increment(`analytics/groupClicks/${target.id}/views`, Math.max(0, (Number(source.views) || 0) - (Number(targetStats.views) || 0)));
  await increment(`analytics/groupClicks/${target.id}/totalClicks`, Math.max(0, (Number(source.totalClicks) || 0) - (Number(targetStats.totalClicks) || 0)));
  const desiredVisitors = Object.keys(mergedVisitors).length;
  await increment(`analytics/groupClicks/${target.id}/visitorCount`, Math.max(0, desiredVisitors - (Number(targetStats.visitorCount) || 0)));
}

console.log(`Migrated ${migrations.length} analytics records; original records were retained for rollback.`);

function readPublishedResources(text) {
  const rows = parseCSV(text).filter(row => row.some(cell => String(cell || "").trim()));
  const headers = (rows.shift() || []).map(value => String(value || "").trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.map(row => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()])))
    .filter(row => String(row.published).toLowerCase() === "true")
    .map(row => {
      const unitCodes = String(row["단원_코드"] || "").split(/[,;\n]+/).map(value => Number(value.trim())).filter(Number.isSafeInteger);
      return { title: row.group_title, id: createResourceId(row.resource_id, row.group_title, unitCodes) };
    });
}

function createResourceId(resourceId, title, unitCodes) {
  const explicitId = String(resourceId || "").normalize("NFKC").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 96);
  if (explicitId) return explicitId.startsWith("resource-") ? explicitId : `resource-${explicitId}`;
  const slug = String(title || "resource").normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return ["resource", slug || "untitled", ...unitCodes].join("-");
}

function mergeVisitors(source, target) {
  const result = { ...target };
  Object.entries(source).forEach(([visitorId, sourceValue]) => {
    const targetValue = result[visitorId];
    result[visitorId] = targetValue ? {
      ...targetValue,
      count: (Number(sourceValue.count) || 0) + (Number(targetValue.count) || 0),
      firstClickedAt: Math.min(Number(sourceValue.firstClickedAt) || Infinity, Number(targetValue.firstClickedAt) || Infinity),
      lastClickedAt: Math.max(Number(sourceValue.lastClickedAt) || 0, Number(targetValue.lastClickedAt) || 0),
    } : sourceValue;
  });
  return result;
}

async function increment(path, amount) {
  for (let count = 0; count < amount; count += 1) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = Number(await fetchJson(path)) || 0;
      const response = await fetch(`${DATABASE_URL}/${path}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current + 1) });
      if (response.ok) break;
      if (attempt === 2) throw new Error(`Could not increment ${path}: ${response.status}`);
    }
  }
}

async function fetchJson(path) {
  return fetch(`${DATABASE_URL}/${path}.json`).then(requireOk).then(response => response.json());
}

async function patchJson(path, value) {
  return fetch(`${DATABASE_URL}/${path}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }).then(requireOk);
}

async function putJson(path, value) {
  return fetch(`${DATABASE_URL}/${path}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }).then(requireOk);
}

function requireOk(response) {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}
