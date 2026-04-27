const OBJECT_BLOCKS = new Map([
  ["[사례", "사례"],
  ["[개념", "개념"],
  ["[발문", "발문"],
]);

const FENCE_BLOCKS = new Map([
  [">>", "토글"],
]);

const ANSWER_TAGS = ["답", "a"];
const COMMENT_TAGS = ["댓", "c"];
const EXAM_TAGS = ["문", "p"];

export function parseLessonMarkup(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const errors = [];
  const warnings = [];
  let i = 0;

  const pushTextChunk = chunk => {
    const text = chunk.join("\n").trim();
    if (!text) return;
    const { text: cleanText, asides } = extractAsides(text);
    const block = { type: "단락", text: cleanText };
    if (asides.length) block.asides = asides;
    blocks.push(block);
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (OBJECT_BLOCKS.has(trimmed)) {
      const result = collectObjectBlock(lines, i, errors, warnings);
      if (result.block) blocks.push(result.block);
      i = result.nextIndex;
      continue;
    }

    if (FENCE_BLOCKS.has(trimmed)) {
      const result = collectFenceBlock(lines, i, warnings);
      blocks.push(result.block);
      i = result.nextIndex;
      continue;
    }

    const examTag = getOpeningTag(trimmed, EXAM_TAGS);
    if (examTag) {
      const result = collectTaggedBlock(lines, i, examTag, warnings);
      blocks.push(buildExamBlock(result.body));
      i = result.nextIndex;
      continue;
    }

    const commentTag = consumeCommentTag(lines, i);
    if (commentTag) {
      blocks.push({ type: "댓글" });
      i = commentTag.nextIndex;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ type: "구분선" });
      i += 1;
      continue;
    }

    const objectSeq = parseObjectSequence(trimmed);
    if (objectSeq) {
      blocks.push(sequenceToBlock(objectSeq));
      i += 1;
      continue;
    }

    if (isMalformedQuoteLine(trimmed)) {
      errors.push({
        line: i + 1,
        message: "인용 문법은 한 줄 전체를 {{내용}} 형태로 닫아야 합니다.",
      });
      i += 1;
      continue;
    }

    const heading = parseHeading(trimmed);
    if (heading) {
      blocks.push(heading);
      i += 1;
      continue;
    }

    const chunk = [];
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (!nextTrimmed) {
        chunk.push(lines[i]);
        i += 1;
        continue;
      }
      if (
        OBJECT_BLOCKS.has(nextTrimmed) ||
        FENCE_BLOCKS.has(nextTrimmed) ||
        getOpeningTag(nextTrimmed, EXAM_TAGS) ||
        consumeCommentTag(lines, i) ||
        nextTrimmed === "---" ||
        parseObjectSequence(nextTrimmed) ||
        isMalformedQuoteLine(nextTrimmed) ||
        parseHeading(nextTrimmed)
      ) {
        break;
      }
      chunk.push(lines[i]);
      i += 1;
    }
    pushTextChunk(chunk);
  }

  return { blocks, errors, warnings };
}

export function stringifyLessonMarkup(blocks = []) {
  return blocks.map(blockToMarkup).filter(Boolean).join("\n\n");
}

function blockToMarkup(block) {
  if (!block || typeof block !== "object") return "";
  if (block.type === "소제목") return `## ${block.text || ""}`.trimEnd();
  if (block.type === "절") return `### ${block.text || ""}`.trimEnd();
  if (block.type === "구분선") return "---";
  if (block.type === "댓글") return "<댓>";
  if (block.type === "단락") return withAsides(block.text || "", block.asides);
  if (block.type === "인용") return quoteLine(block.body || block.text || "", block.asides);
  if (block.type === "토글") return fenceMarkup(">>", block.body || block.text || block.answer || "");
  if (block.type === "미디어") return materialLine(block.items || block.materials || block.item, block.layout);
  if (block.type === "그룹") return objectSequenceLine(block.items || [], block.layout);
  if (block.type === "기출문제") {
    return (block.items || []).map(item => {
      return ["<문>", item.image || "", answerTag(item.answer), "</문>"].filter(line => line !== "").join("\n");
    }).join("\n\n");
  }
  if (block.type === "사례") {
    return objectMarkup("사례", [
      objectContentMarkup(block),
      legacyCommentMarkup(block),
    ]);
  }
  if (block.type === "개념") {
    return objectMarkup("개념", [
      block.title ? `## ${block.title}` : "",
      objectContentMarkup(block),
      legacyCommentMarkup(block),
    ]);
  }
  if (block.type === "발문") {
    return (block.prompts || []).map(prompt => objectMarkup("발문", [
      objectContentMarkup({
        ...prompt,
        body: prompt.q,
        answer: prompt.answer,
        asides: prompt.asides || (prompt.note ? [prompt.note] : []),
      }),
      block.comments && !flowHasComment(prompt.flow) ? "<댓>" : "",
    ])).join("\n\n");
  }
  return "";
}

function objectContentMarkup(block) {
  if (Array.isArray(block.flow) && block.flow.length) {
    return [
      flowToMarkup(block.flow),
      block.answer && !flowHasAnswer(block.flow) ? answerTag(block.answer) : "",
    ].filter(Boolean).join("\n");
  }
  return [
    withAsides(block.body || block.text || "", block.asides),
    materialLine(block.materials, block.materialsLayout),
    answerTag(block.answer),
  ].filter(Boolean).join("\n");
}

function flowHasAnswer(flow = []) {
  return asArray(flow).some(item => item?.type === "answer");
}

function flowHasComment(flow = []) {
  return asArray(flow).some(item => item?.type === "comment");
}

function legacyCommentMarkup(block) {
  return block.comments && !flowHasComment(block.flow) ? "<댓>" : "";
}

function flowToMarkup(flow = []) {
  return asArray(flow).map(item => {
    if (!item || typeof item !== "object") return "";
    if (item.type === "text") return withAsides(item.text || "", item.asides);
    if (item.type === "divider") return "---";
    if (item.type === "materials") return materialLine(item.items, item.layout);
    if (item.type === "quote") return quoteLine(item.body || item.text || "", item.asides);
    if (item.type === "group") return objectSequenceLine(item.items || [], item.layout || "row");
    if (item.type === "answer") return answerTag(item.answer);
    if (item.type === "comment") return "<댓>";
    return "";
  }).filter(Boolean).join("\n");
}

function objectMarkup(label, parts) {
  return [`[${label}`, ...parts.filter(Boolean), "]"].join("\n");
}

function fenceMarkup(fence, body) {
  return [fence, body || "", fence].join("\n");
}

function withAsides(text, asides = []) {
  const body = String(text || "").trim();
  const asideText = asArray(asides).map(aside => `%${escapeAtomText(aside)}%`).join("\n");
  return [body, asideText].filter(Boolean).join("\n");
}

function answerTag(answer) {
  const text = answerToText(answer);
  return text ? `<답>\n${text}\n</답>` : "";
}

function answerToText(answer) {
  if (Array.isArray(answer)) return answer.join("\n");
  return String(answer || "").trim();
}

function getOpeningTag(trimmed, tags) {
  return tags.find(tag => trimmed === `<${tag}>`) || "";
}

function getEmptyInlineTag(trimmed, tags) {
  return tags.find(tag => trimmed === `<${tag}></${tag}>`) || "";
}

function consumeCommentTag(lines, index) {
  const trimmed = lines[index]?.trim();
  const emptyTag = getEmptyInlineTag(trimmed, COMMENT_TAGS);
  if (emptyTag) return { tag: emptyTag, nextIndex: index + 1 };

  const tag = getOpeningTag(trimmed, COMMENT_TAGS);
  if (!tag) return null;

  const close = `</${tag}>`;
  let nextIndex = index + 1;
  if (lines[nextIndex]?.trim() === close) {
    nextIndex += 1;
  } else if (tag === "c") {
    const result = collectTaggedBlock(lines, index, tag, []);
    nextIndex = result.nextIndex;
  }
  return { tag, nextIndex };
}

function collectObjectBlock(lines, startIndex, errors, warnings) {
  const opener = lines[startIndex].trim();
  const type = OBJECT_BLOCKS.get(opener);
  const body = [];
  let i = startIndex + 1;

  for (; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed === "]") {
      return {
        block: buildObjectBlock(type, body, errors),
        nextIndex: i + 1,
      };
    }
    if (OBJECT_BLOCKS.has(trimmed)) {
      errors.push({
        line: i + 1,
        message: "객체 블록 안에서는 새 객체 블록을 열 수 없습니다.",
      });
    }
    body.push(lines[i]);
  }

  warnings.push({
    line: startIndex + 1,
    message: `${type} 블록이 닫히지 않아 파일 끝에서 임시로 닫았습니다.`,
  });
  return {
    block: buildObjectBlock(type, body, errors),
    nextIndex: lines.length,
  };
}

function collectFenceBlock(lines, startIndex, warnings) {
  const fence = lines[startIndex].trim();
  const type = FENCE_BLOCKS.get(fence);
  const body = [];
  let i = startIndex + 1;

  for (; i < lines.length; i += 1) {
    if (lines[i].trim() === fence) {
      return {
        block: buildFenceBlock(type, body.join("\n")),
        nextIndex: i + 1,
      };
    }
    body.push(lines[i]);
  }

  warnings.push({
    line: startIndex + 1,
    message: `${type} 블록이 닫히지 않아 파일 끝에서 임시로 닫았습니다.`,
  });
  return {
    block: buildFenceBlock(type, body.join("\n")),
    nextIndex: lines.length,
  };
}

function collectTaggedBlock(lines, startIndex, tag, warnings) {
  const close = `</${tag}>`;
  const body = [];
  let i = startIndex + 1;
  for (; i < lines.length; i += 1) {
    if (lines[i].trim() === close) {
      return { body: body.join("\n"), nextIndex: i + 1 };
    }
    body.push(lines[i]);
  }
  warnings.push({
    line: startIndex + 1,
    message: `<${tag}> 블록이 닫히지 않아 파일 끝에서 임시로 닫았습니다.`,
  });
  return { body: body.join("\n"), nextIndex: lines.length };
}

function buildFenceBlock(type, body) {
  const { text, asides } = extractAsides(body.trim());
  const block = { type, body: text };
  if (asides.length) block.asides = asides;
  return block;
}

function buildObjectBlock(type, lines, errors = []) {
  if (type === "발문") {
    const parsed = parsePromptContent(lines, errors);
    const block = {
      type,
      prompts: parsed.prompts.length ? parsed.prompts : [{ q: "" }],
    };
    return block;
  }

  const parsed = parseObjectContent(lines, errors);
  const title = type === "개념" ? extractLeadingTitle(parsed) : "";
  const legacy = deriveLegacyFromFlow(parsed.flow);
  const block = { type, body: parsed.text };
  if (title) block.title = title;
  block.body = legacy.text;
  if (legacy.answer) block.answer = legacy.answer;
  if (legacy.materials.length) block.materials = legacy.materials;
  if (legacy.materialsLayout) block.materialsLayout = legacy.materialsLayout;
  if (legacy.asides.length) block.asides = legacy.asides;
  if (parsed.flow.length) block.flow = parsed.flow;
  return block;
}

function parsePromptContent(lines, errors = []) {
  const prompts = [];
  let buffer = [];

  const flushPrompt = answer => {
    const parsed = parseObjectContent(buffer, errors);
    const legacy = deriveLegacyFromFlow(parsed.flow);
    buffer = [];
    const prompt = { q: legacy.text };
    const flow = [...parsed.flow];
    if (answer) prompt.answer = normalizeAnswer(answer);
    else if (legacy.answer) prompt.answer = legacy.answer;
    if (answer) flow.push({ type: "answer", answer: prompt.answer });
    if (legacy.materials.length) prompt.materials = legacy.materials;
    if (legacy.materialsLayout) prompt.materialsLayout = legacy.materialsLayout;
    if (legacy.asides.length) prompt.asides = legacy.asides;
    if (flow.length) prompt.flow = flow;
    if (prompt.q || prompt.answer || prompt.materials?.length || prompt.flow?.length) {
      prompts.push(prompt);
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const answerTagName = getOpeningTag(trimmed, ANSWER_TAGS);
    if (answerTagName) {
      const result = collectTaggedBlock(lines, i, answerTagName, []);
      flushPrompt(result.body.trim());
      i = result.nextIndex - 1;
      continue;
    }
    const commentTag = consumeCommentTag(lines, i);
    if (commentTag && !buffer.join("").trim() && prompts.length) {
      const prompt = prompts[prompts.length - 1];
      if (!Array.isArray(prompt.flow)) prompt.flow = [];
      prompt.flow.push({ type: "comment" });
      i = commentTag.nextIndex - 1;
      continue;
    }
    buffer.push(lines[i]);
  }

  flushPrompt("");
  return { prompts };
}

function parseObjectContent(lines, errors = []) {
  let kept = [];
  const flow = [];

  const flushText = () => {
    const { text, asides } = extractAsides(kept.join("\n").trim());
    kept = [];
    if (!text && !asides.length) return;
    const item = { type: "text" };
    if (text) item.text = text;
    if (asides.length) item.asides = asides;
    flow.push(item);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      kept.push(lines[i]);
      continue;
    }

    if (trimmed === "---") {
      flushText();
      flow.push({ type: "divider" });
      continue;
    }

    const objectSeq = parseObjectSequence(trimmed);
    if (objectSeq) {
      flushText();
      flow.push(sequenceToFlowItem(objectSeq));
      continue;
    }

    if (isMalformedQuoteLine(trimmed)) {
      errors.push({
        line: null,
        message: "인용 문법은 한 줄 전체를 {{내용}} 형태로 닫아야 합니다.",
      });
      continue;
    }

    const answerTagName = getOpeningTag(trimmed, ANSWER_TAGS);
    if (answerTagName) {
      flushText();
      const result = collectTaggedBlock(lines, i, answerTagName, []);
      const answer = normalizeAnswer(result.body.trim());
      if (answer) {
        flow.push({ type: "answer", answer });
      }
      i = result.nextIndex - 1;
      continue;
    }

    const commentTag = consumeCommentTag(lines, i);
    if (commentTag) {
      flushText();
      flow.push({ type: "comment" });
      i = commentTag.nextIndex - 1;
      continue;
    }

    kept.push(lines[i]);
  }

  flushText();
  const legacy = deriveLegacyFromFlow(flow);
  return {
    ...legacy,
    flow,
  };
}

function extractLeadingTitle(parsed) {
  const first = parsed.flow[0];
  if (!first || first.type !== "text") return "";
  const lines = String(first.text || "").split("\n");
  const titleMatch = lines[0]?.match(/^##(?!#)\s+(.+)$/);
  if (!titleMatch) return "";

  const rest = lines.slice(1);
  while (rest.length && !rest[0].trim()) rest.shift();
  first.text = rest.join("\n").trim();
  if (!first.text && !first.asides?.length) parsed.flow.shift();
  return titleMatch[1].trim();
}

function deriveLegacyFromFlow(flow = []) {
  const textParts = [];
  const materials = [];
  let materialsLayout = "";
  const answers = [];
  const asides = [];

  asArray(flow).forEach(item => {
    if (!item || typeof item !== "object") return;
    if (item.type === "text") {
      if (item.text) textParts.push(item.text);
      if (item.asides) asides.push(...asArray(item.asides));
      return;
    }
    if (item.type === "materials") {
      const itemMaterials = asArray(item.items).filter(isMaterialAtom);
      if (itemMaterials.length) materials.push(...itemMaterials);
      if (item.layout === "row" && itemMaterials.length === asArray(item.items).length) materialsLayout = "row";
      return;
    }
    if (item.type === "answer") {
      const text = answerToText(item.answer);
      if (text) answers.push(text);
    }
  });

  return {
    text: textParts.join("\n\n").trim(),
    asides,
    materials,
    materialsLayout,
    answer: normalizeAnswer(answers.join("\n").trim()),
  };
}

function buildExamBlock(body) {
  const answerExtracted = extractInlineTags(body, ANSWER_TAGS);
  const lines = answerExtracted.text.split("\n").map(line => line.trim()).filter(Boolean);
  const image = lines.shift() || "";
  const answerText = [lines.join("\n"), answerExtracted.matches.join("\n")].filter(Boolean).join("\n").trim();
  return {
    type: "기출문제",
    items: [{
      image,
      answer: normalizeAnswer(answerText),
    }],
  };
}

function parseHeading(trimmed) {
  const chapter = trimmed.match(/^##(?!#)\s+(.+)$/);
  if (chapter) return { type: "소제목", text: chapter[1].trim() };
  const section = trimmed.match(/^###(?!#)\s+(.+)$/);
  if (section) return { type: "절", text: section[1].trim() };
  return null;
}

function parseObjectSequence(line) {
  const parts = splitObjectSequence(line);
  if (!parts.length) return null;
  const items = [];
  for (const part of parts) {
    const parsed = parseObjectAtom(part.trim());
    if (!parsed) return null;
    items.push(parsed);
  }
  if (!items.length) return null;
  return {
    items,
    layout: items.length > 1 ? "row" : "stack",
  };
}

function splitObjectSequence(line) {
  const parts = [];
  let current = "";
  let atom = "";

  for (let i = 0; i < line.length; i += 1) {
    if (!atom && line.startsWith("[[", i)) {
      atom = "material";
      current += "[[";
      i += 1;
      continue;
    }
    if (!atom && line.startsWith("{{", i)) {
      atom = "quote";
      current += "{{";
      i += 1;
      continue;
    }
    if (atom === "material" && line.startsWith("]]", i)) {
      atom = "";
      current += "]]";
      i += 1;
      continue;
    }
    if (atom === "quote" && line.startsWith("}}", i)) {
      atom = "";
      current += "}}";
      i += 1;
      continue;
    }
    if (!atom && /\s/.test(line[i]) && line[i + 1] === "~" && /\s/.test(line[i + 2] || "")) {
      parts.push(current.trim());
      current = "";
      i += 2;
      continue;
    }
    current += line[i];
  }

  if (atom) return [line];
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseObjectAtom(part) {
  const material = part.match(/^\[\[([^\]]+)\]\]$/);
  if (material) return parseMaterialAtom(material[1]);
  const quote = part.match(/^\{\{(.+)\}\}$/);
  if (quote) {
    const { text, asides } = extractAsides(unescapeAtomText(quote[1].trim()));
    const item = { type: "인용", body: text };
    if (asides.length) item.asides = asides;
    return item;
  }
  return null;
}

function parseMaterialAtom(value) {
  const raw = String(value || "").trim();
  const separatorIndex = raw.indexOf("==");
  if (separatorIndex < 0) return unescapeAtomText(raw);

  const ref = raw.slice(0, separatorIndex).trim();
  const caption = raw.slice(separatorIndex + 2).trim();
  if (!ref || !caption) return unescapeAtomText(raw);
  return { ref: unescapeAtomText(ref), caption: unescapeAtomText(caption) };
}

function sequenceToBlock(sequence) {
  if (sequence.items.length === 1) {
    const item = sequence.items[0];
    if (isMaterialAtom(item)) {
      return { type: "미디어", layout: "stack", items: [item] };
    }
    return item;
  }
  if (sequence.items.every(isMaterialAtom)) {
    return {
      type: "미디어",
      layout: sequence.layout,
      items: sequence.items,
    };
  }
  return {
    type: "그룹",
    layout: sequence.layout,
    items: sequence.items,
  };
}

function sequenceToFlowItem(sequence) {
  if (sequence.items.length === 1) {
    const item = sequence.items[0];
    if (isMaterialAtom(item)) {
      return { type: "materials", items: [item], layout: "stack" };
    }
    if (item.type === "인용") {
      const quote = { type: "quote", body: item.body };
      if (item.asides?.length) quote.asides = item.asides;
      return quote;
    }
  }
  if (sequence.items.every(isMaterialAtom)) {
    return {
      type: "materials",
      items: sequence.items,
      layout: sequence.layout,
    };
  }
  return {
    type: "group",
    layout: sequence.layout,
    items: sequence.items,
  };
}

function isMaterialAtom(item) {
  return typeof item === "string" || Boolean(item?.ref);
}

function isMalformedQuoteLine(line) {
  const trimmed = String(line || "").trim();
  return trimmed.startsWith("{{") && !parseObjectSequence(trimmed);
}

function quoteLine(text, asides = []) {
  return `{{${escapeAtomText(withAsides(text, asides))}}}`;
}

function objectSequenceLine(items, layout = "stack") {
  const values = asArray(items).map(objectAtomToMarkup).filter(Boolean);
  if (!values.length) return "";
  return values.join(layout === "row" ? " ~ " : "\n");
}

function objectAtomToMarkup(item) {
  if (!item) return "";
  if (typeof item === "string") return `[[${escapeAtomText(item)}]]`;
  if (item.type === "인용") return quoteLine(item.body || item.text || "", item.asides);
  if (item.ref) return materialAtomToMarkup(item);
  return "";
}

function materialAtomToMarkup(item) {
  const caption = String(item.caption || "").trim();
  const ref = escapeAtomText(item.ref || "");
  return `[[${ref}${caption ? `==${escapeAtomText(caption)}` : ""}]]`;
}

function escapeAtomText(value) {
  return String(value ?? "").replace(/\n/g, ";;");
}

function unescapeAtomText(value) {
  return String(value ?? "").replace(/;;/g, "\n").replace(/\\n/g, "\n");
}

function extractAsides(text) {
  const asides = [];
  const clean = String(text || "").replace(/%([^%\n]+)%/g, (_, value) => {
    const trimmed = value.trim();
    if (trimmed) asides.push(trimmed);
    return "";
  }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: clean, asides };
}

function extractInlineTag(text, tag) {
  return extractInlineTags(text, [tag]);
}

function extractInlineTags(text, tags) {
  const matches = [];
  const tagPattern = tags.map(escapeRegExp).join("|");
  const pattern = new RegExp(`<(${tagPattern})>\\n?([\\s\\S]*?)\\n?</\\1>`, "g");
  const clean = String(text || "").replace(pattern, (_, _tag, value) => {
    const trimmed = value.trim();
    if (trimmed) matches.push(trimmed);
    return "";
  }).trim();
  return { text: clean, matches };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAnswer(value) {
  const lines = String(value || "").split("\n").map(line => line.trim()).filter(Boolean);
  if (lines.length <= 1) return lines[0] || "";
  return lines;
}

function materialLine(items, layout = "stack") {
  const values = asArray(items).map(item => {
    if (!item) return "";
    if (typeof item === "string") return `[[${escapeAtomText(item)}]]`;
    if (item.ref) return materialAtomToMarkup(item);
    return "";
  }).filter(Boolean);
  if (!values.length) return "";
  return values.join(layout === "row" ? " ~ " : "\n");
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
