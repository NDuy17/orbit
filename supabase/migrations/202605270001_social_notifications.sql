-- In-app notifications for user-to-user events.
-- Run after 202605250005_notification_dismissals_and_push_rpc.sql.

create or replace function public.notification_profile_name(profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(username), ''),
    'Người dùng Orbit'
  )
  from public.profiles
  where id = profile_id;
$$;

revoke all on function public.notification_profile_name(uuid) from public;

create or replace function public.notify_friend_request_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  receiver_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    sender_name := coalesce(public.notification_profile_name(new.sender_id), 'Người dùng Orbit');

    insert into public.notifications (
      audience,
      target_user_id,
      title,
      body,
      status,
      sent_at,
      created_by
    )
    values (
      'user',
      new.receiver_id,
      'Lời mời kết bạn mới',
      sender_name || ' đã gửi lời mời kết bạn cho bạn.',
      'sent',
      now(),
      new.sender_id
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'accepted' then
    receiver_name := coalesce(public.notification_profile_name(new.receiver_id), 'Người dùng Orbit');

    insert into public.notifications (
      audience,
      target_user_id,
      title,
      body,
      status,
      sent_at,
      created_by
    )
    values (
      'user',
      new.sender_id,
      'Lời mời đã được chấp nhận',
      receiver_name || ' đã chấp nhận lời mời kết bạn của bạn.',
      'sent',
      now(),
      new.receiver_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists friend_requests_notify_user on public.friend_requests;
create trigger friend_requests_notify_user
after insert or update of status on public.friend_requests
for each row execute function public.notify_friend_request_event();

create or replace function public.notify_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  preview text;
begin
  sender_name := coalesce(public.notification_profile_name(new.sender_id), 'Người dùng Orbit');
  preview := left(regexp_replace(coalesce(new.text, ''), '[[:space:]]+', ' ', 'g'), 120);

  insert into public.notifications (
    audience,
    target_user_id,
    title,
    body,
    status,
    sent_at,
    created_by
  )
  values (
    'user',
    new.receiver_id,
    'Tin nhắn mới',
    sender_name || case when preview <> '' then ': ' || preview else ' đã gửi tin nhắn cho bạn.' end,
    'sent',
    now(),
    new.sender_id
  );

  return new;
end;
$$;

drop trigger if exists messages_notify_receiver on public.messages;
create trigger messages_notify_receiver
after insert on public.messages
for each row execute function public.notify_message_insert();
