import GoogleApiClient from './google-api-client';

interface ConferenceRecord {
  name: string;
}

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
    const url = `${conferenceRecordName}/participants`;
    const data = await this.api.request<{ participants?: Participant[] }>(`/${url}`);
    return data.participants || [];
  }

  async listParticipantNamesByMeetingId(meetingId: string) {
    const conferenceRecord = await this.getConferenceRecord(meetingId);

    if (!conferenceRecord) {
      throw new Error(`No conference record found for meeting ${meetingId}`);
    }

    const participants = await this.listParticipantsByConferenceRecordName(conferenceRecord.name);
    const participantNames = participants
      .map(getParticipantDisplayName)
      .filter(isDisplayName);

    if (participantNames.length === 0) {
      throw new Error(`Participants found for meeting ${meetingId}, but no display names returned`);
    }

    return participantNames;
  }
}

export default GoogleMeetService;
