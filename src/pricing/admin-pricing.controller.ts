import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';
import { AdminPricingService } from './admin-pricing.service';
import { ListDefinitionsDto, ListPriceListsDto, DryRunDto, ListAuditDto } from './dto/pricing-query.dto';
import { CreateDraftRuleDto, RevisionOnlyDto, UpdateDraftRuleDto } from './dto/draft-rule.dto';

/**
 * Admin Pricing API. Доступ — по permissions из БД (PermissionsGuard):
 * read/dry-run — pricing.read (MANAGER+), правки — pricing.draft.edit (ADMIN+),
 * публикация — pricing.publish (ADMIN+). Управляет только ценовой частью
 * определений; структура калькулятора read-only.
 */
@ApiTags('admin/pricing')
@ApiBearerAuth()
@Controller('admin/pricing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminPricingController {
  constructor(private readonly pricing: AdminPricingService) {}

  // --- Read ---

  @Get('definitions')
  @Permissions(PERMISSION_CODES.PRICING_READ)
  @ApiOperation({ summary: 'Список калькуляторов (definition) с версиями прайсов' })
  listDefinitions(@Query() query: ListDefinitionsDto) {
    return this.pricing.listDefinitions(query);
  }

  @Get('definitions/:definitionId')
  @Permissions(PERMISSION_CODES.PRICING_READ)
  @ApiOperation({ summary: 'Определение (read-only: параметры, опции, типы)' })
  @ApiResponse({ status: 404, description: 'Определение не найдено' })
  getDefinition(@Param('definitionId', ParseUUIDPipe) definitionId: string) {
    return this.pricing.getDefinition(definitionId);
  }

  @Get('definitions/:definitionId/price-lists')
  @Permissions(PERMISSION_CODES.PRICING_READ)
  @ApiOperation({ summary: 'История версий прайса определения (пагинация)' })
  listPriceLists(
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
    @Query() query: ListPriceListsDto,
  ) {
    return this.pricing.listPriceLists(definitionId, query);
  }

  @Get('price-lists/:priceListId')
  @Permissions(PERMISSION_CODES.PRICING_READ)
  @ApiOperation({ summary: 'Прайс-лист: правила + production-time rules (read-only)' })
  @ApiResponse({ status: 404, description: 'Прайс-лист не найден' })
  getPriceList(@Param('priceListId', ParseUUIDPipe) priceListId: string) {
    return this.pricing.getPriceList(priceListId);
  }

  @Get('audit')
  @Permissions(PERMISSION_CODES.PRICING_READ)
  @ApiOperation({ summary: 'История pricing-изменений (safe actor, без PII)' })
  listAudit(@Query() query: ListAuditDto) {
    return this.pricing.listAudit(query);
  }

  // --- Create / Clone ---

  @Post('definitions/:definitionId/price-lists')
  @HttpCode(201)
  @Permissions(PERMISSION_CODES.PRICING_DRAFT_EDIT)
  @ApiOperation({ summary: 'Создать новый пустой DRAFT-прайс для определения' })
  @ApiResponse({ status: 409, description: 'Уже есть DRAFT для этого определения' })
  createPriceList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
  ) {
    return this.pricing.createPriceList(definitionId, user.id);
  }

  @Post('price-lists/:priceListId/clone-draft')
  @HttpCode(201)
  @Permissions(PERMISSION_CODES.PRICING_DRAFT_EDIT)
  @ApiOperation({ summary: 'Клонировать ACTIVE/ARCHIVED в новый DRAFT' })
  @ApiResponse({ status: 409, description: 'Уже есть DRAFT / источник — DRAFT' })
  cloneDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priceListId', ParseUUIDPipe) priceListId: string,
  ) {
    return this.pricing.cloneDraft(priceListId, user.id);
  }

  // --- DRAFT rule CRUD ---

  @Post('price-lists/:priceListId/rules')
  @HttpCode(201)
  @Permissions(PERMISSION_CODES.PRICING_DRAFT_EDIT)
  @ApiOperation({ summary: 'Создать правило DRAFT' })
  @ApiResponse({ status: 409, description: 'Не DRAFT / stale revision' })
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priceListId', ParseUUIDPipe) priceListId: string,
    @Body() dto: CreateDraftRuleDto,
  ) {
    return this.pricing.createRule(priceListId, dto, user.id);
  }

  @Patch('price-lists/:priceListId/rules/:ruleId')
  @Permissions(PERMISSION_CODES.PRICING_DRAFT_EDIT)
  @ApiOperation({ summary: 'Изменить правило DRAFT' })
  @ApiResponse({ status: 409, description: 'Не DRAFT / stale revision / immutable' })
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priceListId', ParseUUIDPipe) priceListId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateDraftRuleDto,
  ) {
    return this.pricing.updateRule(priceListId, ruleId, dto, user.id);
  }

  @Delete('price-lists/:priceListId/rules/:ruleId')
  @Permissions(PERMISSION_CODES.PRICING_DRAFT_EDIT)
  @ApiOperation({ summary: 'Удалить правило DRAFT' })
  @ApiResponse({ status: 409, description: 'Не DRAFT / stale revision / immutable' })
  deleteRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priceListId', ParseUUIDPipe) priceListId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: RevisionOnlyDto,
  ) {
    return this.pricing.deleteRule(priceListId, ruleId, dto.expectedRevision, user.id);
  }

  // --- Validate / dry-run ---

  @Post('price-lists/:priceListId/validate')
  @HttpCode(200)
  @Permissions(PERMISSION_CODES.PRICING_READ)
  @ApiOperation({ summary: 'Валидировать DRAFT (structured issues, без сайд-эффектов)' })
  validate(@Param('priceListId', ParseUUIDPipe) priceListId: string) {
    return this.pricing.validateDraft(priceListId);
  }

  @Post('price-lists/:priceListId/dry-run')
  @HttpCode(200)
  @Permissions(PERMISSION_CODES.PRICING_READ)
  @ApiOperation({ summary: 'Dry-run расчёт по DRAFT (без snapshot/cart/order)' })
  dryRun(@Param('priceListId', ParseUUIDPipe) priceListId: string, @Body() dto: DryRunDto) {
    return this.pricing.dryRun(priceListId, dto);
  }

  // --- Publish ---

  @Post('price-lists/:priceListId/publish')
  @HttpCode(200)
  @Permissions(PERMISSION_CODES.PRICING_PUBLISH)
  @ApiOperation({ summary: 'Опубликовать DRAFT (архивирует предыдущий ACTIVE)' })
  @ApiResponse({ status: 409, description: 'stale revision / период пересекается' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priceListId', ParseUUIDPipe) priceListId: string,
    @Body() dto: RevisionOnlyDto,
  ) {
    return this.pricing.publishDraft(priceListId, dto.expectedRevision, user.id);
  }
}
