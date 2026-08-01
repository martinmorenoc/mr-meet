import { manageAttendanceSheetContent } from '../utils';
import GoogleApiClient from './google-api-client';

// Roomy enough for the 250 participants a single page of the Meet API returns.
const SUMMARY_ROWS = 500;

export class GoogleSheetsService {
  private api: GoogleApiClient;

  constructor(token: string) {
    const sheetsBaseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.api = new GoogleApiClient(sheetsBaseUrl, token);
  }

  // Pinning the locale is what makes the comma-separated formulas below correct.
  // USER_ENTERED parses a formula the way the Sheets UI would, and the argument
  // separator flips between comma and semicolon depending on this setting.
  async setSpreadsheetLocale(spreadsheetId: string) {
    try {
      await this.api.request(`/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: {
          requests: [
            {
              updateSpreadsheetProperties: {
                properties: { locale: 'en_US' },
                fields: 'locale',
              },
            },
          ],
        },
      });
    } catch (error) {
      throw new Error(`Failed to set spreadsheet locale: ${(error as Error).message}`);
    }
  }

  async getSheetContent(spreadsheetId: string, sheetName: string) {
    // Bounding the range would silently drop columns once a class has met more
    // times than the bound allows, and the next write would overwrite them.
    const range = sheetName;
    try {
      const response = await this.api.request<{ values?: string[][] }>(
        `/${spreadsheetId}/values/${range}`,
      );
      return response.values;
    } catch (error) {
      throw new Error(`Failed to get sheet content: ${(error as Error).message}`);
    }
  }

  async addSheet(sheetName: string, spreadsheetId: string) {
    try {
      const data = {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
                index: 0,
              },
            },
          },
        ],
      };
      await this.api.request(`/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: data,
      });
    } catch (error) {
      throw new Error(`Failed to add sheet: ${(error as Error).message}`);
    }
  }

  async addSummaryFormulasToSheet(spreadsheetId: string) {
    const values = [["={'Details'!A:A}", 'Total Attendance', 'Attendance Percentage']];
    const formulas = Array.from({ length: SUMMARY_ROWS }, (_, i) => [
      '',
      `=IF(SUM({Details!B${i + 2}:${i + 2}}) = 0, "", SUM({Details!B${i + 2}:${i + 2}}))`,
      `=IF(COUNT({Details!B${i + 2}:${i + 2}}) = 0, "", CONCATENATE(ROUND(B${
        i + 2
      }/COUNT({Details!B${i + 2}:${i + 2}})*100, 2), "%"))`,
    ]);
    values.push(...formulas);
    const range = 'Summary!A1';
    try {
      return await this.api.request(`/${spreadsheetId}/values/${range}`, {
        method: 'PUT',
        params: {
          valueInputOption: 'USER_ENTERED',
        },
        body: { values },
      });
    } catch (error) {
      throw new Error(`Failed to add summary formulas: ${(error as Error).message}`);
    }
  }

  async addAttendanceDetailToSheet(
    names: string[],
    spreadsheetId: string,
    content: string[][] | undefined,
  ) {
    const newContent = manageAttendanceSheetContent(content, names);
    const range = 'Details!A1';
    try {
      return await this.api.request(`/${spreadsheetId}/values/${range}`, {
        method: 'PUT',
        params: {
          valueInputOption: 'USER_ENTERED',
        },
        body: { values: newContent },
      });
    } catch (error) {
      throw new Error(`Failed to add attendance detail: ${(error as Error).message}`);
    }
  }
}

export default GoogleSheetsService;
