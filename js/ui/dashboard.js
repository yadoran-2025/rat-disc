/**
 * 대시보드 메인 화면 렌더링
 */
export async function showDashboard() {
  document.body.innerHTML = "";
  document.body.style.background = ""; 

  let config = { dashboard: {}, lessons: [], tools: [] };
  try {
    const res = await fetch(`lessons/index.json?_=${Date.now()}`);
    if (res.ok) config = await res.json();
  } catch (err) {
    console.error("대시보드 설정 로드 실패:", err);
  }

  const { dashboard, lessons, tools } = config;

  const container = document.createElement("div");
  container.className = "dashboard";

  const inner = document.createElement("div");
  inner.className = "dashboard__inner";

  // 헤더
  const header = document.createElement("header");
  header.className = "dashboard__header";

  let logoHTML = dashboard.logo || "🛵";
  if (dashboard.logo === "scooter-pictogram") {
    logoHTML = `
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--brand);">
        <circle cx="6" cy="18" r="2.5"></circle>
        <circle cx="18" cy="18" r="2.5"></circle>
        <path d="M6 15.5V11l2-2h3.5l1.5 1.5v5"></path>
        <path d="M10 9V5h3"></path>
      </svg>
    `;
  }

  header.innerHTML = `
    <div class="dashboard__logo">${logoHTML}</div>
    <h1 class="dashboard__title">${dashboard.title || "사회교육플랫폼 BOOONG"}</h1>
    <p class="dashboard__subtitle">${dashboard.subtitle || "스마트 수업 프리젠터"}</p>
  `;
  inner.appendChild(header);

  // 수업 목록 섹션
  if (lessons && lessons.length > 0) {
    const lessonSection = document.createElement("section");
    lessonSection.className = "dashboard__section";
    lessonSection.innerHTML = `<h2 class="dashboard__section-title">수업 목록</h2>`;
    
    const lessonGrid = document.createElement("div");
    lessonGrid.className = "dashboard__grid";

    lessons.forEach(l => {
      const card = document.createElement("a");
      card.className = "dash-card";
      card.href = `?lesson=${l.id}`;
      card.innerHTML = `
        <div class="dash-card__tag">${l.group}</div>
        <h3 class="dash-card__title">${l.title}</h3>
        <p class="dash-card__desc">${l.desc}</p>
        <div class="dash-card__footer">수업 입장 <span class="dash-card__arrow">→</span></div>
      `;
      lessonGrid.appendChild(card);
    });
    lessonSection.appendChild(lessonGrid);
    inner.appendChild(lessonSection);
  }

  // 도구 섹션
  if (tools && tools.length > 0) {
    const toolSection = document.createElement("section");
    toolSection.className = "dashboard__section";
    toolSection.innerHTML = `<h2 class="dashboard__section-title">도구 및 가이드</h2>`;

    const toolGrid = document.createElement("div");
    toolGrid.className = "dashboard__grid";

    tools.forEach(t => {
      const card = document.createElement("a");
      card.className = `dash-card dash-card--${t.type || 'tool'}`;
      card.href = t.link;
      card.innerHTML = `
        <div class="dash-card__tag">${t.tag}</div>
        <h3 class="dash-card__title">${t.title}</h3>
        <p class="dash-card__desc">${t.desc}</p>
        <div class="dash-card__footer">${t.type === 'guide' ? '가이드 열기' : '이동하기'} <span class="dash-card__arrow">→</span></div>
      `;
      toolGrid.appendChild(card);
    });

    toolSection.appendChild(toolGrid);
    inner.appendChild(toolSection);
  }

  container.appendChild(inner);
  document.body.appendChild(container);
}
