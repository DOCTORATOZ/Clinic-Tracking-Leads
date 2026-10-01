'use client';
import {useEffect,useState} from 'react';
export function OperationalDashboard(){
 const [data,setData]=useState<Record<string,number>>();const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();fetch('/api/dashboard',{signal:c.signal}).then(async response=>{if(!response.ok)throw new Error('โหลดภาพรวมไม่สำเร็จ');setData(await response.json());setError('');}).catch(reason=>{if(!c.signal.aborted)setError(reason.message);});return()=>c.abort();},[retry]);
 if(error)return <p role="alert" className="mt-6">{error} <button onClick={()=>setRetry(retry+1)}>ลองใหม่</button></p>;
 if(!data)return <output className="mt-6 block">กำลังโหลดภาพรวม…</output>;
 const labels:Record<string,string>={patients:'บุคคลทั้งหมด',cases:'เคสทั้งหมด',patientsToday:'บุคคลใหม่วันนี้',casesToday:'เคสใหม่วันนี้',overdueTasks:'งานเกินกำหนด',completedTasks:'งานเสร็จแล้ว',scheduledAppointments:'นัดที่ยังดำเนินการ'};
 return <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{Object.entries(labels).map(([key,label])=><section key={key} className="rounded-2xl border bg-white p-5"><p className="text-sm">{label}</p><b className="mt-3 block text-2xl text-[#197365]">{data[key]}</b></section>)}</div>;
}
