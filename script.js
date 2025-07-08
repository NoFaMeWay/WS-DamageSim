// Weiß Schwarz伤害模拟计算器 - Web版
// 作者: NoFaMe
// 版本: 1.0.1 (Debug版)

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
                const zjContent = effectPart.substring(4, effectPart.length - 1);
                
                let zjSeq;
                if (!isNaN(parseInt(zjContent)) && zjContent.trim() === parseInt(zjContent).toString()) {
                    // If zjContent is just a number, create a simple damage sequence
                    zjSeq = [parseInt(zjContent)];
                } else {
                    // Otherwise parse it as a normal sequence
                    zjSeq = parseDamageSequence(zjContent);
                }
                
                result.push([`${moveOp}:${condition}`, 'zj', zjSeq]);
            } else {
                result.push(`${moveOp}:${condition}`);
            }
        }
        // 处理简单卡片移动
        else if (part.includes('>')) {
            result.push(part);
        }
        // 处理卡片添加/移除
        else if (/^(DT|DB|RS|CL)[\+\-][NC]$/.test(part)) {
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
