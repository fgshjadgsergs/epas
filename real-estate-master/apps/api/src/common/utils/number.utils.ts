import { Prisma } from "@prisma/client";

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}

export function bigintToNumber(value: bigint): number {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`BigInt value ${value.toString()} is outside JS safe integer range`);
  }

  return numberValue;
}

function normalizeSpaces(input: string): string {
  return input.replace(/\u00a0/g, " ").replace(/\u202f/g, " ");
}

export function formatInteger(value: number): string {
  return normalizeSpaces(
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(Math.trunc(value)),
  );
}

/**
 * Разряды разделяются неразрывным пробелом (U+00A0): цена не рвётся на
 * перенос, но группы остаются визуально различимы — узкий U+202F на
 * крупном кегле почти сливает цифры.
 */
export function formatIntegerForPresentation(value: number): string {
  return formatInteger(value).replace(/ /g, " ");
}

export function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}
