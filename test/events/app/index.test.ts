import rewire from "rewire";
const appEventHandler = rewire("../../../lib/events/app/index.js");

describe("Test for app event handle", () => {
  describe("Test for getSyncRepositoryListFromEnv", () => {
    const testcases: {
      name: string;
      syncReposInEnv: string;
      expectSyncRepos: {
        owner: string;
        repo: string;
      }[];
    }[] = [
      {
        name: "empty string",
        syncReposInEnv: "",
        expectSyncRepos: [],
      },
      {
        name: "two sync repo",
        // Notice: the space is to test trim.
        syncReposInEnv: "tikv / tikv , pingcap / tidb ",
        expectSyncRepos: [
          { owner: "tikv", repo: "tikv" },
          { owner: "pingcap", repo: "tidb" },
        ],
      },
    ];

    // Get internal methods in the module through rewire.
    const testMethod = appEventHandler.__get__("getSyncRepositoryListFromEnv");

    for (let tc of testcases) {
      test(tc.name, () => {
        // Mock the process env.
        appEventHandler.__set__("process", {
          env: {
            SYNC_REPOS: tc.syncReposInEnv,
          },
        });

        const syncRepos = testMethod();
        expect(syncRepos).toEqual(tc.expectSyncRepos);
      });
    }
  });
});
