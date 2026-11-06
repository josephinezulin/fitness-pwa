export type Workout = {id:string;date:string;type:'home'|'walk'|'other';minutes:number;calories:number;note:string};
export type Metric = {id:string;date:string;weight?:number;fat?:number;heart?:number;steps?:number};
export type Data = {version:1;workouts:Workout[];metrics:Metric[]};
export const empty:Data={version:1,workouts:[],metrics:[]};
export const today=()=>dateKey(new Date());
export function dateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function weekDays(reference=new Date()){const d=new Date(reference);d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const day=new Date(d);day.setDate(d.getDate()+i);return dateKey(day)})}
export const plans=[{day:0,type:'home',label:'居家徒手訓練',duration:'20–30 分鐘'},{day:2,type:'walk',label:'健身房上坡快走',duration:'30–60 分鐘'},{day:5,type:'home',label:'居家徒手訓練',duration:'20–30 分鐘'}] as const;
export function completed(workouts:Workout[],date:string,type:string){return workouts.some(w=>w.date===date&&w.type===type&&w.minutes>0)}
const validDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&dateKey(new Date(v+'T12:00:00'))===v;
const number=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validate(raw:unknown):Data{
 const d=raw as Data;if(!d||d.version!==1||!Array.isArray(d.workouts)||!Array.isArray(d.metrics)||d.workouts.length>50000||d.metrics.length>50000)throw Error('備份格式或版本不符');
 const ids=new Set<string>();for(const w of d.workouts){if(!w||typeof w.id!=='string'||!w.id||ids.has(w.id)||!validDate(w.date)||!['home','walk','other'].includes(w.type)||!number(w.minutes,1,1440)||!number(w.calories,0,20000)||typeof w.note!=='string'||w.note.length>2000)throw Error('運動紀錄格式錯誤');ids.add(w.id)}
 const mids=new Set<string>();const dates=new Set<string>();for(const m of d.metrics){if(!m||typeof m.id!=='string'||!m.id||mids.has(m.id)||!validDate(m.date)||dates.has(m.date))throw Error('健康資料重複或日期錯誤');mids.add(m.id);dates.add(m.date);for(const [k,min,max]of [['weight',1,500],['fat',0,100],['heart',20,250],['steps',0,200000]]as const){if(m[k]!==undefined&&!number(m[k],min,max))throw Error('健康數值超出範圍')}if(['weight','fat','heart','steps'].every(k=>m[k as keyof Metric]===undefined))throw Error('健康資料不可為空')}
 return {version:1,workouts:d.workouts.map(w=>({...w})),metrics:d.metrics.map(m=>({...m}))};
}
export function demo():Data{const dates=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return dateKey(d)});return {version:1,metrics:dates.map((date,i)=>({id:`demo-${i}`,date,weight:Math.round((68.6-i*.035+Math.sin(i)*.15)*10)/10,fat:Math.round((24-i*.04)*10)/10,heart:67+(i%5),steps:4200+(i*719)%6200})),workouts:weekDays().filter((_,i)=>i===0).map(date=>({id:'demo-workout',date,type:'home',minutes:25,calories:130,note:'全身循環，完成後伸展 5 分鐘'}))}}
