import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './json-ld';

describe('serializeJsonLd (XSS-safe)', () => {
  it('экранирует </script> из данных (нельзя закрыть тег раньше времени)', () => {
    const out = serializeJsonLd({ name: 'Визитки</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('\\u003c'); // < заэкранирован
  });

  it('экранирует <, >, & и разделители строк, но данные восстанавливаются', () => {
    const value = 'a<b>c&d';
    const out = serializeJsonLd({ value });
    expect(out).not.toMatch(/[<>&]/);
    expect(JSON.parse(out).value).toBe(value); // round-trip не искажает
  });

  it('U+2028/U+2029 экранируются', () => {
    const out = serializeJsonLd({ v: 'x' + String.fromCharCode(0x2028) + 'y' + String.fromCharCode(0x2029) });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });
});
