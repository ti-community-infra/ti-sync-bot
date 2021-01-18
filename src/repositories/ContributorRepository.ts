import { EntityRepository, Repository } from "typeorm";
import { Service } from "typedi";
import { ContributorInfo } from "../db/entities/ContributorInfo";

@Service()
@EntityRepository(ContributorInfo)
export class ContributorRepository extends Repository<ContributorInfo> {
  /**
   * Get a Github login list of contributors without email information.
   * Notice: Contributors without email information may not have recorded any information, so it
   * will not exist in the contributor info table.
   */
  async listNoEmailContributorLogin(): Promise<string[]> {
    const wheres =
      "where user not in (select github from contributor_info where email is not null) and status='merged'";
    const rawSQL = `select distinct(user) as user from pulls ${wheres}`;

    return await this.manager.connection.createQueryRunner().query(rawSQL);
  }

  /**
   * Update contributor’s email information.
   * @param login GitHub login of contributor.
   * @param email
   */
  async updateEmailInfo(login: string, email: string) {
    let contributorInfoStored = await this.findOne({
      github: login,
    });
    let contributorInfoBeSaved;

    if (contributorInfoStored === undefined) {
      contributorInfoBeSaved = new ContributorInfo();
      contributorInfoBeSaved.github = login;
    } else {
      contributorInfoBeSaved = {
        ...contributorInfoStored,
        email: email,
      };
    }

    await this.save(contributorInfoBeSaved);
  }
}
