import { ApiProperty } from '@nestjs/swagger';
import { CalculationInputDto } from './calculation-input.dto';

/**
 * Тело запроса «подтвердить расчёт» — создаёт CalculationSnapshot.
 * ТОТ ЖЕ вход, что у /calculate (общий CalculationInputDto): параметры И
 * upsells пересчитываются заново на сервере — клиентский calculationVersion/
 * hash/сумма не являются доверенным входом.
 */
export class ConfirmCalculationDto extends CalculationInputDto {}

class MoneyDto {
  @ApiProperty({ description: 'Сумма в копейках (целое)', example: 178200 })
  amountMinor!: number;

  @ApiProperty({ example: 'RUB' })
  currency!: string;
}

/** Ответ /calculate/confirm — подтверждённая цена и id неизменяемого snapshot. */
export class ConfirmCalculationResponseDto {
  @ApiProperty({ description: 'Id созданного CalculationSnapshot', format: 'uuid' })
  snapshotId!: string;

  @ApiProperty({ type: MoneyDto, description: 'Итоговая подтверждённая цена' })
  price!: MoneyDto;

  @ApiProperty({
    description: 'Версия расчёта «код:vВерсияОпределения:pВерсияПрайса»',
    example: 'business-cards:v3:p1',
  })
  calculationVersion!: string;

  @ApiProperty({ description: 'Нормализованные параметры, зафиксированные в snapshot' })
  normalizedParameters!: Record<string, unknown>;

  @ApiProperty({ description: 'Применённые upsell-коды, зафиксированные в snapshot', type: [String] })
  upsells!: string[];
}

/** Формат ошибки калькулятора (422): общая причина + пополевые ошибки. */
export class CalculationErrorResponseDto {
  @ApiProperty({ example: 'Неверные параметры расчёта' })
  message!: string;

  @ApiProperty({
    description: 'Пополевые ошибки',
    example: [{ param: 'qty', message: 'Минимальный тираж — 100 шт.' }],
  })
  errors!: { param: string; message: string }[];
}
