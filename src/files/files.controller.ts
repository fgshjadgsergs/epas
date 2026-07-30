import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileResponseDto } from './dto/file-response.dto';

const HARD_UPLOAD_SIZE_LIMIT_BYTES = 20 * 1024 * 1024;
// TODO: this hard ceiling + memoryStorage() buffers the whole upload in
// process memory. For larger client artwork uploads, move to a streaming
// upload (e.g. multer S3 stream or busboy piping straight to S3) instead of
// raising this limit. Reverse proxy / ingress must also enforce a body-size
// limit, since this only protects the Node process.

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  // Ресурсоёмкая операция (буферизация + запись в S3): свой лимит поверх
  // глобального catalog-friendly throttler (F-2). Семантика — per-IP.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Загрузка файла в storage (MinIO/S3)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: HARD_UPLOAD_SIZE_LIMIT_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FileResponseDto> {
    const created = await this.filesService.uploadFile(file, dto, user);
    return FileResponseDto.fromEntity(created);
  }

  @Get('my')
  @ApiOperation({ summary: 'Мои PRIVATE-файлы (для повторного использования макета)' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.filesService.listMyFiles(user, page ?? 1, Math.min(pageSize ?? 20, 100));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Метаданные файла' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FileResponseDto> {
    const file = await this.filesService.findById(id, user);
    return FileResponseDto.fromEntity(file);
  }

  @Get(':id/presigned-url')
  // Presign создаёт короткоживущую ссылку на S3 — умеренный лимит (F-2).
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Получить временную presigned-ссылку на файл' })
  getPresignedUrl(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.getPresignedUrl(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить файл' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.filesService.deleteFile(id, user);
  }
}
