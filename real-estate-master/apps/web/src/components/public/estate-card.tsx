import Link from "next/link";
import { PublicEstateCard, resolveStoragePath } from "@/lib/public-api";
import {
  formatFloorStat,
  formatProfit,
  formatRatePerArea,
  getPricePeriodSuffix,
  isRentBusiness,
  shortenEstateType,
} from "@/lib/public-format";
import { EstateCardGallery } from "./estate-card-gallery";

interface EstateCardProps {
  estate: PublicEstateCard;
  variant: "main" | "listing";
}

interface CardStat {
  label: string;
  value: string;
}

function getCardImages(estate: PublicEstateCard): string[] {
  const images =
    estate.images.length > 0
      ? estate.images
      : estate.imageUrl
      ? [estate.imageUrl]
      : [];

  if (images.length === 0) {
    return ["/static/img/logo-light.png"];
  }

  return images.map((image) => resolveStoragePath(image));
}

function getDealTypeModifier(dealType: string): string {
  const normalized = dealType.toLowerCase().trim();

  if (normalized === "аренда") {
    return "rent";
  }

  if (normalized === "продажа") {
    return "sale";
  }

  return "business";
}

function getLocationLabel(estate: PublicEstateCard): string | null {
  const parts = [estate.district, estate.region].filter(
    (part): part is string => Boolean(part && part.trim()),
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Ровно три плитки в любом сценарии — иначе карточки в ряду разъезжаются
 * по высоте и кнопка «Смотреть объект» прыгает по вертикали.
 */
function getCardStats(estate: PublicEstateCard): CardStat[] {
  const stats: CardStat[] = [{ label: "Площадь", value: `${estate.area} м²` }];

  stats.push(formatFloorStat(estate.floor, estate.allFloors));

  if (isRentBusiness(estate.dealType)) {
    const profit = formatProfit(estate.profit);
    stats.push({ label: "Окупаемость", value: profit ? `${profit} лет` : "—" });

    return stats;
  }

  const rate = formatRatePerArea(estate.price, estate.area, estate.dealType);
  stats.push({
    label: rate?.unit === "₽/м² в год" ? "Ставка м²/год" : "Цена м²",
    value: rate ? `${rate.value} ₽` : "—",
  });

  return stats;
}

export function EstateCard({ estate }: EstateCardProps) {
  const cardImages = getCardImages(estate);
  const isBusiness = isRentBusiness(estate.dealType);

  const periodSuffix = getPricePeriodSuffix(estate.dealType);
  const stats = getCardStats(estate);
  const locationLabel = getLocationLabel(estate);
  const dealModifier = getDealTypeModifier(estate.dealType);

  // У арендного бизнеса арендатор говорит покупателю больше, чем тип помещения.
  const typeChipLabel =
    (isBusiness ? estate.tenantType : null) ?? shortenEstateType(estate.estateType);

  const detailHref = `/detail/${estate.dbId}`;

  return (
    <article className="property-card">
      <div className="property-card__media">
        <span className={`property-card__badge property-card__badge--${dealModifier}`}>
          {estate.dealType}
        </span>

        {typeChipLabel ? (
          <span className="property-card__type">{typeChipLabel}</span>
        ) : null}

        <EstateCardGallery images={cardImages} title={estate.title} />
      </div>

      <div className="property-card__body">
        <p className="property-card__price">
          {estate.presentationPrice}&nbsp;₽
          {periodSuffix ? (
            <span className="property-card__price-period">{periodSuffix}</span>
          ) : null}
        </p>

        <h3 className="property-card__address">{estate.title}</h3>

        <p className="property-card__location">
          {estate.metroStation ? (
            <span className="property-card__metro">
              <span className="property-card__metro-icon" aria-hidden="true">
                M
              </span>
              {estate.metroStation}
            </span>
          ) : null}

          {locationLabel ? (
            <span className="property-card__district">{locationLabel}</span>
          ) : null}
        </p>

        <dl className="property-card__meta">
          {stats.map((stat) => (
            <div key={stat.label} className="property-card__stat">
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="property-card__footer">
          <Link className="property-card__cta" href={detailHref}>
            Смотреть объект
          </Link>
        </div>
      </div>
    </article>
  );
}
