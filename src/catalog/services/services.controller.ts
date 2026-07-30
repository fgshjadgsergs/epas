import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OffsetPaginationQueryDto } from '../../common/dto/offset-pagination.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Список активных услуг' })
  findAll(@Query() query: OffsetPaginationQueryDto) {
    return this.servicesService.findAllPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Услуга по slug' })
  findOne(@Param('slug') slug: string) {
    return this.servicesService.findBySlugPublic(slug);
  }
}
