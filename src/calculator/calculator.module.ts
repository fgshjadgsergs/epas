import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CalculatorController } from './calculator.controller';
import { CalculatorService } from './calculator.service';
import { PublishService } from './publish.service';

@Module({
  imports: [IdentityModule],
  controllers: [CalculatorController],
  providers: [CalculatorService, PublishService],
  exports: [CalculatorService, PublishService],
})
export class CalculatorModule {}
