export interface SyncPullStatusQuery {
  pull: {
    owner: string;
    repo: string;
    pull_number: number;
    updated_at: string;
    user: {
      login: string;
    } | null;
  };
  comments: {
    id: number;
    user: {
      login: string;
    } | null;
    body?: string;
    created_at: string;
    updated_at: string;
  }[];
  reviews: {
    id: number;
    user: {
      login: string;
    } | null;
    body: string;
    submitted_at?: string;
  }[];
  review_comments: {
    id: number;
    user: {
      login: string;
    } | null;
    body: string;
    created_at: string;
    updated_at: string;
  }[];
  commits: {
    commit: {
      committer: {
        name?: string;
        date?: string;
      } | null;
    };
  }[];
}
