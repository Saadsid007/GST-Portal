import type { PlatformConfig } from "@/features/convert/config/platform.config";
import type { BasePlatformParser } from "@/features/convert/parsers/base.parser";
import type { ColumnMappingDict } from "@/features/convert/engine/mapping/mapping.templates";
import type { PlatformRuleConfig } from "@/features/convert/engine/rules/rule.config";

export interface MarketplacePlugin {
  config: PlatformConfig;
  parser: BasePlatformParser;
  defaultMapping: ColumnMappingDict;
  rules: PlatformRuleConfig;
  versions: string[];
}
