/**
 * Platform Registry — single source of truth for all supported parsers.
 * To add a new platform: create a parser and add it here.
 */

import { AmazonParser } from "./amazon.parser";
import { FlipkartParser } from "./flipkart.parser";
import { GlowRoadParser } from "./glowroad.parser";
import { JioMartParser } from "./jiomart.parser";
import { MeeshoParser } from "./meesho.parser";
import { MyntraParser } from "./myntra.parser";
import { RoposoParser } from "./roposo.parser";
import { ShopdeckParser } from "./shopdeck.parser";
import { SnapdealParser } from "./snapdeal.parser";
import { CustomParser } from "./custom.parser";
import type { BasePlatformParser } from "./base.parser";

// --- Registry ---
const parsers: BasePlatformParser[] = [
  new AmazonParser(),
  new FlipkartParser(),
  new MeeshoParser(),
  new JioMartParser(),
  new ShopdeckParser(),
  new GlowRoadParser(),
  new MyntraParser(),
  new SnapdealParser(),
  new RoposoParser(),
  new CustomParser(),
];

/** Get all platform info objects for UI display */
export function getAllPlatforms() {
  return parsers.map((p) => p.info);
}

/** Get a specific parser by platform ID */
export function getParser(platformId: string): BasePlatformParser {
  const parser = parsers.find((p) => p.info.id === platformId);
  if (!parser) {
    // Fallback to custom parser
    return new CustomParser();
  }
  return parser;
}

export type { BasePlatformParser };
