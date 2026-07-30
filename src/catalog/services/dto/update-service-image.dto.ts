import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Правка метаданных изображения услуги. Сам файл не меняется. */
export class UpdateServiceImageDto {
  @ApiPropertyOptional({ description: 'Alt-текст изображения' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  alt?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Сделать изображение основным' })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}
