drop trigger if exists noxa_notify_follow_insert on public.follows;
drop trigger if exists noxa_notify_crew_invitation_insert on public.crew_invitations;
drop trigger if exists noxa_notify_post_comment_insert on public.post_comments;
drop trigger if exists noxa_notify_post_like_insert on public.post_likes;
drop trigger if exists noxa_notify_comment_like_insert on public.post_comment_likes;
drop function if exists public.noxa_enqueue_activity_notification();
