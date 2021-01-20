import { EntityRepository, Repository } from "typeorm";
import { Service } from "typedi";
import { Pull } from "../db/entities/Pull";

@Service()
@EntityRepository(Pull)
export class PullRepository extends Repository<Pull> {}
