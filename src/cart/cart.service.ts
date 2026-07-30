import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CalculatorService } from '../calculator/calculator.service';
import type { PricingMode } from '../config/pricing-environment.service';
import type { RequestIdentity } from '../identity/request-identity.service';

/**
 * Свежесть позиции — ВЫЧИСЛЯЕМОЕ значение (не хранится в CartItem, иначе
 * статус мгновенно устаревал бы при смене прайса). Одноимённый enum в БД
 * зарезервирован под Orders, где статус позиции фиксируется в момент заказа.
 */
export type CartItemStatus = 'VALID' | 'STALE' | 'UNAVAILABLE' | 'REQUIRES_RECALCULATION';

/** Срок жизни подтверждённого расчёта: старше — требует пересчёта. */
export const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { snapshot: { include: { priceList: true } } } } };
}>;

export interface CartItemView {
  id: string;
  serviceSlug: string;
  title: string;
  configuration: Prisma.JsonValue;
  quantity: number;
  unitPrice: { amountMinor: number; currency: string };
  lineTotal: { amountMinor: number; currency: string };
  production: { workingDays: number };
  status: CartItemStatus;
  /** Режим прайса, по которому зафиксирована цена позиции. */
  pricingMode: PricingMode;
  calculationSnapshotId: string;
  addedAt: string;
}

export interface CartView {
  id: string;
  status: string;
  currency: string;
  cartVersion: number;
  items: CartItemView[];
  itemCount: number;
  totals: {
    itemsSubtotal: { amountMinor: number; currency: string };
    discounts: { amountMinor: number; currency: string };
    total: { amountMinor: number; currency: string };
  };
  canCheckout: boolean;
  /** DEMO, если хотя бы одна позиция посчитана по демонстрационному прайсу. */
  pricingMode: PricingMode;
}

/**
 * Серверная корзина поверх подтверждённых CalculationSnapshot.
 *
 * Принципы:
 * - цена НИКОГДА не приходит от клиента: единственный вход — snapshotId,
 *   backend сам читает snapshot и берёт суммы оттуда;
 * - владение: snapshot и корзина принадлежат текущему пользователю либо
 *   анонимной сессии; чужой snapshot добавить нельзя (403);
 * - CartItem хранит immutable display-снимок (title/config/цена), поэтому
 *   правки каталога не переписывают уже добавленную позицию;
 * - все мутации идут в транзакции под advisory-lock по корзине — параллельные
 *   add/delete/merge сериализуются;
 * - идемпотентность add: natural key @@unique([cartId, calculationSnapshotId]).
 *
 * Политика переиспользования snapshot (до Orders): один snapshot может лежать
 * в корзине только один раз (unique), но не «сгорает» — повторный add того же
 * snapshot возвращает существующую позицию. Одноразовость появится вместе с
 * Orders (там snapshot будет привязан к OrderItem и отозван через revokedAt).
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculatorService: CalculatorService,
  ) {}

  /** Текущая корзина владельца (создаётся при первом обращении). */
  async getCart(identity: RequestIdentity): Promise<CartView> {
    const cart = await this.getOrCreateCart(this.prisma, identity);
    return this.toView(await this.loadCart(this.prisma, cart.id));
  }

  /**
   * Добавление подтверждённого расчёта. Тело запроса содержит ТОЛЬКО
   * calculationSnapshotId — все суммы читаются из snapshot на сервере.
   */
  async addItem(identity: RequestIdentity, calculationSnapshotId: string): Promise<CartView> {
    return this.mutate(identity, async (tx, cart) => {
      const snapshot = await tx.calculationSnapshot.findUnique({ where: { id: calculationSnapshotId } });
      if (!snapshot) throw new NotFoundException('Расчёт не найден');

      this.assertSnapshotOwnership(snapshot, identity);
      this.assertSnapshotUsable(snapshot);

      if (snapshot.currency !== cart.currency) {
        throw new ConflictException('Валюта расчёта не совпадает с валютой корзины');
      }

      // Идемпотентность: тот же snapshot в той же корзине — та же позиция.
      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_calculationSnapshotId: { cartId: cart.id, calculationSnapshotId },
        },
      });
      if (existing) return;

      const service = await tx.service.findUnique({ where: { slug: snapshot.serviceSlug } });
      const lineTotalMinor = snapshot.totalMinor;
      if (!Number.isSafeInteger(lineTotalMinor) || lineTotalMinor < 0) {
        throw new UnprocessableEntityException('Некорректная сумма расчёта');
      }

      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          calculationSnapshotId,
          serviceSlug: snapshot.serviceSlug,
          // Immutable display snapshot — переименование услуги в каталоге
          // не меняет уже добавленную позицию.
          titleSnapshot: service?.title ?? snapshot.serviceSlug,
          configurationSnapshot: snapshot.parameters as Prisma.InputJsonValue,
          unitPriceMinor: snapshot.unitMinor,
          lineTotalMinor,
          currency: snapshot.currency,
          quantity: 1,
        },
      });
    });
  }

  /** Удаление позиции (только из своей корзины). */
  async removeItem(identity: RequestIdentity, itemId: string): Promise<CartView> {
    return this.mutate(identity, async (tx, cart) => {
      const deleted = await tx.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
      if (deleted.count === 0) throw new NotFoundException('Позиция корзины не найдена');
    });
  }

  /** Полная очистка корзины. */
  async clear(identity: RequestIdentity): Promise<CartView> {
    return this.mutate(identity, async (tx, cart) => {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    });
  }

  /**
   * Пересчёт позиции по актуальному прайсу: сервер заново считает по
   * сохранённым нормализованным параметрам и создаёт НОВЫЙ snapshot.
   * Клиент по-прежнему не передаёт цену.
   */
  async refreshItem(identity: RequestIdentity, itemId: string): Promise<CartView> {
    // Пересчёт делается вне cart-транзакции (обращается к калькулятору),
    // результат применяется под advisory-lock ниже.
    const cart = await this.getOrCreateCart(this.prisma, identity);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { snapshot: true },
    });
    if (!item) throw new NotFoundException('Позиция корзины не найдена');

    const parameters = item.snapshot.parameters as Record<string, unknown>;
    const upsells = (item.snapshot.upsells as string[] | null) ?? [];
    const confirmed = await this.calculatorService.confirmCalculation(
      item.serviceSlug,
      { parameters, upsells },
      { userId: identity.userId, anonymousSessionId: identity.anonymousSessionId },
    );

    return this.mutate(identity, async (tx, lockedCart) => {
      const fresh = await tx.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
      if (fresh.currency !== lockedCart.currency) {
        throw new ConflictException('Валюта пересчёта не совпадает с валютой корзины');
      }
      // Позицию с тем же новым snapshot уже могли добавить параллельно —
      // тогда просто убираем устаревшую (unique cartId+snapshotId).
      const duplicate = await tx.cartItem.findUnique({
        where: { cartId_calculationSnapshotId: { cartId: lockedCart.id, calculationSnapshotId: fresh.id } },
      });
      if (duplicate && duplicate.id !== itemId) {
        await tx.cartItem.deleteMany({ where: { id: itemId, cartId: lockedCart.id } });
        return;
      }
      await tx.cartItem.updateMany({
        where: { id: itemId, cartId: lockedCart.id },
        data: {
          calculationSnapshotId: fresh.id,
          unitPriceMinor: fresh.unitMinor,
          lineTotalMinor: fresh.totalMinor,
          currency: fresh.currency,
          configurationSnapshot: fresh.parameters as Prisma.InputJsonValue,
        },
      });
    });
  }

  /**
   * Слияние анонимной корзины в пользовательскую при входе.
   * Идемпотентно: повторный вызов не создаёт дублей (unique cartId+snapshot),
   * анонимная корзина после слияния помечается MERGED и теряет привязку к
   * сессии — старый токен больше не даёт доступа к перенесённым позициям.
   */
  async merge(identity: RequestIdentity): Promise<CartView> {
    if (!identity.userId) {
      throw new ForbiddenException('Слияние корзин доступно только авторизованному пользователю');
    }
    const userIdentity: RequestIdentity = { userId: identity.userId, anonymousSessionId: identity.anonymousSessionId };

    return this.mutate(userIdentity, async (tx, userCart) => {
      const anonCart = await tx.cart.findFirst({
        where: {
          anonymousSessionId: identity.anonymousSessionId,
          userId: null,
          status: 'ACTIVE',
        },
        include: { items: true },
      });
      if (!anonCart || anonCart.id === userCart.id) return;

      for (const item of anonCart.items) {
        const clash = await tx.cartItem.findUnique({
          where: {
            cartId_calculationSnapshotId: {
              cartId: userCart.id,
              calculationSnapshotId: item.calculationSnapshotId,
            },
          },
        });
        if (clash) {
          // Такая же позиция уже есть у пользователя — детерминированно
          // оставляем пользовательскую, анонимную удаляем.
          await tx.cartItem.delete({ where: { id: item.id } });
          continue;
        }
        await tx.cartItem.update({ where: { id: item.id }, data: { cartId: userCart.id } });
      }

      await tx.cart.update({
        where: { id: anonCart.id },
        data: { status: 'MERGED', anonymousSessionId: null },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Внутреннее
  // -------------------------------------------------------------------------

  /**
   * Общая обёртка мутаций: транзакция + advisory-lock по корзине (сериализует
   * параллельные add/delete/merge) + инкремент version (оптимистичная версия
   * для клиента).
   */
  private async mutate(
    identity: RequestIdentity,
    apply: (tx: TxClient, cart: { id: string; currency: string }) => Promise<void>,
  ): Promise<CartView> {
    const cartId = await this.prisma.$transaction(async (tx) => {
      const cart = await this.getOrCreateCart(tx, identity);
      // Сериализация мутаций одной корзины (снимается на commit/rollback).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${cart.id}, 21))`;
      await apply(tx, cart);
      await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
      return cart.id;
    });
    return this.toView(await this.loadCart(this.prisma, cartId));
  }

  /**
   * Активная корзина владельца. Гонку «двa параллельных create» страхует
   * partial-unique индекс (carts_active_user_key / carts_active_anon_key):
   * проигравший повторяет чтение.
   */
  private async getOrCreateCart(
    client: TxClient,
    identity: RequestIdentity,
  ): Promise<{ id: string; currency: string }> {
    const where: Prisma.CartWhereInput = identity.userId
      ? { userId: identity.userId, status: 'ACTIVE' }
      : { anonymousSessionId: identity.anonymousSessionId, userId: null, status: 'ACTIVE' };

    const existing = await client.cart.findFirst({ where });
    if (existing) return { id: existing.id, currency: existing.currency };

    try {
      const created = await client.cart.create({
        // Пользовательская корзина НЕ занимает слот анонимной сессии
        // (partial-unique carts_active_anon_key): иначе та же сессия не смогла
        // бы иметь собственную анонимную корзину. Владение — по userId.
        data: identity.userId
          ? { userId: identity.userId }
          : { anonymousSessionId: identity.anonymousSessionId },
      });
      return { id: created.id, currency: created.currency };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await client.cart.findFirstOrThrow({ where });
        return { id: raced.id, currency: raced.currency };
      }
      throw error;
    }
  }

  private loadCart(client: TxClient, cartId: string): Promise<CartWithItems> {
    return client.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: {
        // priceList нужен, чтобы отдать pricingMode позиции (DEMO/LIVE)
        // по фактическому прайсу, а не по флагу окружения.
        items: { include: { snapshot: { include: { priceList: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  /** Snapshot принадлежит текущему владельцу — иначе 403. */
  private assertSnapshotOwnership(
    snapshot: { userId: string | null; anonymousSessionId: string | null; id: string },
    identity: RequestIdentity,
  ): void {
    const ownedByUser = snapshot.userId !== null && snapshot.userId === identity.userId;
    const ownedBySession =
      snapshot.anonymousSessionId !== null && snapshot.anonymousSessionId === identity.anonymousSessionId;
    if (ownedByUser || ownedBySession) return;

    // Логируем без идентификаторов сессии/пользователя — только факт отказа.
    this.logger.warn(`Отказ в добавлении чужого расчёта в корзину (snapshot ${snapshot.id})`);
    throw new ForbiddenException('Этот расчёт принадлежит другой сессии');
  }

  /** Snapshot не отозван, не израсходован заказом и не истёк. */
  private assertSnapshotUsable(snapshot: { revokedAt: Date | null; consumedAt: Date | null; createdAt: Date }): void {
    if (snapshot.revokedAt || snapshot.consumedAt) {
      throw new UnprocessableEntityException('Расчёт больше не действителен — повторите расчёт');
    }
    if (Date.now() - snapshot.createdAt.getTime() > SNAPSHOT_TTL_MS) {
      throw new UnprocessableEntityException('Срок действия расчёта истёк — повторите расчёт');
    }
  }

  /**
   * Свежесть позиции относительно текущего активного прайса:
   * - UNAVAILABLE — услуга/определение/прайс недоступны;
   * - STALE — активен ДРУГОЙ прайс-лист (цена изменилась, нужен refresh);
   * - VALID — snapshot ссылается на действующий активный прайс.
   */
  private async computeStatuses(cart: CartWithItems): Promise<Map<string, CartItemStatus>> {
    const statuses = new Map<string, CartItemStatus>();
    if (cart.items.length === 0) return statuses;

    const slugs = [...new Set(cart.items.map((i) => i.serviceSlug))];
    const services = await this.prisma.service.findMany({
      where: { slug: { in: slugs } },
      include: { calculator: { include: { definition: true } } },
    });
    const serviceBySlug = new Map(services.map((s) => [s.slug, s]));

    const definitionIds = [...new Set(services.map((s) => s.calculator?.definitionId).filter(Boolean))] as string[];
    const now = new Date();
    const activeLists = definitionIds.length
      ? await this.prisma.priceList.findMany({
          where: {
            definitionId: { in: definitionIds },
            status: 'ACTIVE',
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
            AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }],
          },
          orderBy: { version: 'desc' },
        })
      : [];
    const activeByDefinition = new Map<string, string>();
    for (const list of activeLists) {
      if (!activeByDefinition.has(list.definitionId)) activeByDefinition.set(list.definitionId, list.id);
    }

    for (const item of cart.items) {
      const service = serviceBySlug.get(item.serviceSlug);
      const definition = service?.calculator?.definition;
      const activePriceListId = definition ? activeByDefinition.get(definition.id) : undefined;

      if (!service || !service.isActive || !definition || definition.status !== 'ACTIVE' || !activePriceListId) {
        statuses.set(item.id, 'UNAVAILABLE');
        continue;
      }
      if (item.snapshot.revokedAt) {
        statuses.set(item.id, 'REQUIRES_RECALCULATION');
        continue;
      }
      statuses.set(item.id, activePriceListId === item.snapshot.priceListId ? 'VALID' : 'STALE');
    }
    return statuses;
  }

  /** Публичная проекция: суммы считает backend, внутренние правила не раскрываются. */
  private async toView(cart: CartWithItems): Promise<CartView> {
    const statuses = await this.computeStatuses(cart);

    let itemsSubtotal = 0;
    const items: CartItemView[] = cart.items.map((item) => {
      itemsSubtotal += item.lineTotalMinor;
      if (!Number.isSafeInteger(itemsSubtotal)) {
        throw new UnprocessableEntityException('Сумма корзины превышает допустимый предел');
      }
      return {
        id: item.id,
        serviceSlug: item.serviceSlug,
        title: item.titleSnapshot,
        configuration: item.configurationSnapshot,
        quantity: item.quantity,
        unitPrice: { amountMinor: item.unitPriceMinor, currency: item.currency },
        lineTotal: { amountMinor: item.lineTotalMinor, currency: item.currency },
        production: { workingDays: item.snapshot.workingDays },
        status: statuses.get(item.id) ?? 'VALID',
        pricingMode: item.snapshot.priceList.isDemo ? 'DEMO' : 'LIVE',
        calculationSnapshotId: item.calculationSnapshotId,
        addedAt: item.createdAt.toISOString(),
      };
    });

    const allValid = items.length > 0 && items.every((i) => i.status === 'VALID');
    // Достаточно одной демо-позиции, чтобы пометить корзину целиком.
    const cartPricingMode: PricingMode = items.some((i) => i.pricingMode === 'DEMO') ? 'DEMO' : 'LIVE';
    return {
      id: cart.id,
      status: cart.status,
      currency: cart.currency,
      cartVersion: cart.version,
      items,
      itemCount: items.length,
      totals: {
        itemsSubtotal: { amountMinor: itemsSubtotal, currency: cart.currency },
        // Скидки и доставка на этом этапе не реализованы — всегда 0.
        discounts: { amountMinor: 0, currency: cart.currency },
        total: { amountMinor: itemsSubtotal, currency: cart.currency },
      },
      canCheckout: allValid,
      pricingMode: cartPricingMode,
    };
  }
}
