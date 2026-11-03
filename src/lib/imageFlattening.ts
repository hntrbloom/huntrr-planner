/**
 * Utility to flatten transparent or partially transparent images over a solid white background.
 * Preserves original dimensions and quality without borders, cropping, or stretching.
 */

export async function flattenImageOverWhite(
  fileOrBlob: File | Blob
): Promise<{
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}> {
  let processBlob: Blob = fileOrBlob;

  // Handle HEIC / HEIF format conversion if needed
  const isHeic =
    fileOrBlob.type === 'image/heic' ||
    fileOrBlob.type === 'image/heif' ||
    (fileOrBlob instanceof File &&
      (fileOrBlob.name.toLowerCase().endsWith('.heic') ||
        fileOrBlob.name.toLowerCase().endsWith('.heif')));

  if (isHeic) {
    try {
      const heic2any = (await import('heic2any')).default;
      const converted = await heic2any({
        blob: fileOrBlob,
        toType: 'image/png',
      });
      processBlob = Array.isArray(converted) ? converted[0] : converted;
    } catch (err) {
      console.warn('HEIC conversion skipped or failed:', err);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for processing.'));
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          if (!width || !height) {
            return reject(new Error('Invalid image dimensions.'));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (!ctx) {
            return reject(new Error('Could not initialize canvas context.'));
          }

          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          ctx.restore();

          // Export flattened image as a high-quality PNG (lossless)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Failed to create flattened image blob.'));
              }
              const dataUrl = canvas.toDataURL('image/png', 1.0);
              resolve({ blob, dataUrl, width, height });
            },
            'image/png',
            1.0
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(processBlob);
  });
}
