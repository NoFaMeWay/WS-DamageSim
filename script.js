/* ==========================================================================
   Weiß Schwarz 伤害模拟计算器 v2.0
   模块化架构：Parser / Simulator / Charts / Storage / UI / App
   ========================================================================== */

// ==================== 工具函数 ====================
const Utils = (() => {
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function randInt(max) {
        return Math.floor(Math.random() * max);
    }

    function sum(arr) {
        return arr.reduce((a, b) => a + b, 0);
    }

    function mean(arr) {
        return arr.length ? sum(arr) / arr.length : 0;
    }

    function std(arr) {
        if (arr.length < 2) return 0;
        const m = mean(arr);
        return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    return { shuffle, randInt, sum, mean, std, clamp };
})();

// ==================== 伤害序列解析器 ====================
const Parser = (() => {
    /**
     * 解析伤害序列字符串为结构化数组
     * 返回: [item, ...]
     *   item 可以是:
     *     number          - 基本伤害
     *     "fxN"           - 反洗
     *     "XX>YYN"        - 卡片移动
     *     [dmg, "zj", [seq]]  - 追加伤害
     *     [dmg, "*zj", [seq]] - 传火追加
     *     ["XX>YYN:C", "zj", [seq]] - 条件移动追加
     *     "XX+/-C/N"      - 卡片添加/移除
     */
    /**
     * 智能分割：按逗号分割，但尊重括号嵌套
     */
    function splitByComma(str) {
        const parts = [];
        let depth = 0;
        let current = '';
        for (const ch of str) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (ch === ',' && depth === 0) {
                if (current.trim()) parts.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        if (current.trim()) parts.push(current.trim());
        return parts;
    }

    function parse(str) {
        if (!str || !str.trim()) return [];
        str = str.replace(/，/g, ',').trim();

        const parts = splitByComma(str);
        const result = [];

        for (let part of parts) {
            if (!part) continue;

            // 传火标记
            let isSpread = false;
            if (part.startsWith('*')) {
                isSpread = true;
                part = part.substring(1);
            }

            // 追加伤害: Nzj(...)
            const zjMatch = part.match(/^(\d+)zj\((.+)\)$/);
            if (zjMatch) {
                const dmg = parseInt(zjMatch[1]);
                const innerSeq = parse(zjMatch[2]);
                result.push([dmg, isSpread ? '*zj' : 'zj', innerSeq]);
                continue;
            }

            // 反洗: fxN
            if (/^fx\d+$/i.test(part)) {
                result.push(part.toLowerCase());
                continue;
            }

            // 条件移动追加: XX>YYN:C+zj(...) 或 XX>YYN:N+zj(...)
            const condZjMatch = part.match(/^([A-Z]{2}>[A-Z]{2}\d*):([CN])\+zj\((.+)\)$/);
            if (condZjMatch) {
                const moveOp = condZjMatch[1];
                const condition = condZjMatch[2];
                const innerSeq = parse(condZjMatch[3]);
                result.push([`${moveOp}:${condition}`, 'zj', innerSeq]);
                continue;
            }

            // 卡片移动: XX>YYN
            if (/^[A-Z]{2}>[A-Z]{2}\d*$/.test(part)) {
                result.push(part);
                continue;
            }

            // 卡片添加/移除: XX+/-C/N
            if (/^(?:DT|DB|RS|CL)[+-][CN]$/.test(part)) {
                result.push(part);
                continue;
            }

            // 基本伤害: 纯数字
            if (/^\d+$/.test(part)) {
                result.push(parseInt(part));
                continue;
            }

            throw new Error(`无法识别的序列片段: "${part}"`);
        }

        return result;
    }

    /** 格式化伤害序列为字符串 */
    function format(seq) {
        const parts = seq.map(item => {
            if (Array.isArray(item)) {
                const [a, effect, inner] = item;
                if (typeof a === 'string') {
                    return `${a}+${effect}(${format(inner)})`;
                }
                const prefix = effect === '*zj' ? '*' : '';
                return `${prefix}${a}zj(${format(inner)})`;
            }
            return String(item);
        });
        return parts.join(',');
    }

    /** 生成人类可读的结构描述 */
    function describe(seq, indent = 0) {
        const prefix = '  '.repeat(indent);
        let lines = [];

        const locMap = { DT: '牌组顶部', DB: '牌组底部', RS: '休息室', CL: '计时区', HD: '手牌' };
        const opMap = { '+': '添加', '-': '移除' };
        const cardMap = { N: '普通卡', C: '高潮卡' };

        for (const item of seq) {
            if (Array.isArray(item)) {
                const [a, effect, inner] = item;
                if (typeof a === 'string') {
                    // 条件移动追加
                    const [moveOp, condition] = a.split(':');
                    const from = moveOp.substring(0, 2);
                    const to = moveOp.substring(3, 5);
                    const count = moveOp.length > 5 ? parseInt(moveOp.substring(5)) : 1;
                    const condText = condition === 'C' ? '高潮卡' : '普通卡';
                    lines.push(`${prefix}· 从${locMap[from] || from}移动${count}张牌到${locMap[to] || to}，若包含${condText}则追加：`);
                    lines.push(...describe(inner, indent + 1));
                } else {
                    const effName = effect === '*zj' ? '传火追加' : '追加伤害';
                    lines.push(`${prefix}· ${a}点伤害 → 取消后${effName}：`);
                    lines.push(...describe(inner, indent + 1));
                }
            } else if (typeof item === 'string' && item.startsWith('fx')) {
                lines.push(`${prefix}· 反洗${item.substring(2)}张非高潮卡`);
            } else if (typeof item === 'string' && item.includes('>')) {
                const parts = item.split('>');
                const from = parts[0].substring(0, 2);
                const toPart = parts[1];
                const to = toPart.substring(0, 2);
                const count = toPart.length > 2 ? parseInt(toPart.substring(2)) : 1;
                lines.push(`${prefix}· 从${locMap[from] || from}移动${count}张牌到${locMap[to] || to}`);
            } else if (typeof item === 'string' && /^(DT|DB|RS|CL)[+-][CN]$/.test(item)) {
                const loc = locMap[item.substring(0, 2)] || item.substring(0, 2);
                const op = opMap[item.charAt(2)] || item.charAt(2);
                const card = cardMap[item.charAt(3)] || item.charAt(3);
                lines.push(`${prefix}· ${loc}${op}一张${card}`);
            } else if (typeof item === 'number') {
                lines.push(`${prefix}· ${item}点伤害`);
            }
        }
        return lines;
    }

    return { parse, format, describe };
})();

// ==================== 伤害模拟引擎 ====================
const Simulator = (() => {
    /**
     * 创建牌组: 1=高潮卡, 0=普通卡
     */
    function createPile(total, climax) {
        const pile = [];
        for (let i = 0; i < climax; i++) pile.push(1);
        for (let i = 0; i < total - climax; i++) pile.push(0);
        Utils.shuffle(pile);
        return pile;
    }

    /**
     * 检查升级：当时钟区>=7张时触发
     * 从时钟区前7张中选1张普通卡作为等级卡（移除），其余放入休息室
     * 若无普通卡则移除第1张
     */
    function checkLevelUp(clock, rest) {
        let levelUps = 0;

        while (clock.length >= 7) {
            levelUps++;
            const cards = clock.splice(0, 7);

            // 优先选择普通卡作为等级卡（移出游戏）
            const normalIdx = cards.indexOf(0);
            if (normalIdx >= 0) {
                cards.splice(normalIdx, 1);  // 移除等级卡（出游戏）
            } else {
                cards.shift();  // 全是高潮卡，移除第1张
            }

            // 其余卡放入休息室（clock和rest都是引用传递，原地修改）
            rest.push(...cards);
        }

        return levelUps;
    }

    /**
     * 解析移动操作字符串
     */
    function parseMove(moveStr) {
        const parts = moveStr.split('>');
        const from = parts[0];
        const toPart = parts[1];
        const to = toPart.substring(0, 2);
        const count = toPart.length > 2 ? parseInt(toPart.substring(2)) : 1;
        return { from, to, count };
    }

    /**
     * 移动卡片
     */
    function moveCards(from, to, count, deck, rest, clock) {
        let movedClimax = 0;
        let movedNormal = 0;
        let refreshIncrement = 0;

        const sourcePile = (() => {
            switch (from) {
                case 'DT': return deck;
                case 'DB': return deck;  // 从底部取
                case 'RS': return rest;
                case 'CL': return clock;
                default: return null;
            }
        })();

        if (!sourcePile) return { deck, rest, clock, movedClimax, movedNormal, refresh: 0 };

        const taken = [];
        const actual = Math.min(count, sourcePile.length);

        for (let i = 0; i < actual; i++) {
            let card;
            if (from === 'DB') {
                card = sourcePile.pop();
            } else {
                card = sourcePile.shift();
            }
            if (card === 1) movedClimax++;
            else movedNormal++;
            taken.push(card);
        }

        // 放到目标位置
        const dest = (() => {
            switch (to) {
                case 'DT': return { pile: deck, method: 'unshift' };
                case 'DB': return { pile: deck, method: 'push' };
                case 'RS': return { pile: rest, method: 'push' };
                case 'CL': return { pile: clock, method: 'push' };
                case 'HD': return { pile: null, method: null };
                default: return { pile: null, method: null };
            }
        })();

        if (dest.pile && dest.method === 'unshift') {
            dest.pile.unshift(...taken);
        } else if (dest.pile && dest.method === 'push') {
            dest.pile.push(...taken);
        }

        // 放入计时区 = 造成伤害
        let damageFromMove = 0;
        if (to === 'CL') {
            damageFromMove = taken.length;
        }
        // 从计时区移除 = 减少伤害
        if (from === 'CL') {
            damageFromMove = -taken.length;
        }

        return { deck, rest, clock, movedClimax, movedNormal, damageFromMove, refresh: refreshIncrement };
    }

    /**
     * 反洗操作：从休息室选N张非高潮卡洗回牌组
     */
    function doRefreshX(rest, deck, count) {
        const taken = [];
        for (let i = rest.length - 1; i >= 0 && taken.length < count; i--) {
            if (rest[i] === 0) {
                taken.push(...rest.splice(i, 1));
            }
        }
        deck.push(...taken);
        Utils.shuffle(deck);
        return { rest, deck };
    }

    /**
     * 单次模拟
     * @returns {{ damage: number, refresh: number, levelUp: number }}
     */
    function singleSimulation(D, N, R, RC, C, CC, damageSeq, drawCard) {
        let deck = createPile(D, N);
        let rest = createPile(R, RC);
        let clock = createPile(C, CC);
        let totalDamage = 0;
        let refreshCount = 0;
        let levelUpCount = 0;

        // 牌组刷新辅助函数
        function ensureDeck() {
            if (deck.length === 0) {
                if (rest.length === 0) return false;
                refreshCount++;
                deck = [...rest];
                rest = [];
                Utils.shuffle(deck);
            }
            return true;
        }

        /**
         * 处理单个伤害项
         * @returns {{ cancelled: boolean, carrySzj: object|null }}
         */
        function processItem(item) {
            // --- 反洗 fx ---
            if (typeof item === 'string' && item.startsWith('fx')) {
                const count = parseInt(item.substring(2));
                ({ rest, deck } = doRefreshX(rest, deck, count));
                return { cancelled: false, carrySzj: null };
            }

            // --- 条件移动追加 ---
            if (Array.isArray(item) && typeof item[0] === 'string' && item[0].includes(':')) {
                const [moveOp, , zjSeq] = item;
                const [movePart, condition] = moveOp.split(':');
                const { from, to, count } = parseMove(movePart);

                const { movedClimax, movedNormal, damageFromMove } =
                    moveCards(from, to, count, deck, rest, clock);
                totalDamage += damageFromMove;

                // 检查条件
                const conditionMet = (condition === 'C' && movedClimax > 0) ||
                                     (condition === 'N' && movedNormal > 0);

                // 检查升级（clock和rest原地修改）
                levelUpCount += checkLevelUp(clock, rest);

                if (conditionMet && zjSeq) {
                    for (const zjItem of zjSeq) {
                        const r = processItem(zjItem);
                        // 递归处理，但carrySzj不向上传递
                    }
                }
                return { cancelled: false, carrySzj: null };
            }

            // --- 卡片添加/移除 ---
            if (typeof item === 'string' && /^(DT|DB|RS|CL)[+-][CN]$/.test(item)) {
                const loc = item.substring(0, 2);
                const op = item.charAt(2);
                const cardType = item.charAt(3) === 'C' ? 1 : 0;

                if (op === '+') {
                    if (loc === 'DT') deck.unshift(cardType);
                    else if (loc === 'DB') deck.push(cardType);
                    else if (loc === 'RS') rest.push(cardType);
                    else if (loc === 'CL') { clock.push(cardType); totalDamage++; }
                } else {
                    const targetPile = loc === 'DT' ? deck : loc === 'DB' ? deck : loc === 'RS' ? rest : clock;
                    const idx = targetPile.indexOf(cardType);
                    if (idx >= 0) {
                        targetPile.splice(idx, 1);
                        if (loc === 'CL') totalDamage--;
                    }
                }
                levelUpCount += checkLevelUp(clock, rest);
                return { cancelled: false, carrySzj: null };
            }

            // --- 卡片移动 ---
            if (typeof item === 'string' && item.includes('>')) {
                const { from, to, count } = parseMove(item);
                const result = moveCards(from, to, count, deck, rest, clock);
                deck = result.deck;
                rest = result.rest;
                clock = result.clock;
                totalDamage += result.damageFromMove;
                refreshCount += result.refresh;

                if (to === 'CL' || from === 'CL') {
                    levelUpCount += checkLevelUp(clock, rest);
                }
                return { cancelled: false, carrySzj: null };
            }

            // --- 伤害项（数字或 [dmg, effect, zjSeq]） ---
            let dmg, effectType, zjSeq;
            if (Array.isArray(item)) {
                [dmg, effectType, zjSeq] = item;
            } else {
                dmg = item;
                effectType = null;
                zjSeq = null;
            }

            if (typeof dmg !== 'number' || dmg <= 0) {
                return { cancelled: false, carrySzj: null };
            }

            let processingZone = [];
            let cancelled = false;

            for (let i = 0; i < dmg; i++) {
                if (!ensureDeck()) break;

                const card = deck.shift();
                processingZone.push(card);

                if (card === 1) {
                    // 高潮卡 → 取消
                    cancelled = true;
                    break;
                }
            }

            if (cancelled) {
                // 取消：翻出的所有卡进休息室
                rest.push(...processingZone);

                if (effectType === '*zj' || effectType === 'szj') {
                    // 传火追加：执行追加 + 传递效果给下一个伤害
                    if (zjSeq) {
                        for (const zjItem of zjSeq) {
                            processItem(zjItem);
                        }
                    }
                    return { cancelled: true, carrySzj: { dmg, zjSeq: zjSeq || [] } };
                } else if (effectType === 'zj') {
                    // 普通追加：只执行追加
                    if (zjSeq) {
                        for (const zjItem of zjSeq) {
                            processItem(zjItem);
                        }
                    }
                }
            } else {
                // 未取消：翻出的所有卡进计时区（造成伤害）
                clock.push(...processingZone);
                totalDamage += processingZone.length;

                // 检查升级
                levelUpCount += checkLevelUp(clock, rest);
            }

            return { cancelled, carrySzj: null };
        }

        // --- 主循环 ---
        let carrySzj = null;
        for (let i = 0; i < damageSeq.length; i++) {
            ensureDeck();
            let item = damageSeq[i];

            // 处理传火追加效果传递
            if (carrySzj) {
                const { dmg: carryDmg, zjSeq: carrySeq } = carrySzj;

                if (typeof item === 'number') {
                    item = [item, '*zj', carrySeq];
                } else if (Array.isArray(item) && item.length === 3) {
                    const [curDmg, curEffect, curSeq] = item;
                    if (curEffect === '*zj') {
                        item = [curDmg, '*zj', [...curSeq, ...carrySeq]];
                    } else {
                        item = [curDmg, '*zj', carrySeq];
                    }
                }
                carrySzj = null;
            }

            const result = processItem(item);

            if (result.cancelled && result.carrySzj) {
                carrySzj = result.carrySzj;
            }
        }

        // 处理末尾剩余传火
        if (carrySzj) {
            const { dmg: carryDmg, zjSeq: carrySeq } = carrySzj;
            processItem([carryDmg, '*zj', carrySeq]);
        }

        // 抽牌（伤害步骤后）
        if (drawCard) {
            if (ensureDeck() && deck.length > 0) {
                const card = deck.shift();
                clock.push(card);
                totalDamage++;
                levelUpCount += checkLevelUp(clock, rest);
            }
        }

        return { damage: totalDamage, refresh: refreshCount, levelUp: levelUpCount };
    }

    /**
     * 批量模拟
     * @param {number} trials - 模拟次数
     * @param {function} onProgress - 进度回调 (current, total)
     * @returns {{ damages: number[], refreshes: number[], levelUps: number[] }}
     */
    function runSimulation(D, N, R, RC, C, CC, damageSeq, drawCard, trials, onProgress) {
        const damages = new Array(trials);
        const refreshes = new Array(trials);
        const levelUps = new Array(trials);

        const batchSize = 5000;
        let completed = 0;

        function runBatch(startIdx) {
            const endIdx = Math.min(startIdx + batchSize, trials);
            for (let i = startIdx; i < endIdx; i++) {
                const result = singleSimulation(D, N, R, RC, C, CC, damageSeq, drawCard);
                damages[i] = result.damage;
                refreshes[i] = result.refresh;
                levelUps[i] = result.levelUp;
            }
            completed = endIdx;
            if (onProgress) onProgress(completed, trials);

            if (completed < trials) {
                // 使用 setTimeout 避免阻塞UI
                return new Promise(resolve => {
                    setTimeout(() => resolve(runBatch(completed)), 0);
                });
            }
            return { damages, refreshes, levelUps };
        }

        return runBatch(0);
    }

    return { singleSimulation, runSimulation };
})();

// ==================== 图表模块 ====================
const Charts = (() => {
    let probChart = null;
    let compareChart = null;

    const CHART_COLORS = [
        '#e85d75', '#4ecdc4', '#c9a84c', '#7c5ce7',
        '#5b8def', '#f0a050', '#50d0a0', '#f070c0',
        '#80b0ff', '#ffd060'
    ];

    function destroyProbChart() {
        if (probChart) { probChart.destroy(); probChart = null; }
    }

    function destroyCompareChart() {
        if (compareChart) { compareChart.destroy(); compareChart = null; }
    }

    /**
     * 创建概率分布柱状图
     */
    function createProbChart(canvas, probs, label) {
        destroyProbChart();

        const labels = probs.map((_, i) => `≥${i}`);
        const colors = probs.map((_, i) => {
            const t = i / Math.max(probs.length - 1, 1);
            // 从金色渐变到紫色
            const r = Math.round(201 + (124 - 201) * t);
            const g = Math.round(168 + (92 - 168) * t);
            const b = Math.round(76 + (231 - 76) * t);
            return `rgba(${r},${g},${b},0.75)`;
        });

        probChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: label || '概率',
                    data: probs,
                    backgroundColor: colors,
                    borderColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: 3,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.4,
                animation: { duration: 400 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1c1c34',
                        titleColor: '#e4e4f0',
                        bodyColor: '#c9a84c',
                        borderColor: '#262648',
                        borderWidth: 1,
                        cornerRadius: 6,
                        padding: 10,
                        callbacks: {
                            label: (ctx) => `P(≥ ${ctx.dataIndex}) = ${(ctx.raw * 100).toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '至少造成的伤害点数', color: '#5e5e7a', font: { size: 11 } },
                        ticks: {
                            color: '#5e5e7a',
                            maxTicksLimit: 25,
                            font: { size: 10 },
                            callback: (v) => (probs.length > 25 && v % 2 !== 0) ? '' : v
                        },
                        grid: { color: 'rgba(255,255,255,0.02)', drawTicks: false }
                    },
                    y: {
                        title: { display: true, text: '概率', color: '#5e5e7a', font: { size: 11 } },
                        min: 0, max: 1,
                        ticks: {
                            color: '#5e5e7a',
                            font: { size: 10 },
                            callback: (v) => (v * 100).toFixed(0) + '%',
                            stepSize: 0.1
                        },
                        grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false }
                    }
                }
            }
        });
        return probChart;
    }

    /**
     * 创建对比折线图
     */
    function createCompareChart(canvas, datasets) {
        destroyCompareChart();

        const maxLen = Math.max(...datasets.map(d => d.probs.length));
        const labels = Array.from({ length: maxLen }, (_, i) => `≥${i}`);

        const chartDatasets = datasets.map((ds, i) => ({
            label: ds.label,
            data: ds.probs.concat(new Array(maxLen - ds.probs.length).fill(0)),
            borderColor: CHART_COLORS[i % CHART_COLORS.length],
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '20',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            tension: 0.15,
            fill: false,
        }));

        compareChart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets: chartDatasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.2,
                animation: { duration: 400 },
                plugins: {
                    legend: {
                        labels: {
                            color: '#8e8eb0',
                            usePointStyle: true,
                            pointStyleWidth: 8,
                            padding: 18,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1c1c34',
                        borderColor: '#262648',
                        borderWidth: 1,
                        cornerRadius: 6,
                        padding: 10,
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: P(≥${ctx.dataIndex}) = ${(ctx.raw * 100).toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '至少造成的伤害点数', color: '#5e5e7a', font: { size: 11 } },
                        ticks: {
                            color: '#5e5e7a',
                            maxTicksLimit: 25,
                            font: { size: 10 },
                            callback: (v) => (maxLen > 25 && v % 2 !== 0) ? '' : v
                        },
                        grid: { color: 'rgba(255,255,255,0.02)', drawTicks: false }
                    },
                    y: {
                        title: { display: true, text: '概率', color: '#5e5e7a', font: { size: 11 } },
                        min: 0, max: 1,
                        ticks: {
                            color: '#5e5e7a',
                            font: { size: 10 },
                            callback: (v) => (v * 100).toFixed(0) + '%',
                            stepSize: 0.1
                        },
                        grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false }
                    }
                },
                interaction: { mode: 'index', intersect: false }
            }
        });
        return compareChart;
    }

    return { createProbChart, createCompareChart, destroyProbChart, destroyCompareChart, CHART_COLORS };
})();

// ==================== 存储模块 ====================
const Storage = (() => {
    const KEY = 'ws_damage_sim_configs';

    function loadAll() {
        try {
            const raw = localStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveAll(configs) {
        try {
            localStorage.setItem(KEY, JSON.stringify(configs));
        } catch (e) {
            UI.showToast('存储空间不足，请清理旧配置', 'error');
        }
    }

    function save(name, params, results) {
        const configs = loadAll();
        configs[name] = {
            name,
            params,
            results,
            savedAt: new Date().toISOString()
        };
        saveAll(configs);
    }

    function remove(name) {
        const configs = loadAll();
        delete configs[name];
        saveAll(configs);
    }

    function clearAll() {
        saveAll({});
    }

    function get(name) {
        const configs = loadAll();
        return configs[name] || null;
    }

    function getAllNames() {
        return Object.keys(loadAll());
    }

    /**
     * 生成CSV内容
     */
    function generateCSV(configNames) {
        const configs = loadAll();
        const selected = configNames.map(n => configs[n]).filter(Boolean);

        if (!selected.length) return '';

        const lines = [];

        // 表头
        lines.push('配置名称,牌组大小,高潮卡数,休息室总数,休息室高潮数,计时区总数,计时区高潮数,抽牌,期望伤害,标准差,最低伤害,最高伤害,平均洗牌,平均升级,伤害序列');

        for (const cfg of selected) {
            const { params, results } = cfg;
            const d = results.damages;
            const exp = Utils.mean(d);
            const sd = Utils.std(d);
            const minD = Math.min(...d);
            const maxD = Math.max(...d);
            const refAvg = Utils.mean(results.refreshes);
            const luAvg = Utils.mean(results.levelUps);

            lines.push([
                cfg.name,
                params.D, params.N, params.R, params.RC, params.C, params.CC,
                params.drawCard ? '是' : '否',
                exp.toFixed(2),
                sd.toFixed(2),
                minD, maxD,
                refAvg.toFixed(2),
                luAvg.toFixed(2),
                `"${params.damageStr}"`
            ].join(','));
        }

        // 概率分布
        lines.push('');
        lines.push('概率分布详情');
        const maxDmg = Math.max(...selected.map(c => Math.max(...c.results.damages)));
        const probHeader = ['伤害值', ...selected.map(c => c.name)];
        lines.push(probHeader.join(','));

        for (let i = 0; i <= maxDmg; i++) {
            const row = [i];
            for (const cfg of selected) {
                const prob = cfg.results.damages.filter(x => x >= i).length / cfg.results.damages.length;
                row.push(prob.toFixed(6));
            }
            lines.push(row.join(','));
        }

        return lines.join('\n');
    }

    return { loadAll, save, remove, clearAll, get, getAllNames, generateCSV };
})();

// ==================== UI 模块 ====================
const UI = (() => {
    // --- Toast 通知 ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- 模态框 ---
    function showModal(overlayId) {
        document.getElementById(overlayId).classList.add('show');
    }
    function hideModal(overlayId) {
        document.getElementById(overlayId).classList.remove('show');
    }

    // --- 确认对话框 ---
    function showConfirm(title, message) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        showModal('confirmModalOverlay');
        return new Promise(resolve => { UI._confirmResolve = resolve; });
    }

    // --- 标签页切换 ---
    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        const btn = document.querySelector(`[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');
        const panel = document.getElementById(`tab-${tabName}`);
        if (panel) panel.classList.add('active');
    }

    // --- 渲染配置列表 ---
    function renderConfigList() {
        const container = document.getElementById('configList');
        const configs = Storage.loadAll();
        const names = Object.keys(configs);

        if (!names.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无保存的配置</p>
                    <p style="font-size:0.78rem;">运行模拟后点击保存即可存储配置</p>
                </div>`;
            return;
        }

        container.innerHTML = names.map(name => {
            const cfg = configs[name];
            const exp = cfg.results ? Utils.mean(cfg.results.damages).toFixed(2) : '--';
            const date = cfg.savedAt ? new Date(cfg.savedAt).toLocaleDateString('zh-CN') : '';
            return `
                <div class="config-item">
                    <div class="config-name">${escapeHtml(name)}</div>
                    <div class="config-meta">期望: ${exp} · ${date}</div>
                    <div class="config-actions">
                        <button class="btn btn-outline btn-sm load-config" data-name="${escapeHtml(name)}">载入</button>
                        <button class="btn btn-outline btn-sm view-config" data-name="${escapeHtml(name)}">详情</button>
                        <button class="btn btn-danger btn-sm del-config" data-name="${escapeHtml(name)}">删除</button>
                    </div>
                </div>`;
        }).join('');
    }

    // --- 渲染对比选择 ---
    function renderCompareChips() {
        const container = document.getElementById('compareChips');
        const names = Storage.getAllNames();
        const configs = Storage.loadAll();

        if (!names.length) {
            container.innerHTML = '<p style="color:var(--text3);font-size:0.82rem;">暂无保存的配置，请先保存配置</p>';
            return;
        }

        container.innerHTML = names.map(name => {
            const cfg = configs[name];
            const exp = cfg.results ? Utils.mean(cfg.results.damages).toFixed(2) : '--';
            return `<span class="compare-chip" data-name="${escapeHtml(name)}" title="期望伤害: ${exp}">${escapeHtml(name)}</span>`;
        }).join('');

        // 点击切换选中
        container.querySelectorAll('.compare-chip').forEach(chip => {
            chip.addEventListener('click', () => chip.classList.toggle('selected'));
        });
    }

    function getSelectedCompareConfigs() {
        const chips = document.querySelectorAll('#compareChips .compare-chip.selected');
        return Array.from(chips).map(c => c.dataset.name);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- 示例列表 ---
    const EXAMPLES = [
        { label: '基础连击', seq: '1,2,3', desc: '连续造成1点、2点和3点伤害' },
        { label: '带追加的伤害', seq: '2zj(3),4', desc: '2点伤害若取消则追加3点，然后4点伤害' },
        { label: '反洗操作', seq: '1,fx4,3', desc: '1点伤害后反洗4张非高潮卡，再3点伤害' },
        { label: '传火追加', seq: '*2zj(2),3,4', desc: '2点若取消则追加2点并将效果传至下个伤害' },
        { label: '传火叠加', seq: '*2zj(1),*3zj(2),4', desc: '多个传火追加效果叠加' },
        { label: '嵌套追加', seq: '4zj(3,fx4,2zj(2))', desc: '4点取消后追加3点+反洗4张+2点(可再取消追加2点)' },
        { label: '卡片移动', seq: 'DT>CL,DT>RS2,CL>RS', desc: '从牌组顶部移牌到计时区和休息室' },
        { label: '条件判断', seq: 'DT>RS4:C+zj(2)', desc: '移4张到休息室，含高潮卡则追加2点' },
        { label: '混合操作', seq: '1,DT+N,2,RS>DT,3', desc: '混合伤害、添加卡和移动操作' },
    ];

    function renderExampleList() {
        const container = document.getElementById('exampleList');
        container.innerHTML = EXAMPLES.map((ex, i) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.88rem;">${ex.label}</div>
                    <div style="font-family:var(--mono);font-size:0.78rem;color:var(--teal);margin:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ex.seq}</div>
                    <div style="font-size:0.75rem;color:var(--text3);">${ex.desc}</div>
                </div>
                <button class="btn btn-outline btn-sm load-example" data-seq="${escapeHtml(ex.seq)}">载入</button>
            </div>
        `).join('');
    }

    // --- 更新统计卡片 ---
    function updateStatCards(expectedDmg, avgRefresh, avgLevelUp) {
        document.getElementById('statDmg').textContent = expectedDmg.toFixed(2);
        document.getElementById('statRefresh').textContent = avgRefresh.toFixed(2);
        document.getElementById('statLevelUp').textContent = avgLevelUp.toFixed(2);
        document.getElementById('resultsCard').style.display = '';
    }

    // --- 渲染概率表 ---
    function renderProbTable(probs, maxShow = 50) {
        const tbody = document.querySelector('#probTable tbody');
        tbody.innerHTML = '';
        const limit = Math.min(probs.length, maxShow);
        for (let i = 0; i < limit; i++) {
            const tr = document.createElement('tr');
            if (i === 1) tr.className = 'highlight'; // 高亮≥1点（最常用参考值）
            tr.innerHTML = `<td>≥ ${i}</td><td>${(probs[i] * 100).toFixed(1)}%</td>`;
            tbody.appendChild(tr);
        }
    }

    // --- 进度条 ---
    function showProgress() {
        document.getElementById('progressWrap').style.display = '';
        document.getElementById('progressText').style.display = '';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '准备模拟...';
    }

    function updateProgress(current, total) {
        const pct = (current / total * 100).toFixed(0);
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('progressText').textContent =
            `模拟中... ${current.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`;
    }

    function hideProgress() {
        document.getElementById('progressWrap').style.display = 'none';
        document.getElementById('progressText').style.display = 'none';
    }

    return {
        showToast, showModal, hideModal, showConfirm, switchTab,
        renderConfigList, renderCompareChips, getSelectedCompareConfigs,
        renderExampleList, EXAMPLES,
        updateStatCards, renderProbTable,
        showProgress, updateProgress, hideProgress,
        escapeHtml,
        _confirmResolve: null
    };
})();

// ==================== 应用主控 ====================
const App = (() => {
    // 当前模拟结果缓存
    let currentResults = null;
    let currentParams = null;

    // ==================== 表单操作 ====================

    function getFormValues() {
        const D = parseInt(document.getElementById('deckSize').value) || 50;
        const N = parseInt(document.getElementById('climaxCount').value) || 8;
        const R = parseInt(document.getElementById('restCount').value) || 0;
        const RC = parseInt(document.getElementById('restClimax').value) || 0;
        const C = parseInt(document.getElementById('clockCount').value) || 0;
        const CC = parseInt(document.getElementById('clockClimax').value) || 0;
        const drawCard = document.getElementById('drawCard').checked;
        const damageStr = document.getElementById('damageSeq').value.trim();

        return { D, N, R, RC, C, CC, drawCard, damageStr };
    }

    function setFormValues(params) {
        document.getElementById('deckSize').value = params.D;
        document.getElementById('climaxCount').value = params.N;
        document.getElementById('restCount').value = params.R;
        document.getElementById('restClimax').value = params.RC;
        document.getElementById('clockCount').value = params.C;
        document.getElementById('clockClimax').value = params.CC;
        document.getElementById('drawCard').checked = params.drawCard;
        document.getElementById('damageSeq').value = params.damageStr;
    }

    function validateForm(values) {
        if (!values.damageStr) {
            UI.showToast('请先输入伤害序列', 'error');
            return false;
        }
        if (values.N > values.D) {
            UI.showToast('高潮卡数不能大于牌组大小', 'error');
            return false;
        }
        if (values.RC > values.R) {
            UI.showToast('休息室高潮数不能大于休息室总数', 'error');
            return false;
        }
        if (values.CC > values.C) {
            UI.showToast('计时区高潮数不能大于计时区总数', 'error');
            return false;
        }
        return true;
    }

    // ==================== 模拟流程 ====================

    async function runSimulation() {
        const values = getFormValues();
        if (!validateForm(values)) return;

        // 解析伤害序列
        let damageSeq;
        try {
            damageSeq = Parser.parse(values.damageStr);
            if (!damageSeq.length) {
                UI.showToast('伤害序列解析为空，请检查输入', 'error');
                return;
            }
        } catch (e) {
            UI.showToast(`序列解析失败: ${e.message}`, 'error');
            return;
        }

        // 确认
        const formatted = Parser.format(damageSeq);
        const ok = await UI.showConfirm('开始模拟', `解析后的伤害序列:\n${formatted}\n\n牌组: ${values.D}张(${values.N}高潮)\n模拟次数: 100,000\n\n是否开始模拟？`);
        if (!ok) return;

        // 开始模拟
        UI.showProgress();
        const btnSim = document.getElementById('btnSimulate');
        btnSim.disabled = true;
        btnSim.textContent = '模拟中...';

        try {
            const result = await Simulator.runSimulation(
                values.D, values.N, values.R, values.RC, values.C, values.CC,
                damageSeq, values.drawCard, 100000,
                (current, total) => UI.updateProgress(current, total)
            );

            currentResults = result;
            currentParams = { ...values, damageSeq };

            displayResults(result);
            UI.hideProgress();
            UI.showToast('模拟完成！', 'success');

        } catch (e) {
            UI.showToast(`模拟错误: ${e.message}`, 'error');
            UI.hideProgress();
        } finally {
            btnSim.disabled = false;
            btnSim.textContent = '开始模拟';
        }
    }

    // ==================== 结果显示 ====================

    function displayResults(result) {
        const { damages, refreshes, levelUps } = result;

        // 计算统计
        const maxDmg = Math.max(...damages);
        const probs = [];
        for (let i = 0; i <= maxDmg; i++) {
            probs[i] = damages.filter(x => x >= i).length / damages.length;
        }

        const expectedDmg = Utils.mean(damages);
        const avgRefresh = Utils.mean(refreshes);
        const avgLevelUp = Utils.mean(levelUps);

        // 更新UI
        UI.updateStatCards(expectedDmg, avgRefresh, avgLevelUp);
        UI.renderProbTable(probs);

        // 创建图表
        Charts.createProbChart(
            document.getElementById('probChart'),
            probs,
            `伤害概率分布 (${damages.length.toLocaleString()} 次模拟)`
        );

        // 滚动到结果
        document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==================== 保存配置 ====================

    function saveCurrentResult() {
        if (!currentResults || !currentParams) {
            UI.showToast('请先运行模拟', 'error');
            return;
        }

        const defaultName = `配置_${currentParams.D}-${currentParams.N}_${currentParams.damageStr.substring(0, 20)}`;
        const name = prompt('输入配置名称:', defaultName);
        if (!name || !name.trim()) return;

        const paramsToSave = {
            D: currentParams.D,
            N: currentParams.N,
            R: currentParams.R,
            RC: currentParams.RC,
            C: currentParams.C,
            CC: currentParams.CC,
            drawCard: currentParams.drawCard,
            damageStr: currentParams.damageStr,
        };

        Storage.save(name.trim(), paramsToSave, {
            damages: currentResults.damages,
            refreshes: currentResults.refreshes,
            levelUps: currentResults.levelUps,
        });

        UI.showToast(`配置「${name.trim()}」已保存`, 'success');
        UI.renderConfigList();
        UI.renderCompareChips();
    }

    // ==================== 导出CSV ====================

    function exportCurrentCSV() {
        if (!currentResults || !currentParams) {
            UI.showToast('请先运行模拟', 'error');
            return;
        }

        const tempName = '__current_export__';
        Storage.save(tempName, {
            D: currentParams.D, N: currentParams.N, R: currentParams.R,
            RC: currentParams.RC, C: currentParams.C, CC: currentParams.CC,
            drawCard: currentParams.drawCard, damageStr: currentParams.damageStr,
        }, {
            damages: currentResults.damages,
            refreshes: currentResults.refreshes,
            levelUps: currentResults.levelUps,
        });

        const csv = Storage.generateCSV([tempName]);
        Storage.remove(tempName);

        downloadFile(`ws_damage_sim_${Date.now()}.csv`, csv);
        UI.showToast('CSV已导出', 'success');
    }

    function exportAllCSV() {
        const names = Storage.getAllNames();
        if (!names.length) {
            UI.showToast('没有可导出的配置', 'error');
            return;
        }
        const csv = Storage.generateCSV(names);
        downloadFile(`ws_damage_all_${Date.now()}.csv`, csv);
        UI.showToast(`已导出 ${names.length} 个配置`, 'success');
    }

    function downloadFile(filename, content) {
        const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==================== 解析预览 ====================

    function showParsePreview() {
        const str = document.getElementById('damageSeq').value.trim();
        if (!str) {
            UI.showToast('请先输入伤害序列', 'error');
            return;
        }

        try {
            const parsed = Parser.parse(str);
            const formatted = Parser.format(parsed);
            const desc = Parser.describe(parsed);

            const resultText = [
                `原始输入:\n${str}`,
                ``,
                `解析后序列:\n${formatted}`,
                ``,
                `结构化描述:\n${desc.join('\n')}`,
            ].join('\n');

            document.getElementById('parseResult').textContent = resultText;
            UI.showModal('parseModalOverlay');
        } catch (e) {
            UI.showToast(`解析失败: ${e.message}`, 'error');
        }
    }

    // ==================== 预设 ====================

    function applyPreset(name) {
        const presets = {
            standard: { D: 50, N: 8, R: 0, RC: 0, C: 0, CC: 0 },
        };

        const p = presets[name];
        if (!p) return;

        document.getElementById('deckSize').value = p.D;
        document.getElementById('climaxCount').value = p.N;
        document.getElementById('restCount').value = p.R;
        document.getElementById('restClimax').value = p.RC;
        document.getElementById('clockCount').value = p.C;
        document.getElementById('clockClimax').value = p.CC;

        UI.showToast(`已应用预设: ${name}`, 'info');
    }

    // ==================== 对比 ====================

    function runCompare() {
        const selected = UI.getSelectedCompareConfigs();
        if (selected.length < 1) {
            UI.showToast('请至少选择一个配置进行对比', 'error');
            return;
        }

        const configs = Storage.loadAll();
        const datasets = selected.map(name => {
            const cfg = configs[name];
            const maxDmg = Math.max(...cfg.results.damages);
            const probs = [];
            for (let i = 0; i <= maxDmg; i++) {
                probs[i] = cfg.results.damages.filter(x => x >= i).length / cfg.results.damages.length;
            }
            return {
                label: name,
                probs,
                cfg
            };
        });

        // 显示对比图表
        document.getElementById('compareChartCard').style.display = '';
        Charts.createCompareChart(document.getElementById('compareChart'), datasets);

        // 渲染统计对比表
        let statsHtml = '<table class="prob-table"><thead><tr><th>配置</th><th>期望伤害</th><th>标准差</th><th>平均洗牌</th><th>平均升级</th></tr></thead><tbody>';

        for (const ds of datasets) {
            const d = ds.cfg.results.damages;
            const exp = Utils.mean(d);
            const sd = Utils.std(d);
            const ref = Utils.mean(ds.cfg.results.refreshes);
            const lu = Utils.mean(ds.cfg.results.levelUps);

            statsHtml += `<tr>
                <td style="font-weight:600;">${UI.escapeHtml(ds.label)}</td>
                <td style="color:var(--rose);">${exp.toFixed(2)}</td>
                <td>${sd.toFixed(2)}</td>
                <td style="color:var(--teal);">${ref.toFixed(2)}</td>
                <td style="color:var(--gold);">${lu.toFixed(2)}</td>
            </tr>`;
        }
        statsHtml += '</tbody></table>';
        document.getElementById('compareStats').innerHTML = statsHtml;

        document.getElementById('compareChartCard').scrollIntoView({ behavior: 'smooth' });
        UI.showToast(`已生成 ${selected.length} 个配置的对比`, 'success');
    }

    // ==================== 事件绑定 ====================

    function init() {
        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                UI.switchTab(tab);
                // 切换到配置/对比页时刷新列表
                if (tab === 'configs') UI.renderConfigList();
                if (tab === 'compare') UI.renderCompareChips();
            });
        });

        // 开始模拟
        document.getElementById('btnSimulate').addEventListener('click', runSimulation);

        // 解析序列
        document.getElementById('btnParse').addEventListener('click', showParsePreview);

        // 载入示例
        document.getElementById('btnExamples').addEventListener('click', () => {
            UI.renderExampleList();
            UI.showModal('exampleModalOverlay');
        });

        // 快速帮助
        document.getElementById('btnQuickHelp').addEventListener('click', () => {
            UI.switchTab('help');
        });

        // 预设
        document.querySelectorAll('.preset-chip').forEach(chip => {
            chip.addEventListener('click', () => applyPreset(chip.dataset.preset));
        });

        // 保存结果
        document.getElementById('btnSaveResult').addEventListener('click', saveCurrentResult);

        // 导出CSV
        document.getElementById('btnExportCSV').addEventListener('click', exportCurrentCSV);

        // 导出全部
        document.getElementById('btnExportAll').addEventListener('click', exportAllCSV);

        // 清空配置
        document.getElementById('btnClearAll').addEventListener('click', async () => {
            const ok = await UI.showConfirm('清空全部配置', '确定要删除所有已保存的配置吗？此操作不可撤销。');
            if (ok) {
                Storage.clearAll();
                UI.renderConfigList();
                UI.renderCompareChips();
                UI.showToast('所有配置已清空', 'success');
            }
        });

        // 对比
        document.getElementById('btnCompare').addEventListener('click', runCompare);
        document.getElementById('btnSelectAll').addEventListener('click', () => {
            document.querySelectorAll('#compareChips .compare-chip').forEach(c => c.classList.add('selected'));
        });
        document.getElementById('btnDeselectAll').addEventListener('click', () => {
            document.querySelectorAll('#compareChips .compare-chip').forEach(c => c.classList.remove('selected'));
        });

        // 解析预览弹窗
        document.getElementById('btnCopySeq').addEventListener('click', () => {
            const text = document.getElementById('parseResult').textContent;
            const lines = text.split('\n');
            let seqLine = '';
            let found = false;
            for (const line of lines) {
                if (line.startsWith('解析后序列:')) { found = true; continue; }
                if (found && line.trim()) { seqLine = line.trim(); break; }
            }
            navigator.clipboard.writeText(seqLine).then(() => {
                UI.showToast('已复制到剪贴板', 'success');
            }).catch(() => UI.showToast('复制失败', 'error'));
        });
        document.getElementById('btnCloseParse').addEventListener('click', () => {
            UI.hideModal('parseModalOverlay');
        });

        // 示例弹窗
        document.getElementById('btnCloseExample').addEventListener('click', () => {
            UI.hideModal('exampleModalOverlay');
        });

        // 确认弹窗
        document.getElementById('btnConfirmYes').addEventListener('click', () => {
            UI.hideModal('confirmModalOverlay');
            if (UI._confirmResolve) { UI._confirmResolve(true); UI._confirmResolve = null; }
        });
        document.getElementById('btnConfirmNo').addEventListener('click', () => {
            UI.hideModal('confirmModalOverlay');
            if (UI._confirmResolve) { UI._confirmResolve(false); UI._confirmResolve = null; }
        });

        // 点击遮罩关闭弹窗
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('show');
            });
        });

        // 委托事件：配置列表操作
        document.getElementById('configList').addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const name = btn.dataset.name;

            if (btn.classList.contains('load-config')) {
                const cfg = Storage.get(name);
                if (cfg) {
                    setFormValues({
                        ...cfg.params,
                        damageStr: cfg.params.damageStr
                    });
                    // 如果有缓存的结果，直接显示
                    if (cfg.results) {
                        currentResults = cfg.results;
                        currentParams = cfg.params;
                        displayResults(cfg.results);
                    }
                    UI.switchTab('sim');
                    UI.showToast(`已加载配置「${name}」`, 'success');
                }
            } else if (btn.classList.contains('view-config')) {
                const cfg = Storage.get(name);
                if (cfg) {
                    const exp = cfg.results ? Utils.mean(cfg.results.damages).toFixed(2) : '--';
                    const info = [
                        `配置: ${name}`,
                        `牌组: ${cfg.params.D}张 (${cfg.params.N}高潮)`,
                        `休息室: ${cfg.params.R}张 (${cfg.params.RC}高潮)`,
                        `计时区: ${cfg.params.C}张 (${cfg.params.CC}高潮)`,
                        `抽牌: ${cfg.params.drawCard ? '是' : '否'}`,
                        `期望伤害: ${exp}`,
                        `伤害序列: ${cfg.params.damageStr}`,
                    ].join('\n');
                    alert(info);
                }
            } else if (btn.classList.contains('del-config')) {
                const ok = await UI.showConfirm('删除配置', `确定要删除配置「${name}」吗？`);
                if (ok) {
                    Storage.remove(name);
                    UI.renderConfigList();
                    UI.renderCompareChips();
                    UI.showToast(`已删除「${name}」`, 'success');
                }
            }
        });

        // 委托事件：示例载入
        document.getElementById('exampleList').addEventListener('click', (e) => {
            const btn = e.target.closest('.load-example');
            if (!btn) return;
            document.getElementById('damageSeq').value = btn.dataset.seq;
            UI.hideModal('exampleModalOverlay');
            UI.showToast('示例已载入', 'success');
        });

        // 初始渲染
        UI.renderConfigList();
        UI.renderCompareChips();
    }

    return { init };
})();

// ==================== 启动应用 ====================
document.addEventListener('DOMContentLoaded', () => App.init());
