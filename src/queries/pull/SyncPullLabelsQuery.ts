export interface SyncPullLabelsQuery {
  owner: string;
  repo: string;
  pull: {
    number: number;
    labels: {
      name?: string;
    }[];
  };
}
