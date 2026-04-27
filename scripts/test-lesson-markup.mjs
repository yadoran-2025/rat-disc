import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../js/lesson-markup.js", import.meta.url), "utf8")
  .replace(/^export /gm, "");
const sandbox = {};
vm.runInNewContext(`${source}\nthis.parseLessonMarkup = parseLessonMarkup; this.stringifyLessonMarkup = stringifyLessonMarkup;`, sandbox);
const { parseLessonMarkup, stringifyLessonMarkup } = sandbox;
const assertJsonEqual = (actual, expected) => {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
};

const sample = `
## 장 제목
### 절 제목
일반 문단 *강조*
%부연%

[[alpha]] ~ [[beta]]

[[https://example.com/article]]

{{인용 내용}}

{{인용 A}} ~ {{인용 B}}

[[alpha]] ~ {{혼합 인용}}

[사례
사례 본문
---
사례 두 번째 문단
%출처처럼 보이지만 통합 보조문%
[[case-img]]
{{사례 안 인용}}
[[https://example.com/block-link]]
자료 뒤 본문
<a>
정답 1
정답 2
</a>
<c>
</c>
]

[발문
질문입니다.
[[question-ref]]
<a>
답입니다.
</a>
]

>>
접어둘 내용
>>

<p>
250611[경제]
해설입니다.
</p>
`;

const parsed = parseLessonMarkup(sample);
assert.equal(parsed.errors.length, 0);

const paragraphWithBlankLine = parseLessonMarkup(`즉, 모든 영역에서 차별을 금지하는 것은,
다르게 말하면 네가 누구를 좋아하고 싫어하는 것도 국가가 규제한다는 말이다.
이런 것은 우리가 기대하는 정상적인 상태는 아닐 것이다.

그렇다고, 차별을 금지하지 않을 수 있을까?`);
assert.equal(paragraphWithBlankLine.blocks.length, 1);
assert.equal(paragraphWithBlankLine.blocks[0].type, "단락");
assert.equal(
  paragraphWithBlankLine.blocks[0].text,
  "즉, 모든 영역에서 차별을 금지하는 것은,\n다르게 말하면 네가 누구를 좋아하고 싫어하는 것도 국가가 규제한다는 말이다.\n이런 것은 우리가 기대하는 정상적인 상태는 아닐 것이다.\n\n그렇다고, 차별을 금지하지 않을 수 있을까?"
);

const explicitDivider = parseLessonMarkup(`문장 1

---

문장 2`);
assertJsonEqual(explicitDivider.blocks.map(block => block.type), ["단락", "구분선", "단락"]);

assert.equal(parsed.blocks[0].type, "소제목");
assert.equal(parsed.blocks[1].type, "절");
assertJsonEqual(parsed.blocks[2].asides, ["부연"]);
assert.equal(stringifyLessonMarkup([parsed.blocks[2]]), `일반 문단 *강조*
%부연%`);
assertJsonEqual(parsed.blocks[3], {
  type: "미디어",
  layout: "row",
  items: ["alpha", "beta"],
});
assertJsonEqual(parsed.blocks[4], {
  type: "미디어",
  layout: "stack",
  items: ["https://example.com/article"],
});
assertJsonEqual(parsed.blocks[5], {
  type: "인용",
  body: "인용 내용",
});
assertJsonEqual(parsed.blocks[6], {
  type: "그룹",
  layout: "row",
  items: [
    { type: "인용", body: "인용 A" },
    { type: "인용", body: "인용 B" },
  ],
});
assertJsonEqual(parsed.blocks[7], {
  type: "그룹",
  layout: "row",
  items: [
    "alpha",
    { type: "인용", body: "혼합 인용" },
  ],
});

const caseBlock = parsed.blocks.find(block => block.type === "사례");
assert.equal(caseBlock.body, "사례 본문\n\n사례 두 번째 문단\n\n자료 뒤 본문");
assertJsonEqual(caseBlock.asides, ["출처처럼 보이지만 통합 보조문"]);
assertJsonEqual(caseBlock.materials, ["case-img", "https://example.com/block-link"]);
assertJsonEqual(caseBlock.flow.map(item => item.type), ["text", "divider", "text", "materials", "quote", "materials", "text", "answer", "comment"]);
assert.equal(caseBlock.flow[4].body, "사례 안 인용");
assertJsonEqual(caseBlock.flow[5].items, ["https://example.com/block-link"]);
assert.equal(caseBlock.flow[6].text, "자료 뒤 본문");
assertJsonEqual(caseBlock.flow[7].answer, ["정답 1", "정답 2"]);
assert.equal(caseBlock.materialsLayout, undefined);
assertJsonEqual(caseBlock.answer, ["정답 1", "정답 2"]);
assert.equal(caseBlock.comments, undefined);

const legacyAside = parseLessonMarkup(`문장
%옛 보조문%`).blocks[0];
assertJsonEqual(legacyAside.asides, ["옛 보조문"]);
assert.equal(stringifyLessonMarkup([legacyAside]), `문장
%옛 보조문%`);

const multiAnswerCase = parseLessonMarkup(`[사례
첫 번째 내용
<a>
첫 번째 답
</a>

두 번째 내용
<a>
두 번째 답
</a>
]`).blocks[0];
assertJsonEqual(multiAnswerCase.flow.map(item => item.type), ["text", "answer", "text", "answer"]);
assert.equal(multiAnswerCase.flow[1].answer, "첫 번째 답");
assert.equal(multiAnswerCase.flow[3].answer, "두 번째 답");

const question = parsed.blocks.find(block => block.type === "발문");
assert.equal(question.prompts[0].q, "질문입니다.");
assertJsonEqual(question.prompts[0].materials, ["question-ref"]);
assert.equal(question.prompts[0].answer, "답입니다.");

const multiAnswerQuestion = parseLessonMarkup(`[발문
1. 첫 번째 질문
<a>
첫 번째 답
</a>

2. 두 번째 질문
<a>
- 두 번째 답 1
- 두 번째 답 2
</a>
]`).blocks[0];
assert.equal(multiAnswerQuestion.prompts.length, 2);
assert.equal(multiAnswerQuestion.prompts[0].q, "1. 첫 번째 질문");
assert.equal(multiAnswerQuestion.prompts[0].answer, "첫 번째 답");
assert.equal(multiAnswerQuestion.prompts[1].q, "2. 두 번째 질문");
assertJsonEqual(multiAnswerQuestion.prompts[1].answer, ["- 두 번째 답 1", "- 두 번째 답 2"]);
assert.equal(stringifyLessonMarkup([multiAnswerQuestion]).includes("<답>\n첫 번째 답\n</답>"), true);
assert.equal(stringifyLessonMarkup([multiAnswerQuestion]).includes("<답>\n- 두 번째 답 1\n- 두 번째 답 2\n</답>"), true);

assert.equal(parsed.blocks.find(block => block.type === "토글").body, "접어둘 내용");
assert.equal(parsed.blocks.some(block => block.type === "텍스트박스"), false);

const oldQuoteFence = parseLessonMarkup('"""\n옛 인용\n"""');
assert.equal(oldQuoteFence.blocks.some(block => block.type === "인용"), false);

const malformedQuote = parseLessonMarkup("{{닫히지 않은 인용");
assert.equal(malformedQuote.errors.length, 1);

const exam = parsed.blocks.find(block => block.type === "기출문제");
assert.equal(exam.items[0].image, "250611[경제]");
assert.equal(exam.items[0].answer, "해설입니다.");

const nested = parseLessonMarkup("[사례\n[개념\n본문\n]\n]");
assert.equal(nested.errors.length, 1);

const unclosed = parseLessonMarkup("[사례\n본문");
assert.equal(unclosed.errors.length, 0);
assert.equal(unclosed.warnings.length, 1);

const captionedMedia = parseLessonMarkup("[[alpha==Alpha caption]]").blocks[0];
assert.equal(captionedMedia.layout, "stack");
assertJsonEqual(captionedMedia.items, [{ ref: "alpha", caption: "Alpha caption" }]);

const captionedNewline = parseLessonMarkup("[[alpha==첫 줄;;둘째 줄]]").blocks[0];
assertJsonEqual(captionedNewline.items, [{ ref: "alpha", caption: "첫 줄\n둘째 줄" }]);
assert.equal(stringifyLessonMarkup([captionedNewline]), "[[alpha==첫 줄;;둘째 줄]]");

const quoteNewline = parseLessonMarkup("{{첫 줄;;둘째 줄}}").blocks[0];
assert.equal(quoteNewline.body, "첫 줄\n둘째 줄");
assert.equal(stringifyLessonMarkup([quoteNewline]), "{{첫 줄;;둘째 줄}}");

const quoteAside = parseLessonMarkup("{{인용 본문;;%인용 출처%}}").blocks[0];
assert.equal(quoteAside.body, "인용 본문");
assertJsonEqual(quoteAside.asides, ["인용 출처"]);
assert.equal(stringifyLessonMarkup([quoteAside]), "{{인용 본문;;%인용 출처%}}");

const legacyEscapedNewline = parseLessonMarkup("{{첫 줄\\n둘째 줄}}").blocks[0];
assert.equal(legacyEscapedNewline.body, "첫 줄\n둘째 줄");
assert.equal(stringifyLessonMarkup([legacyEscapedNewline]), "{{첫 줄;;둘째 줄}}");

const captionedGroup = parseLessonMarkup("[[alpha==Alpha caption]] ~ {{captioned quote}}").blocks[0];
assert.equal(captionedGroup.layout, "row");
assertJsonEqual(captionedGroup.items, [
  { ref: "alpha", caption: "Alpha caption" },
  { type: "인용", body: "captioned quote" },
]);

const captionWithTilde = parseLessonMarkup("[[alpha==A ~ B]] ~ {{인용}}").blocks[0];
assertJsonEqual(captionWithTilde.items, [
  { ref: "alpha", caption: "A ~ B" },
  { type: "인용", body: "인용" },
]);

const conceptWithTitle = parseLessonMarkup(`[개념
## 개념 제목
개념 본문
]`).blocks[0];
assert.equal(conceptWithTitle.title, "개념 제목");
assert.equal(conceptWithTitle.body, "개념 본문");
assert.equal(stringifyLessonMarkup([conceptWithTitle]), `[개념
## 개념 제목
개념 본문
]`);

const flowOrderCase = parseLessonMarkup(`[사례
본문 1
[[alpha]]
{{인용}}
본문 2
<답>
정답
</답>
]`).blocks[0];
assertJsonEqual(flowOrderCase.flow.map(item => item.type), ["text", "materials", "quote", "text", "answer"]);
assert.equal(stringifyLessonMarkup([flowOrderCase]), `[사례
본문 1
[[alpha]]
{{인용}}
본문 2
<답>
정답
</답>
]`);

const newTags = parseLessonMarkup(`[발문
질문입니다.
<답>
정답입니다.
</답>
<댓>
</댓>
]`).blocks[0];
assert.equal(newTags.prompts[0].answer, "정답입니다.");
assertJsonEqual(newTags.prompts[0].flow.map(item => item.type), ["text", "answer", "comment"]);
assert.equal(newTags.comments, undefined);

const inlineCommentTag = parseLessonMarkup(`[사례
본문입니다.
<댓></댓>
]`).blocks[0];
assertJsonEqual(inlineCommentTag.flow.map(item => item.type), ["text", "comment"]);
assert.equal(inlineCommentTag.comments, undefined);

const objectCommentToken = parseLessonMarkup(`[사례
본문입니다.
<댓>
]`).blocks[0];
assertJsonEqual(objectCommentToken.flow.map(item => item.type), ["text", "comment"]);
assert.equal(stringifyLessonMarkup([objectCommentToken]), `[사례
본문입니다.
<댓>
]`);

const conceptCommentTag = parseLessonMarkup(`[개념
개념 본문입니다.
<댓>
</댓>
]`).blocks[0];
assertJsonEqual(conceptCommentTag.flow.map(item => item.type), ["text", "comment"]);
assert.equal(conceptCommentTag.comments, undefined);

const standaloneComment = parseLessonMarkup(`<댓>`).blocks[0];
assertJsonEqual(standaloneComment, { type: "댓글" });
assert.equal(stringifyLessonMarkup([standaloneComment]), "<댓>");

const newExamTag = parseLessonMarkup(`<문>
exam-image
<답>
해설입니다.
</답>
</문>`).blocks[0];
assert.equal(newExamTag.items[0].image, "exam-image");
assert.equal(newExamTag.items[0].answer, "해설입니다.");

const legacyTags = parseLessonMarkup(`[사례
본문입니다.
<a>
옛 답입니다.
</a>
<c>
</c>
]`).blocks[0];
assert.equal(legacyTags.answer, "옛 답입니다.");
assertJsonEqual(legacyTags.flow.map(item => item.type), ["text", "answer", "comment"]);
assert.equal(legacyTags.comments, undefined);

const stringifiedTags = stringifyLessonMarkup([{
  type: "발문",
  comments: true,
  prompts: [{ q: "질문입니다.", answer: "정답입니다." }],
}, {
  type: "기출문제",
  items: [{ image: "exam-image", answer: "해설입니다." }],
}]);
assert.equal(stringifiedTags.includes("<답>"), true);
assert.equal(stringifiedTags.includes("<댓>"), true);
assert.equal(stringifiedTags.includes("</댓>"), false);
assert.equal(stringifiedTags.includes("<문>"), true);
assert.equal(stringifiedTags.includes("<a>"), false);
assert.equal(stringifiedTags.includes("<c>"), false);
assert.equal(stringifiedTags.includes("<p>"), false);
assert.equal(stringifiedTags.includes("</문>\n\n"), false);

// Grammar validation matrix:
// 1. Text structure works in every text-bearing block.
const textStructureBlocks = parseLessonMarkup(`문단 본문
%문단 보조%

[사례
사례 본문
%사례 보조%
]

[개념
## 개념 제목
개념 본문
%개념 보조%
]

[발문
발문 본문
%발문 보조%
]

>>
토글 본문
%토글 보조%
>>`);
assert.equal(textStructureBlocks.errors.length, 0);
assertJsonEqual(textStructureBlocks.blocks[0].asides, ["문단 보조"]);
assertJsonEqual(textStructureBlocks.blocks[1].asides, ["사례 보조"]);
assertJsonEqual(textStructureBlocks.blocks[2].asides, ["개념 보조"]);
assertJsonEqual(textStructureBlocks.blocks[3].prompts[0].asides, ["발문 보조"]);
assertJsonEqual(textStructureBlocks.blocks[4].asides, ["토글 보조"]);

// 2. Objects work inside every flow-based block.
const objectsInsideBlocks = parseLessonMarkup(`[사례
[[case-img==사례 캡션]]
{{사례 인용}}
[[case-img==A ~ B]] ~ {{사례 병렬}}
]

[개념
[[concept-img==개념 캡션]]
{{개념 인용}}
[[concept-img]] ~ {{개념 병렬}}
]

[발문
[[question-img==발문 캡션]]
{{발문 인용}}
[[question-img]] ~ {{발문 병렬}}
]`);
assert.equal(objectsInsideBlocks.errors.length, 0);
const [objectsInCase, objectsInConcept, objectsInQuestion] = objectsInsideBlocks.blocks;
assertJsonEqual(objectsInCase.flow.map(item => item.type), ["materials", "quote", "group"]);
assertJsonEqual(objectsInCase.flow[0].items, [{ ref: "case-img", caption: "사례 캡션" }]);
assertJsonEqual(objectsInCase.flow[2].items, [
  { ref: "case-img", caption: "A ~ B" },
  { type: "인용", body: "사례 병렬" },
]);
assertJsonEqual(objectsInConcept.flow.map(item => item.type), ["materials", "quote", "group"]);
assertJsonEqual(objectsInConcept.flow[0].items, [{ ref: "concept-img", caption: "개념 캡션" }]);
assertJsonEqual(objectsInQuestion.prompts[0].flow.map(item => item.type), ["materials", "quote", "group"]);
assertJsonEqual(objectsInQuestion.prompts[0].flow[0].items, [{ ref: "question-img", caption: "발문 캡션" }]);

const quoteAsideInGroup = parseLessonMarkup("[[드워킨]] ~ {{평등의 원칙;;%로널드 드워킨%}}").blocks[0];
assertJsonEqual(quoteAsideInGroup.items, [
  "드워킨",
  { type: "인용", body: "평등의 원칙", asides: ["로널드 드워킨"] },
]);
assert.equal(stringifyLessonMarkup([quoteAsideInGroup]), "[[드워킨]] ~ {{평등의 원칙;;%로널드 드워킨%}}");

// 3. Text structure works inside every object block's flow text item.
const textInsideObjects = parseLessonMarkup(`[사례
사례 텍스트
%사례 내부 보조%
[[alpha]]
사례 다음 텍스트
%사례 다음 보조%
]

[개념
개념 텍스트
%개념 내부 보조%
]

[발문
발문 텍스트
%발문 내부 보조%
[[alpha]]
발문 다음 텍스트
%발문 다음 보조%
]`);
assert.equal(textInsideObjects.errors.length, 0);
assertJsonEqual(textInsideObjects.blocks[0].flow[0].asides, ["사례 내부 보조"]);
assertJsonEqual(textInsideObjects.blocks[0].flow[2].asides, ["사례 다음 보조"]);
assertJsonEqual(textInsideObjects.blocks[1].flow[0].asides, ["개념 내부 보조"]);
assertJsonEqual(textInsideObjects.blocks[2].prompts[0].flow[0].asides, ["발문 내부 보조"]);
assertJsonEqual(textInsideObjects.blocks[2].prompts[0].flow[2].asides, ["발문 다음 보조"]);

// 4. Object-internal features are preserved inside object blocks.
const objectFeatures = parseLessonMarkup(`[사례
[[alpha==첫 줄;;둘째 줄]]
{{첫 줄;;둘째 줄;;%인용 출처%}}
[[alpha==A ~ B]] ~ {{C ~ D}}
<답>
해설 1
해설 2
</답>
<댓>
]`).blocks[0];
assertJsonEqual(objectFeatures.flow.map(item => item.type), ["materials", "quote", "group", "answer", "comment"]);
assertJsonEqual(objectFeatures.flow[0].items, [{ ref: "alpha", caption: "첫 줄\n둘째 줄" }]);
assert.equal(objectFeatures.flow[1].body, "첫 줄\n둘째 줄");
assertJsonEqual(objectFeatures.flow[1].asides, ["인용 출처"]);
assertJsonEqual(objectFeatures.flow[2].items, [
  { ref: "alpha", caption: "A ~ B" },
  { type: "인용", body: "C ~ D" },
]);
assertJsonEqual(objectFeatures.flow[3].answer, ["해설 1", "해설 2"]);
assert.equal(stringifyLessonMarkup([objectFeatures]), `[사례
[[alpha==첫 줄;;둘째 줄]]
{{첫 줄;;둘째 줄;;%인용 출처%}}
[[alpha==A ~ B]] ~ {{C ~ D}}
<답>
해설 1
해설 2
</답>
<댓>
]`);

console.log("lesson markup parser tests passed");
