import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ReconcileReportDto } from '@conduit/contracts';
import { ReconciliationService } from './reconciliation.service';
import { ReconcileQueryDto } from './dto/reconcile.query';
import { csvFilename, gapsToCsv } from './reconciliation.csv';

@Controller('reconcile')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get()
  report(@Query() query: ReconcileQueryDto): Promise<ReconcileReportDto> {
    return this.reconciliation.getReport(query);
  }

  /**
   * The exportable reconciliation report. Honours the same `from` / `to` / `status` filters
   * as the JSON report, so what you export is exactly what the dashboard is showing.
   *
   * Declared before no route conflict arises: `/reconcile/export.csv` is a distinct path
   * from `/reconcile`, so ordering is not load-bearing here.
   */
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query() query: ReconcileQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const report = await this.reconciliation.getReport(query);
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename(new Date())}"`);
    return gapsToCsv(report.gaps);
  }
}
