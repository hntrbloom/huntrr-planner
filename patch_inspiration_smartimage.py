with open('src/components/InspirationView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    """                  <SmartImage
                    src={getPhotoSrc(photo.url)} 
                    storagePath={photo.storagePath}
                    driveFileId={photo.driveFileId}
                    isThumbnail={true}""",
    """                  <SmartImage
                    src={getPhotoSrc(photo.url)} 
                    storagePath={photo.storagePath}
                    driveFileId={photo.driveFileId}
                    isThumbnail={true}
                    mimeType={photo.mimeType}
                    filename={photo.title}"""
)

content = content.replace(
    """              <SmartImage
                src={getPhotoSrc(activePhoto.url)} 
                storagePath={activePhoto.storagePath}
                driveFileId={activePhoto.driveFileId}
                isThumbnail={false}""",
    """              <SmartImage
                src={getPhotoSrc(activePhoto.url)} 
                storagePath={activePhoto.storagePath}
                driveFileId={activePhoto.driveFileId}
                isThumbnail={false}
                mimeType={activePhoto.mimeType}
                filename={activePhoto.title}"""
)

with open('src/components/InspirationView.tsx', 'w') as f:
    f.write(content)
