import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DEAL_TYPES } from "../../common/domain/domain.constants";
import {
  bigintToNumber,
  decimalToNumber,
  formatInteger,
  formatIntegerForPresentation,
  roundToTenths,
} from "../../common/utils/number.utils";
import { StorageService } from "../storage/storage.service";

type EstateWithImages = Prisma.EstateGetPayload<{
  include: {
    images: true;
  };
}>;

@Injectable()
export class EstateMapper {
  constructor(private readonly storageService: StorageService) {}

  toCard(estate: EstateWithImages): Record<string, unknown> {
    const images = [...estate.images].sort((left, right) => Number(right.isMain) - Number(left.isMain));
    const imagePaths = images.map((image) => image.url);
    const price = decimalToNumber(estate.price) ?? 0;
    const mapValue = decimalToNumber(estate.map_) ?? null;

    return {
      dbId: bigintToNumber(estate.id),
      title: estate.title,
      price,
      presentationPrice: formatIntegerForPresentation(price),
      imageUrl: imagePaths[0] ?? "",
      imagePublicUrl: imagePaths[0] ? this.storageService.resolvePublicUrl(imagePaths[0]) : "",
      images: imagePaths,
      imagesPublicUrls: imagePaths.map((imagePath) => this.storageService.resolvePublicUrl(imagePath)),
      metroStation: estate.metroStation,
      district: estate.district,
      region: estate.region,
      area: decimalToNumber(estate.area) ?? 0,
      estateType: estate.estateType,
      floor: estate.floor,
      allFloors: estate.allFloors,
      dealType: estate.dealType,
      tenantType: estate.tenantType,
      profit: this.computeProfit(estate.dealType, price, mapValue),
      map: mapValue ? Math.trunc(mapValue) : null,
      presentationMap: mapValue ? formatIntegerForPresentation(mapValue) : null,
    };
  }

  toDetail(estate: EstateWithImages): Record<string, unknown> {
    const images = [...estate.images].sort((left, right) => Number(right.isMain) - Number(left.isMain));
    const imagePaths = images.map((image) => image.url);
    const planImage = images.find((image) => image.isPlan) ?? null;
    const price = decimalToNumber(estate.price) ?? 0;
    const area = decimalToNumber(estate.area) ?? 0;
    const mapValue = decimalToNumber(estate.map_) ?? null;

    return {
      dbId: bigintToNumber(estate.id),
      title: estate.title,
      coordinates: estate.coordinates,
      coordinatesTuple: this.parseCoordinates(estate.coordinates),
      price,
      presentationPrice: formatIntegerForPresentation(price),
      area,
      areaPrice: area > 0 ? formatInteger(price / area) : null,
      dealType: estate.dealType,
      description: estate.description,
      areaDescription: estate.areaDescription,
      region: estate.region,
      district: estate.district,
      ceilingHeightM: decimalToNumber(estate.ceilingHeightM),
      powerKw: decimalToNumber(estate.powerKw),
      images: imagePaths,
      imagesPublicUrls: imagePaths.map((imagePath) => this.storageService.resolvePublicUrl(imagePath)),
      planImage: planImage?.url ?? null,
      planImagePublicUrl: planImage ? this.storageService.resolvePublicUrl(planImage.url) : null,
      estateType: estate.estateType,
      tenantType: estate.tenantType,
      map: mapValue ? Math.trunc(mapValue) : null,
      presentationMap: mapValue ? formatIntegerForPresentation(mapValue) : null,
      contractTerm: estate.contractTerm,
      indexing: estate.indexing,
      profit: this.computeProfit(estate.dealType, price, mapValue),
      floor: estate.floor,
      allFloors: estate.allFloors,
      metroStation: estate.metroStation,
    };
  }

  private parseCoordinates(coordinates: string | null): [number, number] | null {
    if (!coordinates) {
      return null;
    }

    // Исторический формат — «lon lat» через пробел, но координаты из CRM
    // приходят и через запятую: «lon,lat». Принимаем оба разделителя.
    const parts = coordinates
      .trim()
      .split(/[,\s]+/)
      .map((part) => Number(part));
    if (parts.length !== 2 || parts.some((part) => Number.isNaN(part))) {
      return null;
    }

    return [parts[0], parts[1]];
  }

  private computeProfit(dealType: string, price: number, mapValue: number | null): number | null {
    if (dealType !== DEAL_TYPES.RENT_BUSINESS || mapValue === null || mapValue === 0) {
      return null;
    }

    return roundToTenths(price / mapValue / 12);
  }
}
