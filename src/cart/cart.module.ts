import { Module } from '@nestjs/common';
import { CalculatorModule } from '../calculator/calculator.module';
import { IdentityModule } from '../identity/identity.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

/** Серверная корзина поверх подтверждённых расчётов (CalculationSnapshot). */
@Module({
  imports: [IdentityModule, CalculatorModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
