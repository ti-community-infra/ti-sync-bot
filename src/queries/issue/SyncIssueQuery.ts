export interface SyncIssueQuery {
  owner: string;
  repo: string;
  number: number;
  state: string;
  title: string;
  user: {
    login: string;
  } | null;
  body?: string;
  labels: (
    | string
    | {
        name?: string;
      }
  )[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
}
