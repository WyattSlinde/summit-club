import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '../app/chatgpt-auth';
export function isLeader(user:ChatGPTUser|null){if(!user)return false;const leader=(env as unknown as {SUMMIT_LEADER_ID?:string}).SUMMIT_LEADER_ID;return (!!leader&&user.userId===leader)||(import.meta.env.DEV&&user.userId==='local_seedy');}
