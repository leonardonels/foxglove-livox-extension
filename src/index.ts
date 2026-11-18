import { ExtensionContext } from "@foxglove/extension";
import { NumericType, PointCloud } from "@foxglove/schemas";

type Time = { sec: number; nsec?: number; nanosec?: number };
type CustomPoint = {
  offset_time: number; x: number; y: number; z: number;
  reflectivity: number; tag: number; line: number;
};
type CustomMsg = {
  header: { stamp: Time; frame_id: string };
  timebase: bigint; point_num: number; lidar_id: number;
  points: CustomPoint[];
};

// One packed point: x y z (f32) | offset_time (u32) | reflectivity, line, tag (u8) | 1 pad byte
const STRIDE = 20;

function toPointCloud(msg: CustomMsg): PointCloud {
  const data = new Uint8Array(msg.points.length * STRIDE);
  const v = new DataView(data.buffer);
  let n = 0;
  for (const p of msg.points) {
    if (p.x === 0 && p.y === 0 && p.z === 0) continue;   // no-return: would pile up at the origin
    const o = n++ * STRIDE;
    v.setFloat32(o, p.x, true);
    v.setFloat32(o + 4, p.y, true);
    v.setFloat32(o + 8, p.z, true);
    v.setUint32(o + 12, p.offset_time, true);
    v.setUint8(o + 16, p.reflectivity);
    v.setUint8(o + 17, p.line);
    v.setUint8(o + 18, p.tag);
  }
  const s = msg.header.stamp;
  return {
    timestamp: { sec: s.sec, nsec: s.nsec ?? s.nanosec ?? 0 },
    frame_id: msg.header.frame_id,
    pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
    point_stride: STRIDE,
    fields: [
      { name: "x", offset: 0, type: NumericType.FLOAT32 },
      { name: "y", offset: 4, type: NumericType.FLOAT32 },
      { name: "z", offset: 8, type: NumericType.FLOAT32 },
      { name: "offset_time", offset: 12, type: NumericType.UINT32 },
      { name: "reflectivity", offset: 16, type: NumericType.UINT8 },
      { name: "line", offset: 17, type: NumericType.UINT8 },
      { name: "tag", offset: 18, type: NumericType.UINT8 },
    ],
    data: data.subarray(0, n * STRIDE),
  };
}

export function activate(ctx: ExtensionContext): void {
  ctx.registerMessageConverter({
    type: "schema",
    fromSchemaName: "livox_ros_driver2/msg/CustomMsg",
    toSchemaName: "foxglove.PointCloud",
    converter: toPointCloud,
  });
}