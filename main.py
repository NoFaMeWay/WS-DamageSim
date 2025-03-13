import tkinter as tk
from tkinter import ttk, messagebox
import random
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

plt.rcParams['font.sans-serif'] = ['SimHei']  # 用于显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用于显示负号

def simulate(D, N, R, RC, C, CC, damage_seq, draw_card=False, trials=100000):
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
        damage_list = damage_seq.copy()

        def refresh_deck():
            nonlocal refresh_count, deck, rest, total_damage
            if not deck:
                refresh_count += 1
                deck, rest = rest, []
                random.shuffle(deck)
                if deck:
                    clock.append(deck.pop(0))
                    total_damage += 1
                    check_level_up()

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

        while damage_list:
            dmg_item = damage_list.pop(0)
            refresh_deck()
            check_level_up()

            if isinstance(dmg_item, str) and dmg_item.startswith('fx'):
                refresh_deck()
                check_level_up()
                num_fx = int(dmg_item[2:])
                rest_N = [card for card in rest if card == 'N']
                for _ in range(min(num_fx, len(rest_N))):
                    rest.remove('N')
                    deck.append('N')
                random.shuffle(deck)
                continue

            zj_damage = None
            if isinstance(dmg_item, tuple):
                dmg, zj_damage = dmg_item
            else:
                dmg = dmg_item

            # 处理伤害
            processing_zone = []  # 临时处理区
            for _ in range(dmg):
                refresh_deck()  # 翻卡前检查卡组是否为空
                if not deck:
                    break  # 若卡组和休息室都为空，停止翻卡
                card = deck.pop(0)
                processing_zone.append(card)
                if card == 'C':  # 翻到高潮卡，取消伤害
                    break

            # 处理翻出的卡
            if 'C' in processing_zone:  # 若有高潮卡，取消伤害，所有卡送休息室
                rest.extend(processing_zone)
                if zj_damage:  # 如果有取消追加伤害
                    damage_list.insert(0, zj_damage)
            else:  # 无高潮卡，所有卡送计时区
                clock.extend(processing_zone)
                total_damage += len(processing_zone)  

            check_level_up()
            refresh_deck()

        # 在所有伤害处理完成后，检查是否抽1张牌
        if draw_card:
            refresh_deck()
            if deck:
                card = deck.pop(0)
                if not deck:
                    refresh_deck()
                clock.append(card)
                check_level_up()

        results.append(total_damage)
        refresh_counts.append(refresh_count)
        level_up_counts.append(level_up_count)

    return results, refresh_counts, level_up_counts


class WeissSimulator:
    def __init__(self, master):
        self.master = master
        master.title("Weiß Schwarz伤害模拟计算器")
        master.geometry("900x700")

        frame = ttk.LabelFrame(master, text="输入参数")
        frame.pack(padx=10, pady=10, fill='x')

        labels = ["牌组大小(D):", "牌组高潮卡数(N):", "休息室总数(R):", "休息室高潮数(RC):",
                  "计时区总数(C):", "计时区高潮数(CC):", "伤害序列(使用英文逗号隔开如1,fx4,2zj3):"]
        self.entries = []
        for i, text in enumerate(labels):
            ttk.Label(frame, text=text).grid(row=i, column=0, padx=5, pady=5, sticky='e')
            entry = ttk.Entry(frame, width=40)
            entry.grid(row=i, column=1, padx=5, pady=5)
            self.entries.append(entry)

        tips = ttk.Label(frame, text="特殊伤害说明:\n"
                                     "反洗(fx)：例如fx4代表从休息室随机洗回4张非高潮卡到卡组\n"
                                     "取消追加(zj)：如2zj3代表2点伤害若取消则追加3点伤害", 
                         foreground='blue', justify='left')
        tips.grid(row=0, column=2, rowspan=7, padx=10, pady=5, sticky='nw')

        # 添加开关：是否抽1张牌
        self.draw_card_var = tk.BooleanVar(value=False)  # 默认关闭
        draw_card_check = ttk.Checkbutton(frame, text="结束后抽1张牌到手牌", 
                                         variable=self.draw_card_var)
        draw_card_check.grid(row=7, column=0, padx=5, pady=5, sticky='w')

        ttk.Button(frame, text="开始模拟", command=self.start_simulation).grid(row=7, column=1, pady=10)

        author_label = ttk.Label(master, text="程序由NoFaMe制作 © 2025")
        author_label.pack(side='bottom', pady=5)

        self.result_frame = ttk.LabelFrame(master, text="模拟结果")
        self.result_frame.pack(padx=10, pady=10, fill='both', expand=True)

        self.master.protocol("WM_DELETE_WINDOW", self.on_closing)

    def start_simulation(self):
        try:
            D, N, R, RC, C, CC = [int(e.get()) for e in self.entries[:6]]
            dmg_seq_str = self.entries[6].get().split(',')
            damage_seq = []
            for dmg in dmg_seq_str:
                dmg = dmg.strip()
                if dmg.startswith('fx'):
                    damage_seq.append(dmg)
                elif 'zj' in dmg:
                    base, extra = dmg.split('zj')
                    damage_seq.append((int(base), int(extra)))
                else:
                    damage_seq.append(int(dmg))
        except ValueError:
            messagebox.showerror("输入错误", "请检查输入的参数格式是否正确！")
            return

        # 传递开关状态给 simulate
        draw_card = self.draw_card_var.get()
        dmg_results, refreshes, level_ups = simulate(D, N, R, RC, C, CC, damage_seq, draw_card)
        self.plot_results(dmg_results, refreshes, level_ups)

    def plot_results(self, dmg_results, refreshes, level_ups):
        for widget in self.result_frame.winfo_children():
            widget.destroy()

        max_dmg = max(dmg_results)
        probs = [np.mean([x >= i for x in dmg_results]) for i in range(max_dmg+1)]

        self.fig, ax = plt.subplots(figsize=(8, 4))
        bars = ax.bar(range(max_dmg+1), probs, color='skyblue', edgecolor='black')
        ax.set_xlabel("至少命中的总伤害数")
        ax.set_ylabel("概率")
        avg_refresh = np.mean(refreshes)
        avg_level_up = np.mean(level_ups)
        ax.set_title(f"伤害概率分布 (平均卡组更新次数：{avg_refresh:.2f}, 平均升级次数：{avg_level_up:.2f})")

        for bar in bars:
            h = bar.get_height()
            if h > 0.001:
                ax.text(bar.get_x() + bar.get_width()/2, h, f'{h:.3f}', ha='center', va='bottom', fontsize=8)

        self.canvas = FigureCanvasTkAgg(self.fig, master=self.result_frame)
        self.canvas.draw()
        self.canvas.get_tk_widget().pack(fill='both', expand=True)

    def on_closing(self):
        if hasattr(self, 'fig'):
            plt.close(self.fig)
        if hasattr(self, 'canvas'):
            self.canvas.get_tk_widget().destroy()
        self.master.quit()
        self.master.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = WeissSimulator(root)
    root.mainloop()
