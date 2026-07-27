import { supabase } from '@/src/lib/supabase';

export type ReportTargetType =
  | 'profile'
  | 'post'
  | 'comment'
  | 'vehicle'
  | 'crew'
  | 'event'
  | 'crew_message'
  | 'event_message';

export type ReportReason =
  | 'harassment'
  | 'hate_speech'
  | 'dangerous_activity'
  | 'spam'
  | 'impersonation'
  | 'privacy'
  | 'illegal_content'
  | 'other';

export type BlockedUser = {
  blocked_id: string;
  blocked_display_name: string;
  blocked_username: string | null;
  blocked_avatar_url: string | null;
  created_at: string;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to use NOXA safety tools.');
  return data.user.id;
}

export async function blockUser(blockedUserId: string) {
  const userId = await requireUserId();
  if (userId === blockedUserId) throw new Error('You cannot block your own account.');

  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: userId,
    blocked_id: blockedUserId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(blockedUserId: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedUserId);
  if (error) throw error;
}

export async function loadBlockedUsers() {
  await requireUserId();
  const { data, error } = await supabase
    .from('user_blocks')
    .select(
      'blocked_id,blocked_display_name,blocked_username,blocked_avatar_url,created_at',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlockedUser[];
}

export async function submitContentReport({
  details,
  reason,
  targetId,
  targetType,
}: {
  details?: string;
  reason: ReportReason;
  targetId: string;
  targetType: ReportTargetType;
}) {
  const userId = await requireUserId();
  const cleanDetails = details?.trim() ?? '';
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: userId,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: cleanDetails || null,
  });
  if (error?.code === '23505') {
    throw new Error('You already have an open report for this content.');
  }
  if (error) throw error;
}
