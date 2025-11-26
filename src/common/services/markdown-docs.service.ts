import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';

export type RenderMarkdownOptions = {
  title: string;
  markdownPath: string;
  footerNote?: string;
};

@Injectable()
export class MarkdownDocsService {
  /**
   * Renders a Markdown file as HTML using the documentation template
   * @param options Configuration options for rendering
   * @returns HTML string with styled documentation
   */
  async renderMarkdownAsHtml(options: RenderMarkdownOptions): Promise<string> {
    try {
      const markdownPath = join(process.cwd(), options.markdownPath);
      const markdownContent = readFileSync(markdownPath, 'utf-8');
      const htmlContent = await marked(markdownContent);

      return this.getDocumentationTemplate(
        options.title,
        htmlContent,
        options.footerNote,
      );
    } catch (error) {
      throw new Error(
        `Failed to render markdown documentation: ${error.message}`,
      );
    }
  }

  /**
   * Gets the HTML template for documentation pages
   * @param title Page title
   * @param content Rendered HTML content
   * @param footerNote Optional footer note
   * @returns Complete HTML document
   */
  private getDocumentationTemplate(
    title: string,
    content: string,
    footerNote?: string,
  ): string {
    const lastUpdated = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f7f7f5;
            --bg-tertiary: #f1f1ef;
            --text-primary: #37352f;
            --text-secondary: #787774;
            --text-tertiary: #9b9a97;
            --border-color: #e9e9e7;
            --accent-blue: #0b85ff;
            --accent-blue-hover: #0066cc;
            --code-bg: #f7f6f3;
            --code-border: #e9e9e7;
            --blockquote-bg: #f7f6f3;
            --blockquote-border: #e9e9e7;
            --table-header-bg: #f7f6f3;
            --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
            --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
            color: var(--text-primary);
            background: var(--bg-secondary);
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: var(--bg-primary);
            padding: 96px 48px;
            min-height: 100vh;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 48px 24px;
            }
        }
        
        h1 {
            font-size: 40px;
            font-weight: 700;
            line-height: 1.2;
            color: var(--text-primary);
            margin: 0 0 8px 0;
            padding: 0;
            letter-spacing: -0.02em;
        }
        
        h2 {
            font-size: 30px;
            font-weight: 600;
            line-height: 1.3;
            color: var(--text-primary);
            margin: 48px 0 4px 0;
            padding: 0;
            letter-spacing: -0.01em;
        }
        
        h3 {
            font-size: 24px;
            font-weight: 600;
            line-height: 1.4;
            color: var(--text-primary);
            margin: 32px 0 4px 0;
            padding: 0;
        }
        
        h4 {
            font-size: 20px;
            font-weight: 600;
            line-height: 1.4;
            color: var(--text-primary);
            margin: 24px 0 4px 0;
            padding: 0;
        }
        
        h5 {
            font-size: 18px;
            font-weight: 600;
            line-height: 1.4;
            color: var(--text-primary);
            margin: 20px 0 4px 0;
            padding: 0;
        }
        
        h6 {
            font-size: 16px;
            font-weight: 600;
            line-height: 1.4;
            color: var(--text-primary);
            margin: 16px 0 4px 0;
            padding: 0;
        }
        
        p {
            font-size: 16px;
            line-height: 1.7;
            color: var(--text-primary);
            margin: 0 0 16px 0;
            word-wrap: break-word;
        }
        
        p:last-child {
            margin-bottom: 0;
        }
        
        ul, ol {
            margin: 6px 0 16px 0;
            padding-left: 24px;
        }
        
        li {
            font-size: 16px;
            line-height: 1.7;
            color: var(--text-primary);
            margin: 4px 0;
            padding-left: 4px;
        }
        
        li > p {
            margin: 0;
        }
        
        ul ul, ol ol, ul ol, ol ul {
            margin: 4px 0;
        }
        
        code {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 14px;
            background: var(--code-bg);
            color: #eb5757;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid var(--code-border);
            font-weight: 500;
        }
        
        pre {
            background: var(--code-bg);
            border: 1px solid var(--code-border);
            border-radius: 6px;
            padding: 20px;
            overflow-x: auto;
            margin: 16px 0;
            font-size: 14px;
            line-height: 1.6;
        }
        
        pre code {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            background: none;
            color: var(--text-primary);
            padding: 0;
            border: none;
            font-weight: 400;
            white-space: pre;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
        }
        
        thead {
            background: var(--table-header-bg);
        }
        
        th {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        
        td {
            font-size: 14px;
            color: var(--text-primary);
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
        }
        
        tbody tr:last-child td {
            border-bottom: none;
        }
        
        tbody tr:hover {
            background: var(--bg-tertiary);
            transition: background-color 0.15s ease;
        }
        
        blockquote {
            background: var(--blockquote-bg);
            border-left: 3px solid var(--blockquote-border);
            padding: 16px 20px;
            margin: 16px 0;
            border-radius: 0 4px 4px 0;
            font-style: italic;
            color: var(--text-secondary);
        }
        
        blockquote p {
            margin: 0;
        }
        
        blockquote p:not(:last-child) {
            margin-bottom: 8px;
        }
        
        a {
            color: var(--accent-blue);
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: all 0.15s ease;
            font-weight: 500;
        }
        
        a:hover {
            color: var(--accent-blue-hover);
            border-bottom-color: var(--accent-blue-hover);
        }
        
        hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 32px 0;
        }
        
        img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 16px 0;
            box-shadow: var(--shadow-sm);
        }
        
        strong {
            font-weight: 600;
            color: var(--text-primary);
        }
        
        em {
            font-style: italic;
            color: var(--text-primary);
        }
        
        mark {
            background: #fffacd;
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        .footer {
            margin-top: 64px;
            padding-top: 24px;
            border-top: 1px solid var(--border-color);
            color: var(--text-tertiary);
            font-size: 14px;
        }
        
        .footer p {
            margin: 4px 0;
            font-size: 14px;
            color: var(--text-tertiary);
        }
        
        .footer strong {
            color: var(--text-secondary);
            font-weight: 500;
        }
        
        /* Selection styling */
        ::selection {
            background: rgba(11, 133, 255, 0.15);
            color: var(--text-primary);
        }
        
        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--bg-secondary);
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 5px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-tertiary);
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
        <div class="footer">
            <p><strong>Last Updated:</strong> ${lastUpdated}</p>
            ${footerNote ? `<p>${footerNote}</p>` : '<p>This documentation is rendered from Markdown and served dynamically.</p>'}
        </div>
    </div>
</body>
</html>`;
  }
}
