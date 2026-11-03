import sys

with open('src/components/ClientReceiptsView.tsx', 'r') as f:
    lines = f.readlines()

colors = ['[#FFE8F4]', '[#E8FDFF]']
color_idx = 0

for i, line in enumerate(lines):
    if 'bg-[#FFF0F4]' in line:
        lines[i] = line.replace('bg-[#FFF0F4]', f'bg-{colors[color_idx]}')
        color_idx = (color_idx + 1) % len(colors)

with open('src/components/ClientReceiptsView.tsx', 'w') as f:
    f.writelines(lines)
