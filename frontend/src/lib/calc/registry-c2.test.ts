/**
 * C2: 10 TIER-услуг привязаны к серверному калькулятору (calculatorServiceSlug),
 * а не-ТЗ услуги (фото-календари, планинги) — намеренно НЕ привязаны.
 */
import { describe, expect, it } from 'vitest';
import { calcRegistry } from './registry';
import { pickPricingEditor } from '@/lib/admin/pricing-editor-kind';

const C2_ROUTES: Record<string, string> = {
  '/buklety/': 'buklety',
  '/otkrytki/': 'otkrytki',
  '/sertifikaty/': 'sertifikaty',
  '/menyu/': 'menyu',
  '/naklejki/pechat/': 'pechat',
  '/naklejki/etiketki/': 'etiketki',
  '/kalendari/nastennye/': 'nastennye',
  '/kalendari/karmannye/': 'karmannye',
  '/kalendari/nastolnye/': 'nastolnye',
  '/birki-bejdzi-blanki/': 'birki-bejdzi-blanki',
};

describe('C2 registry bindings', () => {
  it.each(Object.entries(C2_ROUTES))('%s привязан к серверному калькулятору %s', (route, slug) => {
    expect(calcRegistry[route]?.calculatorServiceSlug).toBe(slug);
  });

  it('вариант-страницы наследуют серверную привязку родителя', () => {
    expect(calcRegistry['/naklejki/stikerpaki/']?.calculatorServiceSlug).toBe('pechat');
    expect(calcRegistry['/buklety/evroformat/']?.calculatorServiceSlug).toBe('buklety');
    expect(calcRegistry['/naklejki/birki-dlya-odezhdy/']?.calculatorServiceSlug).toBe('etiketki');
  });

  it('не-ТЗ услуги НЕ привязаны (TZ_ABSENT)', () => {
    expect(calcRegistry['/kalendari/foto/']?.calculatorServiceSlug).toBeUndefined();
    expect(calcRegistry['/kalendari/planingi/']?.calculatorServiceSlug).toBeUndefined();
  });

  it('все 10 C2-кодов используют tier-редактор в админ-прайсинге', () => {
    for (const code of ['booklets', 'postcards', 'certificates', 'menu', 'badges-blanks', 'stickers', 'labels', 'calendar-wall', 'calendar-desk', 'calendar-pocket']) {
      expect(pickPricingEditor(code)).toBe('tier');
    }
  });
});
