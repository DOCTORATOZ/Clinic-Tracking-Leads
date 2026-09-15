# Role Model — Clinic Tracking Leads

**Status:** Implemented foundation (Supabase dev migrations `0006`–`0008`)  
**Product language:** Thai for operational copy; English identifiers for code,
APIs, database constraints, and audit events.

## Purpose

This document defines the authorization boundary for the Clinic Tracking Leads
SaaS. It separates operating a clinic from operating the SaaS platform. It is
the source of truth for future migrations, RLS policies, API guards, and
administration screens.

This document is the contract implemented by the role-model migrations and
the role-aware API/UI foundation. Remaining clinic configuration screens and
automated RLS integration tests are follow-up work, not an alternative role
model.

## Roles

| Identifier | Scope | Main responsibility |
|---|---|---|
| `viewer` | Clinic | View only the clinic data expressly permitted by policy. |
| `care_coordinator` | Clinic | รับข้อมูลจากช่องทางต่าง ๆ, สร้าง/ติดตามเคส, ประสานพยาบาล, บันทึกข้อมูลที่พยาบาลรายงาน และจัดการนัดหมาย. |
| `nurse` | Clinic | ทำและรายงานการพยาบาลหรือการประเมินตามเคสที่ได้รับมอบหมาย. |
| `clinic_admin` | Clinic | ดูแลการปฏิบัติงานทั้งหมดของคลินิก, ผู้ใช้/role, แผน, เครื่องมือ, เอกสาร และ configuration. |
| `system_admin` | Platform | Manage SaaS tenants and platform access. This does not grant patient/case/clinical-data access by default. |

`viewer`, `care_coordinator`, `nurse`, and `clinic_admin` are clinic-scoped roles. A user may
have different roles in different clinics. `system_admin` is a platform-scoped
assignment, stored separately from clinic membership.

The existing database role identifiers `admin` and `manager` are legacy names.
The implementation migration will map active `admin`/`manager` memberships to
`clinic_admin`; it will not silently change access before the migration is
approved and applied.

## Permission matrix

| Action | Viewer | Care Co | Nurse | Clinic Admin | System Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Read permitted clinic records | Yes | Yes | Assigned/authorised | Yes | No by default |
| Receive intake / create patient and case | No | Yes | No | Yes | No |
| Assign or relay a case to nurse | No | Yes | No | Yes | No |
| Provide clinical assessment / treatment information | No | No | Yes | No, unless also assigned Nurse | No |
| Record nurse-reported result with correct attribution | No | Yes | No | Yes | No |
| Create/reschedule appointment from nurse instruction | No | Yes | No | Yes | No |
| Manage follow-up plan for an existing case | No | No | Assigned work only | Yes | No |
| Prepare operational documents | No | Yes | Assigned work only | Yes | No |
| View clinic audit events | No | No | No | Yes | No clinical audit by default |
| Invite/change/disable clinic users and roles | No | No | No | Yes | No through clinic UI |
| Edit clinic name/timezone/case prefix | No | No | No | Yes | No through clinic UI |
| Manage sources, services, follow-up plans, clinic tools | No | No | No | Yes | No through clinic UI |
| Create/suspend/reactivate SaaS tenant | No | No | No | No | Yes |
| Assign/revoke `system_admin` | No | No | No | No | Controlled platform process only |

All “Yes” entries for a clinic role mean **only within the active `clinic_id`**.
RLS is the enforcement layer; UI visibility is not an authorization control.

## Permission model: not a top-to-down hierarchy

Roles are **capability-based**, not a single top-to-down inheritance chain.
A higher operational role does not automatically receive clinical authority.

- `clinic_admin` is the highest **clinic administration** role. It may manage
  users, roles, plans, tools, configuration, documents, and operational
  workflows.
- `care_coordinator` is the patient-coordination role. It may receive social-media or
  phone intake, create and relay cases, record a nurse's reported result, and
  create or reschedule appointments from the nurse's instruction.
- `nurse` owns the clinical action and clinical report. A Clinic Admin or Care
  Co may record the report, but must retain the Nurse as `performed_by` or
  `reported_by`; they must not be recorded as the clinical performer.
- `system_admin` is a different platform boundary. It manages SaaS tenants but
  does not inherit `clinic_admin`, `care_coordinator`, or `nurse` access.

This prevents a platform administrator from seeing clinical data and prevents
an operational administrator from impersonating a nurse's clinical work.

## Privilege-escalation rules

1. Only a `clinic_admin` may invite, activate, deactivate, or edit clinic
   memberships in its own clinic.
2. A Clinic Admin cannot use a membership update to assign itself or another
   user `system_admin` access.
3. A mutation must reject any attempt to disable, remove, or demote the final
   active `clinic_admin` in a clinic.
4. No Clinic Admin, Care Co, or Nurse flow may create, grant, edit, or revoke a
   `system_admin` assignment.
5. A user cannot use an invite or membership update to change its own role or
   escalate its own privileges.
6. A disabled membership cannot establish a `ClinicContext`, read tenant data,
   or perform any clinic mutation.
7. Platform administrator tools may expose only tenant metadata, membership
   counts, and lifecycle state unless a separately approved support-access
   workflow is introduced.

## Data boundaries

### Clinic data

Every tenant-owned record carries `clinic_id`. Browser and API requests must
derive the active clinic from authenticated membership; they must never accept
an arbitrary clinic ID from a client as authority.

RLS policies must restrict reads and writes to the active membership’s clinic.
Service-role code may bypass RLS only inside a server-side, narrowly scoped
operation that has already established the actor and checked the applicable
role.

### Platform data

`system_admin` assignments must be stored separately from `clinic_memberships`.
Holding a platform role must not create a clinic membership or make patient,
case, appointment, follow-up, clinical note, or raw integration payload
visible.

## User lifecycle

```text
invited → active → disabled
```

- **invited**: A permitted Clinic Admin triggers an email invitation using
  Supabase Auth. The application records the intended clinic, role, inviter,
  and safe invitation status; it never stores a password or invite token.
- **active**: The recipient has an active Auth user and active clinic
  membership. The recipient can sign in and receive only its permitted role.
- **disabled**: The membership is inactive. Existing sessions must fail
  ClinicContext authorization on the next request. Auth identity/history stays
  intact for auditability.

Required audit actions include:

```text
membership.invited
membership.activated
membership.role_changed
membership.disabled
membership.reactivated
membership.invitation_failed
```

Each event records actor, clinic, target user or email reference, previous and
next role/status where applicable, timestamp, and a safe failure reason. Do
not place passwords, invitation tokens, or sensitive clinical data in audit
metadata.

## Tenant lifecycle

```text
active → suspended → active
```

- **active**: Clinic members may use the application under ordinary RLS/RBAC.
- **suspended**: All clinic operations are denied, while tenant metadata and
  prior audit history remain retained.
- **reactivated**: A System Admin restores the tenant after recording a reason.

Tenant lifecycle actions require actor, timestamp, prior/next state, and a
human-readable reason in platform audit data.

## Implementation mapping

Implementation coverage and next work:

| Area | Required change |
|---|---|
| Database | Implemented `system_administrators`, active-clinic selection, tenant lifecycle, clinical detail split, legacy-role migration, and final-Clinic-Admin trigger. |
| Auth context | Implemented active clinic resolution, multi-clinic switching, separate System Admin guard, and access-pending screen. |
| APIs | Implemented guarded active-clinic, membership/invitation, and tenant lifecycle endpoints. Auth invitations use a server-only service-role client. Config/source/service/plan CRUD remains next work. |
| RLS | Implemented role-specific clinic policies, Care Coordinator safe projections, and platform tenant metadata projection. |
| UI | Implemented operational role gating, Clinic Admin member management, and System Admin tenant lifecycle workspace. Configuration, tools, audit, source/service/plan screens remain next work. |
| Tests | Existing type/unit checks pass. Add dedicated RLS/API integration coverage for cross-clinic denial, final-admin guard, and System Admin clinical-data denial before production rollout. |

## Out of scope

- SaaS billing, subscriptions, quotas, and invoices
- Public self-registration
- User-managed platform-administrator assignment
- Google Calendar credentials or live sync administration
- A general support impersonation workflow
- Access to patient or clinical data for `system_admin` by default
