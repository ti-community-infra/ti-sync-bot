import { Token } from "typedi";
import { Logger } from "probot";

export const ILoggerToken = new Token<Logger>();
