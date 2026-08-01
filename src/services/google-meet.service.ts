import GoogleApiClient from './google-api-client';

interface ConferenceRecord {
  name: string;
  endTime?: string;
}

// The API returns 100 participants per page by default and caps a page at 250,
// so a large lecture needs both a bigger page and the follow-up pages.
const PARTICIPANTS_PAGE_SIZE = '250';

interface Participant {
  signedinUser?: {
    displayName?: string;
  };
  anonymousUser?: {
    displayName?: string;
  };
  phoneUser?: {
    displayName?: string;
  };
}

const getParticipantDisplayName = (participant: Participant) =>
  participant.signedinUser?.displayName ||
  participant.anonymousUser?.displayName ||
  participant.phoneUser?.displayName;

const isDisplayName = (displayName: string | undefined): displayName is string =>
  Boolean(displayName);

export class GoogleMeetService {
  private api: GoogleApiClient;

  constructor(token: string) {
    const meetBaseUrl = 'https://meet.googleapis.com/v2';
    this.api = new GoogleApiClient(meetBaseUrl, token);
  }

  async getConferenceRecord(meetingId: string) {
    const data = await this.api.request<{ conferenceRecords?: ConferenceRecord[] }>(
      '/conferenceRecords',
      {
        params: {
          filter: `space.meeting_code = "${meetingId}"`,
        },
      },
    );
    return data.conferenceRecords?.[0];
  }

  async listParticipantsByConferenceRecordName(conferenceRecordName: string) {
    const participants: Participant[] = [];
    let pageToken: string | undefined;

    do {
      const params: Record<string, string> = { pageSize: PARTICIPANTS_PAGE_SIZE };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      // eslint-disable-next-line no-await-in-loop
      const data = await this.api.request<{
        participants?: Participant[];
        nextPageToken?: string;
      }>(`/${conferenceRecordName}/participants`, { params });

      participants.push(...(data.participants || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return participants;
  }

  async listParticipantNamesByMeetingId(meetingId: string) {
    const conferenceRecord = await this.getConferenceRecord(meetingId);

    // Records come back newest first, and endTime is only set once a conference
    // has ended. A finished record here means Meet has not registered the
    // meeting in progress yet, so reading it would quietly store the attendance
    // of an earlier session — the same class link is reused every week.
    if (!conferenceRecord || conferenceRecord.endTime) {
      throw new Error(chrome.i18n.getMessage('meetingNotReady'));
    }

    const participants = await this.listParticipantsByConferenceRecordName(conferenceRecord.name);
    const participantNames = participants.map(getParticipantDisplayName).filter(isDisplayName);

    if (participantNames.length === 0) {
      throw new Error(chrome.i18n.getMessage('noParticipants'));
    }

    return participantNames;
  }
}

export default GoogleMeetService;
