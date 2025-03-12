import tkinter as tk
from tkinter import ttk
import random
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

# 设置 matplotlib 以支持中文和负号
plt.rcParams['font.sans-serif'] = ['SimHei']
plt.rcParams['axes.unicode_minus'] = False

def simulate(deck_size, climax_count, rest_size, rest_climax, clock_size, clock_climax, damage_list, trials=100000):
    damage_results, refresh_counts = [], []

    for _ in range(trials):
        deck = ['C'] * climax_count + ['N'] * (deck_size - climax_count)
        rest = ['C'] * rest_climax + ['N'] * (rest_size - rest_climax)
        clock = ['C'] * clock_climax + ['N'] * (clock_size - clock_climax)
        random.shuffle(deck)
        random.shuffle(rest)
        random.shuffle(clock)
        refresh_count, total_damage = 0, 0

        for dmg in damage_list:
            for _ in range(dmg):
                if not deck:
                    # 卡组更新
                    refresh_count += 1
                    total_damage += 1  # 卡组更新的1点真实伤害
                    deck, rest = rest, []  # 将休息室的卡洗入卡组
                    random.shuffle(deck)
                    if not deck:  # 如果休息室也空了，直接跳过此次伤害处理
                        break
                    # 卡组更新后抽1张放入计时区，此处不需再加伤害，因为已统计
                    clock.append(deck.pop(0))
                    if len(clock) >= 7:  # 升级处理
                        level_up(clock, rest)

                if not deck:
                    continue

                card = deck.pop(0)
                clock.append(card)
                if card == 'C':  # 如果是高潮卡，取消此次伤害并将计时区卡送入休息室
                    rest += clock
                    clock.clear()
                    break
            else:  # 如果没有高潮卡取消伤害，统计总伤害
                total_damage += dmg

            while len(clock) >= 7:  # 检查是否需要升级处理
                level_up(clock, rest)

        damage_results.append(total_damage)
        refresh_counts.append(refresh_count)

    return damage_results, refresh_counts

def level_up(clock, rest):
    # 优先升级非高潮卡
    for i in range(7):
        if clock[i] == 'N':
            clock.pop(i)
            break
    else:
        clock.pop(0)  # 如果计时区全是高潮卡，则随便移除一张
    rest += clock[:6]  # 其余6张卡送入休息室
    del clock[:6]  # 从计时区移除这6张卡

class WeissSimulator:
    def __init__(self, master):
        self.master = master
        master.title("Weiß Schwarz 伤害模拟计算器")
        master.geometry("850x700")

        self.setup_ui()

    def setup_ui(self):
        frame = ttk.LabelFrame(self.master, text="输入参数")
        frame.pack(padx=10, pady=10, fill='x')

        author_label = ttk.Label(self.master, text="程序由NoFaMe制作 © 2025")
        author_label.pack(side='bottom', fill='x', pady=10)

        labels = ["牌组大小(D):", "牌组高潮卡数(N):", "休息室总数(R):", "休息室高潮数(RC):",
                  "计时区总数(C):", "计时区高潮数(CC):", "伤害序列(如1,1,1,3,3,3,2):"]
        self.entries = []
        for i, text in enumerate(labels):
            ttk.Label(frame, text=text).grid(row=i, column=0, padx=5, pady=5, sticky='e')
            entry = ttk.Entry(frame, width=40)
            entry.grid(row=i, column=1, padx=5, pady=5)
            self.entries.append(entry)

        ttk.Button(frame, text="开始模拟", command=self.start_simulation).grid(row=7, column=0, columnspan=2, pady=10)

        self.result_frame = ttk.LabelFrame(self.master, text="模拟结果")
        self.result_frame.pack(padx=10, pady=10, fill='both', expand=True)

    def start_simulation(self):
        params = []
        try:
            for entry in self.entries[:6]:
                params.append(int(entry.get()))
            damage_list = [int(x.strip()) for x in self.entries[6].get().split(',')]
            params.append(damage_list)
        except ValueError:
            tk.messagebox.showerror("错误", "请确保所有输入项均为有效数字。")
            return

        damage_results, refresh_counts = simulate(*params)
        self.plot_results(damage_results, refresh_counts)

    def plot_results(self, dmg_results, refresh_counts):
        for widget in self.result_frame.winfo_children():
            widget.destroy()

        max_dmg = max(dmg_results)
        dmg_range = range(max_dmg + 1)
        probs = [np.mean([x >= d for x in dmg_results]) for d in dmg_range]

        fig, ax = plt.subplots(figsize=(8,4))
        bars = ax.bar(dmg_range, probs, color='skyblue', edgecolor='black')
        ax.set_xlabel("至少命中的总伤害数")
        ax.set_ylabel("概率")
        avg_refresh = np.mean(refresh_counts)
        ax.set_title(f"伤害概率分布 (平均卡组更新次数：{avg_refresh:.2f})")

        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2, h, f"{h:.3f}", ha='center', va='bottom', fontsize=8)

        canvas = FigureCanvasTkAgg(fig, master=self.result_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill='both', expand=True)

if __name__ == "__main__":
    root = tk.Tk()
    app = WeissSimulator(root)
    root.mainloop()
