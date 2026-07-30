import { CalculationInputDto } from './calculation-input.dto';

/**
 * Тело preview-запроса /calculate. Структура полностью совпадает с
 * ConfirmCalculationDto — оба наследуют CalculationInputDto, чтобы preview
 * и confirm никогда не разошлись по составу входа (блок 1).
 */
export class CalculateRequestDto extends CalculationInputDto {}
