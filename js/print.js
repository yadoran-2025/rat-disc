document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lesson') || 'print-list';
    const rootContainer = document.getElementById('print-root');

    rootContainer.innerHTML = '<div style="text-align:center; padding:50px; color:#666;">불러오는 중...</div>';

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYkmQF4OJAcQN2FXGrmjYZP1Kr4geSX3t3O2ArB0_ntOqbvfgRzuoRwKSG--c3czenNUzyBVpW_f1R/pub?output=csv';

    try {
        const [lessonRes, sheetRes] = await Promise.all([
            fetch('lessons/' + lessonId + '.json').then(r => r.json()),
            fetch(sheetUrl).then(r => r.text())
        ]);

        const sheetMap = parseSheetCSV(sheetRes);
        const keys = lessonRes.imageKeys || extractKeysFromSections(lessonRes);

        const imagesToPrint = keys.map(function(key) {
            const cleanKey = String(key).trim();
            return { key: cleanKey, url: transformDriveUrl(sheetMap[cleanKey]) };
        }).filter(function(img) { return img.url; });

        if (imagesToPrint.length === 0) {
            rootContainer.innerHTML = '<div style="padding:40px; color:#999; text-align:center;">표시할 이미지가 없습니다.<br>JSON의 imageKeys가 구글 시트와 일치하는지 확인하세요.</div>';
            return;
        }

        await packImagesPerfectly(imagesToPrint, rootContainer, lessonRes);

    } catch (error) {
        rootContainer.innerHTML = '<div style="padding:20px; color:red;">에러: ' + error.message + '</div>';
        console.error(error);
    }
});

async function packImagesPerfectly(images, rootContainer, lessonData) {
    const MAX_H = 1000; // A4 안전 세로 길이 (px 환산 기준)
    const COL_W = 370;
    const ITEM_GAP = 25;

    // 1. 모든 이미지의 높이를 미리 계산
    const measuredImages = await Promise.all(images.map(function(img) {
        return new Promise(function(resolve) {
            const tempImg = new Image();
            tempImg.onload = function() {
                const ratio = tempImg.height / tempImg.width;
                const rawH = (ratio * COL_W) + 40;
                const h = Math.min(rawH, MAX_H - 20);
                resolve(Object.assign({}, img, { ratio: ratio, h: h, rawH: rawH }));
            };
            tempImg.onerror = function() {
                resolve(Object.assign({}, img, { ratio: 0.75, h: 0.75 * COL_W + 40, error: true }));
            };
            setTimeout(function() {
                resolve(Object.assign({}, img, { ratio: 0.75, h: 0.75 * COL_W + 40, error: true }));
            }, 5000);
            tempImg.src = img.url;
        });
    }));

    // 2. 정렬 없이 원래 JSON 순서 유지
    const sorted = measuredImages;

    // 3. 컬럼 풀 초기화 (헤더가 absolute 배치라 모든 컬럼 maxH 동일)
    let columns = [
        { items: [], h: 0, maxH: MAX_H },
        { items: [], h: 0, maxH: MAX_H }
    ];

    // 4. 순차 배치: 왼쪽 열 → 오른쪽 열 → 다음 페이지 왼쪽 → ...
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

    // 5. 컬럼들을 페이지로 변환
    const pages = [];
    for (let i = 0; i < columns.length; i += 2) {
        const leftCol  = columns[i];
        const rightCol = columns[i + 1];
        if (leftCol.items.length === 0 && rightCol.items.length === 0) continue;
        pages.push({ left: leftCol.items, right: rightCol.items });
    }

    // 6. HTML 그리기
    rootContainer.innerHTML = '';
    pages.forEach(function(page, i) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page-content';

        // 모든 페이지: 상단 여백 안에 절대 위치 헤더
        const header = document.createElement('div');
        header.className = 'page-header';

        let headerHTML = '';
        headerHTML += '<div class="header-top">';
        headerHTML += '<span class="header-label">' + (lessonData.header || '') + '</span>';
        headerHTML += '</div>';
        headerHTML += '<div class="header-line-wrapper">';
        headerHTML += '<div class="header-line-accent"></div>';
        headerHTML += '<div class="header-line-base"></div>';
        headerHTML += '</div>';

        // 첫 페이지에만 title / subtitle 추가
        if (i === 0 && (lessonData.title || lessonData.subtitle)) {
            headerHTML += '<div class="page-title-area">';
            if (lessonData.title)    headerHTML += '<h1>' + lessonData.title + '</h1>';
            if (lessonData.subtitle) headerHTML += '<p>'  + lessonData.subtitle + '</p>';
            headerHTML += '</div>';
        }

        header.innerHTML = headerHTML;
        pageDiv.appendChild(header);

        // 문제 그리드
        const grid = document.createElement('div');
        grid.className = 'smart-grid';

        const leftCol = document.createElement('div');
        leftCol.className = 'column';
        page.left.forEach(function(img) { leftCol.appendChild(createImageCard(img)); });

        const rightCol = document.createElement('div');
        rightCol.className = 'column';
        page.right.forEach(function(img) { rightCol.appendChild(createImageCard(img)); });

        grid.appendChild(leftCol);
        grid.appendChild(rightCol);
        pageDiv.appendChild(grid);

        // 페이지 번호
        const footer = document.createElement('footer');
        footer.className = 'print-footer';
        footer.textContent = '- ' + (i + 1) + ' -';
        pageDiv.appendChild(footer);

        rootContainer.appendChild(pageDiv);
    });
}

function createImageCard(imgData) {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.innerHTML = '<div class="caption">' + imgData.key + '</div>' +
                     '<img src="' + imgData.url + '" alt="' + imgData.key + '">';
    return item;
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
        const key = cells[1] ? cells[1].replace(/^"|"$/g, '') : '';
        const url = cells[3] ? cells[3].replace(/^"|"$/g, '') : '';
        if (key && url && url.startsWith('http')) map[key] = url;
    });
    return map;
}

function extractKeysFromSections(data) {
    const keys = [];
    if (data.sections) {
        data.sections.forEach(function(s) {
            s.blocks.forEach(function(b) {
                if (b.imagePair) keys.push.apply(keys, b.imagePair);
            });
        });
    }
    return keys;
}

function transformDriveUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (!url.includes('drive.google.com')) return url;
    const id = url.match(/\/d\/([^/]+)/);
    const id2 = url.match(/id=([^&]+)/);
    const rawId = (id && id[1]) || (id2 && id2[1]);
    if (!rawId) return url;
    const cleanId = rawId.split(/[/?&]/)[0];
    return 'https://lh3.googleusercontent.com/d/' + cleanId;
}
