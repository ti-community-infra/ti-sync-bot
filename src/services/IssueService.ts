import { Inject, Service, Token } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Repository } from "typeorm";
import { Logger } from "probot";

import { time } from "../utils/time";
import { ILoggerToken } from "../common/token";

import { Issue } from "../db/entities/Issue";
import { SyncIssueQuery } from "../queries/issue/SyncIssueQuery";
import { encodeLabelArray } from "../utils/parser";

export const IIssueServiceToken = new Token<IIssueService>();

export interface IIssueService {
  syncIssue(query: SyncIssueQuery): Promise<void>;
}

@Service(IIssueServiceToken)
export class IssueService implements IIssueService {
  constructor(
    @InjectRepository(Issue)
    private issueRepository: Repository<Issue>,
    @Inject(ILoggerToken)
    private log: Logger
  ) {}

  /**
   * Synchronize the received Issue data to the database.
   * @param issueReceived The type of received Issue can be review, review Issue and common Issue.
   */
  async syncIssue(issueReceived: SyncIssueQuery) {
    const { repo, owner, number: issueNumber } = issueReceived;
    const issueSignature = `${owner}/${repo}#${issueNumber}`;

    // Get issues from the database.
    let issueStored = await this.getIssueByIssueNumber(issueNumber);
    if (issueStored === undefined) {
      issueStored = IssueService.makeIssue(issueReceived);
    }

    // Ignore outdated issue data.
    if (!IssueService.isIssueUpdated(issueReceived, issueStored)) {
      this.log.info(`sync issue ${issueSignature}, but not updated`);
      return;
    }

    // Patch issue.
    const issueBeSaved = IssueService.patchIssue(issueStored, issueReceived);

    // Save issue.
    try {
      await this.issueRepository.save(issueBeSaved);
      this.log.info(`sync issue ${issueSignature} success`);
    } catch (err) {
      this.log.error(`failed to save issue ${issueSignature}: ${err}`);
    }
  }

  /**
   * Get issues from the database based on the issue number.
   * @param issueNumber
   */
  private getIssueByIssueNumber(
    issueNumber: number
  ): Promise<Issue | undefined> {
    return this.issueRepository.findOne({
      where: {
        issueNumber: issueNumber,
      },
    });
  }

  /**
   * Make a new issue entity according the received data.
   * @param issueReceived
   */
  private static makeIssue(issueReceived: SyncIssueQuery): Issue {
    const newIssue = new Issue();

    // Notice: These attributes must not be changed in the future.
    newIssue.issueNumber = issueReceived.number;
    newIssue.createdAt = issueReceived.created_at;

    return newIssue;
  }

  /**
   * Patch the issue attributes that need to be updated.
   * @param issueStored
   * @param issueReceived
   * @return issue after patch.
   */
  private static patchIssue(
    issueStored: Issue,
    issueReceived: SyncIssueQuery
  ): Issue {
    const newIssue = {
      ...issueStored,
      owner: issueReceived.owner,
      repo: issueReceived.repo,
      title: issueReceived.title,
      body: issueReceived.body || "",
      user: issueReceived.user?.login || "",
      association: issueReceived.author_association,
      label: encodeLabelArray(issueReceived.labels),
      status: issueReceived.state,
      updatedAt: issueReceived.updated_at,
      closedAt: issueReceived.closed_at || "",
    };

    if (issueReceived.author_association === "MEMBER") {
      newIssue.relation = "member";
    } else {
      newIssue.relation = "not member";
    }

    return newIssue;
  }

  private static isIssueUpdated(
    issueReceived: SyncIssueQuery,
    issueStored: Issue
  ): boolean {
    return time(issueReceived.updated_at).laterThan(
      time(issueStored.updatedAt)
    );
  }
}
