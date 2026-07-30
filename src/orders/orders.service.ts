import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PricingEnvironmentService } from '../config/pricing-environment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { generateOrderNumber } from './order-number';

/** Срок жизни подтверждённого расчёта (совпадает с корзиной). */
const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ORDER_NUMBER_RETRIES = 5;

/** Нормализация контактов: обрезка краёв, схлопывание пробелов, email в нижнем регистре. */
function normalizeContact(dto: CreateOrderDto): {
  name: string;
  phone: string;
  email: string;
  comment: string | null;
} {
  const name = dto.contactName.trim().replace(/\s+/g, ' ');
  const phone = dto.contactPhone.trim();
  const email = dto.contactEmail.trim().toLowerCase();
  const comment = dto.customerComment?.trim() || null;
  return { name, phone, email, comment };
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { items: { orderBy: { sortOrder: 'asc' } }; statusHistory: { orderBy: { createdAt: 'asc' } } };
}>;

export interface OrderView {
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
  statusHistory: { fromStatus: string | null; toStatus: string; comment: string | null; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Оформление заказа из серверной корзины.
 *
 * Заказ — неизменяемый снимок корзины: состав, цены и суммы фиксируются в
 * момент создания из серверных CartItem. Клиент передаёт только контакты и
 * ключ идемпотентности — цену/состав он не присылает.
 *
 * Одноразовость снимков: успешный заказ проставляет CalculationSnapshot.
 * consumedAt. «Consumed», а не «revoked», потому что семантика разная —
 * revoked означает «снимок недействителен по безопасности» (и снимается ещё
 * до заказа), а consumed фиксирует «израсходован конкретным заказом»; при
 * этом OrderItem продолжает ссылаться на снимок для воспроизводимости цены.
 * Оба состояния блокируют повторное использование.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEnv: PricingEnvironmentService,
  ) {}

  /**
   * Создание заказа. Всё — в одной транзакции под advisory-lock корзины:
   * блокировка активной корзины, повторная валидация каждой позиции, расчёт
   * totals из серверных CartItem, создание Order+OrderItems+history, пометка
   * снимков consumed, перевод корзины в ORDERED.
   */
  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderView> {
    const orderId = await this.prisma.$transaction(async (tx) => {
      // Идемпотентность: тот же ключ у того же пользователя → тот же заказ.
      const existing = await tx.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: dto.idempotencyKey } },
      });
      if (existing) return existing.id;

      const cart = await tx.cart.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { items: { include: { snapshot: true }, orderBy: { createdAt: 'asc' } } },
      });
      if (!cart) throw new UnprocessableEntityException('Корзина пуста');

      // Сериализация с мутациями корзины: заказ и add/remove/merge не гоняются.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${cart.id}, 21))`;

      if (cart.items.length === 0) throw new UnprocessableEntityException('Корзина пуста');

      const serviceBySlug = await this.loadServices(tx, cart.items.map((i) => i.serviceSlug));
      const activeByDefinition = await this.loadActivePriceLists(tx, serviceBySlug);

      let itemsSubtotal = 0;
      let anyDemo = false;
      const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

      for (const [index, item] of cart.items.entries()) {
        const snapshot = item.snapshot;

        // Валюта позиции = валюта корзины.
        if (snapshot.currency !== cart.currency || item.currency !== cart.currency) {
          throw new ConflictException('Валюта позиции не совпадает с валютой корзины');
        }
        // Владение: снимок принадлежит пользователю.
        if (snapshot.userId !== userId) {
          this.logger.warn(`Отказ в оформлении: чужой расчёт (snapshot ${snapshot.id})`);
          throw new UnprocessableEntityException('Позиция корзины недействительна');
        }
        // Снимок не отозван, не израсходован, не истёк.
        if (snapshot.revokedAt || snapshot.consumedAt) {
          throw new UnprocessableEntityException('Расчёт больше не действителен — обновите корзину');
        }
        if (Date.now() - snapshot.createdAt.getTime() > SNAPSHOT_TTL_MS) {
          throw new UnprocessableEntityException('Срок действия расчёта истёк — обновите корзину');
        }

        // Позиция должна быть VALID: услуга активна, определение активно,
        // снимок ссылается на действующий активный прайс.
        const service = serviceBySlug.get(item.serviceSlug);
        const definition = service?.calculator?.definition;
        const activePriceListId = definition ? activeByDefinition.get(definition.id) : undefined;
        if (!service || !service.isActive || !definition || definition.status !== 'ACTIVE' || !activePriceListId) {
          throw new UnprocessableEntityException('Услуга в корзине недоступна — обновите корзину');
        }
        if (activePriceListId !== snapshot.priceListId) {
          throw new UnprocessableEntityException('Цена позиции изменилась — обновите корзину');
        }

        // pricingMode позиции по фактическому прайсу; demo делает заказ demo.
        const priceList = await tx.priceList.findUniqueOrThrow({ where: { id: snapshot.priceListId } });
        if (priceList.isDemo) anyDemo = true;

        if (!Number.isSafeInteger(item.lineTotalMinor) || item.lineTotalMinor < 0) {
          throw new UnprocessableEntityException('Некорректная сумма позиции');
        }
        itemsSubtotal += item.lineTotalMinor;
        if (!Number.isSafeInteger(itemsSubtotal)) {
          throw new UnprocessableEntityException('Сумма заказа превышает допустимый предел');
        }

        orderItemsData.push({
          calculationSnapshotId: snapshot.id,
          serviceId: service.id,
          serviceSlug: item.serviceSlug,
          titleSnapshot: item.titleSnapshot,
          configurationSnapshot: item.configurationSnapshot as Prisma.InputJsonValue,
          productionSnapshot: { workingDays: snapshot.workingDays } as Prisma.InputJsonValue,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: item.lineTotalMinor,
          currency: item.currency,
          sortOrder: index,
        });
      }

      // Демо-заказ невозможен там, где демо-цены запрещены (в т.ч. production).
      const pricingMode = anyDemo ? 'DEMO' : 'LIVE';
      if (anyDemo && !this.pricingEnv.demoPricingAllowed) {
        throw new UnprocessableEntityException('Оформление по демонстрационному прайсу недоступно');
      }

      // Нормализация на уровне сервиса — не полагаемся только на ValidationPipe
      // (заказ может быть создан и в обход HTTP, напр. из будущего admin-flow).
      const contact = normalizeContact(dto);
      const order = await this.createWithUniqueNumber(tx, {
        userId,
        status: 'NEW',
        currency: cart.currency,
        itemsSubtotalMinor: itemsSubtotal,
        discountsMinor: 0,
        totalMinor: itemsSubtotal,
        pricingMode,
        contactName: contact.name,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        customerComment: contact.comment,
        sourceCartId: cart.id,
        idempotencyKey: dto.idempotencyKey,
        items: { createMany: { data: orderItemsData } },
        statusHistory: { create: [{ fromStatus: null, toStatus: 'NEW', changedByUserId: userId }] },
      });

      // Снимки израсходованы — второй заказ по ним невозможен.
      await tx.calculationSnapshot.updateMany({
        where: { id: { in: cart.items.map((i) => i.calculationSnapshotId) } },
        data: { consumedAt: new Date() },
      });

      // Корзина закрыта; следующий GET /cart создаст новую пустую ACTIVE.
      await tx.cart.update({ where: { id: cart.id }, data: { status: 'ORDERED' } });

      return order.id;
    });

    return this.toView(await this.loadOrder(this.prisma, orderId));
  }

  /** Список заказов пользователя (только своих), createdAt desc, с пагинацией. */
  async listOrders(userId: string, page = 1, pageSize = 20) {
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      items: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        pricingMode: o.pricingMode,
        total: { amountMinor: o.totalMinor, currency: o.currency },
        itemCount: o._count.items,
        createdAt: o.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Заказ по id — только владельца; чужой отдаёт безопасное 404. */
  async getOrder(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { orderBy: { sortOrder: 'asc' } }, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    return this.toView(order);
  }

  // -------------------------------------------------------------------------
  // Внутреннее
  // -------------------------------------------------------------------------

  private async loadServices(tx: TxClient, slugs: string[]) {
    const services = await tx.service.findMany({
      where: { slug: { in: [...new Set(slugs)] } },
      include: { calculator: { include: { definition: true } } },
    });
    return new Map(services.map((s) => [s.slug, s]));
  }

  private async loadActivePriceLists(
    tx: TxClient,
    serviceBySlug: Awaited<ReturnType<OrdersService['loadServices']>>,
  ): Promise<Map<string, string>> {
    const definitionIds = [
      ...new Set([...serviceBySlug.values()].map((s) => s.calculator?.definitionId).filter(Boolean)),
    ] as string[];
    const now = new Date();
    const lists = definitionIds.length
      ? await tx.priceList.findMany({
          where: {
            definitionId: { in: definitionIds },
            status: 'ACTIVE',
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
            AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }],
          },
          orderBy: { version: 'desc' },
        })
      : [];
    const byDefinition = new Map<string, string>();
    for (const list of lists) {
      if (!byDefinition.has(list.definitionId)) byDefinition.set(list.definitionId, list.id);
    }
    return byDefinition;
  }

  /** Создание заказа с ретраем на коллизию orderNumber (unique). */
  private async createWithUniqueNumber(
    tx: TxClient,
    data: Omit<Prisma.OrderCreateInput, 'orderNumber' | 'user'> & { userId: string },
  ) {
    for (let attempt = 0; attempt < ORDER_NUMBER_RETRIES; attempt++) {
      try {
        const { userId, ...rest } = data;
        return await tx.order.create({
          data: { ...rest, orderNumber: generateOrderNumber(), user: { connect: { id: userId } } },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          (error.meta.target as string[]).includes('orderNumber')
        ) {
          continue; // коллизия номера — генерируем новый
        }
        throw error;
      }
    }
    throw new ConflictException('Не удалось сгенерировать номер заказа, повторите попытку');
  }

  private loadOrder(client: TxClient, orderId: string): Promise<OrderWithRelations> {
    return client.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { orderBy: { sortOrder: 'asc' } }, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
  }

  private toView(order: OrderWithRelations): OrderView {
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
        comment: h.comment,
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
