/**
 * Сквозной тест заказов на живом PostgreSQL:
 * calculate → confirm → add to cart → POST /orders → Order+OrderItems →
 * snapshots consumed → cart ORDERED → повторный POST тот же заказ →
 * новая пустая корзина. Плюс идемпотентность, конкуренция, ownership,
 * immutable-снимок, demo-guard и негативные сценарии.
 */
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from '../calculator/calculator.service';
import { PublishService } from '../calculator/publish.service';
import { CartService } from '../cart/cart.service';
import { OrdersService } from './orders.service';
import type { PrismaService } from '../database/prisma.service';
import type { RequestIdentity } from '../identity/request-identity.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from '../calculator/testing/integration-db';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';
import { leafletsDefinitionCreate, leafletsDemoPriceRulesCreate } from '../../prisma/demo/leaflets-demo';

jest.setTimeout(240000);

const SLUG = 'listovki';
let keyCounter = 0;
const nextKey = () => `00000000-0000-4000-8000-${String(++keyCounter).padStart(12, '0')}`;

const contact = {
  contactName: 'Иван  Петров',
  contactPhone: '+7 900 123-45-67',
  contactEmail: 'Ivan@Example.com',
  customerComment: 'позвоните заранее',
};

describe('Заказы: сквозной flow на живой БД (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let cart: CartService;
  let orders: OrdersService;
  let ordersProd: OrdersService;
  let definitionId: string;
  let priceListId: string;
  let userId: string;
  let userIdentity: RequestIdentity;

  async function addOneItem(identity: RequestIdentity, qty = 500): Promise<void> {
    const confirmed = await calculator.confirmCalculation(
      SLUG,
      { parameters: { qty } },
      { userId: identity.userId, anonymousSessionId: identity.anonymousSessionId },
    );
    await cart.addItem(identity, confirmed.snapshotId);
  }

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_orders');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    calculator = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv());
    publisher = new PublishService(prisma as unknown as PrismaService, makePricingEnv());
    cart = new CartService(prisma as unknown as PrismaService, calculator);
    orders = new OrdersService(prisma as unknown as PrismaService, makePricingEnv('staging', true));
    ordersProd = new OrdersService(prisma as unknown as PrismaService, makePricingEnv('production'));

    const category = await prisma.category.create({ data: { slug: 'poligrafiya', title: 'Полиграфия' } });
    const service = await prisma.service.create({
      data: { categoryId: category.id, slug: SLUG, title: 'Листовки' },
    });
    const definition = await prisma.calculatorDefinition.create({
      data: {
        ...leafletsDefinitionCreate(1),
        isDemo: true,
        status: 'DRAFT',
        priceLists: {
          create: [
            { version: 1, status: 'DRAFT', isDemo: true, currency: 'RUB', rules: leafletsDemoPriceRulesCreate() },
          ],
        },
      },
      include: { priceLists: true },
    });
    definitionId = definition.id;
    priceListId = definition.priceLists[0].id;
    await publisher.publishDefinition(definitionId);
    await publisher.publishPriceList(priceListId);
    await prisma.serviceCalculator.create({ data: { serviceId: service.id, definitionId } });

    const user = await prisma.user.create({ data: { email: 'orders-user@example.test', passwordHash: 'x' } });
    userId = user.id;
    userIdentity = { userId, anonymousSessionId: 'orders-session' };
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  // Все тесты делят одного пользователя → одну активную корзину (в проде это
  // корректно: у пользователя ровно одна корзина). Тесты с намеренно
  // падающим заказом оставляют в ней позицию, поэтому очищаем перед каждым.
  beforeEach(async () => {
    const active = await prisma.cart.findMany({ where: { userId, status: 'ACTIVE' } });
    for (const c of active) {
      await prisma.cartItem.deleteMany({ where: { cartId: c.id } });
    }
  });

  it('полный путь: корзина → заказ → снимки consumed → корзина ORDERED → новая пустая', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'flow' };
    await addOneItem(identity, 500);
    await addOneItem(identity, 1000);
    const cartView = await cart.getCart(identity);
    expect(cartView.itemCount).toBe(2);

    const key = nextKey();
    const order = await orders.createOrder(userId, { ...contact, idempotencyKey: key });

    // Заказ = снимок корзины.
    expect(order.orderNumber).toMatch(/^KP-\d{8}-\d{6}$/);
    expect(order.status).toBe('NEW');
    expect(order.items).toHaveLength(2);
    expect(order.totals.total.amountMinor).toBe(cartView.totals.total.amountMinor);
    expect(order.totals.itemsSubtotal.amountMinor).toBe(cartView.totals.itemsSubtotal.amountMinor);
    // Контакты нормализованы (двойной пробел, email в нижнем регистре).
    expect(order.contactName).toBe('Иван Петров');
    expect(order.contactEmail).toBe('ivan@example.com');
    // История: первый статус NEW.
    expect(order.statusHistory).toEqual([
      expect.objectContaining({ fromStatus: null, toStatus: 'NEW' }),
    ]);

    // Снимки израсходованы.
    const snaps = await prisma.calculationSnapshot.findMany({
      where: { id: { in: order.items.map((i) => i.id) } },
    });
    // (items[].id — это OrderItem id; проверим снимки по заказу отдельно)
    const orderItems = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    const consumed = await prisma.calculationSnapshot.findMany({
      where: { id: { in: orderItems.map((i) => i.calculationSnapshotId) } },
    });
    expect(consumed.every((s) => s.consumedAt !== null)).toBe(true);
    expect(snaps).toBeDefined();

    // Корзина закрыта, следующий GET создаёт новую пустую ACTIVE.
    const closed = await prisma.cart.findUniqueOrThrow({ where: { id: cartView.id } });
    expect(closed.status).toBe('ORDERED');
    const fresh = await cart.getCart(identity);
    expect(fresh.id).not.toBe(cartView.id);
    expect(fresh.itemCount).toBe(0);
  });

  it('идемпотентность: тот же ключ возвращает тот же заказ, второй не создаётся', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'idem' };
    await addOneItem(identity);
    const key = nextKey();
    const first = await orders.createOrder(userId, { ...contact, idempotencyKey: key });

    // Повторный POST тем же ключом — та же корзина уже ORDERED, но заказ найдётся по ключу.
    const second = await orders.createOrder(userId, { ...contact, idempotencyKey: key });
    expect(second.id).toBe(first.id);
    expect(second.orderNumber).toBe(first.orderNumber);

    const count = await prisma.order.count({ where: { userId, idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it('конкурентные POST одной корзины: ровно один заказ', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'concurrent' };
    await addOneItem(identity);
    const key = nextKey();
    const results = await Promise.allSettled([
      orders.createOrder(userId, { ...contact, idempotencyKey: key }),
      orders.createOrder(userId, { ...contact, idempotencyKey: key }),
      orders.createOrder(userId, { ...contact, idempotencyKey: key }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThan(0);
    const count = await prisma.order.count({ where: { userId, idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it('пустая корзина → 422', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'empty' };
    await cart.getCart(identity); // создаёт пустую ACTIVE
    await expect(orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('нельзя оформить снимок дважды: после заказа он consumed', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'reuse' };
    const confirmed = await calculator.confirmCalculation(
      SLUG,
      { parameters: { qty: 500 } },
      { userId, anonymousSessionId: 'reuse' },
    );
    await cart.addItem(identity, confirmed.snapshotId);
    await orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() });

    // Тот же снимок в новую корзину не добавить — он израсходован.
    await expect(cart.addItem(identity, confirmed.snapshotId)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('STALE позиция (сменился прайс) блокирует заказ', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'stale' };
    await addOneItem(identity);

    // Публикуем новый прайс — снимок в корзине устарел.
    await prisma.priceList.update({ where: { id: priceListId }, data: { status: 'ARCHIVED' } });
    const v2 = await prisma.priceList.create({
      data: {
        definitionId,
        version: 2,
        status: 'DRAFT',
        isDemo: true,
        currency: 'RUB',
        rules: leafletsDemoPriceRulesCreate(),
      },
    });
    await publisher.publishPriceList(v2.id);

    await expect(orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    priceListId = v2.id; // дальше используем актуальный
  });

  it('UNAVAILABLE позиция (услуга отключена) блокирует заказ', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'unavail' };
    await addOneItem(identity);
    await prisma.service.update({ where: { slug: SLUG }, data: { isActive: false } });
    try {
      await expect(orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    } finally {
      await prisma.service.update({ where: { slug: SLUG }, data: { isActive: true } });
    }
  });

  it('revoked/expired снимок блокирует заказ', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'revoked' };
    const confirmed = await calculator.confirmCalculation(
      SLUG,
      { parameters: { qty: 500 } },
      { userId, anonymousSessionId: 'revoked' },
    );
    await cart.addItem(identity, confirmed.snapshotId);
    // Отзываем снимок уже в корзине (мимо cart-проверок).
    await prisma.calculationSnapshot.update({ where: { id: confirmed.snapshotId }, data: { revokedAt: new Date() } });
    await expect(orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    // Корзина осталась ACTIVE — заказ не создан.
    const c = await cart.getCart(identity);
    expect(c.status).toBe('ACTIVE');
  });

  it('rollback: при падении заказ, снимки и статус корзины не меняются', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'rollback' };
    const confirmed = await calculator.confirmCalculation(
      SLUG,
      { parameters: { qty: 500 } },
      { userId, anonymousSessionId: 'rollback' },
    );
    await cart.addItem(identity, confirmed.snapshotId);
    await prisma.calculationSnapshot.update({ where: { id: confirmed.snapshotId }, data: { revokedAt: new Date() } });

    const before = await prisma.order.count({ where: { userId } });
    await expect(orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() })).rejects.toThrow();
    expect(await prisma.order.count({ where: { userId } })).toBe(before);
    const snap = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snap.consumedAt).toBeNull(); // не израсходован
  });

  it('immutable: переименование услуги и смена прайса не меняют созданный заказ', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'immutable' };
    await addOneItem(identity, 500);
    const order = await orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() });
    const originalTitle = order.items[0].title;
    const originalTotal = order.totals.total.amountMinor;

    await prisma.service.update({ where: { slug: SLUG }, data: { title: 'Переименовано' } });
    const reloaded = await orders.getOrder(userId, order.id);
    expect(reloaded.items[0].title).toBe(originalTitle);
    expect(reloaded.totals.total.amountMinor).toBe(originalTotal);
  });

  it('demo-заказ: разрешён на staging, запрещён в production', async () => {
    // На staging (demo разрешён) заказ по demo-прайсу создаётся и помечается DEMO.
    const identity: RequestIdentity = { userId, anonymousSessionId: 'demo-ok' };
    await addOneItem(identity);
    const demoOrder = await orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() });
    expect(demoOrder.pricingMode).toBe('DEMO');

    // В production тот же demo-состав → отказ.
    const identity2: RequestIdentity = { userId, anonymousSessionId: 'demo-prod' };
    await addOneItem(identity2);
    await expect(ordersProd.createOrder(userId, { ...contact, idempotencyKey: nextKey() })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('ownership: список и detail — только свои; чужой заказ → 404', async () => {
    const other = await prisma.user.create({ data: { email: 'other-orders@example.test', passwordHash: 'x' } });
    const identity: RequestIdentity = { userId, anonymousSessionId: 'own' };
    await addOneItem(identity);
    const order = await orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() });

    // Чужой пользователь не видит заказ.
    await expect(orders.getOrder(other.id, order.id)).rejects.toBeInstanceOf(NotFoundException);
    const otherList = await orders.listOrders(other.id);
    expect(otherList.items.find((o) => o.id === order.id)).toBeUndefined();

    // Свой список содержит заказ, сортировка по дате desc.
    const myList = await orders.listOrders(userId, 1, 5);
    expect(myList.items[0].createdAt >= myList.items[myList.items.length - 1].createdAt).toBe(true);
    expect(myList.items.some((o) => o.id === order.id)).toBe(true);
  });

  it('detail не раскрывает внутренние appliedRules снимка', async () => {
    const identity: RequestIdentity = { userId, anonymousSessionId: 'noleak' };
    await addOneItem(identity);
    const order = await orders.createOrder(userId, { ...contact, idempotencyKey: nextKey() });
    const detail = await orders.getOrder(userId, order.id);
    const json = JSON.stringify(detail);
    expect(json).not.toContain('appliedRules');
    expect(json).not.toContain('priceListId');
  });
});
