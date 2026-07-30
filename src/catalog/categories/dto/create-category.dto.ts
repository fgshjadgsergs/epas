import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CreateCategoryDto {
  @ApiPropertyOptional({ description: 'Id родительской категории' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ example: 'vizitki' })
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug может содержать только строчные латинские буквы, цифры и дефисы',
  })
  slug!: string;

  @ApiProperty({ example: 'Визитки' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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
