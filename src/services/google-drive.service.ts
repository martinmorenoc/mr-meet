import { sortDictionaryByValue } from '../utils';
import GoogleApiClient from './google-api-client';

interface File {
  id: string;
  kind: string;
  mimeType: string;
  name: string;
}
interface getFileByNameResponse {
  files: File[];
}

const escapeDriveQueryValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export class GoogleDriveService {
  private api: GoogleApiClient;

  constructor(token: string) {
    const driveBaseUrl = 'https://www.googleapis.com/drive/v3/files';
    this.api = new GoogleApiClient(driveBaseUrl, token);
  }

  async createFolder(folderName: string): Promise<File> {
    try {
      return await this.api.request<File>('', {
        method: 'POST',
        body: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
      });
    } catch (error) {
      throw new Error(`Failed to create folder: ${(error as Error).message}`);
    }
  }

  async getFileByName(fileName: string, type: 'folder' | 'spreadsheet'): Promise<File | null> {
    try {
      const data = await this.api.request<getFileByNameResponse>('', {
        params: {
          q: `name='${escapeDriveQueryValue(
            fileName,
          )}' and mimeType='application/vnd.google-apps.${type}'`,
        },
      });

      return data.files[0] || null;
    } catch (error) {
      throw new Error(`Failed to get file: ${(error as Error).message}`);
    }
  }

  async getFolderFileNames(
    folderId: string,
    type: 'folder' | 'spreadsheet',
  ): Promise<{ [id: string]: string }> {
    try {
      const data = await this.api.request<{ files: File[] }>('', {
        params: {
          q: `mimeType='application/vnd.google-apps.${type}' and parents in '${folderId}'`,
        },
      });
      const fileNames: { [id: string]: string } = {};
      data.files.forEach((file) => {
        fileNames[file.id] = file.name;
      });
      return sortDictionaryByValue(fileNames);
    } catch (error) {
      throw new Error(`Failed to get folder file names: ${(error as Error).message}`);
    }
  }

  async createClassSpreadsheet(spreadsheetName: string, folderId: string): Promise<File> {
    try {
      return await this.api.request<File>('', {
        method: 'POST',
        body: {
          parents: [folderId],
          name: spreadsheetName,
          mimeType: 'application/vnd.google-apps.spreadsheet',
        },
      });
    } catch (error) {
      throw new Error(`Failed to create spreadsheet: ${(error as Error).message}`);
    }
  }

  async createClassFolder(folderName: string, mrMeetFolderId: string): Promise<File> {
    try {
      return await this.api.request<File>('', {
        method: 'POST',
        body: {
          parents: [mrMeetFolderId],
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
      });
    } catch (error) {
      throw new Error(`Failed to create folder: ${(error as Error).message}`);
    }
  }
}

export default GoogleDriveService;
