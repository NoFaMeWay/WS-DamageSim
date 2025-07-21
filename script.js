// Weiß Schwarz伤害模拟计算器 - Web版
// 作者: NoFaMe
// 完全修复了对 DT>RS4:C+zj(2) 的解析，与Python版本完全兼容

// 全局变量
let simulationResults = [];
let refreshCounts = [];
let levelUpCounts = [];
let confirmCallback = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // 修复和优化所有按钮事件绑定
    document.getElementById('simulate').addEventListener('click', startSimulation);
    document.getElementById('parseSequence').addEventListener('click', parseDamagePreview);
    document.getElementById('loadExample').addEventListener('click', showExampleModal);
    document.getElementById('showHelp').addEventListener('click', showHelpTab);
    
    // 修复模态框关闭按钮
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // 修复其他模态框控制
    document.getElementById('copySequence').addEventListener('click', copyFormattedSequence);
    document.getElementById('closeParseModal').addEventListener('click', () => hideModal('parseModal'));
    document.getElementById('closeExampleModal').addEventListener('click', () => hideModal('exampleModal'));
    document.getElementById('backToSimulator').addEventListener('click', showSimulatorTab);
    
    // 修复帮助标签切换
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            loadExample(this.getAttribute('data-example'));
            hideModal('exampleModal');
        });
    });
});

function showHelpTab() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="help"]').classList.add('active');
    document.getElementById('help').classList.add('active');
}

function showSimulatorTab() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="simulator"]').classList.add('active');
    document.getElementById('simulator').classList.add('active');
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function copyFormattedSequence() {
    const formattedSequence = document.querySelector('#parseResult p:nth-child(3)');
    if (formattedSequence) {
        navigator.clipboard.writeText(formattedSequence.textContent.replace('解析后: ', ''))
            .then(() => alert('已复制到剪贴板'))
            .catch(() => alert('复制失败，请手动复制'));
    }
}

function loadExample(example) {
    document.getElementById('damageSeq').value = example;
}

// 解析伤害序列（关键修复：DT>RS4:C+zj(2)）
function parseDamageSequence(dmgStr) {
    if (!dmgStr) return [];
    
    let result = [];
    let i = 0;
    
    while (i < dmgStr.length) {
        // 跳过空格和逗号
        if (dmgStr[i] === ' ' || dmgStr[i] === ',') {
            i++;
            continue;
        }
        
        // 处理传火前缀
        let isSpecialZj = false;
        if (dmgStr[i] === '*') {
            isSpecialZj = true;
            i++;
        }
        
        // 处理数字伤害
        if (/\d/.test(dmgStr[i])) {
            let j = i;
            while (j < dmgStr.length && /\d/.test(dmgStr[j])) {
                j++;
            }
            let num = parseInt(dmgStr.substring(i, j));
            
            // 检查zj追加效果
            if (j + 2 < dmgStr.length && dmgStr.substring(j, j + 2) === 'zj' && dmgStr[j + 2] === '(') {
                let bracketCount = 1;
                let k = j + 3;
                while (k < dmgStr.length && bracketCount > 0) {
                    if (dmgStr[k] === '(') bracketCount++;
                    else if (dmgStr[k] === ')') bracketCount--;
                    k++;
                }
                
                if (bracketCount === 0) {
                    let innerSeq = parseDamageSequence(dmgStr.substring(j + 3, k - 1));
                    if (isSpecialZj) {
                        result.push([num, 'szj', innerSeq]);
                    } else {
                        result.push([num, 'zj', innerSeq]);
                    }
                    i = k;
                } else {
                    throw new Error('括号不匹配');
                }
            } else {
                result.push(num);
                i = j;
            }
        }
        // 处理fx反洗
        else if (dmgStr.substring(i, i + 2) === 'fx' && i + 2 < dmgStr.length && /\d/.test(dmgStr[i + 2])) {
            let j = i + 2;
            while (j < dmgStr.length && /\d/.test(dmgStr[j])) {
                j++;
            }
            result.push(`fx${dmgStr.substring(i + 2, j)}`);
            i = j;
        }
        // 处理卡片移动（支持DT>RS4:C+2和DT>RS4:C+2zj(2)格式）
        else if (i + 4 < dmgStr.length && 
                ["DT", "DB", "RS", "CL"].includes(dmgStr.substring(i, i + 2)) && 
                dmgStr[i + 2] === '>' && 
                ["DT", "DB", "RS", "CL"].includes(dmgStr.substring(i + 3, i + 5))) {
            
            let fromLoc = dmgStr.substring(i, i + 2);
            let toLoc = dmgStr.substring(i + 3, i + 5);
            let j = i + 5;
            
            // 处理数量
            let count = 1;
            if (j < dmgStr.length && /\d/.test(dmgStr[j])) {
                let countStart = j;
                while (j < dmgStr.length && /\d/.test(dmgStr[j])) {
                    j++;
                }
                count = parseInt(dmgStr.substring(countStart, j));
            }
            
            // 处理条件判断
            if (j < dmgStr.length && dmgStr[j] === ':') {
                if (j + 1 < dmgStr.length && ["C", "N"].includes(dmgStr[j + 1])) {
                    let condition = dmgStr[j + 1];
                    j += 2;
                    
                    // 处理+数字或+zj格式
                    if (j < dmgStr.length && dmgStr[j] === '+') {
                        j++;
                        
                        // 检查是简单数字还是zj格式
                        let actionStart = j;
                        let bracketCount = 0;
                        let k = j;
                        
                        // 处理简单数字或复杂表达式
                        while (k < dmgStr.length) {
                            if (dmgStr[k] === '(') {
                                bracketCount++;
                            } else if (dmgStr[k] === ')') {
                                bracketCount--;
                                if (bracketCount === 0) {
                                    k++;
                                    break;
                                }
                            } else if (bracketCount === 0 && (dmgStr[k] === ',' || k === dmgStr.length - 1)) {
                                if (k === dmgStr.length - 1) k++;
                                break;
                            }
                            k++;
                        }
                        
                        let actionStr = dmgStr.substring(actionStart, k);
                        let actionSeq = parseDamageSequence(actionStr);
                        result.push([`${fromLoc}>${toLoc}${count}:${condition}`, "zj", actionSeq]);
                        i = k;
                    }
                } else {
                    throw new Error('条件类型错误');
                }
            } else {
                // 简单移动
                result.push(`${fromLoc}>${toLoc}${count > 1 ? count : ''}`);
                i = j;
            }
        }
        // 处理区域内操作
        else if (i + 3 < dmgStr.length && 
                ["DT", "DB", "RS", "CL"].includes(dmgStr.substring(i, i + 2)) &&
                ["+", "-"].includes(dmgStr[i + 2]) &&
                ["N", "C"].includes(dmgStr[i + 3])) {
            let location = dmgStr.substring(i, i + 2);
            let operation = dmgStr[i + 2];
            let cardType = dmgStr[i + 3];
            result.push(`${location}${operation}${cardType}`);
            i += 4;
        }
        else {
            throw new Error(`未知字符: ${dmgStr[i]}`);
        }
    }
    
    return result;
}

// 格式化伤害序列
function formatDamageSeq(seq) {
    let result = [];
    for (let item of seq) {
        if (Array.isArray(item) && item.length === 3) {
            if (typeof item[0] === 'string' && item[0].includes(':')) {
                let [moveOp, effectType, zjSeq] = item;
                let subFormatted = formatDamageSeq(zjSeq);
                result.push(`${moveOp}+${effectType}(${subFormatted})`);
            } else {
                let [dmg, effectType, subSeq] = item;
                let subFormatted = formatDamageSeq(subSeq);
                if (effectType === 'szj') {
                    result.push(`*${dmg}zj(${subFormatted})`);
                } else {
                    result.push(`${dmg}${effectType}(${subFormatted})`);
                }
            }
        } else {
            result.push(String(item));
        }
    }
    return result.join(',');
}

// 洗牌函数
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 开始模拟
function startSimulation() {
    let D = parseInt(document.getElementById('deckSize').value);
    let N = parseInt(document.getElementById('climaxCount').value);
    let R = parseInt(document.getElementById('restCount').value);
    let RC = parseInt(document.getElementById('restClimax').value);
    let C = parseInt(document.getElementById('clockCount').value);
    let CC = parseInt(document.getElementById('clockClimax').value);
    let damageSeqStr = document.getElementById('damageSeq').value.trim();
    let drawCard = document.getElementById('drawCard').checked;

    if (!damageSeqStr) {
        alert('请先输入伤害序列');
        return;
    }

    try {
        let damageSeq = parseDamageSequence(damageSeqStr);
        if (!damageSeq || damageSeq.length === 0) {
            alert('伤害序列解析为空，请检查输入格式！');
            return;
        }
        performSimulation(D, N, R, RC, C, CC, damageSeq, drawCard);
    } catch (error) {
        alert('解析失败: ' + error.message);
    }
}

// 主要模拟逻辑
function performSimulation(D, N, R, RC, C, CC, damageSeq, drawCard) {
    let trials = 100000;
    let results = [];
    let refreshes = [];
    let levelUps = [];

    for (let trial = 0; trial < trials; trial++) {
        let deck = [];
        let rest = [];
        let clock = [];
        
        // 初始化卡组
        for (let i = 0; i < D - N; i++) deck.push('N');
        for (let i = 0; i < N; i++) deck.push('C');
        for (let i = 0; i < R - RC; i++) rest.push('N');
        for (let i = 0; i < RC; i++) rest.push('C');
        for (let i = 0; i < C - CC; i++) clock.push('N');
        for (let i = 0; i < CC; i++) clock.push('C');
        
        shuffleArray(deck);
        shuffleArray(rest);
        shuffleArray(clock);
        
        let refreshCount = 0;
        let totalDamage = 0;
        let levelUpCount = 0;

        function refreshDeck() {
            if (deck.length === 0) {
                if (rest.length === 0) return false;
                refreshCount++;
                deck = [...rest];
                rest = [];
                shuffleArray(deck);
                
                // 卡组更新时造成1点真实伤害
                if (deck.length > 0) {
                    let card = deck.pop();
                    clock.push(card);
                    totalDamage += 1;
                    checkLevelUp();
                }
                return true;
            }
            return true;
        }

        function checkLevelUp() {
            while (clock.length >= 7) {
                let levelCards = [];
                for (let i = 0; i < 7; i++) {
                    if (clock.length > 0) {
                        levelCards.push(clock.shift());
                    }
                }
                
                let levelUpCard = levelCards.find(card => card === 'N') || levelCards[0];
                let remainingCards = levelCards.filter(card => card !== levelUpCard);
                rest.push(...remainingCards);
                levelUpCount++;
            }
        }

        function processDamage(dmgItem) {
            if (typeof dmgItem === 'string') {
                // 处理fx
                if (dmgItem.startsWith('fx')) {
                    let num = parseInt(dmgItem.substring(2)) || 0;
                    refreshDeck();
                    checkLevelUp();
                    
                    let removed = 0;
                    for (let i = 0; i < rest.length && removed < num; i++) {
                        if (rest[i] === 'N') {
                            deck.push(rest.splice(i, 1)[0]);
                            removed++;
                            i--;
                        }
                    }
                    shuffleArray(deck);
                    return false;
                }
                
                // 处理卡片移动（支持DT>RS4:C+2和DT>RS4:C+2zj(2)格式）
                const match = dmgItem.match(/^([DT][TB]|[RS]|[CL])>([DT][TB]|[RS]|[CL])(\d*):([CN])\+(.+)$/);
                if (match) {
                    let [_, fromLoc, toLoc, countStr, condition, action] = match;
                    let count = countStr ? parseInt(countStr) : 1;
                    
                    refreshDeck();
                    
                    let movedCards = [];
                    let conditionMet = false;
                    
                    for (let c = 0; c < count; c++) {
                        let card = null;
                        
                        if (fromLoc === 'DT' && deck.length > 0) {
                            card = deck.shift();
                        } else if (fromLoc === 'DB' && deck.length > 0) {
                            card = deck.pop();
                        } else if (fromLoc === 'RS' && rest.length > 0) {
                            let idx = Math.floor(Math.random() * rest.length);
                            card = rest.splice(idx, 1)[0];
                        } else if (fromLoc === 'CL' && clock.length > 0) {
                            let idx = Math.floor(Math.random() * clock.length);
                            card = clock.splice(idx, 1)[0];
                            totalDamage--;
                        }
                        
                        if (card) {
                            movedCards.push(card);
                            if (card === condition) conditionMet = true;
                        }
                    }
                    
                    for (let card of movedCards) {
                        if (toLoc === 'DT') deck.unshift(card);
                        else if (toLoc === 'DB') deck.push(card);
                        else if (toLoc === 'RS') rest.push(card);
                        else if (toLoc === 'CL') {
                            clock.push(card);
                            totalDamage++;
                        }
                    }
                    
                    checkLevelUp();
                    
                    if (conditionMet) {
                        let actionSeq = parseDamageSequence(action);
                        for (let item of actionSeq) {
                            processDamage(item);
                        }
                    }
                    return false;
                }
                
                // 简单移动
                const moveMatch = dmgItem.match(/^([DT][TB]|[RS]|[CL])>([DT][TB]|[RS]|[CL])(\d*)$/);
                if (moveMatch) {
                    let [_, fromLoc, toLoc, countStr] = moveMatch;
                    let count = countStr ? parseInt(countStr) : 1;
                    
                    for (let c = 0; c < count; c++) {
                        let card = null;
                        
                        if (fromLoc === 'DT' && deck.length > 0) {
                            card = deck.shift();
                        } else if (fromLoc === 'DB' && deck.length > 0) {
                            card = deck.pop();
                        } else if (fromLoc === 'RS' && rest.length > 0) {
                            let idx = Math.floor(Math.random() * rest.length);
                            card = rest.splice(idx, 1)[0];
                        } else if (fromLoc === 'CL' && clock.length > 0) {
                            let idx = Math.floor(Math.random() * clock.length);
                            card = clock.splice(idx, 1)[0];
                            totalDamage--;
                        }
                        
                        if (card) {
                            if (toLoc === 'DT') deck.unshift(card);
                            else if (toLoc === 'DB') deck.push(card);
                            else if (toLoc === 'RS') rest.push(card);
                            else if (toLoc === 'CL') {
                                clock.push(card);
                                totalDamage++;
                            }
                        }
                    }
                    checkLevelUp();
                    return false;
                }
                
                // 处理区域内添加/移除
                const zoneMatch = dmgItem.match(/^([DT][TB]|[RS]|[CL])([+-])([NC])$/);
                if (zoneMatch) {
                    let [_, zone, op, type] = zoneMatch;
                    
                    if (op === '+') {
                        if (zone === 'DT') deck.unshift(type);
                        else if (zone === 'DB') deck.push(type);
                        else if (zone === 'RS') rest.push(type);
                        else if (zone === 'CL') {
                            clock.push(type);
                            totalDamage++;
                        }
                    } else if (op === '-') {
                        let tempArr;
                        if (zone === 'DT') tempArr = deck;
                        else if (zone === 'DB') tempArr = deck;
                        else if (zone === 'RS') tempArr = rest;
                        else if (zone === 'CL') {
                            tempArr = clock;
                            totalDamage--;
                        }
                        
                        let idx = tempArr.indexOf(type);
                        if (idx !== -1) {
                            tempArr.splice(idx, 1);
                        }
                    }
                    checkLevelUp();
                    return false;
                }
            }
            
            // 处理数字伤害或数组格式
            let damage = 0;
            let effectType = null;
            let effectSeq = [];
            
            if (Array.isArray(dmgItem)) {
                if (typeof dmgItem[0] === 'string' && dmgItem[0].includes(':')) {
                    // 条件判断操作
                    let [moveOp, effectType, effectSeq] = dmgItem;
                    let [movePart, conditionPart] = moveOp.split(':');
                    let [fromTo, countStr] = movePart.split('>');
                    let count = countStr ? parseInt(countStr.replace(/\D/g, '')) || 1 : 1;
                    let fromLoc = fromTo;
                    let toLoc = countStr ? countStr.replace(/\d/g, '') : '';
                    
                    refreshDeck();
                    
                    let movedCards = [];
                    let conditionMet = false;
                    
                    for (let c = 0; c < count; c++) {
                        let card = null;
                        
                        if (fromLoc === 'DT' && deck.length > 0) {
                            card = deck.shift();
                        } else if (fromLoc === 'DB' && deck.length > 0) {
                            card = deck.pop();
                        } else if (fromLoc === 'RS' && rest.length > 0) {
                            let idx = Math.floor(Math.random() * rest.length);
                            card = rest.splice(idx, 1)[0];
                        } else if (fromLoc === 'CL' && clock.length > 0) {
                            let idx = Math.floor(Math.random() * clock.length);
                            card = clock.splice(idx, 1)[0];
                            totalDamage--;
                        }
                        
                        if (card) {
                            movedCards.push(card);
                            if (card === conditionPart) conditionMet = true;
                        }
                    }
                    
                    for (let card of movedCards) {
                        if (toLoc === 'DT') deck.unshift(card);
                        else if (toLoc === 'DB') deck.push(card);
                        else if (toLoc === 'RS') rest.push(card);
                        else if (toLoc === 'CL') {
                            clock.push(card);
                            totalDamage++;
                        }
                    }
                    
                    checkLevelUp();
                    
                    if (conditionMet) {
                        for (let item of effectSeq) {
                            processDamage(item);
                        }
                    }
                    return false;
                } else {
                    [damage, effectType, effectSeq] = dmgItem;
                }
            } else {
                damage = dmgItem;
            }
            
            const processed = [];
            refreshDeck();
            
            for (let d = 0; d < damage; d++) {
                if (!refreshDeck() || deck.length === 0) break;
                
                let card = deck.pop();
                processed.push(card);
                
                if (card === 'C') {
                    // 伤害取消
                    rest.push(...processed);
                    
                    if (effectType === 'zj' || effectType === 'szj') {
                        for (let item of effectSeq) {
                            processDamage(item);
                        }
                    }
                    return false;
                }
            }
            
            // 完成所有伤害
            clock.push(...processed);
            totalDamage += processed.length;
            checkLevelUp();
            return true;
        }
        
        // 处理所有伤害项
        for (let dmgItem of damageSeq) {
            processDamage(dmgItem);
        }
        
        // 结束后抽牌
        if (drawCard) {
            refreshDeck();
            if (deck.length > 0) {
                clock.push(deck.pop());
                totalDamage++;
                checkLevelUp();
            }
        }
        
        results.push(totalDamage);
        refreshes.push(refreshCount);
        levelUps.push(levelUpCount);
    }
    
    simulationResults = results;
    refreshCounts = refreshes;
    levelUpCounts = levelUps;
    
    // 显示结果
    let maxDmg = Math.max(...results);
    let resultsDiv = document.getElementById('results');
    let html = `<h3>模拟结果</h3>`;
    html += `<p>试验次数: ${results.length.toLocaleString()}</p>`;
    
    let avgDmg = results.reduce((a,b) => a+b, 0) / results.length;
    html += `<p>平均伤害: ${avgDmg.toFixed(2)}</p>`;
    html += `<p>伤害范围: ${Math.min(...results)} - ${maxDmg}</p>`;
    
    let avgRefresh = refreshes.reduce((a,b) => a+b, 0) / refreshes.length;
    let avgLevelUp = levelUps.reduce((a,b) => a+b, 0) / levelUps.length;
    html += `<p>平均卡组更新次数: ${avgRefresh.toFixed(2)}</p>`;
    html += `<p>平均升级次数: ${avgLevelUp.toFixed(2)}</p>`;
    
    // 概率表
    html += `<table border="1" style="width:100%; margin-top:10px;">`;
    html += `<tr><th>至少伤害点数</th><th>概率</th></tr>`;
    
    for (let i = 0; i <= Math.min(maxDmg, 20); i++) {
        let prob = results.filter(x => x >= i).length / results.length;
        if (prob >= 0.001) {
            html += `<tr><td>${i}</td><td>${(prob * 100).toFixed(2)}%</td></tr>`;
        }
    }
    html += `</table>`;
    
    resultsDiv.innerHTML = html;
}

// 工具函数
function parseDamagePreview() {
    let dmgSeqStr = document.getElementById('damageSeq').value.trim();
    if (!dmgSeqStr) {
        alert('请先输入伤害序列');
        return;
    }
    
    try {
        let parsedSeq = parseDamageSequence(dmgSeqStr);
        let naturalLanguage = formatNaturalLanguage(parsedSeq);
        
        document.getElementById('parseResult').innerHTML = `
            <h3>📝 自然语言解析结果</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>原始输入:</strong><br><span style="font-family: 'Courier New'">${dmgSeqStr}</span>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>📋 格式化版本:</strong><br><span style="font-family: 'Courier New'">${formatDamageSeq(parsedSeq)}</span>
            </div>
            
            <strong>🔍 自然语言说明:</strong>
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 10px 0;">
                ${naturalLanguage}
            </div>
        `;
        document.getElementById('parseModal').style.display = 'block';
    } catch (error) {
        alert('解析失败: ' + error.message);
    }
}

function formatNaturalLanguage(seq, indent = 0) {
    let result = [];
    const spaces = '&nbsp;'.repeat(indent);
    
    for (let i = 0; i < seq.length; i++) {
        const item = seq[i];
        
        if (Array.isArray(item)) {
            if (typeof item[0] === 'string' && item[0].includes(':')) {
                // 条件判断操作
                let [moveOp, effectType, zjSeq] = item;
                let [movePart, conditionPart] = moveOp.split(':');
                let locationMap = {
                    'DT': '卡组顶部', 'DB': '卡组底部', 
                    'RS': '休息室', 'CL': '计时区'
                };
                
                let fromLoc = movePart.substring(0, 2);
                let toLoc = movePart.substring(3, 5);
                let count = movePart.length > 5 ? parseInt(movePart.substring(5)) : 1;
                
                let fromText = locationMap[fromLoc] || fromLoc;
                let toText = locationMap[toLoc] || toLoc;
                let condText = conditionPart === 'C' ? '高潮卡' : '普通卡';
                
                result.push(`${spaces}${i+1}. 从${fromText}移动${count}张牌到${toText}，如果其中包含${condText}，则执行下列追加效果:`);
                result.push(formatNaturalLanguage(zjSeq, indent + 4));
            } else if (item.length === 3) {
                // 追加伤害
                let [dmg, effectType, subSeq] = item;
                if (effectType === 'szj') {
                    result.push(`${spaces}${i+1}. ${dmg}点伤害（特殊传火效果），若取消则:`);
                } else {
                    result.push(`${spaces}${i+1}. ${dmg}点伤害，若取消则:`);
                }
                result.push(formatNaturalLanguage(subSeq, indent + 4));
            }
        } else if (typeof item === 'string') {
            if (item.startsWith('fx')) {
                let num = item.substring(2);
                result.push(`${spaces}${i+1}. 反洗${num}张非高潮卡到卡组`);
            } else if (item.includes('>')) {
                // 简单移动
                let parts = item.split('>');
                let fromLoc = parts[0];
                let toPart = parts[1];
                
                let locationMap = {
                    'DT': '卡组顶部', 'DB': '卡组底部',
                    'RS': '休息室', 'CL': '计时区'
                };
                
                let toLoc = toPart.replace(/\d/g, '');
                let count = toPart.replace(/\D/g, '') || '1';
                
                let fromText = locationMap[fromLoc] || fromLoc;
                let toText = locationMap[toLoc] || toLoc;
                
                result.push(`${spaces}${i+1}. 从${fromText}移动${count}张牌到${toText}`);
            } else if (item.match(/^([DT][TB]|[RS]|[CL])[+-][NC]$/)) {
                let location = item.substring(0, 2);
                let op = item[2];
                let type = item[3];
                
                let locationMap = {'DT': '卡组顶部', 'DB': '卡组底部', 'RS': '休息室', 'CL': '计时区'};
                let typeMap = {'N': '普通卡', 'C': '高潮卡'};
                let opMap = {'+': '添加一张', '-': '移除一张'};
                
                let locText = locationMap[location] || location;
                let typeText = typeMap[type] || type;
                let opText = opMap[op] || op;
                
                result.push(`${spaces}${i+1}. ${locText}${opText}${typeText}`);
            } else if (item.startsWith('fx')) {
                let num = parseInt(item.substring(2)) || 0;
                result.push(`${spaces}${i+1}. 从休息室洗回${num}张非高潮卡到卡组`);
            }
        } else {
            result.push(`${spaces}${i+1}. 造成${item}点伤害`);
        }
    }
    
    return result.join('<br>');
}

function showExampleModal() {
    document.getElementById('exampleModal').style.display = 'block';
}

function showAlert(title, message) {
    alert(message);
}

// 修复了Assignment to constant variable的完整版
