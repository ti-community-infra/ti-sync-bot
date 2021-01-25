// import nock from "nock";
import { Repository } from "typeorm";
const typeorm = require("typeorm");
import { getLog } from "probot/lib/helpers/get-log";

import {
  CommentService,
  ICommentService,
} from "../../src/services/CommentService";
import { Comment } from "../../src/db/entities/Comment";
import { SyncPullReviewsQuery } from "../../src/queries/comment/SyncPullReviewsQuery";
import { flushPromises } from "../../src/utils/test";
import { SyncPullCommentsQuery } from "../../src/queries/comment/SyncPullCommentsQuery";
import { SyncPullReviewCommentsQuery } from "../../src/queries/comment/SyncPullReviewCommentsQuery";
import { SyncIssueCommentsQuery } from "../../lib/queries/comment/SyncIssueCommentsQuery";

describe("Test for CommentService", () => {
  const logger = getLog();
  const commentRepository = new Repository<Comment>();

  let commentService: ICommentService;
  let findOneMock: jest.SpyInstance;
  let saveMock: jest.SpyInstance;

  beforeAll(() => {
    commentService = new CommentService(commentRepository, logger);
  });

  beforeEach(() => {
    typeorm.createConnection = jest.fn().mockResolvedValue(null);
    findOneMock = jest.spyOn(commentRepository, "findOne");
    saveMock = jest.spyOn(commentRepository, "save");
  });

  describe("Test for syncPullRequestReviews", () => {
    test("no review record in the DB", async () => {
      const syncPullReviewQuery: SyncPullReviewsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        reviews: [
          {
            id: 80,
            body: "First Review",
            user: {
              login: "Mini256",
            },
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
            author_association: "MEMBER",
            submitted_at: "2020-12-30 06:54:09",
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestReviews(syncPullReviewQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      expect(saveMock.mock.calls[0][0]).toEqual({
        id: undefined,
        body: "First Review",
        commentId: 80,
        commentType: "review",
        createdAt: "2020-12-30 06:54:09",
        owner: "octocat",
        pullNumber: 12,
        association: "MEMBER",
        relation: "member",
        repo: "Hello-World",
        updatedAt: "2020-12-30 06:54:09",
        url:
          "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
        user: "Mini256",
      });
    });

    test("review record in the DB but received data is out-of-date", async () => {
      const syncPullReviewQuery: SyncPullReviewsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        reviews: [
          {
            id: 80,
            body: "First Review",
            user: {
              login: "Mini256",
            },
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
            author_association: "MEMBER",
            // Notice: The update time of the receive data is earlier than the update time in the database.
            submitted_at: "2000-01-01 00:00:00",
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        // The update time of comment in the DB.
        updatedAt: "2020-12-31 23:29:29",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestReviews(syncPullReviewQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).not.toBeCalled();
    });

    test("review record in the DB and the received data is newer", async () => {
      const syncPullReviewQuery: SyncPullReviewsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        reviews: [
          {
            id: 80,
            body: "First Review",
            user: {
              login: "Mini256",
            },
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
            author_association: "MEMBER",
            // Notice: The time to receive the data is later than the update at in the database.
            submitted_at: "2020-12-31 23:29:29",
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        commentId: 80,
        createdAt: "2000-01-01 00:00:00",
        // The update time of comment in the DB.
        updatedAt: "2000-01-01 00:00:00",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestReviews(syncPullReviewQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      const commentBeSaved = saveMock.mock.calls[0][0];
      expect(commentBeSaved).toEqual({
        id: 1,
        commentId: 80,
        association: "MEMBER",
        body: "First Review",
        owner: "octocat",
        relation: "member",
        repo: "Hello-World",
        createdAt: "2000-01-01 00:00:00",
        updatedAt: "2020-12-31 23:29:29",
        url:
          "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
      });
    });
  });

  describe("Test for syncPullRequestReviewComments", () => {
    test("no review comment record in the DB", async () => {
      const syncPullReviewCommentsQuery: SyncPullReviewCommentsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        review_comments: [
          {
            id: 80,
            body: "First Review Comment",
            user: {
              login: "Mini256",
            },
            author_association: "CONTRIBUTOR",
            html_url:
              "https://github.com/octocat/Hello-World/pull/12#discussion-diff-8",
            created_at: "2000-01-01 00:00:00",
            updated_at: "2002-02-02 00:00:00",
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestReviewComments(
        syncPullReviewCommentsQuery
      );

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      expect(saveMock.mock.calls[0][0]).toEqual({
        commentType: "review comment",
        owner: "octocat",
        repo: "Hello-World",
        pullNumber: 12,
        commentId: 80,
        user: "Mini256",
        body: "First Review Comment",
        association: "CONTRIBUTOR",
        relation: "not member",
        url: "https://github.com/octocat/Hello-World/pull/12#discussion-diff-8",
        createdAt: "2000-01-01 00:00:00",
        updatedAt: "2002-02-02 00:00:00",
      });
    });

    test("review comment record in the DB but received data is out-of-date", async () => {
      const syncPullReviewCommentsQuery: SyncPullReviewCommentsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        review_comments: [
          {
            id: 80,
            body: "First Review Comment",
            user: {
              login: "Mini256",
            },
            author_association: "CONTRIBUTOR",
            html_url:
              "https://github.com/octocat/Hello-World/pull/12#discussion-diff-8",
            created_at: "2000-01-01 00:00:00",
            // Notice: The update time of the receive data is earlier than the update time in the DB.
            updated_at: "2000-01-01 00:00:00",
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        // The update time of comment in the DB.
        updatedAt: "2020-12-31 23:29:29",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestReviewComments(
        syncPullReviewCommentsQuery
      );

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).not.toBeCalled();
    });

    test("review comment record in the DB and the received data is newer", async () => {
      const syncPullReviewCommentsQuery: SyncPullReviewCommentsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        review_comments: [
          {
            id: 80,
            body: "First Review Comment",
            user: {
              login: "Mini256",
            },
            author_association: "CONTRIBUTOR",
            html_url:
              "https://github.com/octocat/Hello-World/pull/12#discussion-diff-8",
            created_at: "2000-01-01 00:00:00",
            // Notice: The update time of the receive data is earlier than the update time in the DB.
            updated_at: "2020-12-31 23:29:29",
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        commentId: 80,
        createdAt: "2000-01-01 00:00:00",
        // The update time of comment in the DB.
        updatedAt: "2000-01-01 00:00:00",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestReviewComments(
        syncPullReviewCommentsQuery
      );

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      const commentBeSaved = saveMock.mock.calls[0][0];
      expect(commentBeSaved).toEqual({
        owner: "octocat",
        repo: "Hello-World",
        id: 1,
        commentId: 80,
        body: "First Review Comment",
        association: "CONTRIBUTOR",
        relation: "not member",
        url: "https://github.com/octocat/Hello-World/pull/12#discussion-diff-8",
        createdAt: "2000-01-01 00:00:00",
        updatedAt: "2020-12-31 23:29:29",
      });
    });
  });

  describe("Test for syncPullRequestComments", () => {
    test("no comment record in the DB", async () => {
      const syncPullCommentQuery: SyncPullCommentsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        comments: [
          {
            id: 80,
            author_association: "MEMBER",
            body: "First Comment",
            created_at: "2000-01-01 00:00:00",
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#issuecomment-80",
            updated_at: "2002-02-02 00:00:00",
            user: {
              login: "Mini256",
            },
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestComments(syncPullCommentQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      expect(saveMock.mock.calls[0][0]).toEqual({
        association: "MEMBER",
        body: "First Comment",
        commentId: 80,
        commentType: "common comment",
        createdAt: "2000-01-01 00:00:00",
        owner: "octocat",
        pullNumber: 12,
        relation: "member",
        repo: "Hello-World",
        updatedAt: "2002-02-02 00:00:00",
        url: "https://github.com/octocat/Hello-World/issues/12#issuecomment-80",
        user: "Mini256",
      });
    });

    test("comment record in the DB but received data is out-of-date", async () => {
      const syncPullCommentsQuery: SyncPullCommentsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        comments: [
          {
            id: 80,
            author_association: "MEMBER",
            body: "First Comment",
            created_at: "2000-01-01 00:00:00",
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
            // Notice: The update time of the receive data is earlier than the update time in the database.
            updated_at: "2000-01-01 00:00:00",
            user: {
              login: "Mini256",
            },
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        // The update time of comment in the DB.
        updatedAt: "2020-12-31 23:29:29",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestComments(syncPullCommentsQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).not.toBeCalled();
    });

    test("comment record in the DB and the received data is newer", async () => {
      const syncPullCommentsQuery: SyncPullCommentsQuery = {
        pull: {
          owner: "octocat",
          repo: "Hello-World",
          pull_number: 12,
        },
        comments: [
          {
            id: 80,
            author_association: "MEMBER",
            body: "First Comment",
            created_at: "2000-01-01 00:00:00",
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
            // Notice: The time to receive the data is later than the update at in the database.
            updated_at: "2020-12-31 23:29:29",
            user: {
              login: "Mini256",
            },
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        commentId: 80,
        // The update time of comment in the DB.
        updatedAt: "2000-01-01 00:00:00",
        createdAt: "2000-01-01 00:00:00",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncPullRequestComments(syncPullCommentsQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      const commentBeSaved = saveMock.mock.calls[0][0];
      expect(commentBeSaved).toEqual({
        owner: "octocat",
        repo: "Hello-World",
        id: 1,
        commentId: 80,
        body: "First Comment",
        association: "MEMBER",
        relation: "member",
        url:
          "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
        createdAt: "2000-01-01 00:00:00",
        updatedAt: "2020-12-31 23:29:29",
      });
    });
  });

  describe("Test for syncIssueComments", () => {
    test("no comment record in the DB", async () => {
      const syncIssueCommentsQuery: SyncIssueCommentsQuery = {
        issue: {
          owner: "octocat",
          repo: "Hello-World",
          issue_number: 12,
        },
        comments: [
          {
            id: 80,
            author_association: "MEMBER",
            body: "First Comment",
            created_at: "2000-01-01 00:00:00",
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#issuecomment-80",
            updated_at: "2002-02-02 00:00:00",
            user: {
              login: "Mini256",
            },
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue(undefined);
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncIssueComments(syncIssueCommentsQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      expect(saveMock.mock.calls[0][0]).toEqual({
        association: "MEMBER",
        body: "First Comment",
        commentId: 80,
        commentType: "common comment",
        createdAt: "2000-01-01 00:00:00",
        owner: "octocat",
        pullNumber: 12,
        relation: "member",
        repo: "Hello-World",
        updatedAt: "2002-02-02 00:00:00",
        url: "https://github.com/octocat/Hello-World/issues/12#issuecomment-80",
        user: "Mini256",
      });
    });

    test("comment record in the DB but received data is out-of-date", async () => {
      const syncIssueCommentsQuery: SyncIssueCommentsQuery = {
        issue: {
          owner: "octocat",
          repo: "Hello-World",
          issue_number: 12,
        },
        comments: [
          {
            id: 80,
            author_association: "MEMBER",
            body: "First Comment",
            created_at: "2000-01-01 00:00:00",
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
            // Notice: The update time of the receive data is earlier than the update time in the database.
            updated_at: "2000-01-01 00:00:00",
            user: {
              login: "Mini256",
            },
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        // The update time of comment in the DB.
        updatedAt: "2020-12-31 23:29:29",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncIssueComments(syncIssueCommentsQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).not.toBeCalled();
    });

    test("comment record in the DB and the received data is newer", async () => {
      const syncPullCommentsQuery: SyncIssueCommentsQuery = {
        issue: {
          owner: "octocat",
          repo: "Hello-World",
          issue_number: 12,
        },
        comments: [
          {
            id: 80,
            author_association: "MEMBER",
            body: "First Comment",
            created_at: "2000-01-01 00:00:00",
            html_url:
              "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
            // Notice: The time to receive the data is later than the update at in the database.
            updated_at: "2020-12-31 23:29:29",
            user: {
              login: "Mini256",
            },
          },
        ],
      };

      // Mock the repository function.
      findOneMock.mockResolvedValue({
        id: 1,
        commentId: 80,
        // The update time of comment in the DB.
        updatedAt: "2000-01-01 00:00:00",
        createdAt: "2000-01-01 00:00:00",
      });
      saveMock.mockResolvedValue(undefined);

      // Execute the function to be tested.
      await commentService.syncIssueComments(syncPullCommentsQuery);

      // Notice: Wait for the async function to complete.
      await flushPromises();

      // Assert the data that will eventually be saved in the database.
      expect(saveMock).toBeCalled();
      const commentBeSaved = saveMock.mock.calls[0][0];
      expect(commentBeSaved).toEqual({
        owner: "octocat",
        repo: "Hello-World",
        id: 1,
        commentId: 80,
        body: "First Comment",
        association: "MEMBER",
        relation: "member",
        url:
          "https://github.com/octocat/Hello-World/issues/12#pullrequestreview-80",
        createdAt: "2000-01-01 00:00:00",
        updatedAt: "2020-12-31 23:29:29",
      });
    });
  });

  afterEach(() => {
    findOneMock.mockClear();
    saveMock.mockClear();
  });
});
