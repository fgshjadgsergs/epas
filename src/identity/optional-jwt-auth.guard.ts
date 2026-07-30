import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional-вариант JWT-гарда: пропускает запрос всегда, но заполняет
 * `req.user`, если предъявлен валидный Bearer-токен. Используется корзиной и
 * confirm — они доступны и анонимам, и авторизованным.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // Нет/битый токен — не ошибка: работаем как аноним.
    }
    return true;
  }

  // Не бросать при отсутствии пользователя — просто вернуть его (или undefined).
  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
