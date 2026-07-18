import { manageAttendanceSheetContent } from '../utils';
import GoogleApiClient from './google-api-client';

export class GoogleSheetsService {
  private api: GoogleApiClient;

  constructor(token: string) {
    const sheetsBaseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.api = new GoogleApiClient(sheetsBaseUrl, token);
  }

  async getSheetContent(spreadsheetId: string, sheetName: string) {
    const range = `${sheetName}!A1:Z1000`;
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
    const formulas = Array.from({ length: 200 }, (_, i) => [
      '',
      `=IF(SUM({Details!B${i + 2}:${i + 2}}) = 0; ""; SUM({Details!B${i + 2}:${i + 2}}))`,
      `=IF(COUNT({Details!B${i + 2}:${i + 2}}) = 0; ""; CONCATENATE(ROUND(B${
        i + 2
      }/COUNT({Details!B${i + 2}:${i + 2}})*100, 2); "%"))`,
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
