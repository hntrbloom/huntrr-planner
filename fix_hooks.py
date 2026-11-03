with open('src/components/InspirationView.tsx', 'r') as f:
    lines = f.readlines()

effect_start = -1
effect_end = -1
for i, line in enumerate(lines):
    if "useEffect(() => {\n" == line and i > 480 and i < 500:
        effect_start = i
        break

if effect_start != -1:
    for i in range(effect_start, len(lines)):
        if "  }, [boards, user]);" in lines[i]:
            effect_end = i
            break

if effect_start != -1 and effect_end != -1:
    print(f"Found effect from {effect_start} to {effect_end}")
    effect_lines = lines[effect_start:effect_end+1]
    
    # Remove from original location
    del lines[effect_start:effect_end+1]
    
    # Find insertion point
    insert_point = -1
    for i, line in enumerate(lines):
        if "// Resolve IDB image URLs for guest mode display" in line:
            insert_point = i
            break
            
    if insert_point != -1:
        # adjust indentation: add 2 spaces to the first line, others are mostly fine
        effect_lines[0] = "  " + effect_lines[0]
        lines = lines[:insert_point] + effect_lines + lines[insert_point:]
        with open('src/components/InspirationView.tsx', 'w') as f:
            f.writelines(lines)
        print("Fixed!")
    else:
        print("Insert point not found")
else:
    print("Effect not found", effect_start, effect_end)
