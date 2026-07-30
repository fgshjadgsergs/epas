import { ConfigService } from '@nestjs/config';
import { AnonymousSessionService } from './anonymous-session.service';

function makeService(secret = 'test-jwt-access-secret-at-least-32-chars-long'): AnonymousSessionService {
  const config = { get: () => secret } as unknown as ConfigService<never, true>;
  return new AnonymousSessionService(config);
}

describe('AnonymousSessionService', () => {
  const service = makeService();

  it('подписанный токен проходит проверку и возвращает тот же sessionId', () => {
    const sessionId = service.createSessionId();
    expect(service.verify(service.sign(sessionId))).toBe(sessionId);
  });

  it('подделка sessionId без ключа отвергается', () => {
    const token = service.sign(service.createSessionId());
    const [, mac] = token.split('.');
    const forged = `${service.createSessionId()}.${mac}`;
    expect(service.verify(forged)).toBeNull();
  });

  it('изменение подписи отвергается', () => {
    const token = service.sign(service.createSessionId());
    expect(service.verify(`${token}x`)).toBeNull();
  });

  it('токен, подписанный другим секретом, не принимается', () => {
    const other = makeService('another-jwt-secret-value-at-least-32-chars');
    const foreign = other.sign(other.createSessionId());
    expect(service.verify(foreign)).toBeNull();
  });

  it('мусор и пустые значения отвергаются', () => {
    for (const value of [undefined, null, '', 'no-dot', '.', 'not-a-uuid.abc']) {
      expect(service.verify(value as string)).toBeNull();
    }
  });

  it('sessionId должен быть UUID — произвольная строка не принимается', () => {
    // Даже с валидной подписью для «своей» строки формат ограничен UUID.
    expect(service.verify('../../etc/passwd.abc')).toBeNull();
  });
});
