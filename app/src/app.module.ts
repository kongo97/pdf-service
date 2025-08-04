import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LayoutModule } from './layout/layout.module';

@Module({
  imports: [LayoutModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
