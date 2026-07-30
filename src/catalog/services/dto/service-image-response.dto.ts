import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceImageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  alt?: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  isMain!: boolean;

  @ApiPropertyOptional()
  url?: string | null;
}

interface RawServiceImage {
  id: string;
  alt: string | null;
  sortOrder: number;
  isMain: boolean;
  file: { publicUrl: string | null };
}

/**
 * Strips internal UploadedFile fields (bucket, storageKey, ownerId,
 * entityType, entityId, visibility) before catalog responses leave the API —
 * the public catalog must never expose storage internals.
 */
export function mapServiceImage(image: RawServiceImage): ServiceImageResponseDto {
  return {
    id: image.id,
    alt: image.alt,
    sortOrder: image.sortOrder,
    isMain: image.isMain,
    url: image.file.publicUrl ?? null,
  };
}
