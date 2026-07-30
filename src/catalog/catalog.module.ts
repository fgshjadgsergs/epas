import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [CategoriesModule, ServicesModule],
})
export class CatalogModule {}
