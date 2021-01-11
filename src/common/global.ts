import { Token } from "typedi";
import { DeprecatedLogger } from "probot/lib/types";

export const ILoggerToken = new Token<DeprecatedLogger>();
