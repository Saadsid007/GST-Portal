interface JsonLdProps {
  schema: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;
}

/**
 * Renders structured data. The JSON is serialised by React into a script tag whose
 * type is not JavaScript, so it is never executed — but `<` is still escaped because
 * a `</script>` sequence inside string content would close the tag early.
 */
export function JsonLd({ schema }: JsonLdProps) {
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
