// Weiß Schwarz伤害模拟计算器 - Web版
// 作者: NoFaMe
// 版本: 1.0.0

// 全局变量
let simulationResults = [];
let refreshCounts = [];
let levelUpCounts = [];

// 初始化网页
document.addEventListener('DOMContentLoaded', function() {
    // 标签页切换
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有标签和内容的active类
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // 添加active类到当前标签和对应内容
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // 按钮事件
    document.getElementById('simulate').addEventListener('click', startSimulation);
    document.getElementById('parseSequence').addEventListener('click', parseDamagePreview);
    document.getElementById('loadExample').addEventListener('click', showExampleModal);
    document.getElementById('showHelp').addEventListener('click', function() {
        document.querySelector('.tab[data-tab="help"]').click();
    });
    document.getElementById('backToSimulator').addEventListener('click', function() {
        document.querySelector('.tab[data-tab="simulator"]').click();
    });
    
    // 对话框关闭按钮
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.parentElement.parentElement.style.display = 'none';
        });
    });
    
    // 模态框按钮
    document.getElementById('copySequence').addEventListener('click', copyToClipboard);
    document.getElementById('closeParseModal').addEventListener('click', function() {
        document.getElementById('parseModal').style.display = 'none';
    });
    document.getElementById('closeExampleModal').addEventListener('click', function() {
        document.getElementById('exampleModal').style.display = 'none';
    });
    document.getElementById('alertOk').addEventListener('click', function() {
        document.getElementById('alertModal').style.display = 'none';
    });
    document.getElementById('confirmYes').addEventListener('click', confirmYesAction);
    document.getElementById('confirmNo').addEventListener('click', function() {
        document.getElementById('confirmModal').style.display = 'none';
    });
    
    // 示例按钮
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const example = this.getAttribute('data-example');
            document.getElementById('damageSeq').value = example;
            document.getElementById('exampleModal').style.display = 'none';
            showAlert('示例已载入', '已载入示例伤害序列，点击"解析伤害序列"按钮可预览解析结果');
        });
    });
});

// 开始模拟
function startSimulation() {
    // 获取参数
    const values = getFormValues();
    if (!values) return;
    
    const [D, N, R, RC, C, CC, damageSeq, damageSeqStr, drawCard] = values;
    
    // 显示确认对话框
    const formatted = formatDamageSeq(damageSeq);
    showConfirm(`解析后的伤害序列:<br>${formatted.replace(/\n/g, '<br>')}<br><br>是否继续?`, function() {
        runSimulation(D, N, R, RC, C, CC, damageSeq, drawCard);
    });
}

// 获取表单数据
function getFormValues() {
    try {
        const D = parseInt(document.getElementById('deckSize').value);
        const N = parseInt(document.getElementById('climaxCount').value);
        const R = parseInt(document.getElementById('restCount').value);
        const RC = parseInt(document.getElementById('restClimax').value);
        const C = parseInt(document.getElementById('clockCount').value);
        const CC = parseInt(document.getElementById('clockClimax').value);
        
        const drawCard = document.getElementById('drawCard').checked;
        const damageSeqStr = document.getElementById('damageSeq').value.trim();
        
        if (!damageSeqStr) {
            showAlert('提示', '请先输入伤害序列');
            return null;
        }
        
        try {
            const damageSeq = parseDamageSequence(damageSeqStr);
            if (!damageSeq || damageSeq.length === 0) {
                showAlert('输入错误', '伤害序列解析为空，请检查输入格式！');
                return null;
            }
        } catch (e) {
            showAlert('解析错误', `伤害序列解析失败: ${e.message}`);
            return null;
        }
        
        if (N > D) {
            showAlert('输入错误', '高潮卡数不能大于牌组大小');
            return null;
        }
        
        if (RC > R) {
            showAlert('输入错误', '休息室高潮数不能大于休息室总数');
            return null;
        }
            
        if (CC > C) {
            showAlert('输入错误', '计时区高潮数不能大于计时区总数');
            return null;
        }
        
        const damageSeq = parseDamageSequence(damageSeqStr);
        return [D, N, R, RC, C, CC, damageSeq, damageSeqStr, drawCard];
        
    } catch (e) {
        showAlert('输入错误', '请检查输入的参数格式是否正确！');
        return null;
    }
}

// 运行模拟
function runSimulation(D, N, R, RC, C, CC, damageSeq, drawCard) {
    // 显示加载提示
    document.getElementById('results').textContent = "正在模拟中，请稍候...";
    
    // 使用setTimeout让UI有时间更新
    setTimeout(function() {
        try {
            // 运行模拟
            const result = simulate(D, N, R, RC, C, CC, damageSeq, drawCard);
            simulationResults = result.damages;
            refreshCounts = result.refreshes;
            levelUpCounts = result.levelUps;
            
            // 显示结果
            displaySimulationResults();
        } catch (e) {
            showAlert('模拟错误', `模拟过程中发生错误: ${e.message}`);
            document.getElementById('results').textContent = "模拟过程中发生错误，请检查参数和伤害序列。";
        }
    }, 100);
}

// 显示模拟结果
function displaySimulationResults() {
    // 计算结果统计数据
    const maxDmg = Math.max(...simulationResults);
    const probs = [];
    for (let i = 0; i <= maxDmg; i++) {
        probs[i] = simulationResults.filter(x => x >= i).length / simulationResults.length;
    }
    
    // 准备结果文本
    let resultText = "详细概率分布:\n";
    for (let i = 0; i <= maxDmg; i++) {
        if (probs[i] > 0.001 || i === 0) {
            resultText += `造成≥${i}点伤害的概率: ${probs[i].toFixed(3)}\n`;
        }
    }
    
    // 计算期望值
    let expectedValue = 0;
    for (let i = 0; i < maxDmg; i++) {
        if (i < probs.length - 1) {
            expectedValue += i * (probs[i] - probs[i+1]);
        }
    }
    
    const avgRefresh = refreshCounts.reduce((a, b) => a + b, 0) / refreshCounts.length;
    const avgLevelUp = levelUpCounts.reduce((a, b) => a + b, 0) / levelUpCounts.length;
    
    resultText += `\n伤害期望值: ${expectedValue.toFixed(2)}点\n`;
    resultText += `平均卡组更新次数: ${avgRefresh.toFixed(2)}次\n`;
    resultText += `平均升级次数: ${avgLevelUp.toFixed(2)}次\n`;
    
    // 显示结果文本
    document.getElementById('results').textContent = resultText;
}

// 解析伤害序列预览
function parseDamagePreview() {
    const dmgSeqStr = document.getElementById('damageSeq').value.trim();
    if (!dmgSeqStr) {
        showAlert('提示', '请先输入伤害序列');
        return;
    }
    
    try {
        const parsedSeq = parseDamageSequence(dmgSeqStr);
        const formatted = formatDamageSeq(parsedSeq);
        
        let previewText = `原始输入:\n${dmgSeqStr}\n\n`;
        previewText += `解析后的伤害序列:\n${formatted}\n\n`;
        previewText += "详细解析结构:\n";
        
        // 添加解析结构描述
        previewText += addStructureDescription(parsedSeq);
        
        document.getElementById('parseResult').textContent = previewText;
        document.getElementById('parseModal').style.display = 'block';
        
    } catch (e) {
        showAlert('解析错误', `伤害序列解析失败: ${e.message}`);
    }
}

// 添加结构描述
function addStructureDescription(seq, indent = 0) {
    let result = '';
    for (const item of seq) {
        if (Array.isArray(item) && item.length === 3) {
            if (typeof item[0] === 'string' && item[0].includes(':')) {
                const [moveOp, effectType, zjSeq] = item;
                const parts = moveOp.split(':');
                const movePart = parts[0];
                const condition = parts[1];
                
                const fromLoc = movePart.substring(0, 2);
                const toLoc = movePart.substring(3, 5);
                let count = 1;
                if (movePart.length > 5 && !isNaN(parseInt(movePart.substring(5)))) {
                    count = parseInt(movePart.substring(5));
                }
                
                const locationMap = {
                    "DT": "卡组顶部", 
                    "DB": "卡组底部", 
                    "RS": "休息室", 
                    "CL": "计时区"
                };
                const fromText = locationMap[fromLoc] || fromLoc;
                const toText = locationMap[toLoc] || toLoc;
                const condText = condition === "C" ? "高潮卡" : "普通卡";
                
                result += `${' '.repeat(indent)}· 从${fromText}移动${count}张牌到${toText} (如果包含${condText}则追加):\n`;
                result += addStructureDescription(zjSeq, indent+2);
            } else {
                const [dmg, effectType, zjSeq] = item;
                const effectName = effectType === "zj" ? "追加伤害" : "特殊追加效果";
                result += `${' '.repeat(indent)}· ${dmg}点伤害 取消后${effectName}:\n`;
                result += addStructureDescription(zjSeq, indent+2);
            }
        } else if (typeof item === 'string' && item.startsWith("fx")) {
            result += `${' '.repeat(indent)}· 反洗${item.substring(2)}张非高潮卡\n`;
        } else if (typeof item === 'string' && item.includes(">")) {
            const parts = item.split('>');
            if (parts.length === 2) {
                const fromLoc = parts[0].substring(0, 2);
                const toLoc = parts[1].substring(0, 2);
                
                let count = 1;
                if (parts[1].length > 2 && !isNaN(parseInt(parts[1].substring(2)))) {
                    count = parseInt(parts[1].substring(2));
                }
                
                const locationMap = {
                    "DT": "卡组顶部", 
                    "DB": "卡组底部", 
                    "RS": "休息室", 
                    "CL": "计时区",
                    "HD": "手牌"
                };
                const fromText = locationMap[fromLoc] || fromLoc;
                const toText = locationMap[toLoc] || toLoc;
                
                result += `${' '.repeat(indent)}· 从${fromText}移动${count}张牌到${toText}\n`;
            }
        } else if (typeof item === 'string' && 
                  (item.startsWith("DT") || 
                   item.startsWith("DB") || 
                   item.startsWith("RS") || 
                   item.startsWith("CL"))) {
            const locationMap = {
                "DT": "卡组顶部", 
                "DB": "卡组底部", 
                "RS": "休息室", 
                "CL": "计时区"
            };
            const opMap = {"+": "添加", "-": "移除"};
            const cardMap = {"N": "普通卡", "C": "高潮卡"};
            
            const location = locationMap[item.substring(0, 2)] || item.substring(0, 2);
            const operation = opMap[item.charAt(2)] || item.charAt(2);
            const cardType = cardMap[item.charAt(3)] || item.charAt(3);
            
            result += `${' '.repeat(indent)}· ${location}${operation}一张${cardType}\n`;
        } else {
            result += `${' '.repeat(indent)}· ${item}点伤害\n`;
        }
    }
    return result;
}

// 复制到剪贴板
function copyToClipboard() {
    const parseResult = document.getElementById('parseResult').textContent;
    const lines = parseResult.split('\n');
    let formatted = '';
    
    // 查找解析后的伤害序列段落
    let foundStart = false;
    for (const line of lines) {
        if (line.startsWith('解析后的伤害序列:')) {
            foundStart = true;
            continue;
        }
        if (foundStart && line.trim() === '') {
            break;
        }
        if (foundStart) {
            formatted += line + '\n';
        }
    }
    
    // 复制到剪贴板
    navigator.clipboard.writeText(formatted.trim())
        .then(() => {
            showAlert('已复制', '解析后的伤害序列已复制到剪贴板');
        })
        .catch(err => {
            showAlert('复制失败', '无法复制到剪贴板: ' + err);
        });
}

// 显示示例对话框
function showExampleModal() {
    document.getElementById('exampleModal').style.display = 'block';
}

// 确认对话框是按钮回调
let confirmCallback = null;

function confirmYesAction() {
    document.getElementById('confirmModal').style.display = 'none';
    if (confirmCallback) {
        confirmCallback();
    }
}

// 显示确认对话框
function showConfirm(message, callback) {
    document.getElementById('confirmContent').innerHTML = message;
    document.getElementById('confirmModal').style.display = 'block';
    confirmCallback = callback;
}

// 显示提示对话框
function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertContent').textContent = message;
    document.getElementById('alertModal').style.display = 'block';
}

// 解析伤害序列
function parseDamageSequence(sequenceStr) {
    if (!sequenceStr) return [];
    
    // 替换可能的中文逗号
    sequenceStr = sequenceStr.replace(/，/g, ',');
    
    // 分割伤害序列
    const parts = sequenceStr.split(',');
    const result = [];
    
    // 传火追加效果标记
    let fireEffect = false;
    
    for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        
        // 处理传火追加效果
        if (part.startsWith('*')) {
            fireEffect = true;
            part = part.substring(1);
        }
        
        // 处理追加伤害
        if (part.includes('zj(') && part.endsWith(')')) {
            const dmgPart = part.split('zj(')[0];
            const zjPart = part.split('zj(')[1].replace(')', '');
            
            if (!dmgPart || isNaN(parseInt(dmgPart))) {
                throw new Error(`无效的伤害值: ${dmgPart}`);
            }
            
            const zjSeq = parseDamageSequence(zjPart);
            if (fireEffect) {
                result.push([parseInt(dmgPart), '*zj', zjSeq]);
                fireEffect = false;
            } else {
                result.push([parseInt(dmgPart), 'zj', zjSeq]);
            }
        }
        // 处理反洗
        else if (part.startsWith('fx')) {
            const count = part.substring(2);
            if (isNaN(parseInt(count))) {
                throw new Error(`无效的反洗数量: ${count}`);
            }
            result.push(`fx${count}`);
        }
        // 处理卡片移动带条件
        else if (part.includes('>') && part.includes(':')) {
            const conditionParts = part.split(':');
            if (conditionParts.length !== 2) {
                throw new Error(`无效的条件移动: ${part}`);
            }
            
            const moveOp = conditionParts[0];
            const condition = conditionParts[1].charAt(0);
            const effectPart = conditionParts[1].substring(1);
            
            if (!moveOp.includes('>')) {
                throw new Error(`无效的移动操作: ${moveOp}`);
            }
            
            if (condition !== 'C' && condition !== 'N') {
                throw new Error(`无效的条件: ${condition}`);
            }
            
            if (effectPart.startsWith('+zj(') && effectPart.endsWith(')')) {
                const zjPart = effectPart.substring(3, effectPart.length - 1);
                const zjSeq = parseDamageSequence(zjPart);
                result.push([`${moveOp}:${condition}`, 'zj', zjSeq]);
            } else {
                throw new Error(`无效的条件效果: ${effectPart}`);
            }
        }
        // 处理卡片移动
        else if (part.includes('>')) {
            result.push(part);
        }
        // 处理卡片添加/移除
        else if ((part.startsWith('DT') || part.startsWith('DB') || 
                 part.startsWith('RS') || part.startsWith('CL')) &&
                (part.includes('+') || part.includes('-'))) {
            result.push(part);
        }
        // 处理基本伤害
        else if (!isNaN(parseInt(part))) {
            result.push(parseInt(part));
        } else {
            throw new Error(`无法识别的伤害序列部分: ${part}`);
        }
    }
    
    return result;
}

// 格式化伤害序列
function formatDamageSeq(seq) {
    let result = '';
    for (let i = 0; i < seq.length; i++) {
        const item = seq[i];
        
        // 处理伤害追加
        if (Array.isArray(item) && item.length === 3) {
            if (typeof item[0] === 'string' && item[0].includes(':')) {
                // 条件移动追加
                const [moveOp, effectType, zjSeq] = item;
                result += `${moveOp}+zj(${formatDamageSeq(zjSeq)})`;
            } else {
                // 伤害追加
                const [dmg, effectType, zjSeq] = item;
                if (effectType === '*zj') {
                    result += `*${dmg}zj(${formatDamageSeq(zjSeq)})`;
                } else {
                    result += `${dmg}zj(${formatDamageSeq(zjSeq)})`;
                }
            }
        } else {
            // 基本伤害、反洗或移动
            result += item;
        }
        
        // 添加分隔符
        if (i < seq.length - 1) {
            result += ',';
        }
    }
    return result;
}

// 模拟函数
function simulate(D, N, R, RC, C, CC, damageSeq, drawCard, sampleSize = 10000) {
    // 结果数组
    const damages = [];
    const refreshes = [];
    const levelUps = [];
    
    // 执行模拟
    for (let i = 0; i < sampleSize; i++) {
        const result = singleSimulation(D, N, R, RC, C, CC, damageSeq, drawCard);
        damages.push(result.damage);
        refreshes.push(result.refresh);
        levelUps.push(result.levelUp);
    }
    
    return {
        damages,
        refreshes,
        levelUps
    };
}

// 初始化牌组
function initializeDeck(size, climaxCount) {
    const deck = [];
    
    // 添加高潮卡
    for (let i = 0; i < climaxCount; i++) {
        deck.push(1); // 1表示高潮卡
    }
    
    // 添加普通卡
    for (let i = 0; i < size - climaxCount; i++) {
        deck.push(0); // 0表示普通卡
    }
    
    // 洗牌
    shuffleArray(deck);
    
    return deck;
}

// 初始化位置（休息室或计时区）
function initializeLocation(size, climaxCount) {
    const location = [];
    
    // 添加高潮卡
    for (let i = 0; i < climaxCount; i++) {
        location.push(1);
    }
    
    // 添加普通卡
    for (let i = 0; i < size - climaxCount; i++) {
        location.push(0);
    }
    
    return location;
}

// 洗牌函数
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 解析移动操作
function parseMoveOperation(moveStr) {
    const parts = moveStr.split('>');
    if (parts.length !== 2) {
        throw new Error(`无效的移动操作: ${moveStr}`);
    }
    
    const fromLocation = parts[0];
    let toLocation = parts[1];
    let count = 1;
    
    // 检查是否有数量
    if (toLocation.length > 2 && !isNaN(parseInt(toLocation.substring(2)))) {
        count = parseInt(toLocation.substring(2));
        toLocation = toLocation.substring(0, 2);
    }
    
    return [fromLocation, toLocation, count];
}

// 移动卡片
function moveCards(fromLocation, toLocation, count, deck, rest, clock) {
    let movedClimax = 0;
    let movedNormal = 0;
    let refreshCount = 0;
    
    // 根据来源位置获取卡片
    let sourceCards = [];
    if (fromLocation === 'DT') {
        // 从牌组顶部移动
        sourceCards = deck.splice(0, Math.min(count, deck.length));
    } else if (fromLocation === 'DB') {
        // 从牌组底部移动
        sourceCards = deck.splice(Math.max(0, deck.length - count), Math.min(count, deck.length));
    } else if (fromLocation === 'RS') {
        // 从休息室移动
        sourceCards = rest.splice(0, Math.min(count, rest.length));
    } else if (fromLocation === 'CL') {
        // 从计时区移动
        sourceCards = clock.splice(0, Math.min(count, clock.length));
    }
    
    // 统计移动的卡片类型
    for (const card of sourceCards) {
        if (card === 1) {
            movedClimax++;
        } else {
            movedNormal++;
        }
    }
    
    // 根据目标位置放置卡片
    if (toLocation === 'DT') {
        // 放到牌组顶部
        deck.unshift(...sourceCards);
    } else if (toLocation === 'DB') {
        // 放到牌组底部
        deck.push(...sourceCards);
    } else if (toLocation === 'RS') {
        // 放到休息室
        rest.push(...sourceCards);
    } else if (toLocation === 'CL') {
        // 放到计时区
        clock.push(...sourceCards);
        
        // 检查是否需要升级
        if (clock.length >= 7) {
            // 移除6张卡到休息室
            for (let i = 0; i < 6; i++) {
                if (clock.length > 0) {
                    rest.push(clock.shift());
                }
            }
        }
    } else if (toLocation === 'HD') {
        // 放到手牌（在模拟中不做特殊处理）
    }
    
    return {
        deck,
        rest,
        clock,
        movedClimax,
        movedNormal,
        refresh: refreshCount
    };
}

// 单次模拟
function singleSimulation(deckSize, climaxCount, restCount, restClimax, clockCount, clockClimax, damageSeq, drawCard) {
    // 初始化牌组
    let deck = initializeDeck(deckSize, climaxCount);
    let rest = initializeLocation(restCount, restClimax);
    let clock = initializeLocation(clockCount, clockClimax);
    let damage = 0;
    let refresh = 0;
    let levelUp = 0;
    
    // 执行伤害序列
    let fireNextDamage = false;
    let processedDamageSeq = [...damageSeq];
    
    // 如果开启了抽牌选项，添加一个抽牌操作到序列末尾
    if (drawCard) {
        processedDamageSeq.push("DT>HD");
    }
    
    // 执行伤害序列
    for (let i = 0; i < processedDamageSeq.length; i++) {
        const currentAction = processedDamageSeq[i];
        
        // 处理伤害和追加
        if (Array.isArray(currentAction) && currentAction.length === 3) {
            // 伤害追加
            if (typeof currentAction[0] === 'number') {
                const [dmg, effectType, zjSeq] = currentAction;
                
                // 处理传火效果
                const isFireEffect = effectType === '*zj';
                
                // 执行伤害
                for (let j = 0; j < dmg; j++) {
                    // 每抽一张牌检查一次伤害是否取消
                    if (deck.length === 0) {
                        // 洗牌
                        deck = [...rest];
                        rest = [];
                        refresh++;
                        // 如果牌组为空则无法继续
                        if (deck.length === 0) break;
                        
                        // 洗牌
                        shuffleArray(deck);
                    }
                    
                    const card = deck.shift();
                    clock.push(card);
                    
                    // 检查升级
                    if (clock.length >= 7) {
                        levelUp++;
                        for (let k = 0; k < 6; k++) {
                            if (clock.length > 0) {
                                rest.push(clock.shift());
                            }
                        }
                        // 一旦触发升级，当前伤害取消
                        break;
                    }
                    
                    // 高潮卡取消伤害
                    if (card === 1) {
                        // 加入追加伤害
                        if (isFireEffect) {
                            // 传火效果：下一个伤害也获得传火效果
                            fireNextDamage = true;
                        }
                        // 将追加序列插入到当前位置
                        processedDamageSeq.splice(i + 1, 0, ...zjSeq);
                        break;
                    }
                    
                    // 完成一点伤害
                    damage++;
                }
            }
            // 条件移动追加
            else if (typeof currentAction[0] === 'string' && currentAction[0].includes(':')) {
                const [moveOp, effectType, zjSeq] = currentAction;
                const parts = moveOp.split(':');
                const movePart = parts[0];
                const condition = parts[1];
                
                // 解析移动操作
                const [fromLocation, toLocation, count] = parseMoveOperation(movePart);
                
                // 执行移动
                const result = moveCards(fromLocation, toLocation, count, deck, rest, clock);
                deck = result.deck;
                rest = result.rest;
                clock = result.clock;
                refresh += result.refresh;
                
                // 检查是否满足条件（是否移动了相应类型的卡片）
                const checkClimax = condition === 'C' && result.movedClimax > 0;
                const checkNormal = condition === 'N' && result.movedNormal > 0;
                
                if (checkClimax || checkNormal) {
                    // 将追加序列插入到当前位置
                    processedDamageSeq.splice(i + 1, 0, ...zjSeq);
                }
            }
        }
        // 处理反洗
        else if (typeof currentAction === 'string' && currentAction.startsWith('fx')) {
            const count = parseInt(currentAction.substring(2));
            
            // 找到非高潮卡
            const normalCards = [];
            for (let j = 0; j < deck.length; j++) {
                if (deck[j] === 0) {
                    normalCards.push(deck.splice(j, 1)[0]);
                    j--;
                    if (normalCards.length >= count) break;
                }
            }
            
            // 放入牌组底部
            deck.push(...normalCards);
        }
        // 处理卡片移动
        else if (typeof currentAction === 'string' && currentAction.includes('>')) {
            const [fromLocation, toLocation, count] = parseMoveOperation(currentAction);
            
            // 执行移动
            const result = moveCards(fromLocation, toLocation, count, deck, rest, clock);
            deck = result.deck;
            rest = result.rest;
            clock = result.clock;
            refresh += result.refresh;
        }
        // 处理卡片添加/移除
        else if (typeof currentAction === 'string' && 
                 (currentAction.startsWith('DT') || 
                  currentAction.startsWith('DB') || 
                  currentAction.startsWith('RS') || 
                  currentAction.startsWith('CL'))) {
            
            const location = currentAction.substring(0, 2);
            const operation = currentAction.charAt(2);
            const cardType = currentAction.charAt(3);
            const card = cardType === 'C' ? 1 : 0;
            
            if (operation === '+') {
                // 添加卡片
                if (location === 'DT') {
                    deck.unshift(card);
                } else if (location === 'DB') {
                    deck.push(card);
                } else if (location === 'RS') {
                    rest.push(card);
                } else if (location === 'CL') {
                    clock.push(card);
                }
            } else if (operation === '-') {
                // 移除卡片
                if (location === 'DT' && deck.length > 0) {
                    for (let j = 0; j < deck.length; j++) {
                        if (deck[j] === card) {
                            deck.splice(j, 1);
                            break;
                        }
                    }
                } else if (location === 'DB' && deck.length > 0) {
                    for (let j = deck.length - 1; j >= 0; j--) {
                        if (deck[j] === card) {
                            deck.splice(j, 1);
                            break;
                        }
                    }
                } else if (location === 'RS' && rest.length > 0) {
                    for (let j = 0; j < rest.length; j++) {
                        if (rest[j] === card) {
                            rest.splice(j, 1);
                            break;
                        }
                    }
                } else if (location === 'CL' && clock.length > 0) {
                    for (let j = 0; j < clock.length; j++) {
                        if (clock[j] === card) {
                            clock.splice(j, 1);
                            break;
                        }
                    }
                }
            }
        }
        // 处理简单伤害
        else if (typeof currentAction === 'number') {
            let dmg = currentAction;
            
            // 如果有传火效果，添加传火标记并清除标记
            if (fireNextDamage) {
                fireNextDamage = false;
                
                // 构造带传火效果的追加，插入到下一个位置
                if (i + 1 < processedDamageSeq.length && typeof processedDamageSeq[i+1] === 'number') {
                    const nextDmg = processedDamageSeq[i+1];
                    processedDamageSeq[i+1] = [nextDmg, '*zj', []];
                }
            }
            
            // 执行伤害
            for (let j = 0; j < dmg; j++) {
                // 检查牌组是否需要洗牌
                if (deck.length === 0) {
                    // 洗牌
                    deck = [...rest];
                    rest = [];
                    refresh++;
                    
                    // 如果牌组为空则无法继续
                    if (deck.length === 0) break;
                    
                    // 洗牌
                    shuffleArray(deck);
                }
                
                const card = deck.shift();
                clock.push(card);
                
                // 检查升级
                if (clock.length >= 7) {
                    levelUp++;
                    for (let k = 0; k < 6; k++) {
                        if (clock.length > 0) {
                            rest.push(clock.shift());
                        }
                    }
                    // 一旦触发升级，当前伤害取消
                    break;
                }
                
                // 高潮卡取消伤害
                if (card === 1) {
                    break;
                }
                
                // 完成一点伤害
                damage++;
            }
        }
    }
    
    return {
        damage,
        refresh,
        levelUp
    };
}
