import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import GoogleDriveService from './services/google-drive.service';

type ActionId = 'attendance' | 'random';

interface PopupAction {
  id: ActionId;
  label: string;
  description: string;
  icon: string;
}

const ACTIONS: PopupAction[] = [
  {
    id: 'attendance',
    label: chrome.i18n.getMessage('attendanceButton'),
    description: chrome.i18n.getMessage('attendanceButtonDescription'),
    icon: 'A',
  },
  {
    id: 'random',
    label: chrome.i18n.getMessage('randomSelectButton'),
    description: chrome.i18n.getMessage('randomSelectButtonDescription'),
    icon: '?',
  },
];

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
    <header className="header">
      <div className="brand">
        <img className="brand__logo" src="../images/128.png" width="52" height="52" alt="logo" />
        <div className="brand__copy">
          <h1>{chrome.i18n.getMessage('titlePopup')}</h1>
          <p>{chrome.i18n.getMessage('subtitlePopup')}</p>
        </div>
      </div>
    </header>
  );
}

interface ContentProps {
  isInMeeting: boolean;
  onTakeAttendance: () => void;
  onRandomSelect: () => void;
}

function Content({ isInMeeting, onTakeAttendance, onRandomSelect }: ContentProps) {
  const handlers: Record<ActionId, () => void> = {
    attendance: onTakeAttendance,
    random: onRandomSelect,
  };

  return (
    <main>
      <MeetingStatus isInMeeting={isInMeeting} />
      <div className="actions">
        {ACTIONS.map((action) => (
          <ActionButton
            key={action.id}
            action={action}
            disabled={!isInMeeting}
            onClick={handlers[action.id]}
          />
        ))}
      </div>
    </main>
  );
}

interface MeetingStatusProps {
  isInMeeting: boolean;
}

function MeetingStatus({ isInMeeting }: MeetingStatusProps) {
  return (
    <div className={isInMeeting ? 'status status--active' : 'status'}>
      <span className="status__dot" />
      <span>
        {isInMeeting
          ? chrome.i18n.getMessage('enabledDescriptionPopup')
          : chrome.i18n.getMessage('disabledDescriptionPopup')}
      </span>
    </div>
  );
}

interface ActionButtonProps {
  action: PopupAction;
  disabled: boolean;
  onClick: () => void;
}

function ActionButton({ action, disabled, onClick }: ActionButtonProps) {
  return (
    <button disabled={disabled} className="action-button" type="button" onClick={onClick}>
      <span className="action-button__icon" aria-hidden="true">
        {action.icon}
      </span>
      <span className="action-button__content">
        <span className="action-button__label">{action.label}</span>
        <span className="action-button__description">{action.description}</span>
      </span>
    </button>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span>{chrome.i18n.getMessage('likeExtensionText')}</span>
      <a
        href="https://chrome.google.com/webstore/detail/cipejegejindaigfnpffjkihnilkkflc"
        target="_blank"
        rel="noreferrer"
      >
        {chrome.i18n.getMessage('rateUsText')}
      </a>
    </footer>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
  document.getElementById('root'),
);
