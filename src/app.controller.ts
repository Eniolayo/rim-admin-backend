import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppService } from './app.service';
import { MarkdownDocsService } from './common/services/markdown-docs.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly markdownDocsService: MarkdownDocsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiExcludeEndpoint()
  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('docs/README.md')
  @ApiExcludeEndpoint()
  async getReadme(@Res() res: Response): Promise<void> {
    const html = await this.markdownDocsService.renderMarkdownAsHtml({
      markdownPath: 'docs/README.md',
      title: 'RIM API Documentation',
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('admin-api-key-design.html')
  @ApiExcludeEndpoint()
  async getAdminApiKeyDesign(@Res() res: Response): Promise<void> {
    const html = await this.markdownDocsService.renderMarkdownAsHtml({
      markdownPath: 'docs/admin-api-key-design.md',
      title: 'Admin API Key Design - Documentation',
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('ussd-loans-design.html')
  @ApiExcludeEndpoint()
  async getUssdLoansDesign(@Res() res: Response): Promise<void> {
    const html = await this.markdownDocsService.renderMarkdownAsHtml({
      markdownPath: 'docs/ussd-loans-design.md',
      title: 'USSD Loans Design - Documentation',
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('ussd-loan-callback.html')
  @ApiExcludeEndpoint()
  async getUssdLoanCallback(@Res() res: Response): Promise<void> {
    const html = await this.markdownDocsService.renderMarkdownAsHtml({
      markdownPath: 'docs/Ussd loan Callback.md',
      title: 'USSD Loan Callback - Design Documentation',
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('tls-configuration.html')
  @ApiExcludeEndpoint()
  async getTlsConfiguration(@Res() res: Response): Promise<void> {
    const html = await this.markdownDocsService.renderMarkdownAsHtml({
      markdownPath: 'docs/TLS_1.3_CONFIGURATION.md',
      title: 'TLS 1.3 Configuration Guide',
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
