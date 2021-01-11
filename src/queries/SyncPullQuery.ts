export interface SyncPullQuery {
  owner: string;
  repo: string;
  pull: {
    number: number;
    state: string;
    locked: boolean;
    title: string;
    user: {
      login: string;
      id: number;
      type: string;
    } | null;
    body: string | null;
    labels: {
      id?: number;
      name?: string;
    }[];
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    merge_commit_sha: string | null;
    author_association: string;
  };
}
