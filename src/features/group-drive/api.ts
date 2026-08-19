import { FunctionsHttpError } from '@supabase/supabase-js';

import {
  isJwtValidationError,
  refreshSupabaseSessionOnce,
  supabase,
} from '@/src/lib/supabase';

import type {
  DriveInvitation,
  DriveInvitationPreview,
  DriveInviteOptions,
  DriveParticipant,
  DriveProfile,
  DriveRouteResult,
  GroupDriveDetails,
  GroupDriveListItem,
} from './types';

type RpcResult<T> = { data: T | null; error: { code?: string; message?: string } | null };

function publicGroupDriveError(error: { code?: string; message?: string } | null) {
  if (!error) return 'Group Drive could not be updated.';
  if (error.code === 'PGRST202' || error.code === 'PGRST205') {
    return 'Group Drive is not available in this environment yet.';
  }
  const message = error.message ?? '';
  if (/authentication required/i.test(message)) return 'Sign in again to continue.';
  if (/future|past time/i.test(message)) return 'Choose a future start time.';
  if (/mutual friend|cannot be invited|unavailable/i.test(message)) {
    return 'One of the selected drivers can no longer be invited.';
  }
  if (/immutable|after (the )?drive starts/i.test(message)) {
    return 'This Group Drive can no longer be edited.';
  }
  if (/title.*2 to 100/i.test(message)) return 'Use a title between 2 and 100 characters.';
  if (/description.*too long/i.test(message)) return 'Keep the description under 1,000 characters.';
  return 'Group Drive could not be updated. Please retry.';
}

async function rpc<T>(name: string, args?: Record<string, unknown>) {
  const request = () => supabase.rpc(name, args) as unknown as Promise<RpcResult<T>>;
  let result = await request();
  if (isJwtValidationError(result.error)) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await refreshSupabaseSessionOnce();
      if (!error) result = await request();
    }
  }
  if (result.error) throw new Error(publicGroupDriveError(result.error));
  return result.data as T;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to use Group Drive.');
  return data.user.id;
}

function profileName(profile: { display_name?: string | null; username?: string | null }) {
  return profile.display_name?.trim() || profile.username?.trim() || 'NOXA driver';
}

function mapProfile(profile: {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}): DriveProfile {
  return {
    id: profile.id,
    displayName: profileName(profile),
    username: profile.username,
    avatarUrl: profile.avatar_url,
  };
}

export async function listMyGroupDrives(): Promise<GroupDriveListItem[]> {
  const userId = await currentUserId();
  const rows = (await rpc<Record<string, unknown>[]>('noxa_list_my_group_drives')) ?? [];
  const { data: pendingRows, error: pendingError } = await supabase
    .from('drive_invitations')
    .select('id,drive_session_id')
    .eq('invited_user_id', userId)
    .eq('status', 'invited');
  if (pendingError && pendingError.code !== 'PGRST205') {
    throw new Error('Group Drive invitations could not be loaded.');
  }
  const invitationByDrive = new Map(
    (pendingRows ?? []).map((row) => [String(row.drive_session_id), String(row.id)]),
  );
  return rows.map((row) => ({
    driveSessionId: String(row.drive_session_id),
    title: String(row.title ?? 'Group Drive'),
    sessionStatus: row.session_status as GroupDriveListItem['sessionStatus'],
    myRole: (row.my_role as GroupDriveListItem['myRole']) ?? null,
    myParticipantStatus:
      (row.my_participant_status as GroupDriveListItem['myParticipantStatus']) ?? null,
    myInvitationStatus:
      (row.my_invitation_status as GroupDriveListItem['myInvitationStatus']) ?? null,
    invitationId: invitationByDrive.get(String(row.drive_session_id)) ?? null,
    scheduledStartAt: (row.scheduled_start_at as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    routeDistanceMeters:
      row.route_distance_meters === null ? null : Number(row.route_distance_meters),
    routeDurationSeconds:
      row.route_duration_seconds === null ? null : Number(row.route_duration_seconds),
    updatedAt: String(row.updated_at),
  }));
}

export async function createDriveSession(title: string, description: string) {
  return rpc<string>('noxa_create_drive_session', {
    drive_title: title.trim(),
    drive_description: description.trim() || null,
    context_crew_id: null,
    drive_scheduled_start_at: null,
  });
}

export async function updateDriveDetails(
  driveSessionId: string,
  title: string,
  description: string,
  scheduledStartAt: string | null,
  crewId: string | null,
) {
  return rpc<boolean>('noxa_update_drive_details', {
    target_drive_session_id: driveSessionId,
    drive_title: title.trim(),
    drive_description: description.trim() || null,
    context_crew_id: crewId,
    drive_scheduled_start_at: scheduledStartAt,
  });
}

export async function calculateDriveRoute(
  points: { latitude: number; longitude: number }[],
): Promise<DriveRouteResult> {
  const { data, error } = await supabase.functions.invoke<DriveRouteResult>('drive-route', {
    body: { points },
  });
  if (error) {
    const status = error instanceof FunctionsHttpError ? error.context.status : undefined;
    if (status === 401) throw new Error('Your session expired. Sign in again, then retry.');
    if (status === 429) throw new Error('The route service is busy. Wait a moment and retry.');
    if (status === 404) throw new Error('No drivable route was found between these points.');
    throw new Error('Route is unavailable in this environment. Please retry later.');
  }
  if (
    !data ||
    data.geometry?.type !== 'LineString' ||
    !Array.isArray(data.geometry.coordinates) ||
    data.geometry.coordinates.length < 2 ||
    !Number.isFinite(data.distanceMeters) ||
    !Number.isFinite(data.durationSeconds) ||
    !data.provider
  ) {
    throw new Error('The route response was invalid. Please retry.');
  }
  return data;
}

export async function saveDriveRoute(
  driveSessionId: string,
  start: { latitude: number; longitude: number; label: string },
  end: { latitude: number; longitude: number; label: string },
) {
  const route = await calculateDriveRoute([start, end]);
  await rpc<number>('noxa_set_drive_route', {
    target_drive_session_id: driveSessionId,
    start_latitude: start.latitude,
    start_longitude: start.longitude,
    start_label: start.label,
    end_latitude: end.latitude,
    end_longitude: end.longitude,
    end_label: end.label,
    calculated_route_geometry: route.geometry,
    calculated_distance_meters: route.distanceMeters,
    calculated_duration_seconds: route.durationSeconds,
    calculated_route_provider: route.provider,
  });
  return route;
}

export async function getDriveInvitationPreview(
  invitationId: string,
): Promise<DriveInvitationPreview | null> {
  const rows = (await rpc<Record<string, unknown>[]>('noxa_get_drive_invitation_preview', {
    target_invitation_id: invitationId,
  })) ?? [];
  const row = rows[0];
  if (!row) return null;
  return {
    driveSessionId: String(row.drive_session_id),
    title: String(row.title ?? 'Group Drive'),
    hostDisplayName: String(row.host_display_name ?? 'NOXA driver'),
    scheduledStartAt: (row.scheduled_start_at as string | null) ?? null,
    routeDistanceMeters:
      row.route_distance_meters === null ? null : Number(row.route_distance_meters),
    routeDurationSeconds:
      row.route_duration_seconds === null ? null : Number(row.route_duration_seconds),
    approximateDestinationLabel: String(
      row.approximate_destination_label ?? 'Destination shared after joining',
    ),
  };
}

export async function respondToDriveInvitation(invitationId: string, accept: boolean) {
  return rpc<boolean>('noxa_respond_to_drive_invitation', {
    target_invitation_id: invitationId,
    accept_invitation: accept,
  });
}

export async function inviteUsersToDrive(driveSessionId: string, userIds: string[]) {
  for (const userId of userIds) {
    await rpc<string>('noxa_invite_user_to_drive', {
      target_drive_session_id: driveSessionId,
      target_user_id: userId,
      invitation_source_crew_id: null,
    });
  }
}

export async function inviteCrewsToDrive(driveSessionId: string, crewIds: string[]) {
  for (const crewId of crewIds) {
    await rpc<number>('noxa_invite_crew_to_drive', {
      target_drive_session_id: driveSessionId,
      invitation_source_crew_id: crewId,
    });
  }
}

export async function cancelDrive(driveSessionId: string) {
  return rpc<boolean>('noxa_cancel_drive', { target_drive_session_id: driveSessionId });
}

export async function leaveDrive(driveSessionId: string) {
  return rpc<boolean>('noxa_leave_drive', { target_drive_session_id: driveSessionId });
}

export async function cancelDriveInvitation(invitationId: string) {
  return rpc<boolean>('noxa_cancel_drive_invitation', {
    target_invitation_id: invitationId,
  });
}

export async function loadDriveInviteOptions(driveSessionId: string): Promise<DriveInviteOptions> {
  const userId = await currentUserId();
  const [outgoingResult, incomingResult, membershipsResult, participantsResult, invitationsResult] =
    await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', userId),
      supabase.from('follows').select('follower_id').eq('following_id', userId),
      supabase.from('crew_members').select('crew_id').eq('user_id', userId),
      supabase
        .from('drive_participants')
        .select('user_id')
        .eq('drive_session_id', driveSessionId),
      supabase
        .from('drive_invitations')
        .select('invited_user_id,status')
        .eq('drive_session_id', driveSessionId)
        .eq('status', 'invited'),
    ]);
  const error =
    outgoingResult.error ??
    incomingResult.error ??
    membershipsResult.error ??
    participantsResult.error ??
    invitationsResult.error;
  if (error) throw new Error(publicGroupDriveError(error));

  const outgoing = new Set((outgoingResult.data ?? []).map((row) => String(row.following_id)));
  const mutualIds = (incomingResult.data ?? [])
    .map((row) => String(row.follower_id))
    .filter((id) => outgoing.has(id));
  const unavailableIds = new Set([
    ...(participantsResult.data ?? []).map((row) => String(row.user_id)),
    ...(invitationsResult.data ?? []).map((row) => String(row.invited_user_id)),
  ]);
  const profilesResult = mutualIds.length
    ? await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .in('id', mutualIds)
        .order('display_name', { ascending: true })
    : { data: [], error: null };
  if (profilesResult.error) throw new Error('Friends could not be loaded.');

  const crewIds = Array.from(
    new Set((membershipsResult.data ?? []).map((row) => String(row.crew_id))),
  );
  const [crewsResult, crewMembersResult] = await Promise.all([
    crewIds.length
      ? supabase.from('crews').select('id,name').in('id', crewIds).order('name')
      : Promise.resolve({ data: [], error: null }),
    crewIds.length
      ? supabase.from('crew_members').select('crew_id,user_id').in('crew_id', crewIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (crewsResult.error || crewMembersResult.error) {
    throw new Error('Crews could not be loaded.');
  }
  const eligibleCrewMembers = new Map<string, string[]>();
  for (const row of crewMembersResult.data ?? []) {
    const crewId = String(row.crew_id);
    const memberId = String(row.user_id);
    if (memberId === userId || unavailableIds.has(memberId)) continue;
    const members = eligibleCrewMembers.get(crewId) ?? [];
    members.push(memberId);
    eligibleCrewMembers.set(crewId, members);
  }
  return {
    friends: (profilesResult.data ?? []).map((profile) => ({
      ...mapProfile(profile),
      unavailable: unavailableIds.has(profile.id),
    })),
    crews: (crewsResult.data ?? []).map((crew) => ({
      id: String(crew.id),
      name: String(crew.name),
      memberCount: eligibleCrewMembers.get(String(crew.id))?.length ?? 0,
      eligibleUserIds: eligibleCrewMembers.get(String(crew.id)) ?? [],
    })),
  };
}

export async function loadGroupDriveDetails(driveSessionId: string): Promise<GroupDriveDetails> {
  const userId = await currentUserId();
  const { data: session, error: sessionError } = await supabase
    .from('drive_sessions')
    .select(
      'id,host_id,title,description,crew_id,status,scheduled_start_at,started_at,completed_at,end_reason,route_geometry,route_distance_meters,route_duration_seconds,route_provider,route_version',
    )
    .eq('id', driveSessionId)
    .maybeSingle();
  if (sessionError) throw new Error(publicGroupDriveError(sessionError));
  if (!session) throw new Error('This Group Drive is unavailable.');

  const [stopsResult, participantsResult, invitationsResult] = await Promise.all([
    supabase
      .from('drive_stops')
      .select('id,sequence,kind,latitude,longitude,label')
      .eq('drive_session_id', driveSessionId)
      .order('sequence'),
    supabase
      .from('drive_participants')
      .select('user_id,role,status,joined_at')
      .eq('drive_session_id', driveSessionId)
      .order('joined_at'),
    session.host_id === userId
      ? supabase
          .from('drive_invitations')
          .select('id,invited_user_id,source_crew_id,status,created_at')
          .eq('drive_session_id', driveSessionId)
          .order('created_at')
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = stopsResult.error ?? participantsResult.error ?? invitationsResult.error;
  if (relatedError) throw new Error(publicGroupDriveError(relatedError));

  const profileIds = Array.from(
    new Set([
      ...(participantsResult.data ?? []).map((row) => String(row.user_id)),
      ...(invitationsResult.data ?? []).map((row) => String(row.invited_user_id)),
    ]),
  );
  const profilesResult = profileIds.length
    ? await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new Error('Participant profiles could not be loaded.');
  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, mapProfile(profile)]),
  );
  const participants: DriveParticipant[] = (participantsResult.data ?? []).map((row) => ({
    userId: String(row.user_id),
    role: row.role as DriveParticipant['role'],
    status: row.status as DriveParticipant['status'],
    joinedAt: String(row.joined_at),
    profile: profileById.get(String(row.user_id)) ?? null,
  }));
  const invitations: DriveInvitation[] = (invitationsResult.data ?? []).map((row) => ({
    id: String(row.id),
    invitedUserId: String(row.invited_user_id),
    sourceCrewId: row.source_crew_id ? String(row.source_crew_id) : null,
    status: row.status as DriveInvitation['status'],
    createdAt: String(row.created_at),
    profile: profileById.get(String(row.invited_user_id)) ?? null,
  }));
  return {
    currentUserId: userId,
    id: String(session.id),
    hostId: String(session.host_id),
    title: String(session.title),
    description: session.description ? String(session.description) : null,
    crewId: session.crew_id ? String(session.crew_id) : null,
    status: session.status as GroupDriveDetails['status'],
    scheduledStartAt: session.scheduled_start_at ? String(session.scheduled_start_at) : null,
    startedAt: session.started_at ? String(session.started_at) : null,
    completedAt: session.completed_at ? String(session.completed_at) : null,
    endReason: session.end_reason ? String(session.end_reason) : null,
    routeGeometry: (session.route_geometry as GroupDriveDetails['routeGeometry']) ?? null,
    routeDistanceMeters:
      session.route_distance_meters === null ? null : Number(session.route_distance_meters),
    routeDurationSeconds:
      session.route_duration_seconds === null ? null : Number(session.route_duration_seconds),
    routeProvider: session.route_provider ? String(session.route_provider) : null,
    routeVersion: Number(session.route_version ?? 0),
    stops: (stopsResult.data ?? []).map((row) => ({
      id: String(row.id),
      sequence: Number(row.sequence),
      kind: row.kind as 'start' | 'stop' | 'end',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      label: row.label ? String(row.label) : null,
    })),
    participants,
    invitations,
  };
}
