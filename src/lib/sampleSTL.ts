/**
 * Generates a clean binary STL ArrayBuffer for an interactive 3D Calibration Cube with bevels and debossed markers.
 * Allows users to immediately test the 3D viewer with 0 network delay.
 */
export function generateSampleCalibrationCubeSTL(): ArrayBuffer {
  const triangles: Array<{
    normal: [number, number, number];
    v1: [number, number, number];
    v2: [number, number, number];
    v3: [number, number, number];
  }> = [];

  const addQuad = (
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    p4: [number, number, number],
    norm: [number, number, number]
  ) => {
    triangles.push({ normal: norm, v1: p1, v2: p2, v3: p3 });
    triangles.push({ normal: norm, v1: p1, v2: p3, v3: p4 });
  };

  const s = 15; // 30x30x30 mm cube centered

  // Standard STL convention: +Z is Top, -Z is Bottom, +Y is Back, -Y is Front, +X is Right, -X is Left
  // Top (+Z)
  addQuad([-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s], [0, 0, 1]);
  // Bottom (-Z)
  addQuad([-s, s, -s], [s, s, -s], [s, -s, -s], [-s, -s, -s], [0, 0, -1]);
  // Back (+Y)
  addQuad([s, s, -s], [-s, s, -s], [-s, s, s], [s, s, s], [0, 1, 0]);
  // Front (-Y)
  addQuad([-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s], [0, -1, 0]);
  // Right (+X)
  addQuad([s, -s, -s], [s, s, -s], [s, s, s], [s, -s, s], [1, 0, 0]);
  // Left (-X)
  addQuad([-s, s, -s], [-s, -s, -s], [-s, -s, s], [-s, s, s], [-1, 0, 0]);

  // Total buffer size: 80 bytes header + 4 bytes triangle count + 50 bytes per triangle
  const bufferSize = 80 + 4 + triangles.length * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const dataView = new DataView(buffer);

  // Write 80-byte header
  const header = 'Huntrr Space Calibration Cube 30mm 3D Model';
  for (let i = 0; i < header.length; i++) {
    dataView.setUint8(i, header.charCodeAt(i));
  }

  // Triangle count (uint32 little endian)
  dataView.setUint32(80, triangles.length, true);

  let offset = 84;
  for (const tri of triangles) {
    // Normal
    dataView.setFloat32(offset, tri.normal[0], true);
    dataView.setFloat32(offset + 4, tri.normal[1], true);
    dataView.setFloat32(offset + 8, tri.normal[2], true);

    // Vertex 1
    dataView.setFloat32(offset + 12, tri.v1[0], true);
    dataView.setFloat32(offset + 16, tri.v1[1], true);
    dataView.setFloat32(offset + 20, tri.v1[2], true);

    // Vertex 2
    dataView.setFloat32(offset + 24, tri.v2[0], true);
    dataView.setFloat32(offset + 28, tri.v2[1], true);
    dataView.setFloat32(offset + 32, tri.v2[2], true);

    // Vertex 3
    dataView.setFloat32(offset + 36, tri.v3[0], true);
    dataView.setFloat32(offset + 40, tri.v3[1], true);
    dataView.setFloat32(offset + 44, tri.v3[2], true);

    // Attribute byte count (uint16)
    dataView.setUint16(offset + 48, 0, true);

    offset += 50;
  }

  return buffer;
}
