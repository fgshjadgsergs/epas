import type { Metadata } from "next";
import { ArrowLeft, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGalleryApp } from "@/components/public/detail-gallery-app";
import { DetailMap } from "@/components/public/detail-map";
import { EstateCard } from "@/components/public/estate-card";
import {
  PublicApiError,
  PublicEstateDetail,
  getEstateDetail,
  getListingData,
  resolveStoragePath,
} from "@/lib/public-api";
import {
  formatFloorStat,
  formatProfit,
  formatRatePerArea,
  getPricePeriodSuffix,
  isRentBusiness,
} from "@/lib/public-format";

const OFFICE_PHONE = "+7 (999) 001-65-88";
const OFFICE_PHONE_HREF = "tel:+79990016588";

interface DetailPageParams {
  estateId: string;
}

interface DetailPageProps {
  params: Promise<DetailPageParams>;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEstateDescription(description: string | null | undefined) {
  const normalized = description?.trim() ?? "";
  if (!normalized) {
    return "<p>Описание отсутствует.</p>";
  }

  const containsHtml = /<\/?[a-z][^>]*>/i.test(normalized);
  if (containsHtml) {
    return normalized;
  }

  const paragraphs = normalized
    .split(/\r?\n\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`);

  return paragraphs.join("") || "<p>Описание отсутствует.</p>";
}

async function loadEstate(estateId: number) {
  try {
    return await getEstateDetail(estateId);
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

async function loadSimilarEstates(estate: PublicEstateDetail) {
  try {
    const data = await getListingData({
      deal_type: estate.dealType,
      "per-page": "8",
    });

    return data.items.filter((item) => item.dbId !== estate.dbId).slice(0, 3);
  } catch {
    // Похожие объекты — второстепенный блок: если каталог не ответил,
    // страница объекта всё равно должна открыться.
    return [];
  }
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const estateId = Number.parseInt(resolvedParams.estateId, 10);

  if (!Number.isInteger(estateId) || estateId <= 0) {
    return {
      title: "Недвижимость в Москве",
    };
  }

  try {
    const estate = await getEstateDetail(estateId);

    return {
      title: estate.title,
      description: estate.description.replace(/<[^>]+>/g, "").slice(0, 160) || undefined,
    };
  } catch {
    return {
      title: "Недвижимость в Москве",
    };
  }
}

interface FactItem {
  label: string;
  value: string;
}

function buildFacts(estate: PublicEstateDetail): FactItem[] {
  const facts: FactItem[] = [{ label: "Площадь", value: `${estate.area} м²` }];

  const floorStat = formatFloorStat(estate.floor, estate.allFloors);
  if (floorStat.value !== "—") {
    facts.push(floorStat);
  }

  if (estate.estateType) {
    facts.push({ label: "Тип объекта", value: estate.estateType });
  }

  if (estate.ceilingHeightM) {
    facts.push({ label: "Потолки", value: `${estate.ceilingHeightM} м` });
  }

  if (estate.powerKw) {
    facts.push({ label: "Мощность", value: `${estate.powerKw} кВт` });
  }

  if (estate.tenantType) {
    facts.push({ label: "Арендатор", value: estate.tenantType });
  }

  if (estate.contractTerm) {
    facts.push({ label: "Срок договора", value: estate.contractTerm });
  }

  if (estate.indexing) {
    facts.push({ label: "Индексация", value: estate.indexing });
  }

  return facts;
}

function getDealModifier(dealType: string, isBusiness: boolean): string {
  if (isBusiness) {
    return "business";
  }

  return dealType.toLowerCase().trim() === "аренда" ? "rent" : "sale";
}

export default async function DetailPage({ params }: DetailPageProps) {
  const resolvedParams = await params;
  const estateId = Number.parseInt(resolvedParams.estateId, 10);

  if (!Number.isInteger(estateId) || estateId <= 0) {
    notFound();
  }

  const estate = await loadEstate(estateId);
  const similarEstates = await loadSimilarEstates(estate);

  const images = (estate.images.length > 0 ? estate.images : ["/static/img/logo-light.png"]).map((image) =>
    image.startsWith("/static/") ? image : resolveStoragePath(image),
  );
  const planImage = estate.planImage ? resolveStoragePath(estate.planImage) : null;
  const mapsApiKey = process.env.YANDEX_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

  const isBusiness = isRentBusiness(estate.dealType);
  const periodSuffix = getPricePeriodSuffix(estate.dealType);
  const rate = formatRatePerArea(estate.price, estate.area, estate.dealType);
  const profit = formatProfit(estate.profit);
  const facts = buildFacts(estate);
  const dealModifier = getDealModifier(estate.dealType, isBusiness);

  const locationLabel = [estate.district, estate.region]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");

  return (
    <main className="detail-app">
      <div className="container-xl">
        <nav className="detail-app__breadcrumbs" aria-label="Хлебные крошки">
          <Link href="/listing" className="detail-app__back">
            <ArrowLeft aria-hidden="true" />
            Каталог
          </Link>
        </nav>

        <div className="detail-app__layout">
          {/* ----- левая колонка ----- */}
          <div className="detail-app__main">
            <DetailGalleryApp images={images} title={estate.title} />

            <h1 className="detail-app__title">{estate.title}</h1>

            <p className="detail-app__location">
              {estate.metroStation ? (
                <span className="property-card__metro">
                  <span className="property-card__metro-icon" aria-hidden="true">
                    M
                  </span>
                  {estate.metroStation}
                </span>
              ) : null}

              {locationLabel ? <span className="property-card__district">{locationLabel}</span> : null}
            </p>

            <section className="detail-app__section">
              <h2>Характеристики</h2>

              <dl className="detail-facts">
                {facts.map((fact) => (
                  <div key={fact.label} className="detail-facts__item">
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="detail-app__section">
              <h2>Описание</h2>
              <div
                className="detail-app__text"
                dangerouslySetInnerHTML={{ __html: formatEstateDescription(estate.description) }}
              />
            </section>

            {estate.areaDescription ? (
              <section className="detail-app__section">
                <h2>Расположение</h2>
                <p className="detail-app__text">{estate.areaDescription}</p>
              </section>
            ) : null}

            <section className="detail-app__section">
              <h2>На карте</h2>

              {estate.coordinatesTuple && mapsApiKey ? (
                <DetailMap coordinates={estate.coordinatesTuple} apiKey={mapsApiKey} />
              ) : (
                <div className="detail-app__map-fallback">
                  <p>
                    {locationLabel || "Москва"}
                    {estate.metroStation ? `, м. ${estate.metroStation}` : ""}
                  </p>
                  <span>Точное расположение уточним по телефону и покажем объект вживую.</span>
                </div>
              )}
            </section>
          </div>

          {/* ----- правая колонка: цена и действия ----- */}
          <aside className="detail-app__aside">
            <div className="detail-cta">
              <p className="detail-cta__tags">
                <span className={`property-card__badge property-card__badge--${dealModifier}`}>
                  {estate.dealType}
                </span>
                {estate.estateType ? <span className="property-card__type">{estate.estateType}</span> : null}
              </p>

              <p className="detail-cta__price">
                {estate.presentationPrice}&nbsp;₽
                {periodSuffix ? <span>{periodSuffix}</span> : null}
              </p>

              {rate ? (
                <p className="detail-cta__rate">
                  {rate.value} {rate.unit}
                </p>
              ) : null}

              {isBusiness && (estate.presentationMap || profit) ? (
                <div className="detail-cta__pills">
                  {estate.presentationMap ? (
                    <div className="detail-cta__pill" title="Месячный арендный поток">
                      <span>МАП</span>
                      <strong>{estate.presentationMap} ₽/мес</strong>
                    </div>
                  ) : null}

                  {profit ? (
                    <div className="detail-cta__pill" title="Окупаемость">
                      <span>Окупаемость</span>
                      <strong>{profit} лет</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="detail-cta__actions">
                <a href={OFFICE_PHONE_HREF} className="detail-cta__call">
                  <Phone aria-hidden="true" />
                  {OFFICE_PHONE}
                </a>

                <button
                  type="button"
                  className="detail-cta__request"
                  data-bs-toggle="modal"
                  data-bs-target="#userSignInModal"
                >
                  Оставить заявку
                </button>

                {planImage ? (
                  <a href={planImage} target="_blank" rel="noopener noreferrer" className="detail-cta__plan">
                    Планировка
                  </a>
                ) : null}
              </div>

              <p className="detail-cta__note">
                Покажем объект в удобное время, подготовим презентацию и условия по запросу.
              </p>
            </div>
          </aside>
        </div>

        {similarEstates.length > 0 ? (
          <section className="detail-app__similar">
            <h2>Похожие объекты</h2>

            <div className="listing-grid">
              {similarEstates.map((item) => (
                <EstateCard key={item.dbId} estate={item} variant="listing" />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
