/**
 * Генерирует три слоя ночной панорамы для HERO.
 * Слои бесшовно повторяются по горизонтали и в CSS двигаются с разной
 * скоростью — так получается параллакс и ощущение глубины.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = "/tmp/claude-0/-home-user-epas/2ca450db-10ba-58e3-bd4a-81dc83c985c5/scratchpad/extract/real-estate-master/apps/web/public/static/img/hero";

const WIDTH = 2400;
const HEIGHT = 900;

function makeRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/**
 * @param {object} config
 * @param {number} config.seed
 * @param {[number, number]} config.widthRange   ширина корпуса
 * @param {[number, number]} config.heightRange  высота корпуса
 * @param {string} config.fill                   цвет силуэта
 * @param {number} config.windowChance           доля светящихся окон
 * @param {number} config.windowOpacity          яркость окон
 * @param {number} config.gap                    зазор между корпусами
 * @param {boolean} config.antennas              добавлять ли мачты
 */
function makeLayer(config) {
  const rnd = makeRandom(config.seed);
  const parts = [];

  // Буфер по краям: корпуса не пересекают границу, поэтому тайл стыкуется без шва.
  let x = 0;

  while (x < WIDTH) {
    const bw = config.widthRange[0] + Math.floor(rnd() * (config.widthRange[1] - config.widthRange[0]));
    const bh = config.heightRange[0] + Math.floor(rnd() * (config.heightRange[1] - config.heightRange[0]));

    if (x + bw > WIDTH) {
      break;
    }

    const top = HEIGHT - bh;
    parts.push(`<rect x="${x}" y="${top}" width="${bw}" height="${bh}" fill="${config.fill}"/>`);

    // ступенчатая надстройка — силуэт перестаёт быть частоколом одинаковых блоков
    if (rnd() > 0.55) {
      const sw = Math.floor(bw * (0.34 + rnd() * 0.3));
      const sh = Math.floor(40 + rnd() * 90);
      const sx = x + Math.floor((bw - sw) * rnd());
      parts.push(`<rect x="${sx}" y="${top - sh}" width="${sw}" height="${sh}" fill="${config.fill}"/>`);

      if (config.antennas && rnd() > 0.6) {
        const ax = sx + Math.floor(sw / 2);
        const ah = 30 + Math.floor(rnd() * 60);
        parts.push(
          `<rect x="${ax - 2}" y="${top - sh - ah}" width="4" height="${ah}" fill="${config.fill}"/>`,
        );
        parts.push(
          `<circle cx="${ax}" cy="${top - sh - ah - 5}" r="4" fill="#ff6b6b" opacity="0.75"/>`,
        );
      }
    }

    // окна
    if (config.windowChance > 0) {
      const stepX = 26;
      const stepY = 34;
      for (let wy = top + 22; wy < HEIGHT - 26; wy += stepY) {
        for (let wx = x + 14; wx < x + bw - 20; wx += stepX) {
          if (rnd() < config.windowChance) {
            const warm = rnd() > 0.35;
            parts.push(
              `<rect x="${wx}" y="${wy}" width="11" height="15" fill="${warm ? "#ffd9a0" : "#bcd8ff"}" opacity="${(config.windowOpacity * (0.45 + rnd() * 0.55)).toFixed(2)}"/>`,
            );
          }
        }
      }
    }

    x += bw + config.gap;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMax slice">
${parts.join("\n")}
</svg>`;
}

await mkdir(OUT, { recursive: true });

const layers = [
  {
    name: "skyline-far.svg",
    seed: 7331,
    widthRange: [40, 95],
    heightRange: [110, 300],
    fill: "#20406b",
    windowChance: 0.14,
    windowOpacity: 0.45,
    gap: 5,
    antennas: false,
  },
  {
    name: "skyline-mid.svg",
    seed: 20260,
    widthRange: [70, 150],
    heightRange: [200, 470],
    fill: "#0c1f3c",
    windowChance: 0.3,
    windowOpacity: 0.95,
    gap: 12,
    antennas: true,
  },
  {
    name: "skyline-near.svg",
    seed: 44117,
    widthRange: [130, 260],
    heightRange: [300, 640],
    fill: "#050a13",
    windowChance: 0.18,
    windowOpacity: 0.8,
    gap: 26,
    antennas: true,
  },
];

for (const layer of layers) {
  const svg = makeLayer(layer);
  await writeFile(join(OUT, layer.name), svg, "utf8");
  console.log(`${layer.name}: ${(svg.length / 1024).toFixed(1)} KB`);
}
