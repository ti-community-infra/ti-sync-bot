import rewire from "rewire";
import { RepoConfig } from "../../../src/events/app";
const appEventHandler = rewire("../../../lib/events/app/index.js");

describe("Test for app event handle", () => {
  describe("Test for getSyncRepositoryListFromEnv", () => {
    let getSyncRepositoryListFromEnv: () => RepoConfig[];

    beforeAll(() => {
      // Get internal methods in the module through rewire.
      getSyncRepositoryListFromEnv = appEventHandler.__get__(
        "getSyncRepositoryListFromEnv"
      );
    });

    test("empty string", () => {
      // Mock the process env.
      appEventHandler.__set__("process", {
        env: {
          SYNC_REPOS: "",
        },
      });

      const syncRepos = getSyncRepositoryListFromEnv();
      expect(syncRepos).toEqual([]);
    });

    test("two sync repo", () => {
      // Mock the process env.
      appEventHandler.__set__("process", {
        env: {
          // Notice: the space is to test trim.
          SYNC_REPOS: "tikv / tikv , pingcap / tidb ",
        },
      });

      const syncRepos = getSyncRepositoryListFromEnv();

      expect(syncRepos).toEqual([
        { owner: "tikv", repo: "tikv" },
        { owner: "pingcap", repo: "tidb" },
      ]);
    });
  });
});
