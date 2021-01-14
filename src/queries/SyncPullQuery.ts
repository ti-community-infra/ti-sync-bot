export interface SyncPullQuery {
  owner: string;
  repo: string;
  pull: {
    number: number;
    state: string;
    title: string;
    user: {
      login: string;
    } | null;
    body: string | null;
    labels: {
      name?: string;
    }[];
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    author_association: string;
  };
}
