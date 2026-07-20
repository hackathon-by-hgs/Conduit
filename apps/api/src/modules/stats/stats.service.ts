import { Injectable } from '@nestjs/common';
import type { StatsDto } from '@conduit/contracts';
import { StatsRepository } from './stats.repository';

@Injectable()
export class StatsService {
  constructor(private readonly repo: StatsRepository) {}

  get(): Promise<StatsDto> {
    return this.repo.counts();
  }
}
