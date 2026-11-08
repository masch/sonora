import fs from 'node:fs/promises';
import path from 'node:path';

import { type ConfigPlugin, IOSConfig, withXcodeProject } from 'expo/config-plugins';

/**
 * The Info.plist key iOS answers the "while using the app" location prompt with.
 * `expo-location`'s plugin writes its unlocalized value; the per-language
 * `InfoPlist.strings` written below is what iOS prefers at runtime.
 */
export const LOCATION_USAGE_INFO_PLIST_KEY = 'NSLocationWhenInUseUsageDescription';

/** Where Expo prebuild keeps the app's localized strings. */
const SUPPORTING_DIRECTORY = 'Supporting';
const STRINGS_FILE_NAME = 'InfoPlist.strings';

export type LocalizedLocationPermissionProps = {
  /**
   * Usage-description copy keyed by language, one entry per declared language. The i18n
   * resources are the single source of this copy; the plugin only transports it into the
   * native project, so no user-facing sentence is restated here.
   */
  messages: Record<string, string>;
};

function escapeStringsValue(message: string): string {
  return message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * The body of `<language>.lproj/InfoPlist.strings` for one language: a `.strings` file
 * holds `key = "value";` pairs, and iOS picks the file by the `.lproj` folder it sits in,
 * which is why the file itself carries no language-specific key.
 *
 * A language without copy is refused rather than written empty: an empty usage
 * description is rejected on upload, and a silently skipped language would leave the
 * permission prompt untranslated with nothing to show for it.
 */
export function buildInfoPlistStrings(
  language: string,
  messages: Readonly<Record<string, string>>,
): string {
  const message = messages[language];
  if (!message) {
    throw new Error(
      `No ${LOCATION_USAGE_INFO_PLIST_KEY} copy is declared for language "${language}". ` +
        `Declared languages: ${Object.keys(messages).join(', ')}.`,
    );
  }

  return `${LOCATION_USAGE_INFO_PLIST_KEY} = "${escapeStringsValue(message)}";\n`;
}

/**
 * Write the `<language>.lproj/InfoPlist.strings` of one language under the app's
 * supporting directory and return the path written.
 *
 * The content is built before anything touches the disk, so a language with no copy
 * leaves no directory and no empty file behind.
 */
export async function writeInfoPlistStringsFile(
  supportingDirectory: string,
  language: string,
  messages: Readonly<Record<string, string>>,
): Promise<string> {
  const content = buildInfoPlistStrings(language, messages);
  const lprojDirectory = path.join(supportingDirectory, `${language}.lproj`);
  const stringsFile = path.join(lprojDirectory, STRINGS_FILE_NAME);

  await fs.mkdir(lprojDirectory, { recursive: true });
  await fs.writeFile(stringsFile, content);

  return stringsFile;
}

/**
 * Write one `<language>.lproj/InfoPlist.strings` per declared language and link each into
 * the application target's copy-bundle-resources phase.
 *
 * The linkage reuses the helpers Expo's own `locales` writer uses
 * (`IOSConfig.Locales.writeStringsFile`) with the same group layout and the same
 * `filepath`/`groupName` arguments, because a file that only exists on disk is not
 * copied into the app bundle: the `.lproj` folder has to be a resource of the target.
 * The file body comes from {@link buildInfoPlistStrings} instead of a `locales` map so
 * the localized copy stays in the i18n resources.
 */
export const withLocalizedLocationPermission: ConfigPlugin<LocalizedLocationPermissionProps> = (
  config,
  { messages },
) =>
  withXcodeProject(config, async (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const supportingDirectory = path.join(projectRoot, 'ios', projectName, SUPPORTING_DIRECTORY);

    for (const language of Object.keys(messages)) {
      const stringsFile = await writeInfoPlistStringsFile(supportingDirectory, language, messages);

      const groupName = [projectName, SUPPORTING_DIRECTORY, `${language}.lproj`].join('/');
      const group = IOSConfig.XcodeUtils.ensureGroupRecursively(modConfig.modResults, groupName);
      const alreadyLinked = group?.children.some(
        (child: { comment?: string }) => child.comment === STRINGS_FILE_NAME,
      );
      if (alreadyLinked) {
        continue;
      }

      modConfig.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.relative(supportingDirectory, stringsFile),
        groupName,
        project: modConfig.modResults,
        isBuildFile: true,
        verbose: true,
      });
    }

    return modConfig;
  });

export default withLocalizedLocationPermission;
