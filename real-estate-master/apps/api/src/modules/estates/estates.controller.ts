import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { EstatesService } from "./estates.service";

@Controller("api/v1/estates")
export class EstatesController {
  constructor(private readonly estatesService: EstatesService) {}

  @Get("main")
  getMain(@Query() query: Record<string, string | string[] | undefined>): Promise<Record<string, unknown>> {
    return this.estatesService.getMainPage(query);
  }

  @Get()
  getListing(@Query() query: Record<string, string | string[] | undefined>): Promise<Record<string, unknown>> {
    return this.estatesService.search(query);
  }

  @Get("suggestions")
  getSuggestions(@Query("q") query: string | undefined): Promise<Record<string, unknown>> {
    return this.estatesService.getSuggestions(query);
  }

  /* Витрина «Рекомендуем»: объекты с флагом «Приоритет», который брокеры
     переключают в CRM. Роут объявлен до :estateId — иначе Nest сматчит
     «recommended» как идентификатор. */
  @Get("recommended")
  getRecommended(): Promise<Record<string, unknown>> {
    return this.estatesService.getRecommended();
  }

  @Get(":estateId")
  getDetail(@Param("estateId", ParseIntPipe) estateId: number): Promise<Record<string, unknown>> {
    return this.estatesService.getDetailById(estateId);
  }
}
