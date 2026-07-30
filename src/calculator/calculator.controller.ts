import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { RequestIdentityService } from '../identity/request-identity.service';
import { CalculatorService } from './calculator.service';
import { CalculateRequestDto } from './dto/calculate-request.dto';
import {
  CalculationErrorResponseDto,
  ConfirmCalculationDto,
  ConfirmCalculationResponseDto,
} from './dto/confirm-calculation.dto';

/**
 * Публичное API движка калькуляторов. Раздельные throttle-политики (блок 8 v2):
 * - GET definition — общий каталожный лимит (SSG-safe, app.module.ts);
 * - /calculate — интерактивный лимит 60/мин/IP (пересчёт при каждом изменении);
 * - /calculate/confirm — строже, 12/мин/IP: подтверждение — редкое явное
 *   действие «в корзину», каждое создаёт строку CalculationSnapshot.
 * User/session-ключи троттлинга — отдельная задача до Orders.
 */
@ApiTags('calculator')
@Controller('services')
export class CalculatorController {
  constructor(
    private readonly calculatorService: CalculatorService,
    private readonly identity: RequestIdentityService,
  ) {}

  @Get(':slug/calculator')
  @ApiOperation({ summary: 'Определение калькулятора услуги (параметры, варианты, правила)' })
  @ApiResponse({ status: 404, description: 'Калькулятор для услуги не настроен' })
  getDefinition(@Param('slug') slug: string) {
    return this.calculatorService.getDefinitionBySlug(slug);
  }

  @Post(':slug/calculate')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Preview-расчёт цены и срока (не создаёт snapshot; цену считает только backend)' })
  @ApiResponse({ status: 404, description: 'Калькулятор для услуги не настроен' })
  @ApiResponse({
    status: 422,
    description: 'Неверные параметры / услуга без активного прайса / повреждённая конфигурация',
    type: CalculationErrorResponseDto,
  })
  @ApiResponse({ status: 429, description: 'Превышен лимит запросов (60/мин/IP)' })
  calculate(@Param('slug') slug: string, @Body() dto: CalculateRequestDto) {
    return this.calculatorService.calculateBySlug(slug, dto);
  }

  @Post(':slug/calculate/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Подтвердить расчёт: пересчитывает на сервере (parameters + upsells) и создаёт неизменяемый CalculationSnapshot',
  })
  @ApiResponse({ status: 200, description: 'Расчёт подтверждён', type: ConfirmCalculationResponseDto })
  @ApiResponse({ status: 404, description: 'Калькулятор для услуги не настроен' })
  @ApiResponse({
    status: 422,
    description: 'Неверные параметры / услуга без активного прайса / повреждённая конфигурация',
    type: CalculationErrorResponseDto,
  })
  @ApiResponse({ status: 429, description: 'Превышен лимит подтверждений (12/мин/IP)' })
  confirm(
    @Param('slug') slug: string,
    @Body() dto: ConfirmCalculationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Snapshot стемпится владельцем (пользователь либо анонимная сессия) —
    // корзина потом принимает только «свой» расчёт.
    const identity = this.identity.resolve(req, res);
    return this.calculatorService.confirmCalculation(slug, dto, {
      userId: identity.userId,
      anonymousSessionId: identity.anonymousSessionId,
    });
  }
}
