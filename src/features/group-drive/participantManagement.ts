import {
  isJwtValidationError,
  refreshSupabaseSessionOnce,
  supabase,
} from '@/src/lib/supabase';

type RemoveParticipantResult = {
  data: boolean | null;
  error: { code?: string; message?: string } | null;
};

function participantRemovalError(error: { code?: string; message?: string } | null) {
  if (!error) return 'Participant could not be removed.';
  if (error.code === 'PGRST202' || error.code === 'PGRST205') {
    return 'Participant removal is not available in this environment yet.';
  }
  const message = error.message ?? '';
  if (/authentication required/i.test(message)) return 'Sign in again to continue.';
  if (/only the group drive host/i.test(message)) {
    return 'Only the Group Drive host can remove participants.';
  }
  if (/host cannot be removed/i.test(message)) {
    return 'The Group Drive host cannot be removed.';
  }
  return 'Participant could not be removed. Please retry.';
}

export async function removeGroupDriveParticipant(
  driveSessionId: string,
  userId: string,
) {
  const request = () => supabase.rpc('noxa_remove_drive_participant', {
    target_drive_session_id: driveSessionId,
    target_user_id: userId,
  }) as unknown as Promise<RemoveParticipantResult>;

  let result = await request();
  if (isJwtValidationError(result.error)) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await refreshSupabaseSessionOnce();
      if (!error) result = await request();
    }
  }

  if (result.error) throw new Error(participantRemovalError(result.error));
  return result.data === true;
}
