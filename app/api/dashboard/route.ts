import {NextResponse} from 'next/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {requireClinicContext} from '@/lib/auth/context';
import {apiErrorResponse} from '@/lib/http/api-error';
import {bangkokDateKey} from '@/lib/calendar-range';
export async function GET(){try{
 const client=await createSupabaseServerClient();const context=await requireClinicContext(client);const now=new Date();const start=new Date(`${bangkokDateKey(now)}T00:00:00+07:00`).toISOString();
 const results=await Promise.all([
  client.from('patients').select('id',{count:'exact',head:true}).eq('clinic_id',context.clinicId),
  client.from('cases').select('id',{count:'exact',head:true}).eq('clinic_id',context.clinicId),
  client.from('patients').select('id',{count:'exact',head:true}).eq('clinic_id',context.clinicId).gte('created_at',start),
  client.from('cases').select('id',{count:'exact',head:true}).eq('clinic_id',context.clinicId).gte('created_at',start),
  client.from('follow_up_tasks').select('id',{count:'exact',head:true}).eq('clinic_id',context.clinicId).in('status',['pending','in_progress']).lt('due_at',now.toISOString()),
  client.from('follow_up_tasks').select('id',{count:'exact',head:true}).eq('clinic_id',context.clinicId).eq('status','completed'),
  client.from('appointments').select('id',{count:'exact',head:true}).eq('clinic_id',context.clinicId).in('status',['scheduled','rescheduled']),
 ]);
 for(const item of results)if(item.error)throw item.error;
 const names=['patients','cases','patientsToday','casesToday','overdueTasks','completedTasks','scheduledAppointments'];
 return NextResponse.json(Object.fromEntries(results.map((item,index)=>[names[index],item.count??0])));
}catch(error){return apiErrorResponse(error,'โหลดภาพรวมไม่สำเร็จ');}}
