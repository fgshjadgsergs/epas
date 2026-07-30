import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({ description: 'Тип сущности, к которой будет привязан файл (например, service)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @ApiPropertyOptional({ description: 'Id сущности, к которой будет привязан файл' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityId?: string;
}
