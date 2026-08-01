import Swal from 'sweetalert2';
import { REVIEW_URL } from './utils';

const buildReviewFooter = () => {
  const question = chrome.i18n.getMessage('likeExtensionText');
  const linkText = chrome.i18n.getMessage('rateUsText');

  // The footer is a flex container, so a plain trailing space would be trimmed away.
  return `${question}&nbsp;<a href="${REVIEW_URL}" target="_blank" rel="noreferrer">${linkText}</a>`;
};

// Last line of defence: however the work dies upstream, the user gets a way out
// instead of a spinner that never stops.
const WATCHDOG_DELAY_MS = 20000;

let watchdogTimeoutId: number | undefined;
let currentLoadingTitle = '';
let loadingState: 'idle' | 'loading' | 'stalled' = 'idle';

const clearWatchdog = () => {
  loadingState = 'idle';

  if (watchdogTimeoutId !== undefined) {
    window.clearTimeout(watchdogTimeoutId);
    watchdogTimeoutId = undefined;
  }
};

const restartWatchdog = (title: string) => {
  currentLoadingTitle = title;
  clearWatchdog();
  loadingState = 'loading';
  // eslint-disable-next-line no-use-before-define
  watchdogTimeoutId = window.setTimeout(showStalledWarning, WATCHDOG_DELAY_MS);
};

const showLoading = (title: string) => {
  restartWatchdog(title);

  return Swal.fire({
    allowEscapeKey: false,
    allowOutsideClick: false,
    title,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

async function showStalledWarning() {
  watchdogTimeoutId = undefined;
  loadingState = 'stalled';

  const result = await Swal.fire({
    icon: 'warning',
    title: chrome.i18n.getMessage('stalledTitle'),
    text: chrome.i18n.getMessage('stalledText'),
    showCancelButton: true,
    confirmButtonText: chrome.i18n.getMessage('keepWaitingButton'),
    cancelButtonText: chrome.i18n.getMessage('closeButton'),
  });

  // A late result may have replaced the warning while it was on screen, in
  // which case the wait is already over and there is nothing to resume.
  if (loadingState !== 'stalled') {
    return;
  }

  if (result.isConfirmed) {
    showLoading(currentLoadingTitle);
  } else {
    loadingState = 'idle';
  }
}

// Swal.update() would rebuild the popup and drop the spinner, so the title node
// is edited in place.
const updateLoadingTitle = (title: string) => {
  // Progress can arrive after the user closed the spinner, or while the stall
  // warning is waiting on them. Neither is a moment to rearm or repaint.
  if (loadingState !== 'loading') {
    currentLoadingTitle = title;
    return;
  }

  restartWatchdog(title);

  const titleElement = Swal.getTitle();
  if (titleElement) {
    titleElement.textContent = title;
  }
};

const takeAttendance = (
  className: string,
  token: string,
  meetingId: string,
  tabId: number | undefined,
  classFolderId?: string,
) => {
  const attendance = chrome.i18n.getMessage('attendance');
  chrome.runtime.sendMessage({
    message: 'takeAttendance',
    authToken: token,
    className,
    classFolderId,
    attendance,
    meetingId,
    tabId,
  });
};

const randomSelect = (participantNames: string[]) => {
  if (!participantNames.length) {
    Swal.fire({
      title: chrome.i18n.getMessage('somethingWentWrong'),
      text: chrome.i18n.getMessage('noParticipants'),
      icon: 'warning',
    });
    return;
  }

  const randomName = participantNames[Math.floor(Math.random() * participantNames.length)];
  Swal.fire({
    title: randomName + chrome.i18n.getMessage('hasBeenSelected'),
    icon: 'success',
  });
};

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  const { message } = msg;

  // showLoading and updateLoading rearm the watchdog themselves; every other
  // message means the wait is over, one way or another.
  if (message !== 'showLoading' && message !== 'updateLoading') {
    clearWatchdog();
  }

  if (message === 'showLoading') {
    showLoading(msg.title);
  } else if (message === 'updateLoading') {
    updateLoadingTitle(msg.title);
  } else if (message === 'hideLoading') {
    Swal.close();
  } else if (message === 'showAttendanceModal') {
    Swal.close();
    await Swal.fire({
      title: chrome.i18n.getMessage('selectACourse'),
      input: 'select',
      inputOptions: msg.classNames,
      inputPlaceholder: chrome.i18n.getMessage('attendanceModalPlaceHolder'),
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: chrome.i18n.getMessage('attendanceModalConfirmButton'),
      cancelButtonText: chrome.i18n.getMessage('modalCancelButton'),
      denyButtonText: chrome.i18n.getMessage('attendanceModalNewCourseButton'),
      denyButtonColor: 'LightSeaGreen',
      inputValidator: (value) =>
        new Promise((resolve) => {
          if (!value) {
            resolve(chrome.i18n.getMessage('noCourseSelected'));
            return;
          }
          resolve(null);
        }),
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        showLoading(chrome.i18n.getMessage('takingAttendanceModalTitle'));
        takeAttendance(
          msg.classNames[result.value],
          msg.authToken,
          msg.meetingId,
          msg.tabId,
          result.value,
        );
      } else if (result.isDenied) {
        const { value: className } = await Swal.fire({
          title: chrome.i18n.getMessage('newCourseModalTitle'),
          input: 'text',
          inputPlaceholder: chrome.i18n.getMessage('newCourseModalPlaceHolder'),
          inputAttributes: {
            'aria-label': chrome.i18n.getMessage('newCourseModalAriaLabel'),
          },
          showCancelButton: true,
          inputValidator: (value) =>
            new Promise((resolve) => {
              const normalizedClassName = value?.trim().toLowerCase() ?? '';
              const existingClassNames = (Object.values(msg.classNames) as string[]).map((name) =>
                name.trim().toLowerCase(),
              );

              if (existingClassNames.includes(normalizedClassName)) {
                resolve(chrome.i18n.getMessage('newCourseModalAlreadyExists'));
                return;
              }
              resolve(null);
            }),
        });
        const trimmedClassName = className?.trim();
        if (trimmedClassName) {
          showLoading(chrome.i18n.getMessage('creatingFilesAndTakingAttendance'));
          takeAttendance(trimmedClassName, msg.authToken, msg.meetingId, msg.tabId);
        }
      }
    });
  } else if (message === 'showRandomSelectModal') {
    Swal.close();
    randomSelect(msg.participantNames);
  } else if (message === 'success') {
    const recorded = chrome.i18n.getMessage('participantsRecorded', [
      String(msg.participantCount),
    ]);

    Swal.fire({
      title: chrome.i18n.getMessage('attendanceTaken'),
      text: `${recorded} ${chrome.i18n.getMessage('openMessage')}`,
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: chrome.i18n.getMessage('open'),
      footer: msg.askForReview ? buildReviewFooter() : undefined,
    }).then((result) => {
      if (result.isConfirmed) {
        window.open(`https://docs.google.com/spreadsheets/d/${msg.spreadsheetId}`, '_blank');
      }
    });
  } else if (message === 'error') {
    Swal.close();
    Swal.fire({
      position: 'center',
      icon: 'error',
      title: chrome.i18n.getMessage('somethingWentWrong'),
      text: msg.text,
      showConfirmButton: true,
    });
  }
});
