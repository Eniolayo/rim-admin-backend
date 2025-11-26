# Documentation Index

This directory contains all the project documentation for the RIM Admin backend, organized by category.

## 📁 Available Design Documents

### 🗄️ Schema & Architecture

- [RIM_schema.md](./RIM_schema.md) - Complete database schema (source of truth)
  - **View as HTML:** `/api/rim-schema.html`

### 🔐 Authentication & Security

- [api-key-authentication.md](./api-key-authentication.md) - API Key Authentication implementation
  - **View as HTML:** `/api/api-key-authentication.html`

### 🎫 Support System

- [SUPPORT_SYSTEM.md](./SUPPORT_SYSTEM.md) - Support ticket and chat system design
  - **View as HTML:** `/api/support-system.html`

### 💳 Credit Score

- [CREDIT_SCORE_MULTIPLIER_SYSTEM.md](./CREDIT_SCORE_MULTIPLIER_SYSTEM.md) - Credit score multiplier system
  - **View as HTML:** `/api/credit-score-multiplier.html`

### 📞 USSD & Loans

- [Ussd loan Callback.md](./Ussd loan Callback.md) - USSD loan callback implementation
  - **View as HTML:** `/api/ussd-loan-callback.html`

### 🔧 Implementation Guides

- [activity-log-processor.md](./activity-log-processor.md) - Activity log processor implementation
- [admin-invitations.md](./admin-invitations.md) - Admin invitation system
- [migration-support-agent-relationship.md](./migration-support-agent-relationship.md) - Support agent relationship migration
- [permissions-guard-implementation.md](./permissions-guard-implementation.md) - Permissions guard implementation

---

## 📖 Accessing Design Documents

Design documents can be accessed in two ways:

1. **As Markdown files** - Direct access to the `.md` files in this directory
2. **As HTML pages** - Rendered and styled HTML pages served by the API

### HTML Endpoints

All design documents are available as HTML pages at the following endpoints:

- `/api/rim-schema.html` - Database schema documentation
- `/api/api-key-authentication.html` - API Key authentication documentation
- `/api/support-system.html` - Support system documentation
- `/api/credit-score-multiplier.html` - Credit score multiplier documentation
- `/api/ussd-loan-callback.html` - USSD loan callback documentation

These endpoints are:
- ✅ Not throttled (documentation should always be accessible)
- ✅ Excluded from Swagger documentation
- ✅ Rendered with a beautiful, readable design
- ✅ Automatically updated when markdown files change

### Swagger Integration

Design documents are also linked from Swagger tags. When viewing the Swagger documentation at `/api/docs`, you'll see links to relevant design documents in the tag descriptions.

---

## 🚀 Adding New Design Documents

To add a new design document:

1. Create a new markdown file in this `docs/` directory
2. Add an endpoint in `src/app.controller.ts`:
   ```typescript
   @SkipThrottle()
   @Get('your-doc-name.html')
   @ApiExcludeEndpoint()
   async getYourDoc(@Res() res: Response): Promise<void> {
     try {
       const html = await this.markdownDocsService.renderMarkdownAsHtml({
         title: 'Your Document Title',
         markdownPath: 'docs/your-doc-name.md',
         footerNote: 'This documentation is rendered from Markdown and served dynamically.',
       });
       res.setHeader('Content-Type', 'text/html');
       res.send(html);
     } catch (error) {
       res.status(500).send(`<html><body><h1>Error loading documentation</h1><p>${error.message}</p></body></html>`);
     }
   }
   ```
3. Optionally add a Swagger tag link in `src/main.ts` if relevant to an API module

---

## 📝 Quick Links

**New to the project?** Start with:

1. [Database Schema](./RIM_schema.md) - Understand the data model
2. [API Key Authentication](./api-key-authentication.md) - Learn about authentication
3. [Support System](./SUPPORT_SYSTEM.md) - Understand the support features

**Working on features?** Check out:

- [Credit Score Multiplier System](./CREDIT_SCORE_MULTIPLIER_SYSTEM.md)
- [USSD Loan Callback](./Ussd loan Callback.md)
- [Permissions Guard Implementation](./permissions-guard-implementation.md)
