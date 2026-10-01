import { z } from 'zod';
import { normalizeHn, normalizePhone } from './normalization';
const id=z.uuid();
const reason=z.string().trim().min(1,'กรุณาระบุเหตุผล').max(1000);
const text=z.string().trim().max(200);
const time=z.iso.datetime({offset:true});
export const patientUpdateSchema=z.object({
 expectedUpdatedAt:time,reason,fullName:text.min(1).optional(),
 phone:z.string().trim().max(40).transform(normalizePhone).refine(v=>!v||/^(0\d{8,9}|\+[1-9]\d{6,14})$/.test(v),'รูปแบบโทรศัพท์ไม่ถูกต้อง').transform(v=>v??'').optional(),
 hn:text.transform(normalizeHn).transform(v=>v??'').optional(),
 socialPlatform:z.enum(['','line_oa','facebook','tiktok','other']).optional(),socialAccount:text.optional(),
 representativeName:text.optional(),representativeRelationship:text.optional(),
 contactPermission:z.enum(['unknown','granted','declined']).optional(),ownerId:id.optional(),nextContactAt:time.nullable().optional(),
 intakeStatus:z.enum(['new','in_progress','awaiting_callback','linked_to_case','closed']).optional(),
});
export const caseUpdateSchema=z.object({expectedRevision:z.number().int().positive(),reason,title:text.min(1).optional(),coordinationNote:z.string().trim().max(5000).optional(),ownerId:id.optional(),sourceId:id.optional(),serviceId:id.optional(),priority:z.enum(['low','normal','high','urgent']).optional(),careStage:z.enum(['assessment','preparation','post_procedure']).optional()});
export const caseTransitionSchema=z.object({expectedRevision:z.number().int().positive(),action:z.enum(['pause','resume','close','reopen']),reason,reportedBy:id.optional()});
export const assignmentSchema=z.object({nurseId:id,reason});
export const taskTransitionSchema=z.object({status:z.enum(['pending','in_progress','paused','cancelled']),reason,dueAt:time.optional(),assignedTo:id.optional()});
export const manualTaskSchema=z.object({label:text.min(1),dueAt:time,assignedTo:id,reason});
export const correctionSchema=z.object({summary:z.string().trim().min(1).max(5000),reason});
export const appointmentTransitionSchema=z.object({expectedUpdatedAt:time,status:z.enum(['scheduled','rescheduled','completed','cancelled','no_show']),reason,startsAt:time.optional(),endsAt:time.optional(),appointmentType:text.min(1).optional(),branch:text.optional(),providerName:text.optional()}).superRefine((v,ctx)=>{
 if(v.status==='rescheduled'&&(!v.startsAt||!v.endsAt))ctx.addIssue({code:'custom',path:['startsAt'],message:'ระบุวันเริ่มและสิ้นสุดใหม่'});
 if(v.startsAt&&v.endsAt&&Date.parse(v.startsAt)>=Date.parse(v.endsAt))ctx.addIssue({code:'custom',path:['endsAt'],message:'เวลาสิ้นสุดต้องหลังเวลาเริ่ม'});
});
