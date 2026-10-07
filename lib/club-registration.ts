export type RegistrationDetails = { name:string; grade:string; interest:string; note:string; consent:true };
/** Pending signup metadata is untrusted form input, not proof of identity or membership. */
export function registrationDetails(value:unknown):RegistrationDetails|null {
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  if(typeof v.name!=='string'||v.name.trim().length<2||v.name.trim().length>70||typeof v.grade!=='string'||!['9','10','11','12'].includes(v.grade)||typeof v.interest!=='string'||!['Explore','Serve','Lead','All of it'].includes(v.interest)||v.consent!==true)return null;
  if(v.note!==undefined&&typeof v.note!=='string')return null;
  const note=typeof v.note==='string'?v.note.trim():'';
  if(note.length>400)return null;
  return {name:v.name.trim(),grade:v.grade,interest:v.interest,note,consent:true};
}
