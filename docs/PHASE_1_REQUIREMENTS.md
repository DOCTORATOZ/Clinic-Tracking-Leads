# Clinic Tracking Leads — Phase 1 Source of Truth

**Status:** implementation baseline  
**Primary system user:** Admin / coordinator  
**Clinical operating model:** A nurse performs the call and assessment; an admin records the nurse's supplied information in the system. This attribution must never be lost.

## 1. Objective and boundary

Create an internal workflow system to track patient leads from multiple inbound channels, make sure each lead is actioned, document nurse assessments entered by an admin, run scheduled follow-ups, and create appointments where required.

Phase 1 is **manual entry first**. It has no live Facebook, LINE OA, TikTok, phone, calendar, or HIS integration. The data model must nevertheless retain the channel and optional external identifiers needed for future integrations.

This is a lead and follow-up operations tool, not a complete electronic medical record. Store only the symptom/requirement and assessment information required for this workflow, with appropriate clinic privacy controls.

## 2. Roles

| Role | Phase 1 responsibility | System access |
|---|---|---|
| Admin | Receives lead, creates/updates lead, assigns nurse, enters the nurse's assessment, manages follow-up and appointment records | Main user; full Phase 1 workflow access |
| Nurse | Calls and assesses the patient; sends summary back to admin | May not log in during Phase 1; must exist as a reference staff record |
| Manager | Monitors work queues, dashboard, and operational records | Reporting/configuration access as defined by clinic |

All clinical/call results must preserve four separate fields:

```text
assessed_by  = nurse who performed the assessment
assessed_at  = when the nurse performed the assessment/contact
recorded_by  = admin who keyed the supplied information
recorded_at  = when it was entered into the system
```

`created_by` and `updated_by` are audit fields; they do not replace these four fields.

## 3. Workflow and lead status

```text
NEW_LEAD
  → WAITING_FOR_NURSE
  → NURSE_CONTACTING
  → WAITING_FOR_ADMIN_ENTRY
  → FOLLOW_UP ────────────────┐
       │                      │
       ├→ APPOINTMENT ────────┤
       └→ CLOSED              │
                              └→ CLOSED
```

| Status | Meaning / normal transition trigger |
|---|---|
| `NEW_LEAD` | Admin has received or created the lead but has not handed it to a nurse. |
| `WAITING_FOR_NURSE` | Admin has assigned/relayed the lead to a nurse; nurse contact is pending. |
| `NURSE_CONTACTING` | Nurse is attempting or conducting the first assessment. |
| `WAITING_FOR_ADMIN_ENTRY` | Nurse has completed/reported the assessment; admin has not yet recorded it. This is a required dashboard/work-queue priority. |
| `FOLLOW_UP` | An assessment has been recorded and one or more follow-up actions are active. |
| `APPOINTMENT` | An appointment is required or scheduled. This is a lead summary status; appointment lifecycle is kept on the appointment record. |
| `CLOSED` | Workflow has ended; closure reason, actor, and time are retained. |

The system must validate transitions and keep status history/audit information. A lead in `APPOINTMENT` may still have active follow-up work; creating an appointment must not silently cancel remaining follow-up records.

## 4. Required records and relationships

### 4.1 Lead / patient intake

Phase 1 manual intake must capture:

| Field | Required | Notes |
|---|---:|---|
| `lead_id` | Yes | Immutable internal ID; a readable lead number may also be generated. |
| `source_channel` | Yes | Seed: `FACEBOOK`, `LINE_OA`, `TIKTOK`, `PHONE`, `OTHER`. Keep configurable for future channels. |
| `source_external_id` | No | Future provider conversation/message/lead ID; optional for manual Phase 1 entry. |
| `received_at` | Yes | Date/time the lead was received. |
| `patient_name` | Yes | Display name as provided; later may link to a normalized patient record. |
| `phone` | Yes where available | Preserve a normalized value plus entry/display value. |
| `hn` | No | Hospital number; optional at intake and must be checked for a possible duplicate, never silently overwrite. |
| `symptom_requirement` | Yes | Symptom, service interest, concern, or request; not a diagnosis. |
| `note` | No | Intake context. |
| `status` | Yes | One of the status values in section 3. |
| `assigned_nurse_id` | No initially | Reference to nurse staff record. |
| audit fields | Yes | See section 4.5. |

For implementation, model the person/patient separately from the lead so a person can have more than one lead or treatment episode. The Phase 1 UI may capture both on one form, but follow-up and appointment records must link to the relevant `lead_id` and `patient_id`.

### 4.2 Nurse assessment / contact record

Record the first nurse assessment as a contact/assessment record connected to the lead. The record must hold `assessed_by`, `assessed_at`, `recorded_by`, `recorded_at`, the result, condition/assessment narrative, recommendation, next action, and note. When the admin records it from the nurse's report, `assessed_by` must reference the nurse and `recorded_by` the logged-in admin.

Saving the initial assessment moves the lead from `WAITING_FOR_ADMIN_ENTRY` to `FOLLOW_UP`, `APPOINTMENT`, or `CLOSED`, according to the next action selected by the admin from the nurse's instruction.

### 4.3 Follow-up record

Follow-up is task/record based: a planned follow-up can exist before an actual contact. A task/record must support the following source-of-truth fields:

| Field | Required | Notes |
|---|---:|---|
| `lead_id` | Yes | Parent lead/case. |
| `patient_id` | Yes | Parent patient/person. |
| `followup_round` | Yes | Sequence/label, e.g. `Day 1`; may be custom. |
| `day_offset` | Yes for scheduled plan steps | Days from the plan anchor; custom/ad-hoc records may use a custom value. |
| `assigned_nurse` | No | Nurse reference; required when the nurse owns/performs the contact. |
| `contact_at` | No until contact is attempted | Actual contact/attempt time. |
| `contact_result` | No until contact is attempted | Examples: reached, no answer, callback requested, wrong number. |
| `patient_condition` | No | Patient-reported current state where relevant. |
| `nurse_assessment` | No | Nurse assessment/summary. |
| `recommendation` | No | Nurse recommendation. |
| `next_action` | Yes on completion | Continue, retry, create appointment, close, escalate, etc. |
| `next_followup_date` | No | Manual/custom next follow-up; does not overwrite historic schedule. |
| `appointment_required` | Yes | Boolean decision. |
| `appointment_date` | No | Required when an appointment is created; may be pending when requested but not yet booked. |
| `assessed_by`, `assessed_at` | As applicable | Nurse/caller and actual assessment time. |
| `recorded_by`, `recorded_at` | Yes when saved | Admin/system user entering the information. |
| `status` | Yes | Planned, in progress, completed, skipped, cancelled; display overdue from date/time. |
| `note` | No | Operational note. |
| audit fields | Yes | See section 4.5. |

Seed the standard plan with `Day 1`, `Day 3`, `Day 7`, `Day 14`, and `Day 30`. The plan and its steps are configuration data, not hard-coded business logic; admins/managers must be able to create custom offsets. When tasks are generated, snapshot the label/offset/scheduled date so changing a plan does not rewrite history.

### 4.4 Appointment

Create an appointment record when `appointment_required = true` and link it to `lead_id`, `patient_id`, and the originating follow-up record. Minimum fields are appointment ID, scheduled date/time, appointment status, appointment type, note, linked lead/patient/follow-up, and audit fields. Appointment status should be separate from lead status (for example: pending confirmation, confirmed, completed, cancelled, no-show, rescheduled).

### 4.5 Staff and audit fields

Create staff reference records for admins and nurses even if nurses have no Phase 1 login. Every mutable business record must include:

```text
created_at, updated_at, created_by, updated_by
```

All timestamps are persisted in UTC and displayed in the clinic timezone (initially Asia/Bangkok). Keep a status-change/activity history so lead status and data-entry attribution are auditable.

## 5. Required Phase 1 screens

1. **Lead List** — search/filter by status, source, nurse, name, phone, HN, and received date; surface overdue/pending work.
2. **Lead Detail** — patient/contact summary, status, assigned nurse, timeline, follow-up history, and appointment section.
3. **Create/Edit Lead** — manual entry for every required intake field and optional external ID/HN.
4. **Assign Nurse** — assign/reassign a nurse and advance to `WAITING_FOR_NURSE`.
5. **Record Nurse Assessment (Admin entry)** — visibly distinguishes the nurse as assessor from the admin as recorder, including both timestamps; can create follow-up or appointment.
6. **Follow-up Queue** — due, overdue, upcoming, and custom follow-ups; filter by owner/status/date.
7. **Follow-up History** — immutable chronological history of plans, attempts, results, and next action.
8. **Appointment section** — linked appointment list and create/edit flow from a follow-up or lead.
9. **Dashboard** — operational counts and work queues; must prominently show `WAITING_FOR_ADMIN_ENTRY` so nurse summaries awaiting transcription cannot be missed.

## 6. Phase 1 rules and acceptance checks

- Admin is the main system user. No Phase 1 screen may require a nurse login to complete the workflow.
- `assessed_by`/`assessed_at` and `recorded_by`/`recorded_at` must remain distinct when admin enters a nurse's result.
- A lead can be created with a blank HN and a blank `source_external_id`.
- Source channel remains the original inbound channel even if a later contact occurs by phone or LINE.
- The standard plan generates exactly five planned follow-ups with offsets 1, 3, 7, 14, and 30 days; a custom plan/offset is also supported.
- Each completed contact creates a dated follow-up/assessment record; editing the lead must not erase that history.
- An appointment created from follow-up links in both directions to its source follow-up and its lead/patient.
- Dashboard/queue exposes records in `WAITING_FOR_ADMIN_ENTRY` and due/overdue follow-up work.
- Future integrations must use the same validation/domain services as manual entry, preserve `source_external_id`, and avoid duplicate creation using provider event IDs/idempotency keys when added.

## 7. Deferred decisions (do not block documentation)

- The exact plan anchor for Day 0 (recommended default: `received_at`, with an audited override).
- Clinic duplicate-resolution policy when an incoming phone or HN matches an existing patient.
- Appointment specifics: branch, provider, duration, room and collision rules.
- Exact staff permissions, PDPA retention policy, and authenticated identity provider.
- No-answer retry policy and closure reasons.

