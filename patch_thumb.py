import re

with open('src/lib/driveImageUtils.ts', 'r') as f:
    content = f.read()

thumbnail_func_old = r"""    // Fetch the actual thumbnail image \(public URL, no auth needed\)
    const imgRes = await fetch\(highResUrl\);
    if \(\!imgRes\.ok\) throw new Error\(`Failed to fetch thumbnail image HTTP \$\{imgRes\.status\}`\);
    
    const blob = await imgRes\.blob\(\);
    const objectUrl = URL\.createObjectURL\(blob\);
    memoryBlobCache\.set\(cacheKey, objectUrl\);
    return objectUrl;"""

thumbnail_func_new = """    memoryBlobCache.set(cacheKey, highResUrl);
    return highResUrl;"""

content = re.sub(thumbnail_func_old, thumbnail_func_new, content)

with open('src/lib/driveImageUtils.ts', 'w') as f:
    f.write(content)

