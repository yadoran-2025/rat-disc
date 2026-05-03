document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rootContainer = document.getElementById('print-root');

    rootContainer.innerHTML = '<div class="print-message">불러오는 중...</div>';

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYkmQF4OJAcQN2FXGrmjYZP1Kr4geSX3t3O2ArB0_ntOqbvfgRzuoRwKSG--c3czenNUzyBVpW_f1R/pub?output=csv';

    try {
        // ?keys= 가 있으면 직접 키 목록 사용, 없으면 lesson JSON 로드
        const keysParam = urlParams.get('keys');
        let lessonData, keys;
        const sheetPromise = fetch(sheetUrl).then(r => r.text());

        if (keysParam) {
            keys = keysParam.split(',').map(k => k.trim()).filter(Boolean);
            lessonData = { header: urlParams.get('header') || '선택 문제 모음' };
        } else {
            const lessonId = urlParams.get('lesson') || 'print-list';
            lessonData = await fetch('lessons/' + lessonId + '.json').then(r => r.json());
            keys = lessonData.imageKeys || extractKeysFromSections(lessonData);
        }

        const sheetMap = parseSheetCSV(await sheetPromise);

        const imagesToPrint = keys.map(function(key) {
            const cleanKey = String(key).trim();
            const data = sheetMap[cleanKey];
            if (!data) return null;
            return { 
                key: cleanKey, 
                url: transformDriveUrl(data.url),
                keywords: data.keywords 
            };
        }).filter(function(img) { return img && img.url; });

        if (imagesToPrint.length === 0) {
            rootContainer.innerHTML = '<div class="print-message">표시할 자료가 없습니다.<br>JSON의 imageKeys가 구글 시트와 일치하는지 확인하세요.</div>';
            return;
        }

        await packImagesPerfectly(imagesToPrint, rootContainer, lessonData);

    } catch (error) {
        rootContainer.innerHTML = '<div class="print-message print-message--error">에러: ' + error.message + '</div>';
        console.error(error);
    }
});

async function packImagesPerfectly(images, rootContainer, lessonData) {
    const MAX_H = 1000; // A4 안전 세로 길이
    const COL_W = 370;
    const ITEM_GAP = 10;

    // 1. 모든 아이템의 높이를 미리 계산
    const measuredItems = await Promise.all(images.map(function(item) {
        return new Promise(function(resolve) {
            if (item.url.startsWith('text:')) {
                // 텍스트 컷아웃 높이 추정 (한 줄당 약 25px, 최소 150px)
                const textContent = item.url.slice(5);
                const lineCount = textContent.split(/\r?\n/).length;
                const h = Math.max(150, lineCount * 25 + 60); // 60은 여백 및 제목 공간
                resolve(Object.assign({}, item, { isText: true, h: h, rawH: h }));
            } else {
                const tempImg = new Image();
                tempImg.onload = function() {
                    const ratio = tempImg.height / tempImg.width;
                    const rawH = (ratio * COL_W) + 40; // 40은 캡션 공간
                    const h = Math.min(rawH, MAX_H - 20);
                    resolve(Object.assign({}, item, { isText: false, ratio: ratio, h: h, rawH: rawH }));
                };
                tempImg.onerror = function() {
                    resolve(Object.assign({}, item, { isText: false, ratio: 0.75, h: 0.75 * COL_W + 40, error: true }));
                };
                setTimeout(function() {
                    resolve(Object.assign({}, item, { isText: false, ratio: 0.75, h: 0.75 * COL_W + 40, error: true }));
                }, 5000);
                tempImg.src = item.url;
            }
        });
    }));

    // 2. 원래 순서 유지
    const sorted = measuredItems;

    // 3. 컬럼 풀 초기화
    let columns = [
        { items: [], h: 0, maxH: MAX_H },
        { items: [], h: 0, maxH: MAX_H }
    ];

    // 4. 순차 배치
    let currentColIndex = 0;
    for (let item of sorted) {
        while (true) {
            const col = columns[currentColIndex];
            const nextH = col.h === 0 ? item.h : col.h + ITEM_GAP + item.h;

            if (nextH <= col.maxH) {
                col.items.push(item);
                col.h = nextH;
                break;
            } else {
                currentColIndex++;
                if (currentColIndex >= columns.length) {
                    columns.push({ items: [], h: 0, maxH: MAX_H });
                    columns.push({ items: [], h: 0, maxH: MAX_H });
                }
            }
        }
    }

    // 5. 페이지 변환
    const pages = [];
    for (let i = 0; i < columns.length; i += 2) {
        const leftCol  = columns[i];
        const rightCol = columns[i + 1];
        if (leftCol.items.length === 0 && rightCol.items.length === 0) continue;
        pages.push({ left: leftCol.items, right: rightCol.items });
    }

    // 6. HTML 그리기
    rootContainer.innerHTML = '';
    let itemNumber = 1;
    pages.forEach(function(page, i) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page-content';
        pageDiv.id = 'print-page-' + (i + 1);

        pageDiv.appendChild(buildPageHeader(lessonData, images.length));

        const grid = document.createElement('div');
        grid.className = 'smart-grid';
        const leftCol = document.createElement('div'); leftCol.className = 'column';
        page.left.forEach(function(item) {
            leftCol.appendChild(createPrintCard(item, itemNumber));
            itemNumber++;
        });
        const rightCol = document.createElement('div'); rightCol.className = 'column';
        page.right.forEach(function(item) {
            rightCol.appendChild(createPrintCard(item, itemNumber));
            itemNumber++;
        });

        grid.appendChild(leftCol); grid.appendChild(rightCol);
        pageDiv.appendChild(grid);

        const footer = document.createElement('footer');
        footer.className = 'print-footer';
        footer.textContent = (i + 1) + ' / ' + pages.length;
        pageDiv.appendChild(footer);
        rootContainer.appendChild(pageDiv);
    });

    setupPrintToolbar(getPrintTitle(lessonData), images.length, pages.length);
}

function buildPageHeader(lessonData, totalCount) {
    const header = document.createElement('div');
    header.className = 'page-header';

    const row = document.createElement('div');
    row.className = 'header-row';

    const label = document.createElement('span');
    label.className = 'header-label';
    label.textContent = getPrintTitle(lessonData);

    const meta = document.createElement('span');
    meta.className = 'header-meta';
    meta.textContent = '전체 ' + totalCount + '문제';

    row.appendChild(label);
    row.appendChild(meta);
    header.appendChild(row);

    const line = document.createElement('div');
    line.className = 'header-line-wrapper';
    line.innerHTML = '<div class="header-line-accent"></div><div class="header-line-base"></div>';
    header.appendChild(line);

    if (lessonData.title || lessonData.subtitle) {
        const titleArea = document.createElement('div');
        titleArea.className = 'page-title-area';
        if (lessonData.title) {
            const title = document.createElement('h1');
            title.textContent = lessonData.title;
            titleArea.appendChild(title);
        }
        if (lessonData.subtitle) {
            const subtitle = document.createElement('p');
            subtitle.textContent = lessonData.subtitle;
            titleArea.appendChild(subtitle);
        }
        header.appendChild(titleArea);
    }

    return header;
}

function createPrintCard(item, number) {
    const card = document.createElement('div');
    card.className = 'image-item';
    
    const caption = document.createElement('div');
    caption.className = 'caption';

    const numberLabel = document.createElement('div');
    numberLabel.className = 'caption-number';
    numberLabel.textContent = number;
    caption.appendChild(numberLabel);

    const captionBody = document.createElement('div');
    captionBody.className = 'caption-body';
    
    const keyLabel = document.createElement('span');
    keyLabel.className = 'caption-key';
    keyLabel.textContent = item.key;
    captionBody.appendChild(keyLabel);

    if (item.keywords && item.keywords.length > 0) {
        const tags = document.createElement('div');
        tags.className = 'caption-tags';
        item.keywords.forEach(function(kw) {
            const tag = document.createElement('span');
            tag.className = 'tag-badge';
            tag.textContent = kw;
            tags.appendChild(tag);
        });
        captionBody.appendChild(tags);
    }

    caption.appendChild(captionBody);
    
    card.appendChild(caption);

    if (item.isText) {
        const textBody = item.url.slice(5);
        card.appendChild(buildTextCutout(textBody));
    } else {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.key;
        card.appendChild(img);
    }
    return card;
}

function getPrintTitle(lessonData) {
    return lessonData.header || lessonData.title || '기출문제';
}

function setupPrintToolbar(title, totalCount, totalPages) {
    const titleEl = document.getElementById('print-context-title');
    const countEl = document.getElementById('print-context-count');
    const statusEl = document.getElementById('print-page-status');
    const prevBtn = document.getElementById('print-prev-page');
    const nextBtn = document.getElementById('print-next-page');
    if (!titleEl || !countEl || !statusEl || !prevBtn || !nextBtn) return;

    let currentPage = 1;
    titleEl.textContent = title;
    countEl.textContent = '문제 ' + totalCount + '개';

    function updateStatus() {
        statusEl.textContent = currentPage + ' / ' + totalPages + ' 페이지';
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
    }

    function moveToPage(pageNumber) {
        currentPage = Math.max(1, Math.min(totalPages, pageNumber));
        const page = document.getElementById('print-page-' + currentPage);
        if (page) page.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateStatus();
    }

    prevBtn.onclick = function() { moveToPage(currentPage - 1); };
    nextBtn.onclick = function() { moveToPage(currentPage + 1); };
    updateStatus();
}

function buildTextCutout(body) {
    const wrap = document.createElement('div');
    wrap.className = 'text-cutout';

    const cleanBody = body.trim().replace(/\r\n/g, '\n');
    const parts = cleanBody.split(/\n---\n/);
    const mainPart = parts[0].trim();
    const sourcePart = parts[1] ? parts[1].trim() : null;

    const lines = mainPart.split('\n');
    let headline = null;
    let restLines = [...lines];

    if (lines[0] && /^##\s?/.test(lines[0])) {
        headline = lines[0].replace(/^##\s?/, '').trim();
        restLines = lines.slice(1);
        while (restLines.length && !restLines[0].trim()) restLines.shift();
    }

    if (headline) {
        const h = document.createElement('div');
        h.className = 'text-cutout__headline';
        h.textContent = headline;
        wrap.appendChild(h);
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'text-cutout__body';
    bodyEl.textContent = restLines.join('\n');
    wrap.appendChild(bodyEl);

    if (sourcePart) {
        const src = document.createElement('div');
        src.className = 'text-cutout__source';
        src.textContent = sourcePart;
        wrap.appendChild(src);
    }

    return wrap;
}

function parseSheetCSV(csvText) {
    const map = {};
    const lines = csvText.split(/\r?\n/);
    lines.forEach(function(line, index) {
        if (index === 0 || !line.trim()) return;
        const cells = [];
        let curr = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { cells.push(curr.trim()); curr = ''; }
            else curr += char;
        }
        cells.push(curr.trim());
        const key = cells[0] ? cells[0].replace(/^"|"$/g, '') : '';
        const url = cells[1] ? cells[1].replace(/^"|"$/g, '') : '';
        const keywordsRaw = cells[2] ? cells[2].replace(/^"|"$/g, '') : '';
        const keywords = keywordsRaw.split(',').map(s => s.trim()).filter(Boolean);

        if (key && url) {
            map[key] = { url: url, keywords: keywords };
        }
    });
    return map;
}

function extractKeysFromSections(data) {
    const keys = [];
    if (data.sections) {
        data.sections.forEach(function(s) {
            s.blocks.forEach(function(b) {
                if (b.imagePair) {
                    b.imagePair.forEach(function(k) { keys.push(k); });
                }
            });
        });
    }
    return keys;
}

function transformDriveUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('text:')) return url; // text: 는 변환 생략
    if (!url.includes('drive.google.com')) return url;
    const id = url.match(/\/d\/([^/]+)/);
    const id2 = url.match(/id=([^&]+)/);
    const rawId = (id && id[1]) || (id2 && id2[1]);
    if (!rawId) return url;
    const cleanId = rawId.split(/[/?&]/)[0];
    return 'https://lh3.googleusercontent.com/d/' + cleanId;
}
