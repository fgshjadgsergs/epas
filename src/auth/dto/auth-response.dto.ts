import { ApiProperty } from '@nestjs/swagger';
import { IssuedSession } from '../auth.service';

/**
 * Ответ auth-эндпоинтов приложению. Refresh token сюда НЕ входит — он уходит
 * только в httpOnly-cookie и недоступен JS. access token короткоживущий и
 * хранится фронтендом лишь в памяти.
 */
export class SessionResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  user!: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    roles: string[];
    permissions: string[];
  };

  static fromSession(session: IssuedSession): SessionResponseDto {
    return { accessToken: session.accessToken, user: session.user };
  }
}
