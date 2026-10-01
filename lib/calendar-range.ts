const DAY=86400000;
export const bangkokDateKey=(value:Date)=>new Date(value.getTime()+7*3600000).toISOString().slice(0,10);
export function calendarRange(mode:'month'|'week'|'day',selected:string,year:number,month:number){
  if(mode==='month')return {from:new Date(Date.UTC(year,month,1,-7)).toISOString(),to:new Date(Date.UTC(year,month+1,1,-7)).toISOString()};
  const day=new Date(`${selected}T00:00:00Z`);
  const start=day.getTime()-(mode==='week'?day.getUTCDay()*DAY:0)-7*3600000;
  return {from:new Date(start).toISOString(),to:new Date(start+(mode==='week'?7:1)*DAY).toISOString()};
}
export function bangkokWeekKeys(selected:string){
  const day=new Date(`${selected}T00:00:00Z`); const start=day.getTime()-day.getUTCDay()*DAY;
  return Array.from({length:7},(_,index)=>new Date(start+index*DAY).toISOString().slice(0,10));
}
