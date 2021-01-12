import nock from "nock";
import { IPullService, PullService } from "../../src/services/PullService";
import { Repository } from "typeorm";
import { Pull } from "../../src/db/entities/Pull";
import { getLog } from "probot/lib/helpers/get-log";
import { SyncPullQuery } from "../../src/queries/SyncPullQuery";
const typeorm = require("typeorm");

describe("Test for PullService", () => {
  let pullService: IPullService;
  let logger = getLog();
  let pullRepository = new Repository<Pull>();

  beforeAll(() => {
    pullService = new PullService(pullRepository, logger);
  });

  beforeEach(() => {
    nock.disableNetConnect();
    typeorm.createConnection = jest.fn().mockResolvedValue(null);
  });

  describe("Test for syncPullRequest", () => {
    // Data in the database, if there are pr records in the database.
    const recordId = 1;
    const recordUpdatedAt = "2016-01-01 00:00:00.000Z";

    const testcases: {
      name: string;
      syncPullQuery: SyncPullQuery;
      dbExistedRecord: boolean;
      // Whether to expect the save method of the repository to be called.
      expectSaveCalled: boolean;
      // Expected final saved data.
      expectSavedId?: number;
      expectSavedStatus?: string;
      expectSavedLabel?: string;
    }[] = [
      {
        name: "no related PR records in the database",
        syncPullQuery: {
          owner: "pingcap",
          repo: "tidb",
          pull: {
            number: 2,
            state: "closed",
            title: "First PR",
            body: "",
            labels: [],
            locked: false,
            author_association: "MEMBER",
            merge_commit_sha: "09c800a71c05093a6501efdbbac52ace9c07e0ea",
            user: {
              id: 1,
              login: "c4pt0r",
              type: "user",
            },
            created_at: "2015-09-06 12:14:59.000Z",
            updated_at: "2015-09-07 12:14:59.000Z",
            closed_at: "2015-09-07 12:14:59.000Z",
            merged_at: "2015-09-07 12:14:59.000Z",
          },
        },
        dbExistedRecord: false,
        expectSaveCalled: true,
        expectSavedId: undefined,
        expectSavedStatus: "merged",
        expectSavedLabel: "",
      },
      {
        name:
          "related PR stored in database, but the received PR data is out of date",
        syncPullQuery: {
          owner: "pingcap",
          repo: "tidb",
          pull: {
            number: 2,
            state: "closed",
            title: "First PR",
            body: "",
            labels: [],
            locked: false,
            author_association: "MEMBER",
            merge_commit_sha: "09c800a71c05093a6501efdbbac52ace9c07e0ea",
            user: {
              id: 1,
              login: "c4pt0r",
              type: "user",
            },
            created_at: "2015-09-06 12:14:59.000Z",
            // Notice: The update time of newly received data is earlier than recordUpdatedAt.
            updated_at: "2015-09-07 12:14:59.000Z",
            closed_at: "2015-09-07 12:14:59.000Z",
            merged_at: "2015-09-07 12:14:59.000Z",
          },
        },
        dbExistedRecord: true,
        expectSaveCalled: false,
      },
      {
        name:
          "related PR records in the database and the newly received PR data is the latest",
        syncPullQuery: {
          owner: "pingcap",
          repo: "tidb",
          pull: {
            number: 0,
            state: "closed",
            title: "First PR",
            body: "",
            labels: [],
            locked: false,
            author_association: "MEMBER",
            merge_commit_sha: "09c800a71c05093a6501efdbbac52ace9c07e0ea",
            user: {
              id: 1,
              login: "c4pt0r",
              type: "user",
            },
            created_at: "2015-09-06 12:14:59.000Z",
            // Notice: The update time of newly received data is later than recordUpdatedAt.
            updated_at: "2016-09-07 12:14:59.000Z",
            closed_at: "2015-09-07 12:14:59.000Z",
            // Notice: there is no merge time for this test case.
            merged_at: null,
          },
        },
        dbExistedRecord: true,
        expectSaveCalled: true,
        expectSavedId: recordId,
        expectSavedStatus: "closed",
      },
      {
        name: "new pr with labels",
        syncPullQuery: {
          owner: "pingcap",
          repo: "tidb",
          pull: {
            number: 2,
            state: "closed",
            title: "First PR",
            body: "",
            labels: [
              { id: 1, name: "type/feature" },
              { id: 2, name: "sig/community-infra" },
            ],
            locked: false,
            author_association: "MEMBER",
            merge_commit_sha: "09c800a71c05093a6501efdbbac52ace9c07e0ea",
            user: {
              id: 1,
              login: "c4pt0r",
              type: "user",
            },
            created_at: "2015-09-06 12:14:59.000Z",
            updated_at: "2016-09-07 12:14:59.000Z",
            closed_at: "2015-09-07 12:14:59.000Z",
            merged_at: null,
          },
        },
        dbExistedRecord: false,
        expectSaveCalled: true,
        expectSavedLabel: "type/feature,sig/community-infra",
      },
    ];

    for (let tc of testcases) {
      test(tc.name, async () => {
        // Mock the find one function.
        const findOneMock = jest.spyOn(pullRepository, "findOne");
        const saveMock = jest.spyOn(pullRepository, "save");

        saveMock.mockImplementation();

        if (tc.dbExistedRecord) {
          const pullInDB = new Pull();
          pullInDB.id = recordId;
          pullInDB.updatedAt = recordUpdatedAt;
          findOneMock.mockResolvedValue(pullInDB);
        } else {
          findOneMock.mockResolvedValue(undefined);
        }

        // Execute the function to be tested.
        await pullService.syncPullRequest(tc.syncPullQuery);

        if (tc.expectSaveCalled) {
          // Assert the data that will eventually be saved in the database.
          const pullStored = saveMock.mock.calls[0][0];

          expect(pullStored.id).toBe(tc.expectSavedId);

          if (tc.expectSavedStatus !== undefined) {
            expect(pullStored.status).toBe(tc.expectSavedStatus);
          }
          if (tc.expectSavedLabel !== undefined) {
            expect(pullStored.label).toBe(tc.expectSavedLabel);
          }
        } else {
          expect(saveMock).not.toBeCalled();
        }

        // Clear the function call record.
        saveMock.mockClear();
        findOneMock.mockClear();
      });
    }
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});
