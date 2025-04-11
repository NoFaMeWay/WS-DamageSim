import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import random
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import re

plt.rcParams['font.sans-serif'] = ['SimHei']  # 用于显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用于显示负号

def parse_damage_sequence(dmg_str):
    """解析伤害序列字符串"""
    if not dmg_str:
        return []
    
    result = []
    i = 0
    while i < len(dmg_str):
        # 处理特殊的*前缀
        is_special_zj = False
        if i < len(dmg_str) and dmg_str[i] == "*":
            is_special_zj = True
            i += 1
            
        # 处理数字开头的伤害
        if i < len(dmg_str) and dmg_str[i].isdigit():
            j = i
            while j < len(dmg_str) and dmg_str[j].isdigit():
                j += 1
                
            num = int(dmg_str[i:j])
            
            # 检查是否是追加伤害效果
            if j+2 < len(dmg_str) and dmg_str[j:j+2] == "zj" and dmg_str[j+2] == "(":
                effect_type = dmg_str[j:j+2]  # zj
                # 找到匹配的右括号
                bracket_count = 1
                k = j + 3
                while k < len(dmg_str) and bracket_count > 0:
                    if dmg_str[k] == "(":
                        bracket_count += 1
                    elif dmg_str[k] == ")":
                        bracket_count -= 1
                    k += 1
                
                if bracket_count == 0:
                    # 递归解析括号内的内容
                    inner_seq = parse_damage_sequence(dmg_str[j+3:k-1])
                    if is_special_zj and effect_type == "zj":
                        # 特殊的zj，添加标记
                        result.append((num, "szj", inner_seq))
                    else:
                        result.append((num, effect_type, inner_seq))
                    i = k
                else:
                    messagebox.showerror("解析错误", f"括号不匹配: {dmg_str}")
                    return []
            else:
                result.append(num)
                i = j
        
        # 处理fx反洗
        elif dmg_str[i:i+2] == "fx" and i+2 < len(dmg_str) and dmg_str[i+2].isdigit():
            j = i + 2
            while j < len(dmg_str) and dmg_str[j].isdigit():
                j += 1
            
            result.append(f"fx{dmg_str[i+2:j]}")
            i = j
        
        # 处理卡片移动操作 (如 DT>RS, DT>CL, RS>DT)
        elif i+4 < len(dmg_str) and dmg_str[i:i+2] in ["DT", "DB", "RS", "CL"] and dmg_str[i+2] == ">" and dmg_str[i+3:i+5] in ["DT", "DB", "RS", "CL"]:
            from_loc = dmg_str[i:i+2]
            to_loc = dmg_str[i+3:i+5]
            
            # 检查是否是带数量的移动操作 (如 DT>RS4)
            if i+5 < len(dmg_str) and dmg_str[i+5].isdigit():
                j = i + 5
                while j < len(dmg_str) and dmg_str[j].isdigit():
                 j += 1
                count = int(dmg_str[i+5:j])
                
                # 检查是否有条件判断部分 (如 DT>RS4:C+zj(2))
                if j < len(dmg_str) and dmg_str[j] == ":":
                    # 找到条件类型 (C或N)
                    if j+1 < len(dmg_str) and dmg_str[j+1] in ["C", "N"]:
                        condition = dmg_str[j+1]
                        j += 2
                        
                        # 查找追加伤害部分
                        if j+3 < len(dmg_str) and dmg_str[j:j+3] == "+zj":
                            # 找到匹配的右括号
                            bracket_count = 1
                            k = j + 4
                            while k < len(dmg_str) and bracket_count > 0:
                                if dmg_str[k] == "(":
                                    bracket_count += 1
                                elif dmg_str[k] == ")":
                                    bracket_count -= 1
                                k += 1
                            
                            if bracket_count == 0:
                                # 递归解析括号内的内容
                                zj_seq = parse_damage_sequence(dmg_str[j+4:k-1])
                                result.append((f"{from_loc}>{to_loc}{count}:{condition}", "zj", zj_seq))
                                i = k
                            else:
                                messagebox.showerror("解析错误", f"追加伤害括号不匹配: {dmg_str[i:]}")
                                return []
                        else:
                            messagebox.showerror("解析错误", f"条件判断格式错误: {dmg_str[i:]}")
                            return []
                    else:
                        messagebox.showerror("解析错误", f"条件类型错误: {dmg_str[i:]}")
                        return []
                else:
                    # 只有数量没有条件判断
                    result.append(f"{from_loc}>{to_loc}{count}")
                    i = j
            else:
                # 简单移动操作
                result.append(f"{from_loc}>{to_loc}")
                i += 5
        
        # 处理卡组操作
        elif i+2 < len(dmg_str) and (
                dmg_str[i:i+2] == "DT" or   # 卡组顶部
                dmg_str[i:i+2] == "DB" or   # 卡组底部
                dmg_str[i:i+2] == "RS" or   # 休息室
                dmg_str[i:i+2] == "CL"      # 计时区
            ):
            location = dmg_str[i:i+2]
            if i+3 < len(dmg_str) and dmg_str[i+2] in ['+', '-'] and dmg_str[i+3] in ['N', 'C']:
                operation = dmg_str[i+2]
                card_type = dmg_str[i+3]
                result.append(f"{location}{operation}{card_type}")
                i += 4
            else:
                messagebox.showerror("解析错误", f"卡组操作格式错误: {dmg_str[i:]}")
                return []
        
        # 跳过分隔符和空格
        elif dmg_str[i] == "," or dmg_str[i] == " ":
            i += 1
        
        # 未知字符
        else:
            messagebox.showerror("解析错误", f"未知字符: {dmg_str[i]}")
            return []
    
    return result

def format_damage_seq(seq):
    """格式化伤害序列为可读字符串"""
    result = []
    for item in seq:
        if isinstance(item, tuple):
            if isinstance(item[0], str) and ":" in item[0]:
                # 条件判断操作 (如 DT>RS4:C+zj(2))
                move_op, effect_type, zj_seq = item
                sub_formatted = format_damage_seq(zj_seq)
                result.append(f"{move_op}+{effect_type}({sub_formatted})")
            else:
                # 普通追加伤害或特殊zj
                dmg, effect_type, sub_seq = item
                sub_formatted = format_damage_seq(sub_seq)
                if effect_type == "szj":
                    # 特殊的zj，添加*前缀
                    result.append(f"*{dmg}zj({sub_formatted})")
                else:
                    result.append(f"{dmg}{effect_type}({sub_formatted})")
        elif isinstance(item, str):
            result.append(item)
        else:
            result.append(str(item))
    return ','.join(result)

def simulate(D, N, R, RC, C, CC, damage_seq, draw_card=False, trials=10000):
    results, refresh_counts, level_up_counts = [], [], []
    
    for _ in range(trials):
        deck = ['C'] * N + ['N'] * (D - N)
        rest = ['C'] * RC + ['N'] * (R - RC)
        clock = ['C'] * CC + ['N'] * (C - CC)
        random.shuffle(deck)
        random.shuffle(rest)
        random.shuffle(clock)
        refresh_count = 0
        total_damage = 0
        level_up_count = 0
        
        def refresh_deck():
            nonlocal deck, rest, clock, refresh_count, total_damage, level_up_count
            if not deck:
                if not rest:
                    return False
                
                refresh_count += 1
                deck = rest.copy()
                rest = []
                random.shuffle(deck)
                
                if deck:
                    card = deck.pop(0)
                    clock.append(card)
                    total_damage += 1
                    check_level_up()
                
                return True
            return True
        
        def check_level_up():
            nonlocal clock, rest, level_up_count
            while len(clock) >= 7:
                lvl_cards = clock[:7]
                level_up_card = next((x for x in lvl_cards if x == 'N'), None)
                if level_up_card:
                    lvl_cards.remove(level_up_card)
                else:
                    level_up_card = lvl_cards.pop(0)
                rest.extend(lvl_cards)
                clock = clock[7:]
                level_up_count += 1
        
        def process_damage(dmg_item):
            nonlocal deck, rest, clock, total_damage, level_up_count
            
            # 处理fx反洗
            if isinstance(dmg_item, str) and dmg_item.startswith('fx'):
                if not refresh_deck():
                    return False, None, None
                
                check_level_up()
                num_fx = int(dmg_item[2:])
                rest_N = [card for card in rest if card == 'N']
                for _ in range(min(num_fx, len(rest_N))):
                    rest.remove('N')
                    deck.append('N')
                random.shuffle(deck)
                return False, None, None
            
            # 处理条件判断操作
            if isinstance(dmg_item, tuple) and isinstance(dmg_item[0], str) and ":" in dmg_item[0]:
                move_op, effect_type, zj_seq = dmg_item
                parts = move_op.split(":")
                if len(parts) != 2:
                    return False, None, None
                    
                move_part = parts[0]
                condition = parts[1]
                
                from_loc = move_part[:2]
                to_loc = move_part[3:5]
                count = 1
                if len(move_part) > 5 and move_part[5:].isdigit():
                    count = int(move_part[5:])
                
                if not refresh_deck():
                    return False, None, None
                
                moved_cards = []
                condition_met = False
                
                for _ in range(count):
                    card = None
                    if from_loc == "DT" and deck:
                        card = deck.pop(0)
                        # 检查牌组是否为空
                        if not deck:
                            refresh_deck()
                    elif from_loc == "DB" and deck:
                        card = deck.pop(-1)
                        # 检查牌组是否为空
                        if not deck:
                            refresh_deck()
                    elif from_loc == "RS" and rest:
                        card = rest.pop(random.randrange(len(rest)))
                    elif from_loc == "CL" and clock:
                        card = clock.pop(random.randrange(len(clock)))
                        if card:
                            total_damage -= 1
                    
                    if card:
                        moved_cards.append(card)
                        if card == condition:
                            condition_met = True
                
                for card in moved_cards:
                    if to_loc == "DT":
                        deck.insert(0, card)
                    elif to_loc == "DB":
                        deck.append(card)
                    elif to_loc == "RS":
                        rest.append(card)
                    elif to_loc == "CL":
                        clock.append(card)
                        total_damage += 1
                        check_level_up()
                
                if condition_met and zj_seq:
                    for zj_item in zj_seq:
                        process_damage(zj_item)
                
                return False, None, None
            
            # 处理卡组操作
            if isinstance(dmg_item, str) and (
                    dmg_item.startswith('DT') or 
                    dmg_item.startswith('DB') or 
                    dmg_item.startswith('RS') or 
                    dmg_item.startswith('CL')):
                
                if not refresh_deck():
                    return False, None, None
                
                location = dmg_item[:2]
                operation = dmg_item[2]
                card_type = dmg_item[3]
                
                if location == 'DT':
                    if operation == '+':
                        deck.insert(0, card_type)
                    elif operation == '-' and deck:
                        if card_type in deck:
                            deck.remove(card_type)
                
                elif location == 'DB':
                    if operation == '+':
                        deck.append(card_type)
                    elif operation == '-' and deck:
                        if card_type in deck:
                            for i in range(len(deck)-1, -1, -1):
                                if deck[i] == card_type:
                                    deck.pop(i)
                                    break
                
                elif location == 'RS':
                    if operation == '+':
                        rest.append(card_type)
                    elif operation == '-' and rest:
                        if card_type in rest:
                            rest.remove(card_type)
                
                elif location == 'CL':
                    if operation == '+':
                        clock.append(card_type)
                        total_damage += 1
                        check_level_up()
                    elif operation == '-' and clock:
                        if card_type in clock:
                            clock.remove(card_type)
                            total_damage -= 1
                
                return False, None, None
            
            # 处理普通伤害或带效果的伤害
            if isinstance(dmg_item, tuple):
                dmg, effect_type, zj_seq = dmg_item
            else:
                dmg = dmg_item
                effect_type = None
                zj_seq = None
            
            # 处理当前伤害
            processing_zone = []
            cancelled = False
            
            # 优化：添加对dmg为0或负数的保护
            if isinstance(dmg, int) and dmg <= 0:
                return False, None, None
                
            for _ in range(dmg):
                if not deck and not refresh_deck():
                    break
                
                card = deck.pop(0)
                processing_zone.append(card)
                
                # 在每次取牌后检查牌组是否为空
                if not deck:
                    refresh_deck()
                
                if card == 'C':
                    cancelled = True
                    break
            
            # 处理翻出的卡
            if cancelled:
                rest.extend(processing_zone)
                
                # 处理特殊的zj效果
                if effect_type == "szj":
                    # 处理当前伤害的追加效果
                    for zj_item in zj_seq:
                        process_damage(zj_item)
                    
                    # 返回特殊zj效果给下一个伤害
                    return True, None, (dmg, zj_seq)
                
                # 处理普通的追加效果
                elif effect_type == "zj" and zj_seq:
                    for zj_item in zj_seq:
                        process_damage(zj_item)
            else:
                clock.extend(processing_zone)
                total_damage += len(processing_zone)
                
            check_level_up()
            refresh_deck()
            return cancelled, None, None
        
        # 处理所有伤害
        i = 0
        carry_szj = None
        
        while i < len(damage_seq):
            refresh_deck()
            dmg_item = damage_seq[i]
            
            # 如果有特殊zj效果，应用到当前伤害
            if carry_szj is not None:
                orig_dmg, orig_zj_seq = carry_szj
                # 根据当前伤害类型修改
                if isinstance(dmg_item, int):
                    # 数字伤害变为带特殊zj效果的伤害
                    dmg_item = (dmg_item, "szj", orig_zj_seq)
                elif isinstance(dmg_item, tuple) and len(dmg_item) == 3:
                    # 已经是带效果的伤害，需要特殊处理
                    current_dmg, current_effect, current_seq = dmg_item
                    
                    if current_effect == "szj":
                        # 如果当前伤害已经是特殊zj，则叠加效果
                        combined_seq = current_seq + orig_zj_seq
                        dmg_item = (current_dmg, "szj", combined_seq)
                    else:
                        # 其他类型的效果，替换为特殊zj
                        dmg_item = (current_dmg, "szj", orig_zj_seq)
                
                carry_szj = None
            
            # 处理当前伤害
            cancelled, _, next_carry_szj = process_damage(dmg_item)
            
            # 如果伤害被取消且有特殊zj效果，保存给下一个伤害
            if cancelled and next_carry_szj:
                carry_szj = next_carry_szj
            
            i += 1

        # 处理最后可能剩余的特殊zj效果
        if carry_szj:
            orig_dmg, orig_zj_seq = carry_szj
            # 创建一个伤害为orig_dmg的特殊zj
            process_damage((orig_dmg, "szj", orig_zj_seq))

        refresh_deck()
        # 处理抽牌
        if draw_card:
            refresh_deck()
            if deck:
                card = deck.pop(0)
                clock.append(card)
                total_damage += 1
                check_level_up()
                refresh_deck()

        results.append(total_damage)
        refresh_counts.append(refresh_count)
        level_up_counts.append(level_up_count)

    return results, refresh_counts, level_up_counts

class WeissSimulator:
    def __init__(self, master):
        self.master = master
        master.title("Weiß Schwarz伤害模拟计算器")
        master.geometry("950x750")
        
        self.simulation_results = {}

        frame = ttk.LabelFrame(master, text="输入参数")
        frame.pack(padx=10, pady=10, fill='x')

        labels = ["牌组大小(D):", "牌组高潮卡数(N):", "休息室总数(R):", "休息室高潮数(RC):",
                  "计时区总数(C):", "计时区高潮数(CC):", "伤害序列:"]
        self.entries = []
        
        default_values = ["50", "8", "0", "0", "0", "0", ""]
        tooltips = [
            "牌组中的总卡片数量",
            "牌组中的高潮卡数量",
            "休息室中的总卡片数量",
            "休息室中的高潮卡数量",
            "计时区中的总卡片数量",
            "计时区中的高潮卡数量",
            "输入伤害序列，如: 1,2,3zj(2,1),2ch(2)"
        ]
        
        for i, text in enumerate(labels):
            ttk.Label(frame, text=text).grid(row=i, column=0, padx=5, pady=5, sticky='e')
            if i < 6:
                entry = ttk.Entry(frame, width=40)
                entry.insert(0, default_values[i])
                entry.grid(row=i, column=1, padx=5, pady=5)
                self.entries.append(entry)
            else:
                entry = scrolledtext.ScrolledText(frame, width=40, height=3)
                entry.grid(row=i, column=1, padx=5, pady=5)
                self.entries.append(entry)

        help_frame = ttk.LabelFrame(frame, text="伤害序列格式说明")
        help_frame.grid(row=0, column=2, rowspan=7, padx=10, pady=5, sticky='nw')
        
        help_text = (
            "════════════════════ 伤害序列格式说明 ════════════════════\n\n"
            "【1】基本伤害操作\n"
            "────────────────────────────────────────────────────────────\n"
            "• 基本伤害：纯数字，表示几点伤害\n"
            "  例如：1,2,3\n依次造成1点，2点，3点\n"
            "• 反洗(fx)：从休息室随机洗回指定数量的非高潮卡到卡组\n"
            "  格式：fx数字\n"
            "  例如：fx4 - 从休息室随机洗回4张非高潮卡到卡组\n\n"
            "• 取消追加(zj)：若当前伤害被取消，则执行括号内的追加效果\n"
            "  格式：数字zj(追加内容)\n"
            "  例如：2zj(3) - 2点伤害若取消则追加3点伤害\n\n"
            "• 传火追加(*zj)：若当前伤害被取消，则执行括号内的追加效果，并使下一个伤害获得相同效果\n"
            "  格式：*数字zj(追加内容)\n"
            "  例如：*2zj(2) - 2点伤害若取消则追加2点伤害，并使下一个伤害也获得这个特殊效果\n\n"
            "• 传火追加叠加：多个传火追加效果可以叠加\n"
            "  例如：*2zj(1),*3zj(2) - 若第一个伤害被取消，则第二个伤害变为 *3zj(1,2)\n\n"
            "• 嵌套追加：追加效果内可以包含其他操作\n"
            "  例如：4zj(3,fx4,2zj(2)) - 4点伤害若取消，则追加3点伤害、反洗4张非高潮卡、2点伤害(若取消则追加2点)\n\n"
            "【2】卡组操作\n"
            "────────────────────────────────────────────────────────────\n"
            "• 卡组顶部(DT)：\n"
            "  DT+N - 卡组顶部添加一张普通卡\n"
            "  DT+C - 卡组顶部添加一张高潮卡\n"
            "  DT-N - 卡组顶部移除一张普通卡\n"
            "  DT-C - 卡组顶部移除一张高潮卡\n\n"
            "• 卡组底部(DB)：\n"
            "  DB+N - 卡组底部添加一张普通卡\n"
            "  DB+C - 卡组底部添加一张高潮卡\n"
            "  DB-N - 卡组底部移除一张普通卡\n"
            "  DB-C - 卡组底部移除一张高潮卡\n\n"
            "• 休息室(RS)：\n"
            "  RS+N - 休息室添加一张普通卡\n"
            "  RS+C - 休息室添加一张高潮卡\n"
            "  RS-N - 休息室移除一张普通卡\n"
            "  RS-C - 休息室移除一张高潮卡\n\n"
            "• 计时区(CL)：\n"
            "  CL+N - 计时区添加一张普通卡（视为造成1点伤害）\n"
            "  CL+C - 计时区添加一张高潮卡（视为造成1点伤害）\n"
            "  CL-N - 计时区移除一张普通卡（视为减少1点伤害）\n"
            "  CL-C - 计时区移除一张高潮卡（视为减少1点伤害）\n\n"
            "【3】卡片移动操作\n"
            "────────────────────────────────────────────────────────────\n"
            "• 格式：源位置>目标位置[数量]\n"
            "  例如：DT>RS3 - 从卡组顶部移动3张牌到休息室\n\n"
            "• 常见移动操作：\n"
            "  DT>RS - 从卡组顶部移动一张牌到休息室\n"
            "  DT>CL - 从卡组顶部移动一张牌到计时区（视为造成1点伤害）\n"
            "  RS>DT - 从休息室移动一张牌到卡组顶部\n"
            "  RS>DB - 从休息室移动一张牌到卡组底部\n"
            "  CL>RS - 从计时区移动一张牌到休息室（视为减少1点伤害）\n"
            "  CL>DT - 从计时区移动一张牌到卡组顶部\n"
            "  CL>DB - 从计时区移动一张牌到卡组底部\n\n"
            "【4】条件判断操作\n"
            "────────────────────────────────────────────────────────────\n"
            "• 格式：移动操作:条件+zj(追加内容)\n"
            "  条件：C表示高潮卡，N表示普通卡\n\n"
            "• 例如：\n"
            "  DT>RS4:C+zj(2) - 从卡组顶部移动4张牌到休息室，如果其中包含高潮卡，追加执行2点伤害\n"
            "  DT>CL3:N+zj(1,fx2) - 从卡组顶部移动3张牌到计时区，如果其中包含普通卡，追加执行1点伤害和反洗2张卡\n"
            "  RS>DT2:C+zj(DT+C) - 从休息室移动2张牌到卡组顶部，如果其中包含高潮卡，追加在卡组顶部添加1张高潮卡\n\n"
            "【5】示例伤害序列\n"
            "────────────────────────────────────────────────────────────\n"
            "1,2,3                          # 普通连续伤害\n"
            "DT>CL,DT>RS,CL>RS              # 卡片移动操作\n"
            "1,fx4,2                        # 带反洗的伤害\n"
            "2zj(3),4                       # 带追加的伤害\n"
            "*2zj(2),3,4                    # 传火追加伤害(若取消则追加并传递效果)\n"
            "*2zj(1),*3zj(2),4              # 传火追加叠加效果\n"
            "DT>RS4:C+zj(2)                 # 条件判断操作\n"
            "1,DT+N,2,RS>DT,3zj(CL+N,1)     # 混合操作"
        )
        
        self.help_text = tk.Text(help_frame, width=40, height=25, wrap=tk.WORD, bg='#f0f0f0')
        self.help_text.pack(padx=5, pady=5, fill='both', expand=True)
        self.help_text.insert(tk.END, help_text)
        self.help_text.config(state=tk.DISABLED)

        self.draw_card_var = tk.BooleanVar(value=False)
        draw_card_check = ttk.Checkbutton(frame, text="结束后抽1张牌到手牌", 
                                         variable=self.draw_card_var)
        draw_card_check.grid(row=7, column=0, padx=5, pady=5, sticky='w')

        button_frame = ttk.Frame(frame)
        button_frame.grid(row=7, column=1, pady=10)
        
        ttk.Button(button_frame, text="开始模拟", 
                   command=self.start_simulation).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="解析伤害序列", 
                   command=self.parse_damage_preview).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="载入示例", 
                   command=self.load_example).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="保存当前配置", 
                   command=self.save_configuration).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="比较分析", 
                   command=self.open_comparison_window).pack(side=tk.LEFT, padx=5)

        author_label = ttk.Label(master, text="程序由NoFaMe制作 © 2025")
        author_label.pack(side='bottom', pady=5)

        self.result_frame = ttk.LabelFrame(master, text="模拟结果")
        self.result_frame.pack(padx=10, pady=10, fill='both', expand=True)

        self.master.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    def load_example(self):
        examples = [
            "*2zj(2),3,4",
            "*2zj(1),*3zj(2),4"
        ]
        
        example_window = tk.Toplevel(self.master)
        example_window.title("选择示例")
        example_window.geometry("400x250")
        example_window.transient(self.master)
        example_window.grab_set()
        
        ttk.Label(example_window, text="选择要载入的示例:").pack(pady=(10, 5))
        
        examples_frame = ttk.Frame(example_window)
        examples_frame.pack(fill='both', expand=True, padx=10, pady=5)
        
        descriptions = [
            "传火追加示例: 2点伤害若取消则追加2点伤害，并使下一个伤害获得相同效果",
            "传火追加叠加示例: 展示特殊追加效果的叠加机制"
        ]
        
        for i, (ex, desc) in enumerate(zip(examples, descriptions)):
            frame = ttk.Frame(examples_frame)
            frame.pack(fill='x', pady=5)
            
            ttk.Label(frame, text=desc, wraplength=300, justify='left').pack(side=tk.LEFT, padx=5)
            
            ttk.Button(frame, text="载入", 
                      command=lambda e=ex: self.load_selected_example(e, example_window)).pack(side=tk.RIGHT, padx=5)
        
        ttk.Button(example_window, text="取消", 
                  command=example_window.destroy).pack(pady=10)
    
    def load_selected_example(self, example, window):
        self.entries[6].delete("1.0", tk.END)
        self.entries[6].insert(tk.END, example)
        window.destroy()
        messagebox.showinfo("示例已载入", "已载入示例伤害序列，点击'解析伤害序列'按钮可预览解析结果")
    
    def parse_damage_preview(self):
        dmg_seq_str = self.entries[6].get("1.0", tk.END).strip()
        if not dmg_seq_str:
            messagebox.showinfo("提示", "请先输入伤害序列")
            return
            
        try:
            parsed_seq = parse_damage_sequence(dmg_seq_str)
            formatted = format_damage_seq(parsed_seq)
            
            preview_window = tk.Toplevel(self.master)
            preview_window.title("伤害序列解析预览")
            preview_window.geometry("600x400")
            
            text_area = scrolledtext.ScrolledText(preview_window, width=70, height=20)
            text_area.pack(padx=10, pady=10, fill='both', expand=True)
            
            text_area.insert(tk.END, f"原始输入:\n{dmg_seq_str}\n\n")
            text_area.insert(tk.END, f"解析后的伤害序列:\n{formatted}\n\n")
            text_area.insert(tk.END, "详细解析结构:\n")
            
            def display_structure(seq, indent=0):
                for item in seq:
                    if isinstance(item, tuple):
                        if isinstance(item[0], str) and ":" in item[0]:
                            move_op, effect_type, zj_seq = item
                            parts = move_op.split(":")
                            move_part = parts[0]
                            condition = parts[1]
                            
                            from_loc = move_part[:2]
                            to_loc = move_part[3:5]
                            count = 1
                            if len(move_part) > 5 and move_part[5:].isdigit():
                                count = int(move_part[5:])
                            
                            location_map = {
                                "DT": "卡组顶部", 
                                "DB": "卡组底部", 
                                "RS": "休息室", 
                                "CL": "计时区"
                            }
                            from_text = location_map.get(from_loc, from_loc)
                            to_text = location_map.get(to_loc, to_loc)
                            cond_text = "高潮卡" if condition == "C" else "普通卡"
                            
                            text_area.insert(tk.END, f"{' '*indent}· 从{from_text}移动{count}张牌到{to_text} (如果包含{cond_text}则追加):\n")
                            display_structure(zj_seq, indent+2)
                        else:
                            dmg, effect_type, zj_seq = item
                            effect_name = "追加伤害" if effect_type == "zj" else "特殊追加效果"
                            text_area.insert(tk.END, f"{' '*indent}· {dmg}点伤害 取消后{effect_name}:\n")
                            display_structure(zj_seq, indent+2)
                    elif isinstance(item, str) and item.startswith("fx"):
                        text_area.insert(tk.END, f"{' '*indent}· 反洗{item[2:]}张非高潮卡\n")
                    elif isinstance(item, str) and ">" in item:
                        parts = item.split('>')
                        if len(parts) == 2:
                            from_loc = parts[0][:2]
                            to_loc = parts[1][:2] if len(parts[1]) >= 2 else parts[1]
                            
                            count = 1
                            if len(parts[1]) > 2 and parts[1][2:].isdigit():
                                count = int(parts[1][2:])
                            
                            location_map = {
                                "DT": "卡组顶部", 
                                "DB": "卡组底部", 
                                "RS": "休息室", 
                                "CL": "计时区"
                            }
                            from_text = location_map.get(from_loc, from_loc)
                            to_text = location_map.get(to_loc, to_loc)
                            
                            text_area.insert(tk.END, f"{' '*indent}· 从{from_text}移动{count}张牌到{to_text}\n")
                    elif isinstance(item, str) and (
                            item.startswith("DT") or 
                            item.startswith("DB") or 
                            item.startswith("RS") or 
                            item.startswith("CL")):
                        location_map = {
                            "DT": "卡组顶部", 
                            "DB": "卡组底部", 
                            "RS": "休息室", 
                            "CL": "计时区"
                        }
                        op_map = {"+": "添加", "-": "移除"}
                        card_map = {"N": "普通卡", "C": "高潮卡"}
                        
                        location = location_map.get(item[:2], item[:2])
                        operation = op_map.get(item[2], item[2])
                        card_type = card_map.get(item[3], item[3])
                        
                        text_area.insert(tk.END, f"{' '*indent}· {location}{operation}一张{card_type}\n")
                    else:
                        text_area.insert(tk.END, f"{' '*indent}· {item}点伤害\n")
            
            display_structure(parsed_seq)
            text_area.configure(state='disabled')
            
            def copy_to_clipboard():
                preview_window.clipboard_clear()
                preview_window.clipboard_append(formatted)
                messagebox.showinfo("已复制", "解析后的伤害序列已复制到剪贴板")
            
            button_frame = ttk.Frame(preview_window)
            button_frame.pack(pady=10)
            ttk.Button(button_frame, text="复制伤害序列", command=copy_to_clipboard).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="关闭", command=preview_window.destroy).pack(side=tk.LEFT, padx=5)
            
        except Exception as e:
            messagebox.showerror("解析错误", f"伤害序列解析失败: {str(e)}")

    def start_simulation(self):
        try:
            D, N, R, RC, C, CC = [int(e.get()) for e in self.entries[:6]]
            dmg_seq_str = self.entries[6].get("1.0", tk.END).strip()
            
            if not dmg_seq_str:
                messagebox.showinfo("提示", "请先输入伤害序列")
                return
                
            try:
                damage_seq = parse_damage_sequence(dmg_seq_str)
                if not damage_seq:
                    messagebox.showerror("输入错误", "伤害序列解析为空，请检查输入格式！")
                    return
            except Exception as e:
                messagebox.showerror("解析错误", f"伤害序列解析失败: {str(e)}")
                return
                
        except ValueError:
            messagebox.showerror("输入错误", "请检查输入的参数格式是否正确！")
            return

        formatted = format_damage_seq(damage_seq)
        response = messagebox.askokcancel("确认", f"解析后的伤害序列:\n{formatted}\n\n是否继续?")
        if not response:
            return

        draw_card = self.draw_card_var.get()
        dmg_results, refreshes, level_ups = simulate(D, N, R, RC, C, CC, damage_seq, draw_card)
        self.plot_results(dmg_results, refreshes, level_ups)

    def plot_results(self, dmg_results, refreshes, level_ups):
        for widget in self.result_frame.winfo_children():
            widget.destroy()

        graph_frame = ttk.Frame(self.result_frame)
        graph_frame.pack(fill='both', expand=True)
        
        text_frame = ttk.Frame(self.result_frame)
        text_frame.pack(fill='x', padx=10, pady=10)

        max_dmg = max(dmg_results)
        probs = [np.mean([x >= i for x in dmg_results]) for i in range(max_dmg+1)]

        plt.close('all')
        
        fig_width = min(8, max(6, max_dmg / 2))
        self.fig = plt.figure(figsize=(fig_width, 4))
        ax = self.fig.add_subplot(111)
        
        bars = ax.bar(range(max_dmg+1), probs, color='skyblue', edgecolor='black')
        
        ax.set_xticks(range(max_dmg+1))
        
        if max_dmg > 20:
            ax.set_xticks(range(0, max_dmg+1, max(1, max_dmg // 20)))
            plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
        
        ax.set_xlabel("至少命中的总伤害数")
        ax.set_ylabel("概率")
        avg_refresh = np.mean(refreshes)
        avg_level_up = np.mean(level_ups)
        ax.set_title(f"伤害概率分布 (平均卡组更新次数：{avg_refresh:.2f}, 平均升级次数：{avg_level_up:.2f})")
        
        for i, bar in enumerate(bars):
            h = bar.get_height()
            if h > 0.001 or i == 0 or i == len(bars)-1:
                ax.text(bar.get_x() + bar.get_width()/2, h, 
                        f'{h:.3f}', ha='center', va='bottom', 
                        fontsize=8, rotation=0)
        
        self.fig.tight_layout()
        
        self.canvas = FigureCanvasTkAgg(self.fig, master=graph_frame)
        self.canvas.draw()
        self.canvas.get_tk_widget().pack(fill='both', expand=True)
        
        result_text = scrolledtext.ScrolledText(text_frame, width=70, height=10)
        result_text.pack(fill='both', expand=True)
        
        result_text.insert(tk.END, "详细概率分布:\n")
        for i, p in enumerate(probs):
            if p > 0.001 or i == 0:
                result_text.insert(tk.END, f"造成≥{i}点伤害的概率: {p:.3f}\n")
        
        expected_value = 0
        for i in range(max_dmg):
            if i < len(probs) - 1:
                expected_value += i * (probs[i] - probs[i+1])
        result_text.insert(tk.END, f"\n伤害期望值: {expected_value:.2f}点\n")
        result_text.insert(tk.END, f"平均卡组更新次数: {avg_refresh:.2f}次\n")
        result_text.insert(tk.END, f"平均升级次数: {avg_level_up:.2f}次\n")
        
        result_text.configure(state='disabled')

    def save_configuration(self):
        try:
            D, N, R, RC, C, CC = [int(e.get()) for e in self.entries[:6]]
            dmg_seq_str = self.entries[6].get("1.0", tk.END).strip()
            
            if not dmg_seq_str:
                messagebox.showinfo("提示", "请先输入伤害序列")
                return
                
            damage_seq = parse_damage_sequence(dmg_seq_str)
            if not damage_seq:
                messagebox.showerror("输入错误", "伤害序列解析为空，请检查输入格式！")
                return
                
        except ValueError:
            messagebox.showerror("输入错误", "请检查输入的参数格式是否正确！")
            return
        
        name_dialog = tk.Toplevel(self.master)
        name_dialog.title("保存配置")
        name_dialog.geometry("300x120")
        name_dialog.transient(self.master)
        name_dialog.grab_set()
        
        ttk.Label(name_dialog, text="输入配置名称:").pack(pady=(10, 5))
        name_entry = ttk.Entry(name_dialog, width=30)
        name_entry.pack(pady=5, padx=10, fill='x')
        
        def save_config():
            config_name = name_entry.get().strip()
            if not config_name:
                messagebox.showwarning("输入错误", "请输入有效的配置名称")
                return
                
            if config_name in self.simulation_results:
                if not messagebox.askyesno("确认覆盖", f"名称 '{config_name}' 已存在，是否覆盖?"):
                    return
            
            params = {
                'D': D, 'N': N, 'R': R, 'RC': RC, 'C': C, 'CC': CC,
                'damage_seq': damage_seq,
                'damage_str': dmg_seq_str,
                'draw_card': self.draw_card_var.get()
            }
            
            draw_card = self.draw_card_var.get()
            dmg_results, refreshes, level_ups = simulate(D, N, R, RC, C, CC, damage_seq, draw_card)
            
            self.simulation_results[config_name] = (dmg_results, refreshes, level_ups, params)
            
            messagebox.showinfo("保存成功", f"配置 '{config_name}' 已保存")
            name_dialog.destroy()
        
        button_frame = ttk.Frame(name_dialog)
        button_frame.pack(pady=10)
        ttk.Button(button_frame, text="保存", command=save_config).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="取消", command=name_dialog.destroy).pack(side=tk.LEFT, padx=5)
        
        name_entry.focus_set()

    def delete_config(self, name, window=None):
        if messagebox.askyesno("确认删除", f"确定要删除配置 '{name}' 吗?"):
            if name in self.simulation_results:
                del self.simulation_results[name]
                messagebox.showinfo("删除成功", f"配置 '{name}' 已删除")
                if window:
                    window.destroy()
                    self.open_comparison_window()

    def show_config_details(self, name):
        if name in self.simulation_results:
            _, _, _, params = self.simulation_results[name]
            
            details_window = tk.Toplevel(self.master)
            details_window.title(f"配置详情: {name}")
            details_window.geometry("500x400")
            
            text_area = scrolledtext.ScrolledText(details_window, width=60, height=20)
            text_area.pack(padx=10, pady=10, fill='both', expand=True)
            
            text_area.insert(tk.END, f"配置名称: {name}\n\n")
            text_area.insert(tk.END, f"牌组大小(D): {params['D']}\n")
            text_area.insert(tk.END, f"牌组高潮卡数(N): {params['N']}\n")
            text_area.insert(tk.END, f"休息室总数(R): {params['R']}\n")
            text_area.insert(tk.END, f"休息室高潮数(RC): {params['RC']}\n")
            text_area.insert(tk.END, f"计时区总数(C): {params['C']}\n")
            text_area.insert(tk.END, f"计时区高潮数(CC): {params['CC']}\n")
            text_area.insert(tk.END, f"结束后抽1张牌: {'是' if params['draw_card'] else '否'}\n\n")
            
            text_area.insert(tk.END, f"伤害序列:\n{params['damage_str']}\n\n")
            text_area.insert(tk.END, f"解析后的序列:\n{format_damage_seq(params['damage_seq'])}\n")
            
            text_area.configure(state='disabled')
            
            ttk.Button(details_window, text="确定", 
                      command=details_window.destroy).pack(pady=10)

    def open_comparison_window(self):
        if not hasattr(self, 'simulation_results'):
            self.simulation_results = {}
            
        if len(self.simulation_results) < 1:
            messagebox.showinfo("提示", "请先保存至少一个配置用于比较")
            return
            
        comparison_window = tk.Toplevel(self.master)
        comparison_window.title("伤害序列比较分析")
        comparison_window.geometry("1000x700")
        
        info_frame = ttk.Frame(comparison_window)
        info_frame.pack(fill='x', padx=10, pady=5)
        ttk.Label(info_frame, text="选择要比较的配置:").pack(side=tk.LEFT, padx=5)
        
        left_frame = ttk.Frame(comparison_window)
        left_frame.pack(side=tk.LEFT, fill='y', padx=10, pady=10)
        
        list_frame = ttk.LabelFrame(left_frame, text="已保存的配置")
        list_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        canvas = tk.Canvas(list_frame)
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        selected_configs = {}
        for config_name in self.simulation_results:
            var = tk.BooleanVar(value=False)
            selected_configs[config_name] = var
            
            config_frame = ttk.Frame(scrollable_frame)
            config_frame.pack(fill='x', padx=5, pady=2)
            
            ttk.Checkbutton(config_frame, text=config_name, variable=var).pack(side=tk.LEFT, padx=5)
            
            btn_frame = ttk.Frame(config_frame)
            btn_frame.pack(side=tk.RIGHT)
            
            ttk.Button(btn_frame, text="详情", 
                    command=lambda name=config_name: self.show_config_details(name)).pack(side=tk.LEFT, padx=2)
            ttk.Button(btn_frame, text="删除", 
                    command=lambda name=config_name: self.delete_config(name, comparison_window)).pack(side=tk.LEFT, padx=2)
        
        select_frame = ttk.Frame(left_frame)
        select_frame.pack(fill='x', padx=5, pady=5)
        
        def select_all():
            for var in selected_configs.values():
                var.set(True)
                
        def deselect_all():
            for var in selected_configs.values():
                var.set(False)
        
        ttk.Button(select_frame, text="全选", 
                  command=select_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(select_frame, text="取消全选", 
                  command=deselect_all).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(left_frame, text="生成比较图表", 
                  command=lambda: self.compare_selected(selected_configs, right_frame)).pack(pady=10)
        
        ttk.Button(left_frame, text="导出所有配置数据", 
                  command=lambda: self.export_all_data()).pack(pady=5)
        
        right_frame = ttk.Frame(comparison_window)
        right_frame.pack(side=tk.RIGHT, fill='both', expand=True, padx=10, pady=10)
        
        ttk.Label(right_frame, text='选择配置并点击"生成比较图表"按钮').pack(pady=50)

    def compare_selected(self, selected_configs, frame):
        selected_names = [name for name, var in selected_configs.items() if var.get()]
        
        if not selected_names:
            messagebox.showinfo("提示", "请至少选择一个配置进行比较")
            return
        
        self.create_comparison_charts(selected_names, frame)

    def create_comparison_charts(self, config_names, frame):
        for widget in frame.winfo_children():
            widget.destroy()
            
        if not config_names:
            ttk.Label(frame, text="没有选择配置进行比较").pack(pady=50)
            return

        notebook = ttk.Notebook(frame)
        notebook.pack(fill='both', expand=True, padx=5, pady=5)
        
        prob_tab = ttk.Frame(notebook)
        notebook.add(prob_tab, text="概率分布对比")
        
        exp_tab = ttk.Frame(notebook)
        notebook.add(exp_tab, text="期望值对比")
        
        table_tab = ttk.Frame(notebook)
        notebook.add(table_tab, text="数据表格")
        
        prob_frame = ttk.Frame(prob_tab)
        prob_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        max_dmg = 0
        for name in config_names:
            dmg_results, _, _, _ = self.simulation_results[name]
            max_dmg = max(max_dmg, max(dmg_results))
        
        plt.close('all')
        
        fig_prob = plt.figure(figsize=(10, 6))
        ax_prob = fig_prob.add_subplot(111)
        
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
                '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
        markers = ['o', 's', '^', 'D', 'v', '<', '>', 'p', '*', 'h']
        
        for i, name in enumerate(config_names):
            dmg_results, _, _, params = self.simulation_results[name]
            
            current_max = max(dmg_results) if dmg_results else 1
            max_dmg = max(max_dmg, current_max)
            
            probs = []
            for j in range(max_dmg + 1):
                if j <= current_max:
                    prob = np.mean([x >= j for x in dmg_results])
                else:
                    prob = 0.0
                probs.append(prob)
            
            cutoff = next((j for j, p in enumerate(probs) if p < 0.001), len(probs))
            cutoff = max(cutoff, 5)
            
            x_values = np.arange(cutoff + 1)
            y_values = probs[:cutoff + 1]
            
            min_len = min(len(x_values), len(y_values))
            x_values = x_values[:min_len]
            y_values = y_values[:min_len]
            
            color = colors[i % len(colors)]
            marker = markers[i % len(markers)]
            
            ax_prob.plot(x_values, y_values, 
                        label=name, color=color, marker=marker, markersize=4)
        
        ax_prob.set_xlabel("至少命中的总伤害数")
        ax_prob.set_ylabel("概率")
        ax_prob.set_title("伤害概率分布对比")
        ax_prob.set_xticks(range(0, max_dmg+1, max(1, max_dmg // 20)))
        ax_prob.grid(True, linestyle='--', alpha=0.7)
        ax_prob.legend()
        
        fig_prob.tight_layout()
        
        canvas_prob = FigureCanvasTkAgg(fig_prob, master=prob_tab)
        canvas_prob.draw()
        canvas_prob.get_tk_widget().pack(fill='both', expand=True)
        
        exp_frame = ttk.Frame(exp_tab)
        exp_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        fig_exp = plt.figure(figsize=(10, 6))
        ax_exp = fig_exp.add_subplot(111)
        
        names = []
        exp_values = []
        std_devs = []
        refresh_avgs = []
        level_up_avgs = []
        
        for name in config_names:
            dmg_results, refreshes, level_ups, _ = self.simulation_results[name]
            
            exp_val = np.mean(dmg_results)
            std_dev = np.std(dmg_results)
            
            names.append(name)
            exp_values.append(exp_val)
            std_devs.append(std_dev)
            refresh_avgs.append(np.mean(refreshes))
            level_up_avgs.append(np.mean(level_ups))
        
        x = np.arange(len(names))
        width = 0.35
        
        bars = ax_exp.bar(x, exp_values, width, label='期望伤害', color='skyblue')
        ax_exp.errorbar(x, exp_values, yerr=std_devs, fmt='none', ecolor='red', capsize=5)
        
        for bar, val, std in zip(bars, exp_values, std_devs):
            height = bar.get_height()
            ax_exp.text(bar.get_x() + bar.get_width()/2., height,
                    f'{val:.2f}±{std:.2f}', ha='center', va='bottom')
        
        ax_exp.set_xlabel('配置名称')
        ax_exp.set_ylabel('期望伤害')
        ax_exp.set_title('各配置期望伤害对比')
        ax_exp.set_xticks(x)
        ax_exp.set_xticklabels(names, rotation=45, ha='right')
        ax_exp.grid(True, linestyle='--', alpha=0.7)
        
        fig_exp.tight_layout()
        
        canvas_exp = FigureCanvasTkAgg(fig_exp, master=exp_frame)
        canvas_exp.draw()
        canvas_exp.get_tk_widget().pack(fill='both', expand=True)
        
        table_frame = ttk.Frame(table_tab)
        table_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        table_container = ttk.Frame(table_frame)
        table_container.pack(fill='both', expand=True)
        
        h_scroll = ttk.Scrollbar(table_container, orient='horizontal')
        v_scroll = ttk.Scrollbar(table_container, orient='vertical')
        
        columns = ('配置名称', '牌组大小', '高潮卡数', '休息室总数', '休息室高潮数', 
                '计时区总数', '计时区高潮数', '抽牌', '期望伤害', '标准差', 
                '最低伤害', '最高伤害', '平均洗牌次数', '平均升级次数')
        
        tree = ttk.Treeview(table_container, columns=columns, show='headings',
                           xscrollcommand=h_scroll.set, yscrollcommand=v_scroll.set)
        
        for col in columns:
            tree.heading(col, text=col)
            tree.column(col, width=80, anchor='center', stretch=False)
        
        for name in config_names:
            dmg_results, refreshes, level_ups, params = self.simulation_results[name]
            
            exp_val = np.mean(dmg_results)
            std_dev = np.std(dmg_results)
            min_dmg = min(dmg_results)
            max_dmg = max(dmg_results)
            refresh_avg = np.mean(refreshes)
            level_up_avg = np.mean(level_ups)
            
            tree.insert('', 'end', values=(
                name,
                params['D'],
                params['N'],
                params['R'],
                params['RC'],
                params['C'],
                params['CC'],
                '是' if params['draw_card'] else '否',
                f'{exp_val:.2f}',
                f'{std_dev:.2f}',
                min_dmg,
                max_dmg,
                f'{refresh_avg:.2f}',
                f'{level_up_avg:.2f}'
            ))
        
        h_scroll.config(command=tree.xview)
        v_scroll.config(command=tree.yview)
        
        tree.grid(row=0, column=0, sticky='nsew')
        v_scroll.grid(row=0, column=1, sticky='ns')
        h_scroll.grid(row=1, column=0, sticky='ew')
        
        table_container.grid_rowconfigure(0, weight=1)
        table_container.grid_columnconfigure(0, weight=1)
        
        export_frame = ttk.Frame(table_tab)
        export_frame.pack(pady=5)
        
        ttk.Button(export_frame, text="导出比较数据", 
                command=lambda: self.export_comparison_data(config_names)).pack(side=tk.LEFT, padx=5)

    def export_comparison_data(self, config_names):
        try:
            import csv
            from tkinter import filedialog
            import datetime
            
            current_time = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV文件", "*.csv")],
                initialfile=f"伤害比较_{current_time}.csv"
            )
            
            if not filename:
                return
            
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                
                header = ['配置名称', '牌组大小', '高潮卡数', '休息室总数', '休息室高潮数', 
                         '计时区总数', '计时区高潮数', '抽牌', '期望伤害', '标准差', 
                         '最低伤害', '最高伤害', '平均洗牌次数', '平均升级次数', '伤害序列']
                writer.writerow(header)
                
                for name in config_names:
                    dmg_results, refreshes, level_ups, params = self.simulation_results[name]
                    
                    exp_val = np.mean(dmg_results)
                    std_dev = np.std(dmg_results)
                    min_dmg = min(dmg_results)
                    max_dmg = max(dmg_results)
                    refresh_avg = np.mean(refreshes)
                    level_up_avg = np.mean(level_ups)
                    
                    row = [
                        name,
                        params['D'],
                        params['N'],
                        params['R'],
                        params['RC'],
                        params['C'],
                        params['CC'],
                        '是' if params['draw_card'] else '否',
                        f'{exp_val:.2f}',
                        f'{std_dev:.2f}',
                        min_dmg,
                        max_dmg,
                        f'{refresh_avg:.2f}',
                        f'{level_up_avg:.2f}',
                        params['damage_str']
                    ]
                    writer.writerow(row)
                
                writer.writerow([])
                writer.writerow(['伤害详细概率分布'])
                
                max_dmg = 0
                for name in config_names:
                    dmg_results, _, _, _ = self.simulation_results[name]
                    max_dmg = max(max_dmg, max(dmg_results))
                
                prob_header = ['伤害值'] + config_names
                writer.writerow(prob_header)
                
                for i in range(max_dmg + 1):
                    row = [i]
                    for name in config_names:
                        dmg_results, _, _, _ = self.simulation_results[name]
                        prob = np.mean([x >= i for x in dmg_results])
                        row.append(f'{prob:.6f}')
                    writer.writerow(row)
            
            messagebox.showinfo("导出成功", f"比较数据已成功导出到:\n{filename}")
            
        except Exception as e:
            messagebox.showerror("导出错误", f"导出数据时发生错误:\n{str(e)}")

    def export_all_data(self):
        if not self.simulation_results:
            messagebox.showinfo("提示", "没有可导出的配置数据")
            return
            
        self.export_comparison_data(list(self.simulation_results.keys()))

    def on_closing(self):
        plt.close('all')
        self.master.quit()
        self.master.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    app = WeissSimulator(root)
    root.mainloop()
