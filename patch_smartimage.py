import re

with open('src/components/SmartImage.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {",
    "interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {\n  mimeType?: string;\n  filename?: string;"
)

content = content.replace(
    "fallbackIcon,\n   crop,\n  alt,\n   className = '',\n   style,\n  ...props\n }) => {",
    "fallbackIcon,\n   crop,\n  alt,\n   className = '',\n   style,\n  mimeType,\n  filename,\n  ...props\n }) => {"
)

# Update useImageCache call
content = content.replace(
    """  const { displayUrl, isLoading, hasError, errorMessage, retry } = useImageCache(
    storagePath, 
    src, 
    driveFileId, 
    fallbackDriveFileId
  );""",
    """  const { displayUrl, isLoading, hasError, errorMessage, retry } = useImageCache(
    storagePath, 
    src, 
    driveFileId, 
    fallbackDriveFileId,
    mimeType,
    filename,
    isThumbnail
  );"""
)

with open('src/components/SmartImage.tsx', 'w') as f:
    f.write(content)
