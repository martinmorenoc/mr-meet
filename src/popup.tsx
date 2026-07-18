import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { getMeetingIdFromUrl } from './utils';

type ActionId = 'attendance' | 'random';
type ActionState = 'idle' | ActionId;

interface PopupAction {
  id: ActionId;
  label: string;
  description: string;
  icon: string;
}

interface MeetingContext {
  meetingId: string;
  tabId: number;
}

const getPopupActions = (): PopupAction[] => [
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

const getAuthToken = () =>
  new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (cachedToken) => {
      if (cachedToken) {
        resolve(cachedToken);
        return;
      }

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
  });

const sendToTab = async (tabId: number, message: Record<string, unknown>) => {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    throw new Error(chrome.i18n.getMessage('contentScriptUnavailable'));
  }
};

const sendToBackground = (message: Record<string, unknown>) =>
  new Promise<void>((resolve, reject) => {
    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });

function Popup() {
  const [meetingContext, setMeetingContext] = useState<MeetingContext | null>(null);
  const [isCheckingMeeting, setIsCheckingMeeting] = useState(true);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const resolveMeetingContext = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        const meetingId = currentTab?.url ? getMeetingIdFromUrl(currentTab.url) : null;

        if (meetingId && currentTab?.id) {
          setMeetingContext({ meetingId, tabId: currentTab.id });
        }
      } finally {
        setIsCheckingMeeting(false);
      }
    };

    void resolveMeetingContext();
  }, []);

  const runAction = useCallback(
    async (action: ActionId) => {
      if (!meetingContext || actionState !== 'idle') {
        return;
      }

      setErrorMessage(null);
      setActionState(action);

      const loadingTitle =
        action === 'attendance'
          ? chrome.i18n.getMessage('preparingAttendance')
          : chrome.i18n.getMessage('loadingRandomSelect');

      try {
        await sendToTab(meetingContext.tabId, {
          message: 'showLoading',
          title: loadingTitle,
        });

        const authToken = await getAuthToken();

        await sendToBackground({
          message: action === 'attendance' ? 'prepareAttendanceModal' : 'randomSelect',
          authToken,
          meetingId: meetingContext.meetingId,
          tabId: meetingContext.tabId,
        });

        window.close();
      } catch (error) {
        setActionState('idle');

        try {
          await sendToTab(meetingContext.tabId, { message: 'hideLoading' });
        } catch {
          // Tab may be unavailable; popup error is enough.
        }

        setErrorMessage((error as Error).message || chrome.i18n.getMessage('somethingWentWrong'));
      }
    },
    [actionState, meetingContext],
  );

  const handleTakeAttendance = useCallback(() => {
    void runAction('attendance');
  }, [runAction]);

  const handleRandomSelect = useCallback(() => {
    void runAction('random');
  }, [runAction]);

  return (
    <div className="container">
      <Header />
      <Content
        isInMeeting={Boolean(meetingContext)}
        isCheckingMeeting={isCheckingMeeting}
        actionState={actionState}
        errorMessage={errorMessage}
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
  isCheckingMeeting: boolean;
  actionState: ActionState;
  errorMessage: string | null;
  onTakeAttendance: () => void;
  onRandomSelect: () => void;
}

function Content({
  isInMeeting,
  isCheckingMeeting,
  actionState,
  errorMessage,
  onTakeAttendance,
  onRandomSelect,
}: ContentProps) {
  const actions = getPopupActions();
  const handlers: Record<ActionId, () => void> = {
    attendance: onTakeAttendance,
    random: onRandomSelect,
  };
  const loadingLabels: Record<ActionId, string> = {
    attendance: chrome.i18n.getMessage('preparingAttendance'),
    random: chrome.i18n.getMessage('loadingRandomSelect'),
  };
  const isBusy = actionState !== 'idle';
  const buttonsDisabled = !isInMeeting || isCheckingMeeting || isBusy;

  return (
    <main>
      <MeetingStatus isInMeeting={isInMeeting} isCheckingMeeting={isCheckingMeeting} />
      {errorMessage && <p className="error-banner">{errorMessage}</p>}
      <div className="actions">
        {actions.map((action) => (
          <ActionButton
            key={action.id}
            action={action}
            disabled={buttonsDisabled}
            isLoading={actionState === action.id}
            loadingLabel={loadingLabels[action.id]}
            onClick={handlers[action.id]}
          />
        ))}
      </div>
    </main>
  );
}

interface MeetingStatusProps {
  isInMeeting: boolean;
  isCheckingMeeting: boolean;
}

function MeetingStatus({ isInMeeting, isCheckingMeeting }: MeetingStatusProps) {
  let statusMessage = chrome.i18n.getMessage('disabledDescriptionPopup');

  if (isCheckingMeeting) {
    statusMessage = chrome.i18n.getMessage('checkingMeeting');
  } else if (isInMeeting) {
    statusMessage = chrome.i18n.getMessage('enabledDescriptionPopup');
  }

  return (
    <div
      className={
        isCheckingMeeting ? 'status' : isInMeeting ? 'status status--active' : 'status'
      }
    >
      <span className="status__dot" />
      <span>{statusMessage}</span>
    </div>
  );
}

interface ActionButtonProps {
  action: PopupAction;
  disabled: boolean;
  isLoading: boolean;
  loadingLabel: string;
  onClick: () => void;
}

function ActionButton({
  action,
  disabled,
  isLoading,
  loadingLabel,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`action-button${isLoading ? ' action-button--loading' : ''}`}
      type="button"
      onClick={onClick}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <>
          <span className="action-button__spinner" aria-hidden="true" />
          <span className="action-button__content">
            <span className="action-button__label">{loadingLabel}</span>
          </span>
        </>
      ) : (
        <>
          <span className="action-button__icon" aria-hidden="true">
            {action.icon}
          </span>
          <span className="action-button__content">
            <span className="action-button__label">{action.label}</span>
            <span className="action-button__description">{action.description}</span>
          </span>
        </>
      )}
    </button>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p className="footer__text">
        {chrome.i18n.getMessage('likeExtensionText')}{' '}
        <a
          href="https://chrome.google.com/webstore/detail/cipejegejindaigfnpffjkihnilkkflc"
          target="_blank"
          rel="noreferrer"
        >
          {chrome.i18n.getMessage('rateUsText')}
        </a>
        {' · '}
        <a
          href="https://buymeacoffee.com/martinmoreno"
          target="_blank"
          rel="noreferrer"
          title={chrome.i18n.getMessage('supportProjectTitle')}
        >
          {chrome.i18n.getMessage('buyMeACoffeeText')}
        </a>
      </p>
    </footer>
  );
}

const mountPopup = () => {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }

  try {
    ReactDOM.render(
      <React.StrictMode>
        <Popup />
      </React.StrictMode>,
      root,
    );
  } catch (error) {
    console.error('Failed to mount popup:', error);
    root.textContent = chrome.i18n.getMessage('somethingWentWrong');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPopup);
} else {
  mountPopup();
}
