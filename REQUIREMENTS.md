# Clinic Tracking Leads — Requirements for Phase 1

> **Document purpose:** handoff specification for implementing the Phase 1 clinic lead/patient follow-up system.  
> **Status:** implementation-ready draft for product and implementation alignment  
> **Primary language:** Thai user interface; field/API names may use English.

## 1. Product goal

Build an internal operations system that prevents clinic leads and patients from being missed after first contact. It must give the admin team one place to register incoming leads, hand off call information to nurses, record the nurse's outcome, schedule a systematic series of follow-ups, and create appointments when appropriate.

Lead sources include **Facebook, LINE OA, TikTok, and Phone**. In Phase 1, users enter information manually. The data model and source/channel handling must be designed so official integrations can later create or update the same records without a redesign. Future clinic/HIS integration must be able to attach and validate an HN without making it mandatory at intake.

The system is a workflow and tracking tool, not a clinical record/EHR. Medical data captured in Phase 1 should be limited to information needed for service triage and follow-up, with role-based access and an audit trail.

## 2. Phase 1 scope

### In scope

- Manual creation and search of people/leads from all supported channels.
- Create and manage a lead/case, including service interest, symptoms/concern, contact details, channel, owner, and current workflow status.
- Admin-to-nurse call handoff and structured return of the nurse's call summary.
- Configurable follow-up plans; seed a Standard plan of day **1, 3, 7, 14, 30**.
- Automatic generation of follow-up tasks from the selected plan and case start date.
- Queue of due, overdue, and upcoming follow-up tasks; assignment and reassignment.
- Record the result of each follow-up without overwriting the original patient/case details.
- Create and manage appointments linked to the follow-up that led to them.
- Continue the remaining follow-up sequence after an appointment is created, attended, cancelled, or missed.
- Basic operational dashboard: new leads, due/overdue tasks, completed contacts, and appointments by status/date.
- User/staff management sufficient for assignment, visibility, and audit fields.

### Explicitly out of scope for Phase 1

- Direct ingestion or messaging through Facebook, LINE OA, TikTok, phone/CTI, SMS, or calendar providers.
- Automated outbound reminders, chatbot responses, and message templates.
- Full EMR/clinical documentation, billing, inventory, prescriptions, and treatment workflow.
- Advanced reporting, marketing attribution, or deduplication automation (manual duplicate review is acceptable).
- A fixed, non-editable set of follow-up intervals.

## 3. Users and responsibilities

| Role | Primary responsibility | Typical permissions |
|---|---|---|
| Admin / coordinator | Receive lead, enter information, relay information to nurse, record nurse's outcome, manage follow-up and appointments | Create/edit people and cases; create and complete follow-ups on behalf of another staff member; create/edit appointments |
| Nurse | Assess by phone, provide a call summary and next action | View assigned cases/tasks; provide call outcome; recommend appointment/escalation |
| Manager / clinic owner | Monitor service operations and exceptions | View all records/dashboard; configure plans, channels, and staff; audit history |
| System administrator | Account and reference-data administration | Manage users/roles/configuration; no additional clinical authority implied |

Phase 1 must support the common operating model in which the **admin records a nurse's spoken or chat-based summary**. The record must preserve both the nurse responsible for the call and the admin who entered it.

## 4. End-to-end workflow

1. A lead arrives via Facebook, LINE OA, TikTok, or Phone.
2. Admin creates or finds the person, then opens a new case/lead and records the inbound channel, contact details, service interest, symptoms/concern, and notes.
3. Admin assigns/relays the case information to a nurse for an initial call. The case becomes `Awaiting nurse call` (or equivalent).
4. Nurse calls and gives the outcome back to admin. Admin records it as a contact/follow-up record, attributing the clinical/call outcome to the nurse and the data entry to admin.
5. The selected follow-up plan creates scheduled tasks at the configured offsets from the case's `follow_up_start_date` (normally the initial contact/case date).
6. For each due task, staff records the contact attempt and outcome. The system preserves the task and creates/updates its follow-up record rather than replacing patient/case data.
7. If the outcome requires a visit, staff chooses **Save and create appointment**. The appointment retains a reference to the originating follow-up.
8. Appointment staff update the appointment status. The case's future follow-up tasks remain active unless a user explicitly pauses, cancels, or closes the case/plan.
9. At day 30 (or the final active plan step), staff closes the follow-up cycle only after recording its final outcome, or extends/selects another plan if required.

## 5. Data model

Use immutable IDs (UUIDs recommended). Do not use name or phone number as an identifier. Timestamps should be stored in UTC and displayed in the clinic's configured time zone (initially Asia/Bangkok).

### 5.1 Patient / Person

Represents a real individual and may have multiple cases over time. A person may initially be only a lead and later receive an HN.

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Internal immutable ID |
| `hn` | No | Optional Hospital Number; unique when supplied according to clinic policy |
| `first_name`, `last_name` | Yes | May be stored as a full display name if local workflow requires |
| `phone` | Yes, if available | Normalized format plus original display value; required when phone is the contact method |
| `line_user_id` | No | Reserved for future LINE identity/integration; do not rely on it in Phase 1 |
| `facebook_profile_ref`, `tiktok_profile_ref` | No | External profile reference/handle where available |
| `preferred_contact_channel_id` | No | Reference to Channel |
| `date_of_birth`, `sex` | No | Only if necessary and approved by clinic policy |
| `consent_contacted_at`, `do_not_contact` | No | Future-ready communication consent/suppression fields |
| `created_at`, `created_by`, `updated_at`, `updated_by` | Yes | Standard audit fields |

### 5.2 Lead / Case

Represents one service enquiry or care-follow-up episode. A patient can have many cases; every follow-up and appointment belongs to a case.

| Field | Required | Notes |
|---|---:|---|
| `id`, `case_number` | Yes | Internal ID and human-readable reference |
| `patient_id` | Yes | Parent person |
| `source_channel_id` | Yes | Where this case first arrived |
| `source_received_at` | Yes | Original inbound date/time |
| `service_interest` | Yes | Free text or service catalog reference; Phase 1 can start with text |
| `symptoms_or_concern` | Yes | Summary of symptom, concern, or request; do not force diagnosis |
| `initial_note` | No | Context supplied with the lead |
| `status` | Yes | See status set below |
| `priority` | Yes | `Low`, `Normal`, `High`, `Urgent`; high/urgent appears prominently in queues |
| `assigned_nurse_id` | No | Nurse responsible for initial/clinical call |
| `owner_staff_id` | No | Operational owner; may be admin or nurse |
| `follow_up_plan_id` | No | Chosen plan; may be absent until plan is selected |
| `follow_up_start_date` | No | Anchor date for plan offsets; default to case creation/initial contact date, editable with audit reason |
| `closed_at`, `closed_by`, `closure_reason` | No | Set only when closed |
| audit fields | Yes | As above |

Suggested case statuses: `New`, `Awaiting nurse call`, `Contact in progress`, `Follow-up active`, `Appointment scheduled`, `Closed - converted`, `Closed - not interested`, `Closed - unreachable`, `Closed - cancelled`, `Closed - other`. Keep appointment status separate; `Appointment scheduled` is a useful current-case summary, not a replacement for the appointment record.

### 5.3 Channel

Configurable reference data for source and contact channels.

| Field | Required | Notes |
|---|---:|---|
| `id`, `name`, `code` | Yes | Seed `Facebook`, `LINE OA`, `TikTok`, `Phone`; optionally `Walk-in`, `Website`, `Other` |
| `channel_type` | Yes | `Source`, `Contact`, or `Both` |
| `active` | Yes | Inactive channels remain visible on historical records |
| `external_provider`, `external_account_ref` | No | Future integration configuration/reference |
| audit fields | Yes | |

**Important:** `source_channel_id` answers “where did this case first come from?” and is normally set once. `contact_channel_id` on a Follow-up Record answers “how did staff communicate on this particular attempt?” These must be separate fields; for example, a Facebook lead can be called by Phone and later followed up through LINE OA.

### 5.4 External Identity

Represents a platform-specific identity belonging to a patient/person. It is intentionally separate from Person so one person can have multiple identities and provider identifiers never become the primary internal identifier.

| Field | Required | Notes |
|---|---:|---|
| `id`, `patient_id` | Yes | Internal ID and parent person |
| `platform` | Yes | Controlled enum: `facebook`, `line_oa`, `tiktok`, `phone`, `his`, `other` |
| `external_user_id` | No in Phase 1; Yes when received from integration | Stable provider identity where supplied: LINE user ID, Facebook PSID, TikTok user ID, HIS patient ID, etc. |
| `external_username`, `external_display_name` | No | Provider handle/name; neither is a stable identifier |
| `external_profile_image_url` | No | Provider profile image URL; treat as cacheable external metadata |
| `external_account_id` | No | Page, OA, TikTok account, phone system, or HIS tenant/account reference that scoped the identity |
| `identity_verified_at`, `identity_verified_by` | No | Optional human verification for manual matching |
| `active` | Yes | Retain inactive identities for history |
| `created_at/by`, `updated_at/by` | Yes | Audit fields |

Constraint: make `(platform, external_account_id, external_user_id)` unique when `external_user_id` is present. Do not make a username/display name unique.

### 5.5 Integration Event / External Message

Stores integration transport facts and raw payloads outside the core clinical/workflow records. Phase 1 does not need a connector or live credentials, but the schema/service boundary must support this entity before an integration is added.

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Internal immutable ID |
| `provider` | Yes | `facebook`, `line_oa`, `tiktok`, `phone`, `his`, or another configured provider |
| `event_type` | Yes | e.g. `message_received`, `lead_created`, `call_completed`, `patient_updated` |
| `webhook_event_id` | No | Provider delivery/event ID; mandatory when the provider supplies one |
| `external_message_id` | No | Provider message/call record ID |
| `external_conversation_id` | No | Provider conversation/thread ID |
| `external_user_id` | No | Identity observed in the payload, prior to resolution |
| `external_account_id` | No | Receiving page/OA/account/tenant |
| `patient_id`, `case_id`, `external_identity_id`, `follow_up_record_id` | No | Links populated after resolution; do not require them for rejected/unresolved events |
| `received_at`, `processed_at` | Yes / No | Receipt and processing times |
| `sync_status` | Yes | `Received`, `Processing`, `Processed`, `Ignored`, `Failed`, `Needs review` |
| `sync_error_code`, `sync_error_message` | No | Safe diagnostic text; never expose raw sensitive payloads in a normal UI |
| `raw_payload` | No | Original JSON, encrypted/restricted by policy; never used as the source of truth after mapping |
| `payload_hash`, `idempotency_key` | Yes | Used to detect duplicate deliveries/retries |
| `created_at`, `updated_at` | Yes | Audit fields |

Constraint: enforce uniqueness of `idempotency_key`; use provider + account + webhook event ID when available, otherwise a documented deterministic key such as provider + account + message/event ID. Persist a failed/duplicate event for audit rather than creating duplicate domain records.

### 5.6 Staff / User

| Field | Required | Notes |
|---|---:|---|
| `id`, `display_name`, `role`, `active` | Yes | Roles from section 3 |
| `phone`, `email` | No | Operational contact |
| `created_at`, `updated_at` | Yes | |

Authentication implementation is a technical decision, but business records must reference staff by `id`, never only a display name.

### 5.7 Follow-up Plan and Plan Step

The plan is configuration, not code. A plan has one or more ordered day-offset steps.

**Follow-up Plan:** `id`, `name`, `description`, `active`, `is_default`, `created_at/by`, `updated_at/by`.

**Follow-up Plan Step:** `id`, `plan_id`, `sequence`, `day_offset`, `label`, `active`, `default_assignee_role` (optional), audit fields.

Seed plan:

| Sequence | Label | `day_offset` |
|---:|---|---:|
| 1 | Day 1 | 1 |
| 2 | Day 3 | 3 |
| 3 | Day 7 | 7 |
| 4 | Day 14 | 14 |
| 5 | Day 30 | 30 |

### 5.8 Follow-up Task

Represents planned operational work. It is created from a plan step or manually, and can exist before a contact is actually made.

| Field | Required | Notes |
|---|---:|---|
| `id`, `case_id` | Yes | Parent case |
| `plan_step_id` | No | Null for ad-hoc tasks |
| `sequence`, `scheduled_for` | Yes | Scheduled date/time derived from the plan anchor; sequence must be unique per case/plan cycle |
| `assigned_to_id` | No | Staff assignment |
| `status` | Yes | `Pending`, `In progress`, `Completed`, `Skipped`, `Cancelled`, `Overdue` (computed display state is preferred for overdue) |
| `priority`, `task_note` | No | Work instruction/context |
| `completed_at`, `completed_by` | No | Completion metadata |
| `cancelled_at/by`, `cancellation_reason` | No | Preserve cancelled task history |
| audit fields | Yes | |

### 5.9 Follow-up Record / Contact Attempt

Represents what actually happened during a follow-up. Keep it separate from both Case and Follow-up Task. A task may have multiple attempts, while a completed task needs at least one completed/contact record.

| Field | Required | Notes |
|---|---:|---|
| `id`, `case_id` | Yes | Parent case |
| `follow_up_task_id` | No | Required for scheduled-task results; nullable only for an explicitly ad-hoc contact |
| `contacted_at` | Yes | Actual attempt/contact time |
| `contact_channel_id` | Yes | Channel used for this attempt |
| `contact_status` | Yes | `Reached`, `No answer`, `Wrong number`, `Requested callback`, `Message sent`, `Other` |
| `outcome` | Yes | `Interested`, `Needs information`, `Appointment requested`, `Appointment booked`, `Not interested`, `Refer to clinician`, `Unreachable`, `Other` |
| `symptom_status` | No | `Improved`, `Same`, `Worse`, `Not assessed`; use only when relevant |
| `summary_note` | Yes | Structured narrative summary of the contact/call |
| `next_action` | Yes | `Retry contact`, `Create appointment`, `Continue plan`, `Escalate`, `Close case`, `No action` |
| `next_contact_at` | No | For a callback/ad-hoc task; does not alter plan steps automatically |
| `performed_by_staff_id` | Yes | Nurse/caller who performed or owns the contact |
| `entered_by_staff_id` | Yes | Admin/user who keyed the record; same as performer when self-entered |
| `entered_on_behalf_of` | Yes | Boolean; true when admin records nurse's outcome |
| audit fields | Yes | |

### 5.10 Appointment

| Field | Required | Notes |
|---|---:|---|
| `id`, `appointment_number` | Yes | Internal and human-readable references |
| `patient_id`, `case_id` | Yes | Parent person and originating case |
| `source_follow_up_record_id` | No | Required when created from a follow-up; nullable only for a direct/manual appointment |
| `scheduled_start_at`, `scheduled_end_at` | Yes | Clinic-local appointment time shown in UI; stored safely with timezone |
| `appointment_type` | Yes | e.g. `Doctor consultation`, `Treatment consultation`, `Follow-up visit` |
| `branch_id` | No for Phase 1 | Include if more than one branch is expected; otherwise use configurable clinic default |
| `provider_staff_id` | No | Doctor/nurse if assignment is known |
| `status` | Yes | `Pending confirmation`, `Confirmed`, `Completed`, `Cancelled`, `No-show`, `Rescheduled` |
| `note` | No | Booking details |
| `created_by`, `updated_by`, timestamps | Yes | Audit |

**Relationship summary**

```text
Patient (1) ──< Case (many) ──< Follow-up Task (many) ──< Follow-up Record / attempts (many)
                                 │                                      │
                                 └── follows one Plan Step              └──< Appointment (0..many)

Case (many) ── uses one Follow-up Plan; Follow-up Plan (1) ──< Plan Steps (many)
Staff/User ── assigned to and attributed on cases, tasks, records, and appointments
Channel ── used as case source and contact method
Patient (1) ──< External Identity (many); Integration Event may link to Identity, Patient, Case, and Contact record
```

## 6. Business rules

1. A **case is not the same as a patient**. The same patient may have repeated enquiries/treatments and separate follow-up cycles.
2. Select a follow-up plan per case; create tasks from the active plan steps when the plan and anchor date are set. Never hard-code `1, 3, 7, 14, 30` in business logic or UI.
3. The due date for a step is `follow_up_start_date + day_offset`, interpreted in the clinic time zone. Define whether the task time defaults to opening time or a configurable time; see open decisions.
4. Historical task dates must not silently change if the plan configuration later changes. Snapshot the applicable step details onto the task at generation time, or version plans.
5. A follow-up result must be stored as a Follow-up Record. Editing a case must not erase contact history.
6. Completing a task requires a follow-up record or an explicit skip/cancel reason. A no-answer attempt may leave the task open and create a retry/ad-hoc task according to the selected next action.
7. `Overdue` is calculated from `scheduled_for` for any pending/in-progress task past its due time. It should not replace the persisted task lifecycle status unless the technical design intentionally supports it.
8. When admin enters a nurse's call outcome, save `performed_by_staff_id` as the nurse, `entered_by_staff_id` as admin, and set `entered_on_behalf_of = true`.
9. Creating an appointment from a follow-up must copy `patient_id` and `case_id` and set `source_follow_up_record_id`. The user must be able to reach the source follow-up from the appointment view and vice versa.
10. Creating, confirming, completing, cancelling, or missing an appointment does **not** automatically cancel the case's future follow-up tasks. Only an explicit user action, case closure, or agreed configuration may do that.
11. A case may have zero or many appointments; a follow-up record may lead to zero or many appointments where rescheduling/new bookings need history. Do not force a one-to-one relationship.
12. Closed cases are read-only for ordinary workflow edits, except authorised staff may correct or reopen with an auditable reason. Preserve all related history.
13. Validate date/time order, required contact method when attempting contact, active assignees, and sensible status transitions. Warn on probable duplicate people (same normalized phone and/or HN); do not silently merge in Phase 1.
14. Protect sensitive information: least-privilege access, no sensitive notes in broad notifications, and audit create/update/status transitions. Retention, consent, and Thai PDPA policy require clinic approval.
15. The manual UI and every future connector must invoke the same domain-level create/update services and validation rules. A connector must not write directly to the Case, Follow-up Record, or Appointment tables.
16. Inbound integration events are append-only audit records. Processing a duplicate event must be safe: return the original result or mark the event ignored, and never create another patient, case, contact record, or appointment.
17. `raw_payload` is restricted operational data. It must be encrypted or access-controlled, redacted from ordinary timelines/logs, and retained only under the clinic's approved policy.
18. HN is optional for manual lead intake. When supplied it must be normalized according to the clinic/HIS policy, checked for a possible match, and never silently overwrite an existing HN or patient link.

## 7. Required screens and key interactions

### A. Work queue / “My leads”

- Show each assignee's due, overdue, and upcoming follow-up tasks; default sort: overdue, due today, then scheduled date/priority.
- Show patient name, case/service, source channel, task label/day, due date/time, owner, current case status, and quick priority indicator.
- Filter by owner, status, channel, plan, due range, and priority; search by name, HN, phone, and case number.
- Permit reassignment and opening the case detail.

### B. New lead/case registration

- Find an existing person first, then create/select a person and open a case.
- Capture HN if available but do not require it; capture name, at least one contact route where available, source channel, source time, service interest, and symptoms/concern.
- Assign nurse/owner, choose the plan, set its anchor date, and show the generated schedule for confirmation.
- Support admin's manual input for all inbound sources.

### C. Case detail

- Display immutable identity/contact summary, case summary/status, assigned staff, plan and next due task.
- Timeline must combine case events, follow-up tasks/records, and appointments in chronological order, clearly identifying who performed versus who entered a record.
- Provide actions: record follow-up, add ad-hoc task, reassign, pause/cancel task with reason, choose/change plan under auditable rules, create appointment, and close/reopen case.

### D. Record follow-up

- Start from a task, prefill case/person context and scheduled step, then capture channel, actual time, contact status, outcome, symptom status (if applicable), summary, next action, next contact time (if applicable), performer, and data-entry user.
- Offer **Save follow-up and create appointment** when the selected outcome/next action requires a visit.
- When a nurse reported the outcome offline, the admin can select that nurse as performer; UI must make “entered on behalf of” visible.

### E. Appointment calendar/list

- Calendar and list views with date, status, patient, case/service, provider, and source follow-up link.
- Create from a follow-up or directly from a case; update confirmation, completion, cancellation, no-show, and reschedule history.
- Surface appointments independently from follow-up queues without hiding the next scheduled follow-up.

### F. Configuration and dashboard

- Manager-managed follow-up plans/steps, channels, users/roles, and (if used) service/appointment type lists.
- Dashboard figures must use defined date ranges and filterable clinic/owner scope. Minimum: new cases, contacts completed, due/overdue follow-ups, and appointments by status.

### G. Integration monitoring (schema/API readiness only in Phase 1)

- No live integration UI, credentials, webhook endpoint, or outbound send is required in Phase 1.
- Provide a restricted manager/admin view or technical diagnostic endpoint capable of listing integration events by provider, status, receipt time, external conversation/message ID, linked case, and error state once integrations exist.
- Normal case timelines may show a concise mapped event (for example, “Facebook message received”) but must not expose `raw_payload` by default.

## 8. Future integration readiness

- Create an integration boundary/adaptor per channel. An inbound payload should map to `External Identity`, `Patient` (find/create or flag for review), `Case` (create/update according to rules), `Channel`, and `Integration Event` without coupling domain tables to vendor-specific schemas.
- Keep provider/account/conversation/message/event IDs, sync state, import timestamps, and `raw_payload` in the Integration Event table. Avoid treating a social handle as a stable patient identity.
- Make inbound processing idempotent using a stored idempotency key and provider/event IDs to avoid duplicate cases on retry.
- Resolve a person in this order: a verified platform identity scoped to the provider account; approved HIS/HN mapping; normalized phone; then a manual-review queue. Never auto-merge solely from display name or username.
- Preserve both the original source attribution and the communication channel: integrations may add message/contact records but must not rewrite the original `source_channel_id` without an auditable correction.
- Integration adapters should emit normalized commands/events (`InboundMessageReceived`, `InboundLeadReceived`, `CallCompleted`, `PatientUpdated`) and map them through the domain service; provider payload objects must not leak into UI or core workflow APIs.
- Future outbound contact automation should create Follow-up Records/communication events against existing tasks rather than write directly to case notes.
- Telephone integration may later supply call metadata; it must still preserve the staff-attributed outcome and manually editable clinical summary.
- Calendar/LINE reminders should subscribe to appointment/task status changes through events; do not embed vendor calls inside core workflow transactions.
- Anticipate mapping/consent requirements for personal data before enabling each integration.

## 9. Acceptance criteria

1. Admin can create a manual lead from each seeded channel and either link it to an existing patient or create a new patient without HN.
2. A new case captures service interest and symptoms/concern, can be assigned to a nurse, and clearly appears as awaiting the nurse call.
3. Admin can save a nurse's reported call outcome while the system shows the nurse as performer and admin as the person who entered it.
4. Selecting the Standard plan creates exactly five tasks at day offsets 1, 3, 7, 14, and 30 from the chosen anchor date.
5. A manager can create/change a plan step without code changes, and new cases/tasks use the configured values; historical generated tasks retain their original schedule.
6. Work queues correctly distinguish overdue, due today, and future pending tasks and support staff assignment/filtering.
7. Completing a follow-up preserves the task and produces a dated, attributable record in the case timeline; case details and prior records remain intact.
8. From a follow-up outcome marked for appointment, staff can save the record and create an appointment in one continuous flow. The saved appointment links back to that follow-up and the patient/case.
9. After an appointment is confirmed, completed, cancelled, or no-show, the case's later plan tasks remain visible/active unless staff explicitly changes their status or closes the case.
10. A case can have multiple follow-up records and appointments; all records are accessible from its timeline.
11. Status changes, creation, updates, performer, and data-entry user have timestamps and user attribution; closed/cancelled records remain auditable.
12. No Phase 1 workflow requires live credentials or a live connection to Facebook, LINE OA, TikTok, or telephone systems.
13. The schema can store two external identities for the same patient (for example Facebook PSID and LINE user ID) without duplicating the patient or case.
14. The system can store an external conversation ID, message ID, webhook event ID, sync status, and restricted raw payload for a future inbound event; duplicate delivery of the same idempotency key does not create another domain record.
15. A Facebook-sourced case may have a Phone contact record without changing its original Facebook source attribution.
16. Manual intake accepts a blank HN; an entered HN produces a duplicate warning when it matches another person and requires the user to choose an auditable action.

## 10. Decisions still needed before build

| Decision | Why it matters | Recommended default for Phase 1 |
|---|---|---|
| What exactly starts Day 0? | Determines every plan due date | Case/source received date, with an auditable override when the first clinical call starts the plan |
| Due time and holiday/weekend policy | Determines when a task becomes due/overdue | Configurable default time; do not skip weekends/holidays until clinic defines the rule |
| How plans are changed after tasks exist | Protects operational history | Plan version/snapshot; change only future pending tasks after user confirmation |
| Required minimum patient data | Determines intake validation and privacy | Name + one viable contact method where available; HN optional |
| Patient matching/duplicate policy | Prevents duplicate or mistaken merges | Warn on phone/HN match; admin chooses link/create; no automatic merge |
| Appointment ownership/details | Determines scheduling schema | Confirm required branch, provider/doctor, duration, room, and conflict checking |
| Case closure taxonomy | Enables consistent reporting | Confirm final statuses and whether “converted” means appointment completed, treatment purchased, or another event |
| Who can see/edit symptom notes | Privacy and clinical governance | Nurse/admin according to clinic policy; manager visibility and PDPA retention to be approved |
| Retry policy after no answer | Affects workload and task generation | Manual next action in Phase 1; automate only after the clinic agrees on cadence |
| User authentication and roles | Determines access/audit implementation | Confirm identity provider and exact permissions before production |

## 11. Implementation notes (non-binding)

- Keep transactional domain data separate from UI mock data currently used in the prototype.
- Prefer a normalized relational model with foreign keys for case/task/record/appointment links, plus a timeline/event query or event table for display/auditing.
- Store enumerations as controlled reference values or documented enums; expose configurable data (channels, plan steps, appointment types) through administration screens rather than source code.
- Include migration/seed data for Standard plan, four required channels, roles, and sample statuses.
- Define API/validation contracts around the entity boundaries above so a future integration and a manual UI call the same service layer.
