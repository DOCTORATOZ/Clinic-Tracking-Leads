# Handoff — Patient identity resolution and safe record merge

## Purpose

Extend the existing Clinic Tracking Leads Phase 1 requirements so that one real
patient who contacts the clinic through several channels is represented by one
canonical patient/person record, while each enquiry remains its own Case. This
is an identity-management and operational-history feature, not a clinical-data
deduplication shortcut.

The existing requirements already establish the foundations:

- `Patient` is separate from `Case`; a patient may have many cases.
- `External Identity` allows one patient to own several platform identities.
- `source_channel_id` on a Case is immutable attribution, while individual
  follow-up contact channels are separate.
- HN and normalized phone currently produce a duplicate warning and require an
  auditable human decision.

This handoff makes the duplicate review decision explicit: users must be able
to link an intake to the existing canonical patient, or safely merge two
previously-created patient records. It supersedes the blanket Phase 1
exclusion of "deduplication automation" only to the extent described below;
automatic irreversible merging remains out of scope.

## Outcome

An admin who receives a contact from LINE, Facebook, TikTok, Phone, Website,
Walk-in, or another configured channel can:

1. Search for an existing patient before creating a record.
2. See likely-match candidates based on reliable identifiers.
3. Link the new Case/contact identity to the correct existing patient.
4. Merge two confirmed duplicate patient records into one canonical record.
5. See the full cross-channel history without losing original source,
   attribution, case, follow-up, appointment, or audit history.

## Non-negotiable rules

1. Never auto-merge solely on name, display name, social handle, or a fuzzy
   name match.
2. Do not use phone number, HN, or a provider identity as the internal primary
   key. `Patient.id` remains the immutable internal key.
3. Preserve the original `source_channel_id` and `source_received_at` on every
   Case. A merge must not make a Facebook case appear to have originated on
   LINE merely because the same person later contacts LINE.
4. Preserve every Case, Follow-up Task, Follow-up Record, Appointment,
   External Identity, Integration Event, audit record, and original creator.
   Do not delete history.
5. Merge requires an authorised human confirmation and an auditable reason.
   Provide a preview of what will change before confirmation.
6. A merge must be reversible by authorised users, or require a controlled
   unmerge workflow that restores the prior associations exactly. Do not
   offer silent, destructive updates.
7. HN conflict, a verified external identity that belongs to a different
   patient, or materially conflicting patient details must block merge and
   escalate to a manager/approved data steward.

## Matching and intake behaviour

### Search and matching order

When creating a person/case, search by the following evidence, in order:

1. Verified external identity scoped by provider and account:
   `(platform, external_account_id, external_user_id)`.
2. Approved HIS/HN mapping, after clinic-specific HN normalization.
3. Exact normalized phone number. Treat Thai equivalents consistently (for
   example, normalize spaces, hyphens, country code, and leading zero based on
   a documented clinic rule).
4. Secondary supporting fields such as full name and date of birth, if both
   are already permitted by clinic policy.
5. Name/display-name/handle-only results as low-confidence search hints only.

### Decision outcomes

For every candidate, the admin must choose one of these outcomes:

- **Use existing patient** — attach the new Case and any new External Identity
  to the selected patient; do not create a duplicate patient.
- **Create a separate patient** — allowed when the match is not confirmed;
  record why a likely match was rejected where a strong identifier matched.
- **Review/merge duplicate** — available only to authorised roles and only
  after reviewing two patient records.

For Phase 1 manual entry, exact phone/HN matches should create a prominent
"possible duplicate" warning, not an automatic merge. Future integration
events that cannot safely resolve a patient must be stored with
`sync_status = Needs review`; they must not create repeated cases on webhook
retry (existing idempotency rules still apply).

## Canonical record and merge data model

Keep the existing `Patient`, `External Identity`, and `Integration Event`
models. Add the following logical entities/fields; exact table names are an
implementation choice.

### Patient identity status

Add to Patient:

| Field | Requirement |
|---|---|
| `identity_status` | `Active`, `Merged`, or `Review required`. Only `Active` may be selected for ordinary new intake. |
| `canonical_patient_id` | Null for an active canonical patient; points to the active canonical patient when this historical record has been merged. |
| `merged_at`, `merged_by` | Required when status is `Merged`. |

Do not delete the merged-away patient record. Keep it as a historical alias so
old links, exports, and audit events remain explainable. All normal patient
views/searches should resolve an alias to its active canonical patient while
still showing that a merge occurred.

### Patient merge event

Create an append-only `PatientMergeEvent` (or equivalent audit entity):

| Field | Requirement |
|---|---|
| `id` | Immutable internal ID. |
| `canonical_patient_id` | The record that survives as the active patient. |
| `merged_patient_id` | The duplicate/alias record. |
| `status` | `Completed`, `Reversed`, or `Blocked`. |
| `reason`, `evidence_summary` | Required human-readable justification and evidence used; do not include unnecessary clinical notes. |
| `field_resolution_snapshot` | Before/after values and choices for conflicts. |
| `relationship_snapshot` | IDs/counts of records moved or resolved, sufficient for exact reversal. |
| `created_at`, `created_by`, `reversed_at`, `reversed_by`, `reversal_reason` | Full audit. |

Constraints:

- A patient cannot merge into itself or into a non-active canonical alias.
- Prevent merge cycles; canonical resolution must terminate at one active
  patient.
- An external identity with a verified, conflicting ownership must block the
  transaction until manually resolved.
- Enforce uniqueness of a verified `(platform, external_account_id,
  external_user_id)` for the resolved canonical patient.

## Merge behaviour

### Canonical selection

The authorised user selects the canonical patient. The UI should recommend a
record with a verified HN/HIS link, the most complete verified contact profile,
or the one with the longer clinical/operational history, but the choice must be
visible and confirmed. Never make this choice invisibly.

### Field resolution

Show side-by-side values and require a choice for conflicts:

| Field category | Resolution rule |
|---|---|
| Internal IDs, audit fields, source history | Never overwrite; preserve on original records and link through merge history. |
| HN/HIS ID | Keep only if verified and non-conflicting; otherwise block/escalate. |
| Phone numbers, external identities, contact routes | Retain all valid distinct values as separately attributed contact/identity records; mark preferred channel/contact explicitly. |
| Name, DOB, sex | Prefer verified data or explicit authorised choice; do not overwrite a value simply because it is newer. |
| Consent / do-not-contact | Apply the most restrictive valid preference until an authorised correction is made. |
| Notes, symptoms, assessments | Never concatenate into a patient profile or discard; retain on their existing case/follow-up history. |

### Relationship resolution

After a completed merge, the canonical patient timeline and search result must
surface related Cases, Follow-up Tasks/Records, Appointments, and External
Identities belonging to either record. Preserve each record's original
`patient_id` where feasible and resolve through the canonical alias mapping;
if the implementation reparents foreign keys, capture every before/after link
in `relationship_snapshot` so an unmerge is exact. In either design, existing
case numbers, source channels, appointment links, and external event links
must not change.

The merge operation must run transactionally. It must either finish completely
or make no visible partial changes. Future integration adapters and the manual
UI must call the same identity-resolution/merge domain service.

## Required user experience

1. **Intake duplicate panel**: after entering a phone, HN, or external
   identity, show candidate patients, matched fields, confidence/evidence, and
   their latest case/contact. Provide the three decision outcomes above.
2. **Patient profile**: show an "identities and contact channels" section
   (for example LINE OA, Facebook, Phone), and a unified chronological
   timeline across all linked cases. Each event retains its original channel.
3. **Duplicate review screen**: compare two records; list field conflicts,
   cases, appointments, contact identities, and merge blockers. Require
   canonical selection, reason, evidence, and confirmation.
4. **Merge history**: visible to authorised users on the canonical profile;
   link to the merge event and offer controlled reversal where allowed.
5. **Search**: find the canonical person via any retained phone, HN, external
   identity, prior alias, name, or case number; show a clear alias/merged badge
   rather than presenting two active people.

## Roles and privacy

- Admin/coordinator: identify likely duplicates and link new intake to an
  existing patient. May request a merge.
- Manager/approved data steward: complete, reverse, or resolve blocked merges.
- Nurse: sees the canonical patient and relevant cases according to existing
  role policy, but does not manage identity merges by default.

Apply least-privilege access to identity data and merge audit details. Respect
the existing PDPA requirement: do not expose restricted raw integration
payloads or sensitive clinical notes in broad notifications or standard merge
comparison views.

## Acceptance criteria

1. A LINE contact and a Facebook contact with the same verified patient can
   appear as one canonical patient with two External Identities and separate
   Cases/source channels.
2. A phone match during manual intake warns the admin and lets them link to an
   existing patient without creating a second patient record.
3. A name-only match never merges records automatically.
4. An authorised manager can merge two confirmed duplicate patients after
   choosing a canonical record and recording a reason/evidence summary.
5. After merge, the canonical view includes all historical cases, follow-ups,
   appointments, and identities; original source attribution and staff/audit
   attribution remain unchanged.
6. An HN conflict or conflicting verified provider identity blocks the merge
   and is visible in a review queue.
7. Every merge and reversal records actor, timestamp, reason, field choices,
   affected relationship snapshot, and status.
8. A search by a historical alias or any retained contact identity resolves to
   the active canonical patient and visibly indicates the merge history.
9. Reversing a permitted merge restores the pre-merge association of every
   affected case, follow-up, appointment, and identity, without loss of later
   audit events.
10. Duplicate/retry integration events remain idempotent and cannot create an
    extra patient, case, or merge event.

## Implementation direction for Codex

1. Treat `REQUIREMENTS.md` as the broad Phase 1 specification and
   `docs/PHASE_1_REQUIREMENTS.md` as the implementation baseline.
2. Implement this handoff as an additive identity-resolution module; do not
   collapse Case and Patient into one entity and do not replace source-channel
   semantics.
3. First update the data contracts/mock data and UI flows needed for patient
   lookup, identity display, candidate warning, and authorised merge review.
4. Preserve the current Thai-first user experience. Use clear terms such as
   `คนไข้รายเดียวกัน`, `ข้อมูลซ้ำที่อาจเป็นคนเดียวกัน`, `รวมข้อมูล`, and
   `ประวัติการรวมข้อมูล`.
5. Add tests covering canonical resolution, blocked conflicts, source-history
   preservation, safe merge/reversal, and idempotent repeated requests.

