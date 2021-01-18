import { EntityRepository, Repository } from "typeorm";
import { Service } from "typedi";
import { Pull } from "../db/entities/Pull";

@Service()
@EntityRepository()
export class PullRepository extends Repository<Pull> {
  async getContributorAllPullRequest() {
    this.createQueryBuilder().select("");
  }
}
