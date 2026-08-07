# Marketplace logos

Drop a logo here as `<platform-id>.svg` and it appears automatically on the
platforms page and the homepage grid. No code change is needed —
`PlatformLogo` resolves `/platforms/<id>.svg` and falls back to a branded
monogram when the file is absent.

Expected ids (from `src/features/convert/config/platform.config.ts`):

    amazon.svg      flipkart.svg    meesho.svg
    myntra.svg      jiomart.svg     shopdeck.svg
    glowroad.svg    snapdeal.svg    roposo.svg
    custom.svg

## Before you add one

These are third-party trademarks. Each marketplace publishes brand guidelines
covering permitted use of its mark — check them before shipping. Most allow
factual, non-endorsing use ("works with Amazon") while prohibiting anything
implying partnership or endorsement.

Prefer the official SVG from the vendor's brand page over a traced copy: it
stays sharp at every size and avoids redistributing a derivative work.

Square-ish artwork with a little internal padding reads best; the component
renders on white with `object-contain`.
