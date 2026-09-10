export type FollowUpDueState = 'overdue' | 'today' | 'upcoming';
export type LeadPriority = 'Urgent' | 'High' | 'Normal' | 'Low';

/** UI read model; replace the mock repository with a Supabase-backed repository. */
export type LeadCase = {
  id: string;
  initials: string;
  name: string;
  hn?: string;
  phone: string;
  service: string;
  source: string;
  status: string;
  priority: LeadPriority;
  nurse: string;
  owner: string;
  task: string;
  due: string;
  dueState: FollowUpDueState;
  note: string;
  plan: string;
  anchor: string;
  closed?: boolean;
};
