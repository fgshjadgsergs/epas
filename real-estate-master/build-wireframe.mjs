/**
 * Генерирует слои каркасного («голографического») города для HERO.
 * Здания рисуются контуром с поэтажными линиями — как в техническом
 * чертеже или в цифровом двойнике квартала.
 * Слои бесшовно повторяются по горизонтали, в CSS едут с разной скоростью.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT =
  "/tmp/claude-0/-home-user-epas/2ca450db-10ba-58e3-bd4a-81dc83c985c5/scratchpad/extract/real-estate-master/apps/web/public/static/img/hero";

const WIDTH = 2400;
const HEIGHT = 900;

function makeRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function makeLayer(config) {
  const rnd = makeRandom(config.seed);
  const parts = [];
  let x = 0;

  while (x < WIDTH) {
    const bw = config.widthRange[0] + Math.floor(rnd() * (config.widthRange[1] - config.widthRange[0]));
    const bh = config.heightRange[0] + Math.floor(rnd() * (config.heightRange[1] - config.heightRange[0]));

    if (x + bw > WIDTH) break;

    const top = HEIGHT - bh;
    const depth = Math.round(bw * 0.26);

    // боковая грань — лёгкая заливка, чтобы объём читался
    parts.push(
      `<path d="M${x + bw} ${top} l${depth} ${-depth * 0.5} v${bh} l${-depth} ${depth * 0.5} z" fill="${config.faceFill}" stroke="${config.stroke}" stroke-width="${config.lineWidth}" stroke-opacity="${config.strokeOpacity * 0.7}"/>`,
    );
    // верхняя грань
    parts.push(
      `<path d="M${x} ${top} l${depth} ${-depth * 0.5} h${bw} l${-depth} ${depth * 0.5} z" fill="${config.topFill}" stroke="${config.stroke}" stroke-width="${config.lineWidth}" stroke-opacity="${config.strokeOpacity}"/>`,
    );
    // фронтальная грань
    parts.push(
      `<rect x="${x}" y="${top}" width="${bw}" height="${bh}" fill="${config.faceFill}" stroke="${config.stroke}" stroke-width="${config.lineWidth}" stroke-opacity="${config.strokeOpacity}"/>`,
    );

    // поэтажные линии — главный «технический» признак
    const floorStep = config.floorStep;
    for (let fy = top + floorStep; fy < HEIGHT - 4; fy += floorStep) {
      parts.push(
        `<line x1="${x}" y1="${fy}" x2="${x + bw}" y2="${fy}" stroke="${config.stroke}" stroke-width="${config.lineWidth * 0.7}" stroke-opacity="${config.strokeOpacity * 0.42}"/>`,
      );
    }

    // вертикальные рёбра внутри объёма
    const ribs = 1 + Math.floor(rnd() * 2);
    for (let r = 1; r <= ribs; r += 1) {
      const rx = x + Math.round((bw / (ribs + 1)) * r);
      parts.push(
        `<line x1="${rx}" y1="${top}" x2="${rx}" y2="${HEIGHT}" stroke="${config.stroke}" stroke-width="${config.lineWidth * 0.7}" stroke-opacity="${config.strokeOpacity * 0.3}"/>`,
      );
    }

    // светящиеся узлы-маркеры на кровле
    if (rnd() > 0.45) {
      const nx = x + Math.round(bw * (0.2 + rnd() * 0.6));
      parts.push(
        `<circle cx="${nx}" cy="${top}" r="${config.nodeRadius}" fill="${config.node}" opacity="0.9"/>`,
        `<circle cx="${nx}" cy="${top}" r="${config.nodeRadius * 3}" fill="${config.node}" opacity="0.16"/>`,
      );
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
    name: "wire-far.svg",
    seed: 9151,
    widthRange: [70, 130],
    heightRange: [150, 340],
    stroke: "#4fb4ff",
    strokeOpacity: 0.42,
    faceFill: "rgba(18, 62, 112, 0.14)",
    topFill: "rgba(40, 120, 190, 0.16)",
    lineWidth: 1.1,
    floorStep: 30,
    gap: 26,
    node: "#7fdcff",
    nodeRadius: 2.4,
  },
  {
    name: "wire-near.svg",
    seed: 33827,
    widthRange: [150, 280],
    heightRange: [280, 600],
    stroke: "#63d2ff",
    strokeOpacity: 0.72,
    faceFill: "rgba(9, 26, 48, 0.55)",
    topFill: "rgba(30, 96, 158, 0.3)",
    lineWidth: 1.5,
    floorStep: 34,
    gap: 60,
    node: "#a8ecff",
    nodeRadius: 3.4,
  },
];

// Светлые варианты тех же слоёв — для светлых тем сайта.
layers.push(
  {
    name: "wire-far-light.svg",
    seed: 9151,
    widthRange: [70, 130],
    heightRange: [150, 340],
    stroke: "#6c86ad",
    strokeOpacity: 0.5,
    faceFill: "rgba(255, 255, 255, 0.45)",
    topFill: "rgba(108, 134, 173, 0.14)",
    lineWidth: 1.1,
    floorStep: 30,
    gap: 26,
    node: "#2f6fe0",
    nodeRadius: 2.4,
  },
  {
    name: "wire-near-light.svg",
    seed: 33827,
    widthRange: [150, 280],
    heightRange: [280, 600],
    stroke: "#3f5d85",
    strokeOpacity: 0.62,
    faceFill: "rgba(250, 252, 255, 0.9)",
    topFill: "rgba(63, 93, 133, 0.12)",
    lineWidth: 1.5,
    floorStep: 34,
    gap: 60,
    node: "#2f6fe0",
    nodeRadius: 3.4,
  },
);

// Малахит: зелёный каркас с золотыми узлами — премиальная тема сайта.
layers.push(
  {
    name: "wire-far-malachite.svg",
    seed: 9151,
    widthRange: [70, 130],
    heightRange: [150, 340],
    stroke: "#3aa583",
    strokeOpacity: 0.42,
    faceFill: "rgba(18, 60, 45, 0.16)",
    topFill: "rgba(50, 140, 110, 0.16)",
    lineWidth: 1.1,
    floorStep: 30,
    gap: 26,
    node: "#7fe0c0",
    nodeRadius: 2.4,
  },
  {
    name: "wire-near-malachite.svg",
    seed: 33827,
    widthRange: [150, 280],
    heightRange: [280, 600],
    stroke: "#4cc39c",
    strokeOpacity: 0.7,
    faceFill: "rgba(7, 26, 19, 0.55)",
    topFill: "rgba(30, 110, 85, 0.3)",
    lineWidth: 1.5,
    floorStep: 34,
    gap: 60,
    node: "#ffd98a",
    nodeRadius: 3.4,
  },
);

// Жадеит: светлая зелёная тема — приглушённые зелёные контуры.
layers.push(
  {
    name: "wire-far-jade.svg",
    seed: 9151,
    widthRange: [70, 130],
    heightRange: [150, 340],
    stroke: "#6f9484",
    strokeOpacity: 0.5,
    faceFill: "rgba(255, 255, 255, 0.45)",
    topFill: "rgba(111, 148, 132, 0.14)",
    lineWidth: 1.1,
    floorStep: 30,
    gap: 26,
    node: "#1e7a58",
    nodeRadius: 2.4,
  },
  {
    name: "wire-near-jade.svg",
    seed: 33827,
    widthRange: [150, 280],
    heightRange: [280, 600],
    stroke: "#3f6d59",
    strokeOpacity: 0.62,
    faceFill: "rgba(250, 255, 252, 0.9)",
    topFill: "rgba(63, 109, 89, 0.12)",
    lineWidth: 1.5,
    floorStep: 34,
    gap: 60,
    node: "#1e7a58",
    nodeRadius: 3.4,
  },
);

for (const layer of layers) {
  const svg = makeLayer(layer);
  await writeFile(join(OUT, layer.name), svg, "utf8");
  console.log(`${layer.name}: ${(svg.length / 1024).toFixed(1)} KB`);
}
