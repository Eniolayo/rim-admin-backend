import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppService } from './app.service';
import { MarkdownDocsService } from './common/services/markdown-docs.service';
import { Public } from './modules/auth/decorators/public.decorator';

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

  @Public()
  @SkipThrottle() // Documentation should not be throttled
  @Get('rim-schema.html')
  @ApiExcludeEndpoint()
  async getRimSchema(@Res() res: Response): Promise<void> {
    try {
      const html = await this.markdownDocsService.renderMarkdownAsHtml({
        title: 'RIM Admin Backend Schema - Complete Entity Definition',
        markdownPath: 'docs/RIM_schema.md',
        footerNote:
          'This documentation is rendered from Markdown and served dynamically.',
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Error loading documentation</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }

  @Public()
  @SkipThrottle() // Documentation should not be throttled
  @Get('api-key-authentication.html')
  @ApiExcludeEndpoint()
  async getApiKeyAuthentication(@Res() res: Response): Promise<void> {
    try {
      const html = await this.markdownDocsService.renderMarkdownAsHtml({
        title: 'API Key Authentication - Design Documentation',
        markdownPath: 'docs/api-key-authentication.md',
        footerNote:
          'This documentation is rendered from Markdown and served dynamically.',
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Error loading documentation</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }

  @Public()
  @SkipThrottle() // Documentation should not be throttled
  @Get('support-system.html')
  @ApiExcludeEndpoint()
  async getSupportSystem(@Res() res: Response): Promise<void> {
    try {
      const html = await this.markdownDocsService.renderMarkdownAsHtml({
        title: 'Support System - Design Documentation',
        markdownPath: 'docs/SUPPORT_SYSTEM.md',
        footerNote:
          'This documentation is rendered from Markdown and served dynamically.',
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Error loading documentation</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }

  @Public()
  @SkipThrottle() // Documentation should not be throttled
  @Get('credit-score-multiplier.html')
  @ApiExcludeEndpoint()
  async getCreditScoreMultiplier(@Res() res: Response): Promise<void> {
    try {
      const html = await this.markdownDocsService.renderMarkdownAsHtml({
        title: 'Credit Score Multiplier System - Design Documentation',
        markdownPath: 'docs/CREDIT_SCORE_MULTIPLIER_SYSTEM.md',
        footerNote:
          'This documentation is rendered from Markdown and served dynamically.',
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Error loading documentation</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }

  @Public()
  @SkipThrottle() // Documentation should not be throttled
  @Get('ussd-loan-callback.html')
  @ApiExcludeEndpoint()
  async getUssdLoanCallback(@Res() res: Response): Promise<void> {
    try {
      const html = await this.markdownDocsService.renderMarkdownAsHtml({
        title: 'USSD Loan Callback - Design Documentation',
        markdownPath: 'docs/Ussd loan Callback.md',
        footerNote:
          'This documentation is rendered from Markdown and served dynamically.',
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Error loading documentation</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }

  @Public()
  @SkipThrottle() // Documentation should not be throttled
  @Get('ussd-loans-design.html')
  @ApiExcludeEndpoint()
  async getUssdLoansDesign(@Res() res: Response): Promise<void> {
    try {
      const html = await this.markdownDocsService.renderMarkdownAsHtml({
        title: 'USSD Loans API - Design Decisions & Long-Term Strategy',
        markdownPath: 'docs/ussd-loans-design.md',
        footerNote:
          'This documentation is rendered from Markdown and served dynamically.',
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Error loading documentation</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }

  @Public()
  @SkipThrottle() // Documentation should not be throttled
  @Get('admin-api-key-design.html')
  @ApiExcludeEndpoint()
  async getAdminApiKeyDesign(@Res() res: Response): Promise<void> {
    try {
      const html = await this.markdownDocsService.renderMarkdownAsHtml({
        title: 'Admin API Key Management - Design Decisions & Long-Term Strategy',
        markdownPath: 'docs/admin-api-key-design.md',
        footerNote:
          'This documentation is rendered from Markdown and served dynamically.',
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <html>
          <body>
            <h1>Error loading documentation</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }
}
