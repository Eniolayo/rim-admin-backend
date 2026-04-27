import { Module } from '@nestjs/common';
import { TeamweeAdapter } from './teamwee.adapter';

@Module({
  providers: [TeamweeAdapter],
  exports: [TeamweeAdapter],
})
export class TeamweeModule {}
