import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from "react-native";

import {
  NoxaAvatar,
  NoxaBadge,
  NoxaButton,
  NoxaCard,
  NoxaScreen,
} from "@/src/components/ui";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type JoinPolicy = "open" | "approval" | "invite_only";
type Crew = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  join_policy: JoinPolicy;
  created_at: string;
  updated_at: string | null;
};
type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};
type Membership = {
  crew_id: string;
  user_id: string;
  role: CrewRole;
  joined_at: string | null;
};
type Vehicle = {
  id: string;
  owner_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  horsepower: number | null;
  color: string | null;
  cover_image_url: string | null;
  is_public: boolean | null;
};
type CrewEvent = {
  id: string;
  title: string;
  location_name: string;
  starts_at: string;
  is_public: boolean;
  status: string;
};
type Member = Membership & { profile: Profile | null };
type PendingInvitation = {
  id: string;
  crew_id: string;
  invited_user_id: string;
  invited_by: string;
  status: string;
  created_at: string;
  invitedProfile: Profile | null;
  invitedByProfile: Profile | null;
};
type JoinRequest = {
  id: string;
  crew_id: string;
  user_id: string;
  status: string;
  created_at: string;
  profile: Profile | null;
};
type ProfileSearchResult = Profile & {
  pendingInvitationId: string | null;
  isMember: boolean;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const crewSelect =
  "id,owner_id,name,description,city,logo_url,cover_image_url,is_public,join_policy,created_at,updated_at";
const profileSelect = "id,display_name,username,avatar_url,city";
const memberSelect = "crew_id,user_id,role,joined_at";
const vehicleSelect =
  "id,owner_id,brand,model,year,horsepower,color,cover_image_url,is_public";

function normalizeId(id: string | string[] | undefined) {
  return (Array.isArray(id) ? id[0] : id)?.trim() ?? "";
}
function isPresent(value?: string | number | null) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}
function displayName(profile: Profile | null) {
  return profile?.display_name || profile?.username || "Driver";
}
function initials(value: string) {
  return (
    value
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "NX"
  );
}
function vehicleName(vehicle: Vehicle) {
  return (
    [vehicle.year, vehicle.brand, vehicle.model].filter(isPresent).join(" ") ||
    "Vehicle"
  );
}

function Header({
  onRefresh,
  onShare,
  refreshing,
  sharing,
}: {
  onRefresh: () => void;
  onShare: () => void;
  refreshing: boolean;
  sharing: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>CREW PROFILE</Text>
        <Text style={styles.headerSubtitle}>Community details</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel="Share crew"
          accessibilityRole="button"
          disabled={sharing}
          onPress={onShare}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
            sharing && styles.disabled,
          ]}>
          <Ionicons
            name={sharing ? "checkmark" : "share-social-outline"}
            size={19}
            color={colors.textMuted}
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Refresh crew"
          accessibilityRole="button"
          disabled={refreshing}
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
            refreshing && styles.disabled,
          ]}>
          <Ionicons name="refresh" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
function StateCard({
  title,
  message,
  onRetry,
  loading,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  loading?: boolean;
}) {
  return (
    <NoxaCard>
      <View style={styles.stateCard}>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={styles.stateTitle}>{title}</Text>
        {message ? <Text style={styles.stateText}>{message}</Text> : null}
        {onRetry ? <NoxaButton title="Retry" onPress={onRetry} /> : null}
        <NoxaButton
          title="Back"
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    </NoxaCard>
  );
}
function ProfileAvatar({
  profile,
  size = 48,
}: {
  profile: Profile | null;
  size?: number;
}) {
  const name = displayName(profile);
  return profile?.avatar_url ? (
    <Image
      source={{ uri: profile.avatar_url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <NoxaAvatar initials={initials(name)} size={size} />
  );
}

function joinPolicyLabel(policy: JoinPolicy) {
  if (policy === "open") return "OPEN JOIN";
  if (policy === "approval") return "BY APPROVAL";
  return "INVITE ONLY";
}

function MembershipAction({
  effectiveJoinPolicy,
  isMember,
  isOwner,
  joining,
  leaving,
  onCancelRequest,
  onJoin,
  onLeave,
  onRequestJoin,
  pendingJoinRequest,
}: {
  effectiveJoinPolicy: JoinPolicy;
  isMember: boolean;
  isOwner: boolean;
  joining: boolean;
  leaving: boolean;
  onCancelRequest: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onRequestJoin: () => void;
  pendingJoinRequest: JoinRequest | null;
}) {
  if (isOwner) {
    return (
      <View style={styles.ownerStatus}>
        <Ionicons name="shield-checkmark" size={18} color={colors.primaryHover} />
        <View style={styles.ownerStatusCopy}>
          <Text style={styles.ownerStatusTitle}>OWNER ACCESS</Text>
          <Text style={styles.ownerStatusText}>You manage this crew.</Text>
        </View>
      </View>
    );
  }

  if (isMember) {
    return (
      <NoxaButton
        disabled={leaving || joining}
        fullWidth
        onPress={onLeave}
        title={leaving ? "Leaving…" : "Leave Crew"}
        variant="danger"
      />
    );
  }

  if (pendingJoinRequest) {
    return (
      <NoxaButton
        disabled={joining || leaving}
        fullWidth
        onPress={onCancelRequest}
        title={joining ? "Cancelling…" : "Cancel Join Request"}
        variant="secondary"
      />
    );
  }

  if (effectiveJoinPolicy === "open") {
    return (
      <NoxaButton
        disabled={joining || leaving}
        fullWidth
        onPress={onJoin}
        title={joining ? "Joining…" : "Join Crew"}
      />
    );
  }

  if (effectiveJoinPolicy === "approval") {
    return (
      <NoxaButton
        disabled={joining || leaving}
        fullWidth
        onPress={onRequestJoin}
        title={joining ? "Requesting…" : "Request to Join"}
      />
    );
  }

  return <NoxaButton disabled fullWidth title="Invite Only" variant="secondary" />;
}

function CrewOverview({
  crew,
  membersCount,
  membershipAction,
  onOpenOwner,
  owner,
  vehiclesCount,
}: {
  crew: Crew;
  membersCount: number;
  membershipAction: ReactNode;
  onOpenOwner?: () => void;
  owner: Profile | null;
  vehiclesCount: number;
}) {
  return (
    <View style={styles.heroCard}>
      {crew.cover_image_url ? (
        <ImageBackground
          imageStyle={styles.coverRadius as ImageStyle}
          resizeMode="cover"
          source={{ uri: crew.cover_image_url }}
          style={styles.cover}>
          <View style={styles.coverShade} />
        </ImageBackground>
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <View style={styles.coverGlowLarge} />
          <View style={styles.coverGlowSmall} />
          <Ionicons name="people" size={76} color={colors.primaryMuted} />
          <View style={styles.coverShade} />
        </View>
      )}

      <View style={styles.heroBadges}>
        <NoxaBadge
          label={crew.is_public ? "PUBLIC" : "PRIVATE"}
          variant={crew.is_public ? "primary" : "default"}
        />
        <View style={styles.policyBadge}>
          <Text style={styles.policyBadgeText}>
            {joinPolicyLabel(crew.is_public ? crew.join_policy : "invite_only")}
          </Text>
        </View>
      </View>

      <View style={styles.heroContent}>
        <View style={styles.heroIdentityRow}>
          <View style={styles.logoWrap}>
            {crew.logo_url ? (
              <Image source={{ uri: crew.logo_url }} style={styles.logo} />
            ) : (
              <Text style={styles.logoInitials}>{initials(crew.name)}</Text>
            )}
          </View>
          <View style={styles.heroIdentityCopy}>
            <Text style={styles.heroTitle}>{crew.name}</Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.heroMeta}>{crew.city || "Global crew"}</Text>
            </View>
          </View>
        </View>

        {isPresent(crew.description) ? (
          <Text style={styles.bodyText}>{crew.description}</Text>
        ) : (
          <Text style={styles.bodyText}>This crew has not added a description yet.</Text>
        )}

        <View style={styles.statsStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{membersCount}</Text>
            <Text style={styles.statLabel}>DRIVERS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>{vehiclesCount}</Text>
            <Text style={styles.statLabel}>PUBLIC CARS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Ionicons
              name={crew.is_public ? "earth-outline" : "lock-closed-outline"}
              size={20}
              color={colors.text}
            />
            <Text style={styles.statLabel}>{crew.is_public ? "VISIBLE" : "PRIVATE"}</Text>
          </View>
        </View>

        {owner ? (
          <Pressable
            accessibilityLabel="Open owner driver profile"
            accessibilityRole="button"
            onPress={onOpenOwner}
            style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}>
            <ProfileAvatar profile={owner} size={42} />
            <View style={styles.personCopy}>
              <Text style={styles.ownerLabel}>CREW OWNER</Text>
              <Text style={styles.personName}>{displayName(owner)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
          </Pressable>
        ) : null}

        <View style={styles.membershipAction}>{membershipAction}</View>
      </View>
    </View>
  );
}

function SectionHeading({
  caption,
  count,
  title,
}: {
  caption: string;
  count?: number;
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCaption}>{caption}</Text>
      </View>
      {typeof count === "number" ? (
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CrewQuickActions({
  enabled,
  onCalendar,
  onChat,
  onConvoy,
  onGallery,
  onGarage,
  onPolls,
}: {
  enabled: boolean;
  onCalendar: () => void;
  onChat: () => void;
  onConvoy: () => void;
  onGallery: () => void;
  onGarage: () => void;
  onPolls: () => void;
}) {
  const actions = [
    { label: "CHAT", icon: "chatbubbles-outline" as const, onPress: onChat },
    { label: "GALLERY", icon: "images-outline" as const, onPress: onGallery },
    { label: "GARAGE", icon: "car-sport-outline" as const, onPress: onGarage },
    { label: "CALENDAR", icon: "calendar-outline" as const, onPress: onCalendar },
    { label: "POLLS", icon: "stats-chart-outline" as const, onPress: onPolls },
    { label: "CONVOY", icon: "navigate-outline" as const, onPress: onConvoy },
  ];

  return (
    <View style={styles.sectionBlock}>
      <SectionHeading
        caption="Private spaces for the crew"
        title="QUICK ACTIONS"
      />
      <View style={styles.quickActionGrid}>
        {actions.map((action) => (
          <Pressable
            accessibilityLabel={`Open crew ${action.label.toLowerCase()}`}
            accessibilityRole="button"
            disabled={!enabled}
            key={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.quickAction,
              !enabled && styles.quickActionDisabled,
              pressed && enabled && styles.pressed,
            ]}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons
                name={enabled ? action.icon : "lock-closed-outline"}
                size={21}
                color={enabled ? colors.primaryHover : colors.textSubtle}
              />
            </View>
            <Text style={[styles.quickActionLabel, !enabled && styles.quickActionLabelDisabled]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {!enabled ? (
        <Text style={styles.quickActionHint}>
          Join the crew to unlock its private tools and shared spaces.
        </Text>
      ) : null}
    </View>
  );
}

function CrewEvents({
  canCreate,
  error,
  events,
  onCreate,
  onOpen,
}: {
  canCreate: boolean;
  error: string | null;
  events: CrewEvent[];
  onCreate: () => void;
  onOpen: (eventId: string) => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.eventsHeadingRow}>
        <View style={styles.eventsHeadingContent}>
          <SectionHeading
            caption="Upcoming drives and meets"
            count={events.length}
            title="CREW EVENTS"
          />
        </View>
        {canCreate ? (
          <Pressable
            accessibilityLabel="Create crew event"
            accessibilityRole="button"
            onPress={onCreate}
            style={({ pressed }) => [styles.createEventButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={16} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.emptyPanel}>
          <Ionicons name="cloud-offline-outline" size={24} color={colors.primaryHover} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : events.length ? (
        <View style={styles.eventsCard}>
          {events.map((event, index) => {
            const date = new Date(event.starts_at);
            return (
              <Pressable
                accessibilityLabel={`Open ${event.title}`}
                accessibilityRole="button"
                key={event.id}
                onPress={() => onOpen(event.id)}
                style={({ pressed }) => [
                  styles.eventRow,
                  index < events.length - 1 && styles.eventRowBorder,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.eventDateTile}>
                  <Text style={styles.eventDateDay}>
                    {new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(date)}
                  </Text>
                  <Text style={styles.eventDateMonth}>
                    {new Intl.DateTimeFormat(undefined, { month: "short" }).format(date).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.eventCopy}>
                  <View style={styles.eventTitleRow}>
                    <Text numberOfLines={1} style={styles.eventTitle}>{event.title}</Text>
                    {!event.is_public ? <Ionicons name="lock-closed" size={12} color={colors.textMuted} /> : null}
                  </View>
                  <Text numberOfLines={1} style={styles.eventMeta}>
                    {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)} · {event.location_name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Pressable
          accessibilityRole={canCreate ? "button" : undefined}
          disabled={!canCreate}
          onPress={canCreate ? onCreate : undefined}
          style={({ pressed }) => [styles.emptyPanel, pressed && canCreate && styles.pressed]}>
          <Ionicons name="calendar-outline" size={24} color={colors.textSubtle} />
          <Text style={styles.emptyText}>
            {canCreate ? "Plan the first event for this crew." : "No upcoming crew events."}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function MemberRoster({
  currentUserId,
  isAdmin,
  isOwner,
  memberActionId,
  members,
  onOpenMember,
  onRemoveMember,
  onSetRole,
}: {
  currentUserId: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  memberActionId: string | null;
  members: Member[];
  onOpenMember: (memberId: string) => void;
  onRemoveMember: (member: Member) => void;
  onSetRole: (member: Member, role: "admin" | "member") => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <SectionHeading
        caption="Drivers, roles, and permissions"
        count={members.length}
        title="CREW MEMBERS"
      />
      {members.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Ionicons name="people-outline" size={24} color={colors.textSubtle} />
          <Text style={styles.emptyText}>No visible members yet.</Text>
        </View>
      ) : (
        <View style={styles.rosterCard}>
          {members.map((member, index) => {
            const canPromote = isOwner && member.role === "member";
            const canDemote = isOwner && member.role === "admin";
            const canRemove =
              member.role !== "owner" &&
              currentUserId !== member.user_id &&
              (isOwner || (isAdmin && member.role === "member"));
            const isBusy = memberActionId === member.user_id;

            return (
              <View
                key={member.user_id}
                style={[
                  styles.memberItem,
                  index < members.length - 1 && styles.memberItemBorder,
                ]}>
                <Pressable
                  accessibilityLabel={`Open ${displayName(member.profile)} profile`}
                  accessibilityRole="button"
                  onPress={() => onOpenMember(member.user_id)}
                  style={({ pressed }) => [styles.memberMainRow, pressed && styles.pressed]}>
                  <ProfileAvatar profile={member.profile} size={46} />
                  <View style={styles.personCopy}>
                    <Text style={styles.personName}>{displayName(member.profile)}</Text>
                    <Text style={styles.personMeta}>
                      {member.profile?.username
                        ? `@${member.profile.username}`
                        : (member.profile?.city ?? "NOXA driver")}
                    </Text>
                  </View>
                  <NoxaBadge
                    label={
                      member.role === "owner"
                        ? "OWNER"
                        : member.role === "admin"
                          ? "ADMIN"
                          : "MEMBER"
                    }
                    variant={
                      member.role === "owner"
                        ? "primary"
                        : member.role === "admin"
                          ? "warning"
                          : "default"
                    }
                  />
                </Pressable>

                {canPromote || canDemote || canRemove ? (
                  <View style={styles.memberActionBar}>
                    {canPromote ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => onSetRole(member, "admin")}
                        style={({ pressed }) => [
                          styles.roleAction,
                          styles.promoteAction,
                          pressed && styles.pressed,
                          isBusy && styles.disabled,
                        ]}>
                        <Ionicons name="shield-outline" size={14} color={colors.primaryHover} />
                        <Text style={styles.promoteActionText}>{isBusy ? "Working…" : "Make Admin"}</Text>
                      </Pressable>
                    ) : null}
                    {canDemote ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => onSetRole(member, "member")}
                        style={({ pressed }) => [
                          styles.roleAction,
                          pressed && styles.pressed,
                          isBusy && styles.disabled,
                        ]}>
                        <Text style={styles.roleActionText}>{isBusy ? "Working…" : "Make Member"}</Text>
                      </Pressable>
                    ) : null}
                    {canRemove ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => onRemoveMember(member)}
                        style={({ pressed }) => [
                          styles.roleAction,
                          styles.removeAction,
                          pressed && styles.pressed,
                          isBusy && styles.disabled,
                        ]}>
                        <Ionicons name="person-remove-outline" size={14} color={colors.primaryHover} />
                        <Text style={styles.removeActionText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function CrewGarage({
  onOpenVehicle,
  ownerNamesById,
  vehicles,
}: {
  onOpenVehicle: (vehicleId: string) => void;
  ownerNamesById: Map<string, string>;
  vehicles: Vehicle[];
}) {
  return (
    <View style={styles.sectionBlock}>
      <SectionHeading
        caption="Public builds from the roster"
        count={vehicles.length}
        title="CREW GARAGE"
      />
      {vehicles.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Ionicons name="car-sport-outline" size={26} color={colors.textSubtle} />
          <Text style={styles.emptyText}>No public member cars yet.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          contentContainerStyle={styles.garageRail}
          showsHorizontalScrollIndicator={false}>
          {vehicles.map((vehicle) => (
            <Pressable
              key={vehicle.id}
              accessibilityLabel={`Open ${vehicleName(vehicle)}`}
              accessibilityRole="button"
              onPress={() => onOpenVehicle(vehicle.id)}
              style={({ pressed }) => [styles.garageCard, pressed && styles.pressed]}>
              {vehicle.cover_image_url ? (
                <Image source={{ uri: vehicle.cover_image_url }} style={styles.garageImage} />
              ) : (
                <View style={[styles.garageImage, styles.garagePlaceholder]}>
                  <Ionicons name="car-sport" size={34} color={colors.primary} />
                </View>
              )}
              <View style={styles.garageCardBody}>
                <Text numberOfLines={1} style={styles.garageTitle}>
                  {vehicleName(vehicle)}
                </Text>
                <Text numberOfLines={1} style={styles.garageOwner}>
                  {ownerNamesById.get(vehicle.owner_id) ?? "NOXA driver"}
                </Text>
                <View style={styles.garageMetaRow}>
                  {vehicle.horsepower ? (
                    <Text style={styles.garageMeta}>{vehicle.horsepower} HP</Text>
                  ) : null}
                  {vehicle.color ? <Text style={styles.garageMeta}>{vehicle.color}</Text> : null}
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function JoinRequestsPanel({
  actionId,
  onOpenProfile,
  onReview,
  requests,
}: {
  actionId: string | null;
  onOpenProfile: (profileId: string) => void;
  onReview: (requestId: string, approve: boolean) => void;
  requests: JoinRequest[];
}) {
  return (
    <View style={styles.sectionBlock}>
      <SectionHeading
        caption="Approve or reject people who want to join"
        count={requests.length}
        title="JOIN REQUESTS"
      />
      {requests.length === 0 ? (
        <View style={styles.managementEmpty}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
          <Text style={styles.managementEmptyText}>No pending requests.</Text>
        </View>
      ) : (
        <View style={styles.managementCard}>
          {requests.map((request, index) => {
            const isBusy = actionId === request.id;
            return (
              <View
                key={request.id}
                style={[
                  styles.managementRow,
                  index < requests.length - 1 && styles.managementRowBorder,
                ]}>
                <Pressable
                  accessibilityLabel={`Open ${displayName(request.profile)} profile`}
                  accessibilityRole="button"
                  onPress={() => onOpenProfile(request.user_id)}
                  style={({ pressed }) => [styles.managementProfile, pressed && styles.pressed]}>
                  <ProfileAvatar profile={request.profile} size={44} />
                  <View style={styles.personCopy}>
                    <Text style={styles.personName}>{displayName(request.profile)}</Text>
                    <Text style={styles.personMeta}>
                      {request.profile?.username
                        ? `@${request.profile.username}`
                        : (request.profile?.city ?? "NOXA driver")}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.requestActionBar}>
                  <Pressable
                    accessibilityLabel="Approve join request"
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => onReview(request.id, true)}
                    style={({ pressed }) => [
                      styles.iconDecisionButton,
                      styles.approveButton,
                      pressed && styles.pressed,
                      isBusy && styles.disabled,
                    ]}>
                    <Ionicons name="checkmark" size={18} color={colors.text} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Reject join request"
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => onReview(request.id, false)}
                    style={({ pressed }) => [
                      styles.iconDecisionButton,
                      styles.rejectButton,
                      pressed && styles.pressed,
                      isBusy && styles.disabled,
                    ]}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function InviteManager({
  actionId,
  hasSearched,
  onCancelInvitation,
  onChangeQuery,
  onInvite,
  onOpenProfile,
  onSearch,
  pendingInvitations,
  query,
  results,
  searching,
}: {
  actionId: string | null;
  hasSearched: boolean;
  onCancelInvitation: (invitationId: string) => void;
  onChangeQuery: (value: string) => void;
  onInvite: (profileId: string) => void;
  onOpenProfile: (profileId: string) => void;
  onSearch: () => void;
  pendingInvitations: PendingInvitation[];
  query: string;
  results: ProfileSearchResult[];
  searching: boolean;
}) {
  return (
    <View style={styles.sectionBlock}>
      <SectionHeading
        caption="Search by username and track pending invites"
        count={pendingInvitations.length}
        title="INVITE DRIVERS"
      />
      <View style={styles.inviteCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputShell}>
            <Ionicons name="search" size={17} color={colors.textMuted} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onChangeQuery}
              onSubmitEditing={onSearch}
              placeholder="Username"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={searching}
            onPress={onSearch}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && styles.pressed,
              searching && styles.disabled,
            ]}>
            {searching ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.searchButtonText}>SEARCH</Text>
            )}
          </Pressable>
        </View>

        {hasSearched && results.length === 0 ? (
          <View style={styles.searchEmpty}>
            <Text style={styles.managementEmptyText}>No matching drivers found.</Text>
          </View>
        ) : null}

        {results.length > 0 ? (
          <View style={styles.inviteList}>
            <Text style={styles.inviteListLabel}>SEARCH RESULTS</Text>
            {results.map((profile, index) => {
              const isBusy = actionId === profile.id;
              const isUnavailable = profile.isMember || Boolean(profile.pendingInvitationId);
              return (
                <View
                  key={profile.id}
                  style={[
                    styles.inviteRow,
                    index < results.length - 1 && styles.managementRowBorder,
                  ]}>
                  <Pressable
                    accessibilityLabel={`Open ${displayName(profile)} profile`}
                    accessibilityRole="button"
                    onPress={() => onOpenProfile(profile.id)}
                    style={({ pressed }) => [styles.managementProfile, pressed && styles.pressed]}>
                    <ProfileAvatar profile={profile} size={42} />
                    <View style={styles.personCopy}>
                      <Text style={styles.personName}>{displayName(profile)}</Text>
                      <Text style={styles.personMeta}>
                        {profile.username ? `@${profile.username}` : "NOXA driver"}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isUnavailable || isBusy}
                    onPress={() => onInvite(profile.id)}
                    style={({ pressed }) => [
                      styles.inviteButton,
                      isUnavailable && styles.inviteButtonDisabled,
                      pressed && styles.pressed,
                      isBusy && styles.disabled,
                    ]}>
                    <Text style={[styles.inviteButtonText, isUnavailable && styles.inviteButtonDisabledText]}>
                      {profile.isMember
                        ? "MEMBER"
                        : profile.pendingInvitationId
                          ? "PENDING"
                          : isBusy
                            ? "SENDING…"
                            : "INVITE"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        {pendingInvitations.length > 0 ? (
          <View style={styles.inviteList}>
            <Text style={styles.inviteListLabel}>PENDING INVITATIONS</Text>
            {pendingInvitations.map((invitation, index) => {
              const isBusy = actionId === invitation.id;
              return (
                <View
                  key={invitation.id}
                  style={[
                    styles.inviteRow,
                    index < pendingInvitations.length - 1 && styles.managementRowBorder,
                  ]}>
                  <Pressable
                    accessibilityLabel={`Open ${displayName(invitation.invitedProfile)} profile`}
                    accessibilityRole="button"
                    onPress={() => onOpenProfile(invitation.invited_user_id)}
                    style={({ pressed }) => [styles.managementProfile, pressed && styles.pressed]}>
                    <ProfileAvatar profile={invitation.invitedProfile} size={42} />
                    <View style={styles.personCopy}>
                      <Text style={styles.personName}>{displayName(invitation.invitedProfile)}</Text>
                      <Text style={styles.personMeta}>
                        Invited by {displayName(invitation.invitedByProfile)}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => onCancelInvitation(invitation.id)}
                    style={({ pressed }) => [
                      styles.cancelInviteButton,
                      pressed && styles.pressed,
                      isBusy && styles.disabled,
                    ]}>
                    <Text style={styles.cancelInviteText}>{isBusy ? "…" : "CANCEL"}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function CrewDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const crewId = useMemo(() => normalizeId(id), [id]);
  const isValidCrewId = uuidPattern.test(crewId);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [crewEvents, setCrewEvents] = useState<CrewEvent[]>([]);
  const [crewEventsError, setCrewEventsError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([]);
  const [pendingJoinRequest, setPendingJoinRequest] =
    useState<JoinRequest | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const requestId = useRef(0);
  const loadingRef = useRef(false);

  const loadCrew = useCallback(
    async (showSpinner = true) => {
      if (!isValidCrewId) {
        setCrew(null);
        setOwner(null);
        setMembers([]);
        setPendingInvitations([]);
        setPendingJoinRequest(null);
        setJoinRequests([]);
        setVehicles([]);
        setCrewEvents([]);
        setCrewEventsError(null);
        setError("This crew link is invalid.");
        setLoading(false);
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      const token = requestId.current + 1;
      requestId.current = token;
      if (showSpinner) setLoading(true);
      setError(null);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      const { data: crewData, error: crewError } = await supabase
        .from("crews")
        .select(crewSelect)
        .eq("id", crewId)
        .maybeSingle();
      if (requestId.current !== token) {
        loadingRef.current = false;
        return;
      }
      if (crewError || !crewData) {
        setCurrentUserId(userId);
        setCrew(null);
        setOwner(null);
        setMembers([]);
        setPendingInvitations([]);
        setPendingJoinRequest(null);
        setJoinRequests([]);
        setVehicles([]);
        setCrewEvents([]);
        setCrewEventsError(null);
        setError("Crew not found or unavailable.");
        setLoading(false);
        loadingRef.current = false;
        return;
      }
      const loadedCrew = crewData as Crew;
      const [ownerResult, memberResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(profileSelect)
          .eq("id", loadedCrew.owner_id)
          .maybeSingle(),
        supabase
          .from("crew_members")
          .select(memberSelect)
          .eq("crew_id", loadedCrew.id),
      ]);
      if (requestId.current !== token) {
        loadingRef.current = false;
        return;
      }
      if (ownerResult.error || memberResult.error) {
        setError("Crew details are unavailable right now.");
        setLoading(false);
        loadingRef.current = false;
        return;
      }
      const membershipRows = ((memberResult.data ?? []) as Membership[]).sort(
        (a, b) =>
          a.role === "owner"
            ? -1
            : b.role === "owner"
              ? 1
              : a.role === "admin" && b.role !== "admin"
                ? -1
                : b.role === "admin" && a.role !== "admin"
                  ? 1
                  : (a.joined_at ?? "").localeCompare(b.joined_at ?? ""),
      );
      const ids = Array.from(
        new Set([...membershipRows.map((m) => m.user_id), loadedCrew.owner_id]),
      );
      const { data: profileRows, error: profilesError } =
        ids.length > 0
          ? await supabase.from("profiles").select(profileSelect).in("id", ids)
          : { data: [], error: null };
      if (requestId.current !== token) {
        loadingRef.current = false;
        return;
      }
      if (profilesError) {
        setError("Member profiles are unavailable right now.");
        setLoading(false);
        loadingRef.current = false;
        return;
      }
      const profileMap = new Map(
        ((profileRows ?? []) as Profile[]).map((profile) => [
          profile.id,
          profile,
        ]),
      );
      const normalizedMemberships = membershipRows.some(
        (m) => m.user_id === loadedCrew.owner_id,
      )
        ? membershipRows
        : [
            {
              crew_id: loadedCrew.id,
              user_id: loadedCrew.owner_id,
              role: "owner" as CrewRole,
              joined_at: loadedCrew.created_at,
            },
            ...membershipRows,
          ];
      const nextMembers = normalizedMemberships
        .map((member) => ({
          ...member,
          role:
            member.user_id === loadedCrew.owner_id
              ? ("owner" as CrewRole)
              : member.role,
          profile: profileMap.get(member.user_id) ?? null,
        }))
        .sort((a, b) =>
          a.role === "owner"
            ? -1
            : b.role === "owner"
              ? 1
              : a.role === "admin" && b.role !== "admin"
                ? -1
                : b.role === "admin" && a.role !== "admin"
                  ? 1
                  : (a.joined_at ?? "").localeCompare(b.joined_at ?? ""),
        );
      let vehicleRows: Vehicle[] = [];
      let eventRows: CrewEvent[] = [];
      let nextCrewEventsError: string | null = null;
      let nextPendingInvitations: PendingInvitation[] = [];
      let nextPendingJoinRequest: JoinRequest | null = null;
      let nextJoinRequests: JoinRequest[] = [];
      if (userId) {
        const { data: currentRequestRows, error: currentRequestError } =
          await supabase
            .from("crew_join_requests")
            .select("id,crew_id,user_id,status,created_at")
            .eq("crew_id", loadedCrew.id)
            .eq("user_id", userId)
            .eq("status", "pending")
            .maybeSingle();
        if (requestId.current !== token) {
          loadingRef.current = false;
          return;
        }
        if (currentRequestError) {
          setError("Crew join request is unavailable right now.");
          setLoading(false);
          loadingRef.current = false;
          return;
        }
        nextPendingJoinRequest = currentRequestRows
          ? {
              ...(currentRequestRows as Omit<JoinRequest, "profile">),
              profile: null,
            }
          : null;
      }
      if (
        userId &&
        nextMembers.some(
          (member) =>
            member.user_id === userId &&
            (member.role === "owner" || member.role === "admin"),
        )
      ) {
        const { data: invitationRows, error: invitationsError } = await supabase
          .from("crew_invitations")
          .select("id,crew_id,invited_user_id,invited_by,status,created_at")
          .eq("crew_id", loadedCrew.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (requestId.current !== token) {
          loadingRef.current = false;
          return;
        }
        if (invitationsError) {
          setError("Crew invitations are unavailable right now.");
          setLoading(false);
          loadingRef.current = false;
          return;
        }
        const invitations = (invitationRows ?? []) as Omit<
          PendingInvitation,
          "invitedProfile" | "invitedByProfile"
        >[];
        if (invitations.length > 0) {
          const profileIds = Array.from(
            new Set(
              invitations.flatMap((invite) => [
                invite.invited_user_id,
                invite.invited_by,
              ]),
            ),
          );
          const {
            data: invitationProfileRows,
            error: invitationProfilesError,
          } = await supabase
            .from("profiles")
            .select(profileSelect)
            .in("id", profileIds);
          if (requestId.current !== token) {
            loadingRef.current = false;
            return;
          }
          if (invitationProfilesError) {
            setError("Invitation profiles are unavailable right now.");
            setLoading(false);
            loadingRef.current = false;
            return;
          }
          const invitationProfileMap = new Map(
            ((invitationProfileRows ?? []) as Profile[]).map((profile) => [
              profile.id,
              profile,
            ]),
          );
          nextPendingInvitations = invitations.map((invite) => ({
            ...invite,
            invitedProfile:
              invitationProfileMap.get(invite.invited_user_id) ?? null,
            invitedByProfile:
              invitationProfileMap.get(invite.invited_by) ?? null,
          }));
        }
        const { data: joinRequestRows, error: joinRequestsError } =
          await supabase
            .from("crew_join_requests")
            .select("id,crew_id,user_id,status,created_at")
            .eq("crew_id", loadedCrew.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false });
        if (requestId.current !== token) {
          loadingRef.current = false;
          return;
        }
        if (joinRequestsError) {
          setError("Crew join requests are unavailable right now.");
          setLoading(false);
          loadingRef.current = false;
          return;
        }
        const requests = (joinRequestRows ?? []) as Omit<
          JoinRequest,
          "profile"
        >[];
        if (requests.length > 0) {
          const requesterIds = Array.from(
            new Set(requests.map((request) => request.user_id)),
          );
          const { data: requesterProfileRows, error: requesterProfilesError } =
            await supabase
              .from("profiles")
              .select(profileSelect)
              .in("id", requesterIds);
          if (requestId.current !== token) {
            loadingRef.current = false;
            return;
          }
          if (requesterProfilesError) {
            setError("Join request profiles are unavailable right now.");
            setLoading(false);
            loadingRef.current = false;
            return;
          }
          const requesterProfileMap = new Map(
            ((requesterProfileRows ?? []) as Profile[]).map((profile) => [
              profile.id,
              profile,
            ]),
          );
          nextJoinRequests = requests.map((request) => ({
            ...request,
            profile: requesterProfileMap.get(request.user_id) ?? null,
          }));
        }
      }
      const memberIds = Array.from(
        new Set(nextMembers.map((member) => member.user_id)),
      );
      if (memberIds.length > 0) {
        const { data: loadedVehicles, error: vehiclesError } = await supabase
          .from("vehicles")
          .select(vehicleSelect)
          .eq("is_public", true)
          .in("owner_id", memberIds)
          .order("year", { ascending: false })
          .order("brand", { ascending: true });
        if (requestId.current !== token) {
          loadingRef.current = false;
          return;
        }
        if (vehiclesError) {
          setError("Crew garage is unavailable right now.");
          setLoading(false);
          loadingRef.current = false;
          return;
        }
        vehicleRows = (loadedVehicles ?? []) as Vehicle[];
      }
      const { data: loadedEvents, error: eventsError } = await supabase
        .from("events")
        .select("id,title,location_name,starts_at,is_public,status")
        .eq("crew_id", loadedCrew.id)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(10);
      if (requestId.current !== token) {
        loadingRef.current = false;
        return;
      }
      if (eventsError) nextCrewEventsError = "Crew events are unavailable right now.";
      else eventRows = (loadedEvents ?? []) as CrewEvent[];
      setCurrentUserId(userId);
      setCrew(loadedCrew);
      setOwner(
        (ownerResult.data as Profile | null) ??
          profileMap.get(loadedCrew.owner_id) ??
          null,
      );
      setMembers(nextMembers);
      setPendingInvitations(nextPendingInvitations);
      setPendingJoinRequest(nextPendingJoinRequest);
      setJoinRequests(nextJoinRequests);
      setVehicles(vehicleRows);
      setCrewEvents(eventRows);
      setCrewEventsError(nextCrewEventsError);
      setLoading(false);
      loadingRef.current = false;
    },
    [crewId, isValidCrewId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadCrew();
      return () => {
        requestId.current += 1;
        loadingRef.current = false;
      };
    }, [loadCrew]),
  );

  const membership = currentUserId
    ? members.find((member) => member.user_id === currentUserId)
    : undefined;
  const isOwner = Boolean(crew && currentUserId === crew.owner_id);
  const isAdmin = membership?.role === "admin";
  const canManageCrew = isOwner || isAdmin;
  const isMember = Boolean(membership) || isOwner;
  const effectiveJoinPolicy = crew?.is_public
    ? crew.join_policy
    : "invite_only";
  const ownerById = useMemo(
    () =>
      new Map(
        members.map((member) => [member.user_id, displayName(member.profile)]),
      ),
    [members],
  );

  const joinCrew = useCallback(async () => {
    if (
      !crew ||
      !currentUserId ||
      joining ||
      leaving ||
      !crew.is_public ||
      crew.join_policy !== "open"
    ) {
      if (!currentUserId)
        Alert.alert("Sign in required", "Sign in to join this crew.");
      return;
    }
    setJoining(true);
    const { error: joinError } = await supabase
      .from("crew_members")
      .insert({ crew_id: crew.id, user_id: currentUserId, role: "member" });
    setJoining(false);
    if (joinError && joinError.code !== "23505") {
      Alert.alert("Could not join", "This crew cannot be joined right now.");
      return;
    }
    void loadCrew(false);
  }, [crew, currentUserId, joining, leaving, loadCrew]);
  const requestJoinCrew = useCallback(async () => {
    if (!crew || !currentUserId || joining || leaving) {
      if (!currentUserId)
        Alert.alert("Sign in required", "Sign in to join this crew.");
      return;
    }
    setJoining(true);
    const { error: requestError } = await supabase.rpc(
      "noxa_request_crew_join",
      { target_crew_id: crew.id },
    );
    setJoining(false);
    if (requestError) {
      Alert.alert("Request not sent", "Please try again.");
      return;
    }
    void loadCrew(false);
  }, [crew, currentUserId, joining, leaving, loadCrew]);

  const cancelJoinRequest = useCallback(async () => {
    if (!pendingJoinRequest || joining || leaving) return;
    setJoining(true);
    const { data: ok, error: cancelError } = await supabase.rpc(
      "noxa_cancel_crew_join_request",
      { target_request_id: pendingJoinRequest.id },
    );
    setJoining(false);
    if (cancelError || ok !== true) {
      Alert.alert("Request not cancelled", "Please try again.");
      return;
    }
    void loadCrew(false);
  }, [joining, leaving, loadCrew, pendingJoinRequest]);

  const reviewJoinRequest = useCallback(
    async (joinRequestId: string, approve: boolean) => {
      if (memberActionId) return;
      setMemberActionId(joinRequestId);
      const { data: ok, error: reviewError } = await supabase.rpc(
        "noxa_review_crew_join_request",
        { target_request_id: joinRequestId, approve },
      );
      setMemberActionId(null);
      if (reviewError || ok !== true) {
        Alert.alert("Join request not updated", "Please try again.");
        return;
      }
      void loadCrew(false);
    },
    [loadCrew, memberActionId],
  );

  const leaveCrew = useCallback(() => {
    if (!crew || !currentUserId || leaving || joining || isOwner) return;
    Alert.alert("Leave crew?", `Leave ${crew.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          void (async () => {
            setLeaving(true);
            const { error: leaveError } = await supabase
              .from("crew_members")
              .delete()
              .eq("crew_id", crew.id)
              .eq("user_id", currentUserId);
            setLeaving(false);
            if (leaveError) {
              Alert.alert("Could not leave", "Please try again.");
              return;
            }
            void loadCrew(false);
          })(),
      },
    ]);
  }, [crew, currentUserId, isOwner, joining, leaving, loadCrew]);

  const escapeLike = useCallback(
    (value: string) => value.replace(/[\\%_]/g, (match) => `\\${match}`),
    [],
  );

  const searchProfiles = useCallback(async () => {
    const query = inviteQuery.trim();
    if (!crew || query.length < 2 || searching) {
      if (query.length < 2)
        Alert.alert("Search username", "Enter at least 2 characters.");
      return;
    }
    setSearching(true);
    const { data, error: searchError } = await supabase
      .from("profiles")
      .select(profileSelect)
      .ilike("username", `%${escapeLike(query)}%`)
      .limit(10);
    setSearching(false);
    if (searchError) {
      Alert.alert("Search unavailable", "Please try again.");
      return;
    }
    const memberIdsSet = new Set(members.map((member) => member.user_id));
    const pendingByUser = new Map(
      pendingInvitations.map((invite) => [invite.invited_user_id, invite.id]),
    );
    setInviteResults(
      ((data ?? []) as Profile[])
        .filter((profile) => profile.id !== currentUserId)
        .map((profile) => ({
          ...profile,
          isMember: memberIdsSet.has(profile.id),
          pendingInvitationId: pendingByUser.get(profile.id) ?? null,
        })),
    );
    setHasSearched(true);
  }, [
    crew,
    currentUserId,
    escapeLike,
    inviteQuery,
    members,
    pendingInvitations,
    searching,
  ]);

  const inviteUser = useCallback(
    async (profileId: string) => {
      if (!crew || inviteActionId) return;
      setInviteActionId(profileId);
      const { error: inviteError } = await supabase.rpc("noxa_invite_to_crew", {
        target_crew_id: crew.id,
        target_user_id: profileId,
      });
      setInviteActionId(null);
      if (inviteError) {
        Alert.alert("Invite not sent", "Please try again.");
        return;
      }
      setInviteResults([]);
      setInviteQuery("");
      setHasSearched(false);
      void loadCrew(false);
    },
    [crew, inviteActionId, loadCrew],
  );

  const cancelInvitation = useCallback(
    async (invitationId: string) => {
      if (inviteActionId) return;
      setInviteActionId(invitationId);
      const { data: ok, error: cancelError } = await supabase.rpc(
        "noxa_cancel_crew_invitation",
        { target_invitation_id: invitationId },
      );
      setInviteActionId(null);
      if (cancelError || ok !== true) {
        Alert.alert("Invitation not cancelled", "Please try again.");
        return;
      }
      void loadCrew(false);
    },
    [inviteActionId, loadCrew],
  );

  const setMemberRole = useCallback(
    (member: Member, role: "admin" | "member") => {
      if (!crew || memberActionId) return;
      const run = () =>
        void (async () => {
          setMemberActionId(member.user_id);
          const { data: ok, error: roleError } = await supabase.rpc(
            "noxa_set_crew_member_role",
            {
              target_crew_id: crew.id,
              target_user_id: member.user_id,
              target_role: role,
            },
          );
          setMemberActionId(null);
          if (roleError || ok !== true) {
            Alert.alert("Role not updated", "Please try again.");
            return;
          }
          void loadCrew(false);
        })();
      if (role === "member")
        Alert.alert(
          "Demote admin?",
          `Demote ${displayName(member.profile)} to Member?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Demote", style: "destructive", onPress: run },
          ],
        );
      else run();
    },
    [crew, loadCrew, memberActionId],
  );

  const removeMember = useCallback(
    (member: Member) => {
      if (!crew || memberActionId) return;
      Alert.alert(
        "Remove member?",
        `Remove ${displayName(member.profile)} from ${crew.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () =>
              void (async () => {
                setMemberActionId(member.user_id);
                const { data: ok, error: removeError } = await supabase.rpc(
                  "noxa_remove_crew_member",
                  { target_crew_id: crew.id, target_user_id: member.user_id },
                );
                setMemberActionId(null);
                if (removeError || ok !== true) {
                  Alert.alert("Member not removed", "Please try again.");
                  return;
                }
                void loadCrew(false);
              }),
          },
        ],
      );
    },
    [crew, loadCrew, memberActionId],
  );

  const shareCrew = useCallback(async () => {
    if (!crew || sharing) return;

    setSharing(true);
    try {
      const crewUrl = Linking.createURL(`/crew/${crew.id}`);
      const location = crew.city ? ` · ${crew.city}` : "";
      await Share.share({
        message: `${crew.name}${location}\n${crew.description ?? "Join this crew on NOXA."}\n${crewUrl}`,
        title: crew.name,
      });
    } catch {
      Alert.alert("Unable to share crew", "Please try again.");
    } finally {
      setSharing(false);
    }
  }, [crew, sharing]);

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Header
          onRefresh={() => void loadCrew()}
          onShare={() => void shareCrew()}
          refreshing={loading}
          sharing={sharing}
        />
        {loading ? <StateCard loading title="Loading crew..." /> : null}
        {!loading && error ? (
          <StateCard
            title={error}
            onRetry={isValidCrewId ? () => void loadCrew() : undefined}
          />
        ) : null}
        {!loading && !error && crew ? (
          <>
            <CrewOverview
              crew={crew}
              membersCount={members.length}
              membershipAction={
                <MembershipAction
                  effectiveJoinPolicy={effectiveJoinPolicy}
                  isMember={isMember}
                  isOwner={isOwner}
                  joining={joining}
                  leaving={leaving}
                  onCancelRequest={cancelJoinRequest}
                  onJoin={joinCrew}
                  onLeave={leaveCrew}
                  onRequestJoin={requestJoinCrew}
                  pendingJoinRequest={pendingJoinRequest}
                />
              }
              onOpenOwner={
                owner
                  ? () =>
                      router.push({
                        pathname: "/driver-profile/[id]",
                        params: { id: owner.id },
                      })
                  : undefined
              }
              owner={owner}
              vehiclesCount={vehicles.length}
            />
            <CrewQuickActions
              enabled={isMember}
              onCalendar={() =>
                router.push({ pathname: "/crew-calendar", params: { id: crew.id } })
              }
              onChat={() =>
                router.push({ pathname: "/crew-chat", params: { id: crew.id } })
              }
              onConvoy={() =>
                router.push({ pathname: "/convoy-setup", params: { id: crew.id } })
              }
              onGallery={() =>
                router.push({ pathname: "/crew-gallery", params: { id: crew.id } })
              }
              onGarage={() =>
                router.push({ pathname: "/crew-garage", params: { id: crew.id } })
              }
              onPolls={() =>
                router.push({ pathname: "/crew-polls", params: { id: crew.id } })
              }
            />
            <CrewEvents
              canCreate={canManageCrew}
              error={crewEventsError}
              events={crewEvents}
              onCreate={() =>
                router.push({ pathname: "/event-editor", params: { crewId: crew.id } })
              }
              onOpen={(eventId) =>
                router.push({ pathname: "/event-details", params: { id: eventId } })
              }
            />
            {canManageCrew ? (
              <>
                <JoinRequestsPanel
                  actionId={memberActionId}
                  onOpenProfile={(profileId) =>
                    router.push({
                      pathname: "/driver-profile/[id]",
                      params: { id: profileId },
                    })
                  }
                  onReview={(requestId, approve) =>
                    void reviewJoinRequest(requestId, approve)
                  }
                  requests={joinRequests}
                />
                <InviteManager
                  actionId={inviteActionId}
                  hasSearched={hasSearched}
                  onCancelInvitation={(invitationId) =>
                    void cancelInvitation(invitationId)
                  }
                  onChangeQuery={(value) => {
                    setInviteQuery(value);
                    setInviteResults([]);
                    setHasSearched(false);
                  }}
                  onInvite={(profileId) => void inviteUser(profileId)}
                  onOpenProfile={(profileId) =>
                    router.push({
                      pathname: "/driver-profile/[id]",
                      params: { id: profileId },
                    })
                  }
                  onSearch={() => void searchProfiles()}
                  pendingInvitations={pendingInvitations}
                  query={inviteQuery}
                  results={inviteResults}
                  searching={searching}
                />
              </>
            ) : null}
            <MemberRoster
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              isOwner={isOwner}
              memberActionId={memberActionId}
              members={members}
              onOpenMember={(memberId) =>
                router.push({
                  pathname: "/driver-profile/[id]",
                  params: { id: memberId },
                })
              }
              onRemoveMember={removeMember}
              onSetRole={setMemberRole}
            />
            <CrewGarage
              onOpenVehicle={(vehicleId) =>
                router.push({
                  pathname: "/vehicle-details",
                  params: { id: vehicleId },
                })
              }
              ownerNamesById={ownerById}
              vehicles={vehicles}
            />
          </>
        ) : null}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 126,
    gap: spacing.lg,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCopy: { flex: 1 },
  headerActions: { flexDirection: "row", gap: spacing.xs },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.sectionTitle,
    fontWeight: "900",
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  headerSubtitle: {
    marginTop: spacing.xxs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  stateCard: { gap: spacing.md, alignItems: "center" },
  stateTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "900",
    textAlign: "center",
  },
  stateText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cover: {
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverRadius: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  coverPlaceholder: { backgroundColor: colors.surfaceSoft },
  coverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,6,10,0.34)",
  },
  coverGlowLarge: {
    position: "absolute",
    right: -42,
    top: -76,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.primaryMuted,
  },
  coverGlowSmall: {
    position: "absolute",
    left: 18,
    bottom: -54,
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 24,
    borderColor: colors.primarySubtle,
  },
  heroBadges: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
  },
  policyBadge: {
    minHeight: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(6,6,10,0.76)",
  },
  policyBadgeText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  heroContent: {
    gap: spacing.lg,
    padding: spacing.md,
  },
  heroIdentityRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    marginTop: -46,
  },
  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 3,
    borderColor: colors.surface,
    overflow: "hidden",
  },
  logo: { width: "100%", height: "100%" },
  logoInitials: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    fontWeight: "900",
  },
  heroIdentityCopy: { flex: 1, minWidth: 0, paddingBottom: spacing.xxs },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: "900",
    letterSpacing: 0.2,
    lineHeight: typography.lineHeight.h2,
    textTransform: "uppercase",
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    marginTop: 2,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  statsStrip: {
    minHeight: 72,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: spacing.sm,
  },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  statValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 25,
  },
  statLabel: {
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  ownerRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  ownerLabel: {
    color: colors.primaryHover,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  membershipAction: { gap: spacing.sm },
  quickActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickAction: {
    width: "30%",
    flexGrow: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickActionDisabled: { opacity: 0.56 },
  quickActionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  quickActionLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  quickActionLabelDisabled: { color: colors.textSubtle },
  quickActionHint: {
    marginTop: spacing.sm,
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  ownerStatus: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  ownerStatusCopy: { flex: 1 },
  ownerStatusTitle: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  ownerStatusText: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },
  personCopy: { flex: 1, gap: 2 },
  personName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  personMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  sectionBlock: { gap: spacing.sm },
  sectionHeading: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  sectionHeadingCopy: { flex: 1 },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  sectionCaption: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  countPill: {
    minWidth: 30,
    minHeight: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  countPillText: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  emptyPanel: {
    minHeight: 94,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rosterCard: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  memberItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  memberItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  memberMainRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
  },
  memberActionBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingLeft: 58,
  },
  roleAction: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  promoteAction: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  removeAction: { borderColor: colors.borderAccent },
  roleActionText: { color: colors.textMuted, fontSize: 10, fontWeight: "900" },
  promoteActionText: { color: colors.primaryHover, fontSize: 10, fontWeight: "900" },
  removeActionText: { color: colors.primaryHover, fontSize: 10, fontWeight: "900" },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 22,
  },
  eventsHeadingRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  eventsHeadingContent: { flex: 1 },
  createEventButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  eventsCard: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  eventRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eventRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  eventDateTile: {
    width: 48,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  eventDateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 23,
  },
  eventDateMonth: { color: colors.primaryHover, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  eventTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "900" },
  eventMeta: { marginTop: spacing.xxs, color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  managementEmpty: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  managementEmptyText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  managementCard: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  managementRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  managementRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  managementProfile: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  requestActionBar: { flexDirection: "row", gap: spacing.xs },
  iconDecisionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
  },
  approveButton: { borderColor: colors.primary, backgroundColor: colors.primary },
  rejectButton: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSoft },
  inviteCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchRow: { flexDirection: "row", gap: spacing.xs },
  searchInputShell: {
    minHeight: 46,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  searchButton: {
    minWidth: 82,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  searchButtonText: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  searchEmpty: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  inviteList: {
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  inviteListLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  inviteRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inviteButton: {
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  inviteButtonDisabled: { borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  inviteButtonText: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  inviteButtonDisabledText: { color: colors.textMuted },
  cancelInviteButton: {
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  cancelInviteText: { color: colors.primaryHover, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  garageRail: { gap: spacing.md, paddingRight: spacing.lg },
  garageCard: {
    width: 224,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  garageImage: {
    width: "100%",
    height: 124,
    backgroundColor: colors.surfaceSoft,
  },
  garagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  garageCardBody: { gap: 2, padding: spacing.md },
  garageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: "900",
    lineHeight: typography.lineHeight.subtitle,
    textTransform: "uppercase",
  },
  garageOwner: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  garageMetaRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  garageMeta: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
