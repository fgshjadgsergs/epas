/**
 * Сквозной тест серверной корзины на живом PostgreSQL:
 * calculate → confirm → snapshot → add to cart → get cart → totals,
 * плюс ownership, идемпотентность, merge, stale и конкурентность.
 */
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from '../calculator/calculator.service';
import { PublishService } from '../calculator/publish.service';
import { CartService, SNAPSHOT_TTL_MS } from './cart.service';
import type { PrismaService } from '../database/prisma.service';
import type { RequestIdentity } from '../identity/request-identity.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from '../calculator/testing/integration-db';
import { leafletsDefinitionCreate, leafletsDemoPriceRulesCreate } from '../../prisma/demo/leaflets-demo';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

jest.setTimeout(240000);

const SLUG = 'listovki';

describe('Серверная корзина (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let cart: CartService;
  let definitionId: string;
  let priceListId: string;
  let userId: string;

  /** Личность анонима: своя сессия. */
  const anon = (id: string): RequestIdentity => ({ userId: null, anonymousSessionId: id });

  async function confirmFor(identity: RequestIdentity, qty = 500): Promise<string> {
    const res = await calculator.confirmCalculation(
      SLUG,
      { parameters: { qty } },
      { userId: identity.userId, anonymousSessionId: identity.anonymousSessionId },
    );
    return res.snapshotId;
  }

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_cart');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    calculator = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv());
    publisher = new PublishService(prisma as unknown as PrismaService, makePricingEnv());
    cart = new CartService(prisma as unknown as PrismaService, calculator);

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

    const user = await prisma.user.create({
      data: { email: 'cart-user@example.test', passwordHash: 'x' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  it('сквозной путь: confirm → add → get; сумма корзины равна сумме snapshot', async () => {
    const identity = anon('session-main');
    const preview = await calculator.calculateBySlug(SLUG, { parameters: { qty: 500 } });
    const snapshotId = await confirmFor(identity);

    const view = await cart.addItem(identity, snapshotId);
    expect(view.items).toHaveLength(1);
    expect(view.items[0].lineTotal.amountMinor).toBe(preview.price.amountMinor);
    expect(view.totals.itemsSubtotal.amountMinor).toBe(preview.price.amountMinor);
    expect(view.totals.total.amountMinor).toBe(preview.price.amountMinor);
    expect(view.items[0].status).toBe('VALID');
    expect(view.canCheckout).toBe(true);

    // Повторный GET возвращает ту же корзину той же сессии.
    const again = await cart.getCart(identity);
    expect(again.id).toBe(view.id);
    expect(again.itemCount).toBe(1);
  });

  it('идемпотентность: повторный add того же snapshot не создаёт дубль', async () => {
    const identity = anon('session-idem');
    const snapshotId = await confirmFor(identity);
    const first = await cart.addItem(identity, snapshotId);
    const second = await cart.addItem(identity, snapshotId);
    expect(first.itemCount).toBe(1);
    expect(second.itemCount).toBe(1);
    expect(second.totals.total.amountMinor).toBe(first.totals.total.amountMinor);
  });

  it('конкурентные add одного snapshot дают ровно одну позицию', async () => {
    const identity = anon('session-concurrent');
    const snapshotId = await confirmFor(identity);
    const results = await Promise.allSettled([
      cart.addItem(identity, snapshotId),
      cart.addItem(identity, snapshotId),
      cart.addItem(identity, snapshotId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThan(0);
    const view = await cart.getCart(identity);
    expect(view.itemCount).toBe(1);
  });

  it('чужой snapshot добавить нельзя (403), несуществующий — 404', async () => {
    const owner = anon('session-owner');
    const attacker = anon('session-attacker');
    const snapshotId = await confirmFor(owner);

    await expect(cart.addItem(attacker, snapshotId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      cart.addItem(attacker, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Корзина «атакующего» осталась пустой.
    expect((await cart.getCart(attacker)).itemCount).toBe(0);
  });

  it('нельзя удалить позицию из чужой корзины', async () => {
    const owner = anon('session-del-owner');
    const attacker = anon('session-del-attacker');
    const view = await cart.addItem(owner, await confirmFor(owner));
    const itemId = view.items[0].id;

    await expect(cart.removeItem(attacker, itemId)).rejects.toBeInstanceOf(NotFoundException);
    expect((await cart.getCart(owner)).itemCount).toBe(1);
  });

  it('удаление позиции и очистка корзины', async () => {
    const identity = anon('session-clear');
    const view = await cart.addItem(identity, await confirmFor(identity));
    const afterRemove = await cart.removeItem(identity, view.items[0].id);
    expect(afterRemove.itemCount).toBe(0);
    expect(afterRemove.canCheckout).toBe(false); // пустая корзина не оформляется

    await cart.addItem(identity, await confirmFor(identity, 1000));
    const cleared = await cart.clear(identity);
    expect(cleared.itemCount).toBe(0);
    expect(cleared.totals.total.amountMinor).toBe(0);
  });

  it('истёкший и отозванный snapshot не принимаются (422)', async () => {
    const identity = anon('session-expired');
    const expiredId = await confirmFor(identity);
    await prisma.calculationSnapshot.update({
      where: { id: expiredId },
      data: { createdAt: new Date(Date.now() - SNAPSHOT_TTL_MS - 60_000) },
    });
    await expect(cart.addItem(identity, expiredId)).rejects.toBeInstanceOf(UnprocessableEntityException);

    const revokedId = await confirmFor(identity);
    await prisma.calculationSnapshot.update({ where: { id: revokedId }, data: { revokedAt: new Date() } });
    await expect(cart.addItem(identity, revokedId)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('несовпадение валюты расчёта и корзины — 409', async () => {
    const identity = anon('session-currency');
    const snapshotId = await confirmFor(identity);
    await prisma.calculationSnapshot.update({ where: { id: snapshotId }, data: { currency: 'USD' } });
    await expect(cart.addItem(identity, snapshotId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('смена активного прайса делает позицию STALE и блокирует canCheckout', async () => {
    const identity = anon('session-stale');
    const view = await cart.addItem(identity, await confirmFor(identity));
    expect(view.canCheckout).toBe(true);

    // Публикуем новую версию прайса: старый snapshot больше не актуален.
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

    const stale = await cart.getCart(identity);
    expect(stale.items[0].status).toBe('STALE');
    expect(stale.canCheckout).toBe(false);
    // Сумма молча не поменялась — цена позиции осталась зафиксированной.
    expect(stale.totals.total.amountMinor).toBe(view.totals.total.amountMinor);

    // refresh пересчитывает на сервере и возвращает позицию в VALID.
    const refreshed = await cart.refreshItem(identity, stale.items[0].id);
    expect(refreshed.items[0].status).toBe('VALID');
    expect(refreshed.canCheckout).toBe(true);

    // Возврат прайса к v1 для остальных тестов не требуется — v2 идентичен.
    priceListId = v2.id;
  });

  it('позиция становится UNAVAILABLE, если услуга отключена', async () => {
    const identity = anon('session-unavailable');
    await cart.addItem(identity, await confirmFor(identity));
    await prisma.service.update({ where: { slug: SLUG }, data: { isActive: false } });
    try {
      const view = await cart.getCart(identity);
      expect(view.items[0].status).toBe('UNAVAILABLE');
      expect(view.canCheckout).toBe(false);
    } finally {
      await prisma.service.update({ where: { slug: SLUG }, data: { isActive: true } });
    }
  });

  it('merge: анонимная корзина вливается в пользовательскую и повторный merge идемпотентен', async () => {
    const sessionId = 'session-merge';
    const anonIdentity = anon(sessionId);
    await cart.addItem(anonIdentity, await confirmFor(anonIdentity));
    await cart.addItem(anonIdentity, await confirmFor(anonIdentity, 1000));
    const anonCart = await cart.getCart(anonIdentity);
    expect(anonCart.itemCount).toBe(2);

    const userIdentity: RequestIdentity = { userId, anonymousSessionId: sessionId };
    const merged = await cart.merge(userIdentity);
    expect(merged.itemCount).toBe(2);
    expect(merged.totals.total.amountMinor).toBe(anonCart.totals.total.amountMinor);

    // Повторный merge не создаёт дублей.
    const mergedAgain = await cart.merge(userIdentity);
    expect(mergedAgain.itemCount).toBe(2);
    expect(mergedAgain.id).toBe(merged.id);

    // Старая анонимная корзина помечена MERGED и отвязана от сессии:
    // тот же токен больше не даёт доступа к перенесённым позициям.
    const oldCart = await prisma.cart.findUniqueOrThrow({ where: { id: anonCart.id } });
    expect(oldCart.status).toBe('MERGED');
    expect(oldCart.anonymousSessionId).toBeNull();
    const freshAnon = await cart.getCart(anon(sessionId));
    expect(freshAnon.id).not.toBe(anonCart.id);
    expect(freshAnon.itemCount).toBe(0);
  });

  it('merge не теряет позиции, если у пользователя уже есть такой же расчёт', async () => {
    const sessionId = 'session-merge-clash';
    const anonIdentity = anon(sessionId);
    const userIdentity: RequestIdentity = { userId, anonymousSessionId: sessionId };

    // Один и тот же snapshot добавлен и анонимом, и пользователем.
    const shared = await calculator.confirmCalculation(
      SLUG,
      { parameters: { qty: 700 } },
      { userId, anonymousSessionId: sessionId },
    );
    await cart.addItem(anonIdentity, shared.snapshotId);
    const before = await cart.getCart(userIdentity);
    await cart.addItem(userIdentity, shared.snapshotId);

    const merged = await cart.merge(userIdentity);
    // Дубля нет: позиция ровно одна.
    const sharedItems = merged.items.filter((i) => i.calculationSnapshotId === shared.snapshotId);
    expect(sharedItems).toHaveLength(1);
    expect(merged.itemCount).toBeGreaterThanOrEqual(before.itemCount);
  });

  it('merge требует авторизации', async () => {
    await expect(cart.merge(anon('session-anon-merge'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('пользователь не видит корзину другого пользователя', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'other-cart-user@example.test', passwordHash: 'x' },
    });
    const first: RequestIdentity = { userId, anonymousSessionId: 'session-bac-1' };
    const second: RequestIdentity = { userId: otherUser.id, anonymousSessionId: 'session-bac-2' };

    const firstCart = await cart.getCart(first);
    const secondCart = await cart.getCart(second);
    expect(secondCart.id).not.toBe(firstCart.id);
    expect(secondCart.itemCount).toBe(0);
  });

  it('версия корзины растёт на каждой мутации', async () => {
    const identity = anon('session-version');
    const initial = await cart.getCart(identity);
    const afterAdd = await cart.addItem(identity, await confirmFor(identity));
    expect(afterAdd.cartVersion).toBeGreaterThan(initial.cartVersion);
    const afterClear = await cart.clear(identity);
    expect(afterClear.cartVersion).toBeGreaterThan(afterAdd.cartVersion);
  });
});
