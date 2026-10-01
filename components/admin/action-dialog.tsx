'use client';
import { useEffect,useRef,useState } from 'react';
export function ActionDialog({title,children,confirm,close}:{title:string;children:React.ReactNode;confirm:(values:FormData)=>Promise<void>;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const lock=useRef(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} aria-label={title} onCancel={e=>{e.preventDefault();if(!pending)close();}} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-2xl bg-white p-6 text-[#193b33] shadow-xl backdrop:bg-black/30">
 <h2 className="font-semibold">{title}</h2><form onSubmit={async e=>{e.preventDefault();if(lock.current)return;const values=new FormData(e.currentTarget);lock.current=true;setPending(true);setError('');try{await confirm(values);close();}catch(reason){setError(reason instanceof Error?reason.message:'บันทึกไม่สำเร็จ');}finally{lock.current=false;setPending(false);}}}>
 {error&&<p role="alert" className="my-3 rounded bg-amber-50 p-3">{error}</p>}<fieldset disabled={pending} className="mt-4 space-y-3 [&_input]:block [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:p-2 [&_select]:block [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:p-2">{children}</fieldset>
 <div className="mt-5 flex justify-between"><button type="button" disabled={pending} onClick={close}>ยกเลิก</button><button disabled={pending} className="rounded-lg bg-[#197365] px-4 py-2 text-white">{pending?'กำลังบันทึก…':'ยืนยัน'}</button></div></form></dialog>;
}
