import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { REGIONS } from "../../common/domain/domain.constants";
import { bigintToNumber } from "../../common/utils/number.utils";
import { PrismaService } from "../../prisma/prisma.service";
import { EstateMapper } from "./estate.mapper";
import { EstateQueryParser, ParsedEstateSearch } from "./estate-query.parser";

type EstateWithImages = Prisma.EstateGetPayload<{
  include: {
    images: true;
  };
}>;

interface CountRow {
  count: bigint;
}

interface IdRow {
  id: bigint;
}

interface SuggestionRow {
  id: bigint;
  title: string;
  region: string | null;
  district: string | null;
  metro_station: string | null;
}

function joinSql(parts: Prisma.Sql[], separator: Prisma.Sql): Prisma.Sql {
  if (parts.length === 0) {
    return Prisma.empty;
  }

  return parts.slice(1).reduce((accumulator, current) => Prisma.sql`${accumulator}${separator}${current}`, parts[0]);
}

@Injectable()
export class EstatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: EstateMapper,
    private readonly parser: EstateQueryParser,
  ) {}

  async getMainPage(query: Record<string, string | string[] | undefined>): Promise<Record<string, unknown>> {
    const { page, perPage } = this.parser.parseMainPage(query);
    const totalCount = await this.prisma.estate.count({
      where: {
        active: true,
        deletedAt: null,
        isPrivateSale: false,
      },
    });

    let offset = perPage * (page - 1);
    if (offset > totalCount) {
      offset = 0;
    }

    const estates = await this.prisma.estate.findMany({
      where: {
        active: true,
        deletedAt: null,
        isPrivateSale: false,
      },
      include: {
        images: true,
      },
      orderBy: [
        {
          priority: "desc",
        },
        {
          id: "desc",
        },
      ],
      skip: offset,
      take: perPage,
    });

    return {
      page,
      perPage,
      totalCount,
      items: estates.map((estate) => this.mapper.toCard(estate)),
    };
  }

  async search(query: Record<string, string | string[] | undefined>): Promise<Record<string, unknown>> {
    const filters = this.parser.parseListing(query);
    const totalCount = await this.countByFilters(filters);
    const ids = await this.findIdsByFilters(filters, totalCount);

    const estates = await this.findEstatesByIds(ids.map((row) => row.id));
    const orderedItems = ids
      .map((row) => estates.get(row.id.toString()))
      .filter((estate): estate is EstateWithImages => Boolean(estate))
      .map((estate) => this.mapper.toCard(estate));

    return {
      title: filters.title,
      page: filters.page,
      perPage: filters.perPage,
      totalCount,
      items: orderedItems,
      filters,
    };
  }

  async getDetailById(estateId: number): Promise<Record<string, unknown>> {
    const estate = await this.prisma.estate.findFirst({
      where: {
        id: BigInt(estateId),
        active: true,
        deletedAt: null,
        isPrivateSale: false,
      },
      include: {
        images: true,
      },
    });

    if (!estate) {
      throw new NotFoundException(`Estate ${estateId} not found`);
    }

    return this.mapper.toDetail(estate);
  }

  async getSuggestions(query: string | undefined): Promise<Record<string, unknown>> {
    const normalizedQuery = query?.trim() ?? "";

    if (normalizedQuery.length < 2) {
      return {
        items: [],
      };
    }

    const searchPattern = `%${normalizedQuery}%`;
    const rows = await this.prisma.$queryRaw<SuggestionRow[]>(
      Prisma.sql`
        SELECT e.id, e.title, e.region, e.district, e.metro_station
        FROM estates e
        WHERE e.active = TRUE
          AND e.deleted_at IS NULL
          AND e.is_private_sale = FALSE
          AND (
            e.title ILIKE ${searchPattern}
            OR e.region ILIKE ${searchPattern}
            OR e.district ILIKE ${searchPattern}
            OR e.metro_station ILIKE ${searchPattern}
          )
        ORDER BY e.priority DESC, e.id DESC
        LIMIT 10
      `,
    );

    return {
      items: rows.map((row) => ({
        id: bigintToNumber(row.id),
        title: row.title,
        label: this.buildSuggestionLabel(row),
        region: row.region,
        district: row.district,
        metro_station: row.metro_station,
      })),
    };
  }

  private async countByFilters(filters: ParsedEstateSearch): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM estates e
        ${this.buildWhereClause(filters)}
      `,
    );

    return rows.length > 0 ? bigintToNumber(rows[0].count) : 0;
  }

  private async findIdsByFilters(filters: ParsedEstateSearch, totalCount: number): Promise<IdRow[]> {
    const offset = filters.offset < totalCount ? filters.offset : 0;
    const limit = filters.limit <= 50 ? filters.limit : 30;

    return this.prisma.$queryRaw<IdRow[]>(
      Prisma.sql`
        SELECT e.id
        FROM estates e
        ${this.buildWhereClause(filters)}
        ORDER BY e.priority DESC, e.id DESC
        OFFSET ${offset}
        LIMIT ${limit}
      `,
    );
  }

  private async findEstatesByIds(ids: bigint[]): Promise<Map<string, EstateWithImages>> {
    if (ids.length === 0) {
      return new Map();
    }

    const estates = await this.prisma.estate.findMany({
      where: {
        id: {
          in: ids,
        },
        active: true,
        deletedAt: null,
        isPrivateSale: false,
      },
      include: {
        images: true,
      },
    });

    return new Map(estates.map((estate) => [estate.id.toString(), estate]));
  }

  private buildWhereClause(filters: ParsedEstateSearch): Prisma.Sql {
    const expressions: Prisma.Sql[] = [
      Prisma.sql`e.active = TRUE`,
      Prisma.sql`e.deleted_at IS NULL`,
      Prisma.sql`e.is_private_sale = FALSE`,
    ];
    const locationOr: Prisma.Sql[] = [];
    const locationAnd: Prisma.Sql[] = [];

    if (filters.dealType) {
      expressions.push(Prisma.sql`e.deal_type ILIKE ${filters.dealType}`);
    }

    if (filters.estateType) {
      expressions.push(Prisma.sql`e.estate_type ILIKE ${filters.estateType}`);
    }

    if (filters.isMoscow) {
      locationOr.push(Prisma.sql`e.region ILIKE ${REGIONS.MOSCOW}`);
    }

    if (filters.isRegion) {
      locationOr.push(Prisma.sql`e.region ILIKE ${REGIONS.MOSCOW_REGION}`);
    }

    if (filters.district) {
      locationAnd.push(Prisma.sql`e.district ILIKE ${filters.district}`);
    }

    if (filters.metroStation) {
      locationAnd.push(Prisma.sql`e.metro_station ILIKE ${`%${filters.metroStation}%`}`);
    }

    if (filters.searchByAddress) {
      locationAnd.push(Prisma.sql`e.title ILIKE ${`%${filters.searchByAddress}%`}`);
    }

    if (locationOr.length > 0) {
      expressions.push(Prisma.sql`(${joinSql(locationOr, Prisma.sql` OR `)})`);
    }

    if (locationAnd.length > 0) {
      expressions.push(Prisma.sql`(${joinSql(locationAnd, Prisma.sql` AND `)})`);
    }

    const targetPrice =
      filters.fullPrice === false ? Prisma.sql`(e.price / NULLIF(e.area, 0))` : Prisma.sql`e.price`;

    if (filters.priceFrom !== null && filters.priceTo !== null) {
      expressions.push(Prisma.sql`${targetPrice} BETWEEN ${filters.priceFrom} AND ${filters.priceTo}`);
    } else if (filters.priceFrom !== null) {
      expressions.push(Prisma.sql`${targetPrice} >= ${filters.priceFrom}`);
    } else if (filters.priceTo !== null) {
      expressions.push(Prisma.sql`${targetPrice} <= ${filters.priceTo}`);
    }

    if (filters.areaFrom !== null && filters.areaTo !== null) {
      expressions.push(Prisma.sql`e.area BETWEEN ${filters.areaFrom} AND ${filters.areaTo}`);
    } else if (filters.areaFrom !== null) {
      expressions.push(Prisma.sql`e.area >= ${filters.areaFrom}`);
    } else if (filters.areaTo !== null) {
      expressions.push(Prisma.sql`e.area <= ${filters.areaTo}`);
    }

    return Prisma.sql`WHERE ${joinSql(expressions, Prisma.sql` AND `)}`;
  }

  private buildSuggestionLabel(row: SuggestionRow): string {
    return [row.title, row.district, row.metro_station].filter(Boolean).join(" · ");
  }
}
