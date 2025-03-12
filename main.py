import tkinter as tk
from tkinter import ttk, messagebox
import random
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

plt.rcParams['font.sans-serif'] = ['SimHei']  # 用于显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用于显示负号

def simulate(D, N, R, RC, C, CC, damage_seq, trials=100000):
    results, refresh_counts = [], []
    for _ in range(trials):
        deck = ['C'] * N + ['N'] * (D - N)
        rest = ['C'] * RC + ['N'] * (R - RC)
        clock = ['C'] * CC + ['N'] * (C - CC)
        random.shuffle(deck)
        random.shuffle(rest)
        random.shuffle(clock)
        refresh_count = 0
        total_damage = 0
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

        def check_level_up():
            nonlocal clock, rest
            while len(clock) >= 7:
                lvl_cards = clock[:7]
                level_up_card = next((x for x in lvl_cards if x == 'N'), None)
                if level_up_card:
                    lvl_cards.remove(level_up_card)
                else:
                    level_up_card = lvl_cards.pop(0)
                rest.extend(lvl_cards)
                clock = clock[7:]

        while damage_list:
            dmg_item = damage_list.pop(0)
            check_level_up()

            if isinstance(dmg_item, str) and dmg_item.startswith('fx'):
                check_level_up()
                refresh_deck()
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

            while dmg > 0:
                refresh_deck()
                if not deck:
                    break
                card = deck.pop(0)
                if not deck:
                    refresh_deck()
                clock.append(card)
                if card == 'N':
                    total_damage += 1
                    dmg -= 1
                    if dmg == 0:
                        check_level_up()
                else:
                    if zj_damage:
                        damage_list.insert(0, zj_damage)
                    break

            check_level_up()
            refresh_deck()

        results.append(total_damage)
        refresh_counts.append(refresh_count)

    return results, refresh_counts


class WeissSimulator:
    def __init__(self, master):
        self.master = master
        master.title("Weiß Schwarz伤害模拟计算器")
        master.geometry("900x700")

        frame = ttk.LabelFrame(master, text="输入参数")
        frame.pack(padx=10, pady=10, fill='x')

        labels = ["牌组大小(D):", "牌组高潮卡数(N):", "休息室总数(R):", "休息室高潮数(RC):",
                  "计时区总数(C):", "计时区高潮数(CC):", "伤害序列(如1,fx4,2zj3):"]
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

        ttk.Button(frame, text="开始模拟", command=self.start_simulation).grid(row=7, column=1, pady=10)

        author_label = ttk.Label(master, text="程序由NoFaMe制作 © 2025")
        author_label.pack(side='bottom', pady=5)

        self.result_frame = ttk.LabelFrame(master, text="模拟结果")
        self.result_frame.pack(padx=10, pady=10, fill='both', expand=True)

        # 绑定窗口关闭事件
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

        dmg_results, refreshes = simulate(D, N, R, RC, C, CC, damage_seq)
        self.plot_results(dmg_results, refreshes)

    def plot_results(self, dmg_results, refreshes):
        for widget in self.result_frame.winfo_children():
            widget.destroy()

        max_dmg = max(dmg_results)
        probs = [np.mean([x >= i for x in dmg_results]) for i in range(max_dmg+1)]

        self.fig, ax = plt.subplots(figsize=(8, 4))  # 保存 fig 对象以便关闭时清理
        bars = ax.bar(range(max_dmg+1), probs, color='skyblue', edgecolor='black')
        ax.set_xlabel("至少命中的总伤害数")
        ax.set_ylabel("概率")
        avg_refresh = np.mean(refreshes)
        ax.set_title(f"伤害概率分布 (平均卡组更新次数：{avg_refresh:.2f})")

        for bar in bars:
            h = bar.get_height()
            if h > 0.001:
                ax.text(bar.get_x() + bar.get_width()/2, h, f'{h:.3f}', ha='center', va='bottom', fontsize=8)

        self.canvas = FigureCanvasTkAgg(self.fig, master=self.result_frame)
        self.canvas.draw()
        self.canvas.get_tk_widget().pack(fill='both', expand=True)

    def on_closing(self):
        # 关闭 Matplotlib 图表并销毁 Tkinter 窗口
        if hasattr(self, 'fig'):
            plt.close(self.fig)  # 关闭 Matplotlib Figure
        if hasattr(self, 'canvas'):
            self.canvas.get_tk_widget().destroy()  # 销毁 Canvas
        self.master.quit()  # 退出 Tkinter 主循环
        self.master.destroy()  # 销毁窗口

if __name__ == "__main__":
    root = tk.Tk()
    app = WeissSimulator(root)
    root.mainloop()
