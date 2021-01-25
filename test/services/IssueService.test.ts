import { Repository } from "typeorm";
import typeorm = require("typeorm");
import { getLog } from "probot/lib/helpers/get-log";

import { IIssueService, IssueService } from "../../src/services/IssueService";
import { Issue } from "../../src/db/entities/Issue";
import { SyncIssueQuery } from "../../src/queries/issue/SyncIssueQuery";

describe("Test for IssueService", () => {
  const logger = getLog();
  const issueRepository = new Repository<Issue>();

  let issueService: IIssueService;

  beforeAll(() => {
    issueService = new IssueService(issueRepository, logger);
  });

  beforeEach(() => {
    typeorm.createConnection = jest.fn().mockResolvedValue(null);
  });

  describe("Test for syncIssue", () => {
    let findOneMock: jest.SpyInstance;
    let saveMock: jest.SpyInstance;

    beforeAll(() => {
      findOneMock = jest.spyOn(issueRepository, "findOne");
      saveMock = jest.spyOn(issueRepository, "save");
    });

    test("no issue record in the DB", async () => {
      const syncIssueQuery: SyncIssueQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        title: "First Issue",
        body: "First Issue Content",
        labels: [
          { name: "challenge-program" },
          { name: "sig/community-infra" },
        ],
        state: "closed",
        user: {
          login: "Mini256",
        },
        author_association: "COLLABORATOR",
        created_at: "2016-10-25 13:27:21",
        updated_at: "2020-10-28 10:59:22",
        closed_at: "2020-10-28 10:59:22",
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockImplementation();

      // Execute the function to be tested.
      await issueService.syncIssue(syncIssueQuery);

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();

      const issueBeSaved = saveMock.mock.calls[0][0];

      expect(issueBeSaved).toEqual({
        id: undefined,
        owner: "pingcap",
        repo: "tidb",
        issueNumber: 1,
        title: "First Issue",
        body: "First Issue Content",
        status: "closed",
        label: "challenge-program,sig/community-infra",
        user: "Mini256",
        association: "COLLABORATOR",
        relation: "not member",
        createdAt: "2016-10-25 13:27:21",
        updatedAt: "2020-10-28 10:59:22",
        closedAt: "2020-10-28 10:59:22",
      });
    });

    test("related issue record in the DB but received data is out-of-date", async () => {
      const syncIssueQuery: SyncIssueQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        title: "First Issue",
        body: "First Issue Content",
        labels: [
          { name: "challenge-program" },
          { name: "sig/community-infra" },
        ],
        state: "closed",
        user: {
          login: "Mini256",
        },
        author_association: "COLLABORATOR",
        created_at: "2016-10-25 13:27:21",
        // Notice: The update time received is later than the update time in the database.
        updated_at: "2016-10-25 13:27:21",
        closed_at: "2016-10-25 13:27:21",
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        updatedAt: "2021-1-15 17:21:22",
      });
      saveMock.mockImplementation();

      // Execute the function to be tested.
      await issueService.syncIssue(syncIssueQuery);

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).not.toBeCalled();
    });

    test("related issue record in the DB but received data is latest", async () => {
      const syncIssueQuery: SyncIssueQuery = {
        owner: "pingcap",
        repo: "tidb",
        number: 1,
        title: "First Issue",
        body: "First Issue Content",
        labels: [
          { name: "challenge-program" },
          { name: "sig/community-infra" },
        ],
        state: "closed",
        user: {
          login: "Mini256",
        },
        author_association: "COLLABORATOR",
        created_at: "2016-10-25 13:27:21",
        // Notice: The update time received is earlier than the update time in the database.
        updated_at: "2021-1-15 17:21:22",
        closed_at: "2021-1-15 17:21:22",
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        issueNumber: 1,
        updatedAt: "2016-10-25 13:27:21",
        createdAt: "2016-10-25 13:27:21",
      });
      saveMock.mockImplementation();

      // Execute the function to be tested.
      await issueService.syncIssue(syncIssueQuery);

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();

      const issueBeSaved = saveMock.mock.calls[0][0];

      expect(issueBeSaved).toEqual({
        id: 1,
        owner: "pingcap",
        repo: "tidb",
        issueNumber: 1,
        title: "First Issue",
        body: "First Issue Content",
        status: "closed",
        label: "challenge-program,sig/community-infra",
        user: "Mini256",
        association: "COLLABORATOR",
        relation: "not member",
        createdAt: "2016-10-25 13:27:21",
        updatedAt: "2021-1-15 17:21:22",
        closedAt: "2021-1-15 17:21:22",
      });
    });

    afterEach(() => {
      findOneMock.mockClear();
      saveMock.mockClear();
    });
  });
});
