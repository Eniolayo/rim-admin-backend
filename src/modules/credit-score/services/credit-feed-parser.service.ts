import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as fs from 'fs';
// CSV parsing - install: npm install csv-parse
let csvParse: any;
try {
  csvParse = require('csv-parse/sync').parse;
} catch {
  csvParse = null;
}
// XML parsing - install: npm install xml2js
let xmlParse: any;
try {
  xmlParse = require('xml2js').parseString;
} catch {
  xmlParse = null;
}
import { promisify } from 'util';

export interface CreditFeedRecord {
  phoneNumber: string;
  creditScore?: number;
  scoreUpdate?: number; // Delta to apply to existing score
  metadata?: Record<string, any>;
}

const parseXml = xmlParse ? promisify(xmlParse) : null;

@Injectable()
export class CreditFeedParserService {
  constructor(private readonly logger: Logger) {}

  /**
   * Parse CSV credit feed file
   */
  async parseCSV(filePath: string): Promise<CreditFeedRecord[]> {
    this.logger.log({ filePath }, 'Parsing CSV credit feed file');

    if (!csvParse) {
      throw new Error('csv-parse package is required. Install with: npm install csv-parse');
    }

    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');

      // Parse CSV with headers
      const records = csvParse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          // Auto-cast numeric values
          if (context.column === 'creditScore' || context.column === 'scoreUpdate') {
            return value ? parseFloat(value) : undefined;
          }
          return value;
        },
      });

      const creditFeedRecords: CreditFeedRecord[] = [];

      for (const record of records) {
        // Normalize phone number (ensure + prefix)
        let phoneNumber = record.phoneNumber || record.phone || record.phone_number;
        if (phoneNumber && !phoneNumber.startsWith('+')) {
          phoneNumber = `+${phoneNumber}`;
        }

        if (!phoneNumber) {
          this.logger.warn({ record }, 'Skipping record with missing phone number');
          continue;
        }

        const feedRecord: CreditFeedRecord = {
          phoneNumber,
          metadata: {},
        };

        // Handle credit score (absolute value)
        if (record.creditScore !== undefined && record.creditScore !== null) {
          feedRecord.creditScore = parseFloat(record.creditScore);
        }

        // Handle score update (delta)
        if (record.scoreUpdate !== undefined && record.scoreUpdate !== null) {
          feedRecord.scoreUpdate = parseFloat(record.scoreUpdate);
        }

        // Store other fields as metadata
        for (const [key, value] of Object.entries(record)) {
          if (
            !['phoneNumber', 'phone', 'phone_number', 'creditScore', 'scoreUpdate'].includes(
              key,
            )
          ) {
            feedRecord.metadata![key] = value;
          }
        }

        creditFeedRecords.push(feedRecord);
      }

      this.logger.log(
        { filePath, recordCount: creditFeedRecords.length },
        'CSV file parsed successfully',
      );

      return creditFeedRecords;
    } catch (error) {
      this.logger.error(
        {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error parsing CSV file',
      );
      throw error;
    }
  }

  /**
   * Parse XML credit feed file
   */
  async parseXML(filePath: string): Promise<CreditFeedRecord[]> {
    this.logger.log({ filePath }, 'Parsing XML credit feed file');

    if (!xmlParse) {
      throw new Error('xml2js package is required. Install with: npm install xml2js');
    }

    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');

      // Parse XML
      if (!parseXml) {
        throw new Error('xml2js package is required. Install with: npm install xml2js');
      }
      const parsedXml = await parseXml(fileContent);

      // Extract records from XML structure
      // This assumes XML structure like:
      // <creditFeed>
      //   <record>
      //     <phoneNumber>+2348012345678</phoneNumber>
      //     <creditScore>650</creditScore>
      //   </record>
      // </creditFeed>
      const creditFeedRecords: CreditFeedRecord[] = [];

      // Navigate XML structure (adjust based on actual XML format)
      const rootKey = Object.keys(parsedXml)[0];
      const root = parsedXml[rootKey];

      // Find records array (could be 'record', 'records', 'item', etc.)
      let records: any[] = [];
      if (root.record) {
        records = Array.isArray(root.record) ? root.record : [root.record];
      } else if (root.records) {
        records = Array.isArray(root.records) ? root.records : [root.records];
      } else if (root.item) {
        records = Array.isArray(root.item) ? root.item : [root.item];
      }

      for (const record of records) {
        // Extract phone number
        let phoneNumber =
          record.phoneNumber?.[0] ||
          record.phone?.[0] ||
          record.phone_number?.[0] ||
          record['phone-number']?.[0];

        if (!phoneNumber) {
          this.logger.warn({ record }, 'Skipping record with missing phone number');
          continue;
        }

        // Normalize phone number
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = `+${phoneNumber}`;
        }

        const feedRecord: CreditFeedRecord = {
          phoneNumber,
          metadata: {},
        };

        // Extract credit score
        if (record.creditScore?.[0]) {
          feedRecord.creditScore = parseFloat(record.creditScore[0]);
        }

        // Extract score update
        if (record.scoreUpdate?.[0]) {
          feedRecord.scoreUpdate = parseFloat(record.scoreUpdate[0]);
        }

        // Store other fields as metadata
        for (const [key, value] of Object.entries(record)) {
          if (
            !['phoneNumber', 'phone', 'phone_number', 'creditScore', 'scoreUpdate'].includes(
              key,
            )
          ) {
            feedRecord.metadata![key] = Array.isArray(value) ? value[0] : value;
          }
        }

        creditFeedRecords.push(feedRecord);
      }

      this.logger.log(
        { filePath, recordCount: creditFeedRecords.length },
        'XML file parsed successfully',
      );

      return creditFeedRecords;
    } catch (error) {
      this.logger.error(
        {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error parsing XML file',
      );
      throw error;
    }
  }

  /**
   * Parse file based on type
   */
  async parseFile(
    filePath: string,
    fileType: 'csv' | 'xml',
  ): Promise<CreditFeedRecord[]> {
    if (fileType === 'csv') {
      return await this.parseCSV(filePath);
    } else {
      return await this.parseXML(filePath);
    }
  }
}

