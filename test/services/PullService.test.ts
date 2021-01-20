import { Repository } from "typeorm";
import typeorm = require("typeorm");
import { getLog } from "probot/lib/helpers/get-log";

import { IPullService, PullService } from "../../src/services/PullService";
import { Pull } from "../../src/db/entities/Pull";
import { OpenPRStatus } from "../../src/db/entities/OpenPRStatus";

describe("Test for PullService", () => {
  const logger = getLog();
  const pullRepository = new Repository<Pull>();
  const openPRStatusRepository = new Repository<OpenPRStatus>();

  let pullService: IPullService;

  beforeAll(() => {
    pullService = new PullService(
      pullRepository,
      openPRStatusRepository,
      logger
    );
  });

  beforeEach(() => {
    typeorm.createConnection = jest.fn().mockResolvedValue(null);
  });

  describe("Test for syncPullRequest", () => {
    let findOneMock: jest.SpyInstance;
    let saveMock: jest.SpyInstance;

    beforeAll(() => {
      findOneMock = jest.spyOn(pullRepository, "findOne");
      saveMock = jest.spyOn(pullRepository, "save");
    });

    test("no PR record in the database", async () => {
      const syncPullQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        state: "closed",
        title: "First PR",
        body: "",
        labels: [],
        author_association: "MEMBER",
        user: {
          login: "c4pt0r",
        },
        created_at: "2015-09-06 12:14:59.000Z",
        updated_at: "2015-09-07 12:14:59.000Z",
        closed_at: "2015-09-07 12:14:59.000Z",
        merged_at: "2015-09-07 12:14:59.000Z",
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockImplementation();

      // Execute the function to be tested.
      await pullService.syncPullRequest(syncPullQuery);

      // Assert the data that will eventually be saved in the database.
      const pullBeSaved = saveMock.mock.calls[0][0];
      expect(pullBeSaved.id).toBe(undefined);
      expect(pullBeSaved.status).toBe("merged");
    });

    test("PR stored in DB but the received PR data is out of date", async () => {
      const syncPullQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        state: "closed",
        title: "First PR",
        body: "",
        labels: [],
        author_association: "MEMBER",
        user: {
          login: "c4pt0r",
        },
        created_at: "2015-09-06 12:14:59.000Z",
        // Notice: The update time of newly received data is earlier than the record in database.
        updated_at: "2015-09-07 12:14:59.000Z",
        closed_at: "2015-09-07 12:14:59.000Z",
        merged_at: "2015-09-07 12:14:59.000Z",
      };

      // Mock the repository function.
      const pullInDB = new Pull();
      pullInDB.updatedAt = "2016-01-01 00:00:00.000Z";

      findOneMock.mockResolvedValue(pullInDB);

      // Execute the function to be tested.
      await pullService.syncPullRequest(syncPullQuery);

      expect(saveMock).not.toBeCalled();
    });

    test("PR stored in DB and the received PR data is the latest", async () => {
      const syncPullQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        state: "closed",
        title: "First PR",
        body: "",
        labels: [],
        author_association: "MEMBER",
        user: {
          login: "c4pt0r",
        },
        created_at: "2015-09-06 12:14:59.000Z",
        // Notice: The update time of newly received data is later than recordUpdatedAt.
        updated_at: "2016-09-07 12:14:59.000Z",
        closed_at: "2015-09-07 12:14:59.000Z",
        // Notice: there is no merge time for this test case.
        merged_at: null,
      };

      // Mock the repository function.
      const pullInDB = new Pull();
      pullInDB.id = 1;
      pullInDB.updatedAt = "2016-01-01 00:00:00.000Z";

      findOneMock.mockResolvedValue(pullInDB);
      saveMock.mockImplementation();

      // Execute the function to be tested.
      await pullService.syncPullRequest(syncPullQuery);

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();

      const pullBeSaved = saveMock.mock.calls[0][0];

      expect(pullBeSaved.id).toBe(1);
      expect(pullBeSaved.status).toBe("closed");
    });

    test("new pr with labels", async () => {
      const syncPullQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        state: "closed",
        title: "First PR",
        body: "",
        labels: [{ name: "type/feature" }, { name: "sig/community-infra" }],
        author_association: "MEMBER",
        user: {
          login: "c4pt0r",
        },
        created_at: "2015-09-06 12:14:59.000Z",
        updated_at: "2016-09-07 12:14:59.000Z",
        closed_at: "2015-09-07 12:14:59.000Z",
        merged_at: null,
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockImplementation();

      // Execute the function to be tested.
      await pullService.syncPullRequest(syncPullQuery);

      // Assert the data that will eventually be saved in the database.
      const pullBeSaved = saveMock.mock.calls[0][0];

      expect(pullBeSaved.label).toBe("type/feature,sig/community-infra");
    });

    test("PR author is org member", async () => {
      const syncPullQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        state: "open",
        title: "First PR",
        body: "",
        labels: [],
        author_association: "MEMBER",
        user: {
          login: "c4pt0r",
        },
        created_at: "2015-09-06 12:14:59.000Z",
        updated_at: "2016-09-07 12:14:59.000Z",
        closed_at: null,
        merged_at: null,
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockImplementation();

      // Execute the function to be tested.
      await pullService.syncPullRequest(syncPullQuery);

      // Assert the data that will eventually be saved in the database.
      const pullBeSaved = saveMock.mock.calls[0][0];

      expect(pullBeSaved.association).toBe("MEMBER");
      expect(pullBeSaved.relation).toBe("member");
    });

    afterEach(() => {
      findOneMock.mockClear();
      saveMock.mockClear();
    });
  });

  describe("Test for syncOpenPullRequestStatus", () => {
    let saveMock: jest.SpyInstance;
    let findOneMock: jest.SpyInstance;

    beforeAll(() => {
      saveMock = jest.spyOn(openPRStatusRepository, "save");
      saveMock.mockResolvedValue(undefined);
      findOneMock = jest.spyOn(openPRStatusRepository, "findOne");
      findOneMock.mockResolvedValue(undefined);
    });

    test("PR with review and comment", async () => {
      const lastCommitTime = "2020-12-12 12:12:12";
      const lastCommentTime = "2020-12-13 13:13:13";
      const lastReviewTime = "2020-12-14 14:14:14";

      await pullService.syncOpenPullRequestStatus({
        pull: {
          owner: "pingcap",
          repo: "tidb",
          pull_number: 1,
          updated_at: "",
          user: {
            login: "mini256",
          },
        },
        commits: [
          {
            commit: {
              committer: {
                name: "Mini256",
                date: "2020-10-10 10:10:10",
              },
            },
          },
          {
            commit: {
              committer: {
                name: "Mini256",
                // Last time to submit code.
                date: lastCommitTime,
              },
            },
          },
        ],
        comments: [
          {
            id: 103,
            body: "",
            created_at: "2020-10-10 10:10:10",
            updated_at: "2020-10-10 10:10:10",
            user: {
              login: "big1024",
            },
          },
        ],
        review_comments: [
          {
            id: 104,
            body: "",
            created_at: "2020-10-10 10:10:10",
            // Last comment time.
            updated_at: lastCommentTime,
            user: {
              login: "mini-bot",
            },
          },
        ],
        reviews: [
          {
            id: 101,
            body: "Great",
            submitted_at: "2020-10-10 10:10:10",
            user: {
              login: "big1024",
            },
          },
          {
            id: 102,
            body: "Nice",
            // Last review time.
            submitted_at: lastReviewTime,
            user: {
              login: "mini-bot",
            },
          },
        ],
      });

      expect(saveMock).toBeCalled();

      const statusBeSaved = saveMock.mock.calls[0][0];

      expect(statusBeSaved.lastUpdateCodeAt).toBe(lastCommitTime);
      expect(statusBeSaved.lastCommentAt).toBe(lastCommentTime);
      expect(statusBeSaved.lastReviewAt).toBe(lastReviewTime);
    });

    afterEach(() => {
      saveMock.mockClear();
    });
  });

  describe("Test for syncOpenPRLastCommentTime", () => {
    let saveMock: jest.SpyInstance;
    let findOneMock: jest.SpyInstance;

    beforeAll(() => {
      saveMock = jest.spyOn(openPRStatusRepository, "save");
      findOneMock = jest.spyOn(openPRStatusRepository, "findOne");
      saveMock.mockResolvedValue(undefined);
      findOneMock.mockResolvedValue(undefined);
    });

    test("PR's author leave a comment", async () => {
      await pullService.syncOpenPRLastCommentTime({
        pull: {
          owner: "pingcap",
          repo: "tidb",
          pull_number: 1,
          user: {
            login: "mini256",
          },
        },
        last_comment_author: {
          login: "mini256",
        },
        last_comment_time: "2020-10-10 10:10:10",
      });

      expect(saveMock).not.toBeCalled();
    });

    test("other reviewer leave a comment", async () => {
      const lastCommentTime = "2020-10-10 10:10:10";

      await pullService.syncOpenPRLastCommentTime({
        pull: {
          owner: "pingcap",
          repo: "tidb",
          pull_number: 1,
          user: {
            login: "mini256",
          },
        },
        last_comment_author: {
          login: "big1024",
        },
        last_comment_time: lastCommentTime,
      });

      expect(saveMock).toBeCalled();
      const statusBeSaved = saveMock.mock.calls[0][0];
      expect(statusBeSaved.lastCommentAt).toBe(lastCommentTime);
    });

    afterEach(() => {
      saveMock.mockClear();
    });
  });
});
