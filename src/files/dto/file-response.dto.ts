import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus, FileVisibility, UploadedFile } from '@prisma/client';

export class FileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;

  @ApiPropertyOptional()
  publicUrl?: string | null;

  @ApiProperty({ enum: FileVisibility })
  visibility!: FileVisibility;

  @ApiProperty({ enum: FileStatus })
  status!: FileStatus;

  @ApiProperty()
  createdAt!: Date;

  /**
   * Strips internal/storage fields (bucket, storageKey, ownerId,
   * entityType, entityId) before the record leaves the API.
   */
  static fromEntity(file: UploadedFile): FileResponseDto {
    const dto = new FileResponseDto();
    dto.id = file.id;
    dto.originalName = file.originalName;
    dto.mimeType = file.mimeType;
    dto.size = file.size;
    dto.publicUrl = file.publicUrl;
    dto.visibility = file.visibility;
    dto.status = file.status;
    dto.createdAt = file.createdAt;
    return dto;
  }
}
