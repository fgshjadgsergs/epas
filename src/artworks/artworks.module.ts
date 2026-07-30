import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { ArtworkController } from './artwork.controller';
import { ArtworkService } from './artwork.service';
import { AdminArtworkController } from './admin-artwork.controller';
import { AdminArtworkService } from './admin-artwork.service';

/**
 * Макеты заказа. StorageModule — presigned download/preview; RolesModule — для
 * PermissionsGuard admin-эндпоинтов; AuditModule — общий AuditLogService.
 */
@Module({
  imports: [RolesModule, StorageModule, AuditModule],
  controllers: [ArtworkController, AdminArtworkController],
  providers: [ArtworkService, AdminArtworkService],
  exports: [ArtworkService, AdminArtworkService],
})
export class ArtworksModule {}
