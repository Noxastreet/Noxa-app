export type DriveMode = 'planned' | 'quick';

export type DriveSessionStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

export type DriveParticipantRole = 'host' | 'participant';
export type DriveParticipantStatus = 'accepted' | 'active' | 'left' | 'removed';
export type DriveInvitationStatus = 'invited' | 'accepted' | 'declined' | 'cancelled';
export type DriveLocationStatus = 'moving' | 'stopped' | 'arrived' | 'stale';

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
  readyAt?: string | null;
  profile: DriveProfile | null;
};

export type DriveLocationState = {
  id: string;
  driveSessionId: string;
  userId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  status: DriveLocationStatus;
  remainingDistanceMeters: number | null;
  routeDestinationVersion: number | null;
  updatedAt: string;
};

export type DriveInvitation = {
  id: string;
  invitedUserId: string;
  sourceCrewId: string | null;
  status: DriveInvitationStatus;
  createdAt: string;
  profile: DriveProfile | null;
};

export type DriveDestination = {
  latitude: number;
  longitude: number;
  label: string;
  version: number;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

export type DriveDestinationProposal = {
  latitude: number;
  longitude: number;
  label: string;
  proposedByUserId: string;
  proposedAt: string;
};

export type GroupDriveDetails = {
  currentUserId: string;
  driveMode: DriveMode;
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
  destination: DriveDestination | null;
  destinationProposal: DriveDestinationProposal | null;
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

export type DriveRouteManeuver = {
  instruction: string;
  type: string;
  modifier: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
};

export type DriveRouteResult = {
  geometry: DriveRouteGeometry;
  coordinates: DriveRoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
  maneuvers: DriveRouteManeuver[];
};

export type DriveTogetherCreateResult = {
  driveSessionId: string;
  invitationId: string;
};

export type DriveTogetherRoomCreateResult = {
  driveSessionId: string;
  invitationIds: string[];
};

export type PendingQuickDriveInvitation = {
  invitationId: string;
  driveSessionId: string;
  hostId: string;
  hostDisplayName: string;
  hostAvatarUrl: string | null;
  createdAt: string;
  destination: DriveDestination | null;
};
