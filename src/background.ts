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
  tabId: number;
}

interface PrepareAttendanceModalRequest extends BaseRequest {
  message: 'prepareAttendanceModal';
  meetingId: string;
  tabId: number;
}

type RuntimeRequest = TakeAttendanceRequest | RandomSelectRequest | PrepareAttendanceModalRequest;

// Only ask for a review once the user has felt the value of the extension.
const REVIEW_PROMPT_THRESHOLD = 3;

const registerAttendanceAndCheckReviewPrompt = async () => {
  const { attendanceCount = 0, reviewPromptShown = false } = await chrome.storage.sync.get([
    'attendanceCount',
    'reviewPromptShown',
  ]);
  const nextAttendanceCount = attendanceCount + 1;

  await chrome.storage.sync.set({ attendanceCount: nextAttendanceCount });

  if (reviewPromptShown || nextAttendanceCount < REVIEW_PROMPT_THRESHOLD) {
    return false;
  }

  await chrome.storage.sync.set({ reviewPromptShown: true });
  return true;
};

// Chrome tears down an MV3 service worker after 30s of inactivity, and an
// in-flight fetch does not count as activity. A slow chain of Google calls can
// therefore be killed halfway through, and the tab would keep spinning on a
// result that is never coming. Touching an extension API resets that timer.
const KEEP_ALIVE_INTERVAL_MS = 20000;

const startKeepAlive = () => {
  const intervalId = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, KEEP_ALIVE_INTERVAL_MS);

  return () => clearInterval(intervalId);
};

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

// Each step doubles as a heartbeat: the tab restarts its stall watchdog every
// time one lands, so progress is proof the worker is still alive.
const reportProgress = async (tabId: number | undefined, messageKey: string) => {
  try {
    await sendMessageToTab(tabId, {
      message: 'updateLoading',
      title: chrome.i18n.getMessage(messageKey),
    });
  } catch {
    // A closed or reloaded tab must not abort the work already in flight.
  }
};

const getMrMeetFolder = async (googleDriveService: GoogleDriveService) => {
  const folderName = chrome.i18n.getMessage('mrMeetFolderName');
  const existingFolder = await googleDriveService.getFileByName(folderName, 'folder');
  return existingFolder || googleDriveService.createFolder(folderName);
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

const handlePrepareAttendanceModal = async (request: PrepareAttendanceModalRequest) => {
  const googleDriveService = new GoogleDriveService(request.authToken);

  await reportProgress(request.tabId, 'loadingSearchingClasses');

  const mrMeetFolder = await getMrMeetFolder(googleDriveService);

  await chrome.storage.sync.set({ mrMeetFolderId: mrMeetFolder.id });

  const classNames = await googleDriveService.getFolderFileNames(mrMeetFolder.id, 'folder');

  await sendMessageToTab(request.tabId, {
    message: 'showAttendanceModal',
    classNames,
    authToken: request.authToken,
    meetingId: request.meetingId,
    tabId: request.tabId,
  });
};

const prepareSpreadsheet = async (
  request: TakeAttendanceRequest,
  googleDriveService: GoogleDriveService,
  googleSheetsService: GoogleSheetsService,
) => {
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

  return { spreadsheetId, sheetContent };
};

const handleTakeAttendance = async (request: TakeAttendanceRequest) => {
  const googleDriveService = new GoogleDriveService(request.authToken);
  const googleSheetsService = new GoogleSheetsService(request.authToken);
  const googleMeetService = new GoogleMeetService(request.authToken);

  await reportProgress(request.tabId, 'loadingPreparingSpreadsheet');

  // The participant list does not depend on the spreadsheet, so the two slowest
  // chains overlap instead of queueing. allSettled keeps the loser's rejection
  // handled while the winner is still running.
  const [spreadsheet, participants] = await Promise.allSettled([
    prepareSpreadsheet(request, googleDriveService, googleSheetsService),
    googleMeetService.listParticipantNamesByMeetingId(request.meetingId),
  ]);

  if (spreadsheet.status === 'rejected') {
    throw spreadsheet.reason;
  }

  if (participants.status === 'rejected') {
    throw participants.reason;
  }

  const { spreadsheetId, sheetContent } = spreadsheet.value;

  await reportProgress(request.tabId, 'loadingSavingAttendance');
  await googleSheetsService.addAttendanceDetailToSheet(
    participants.value,
    spreadsheetId,
    sheetContent,
  );

  const askForReview = await registerAttendanceAndCheckReviewPrompt();

  await sendMessageToTab(request.tabId, {
    message: 'success',
    spreadsheetId,
    askForReview,
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
  const stopKeepAlive = startKeepAlive();

  try {
    if (request.message === 'prepareAttendanceModal') {
      await handlePrepareAttendanceModal(request);
    } else if (request.message === 'takeAttendance') {
      await handleTakeAttendance(request);
    } else if (request.message === 'randomSelect') {
      await handleRandomSelect(request);
    }
  } catch (error: any) {
    try {
      await sendMessageToTab(request.tabId, {
        message: 'error',
        text: error.message,
      });
    } catch {
      // The tab is gone, so there is nobody left to tell.
    }
  } finally {
    stopKeepAlive();
  }
};

chrome.runtime.onMessage.addListener((request: RuntimeRequest, _sender, sendResponse) => {
  void handleRuntimeMessage(request);
  sendResponse({ ok: true });
});
