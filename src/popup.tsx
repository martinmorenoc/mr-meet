import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import GoogleDriveService from './services/google-drive.service';

const getMeetingIdFromUrl = (url: string): string | null => {
  const meetRegex = /meet.google.com\/(\w{3}-\w{4}-\w{3})/;
  const match = url.match(meetRegex);
  return match ? match[1] : null;
};

const getAuthToken = () =>
  new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (authToken) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!authToken) {
        reject(new Error('No auth token returned'));
        return;
      }

      resolve(authToken);
    });
  });

const getActiveMeetTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab?.id || !currentTab.url) {
    throw new Error('No active tab');
  }

  const meetingId = getMeetingIdFromUrl(currentTab.url);
  if (!meetingId) {
    throw new Error('Invalid meeting URL');
  }

  return {
    meetingId,
    tabId: currentTab.id,
  };
};

function Popup() {
  const [isInMeeting, setIsInMeeting] = useState<boolean>(false);

  const getMrMeetFolder = async (googleDriveService: GoogleDriveService) => {
    const folderName = chrome.i18n.getMessage('mrMeetFolderName');
    const existingFolder = await googleDriveService.getFileByName(folderName, 'folder');
    return existingFolder || googleDriveService.createFolder(folderName);
  };

  const initializeAttendanceProcess = async (
    tabId: number,
    authToken: string,
    meetingId: string,
  ) => {
    const googleDriveService = new GoogleDriveService(authToken);

    // Obtener o crear la carpeta principal
    const mrMeetFolder = await getMrMeetFolder(googleDriveService);
    await chrome.storage.sync.set({ mrMeetFolderId: mrMeetFolder.id });

    // Obtener nombres de las clases
    const classNames = await googleDriveService.getFolderFileNames(mrMeetFolder.id, 'folder');

    // Enviar mensaje al content script
    chrome.tabs.sendMessage(tabId, {
      message: 'showAttendanceModal',
      classNames,
      authToken,
      meetingId,
      tabId,
    });
  };

  const checkIfInMeeting = useCallback(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    setIsInMeeting(Boolean(currentTab.url?.includes('meet.google.com/')));
  }, []);

  const handleTakeAttendance = useCallback(async () => {
    try {
      const authToken = await getAuthToken();
      const { meetingId, tabId } = await getActiveMeetTab();
      await initializeAttendanceProcess(tabId, authToken, meetingId);
    } catch (error) {
      console.error('Error taking attendance:', error);
    }
  }, []);

  const handleRandomSelect = useCallback(async () => {
    try {
      const authToken = await getAuthToken();
      const { meetingId, tabId } = await getActiveMeetTab();
      chrome.runtime.sendMessage({
        message: 'randomSelect',
        authToken,
        meetingId,
        tabId,
      });
    } catch (error) {
      console.error('Error in random selection:', error);
    }
  }, []);

  useEffect(() => {
    checkIfInMeeting();
  }, []);

  return (
    <div className="container">
      <Header />
      <Content
        isInMeeting={isInMeeting}
        onTakeAttendance={handleTakeAttendance}
        onRandomSelect={handleRandomSelect}
      />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <>
      <div>
        <img src="../images/128.png" width="100" height="100" alt="logo" />
      </div>
      <h1>{chrome.i18n.getMessage('titlePopup')}</h1>
    </>
  );
}

interface ContentProps {
  isInMeeting: boolean;
  onTakeAttendance: () => void;
  onRandomSelect: () => void;
}

function Content({ isInMeeting, onTakeAttendance, onRandomSelect }: ContentProps) {
  return (
    <>
      {!isInMeeting && <p>{chrome.i18n.getMessage('disabledDescriptionPopup')}</p>}
      <button
        disabled={!isInMeeting}
        className="button-25"
        type="button"
        onClick={onTakeAttendance}
      >
        {chrome.i18n.getMessage('attendanceButton')}
      </button>
      <button disabled={!isInMeeting} className="button-25" type="button" onClick={onRandomSelect}>
        {chrome.i18n.getMessage('randomSelectButton')}
      </button>
    </>
  );
}

function Footer() {
  return (
    <>
      <hr className="solid" />
      <p>{chrome.i18n.getMessage('likeExtensionText')}</p>
      <a
        href="https://chrome.google.com/webstore/detail/cipejegejindaigfnpffjkihnilkkflc"
        target="_blank"
        rel="noreferrer"
      >
        {chrome.i18n.getMessage('rateUsText')}
      </a>
    </>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
  document.getElementById('root'),
);
