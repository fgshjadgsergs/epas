import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Min, MaxLength } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ description: 'Id категории, к которой относится услуга' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'vizitki-standartnye' })
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug может содержать только строчные латинские буквы, цифры и дефисы',
  })
  slug!: string;

  @ApiProperty({ example: 'Стандартные визитки' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Цена "от", руб.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceFrom?: number;

  @ApiPropertyOptional({ description: 'Минимальный срок изготовления, дней' })
  @IsOptional()
  @IsInt()
  @Min(0)
  productionTimeFrom?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
