import GoogleSheetsService from './services/google-sheets.service';
import GoogleDriveService from './services/google-drive.service';
import GoogleMeetService from './services/google-meet.service';

interface BaseRequest {
  authToken: string;
  tabId?: number;
}

interface TakeAttendanceRequest extends BaseRequest {
  message: 'takeAttendance';
  attendance: string;
  classFolderId?: string;
  className: string;
  meetingId: string;
}

interface RandomSelectRequest extends BaseRequest {
  message: 'randomSelect';
  meetingId: string;
}

type RuntimeRequest = TakeAttendanceRequest | RandomSelectRequest;

const sendMessageToTab = async (tabId: number | undefined, message: Record<string, unknown>) => {
  if (tabId) {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab.id) {
    await chrome.tabs.sendMessage(activeTab.id, message);
  }
};

const getClassFolderId = async (
  googleDriveService: GoogleDriveService,
  className: string,
  classFolderId?: string,
) => {
  if (classFolderId) {
    return classFolderId;
  }

  const { mrMeetFolderId } = await chrome.storage.sync.get(['mrMeetFolderId']);

  if (!mrMeetFolderId) {
    throw new Error('Mr Meet folder was not initialized');
  }

  const createdClassFolder = await googleDriveService.createClassFolder(className, mrMeetFolderId);
  return createdClassFolder.id;
};

const getOrCreateSpreadsheetId = async (
  googleDriveService: GoogleDriveService,
  googleSheetsService: GoogleSheetsService,
  classFolderId: string,
  spreadsheetName: string,
) => {
  const spreadsheetNames = await googleDriveService.getFolderFileNames(
    classFolderId,
    'spreadsheet',
  );
  const existingSpreadsheetId = Object.keys(spreadsheetNames).find(
    (key) => spreadsheetNames[key] === spreadsheetName,
  );

  if (existingSpreadsheetId) {
    return existingSpreadsheetId;
  }

  const spreadsheet = await googleDriveService.createClassSpreadsheet(
    spreadsheetName,
    classFolderId,
  );

  await googleSheetsService.addSheet('Details', spreadsheet.id);
  await googleSheetsService.addSheet('Summary', spreadsheet.id);
  await googleSheetsService.addSummaryFormulasToSheet(spreadsheet.id);

  return spreadsheet.id;
};

const handleTakeAttendance = async (request: TakeAttendanceRequest) => {
  const googleDriveService = new GoogleDriveService(request.authToken);
  const googleSheetsService = new GoogleSheetsService(request.authToken);
  const googleMeetService = new GoogleMeetService(request.authToken);
  const classFolderId = await getClassFolderId(
    googleDriveService,
    request.className,
    request.classFolderId,
  );
  const spreadsheetId = await getOrCreateSpreadsheetId(
    googleDriveService,
    googleSheetsService,
    classFolderId,
    `${request.className} ${request.attendance}`,
  );
  const sheetContent = await googleSheetsService.getSheetContent(spreadsheetId, 'Details');
  const participantNames = await googleMeetService.listParticipantNamesByMeetingId(
    request.meetingId,
  );

  await googleSheetsService.addAttendanceDetailToSheet(
    participantNames,
    spreadsheetId,
    sheetContent,
  );
  await sendMessageToTab(request.tabId, {
    message: 'success',
    spreadsheetId,
  });
};

const handleRandomSelect = async (request: RandomSelectRequest) => {
  const googleMeetService = new GoogleMeetService(request.authToken);
  const participantNames = await googleMeetService.listParticipantNamesByMeetingId(
    request.meetingId,
  );

  await sendMessageToTab(request.tabId, {
    message: 'showRandomSelectModal',
    participantNames,
  });
};

const handleRuntimeMessage = async (request: RuntimeRequest) => {
  try {
    if (request.message === 'takeAttendance') {
      await handleTakeAttendance(request);
    } else if (request.message === 'randomSelect') {
      await handleRandomSelect(request);
    }
  } catch (error: any) {
    await sendMessageToTab(request.tabId, {
      message: 'error',
      text: error.message,
    });
  }
};

chrome.runtime.onMessage.addListener((request: RuntimeRequest) => {
  void handleRuntimeMessage(request);
});
