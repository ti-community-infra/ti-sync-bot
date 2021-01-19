import { SyncContributorEmailQuery } from "../queries/contributor/SyncContributorEmailQuery";
import { Inject, Service, Token } from "typedi";

import { ILoggerToken } from "../common/token";
import { Logger } from "probot";
import { ContributorRepository } from "../repositories/ContributorRepository";
import { InjectRepository } from "typeorm-typedi-extensions";

export const IContributorServiceToken = new Token<IContributorService>();

export interface IContributorService {
  listNoEmailContributorsLogin(): Promise<string[]>;
  syncContributorEmailFromPR(
    query: SyncContributorEmailQuery
  ): Promise<boolean>;
}

@Service(IContributorServiceToken)
export class ContributorService implements IContributorService {
  constructor(
    @InjectRepository()
    private contributorRepository: ContributorRepository,
    @Inject(ILoggerToken)
    private log: Logger
  ) {}

  async listNoEmailContributorsLogin() {
    return await this.contributorRepository.listNoEmailContributorLogin();
  }

  async syncContributorEmailFromPR(
    query: SyncContributorEmailQuery
  ): Promise<boolean> {
    const { contributor_login: login, pull_request_patch: patch } = query;
    const emailFound = await ContributorService.extractEmailFromPRPatch(patch);

    if (emailFound === null) {
      return false;
    }

    try {
      await this.contributorRepository.updateEmailInfo(login, emailFound);
      this.log.info(
        `sync contributor ${login} with email ${emailFound} success`
      );
      return true;
    } catch (err) {
      this.log.error(`failed to sync contributor email ${err}`);
      return false;
    }
  }

  /**
   * Extract email information from the patch content of the pull request.
   * Notice: Priority select the email in the commit message.
   * The example of pull request patch: https://patch-diff.githubusercontent.com/raw/tikv/tikv/pull/9385.patch
   * @param patch
   * @return return to email when found, null means not found.
   * @private
   */
  private static extractEmailFromPRPatch(patch: string): string | null {
    // Obtain the email address from commit message.
    // For example:
    // Signed-off-by: zhangsan <zhangsan@example.com>
    let signOffMatches = patch?.match(/Signed-off-by:.*/);

    if (signOffMatches !== null) {
      for (let signOffMatch of signOffMatches) {
        let matches = signOffMatch.match(
          /\<(\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*)\>/
        );

        if (matches !== null && matches[1] !== undefined) {
          return matches[1];
        }
      }
    }

    // Obtain the email address from the signature of the commit author.
    // For example:
    // From: zhangsan <zhangsan@example.com>
    let fromMatches = patch?.match(/From:.*/);

    if (fromMatches !== null) {
      for (let fromMatch of fromMatches) {
        let matches = fromMatch.match(
          /\<(\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*)\>/
        );

        if (matches !== null && matches[1] !== undefined) {
          return matches[1];
        }
      }
    }

    return null;
  }
}
