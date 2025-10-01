import { useEffect } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/*
AutoAreaClipper
- Uygulama açıldığında (tileset yüklendiği anda) /area.md dosyasını fetch eder.
- area.md içindeki Cartesian snippet (new Cesium.Cartesian3(...)) veya Degrees Array (lon, lat, ...) verisini parse eder.
- Parsed vertex sayısı >= 3 ise Cesium.ClippingPolygonCollection uygular.
- Kullanıcı etkileşimi gerektirmez.
*/
export default function AutoAreaClipper() {
  const { tileset } = useCesiumCtx();

  useEffect(() => {
    if (!tileset) return;
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch('/area.md', { cache: 'no-cache' });
        if (!res.ok) return; // Dosya yoksa sessizce vazgeç
        const text = await res.text();

        let positions = parseCartesian(text);
        if (!positions.length) positions = parseDegrees(text);
        if (positions.length < 3) {
          console.warn('[AutoAreaClipper] Yeterli vertex bulunamadı.');
          return;
        }
        // Duplicate consecutive son vertex varsa kaldır
        if (positions.length >= 2) {
          const last = positions[positions.length - 1];
            const first = positions[0];
          const prev = positions[positions.length - 2];
          if (almostEqual(last, prev)) positions.pop();
          if (positions.length >=3 && almostEqual(positions[positions.length-1], first)) positions.pop();
        }

        if (cancelled || !tileset) return;
        if (!Cesium.ClippingPolygon || !Cesium.ClippingPolygonCollection) {
          console.warn('[AutoAreaClipper] ClippingPolygon API mevcut değil.');
          return;
        }
        const clipPoly = new Cesium.ClippingPolygon({ positions });
        tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
          polygons: [clipPoly],
          unionClippingRegions: true,
          edgeColor: Cesium.Color.YELLOW,
          edgeWidth: 1.0
        });
        console.log(`[AutoAreaClipper] Applied clipping polygon with ${positions.length} vertices.`);
      } catch (e) {
        console.error('[AutoAreaClipper] Hata', e);
      }
    }
    run();
    return () => { cancelled = true; if (tileset) tileset.clippingPolygons = undefined; };
  }, [tileset]);

  return null;
}

function parseCartesian(md) {
  const regex = /new\s+Cesium\.Cartesian3\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/g;
  const arr = [];
  let m;
  while ((m = regex.exec(md)) !== null) {
    const x = parseFloat(m[1]); const y = parseFloat(m[2]); const z = parseFloat(m[3]);
    if ([x,y,z].every(isFinite)) arr.push(new Cesium.Cartesian3(x,y,z));
  }
  return arr;
}

function parseDegrees(md) {
  // Find the degrees array section line with lon, lat pairs
  const degSection = md.match(/Degrees Array[\s\S]*?\n([0-9.,\s-]+)/);
  if (!degSection) return [];
  const nums = degSection[1].split(/[,\s]+/).map(n=>n.trim()).filter(Boolean).map(parseFloat);
  const arr = [];
  for (let i=0;i<nums.length-1;i+=2) {
    const lon = nums[i]; const lat = nums[i+1];
    if (isFinite(lon) && isFinite(lat)) arr.push(Cesium.Cartesian3.fromDegrees(lon, lat));
  }
  return arr;
}

function almostEqual(a,b,eps=1e-6){
  return Math.abs(a.x-b.x)<eps && Math.abs(a.y-b.y)<eps && Math.abs(a.z-b.z)<eps;
}
