/**
 * The zod 4 form of v3's `required_error`.
 *
 * zod 4 dropped `required_error` / `invalid_type_error` in favour of one `error` option
 * per schema, which by default applies to **every** issue that schema raises. Writing
 * `error: 'X'` would therefore also label a wrong type or an explicit `null` as
 * "required" — text that changed nothing before and that clients may be matching on.
 *
 * Returning `undefined` is how an error map says "no opinion": the message applies only
 * when the value is missing, which is exactly the branch `required_error` used to cover.
 */
export function required(message: string) {
  return {
    error: (issue: { input?: unknown }) => (issue.input === undefined ? message : undefined),
  };
}
