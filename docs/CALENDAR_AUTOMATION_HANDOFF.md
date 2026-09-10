# Calendar, Event Automation & Google Calendar — Handoff Requirements

## Purpose and relationship to the current product

This is an additive extension to the existing Clinic Tracking Leads baseline.
It expands the current appointment view and operational dashboard into a
calendar and event-automation capability. It must **not** replace or merge the
existing `Patient`, `Case`, `Follow-up Task`, `Follow-up Record`, or
`Appointment` concepts.

**Supersession note (11 September 2026):** the in-app calendar and Google
Calendar synchronisation for appointments and follow-up tasks are now pulled
forward into the active baseline. SMS/LINE delivery and rule automation remain
deferred. Implement calendar work behind provider adapters so
the manual appointment and follow-up flows continue to work when no external
provider has been connected.

## Goals

1. Give staff one calendar for appointments, follow-up tasks, and operational
   events.
2. Automatically create and deliver appropriate reminders and greetings by
   SMS or LINE OA.
3. Synchronise eligible appointments/events with a configured Google Calendar.
4. Keep a complete, privacy-safe audit trail of automation and delivery
   outcomes.

## Functional scope

### 1. Unified calendar

Provide day, week, and month views, with filters for branch, assigned staff,
event type, and status. Calendar items include:

- Existing patient appointments.
- Existing due and scheduled follow-up tasks.
- Internal clinic events: meetings, staff shifts, closures/holidays, and
  manually created events.
- Patient lifecycle events: birthday greetings, post-treatment follow-ups,
  reminder campaigns, and other configured automation events.

Selecting an item must open the linked Case/Patient/Appointment or Event
detail. The calendar must visibly distinguish appointment, follow-up,
internal, and automated patient events, and must display all dates in the
clinic time zone (initially `Asia/Bangkok`).

### 2. Dashboard extension

Add an operational calendar panel and metrics for:

- Today’s appointments, confirmations pending, cancellations, and no-shows.
- Due/overdue follow-ups (reuse existing workflow data).
- Automations scheduled today, delivered, failed, suppressed, and awaiting
  review.
- Upcoming clinic events and calendar-sync errors.

Do not expose sensitive symptoms, clinical notes, or raw integration payloads
in dashboard cards or notification previews.

### 3. Event and automation rules

An authorised admin/manager can create, enable, pause, edit, and retire a
rule. A rule has a trigger, eligibility conditions, schedule, channel order,
message template, and owner. Seed/use cases:

- Appointment reminder: for example 24 hours and 2 hours before a confirmed
  appointment.
- Birthday greeting: once a year on the patient’s birthday.
- Post-treatment / return-visit reminder: relative to an appointment or a
  completed follow-up record.
- Callback/follow-up reminder: linked to a Case/Follow-up Task.
- Internal event: staff meeting, shift, closure, or holiday; no patient
  message by default.
- Campaign/offer: only for an explicitly eligible and contactable audience.

Rules may be one-time or recurring (daily, weekly, monthly, yearly, or a
relative offset). Generated work must be stored as an immutable event/dispatch
instance; editing a rule changes only future instances unless an authorised
user explicitly regenerates them.

### 4. SMS and LINE OA delivery

Support both channels through adapters; no provider-specific API details may
leak into core workflow logic.

- Each rule defines its allowed channel(s), ordered fallback policy, sender/
  provider account, template, and quiet hours.
- Route to the patient’s verified/preferred contact endpoint only.
- Before every outbound attempt, enforce `do_not_contact`, consent/purpose,
  valid destination, quiet hours, and provider eligibility. The most
  restrictive contact preference wins after a patient merge.
- Store `Queued`, `Sent`, `Delivered` (where supported), `Failed`, `Skipped`,
  `Suppressed`, and `Needs review` statuses, timestamps, provider message ID,
  and a safe failure reason.
- A failure must not silently create a duplicate message. Retries use a stable
  idempotency key and a documented retry/back-off policy.
- Template previews must use only the minimum necessary patient data. Never
  include symptoms, diagnosis, or sensitive clinical notes in SMS/LINE OA
  content.

The default appointment reminder must not claim a booking is confirmed unless
the linked Appointment status is `Confirmed`.

### 5. Google Calendar integration

Use Google OAuth 2.0 and the Google Calendar API. An authorised manager/admin
connects a clinic Google account, selects a destination calendar, and can
disconnect/re-authorise it. Store encrypted tokens/secrets and connection
metadata; never expose tokens in the UI or logs.

Initial sync policy:

- **Outbound is the source of truth:** Clinic `Appointment` and approved
  internal `Calendar Event` records create/update/cancel corresponding Google
  events.
- Link every synced record to `google_calendar_id`, `google_event_id`, last
  synced version/etag, and sync timestamps.
- Do not create a second Google event on retry; use the persisted external
  event ID/idempotency key.
- A cancellation or reschedule in the clinic must update the linked Google
  event. Preserve sync/audit history.
- Google-originated events may be shown as read-only `External calendar` items
  after import. They must not create Patient, Case, Appointment, or outbound
  communication records automatically.
- Two-way editing of clinic-owned appointments from Google is deferred. Detect
  external edits/deletions and mark them `Needs review` rather than overwriting
  clinic data silently.

The UI needs connection status, selected calendar, last successful sync,
pending/failed sync count, manual retry, and safe error details.

## Additive domain model

Use UUIDs, UTC storage, and clinic-local display rules consistent with the
existing specification.

### CalendarEvent

`id`, `event_type` (`Appointment`, `FollowUp`, `Internal`, `Automation`,
`ExternalCalendar`), `title`, `starts_at`, `ends_at`, `all_day`, `timezone`,
`status`, `patient_id` (nullable), `case_id` (nullable), `appointment_id`
(nullable), `follow_up_task_id` (nullable), `owner_staff_id` (nullable),
`branch_id` (nullable), `source`, `external_provider`, `external_calendar_id`,
`external_event_id`, `sync_state`, audit fields.

Avoid duplicating canonical appointment and follow-up fields. It is acceptable
to model these calendar items as query projections over the current records;
`CalendarEvent` is required for standalone/internal/automation/external items.

### AutomationRule

`id`, `name`, `event_type`, `trigger_type`, `trigger_reference`,
`eligibility_definition`, `schedule_definition`, `timezone`, `active`,
`channel_policy`, `template_id`, `quiet_hours_policy`, `owner_staff_id`,
`created_by`, audit fields.

### AutomationInstance

`id`, `automation_rule_id`, `patient_id` (nullable for internal events),
`case_id`, `appointment_id`, `calendar_event_id`, `scheduled_for`, `status`,
`suppression_reason`, `idempotency_key`, `created_at`, completion/audit fields.

### MessageTemplate and MessageDispatch

`MessageTemplate`: `id`, `name`, `channel`, approved content, allowed merge
variables, `active`, version and audit fields.

`MessageDispatch`: `id`, `automation_instance_id`, `patient_id`, `channel`,
`provider`, `provider_account_id`, safe rendered-content snapshot or template
reference (per privacy policy), destination reference (not unnecessarily
exposed), `status`, `provider_message_id`, `attempt_count`, `idempotency_key`,
timestamps, safe error code/message, audit fields.

### CalendarConnection and CalendarSyncLog

`CalendarConnection`: provider (`google_calendar`), owner/clinic scope,
selected external calendar ID, encrypted credential reference, status, scopes,
last successful sync, audit fields.

`CalendarSyncLog`: connection ID, local entity reference, direction, operation,
external event ID, outcome, idempotency key, safe error details, timestamps.

## Roles and privacy

- Admin/coordinator: create/edit internal events, appointments, event rules
  permitted by policy; review deliveries/sync errors.
- Manager/owner: configure templates, providers, consent-safe communication
  policy, Google connection, and approval workflows.
- System administrator: technical provider configuration only; does not gain
  clinical-data access by default.

Apply existing role-based access, audit history, patient merge rules, and PDPA
constraints. Birthday/campaign automation requires a valid contact basis and
must honour opt-out immediately. Retain a log of the decision to suppress a
message without revealing private data broadly.

## Key acceptance criteria

1. A confirmed appointment appears once in the unified calendar and can be
   synced once to Google Calendar; retries do not duplicate it.
2. Rescheduling/cancelling an appointment updates the same linked Google event
   and retains the original appointment/sync audit history.
3. A birthday rule generates no more than one eligible greeting per patient per
   calendar year, honours do-not-contact/consent, and records a safe outcome.
4. A failed LINE OA/SMS dispatch is visible in the dashboard and can be safely
   retried without sending a duplicate.
5. Existing follow-up tasks and manual appointments remain fully functional
   with no external provider configured.
6. A Google-originated external event cannot silently create or alter a
   patient, case, appointment, or outbound message.
7. The calendar and all scheduled automations respect Asia/Bangkok date/time
   and configured quiet hours.
8. All rule edits, manual sends/retries, connection changes, and sync actions
   are auditable with actor and timestamp.

## Implementation order

1. Add/reuse the unified calendar read model and calendar/dashboard UI using
   existing mock data; preserve the existing appointment screen as a drill-in.
2. Add domain types and persistence/service boundaries for rules, instances,
   dispatches, connections, and sync logs.
3. Implement internal/manual events and rule execution with a testable clock.
4. Add consent/suppression checks, templates, dispatch queue, observability,
   and a mock SMS/LINE adapter for end-to-end tests.
5. Add Google OAuth/settings and outbound event sync with idempotency.
6. Add read-only import/conflict review for Google-originated changes.

## Decisions still required from the clinic

1. SMS provider and approved sender name.
2. LINE OA account/channel and whether messaging consent is captured per
   marketing versus service-reminder purpose.
3. Exact reminder lead times, quiet hours, retry limits, and escalation owner.
4. Whether birthday messages include a promotion/coupon (this changes consent
   and approval requirements).
5. Which clinic Google account/calendar is authoritative, and whether external
   Google events should be visible to all staff or selected roles only.
6. Appointment collision rules for provider, room, branch, and duration.
