export interface SyncPullLastCommentQuery {
  pull: {
    owner: string;
    repo: string;
    pull_number: number;
    user: {
      login: string;
    } | null;
  };
  last_comment_author: {
    login: string;
  } | null;
  last_comment_time: string;
}
