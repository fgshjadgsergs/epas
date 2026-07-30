/**
 * Integration-тесты триггеров неизменяемости опубликованного aggregate на
 * живом PostgreSQL: прямые Prisma update/delete, мимо сервисного слоя.
 */
import { PrismaClient } from '@prisma/client';
import { createDisposableDb, migrateDeploy, type DisposableDb } from './testing/integration-db';

jest.setTimeout(180000);

describe('DB-триггеры неизменяемости (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let defId: string;
  let priceListId: string;
  let ruleId: string;
  let parameterId: string;
  let optionId: string;

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_imm');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });

    const def = await prisma.calculatorDefinition.create({
      data: {
        code: 'it-cards',
        title: 'Черновик',
        version: 1,
        status: 'DRAFT',
        urlOrder: ['subtype', 'qty'],
        minQty: 50,
        maxQty: 10000,
        qtyStep: 50,
        defaultQty: 100,
        parameters: {
          create: [
            {
              urlKey: 'subtype',
              label: 'Тип',
              type: 'SEGMENTED',
              options: { create: [{ value: 'standard', label: 'Стандарт', isDefault: true }] },
            },
          ],
        },
        productionRules: { create: [{ workingDays: 2, cutoff: '14:00', priority: 0 }] },
        upsells: { create: [{ code: 'case', label: 'Кейс', pricing: 'FLAT', amountMinor: 15000 }] },
        priceLists: {
          create: [
            {
              version: 1,
              status: 'DRAFT',
              rules: { create: [{ kind: 'BASE_TIER', qtyFrom: 50, amountMinor: 1000, sortOrder: 0 }] },
            },
          ],
        },
      },
      include: {
        parameters: { include: { options: true } },
        priceLists: { include: { rules: true } },
      },
    });
    defId = def.id;
    parameterId = def.parameters[0].id;
    optionId = def.parameters[0].options[0].id;
    priceListId = def.priceLists[0].id;
    ruleId = def.priceLists[0].rules[0].id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  it('DRAFT: родитель и дети редактируются и удаляются свободно', async () => {
    await prisma.calculatorDefinition.update({ where: { id: defId }, data: { title: 'Черновик v2' } });
    await prisma.priceRule.update({ where: { id: ruleId }, data: { amountMinor: 1200 } });
    const extra = await prisma.priceRule.create({
      data: { priceListId, kind: 'MULTIPLIER', condition: { subtype: 'standard' }, multiplier: 1.1, sortOrder: 5 },
    });
    await prisma.priceRule.delete({ where: { id: extra.id } });
    const throwaway = await prisma.calculatorDefinition.create({
      data: { code: 'it-throwaway', title: 'x', version: 1, status: 'DRAFT', urlOrder: [] },
    });
    await prisma.calculatorDefinition.delete({ where: { id: throwaway.id } });
  });

  it('DRAFT -> ACTIVE (публикация) разрешён', async () => {
    await prisma.calculatorDefinition.update({
      where: { id: defId },
      data: { status: 'ACTIVE', publishedAt: new Date() },
    });
    await prisma.priceList.update({
      where: { id: priceListId },
      data: { status: 'ACTIVE', publishedAt: new Date() },
    });
  });

  it('ACTIVE: update родителя запрещён на уровне БД', async () => {
    await expect(
      prisma.calculatorDefinition.update({ where: { id: defId }, data: { title: 'Взлом' } }),
    ).rejects.toThrow(/immutable/);
    await expect(
      prisma.priceList.update({ where: { id: priceListId }, data: { comment: 'Взлом' } }),
    ).rejects.toThrow(/immutable/);
  });

  it('ACTIVE: update/delete/insert дочерних записей запрещены', async () => {
    // Прямой Prisma update правила активного прайса — ошибка БД.
    await expect(prisma.priceRule.update({ where: { id: ruleId }, data: { amountMinor: 1 } })).rejects.toThrow(
      /immutable/,
    );
    await expect(prisma.priceRule.delete({ where: { id: ruleId } })).rejects.toThrow(/immutable/);
    await expect(
      prisma.priceRule.create({ data: { priceListId, kind: 'SURCHARGE_FLAT', amountMinor: 100000, sortOrder: 9 } }),
    ).rejects.toThrow(/immutable/);

    await expect(
      prisma.calculatorParameter.update({ where: { id: parameterId }, data: { label: 'Взлом' } }),
    ).rejects.toThrow(/immutable/);
    await expect(prisma.calculatorOption.update({ where: { id: optionId }, data: { label: 'Взлом' } })).rejects.toThrow(
      /immutable/,
    );
    await expect(prisma.calculatorOption.delete({ where: { id: optionId } })).rejects.toThrow(/immutable/);
    await expect(
      prisma.calculatorParameter.create({
        data: { definitionId: defId, urlKey: 'hacked', label: 'x', type: 'TOGGLE' },
      }),
    ).rejects.toThrow(/immutable/);
    await expect(
      prisma.calculatorUpsell.create({
        data: { definitionId: defId, code: 'hacked', label: 'x', pricing: 'FLAT', amountMinor: 1 },
      }),
    ).rejects.toThrow(/immutable/);
  });

  it('ACTIVE: удаление родителя запрещено', async () => {
    await expect(prisma.priceList.delete({ where: { id: priceListId } })).rejects.toThrow(/immutable/);
    await expect(prisma.calculatorDefinition.delete({ where: { id: defId } })).rejects.toThrow(/immutable/);
  });

  it('snapshot ссылается на версии через RESTRICT: удаление прайса с snapshot невозможно', async () => {
    // DRAFT-прайс с искусственным snapshot: триггер удаление разрешает
    // (черновик), но FK RESTRICT из calculation_snapshots блокирует.
    const draftList = await prisma.priceList.create({
      data: { definitionId: defId, version: 99, status: 'DRAFT' },
    });
    const snapshot = await prisma.calculationSnapshot.create({
      data: {
        definitionId: defId,
        priceListId: draftList.id,
        definitionVersion: 1,
        priceListVersion: 99,
        engineVersion: 'engine/2',
        serviceSlug: 'it-cards',
        parameters: { subtype: 'standard', qty: 100 },
        upsells: [],
        appliedRules: [],
        appliedUpsells: [],
        totalMinor: 100000,
        unitMinor: 1000,
        vatMinor: 20000,
        workingDays: 2,
      },
    });
    await expect(prisma.priceList.delete({ where: { id: draftList.id } })).rejects.toThrow();
    await prisma.calculationSnapshot.delete({ where: { id: snapshot.id } });
    await prisma.priceList.delete({ where: { id: draftList.id } });
  });

  it('переход ACTIVE -> ARCHIVED разрешён, но только смена статуса', async () => {
    // Смена статуса вместе с другим полем — запрещена.
    await expect(
      prisma.priceList.update({ where: { id: priceListId }, data: { status: 'ARCHIVED', comment: 'x' } }),
    ).rejects.toThrow(/immutable/);
    // Чистый переход — разрешён.
    await prisma.priceList.update({ where: { id: priceListId }, data: { status: 'ARCHIVED' } });
    await prisma.calculatorDefinition.update({ where: { id: defId }, data: { status: 'ARCHIVED' } });
  });

  it('ARCHIVED: update и delete запрещены навсегда', async () => {
    await expect(
      prisma.calculatorDefinition.update({ where: { id: defId }, data: { title: 'x' } }),
    ).rejects.toThrow(/immutable/);
    await expect(
      prisma.priceList.update({ where: { id: priceListId }, data: { status: 'ACTIVE' } }),
    ).rejects.toThrow(/immutable/);
    await expect(prisma.priceList.delete({ where: { id: priceListId } })).rejects.toThrow(/immutable/);
    await expect(prisma.priceRule.update({ where: { id: ruleId }, data: { amountMinor: 1 } })).rejects.toThrow(
      /immutable/,
    );
  });
});
