const typeorm = require("typeorm");
import { getLog } from "probot/lib/helpers/get-log";

import { ContributorRepository } from "../../src/repositories/ContributorRepository";
import {
  ContributorService,
  IContributorService,
} from "../../src/services/ContributorService";

describe("Test for CommentService", () => {
  const logger = getLog();
  const contributorRepository = new ContributorRepository();

  let contributorService: IContributorService;

  beforeAll(() => {
    contributorService = new ContributorService(contributorRepository, logger);
    typeorm.createConnection = jest.fn().mockResolvedValue(null);
  });

  describe("Test for syncContributorEmailFromPR", () => {
    let updateMock: jest.SpyInstance;

    beforeAll(() => {
      updateMock = jest.spyOn(contributorRepository, "updateEmailInfo");
      updateMock.mockResolvedValue(undefined);
    });

    test("pull patch with signed off email", async () => {
      await contributorService.syncContributorEmailFromPR({
        contributor_login: "zhangsan",
        pull_request_patch: `From 9b9d79f76edbe02310afc50a50d236d84bee44db Mon Sep 17 00:00:00 2001
        From: lisi <lisi1024@example.com>
        Date: Fri, 25 Dec 2020 11:00:42 +0800
        Subject: [PATCH 1/1] Update 5.txt
        
        Signed-off-by: zhangsan <zhangsan1024@example.com>
        ---`,
      });

      expect(updateMock).toBeCalled();
      const emailBeUpdated = updateMock.mock.calls[0][1];
      expect(emailBeUpdated).toBe("zhangsan1024@example.com");
    });

    test("pull patch without signed off email", async () => {
      await contributorService.syncContributorEmailFromPR({
        contributor_login: "lisi",
        pull_request_patch: `From 9b9d79f76edbe02310afc50a50d236d84bee44db Mon Sep 17 00:00:00 2001
        From: lisi <lisi1024@example.com>
        Date: Fri, 25 Dec 2020 11:00:42 +0800
        Subject: [PATCH 1/1] Update 5.txt
        ---`,
      });

      expect(updateMock).toBeCalled();
      const emailBeUpdated = updateMock.mock.calls[0][1];
      expect(emailBeUpdated).toBe("lisi1024@example.com");
    });

    test("pull patch without email", async () => {
      await contributorService.syncContributorEmailFromPR({
        contributor_login: "lisi",
        pull_request_patch: `From 9b9d79f76edbe02310afc50a50d236d84bee44db Mon Sep 17 00:00:00 2001
        From: -
        Date: Fri, 25 Dec 2020 11:00:42 +0800
        Subject: [PATCH 1/1] Update 5.txt
        ---`,
      });

      expect(updateMock).not.toBeCalled();
    });

    afterEach(() => {
      updateMock.mockClear();
    });
  });
});
