import { Module } from '@nestjs/common';
import { RolesModule } from '../../roles/roles.module';
import { FilesModule } from '../../files/files.module';
import { StorageModule } from '../../storage/storage.module';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { ServicesAdminController } from './services.admin.controller';
import { ServiceImagesAdminController } from './service-images.admin.controller';

@Module({
  imports: [RolesModule, FilesModule, StorageModule],
  controllers: [ServicesController, ServicesAdminController, ServiceImagesAdminController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
