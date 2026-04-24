import { app } from "../state.js";
import { formatInline, escapeHtml, parseExamTitle, extractYouTubeId } from "../utils.js";
import { attachFocusAffordance, openImageLightbox } from "./components.js";
import { buildCommentSection } from "./comments.js";

/**
 * 블록 디스패처: 타입에 맞는 렌더러 호출
 */
export function renderBlock(block, blockIdx) {
  const map = {
    paragraph: renderParagraph,
    heading: renderHeading,
    case: renderCase,
    question: renderQuestion,
    concept: renderConcept,
    "figure-concept": renderFigureConcept,
    "figure-quote": renderFigureQuote,
    "image-row": renderImageRow,
    "quiz-accordion": renderQuizAccordion,
    expandable: renderExpandable,
    summary: renderSummary,
    media: renderMedia,
    divider: renderDivider,
  };
  const fn = map[block.type];
  if (!fn) { console.warn("Unknown block type:", block.type); return null; }
  return fn(block, blockIdx);
}

/* ── 개별 블록 렌더러 ── */

function renderParagraph(block) {
  const p = document.createElement("p");
  p.className = "block paragraph";
  p.innerHTML = formatInline(block.text);
  return p;
}

function renderHeading(block) {
  const h = document.createElement("h2");
  h.className = "block section-sub-heading";
  h.innerHTML = formatInline(block.text);
  return h;
}

function renderImageRow(block) {
  const row = document.createElement("div");
  row.className = "block image-row";
  block.images.forEach(src => {
    const wrap = document.createElement("div");
    wrap.className = "image-row__item";
    wrap.appendChild(buildImage(src));
    row.appendChild(wrap);
  });
  return row;
}

function renderCase(block, blockIdx) {
  const div = document.createElement("div");
  div.className = "block callout case";
  let html = "";
  if (block.label) html += `<div class="callout__label">${escapeHtml(block.label)}</div>`;
  html += `<div class="case__text">${formatInline(block.text)}</div>`;
  if (block.sub) html += `<div class="case__sub">${formatInline(block.sub)}</div>`;
  div.innerHTML = html;
  if (block.answer) div.appendChild(buildAnswer(block.answer));

  if (!block.comments) return div;

  const lessonId = app.lesson.id || app.lesson.title || "lesson";
  const sectionId = app.lesson.sections[app.currentIdx]?.id || `sec${app.currentIdx}`;
  const bIdx = (blockIdx !== undefined) ? blockIdx : 0;
  const commentKey = `${lessonId}__${sectionId}__b${bIdx}__p0`;

  const wrapper = document.createElement("div");
  wrapper.className = "case-with-comments";
  div.classList.remove("block"); 
  wrapper.appendChild(div);
  wrapper.appendChild(buildCommentSection(commentKey, "case"));
  return wrapper;
}

function renderQuestion(block, blockIdx) {
  const lessonId = app.lesson.id || app.lesson.title || "lesson";
  const sectionId = app.lesson.sections[app.currentIdx]?.id || `sec${app.currentIdx}`;
  const bIdx = (blockIdx !== undefined) ? blockIdx : 0;

  const div = document.createElement("div");
  div.className = "block callout question";
  div.innerHTML = `<div class="callout__label">🗨️ 생각해볼 문제</div>`;

  const commentSections = [];

  block.prompts.forEach((pr, promptIdx) => {
    const p = document.createElement("div");
    p.className = "question__prompt";
    p.innerHTML = `Q. ${formatInline(pr.q)}`;
    if (pr.note) p.innerHTML += `<div class="question__note">${formatInline(pr.note)}</div>`;
    div.appendChild(p);

    if (pr.answer) div.appendChild(buildAnswer({ text: pr.answer }, "답 보기"));

    if (block.comments) {
      const commentKey = `${lessonId}__${sectionId}__b${bIdx}__p${promptIdx}`;
      commentSections.push({ key: commentKey, label: block.prompts.length > 1 ? `💬 Q${promptIdx + 1} 학생 답변 보기` : "💬 학생 답변 보기" });
    }
  });

  if (block.imagePair) div.appendChild(buildImagePair(block.imagePair));
  if (block.conclusion) {
    const concl = document.createElement("div");
    concl.className = "question__conclusion";
    concl.innerHTML = formatInline(block.conclusion);
    div.appendChild(concl);
  }

  if (!block.comments) return div;

  const outer = document.createElement("div");
  outer.className = "question-with-comments";
  div.classList.remove("block"); 
  outer.appendChild(div);

  commentSections.forEach(({ key, label }) => {
    const cs = buildCommentSection(key, "question");
    cs.querySelector(".comment-section__toggle").textContent = label;
    outer.appendChild(cs);
  });

  return outer;
}

function renderConcept(block) {
  const div = document.createElement("div");
  div.className = "block callout concept";
  let html = "";
  if (block.title) html += `<div class="concept__title">💡 ${escapeHtml(block.title)}</div>`;
  if (block.body) html += `<div class="concept__body">${formatInline(block.body)}</div>`;
  if (block.bullets) {
    html += `<ul class="concept__bullets">`;
    block.bullets.forEach(b => { html += `<li>${formatInline(b)}</li>`; });
    html += `</ul>`;
  }
  div.innerHTML = html;
  if (block.image) {
    const img = buildImage(block.image);
    img.style.marginTop = "1rem";
    div.appendChild(img);
  }
  return div;
}

function renderFigureConcept(block) {
  const div = document.createElement("div");
  div.className = "block figure-row";
  const left = document.createElement("div");
  left.className = "figure-row__image-wrap";
  left.appendChild(buildImage(block.figure.image, block.figure.caption));
  if (block.figure.caption) {
    const cap = document.createElement("div");
    cap.className = "figure-row__caption";
    cap.textContent = block.figure.caption;
    left.appendChild(cap);
  }
  const right = document.createElement("div");
  right.className = "callout concept";
  right.style.margin = "0";
  right.innerHTML = `
    <div class="concept__title">💡 ${escapeHtml(block.concept.title)}</div>
    <div class="concept__body">${formatInline(block.concept.body)}</div>
  `;
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function renderFigureQuote(block) {
  const div = document.createElement("div");
  div.className = "block figure-row";
  const left = document.createElement("div");
  left.className = "figure-row__image-wrap";
  left.appendChild(buildImage(block.figure.image, block.figure.caption));
  if (block.figure.caption) {
    const cap = document.createElement("div");
    cap.className = "figure-row__caption";
    cap.textContent = block.figure.caption;
    left.appendChild(cap);
  }
  const right = document.createElement("div");
  const q = document.createElement("div");
  q.className = "figure-row__quote";
  q.innerHTML = formatInline(block.quote);
  right.appendChild(q);
  if (block.note) {
    const n = document.createElement("div");
    n.className = "figure-row__note";
    n.innerHTML = formatInline(block.note);
    right.appendChild(n);
  }
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function renderQuizAccordion(block) {
  const container = document.createElement("div");
  container.className = "block quiz-accordion";

  block.items.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "quiz-accordion__item";

    const summary = document.createElement("button");
    summary.className = "quiz-accordion__summary";
    summary.innerHTML = `<span class="quiz-accordion__title">${parseExamTitle(item.image)}</span>`;
    
    const content = document.createElement("div");
    content.className = "quiz-accordion__content";
    
    const imgWrap = document.createElement("div");
    imgWrap.className = "quiz-accordion__image-wrap";
    imgWrap.appendChild(buildImage(item.image));
    content.appendChild(imgWrap);

    if (item.answer) {
      content.appendChild(buildAnswer(item.answer, "정답 및 해설 보기"));
    }

    summary.addEventListener("click", () => {
      itemEl.classList.toggle("is-open");
    });

    itemEl.appendChild(summary);
    itemEl.appendChild(content);
    container.appendChild(itemEl);
  });

  return container;
}

function renderExpandable(block) {
  const div = document.createElement("div");
  div.className = "block expandable";
  const btn = document.createElement("button");
  btn.className = "expandable__summary";
  btn.textContent = block.summary;
  const content = document.createElement("div");
  content.className = "expandable__content";
  block.children.forEach(child => {
    const el = renderBlock(child);
    if (el) content.appendChild(el);
  });
  btn.addEventListener("click", () => div.classList.toggle("is-open"));
  div.appendChild(btn);
  div.appendChild(content);
  return div;
}

function renderSummary(block) {
  const div = document.createElement("div");
  div.className = "block summary";
  let html = "<ol>";
  block.items.forEach(item => { html += `<li>${formatInline(item)}</li>`; });
  html += "</ol>";
  div.innerHTML = html;
  return div;
}

function renderMedia(block) {
  const div = document.createElement("div");
  div.className = "block media";
  if (block.kind === "image") {
    div.classList.add("media--image");
    div.appendChild(buildImage(block.src, block.caption || ""));
    if (block.caption) {
      const cap = document.createElement("div");
      cap.className = "media__caption";
      cap.textContent = block.caption;
      div.appendChild(cap);
    }
  } else if (block.kind === "video-link") {
    div.classList.add("media--video-link");
    const videoId = extractYouTubeId(block.url);
    const link = document.createElement("a");
    link.href = block.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    link.className = "media__thumb-link";
    link.setAttribute("aria-label", block.caption || "영상 보기");
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "media__thumb-wrap";
    if (videoId) {
      const img = document.createElement("img");
      img.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      img.alt = block.caption || "YouTube 썸네일"; img.loading = "lazy";
      img.onerror = () => { const ph = document.createElement("div"); ph.className = "image-placeholder"; ph.textContent = "썸네일 없음"; img.replaceWith(ph); };
      thumbWrap.appendChild(img);
    }
    const play = document.createElement("div");
    play.className = "media__play-icon"; play.setAttribute("aria-hidden", "true"); play.textContent = "▶";
    thumbWrap.appendChild(play); link.appendChild(thumbWrap); div.appendChild(link);
    if (block.caption) {
      const cap = document.createElement("div");
      cap.className = "media__caption"; cap.textContent = block.caption; div.appendChild(cap);
    }
  }
  return div;
}

export function renderDivider() {
  const hr = document.createElement("hr");
  hr.className = "block divider";
  return hr;
}

/* ── 블록 내부 헬퍼 ── */

function buildAnswer(answer, label = "답 보기") {
  const wrap = document.createElement("div");
  wrap.className = "answer";
  const btn = document.createElement("button");
  btn.className = "answer__toggle";
  btn.textContent = label;
  btn.addEventListener("click", () => wrap.classList.toggle("is-open"));
  const content = document.createElement("div");
  content.className = "answer__content";
  if (answer.bullets) {
    let html = "<ul>";
    answer.bullets.forEach(b => { html += `<li>${formatInline(b)}</li>`; });
    html += "</ul>";
    content.innerHTML = html;
  } else if (answer.text) {
    content.innerHTML = `<p>${formatInline(answer.text)}</p>`;
  }
  wrap.appendChild(btn);
  wrap.appendChild(content);
  return wrap;
}

function buildImagePair(paths) {
  const pair = document.createElement("div");
  pair.className = "image-pair";
  paths.forEach(p => pair.appendChild(buildImage(p)));
  return pair;
}

function buildImage(key, alt = "") {
  let resolved = key;
  if (app.lesson.assets?.[key]) resolved = app.lesson.assets[key];

  if (typeof resolved === "string" && resolved.includes("drive.google.com")) {
    const driveIdMatch = resolved.match(/\/d\/([^/]+)/) || resolved.match(/id=([^&]+)/);
    if (driveIdMatch && driveIdMatch[1]) {
      resolved = `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
    }
  }

  if (typeof resolved === "string" && resolved.startsWith("text:")) return buildTextCutout(resolved.slice(5), alt);

  const videoId = extractYouTubeId(resolved);
  if (videoId) {
    const wrap = document.createElement("div"); wrap.className = "media__thumb-wrap";
    const link = document.createElement("a"); link.href = resolved; link.target = "_blank"; link.rel = "noopener noreferrer"; link.className = "media__thumb-link"; link.setAttribute("aria-label", alt || "YouTube 영상 보기");
    const thumb = document.createElement("img"); thumb.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; thumb.alt = alt || "YouTube 썸네일"; thumb.loading = "lazy";
    thumb.onerror = () => { const ph = document.createElement("div"); ph.className = "image-placeholder"; ph.textContent = "썸네일 없음"; thumb.replaceWith(ph); };
    const play = document.createElement("div"); play.className = "media__play-icon"; play.setAttribute("aria-hidden", "true"); play.textContent = "▶";
    link.appendChild(thumb); link.appendChild(play); wrap.appendChild(link); return wrap;
  }

  const src = /^https?:\/\//.test(resolved) ? resolved : app.lesson.imageBase + resolved;
  const img = document.createElement("img");
  img.src = src; img.alt = alt; img.loading = "lazy";
  img.addEventListener("click", () => openImageLightbox(src));
  img.onerror = () => { const ph = document.createElement("div"); ph.className = "image-placeholder"; ph.textContent = `이미지: ${key}`; img.replaceWith(ph); };
  return img;
}

function buildTextCutout(body, alt = "") {
  const wrap = document.createElement("div");
  wrap.className = "text-cutout";
  const cleanBody = body.trim().replace(/\r\n/g, "\n");
  const parts = cleanBody.split(/\n---\n/);
  const mainPart = parts[0].trim();
  const sourcePart = parts[1] ? parts[1].trim() : null;
  const lines = mainPart.split("\n");
  let headline = null;
  let restLines = [...lines];

  if (lines[0] && /^##\s?/.test(lines[0])) {
    headline = lines[0].replace(/^##\s?/, "").trim();
    restLines = lines.slice(1);
    while (restLines.length && !restLines[0].trim()) {
      restLines.shift();
    }
  }

  if (headline) {
    const h = document.createElement("div");
    h.className = "text-cutout__headline";
    h.innerHTML = formatInline(headline);
    wrap.appendChild(h);
  }

  const bodyEl = document.createElement("div");
  bodyEl.className = "text-cutout__body";
  bodyEl.innerHTML = formatInline(restLines.join("\n"));
  wrap.appendChild(bodyEl);

  if (sourcePart) {
    const src = document.createElement("div");
    src.className = "text-cutout__source";
    src.innerHTML = formatInline(sourcePart);
    wrap.appendChild(src);
  }

  return wrap;
}
