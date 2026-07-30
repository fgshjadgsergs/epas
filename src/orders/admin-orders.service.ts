import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SearchAdminOrdersDto } from './dto/list-admin-orders.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { allowedTransitions, canTransition } from './order-status';

/** Отдельный seed advisory-lock для смены статуса (не пересекается с cart=21). */
const ORDER_STATUS_LOCK_SEED = 31;

/** Поля сотрудника, безопасные для показа в истории (только имя, без id/email/PII). */
const ACTOR_SELECT = { firstName: true, lastName: true } as const;

type AdminOrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: { orderBy: { sortOrder: 'asc' } };
    statusHistory: {
      orderBy: { createdAt: 'asc' };
      include: { changedBy: { select: typeof ACTOR_SELECT } };
    };
  };
}>;

/** Безопасное имя сотрудника: имя+фамилия, иначе нейтральная подпись. */
function actorDisplayName(actor: { firstName: string | null; lastName: string | null }): string {
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim();
  return name || 'Сотрудник';
}

export interface AdminOrderView {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  pricingMode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerComment: string | null;
  items: {
    id: string;
    serviceSlug: string;
    title: string;
    configuration: Prisma.JsonValue;
    production: Prisma.JsonValue;
    quantity: number;
    unitPrice: { amountMinor: number; currency: string };
    lineTotal: { amountMinor: number; currency: string };
  }[];
  totals: {
    itemsSubtotal: { amountMinor: number; currency: string };
    discounts: { amountMinor: number; currency: string };
    total: { amountMinor: number; currency: string };
  };
  statusHistory: {
    fromStatus: string | null;
    toStatus: string;
    /** Сотрудник, сменивший статус (без UUID и PII — только имя). NULL — системное. */
    changedBy: { displayName: string } | null;
    comment: string | null;
    createdAt: string;
  }[];
  /** Разрешённые из текущего статуса переходы (карта — на backend). */
  allowedTransitions: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Административные операции с заказами: чтение любого заказа и смена статуса.
 *
 * Держится отдельно от клиентского OrdersService, чтобы не смешивать доступ:
 * тот всегда фильтрует по userId владельца, здесь — доступ по permissions
 * (проверяется guard'ом на контроллере), заказ читается без привязки к
 * пользователю. Ответ строится теми же полями, что и клиентский, и не
 * раскрывает idempotencyKey, snapshot-токены и внутренние pricing-правила.
 */
@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список заказов с фильтрами; createdAt desc; ограниченный page size.
   *
   * Единый builder для GET (безопасные фильтры) и POST search (те же фильтры +
   * телефон/email из body): контроллеры передают сюда одну и ту же форму
   * запроса, логика фильтрации/пагинации/сортировки не дублируется.
   */
  async listOrders(query: SearchAdminOrdersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    // Телефон хранится с форматированием (+7 900 …), поэтому нормализуем обе
    // стороны по цифрам: предвыбираем id заказов, где цифры телефона содержат
    // цифры запроса, и добавляем ограничение к остальным фильтрам.
    if (query.phone) {
      const digits = query.phone.replace(/\D/g, '');
      if (digits) {
        // Класс [^0-9], а не \D: в теге template literal backslash съедается.
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM orders WHERE regexp_replace("contactPhone", '[^0-9]', '', 'g') LIKE ${`%${digits}%`}
        `;
        where.id = { in: rows.map((r) => r.id) };
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        pricingMode: o.pricingMode,
        contactName: o.contactName,
        total: { amountMinor: o.totalMinor, currency: o.currency },
        itemCount: o._count.items,
        createdAt: o.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Любой заказ по id (в отличие от клиента — без фильтра владельца). */
  async getOrder(orderId: string): Promise<AdminOrderView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: { changedBy: { select: ACTOR_SELECT } },
        },
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    return this.toView(order);
  }

  /**
   * Смена статуса заказа. В одной транзакции под advisory-lock заказа:
   * блокировка → чтение текущего статуса → проверка допустимости перехода →
   * обновление Order.status → запись OrderStatusHistory с actorId.
   *
   * Защита от гонок: advisory-lock сериализует одновременные PATCH; проверка
   * актуального статуса внутри lock отсекает переход из уже изменённого
   * состояния (lost update) и повторный одинаковый PATCH.
   */
  async changeStatus(
    orderId: string,
    actorId: string,
    dto: ChangeOrderStatusDto,
  ): Promise<AdminOrderView> {
    const target = dto.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orderId}, ${ORDER_STATUS_LOCK_SEED}))`;

      const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (!order) throw new NotFoundException('Заказ не найден');

      const current = order.status;

      // Повтор того же статуса — не ошибка и не дубликат истории: конфликт,
      // потому что переход в уже установленное состояние недопустим по карте.
      if (current === target) {
        throw new ConflictException({
          message: 'Заказ уже находится в этом статусе',
          errors: { code: 'ORDER_STATUS_UNCHANGED', currentStatus: current },
        });
      }

      if (!canTransition(current, target)) {
        throw new ConflictException({
          message: `Недопустимый переход статуса: ${current} → ${target}`,
          errors: { code: 'ORDER_STATUS_TRANSITION_FORBIDDEN', currentStatus: current },
        });
      }

      await tx.order.update({ where: { id: orderId }, data: { status: target } });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: current,
          toStatus: target,
          changedByUserId: actorId,
          comment: dto.comment ?? null,
        },
      });
    });

    // Логируем факт смены без персональных данных заказа.
    this.logger.log(`Статус заказа ${orderId} → ${target} (actor ${actorId})`);
    return this.getOrder(orderId);
  }

  // -------------------------------------------------------------------------

  private buildWhere(query: SearchAdminOrdersDto): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.orderNumber) where.orderNumber = query.orderNumber;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
      if (where.createdAt.gte && where.createdAt.lte && where.createdAt.gte > where.createdAt.lte) {
        throw new BadRequestException('Начало периода позже конца');
      }
    }

    // Телефон обрабатывается в listOrders (нормализация по цифрам через raw).

    // Email хранится в нижнем регистре; частичное совпадение без регистра.
    if (query.email) {
      where.contactEmail = { contains: query.email, mode: 'insensitive' };
    }

    return where;
  }

  private toView(order: AdminOrderWithRelations): AdminOrderView {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      pricingMode: order.pricingMode,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      contactEmail: order.contactEmail,
      customerComment: order.customerComment,
      items: order.items.map((item) => ({
        id: item.id,
        serviceSlug: item.serviceSlug,
        title: item.titleSnapshot,
        configuration: item.configurationSnapshot,
        production: item.productionSnapshot,
        quantity: item.quantity,
        unitPrice: { amountMinor: item.unitPriceMinor, currency: item.currency },
        lineTotal: { amountMinor: item.lineTotalMinor, currency: item.currency },
      })),
      totals: {
        itemsSubtotal: { amountMinor: order.itemsSubtotalMinor, currency: order.currency },
        discounts: { amountMinor: order.discountsMinor, currency: order.currency },
        total: { amountMinor: order.totalMinor, currency: order.currency },
      },
      statusHistory: order.statusHistory.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: h.changedBy ? { displayName: actorDisplayName(h.changedBy) } : null,
        comment: h.comment,
        createdAt: h.createdAt.toISOString(),
      })),
      allowedTransitions: allowedTransitions(order.status),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
