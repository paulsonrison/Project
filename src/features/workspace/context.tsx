import { createContext, useContext } from 'react';
import type { Session } from '../../services/api';
export const AccountContext = createContext<Session | null>(null);
export function useAccount() { const account = useContext(AccountContext); if (!account) throw new Error('No active session'); return account; }
