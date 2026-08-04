import type { MarketplacePlugin } from "./base.plugin";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { getParser } from "@/features/convert/parsers";
import { PREDEFINED_TEMPLATES } from "@/features/convert/engine/mapping/mapping.templates";
import { getPlatformRule } from "@/features/convert/engine/rules/rule.config";

class MarketplaceRegistry {
  private plugins = new Map<string, MarketplacePlugin>();

  constructor() {
    for (const plat of PLATFORMS_CONFIG) {
      this.plugins.set(plat.id, {
        config: plat,
        parser: getParser(plat.id),
        defaultMapping: PREDEFINED_TEMPLATES[plat.id] ?? {},
        rules: getPlatformRule(plat.id),
        versions: ["v1", "v2"],
      });
    }
  }

  getPlugin(platformId: string): MarketplacePlugin | undefined {
    return this.plugins.get(platformId) ?? this.plugins.get("custom");
  }

  getAllPlugins(): MarketplacePlugin[] {
    return Array.from(this.plugins.values());
  }

  registerPlugin(plugin: MarketplacePlugin) {
    this.plugins.set(plugin.config.id, plugin);
  }
}

export const marketplaceRegistry = new MarketplaceRegistry();
