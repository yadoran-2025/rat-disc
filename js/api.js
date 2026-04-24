import { app } from "./state.js";

/**
 * 외부 구글 시트 에셋 로드
 */
export async function loadExternalAssets() {
  const SHEET_URLS = [
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8z4eMwA6UaQLgnZTtj7Xk7-EzBagOfK8YDGUvfogcIa1RV_3h07ggcI2nbN93JbFFdciC9A6uph_4/pub?output=csv",
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYkmQF4OJAcQN2FXGrmjYZP1Kr4geSX3t3O2ArB0_ntOqbvfgRzuoRwKSG--c3czenNUzyBVpW_f1R/pub?output=csv"
  ];

  if (!app.lesson.assets) app.lesson.assets = {};

  for (const url of SHEET_URLS) {
    try {
      const response = await fetch(`${url}&_=${Date.now()}`, { cache: "no-store" });
      const csvText = await response.text();
      
      parseCSV(csvText).forEach(columns => {
        if (columns.length < 4) return;
        const key = columns[1].trim();
        const assetUrl = columns[3].trim();
        
        if (!key || !assetUrl || key === "JSON 상 호칭" || key === "JSON 코드") return;
        app.lesson.assets[key] = assetUrl;
      });
    } catch (err) {
      console.warn(`Failed to load external assets from ${url}:`, err);
    }
  }
}

/**
 * 간단한 CSV 파서
 */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') {
      if (inQ && n === '"') { field += '"'; i++; } else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      row.push(field); field = "";
    } else if ((c === '\r' || c === '\n') && !inQ) {
      if (c === '\r' && n === '\n') i++;
      row.push(field); rows.push(row);
      row = []; field = "";
    } else { field += c; }
  }
  if (row.length || field) { row.push(field); rows.push(row); }
  return rows;
}
