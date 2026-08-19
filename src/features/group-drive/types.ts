export type DriveSessionStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

export type DriveParticipantRole = 'host' | 'participant';
export type DriveParticipantStatus = 'accepted' | 'active' | 'left' | 'removed';
export type DriveInvitationStatus = 'invited' | 'accepted' | 'declined' | 'cancelled';

export type GroupDriveListItem = {
  driveSessionId: string;
  title: string;
  sessionStatus: DriveSessionStatus;
  myRole: DriveParticipantRole | null;
  myParticipantStatus: DriveParticipantStatus | null;
  myInvitationStatus: DriveInvitationStatus | null;
  invitationId: string | null;
  scheduledStartAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  updatedAt: string;
};

export type DriveInvitationPreview = {
  driveSessionId: string;
  title: string;
  hostDisplayName: string;
  scheduledStartAt: string | null;
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  approximateDestinationLabel: string;
};

export type DriveStop = {
  id: string;
  sequence: number;
  kind: 'start' | 'stop' | 'end';
  latitude: number;
  longitude: number;
  label: string | null;
};

export type DriveProfile = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

export type DriveParticipant = {
  userId: string;
  role: DriveParticipantRole;
  status: DriveParticipantStatus;
  joinedAt: string;
  profile: DriveProfile | null;
};

export type DriveInvitation = {
  id: string;
  invitedUserId: string;
  sourceCrewId: string | null;
  status: DriveInvitationStatus;
  createdAt: string;
  profile: DriveProfile | null;
};

export type GroupDriveDetails = {
  currentUserId: string;
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  crewId: string | null;
  status: DriveSessionStatus;
  scheduledStartAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  endReason: string | null;
  routeGeometry: DriveRouteGeometry | null;
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  routeProvider: string | null;
  routeVersion: number;
  stops: DriveStop[];
  participants: DriveParticipant[];
  invitations: DriveInvitation[];
};

export type DriveInviteFriend = DriveProfile & {
  unavailable: boolean;
};

export type DriveInviteCrew = {
  id: string;
  name: string;
  memberCount: number;
  eligibleUserIds: string[];
};

export type DriveInviteOptions = {
  friends: DriveInviteFriend[];
  crews: DriveInviteCrew[];
};

export type DriveRoutePoint = {
  latitude: number;
  longitude: number;
};

export type DriveRouteGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

export type DriveRouteResult = {
  geometry: DriveRouteGeometry;
  coordinates: DriveRoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
};
