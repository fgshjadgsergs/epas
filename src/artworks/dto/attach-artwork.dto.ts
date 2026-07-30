import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Привязка загруженного PRIVATE-файла к позиции заказа. Клиент передаёт ТОЛЬКО
 * fileId и комментарий — storage key/bucket/path не принимаются.
 */
export class AttachArtworkDto {
  @ApiProperty({ format: 'uuid', description: 'id ранее загруженного PRIVATE-файла клиента' })
  @IsUUID()
  fileId!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  customerComment?: string;
}
