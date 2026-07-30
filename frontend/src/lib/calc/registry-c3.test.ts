/**
 * C3: 6 размерных услуг привязаны к серверному калькулятору; poster-варианты
 * (чертежи/афиши) наследуют привязку; admin-редакторы — metric/tier.
 */
import { describe, expect, it } from 'vitest';
import { calcRegistry } from './registry';
import { pickPricingEditor } from '@/lib/admin/pricing-editor-kind';

const C3_ROUTES: Record<string, string> = {
  '/fotopechat/postery-i-plakaty/': 'postery-i-plakaty',
  '/fotopechat/pechat-na-holste/': 'pechat-na-holste',
  '/fotopechat/nakatka-na-penokarton/': 'nakatka-na-penokarton',
  '/shirokoformat/press-wall/': 'press-wall',
  '/shirokoformat/interyernaya-pechat/': 'interyernaya-pechat',
  '/shirokoformat/roll-up/': 'roll-up',
};

describe('C3 registry bindings', () => {
  it.each(Object.entries(C3_ROUTES))('%s → сервер %s', (route, slug) => {
    expect(calcRegistry[route]?.calculatorServiceSlug).toBe(slug);
  });

  it('варианты постеров (чертежи/афиши) наследуют привязку poster', () => {
    expect(calcRegistry['/pechat-dokumentov/chertezhi/']?.calculatorServiceSlug).toBe('postery-i-plakaty');
    expect(calcRegistry['/shirokoformat/afishi-postery/']?.calculatorServiceSlug).toBe('postery-i-plakaty');
  });

  it('AREA-услуги → metric-редактор; rollup → tier', () => {
    for (const code of ['poster-print', 'canvas-print', 'foam-board', 'presswall', 'interior-print']) {
      expect(pickPricingEditor(code)).toBe('metric');
    }
    expect(pickPricingEditor('rollup')).toBe('tier');
  });
});
