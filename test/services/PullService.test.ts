import nock from "nock";
import { Repository } from "typeorm";
import typeorm = require("typeorm");
import { getLog } from "probot/lib/helpers/get-log";

import { IPullService, PullService } from "../../src/services/PullService";
import { Pull } from "../../src/db/entities/Pull";

describe("Test for PullService", () => {
  const logger = getLog();
  const pullRepository = new Repository<Pull>();

  let pullService: IPullService;

  beforeAll(() => {
    pullService = new PullService(pullRepository, logger);
  });

  beforeEach(() => {
    nock.disableNetConnect();
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
        pull: {
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
        },
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
        pull: {
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
        },
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
        pull: {
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
        },
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
        pull: {
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
        },
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
        pull: {
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
        },
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

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});
